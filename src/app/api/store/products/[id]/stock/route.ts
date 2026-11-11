import { withWriteTransaction } from "@/src/server/prisma";
import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { canManageStore, forbidden, requireUser, unauthorized } from "@/src/server/http";
import { getOperationsData, saveOperationsData } from "@/src/server/operations";

async function POSTHandler(
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

  const previousQuantity = Number(product.stockQuantity || 0);
  const quantity = Number(body.quantity);
  if (!Number.isInteger(quantity) || quantity <= 0) {
    return NextResponse.json({ error: "Quantity must be a positive whole number." }, { status: 400 });
  }
  const change = quantity * (["REMOVE", "DAMAGED"].includes(body.type) ? -1 : 1);
  if (change < 0 && previousQuantity + change < 0) {
    return NextResponse.json({ error: "Stock cannot be reduced below zero." }, { status: 409 });
  }
  product.stockQuantity = Math.max(previousQuantity + change, 0);
  data.store.stockHistory[id] = [
    {
      id: randomUUID(),
      type: body.type || "RESTOCK",
      quantityChange: change,
      previousQuantity,
      newQuantity: Number(product.stockQuantity || 0),
      reason: body.reason || "",
      createdAt: new Date().toISOString()
    },
    ...(data.store.stockHistory[id] || [])
  ];
  await saveOperationsData(data);
  return NextResponse.json(product);
}

export const POST = withWriteTransaction(POSTHandler);
