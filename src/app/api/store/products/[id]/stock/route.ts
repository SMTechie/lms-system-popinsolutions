import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { requireUser, unauthorized } from "@/src/server/http";
import { getOperationsData, saveOperationsData } from "@/src/server/operations";

export async function POST(
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

  const previousQuantity = Number(product.stockQuantity || 0);
  const change = Number(body.quantity || 0) * (["REMOVE", "DAMAGED"].includes(body.type) ? -1 : 1);
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
