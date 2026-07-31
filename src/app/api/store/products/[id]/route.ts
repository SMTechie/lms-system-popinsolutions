import { NextRequest, NextResponse } from "next/server";
import { requireUser, unauthorized } from "@/src/server/http";
import { getOperationsData, saveOperationsData } from "@/src/server/operations";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireUser(request);
  if (!user) return unauthorized();
  const { id } = await params;
  const body = await request.json();
  const data = await getOperationsData();
  const product = data.store.products.find((entry) => entry.id === id);
  if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });
  Object.assign(product, {
    ...body,
    primaryImage: body.images?.[0]?.url || body.primaryImage || product.primaryImage
  });
  await saveOperationsData(data);
  return NextResponse.json(product);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireUser(request);
  if (!user) return unauthorized();
  const { id } = await params;
  const data = await getOperationsData();
  data.store.products = data.store.products.filter((entry) => entry.id !== id);
  delete data.store.stockHistory[id];
  delete data.store.salesHistory[id];
  await saveOperationsData(data);
  return NextResponse.json({ ok: true });
}
