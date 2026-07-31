import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { requireUser, unauthorized } from "@/src/server/http";
import { getOperationsData, saveOperationsData } from "@/src/server/operations";

export async function POST(request: NextRequest) {
  const user = await requireUser(request);
  if (!user) return unauthorized();
  const body = await request.json();
  const data = await getOperationsData();
  const items = (body.items || []).map((line: any) => {
    const product = data.store.products.find((entry) => entry.id === line.productId);
    if (!product) {
      throw new Error("Product not found");
    }
    const quantity = Number(line.quantity || 0);
    product.stockQuantity = Math.max(Number(product.stockQuantity || 0) - quantity, 0);
    return {
      id: randomUUID(),
      productId: product.id,
      name: product.name,
      quantity,
      price: Number(product.basePrice || 0)
    };
  });
  const order = {
    id: randomUUID(),
    userId: user.id,
    status: "PLACED",
    paymentMethod: body.paymentMethod || "eft",
    totalAmount: items.reduce((sum: number, item: any) => sum + item.price * item.quantity, 0),
    createdAt: new Date().toISOString(),
    items
  };
  data.store.orders.unshift(order);
  for (const item of items) {
    data.store.salesHistory[item.productId] = [
      {
        id: randomUUID(),
        quantity: item.quantity,
        price: item.price,
        order: { id: order.id, createdAt: order.createdAt, status: order.status }
      },
      ...(data.store.salesHistory[item.productId] || [])
    ];
  }
  await saveOperationsData(data);
  return NextResponse.json(order);
}
