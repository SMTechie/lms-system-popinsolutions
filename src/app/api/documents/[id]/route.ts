import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromHeader } from "@/src/server/auth";
import { prisma } from "@/src/server/prisma";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUserFromHeader(request.headers.get("authorization")).catch(() => null);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const document = await prisma.document.findFirst({ where: { id: (await params).id, ...(user.role === "ADMIN" ? {} : { ownerId: user.id }) } });
  if (!document) return NextResponse.json({ error: "Document not found." }, { status: 404 });
  return new NextResponse(new Uint8Array(document.content), { headers: { "Content-Type": document.mimeType, "Content-Disposition": `attachment; filename="${document.name}"`, "X-Content-Type-Options": "nosniff", "Cache-Control": "private, no-store" } });
}
