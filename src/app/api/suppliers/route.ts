import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromHeader } from "@/src/server/auth";
import { prisma, withWriteTransaction } from "@/src/server/prisma";
import { appendAuditLog } from "@/src/server/settings";

export async function GET(request: NextRequest) {
  const user = await getCurrentUserFromHeader(request.headers.get("authorization")).catch(() => null);
  if (user?.role !== "ADMIN") return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
  return NextResponse.json(await prisma.supplier.findMany({ orderBy: { name: "asc" } }));
}

export const POST = withWriteTransaction(async (request: NextRequest) => {
  const user = await getCurrentUserFromHeader(request.headers.get("authorization")).catch(() => null);
  if (user?.role !== "ADMIN") return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
  const body = await request.json();
  const name = String(body.name || "").trim();
  if (!name || name.length > 200) return NextResponse.json({ error: "Enter a supplier name (up to 200 characters)." }, { status: 400 });
  const data = { name, email: String(body.email || "").slice(0, 254), phone: String(body.phone || "").slice(0, 40), address: String(body.address || "").slice(0, 1000), active: body.active !== false };
  const supplier = body.id ? await prisma.supplier.update({ where: { id: String(body.id) }, data }) : await prisma.supplier.create({ data });
  await appendAuditLog({ action: "supplier.save", entity: "Supplier", entityId: supplier.id, actorId: user.id });
  return NextResponse.json(supplier);
});
