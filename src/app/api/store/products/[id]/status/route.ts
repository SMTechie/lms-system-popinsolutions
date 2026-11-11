import { withWriteTransaction } from "@/src/server/prisma";
import { NextRequest, NextResponse } from "next/server";
import { canManageStore, forbidden, requireUser, unauthorized } from "@/src/server/http";
import { getOperationsData, saveOperationsData } from "@/src/server/operations";

async function PATCHHandler(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireUser(request);
  if (!user) return unauthorized();
  if (!canManageStore(user)) return forbidden();
  const { id } = await params;
  const body = await request.json();
  const data = await getOperationsData();
  const product = data.store.products.find((entry) => entry.id === id);
  if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });
  product.isActive = Boolean(body.isActive);
  await saveOperationsData(data);
  return NextResponse.json(product);
}

export const PATCH = withWriteTransaction(PATCHHandler);
