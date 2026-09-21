import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { requireUser, unauthorized } from "@/src/server/http";
import { getOperationsData, saveOperationsData } from "@/src/server/operations";

export async function POST(request: NextRequest) {
  const user = await requireUser(request);
  if (!user) return unauthorized();
  const body = await request.json();
  const data = await getOperationsData();
  if (!Array.isArray(body.items) || body.items.length === 0) {
    return NextResponse.json({ error: "Your cart is empty." }, { status: 400 });
  }
  const requested = new Map<string, number>();
  for (const line of body.items) {
    const quantity = Number(line.quantity);
    if (!Number.isInteger(quantity) || quantity <= 0) {
      return NextResponse.json({ error: "Each item must have a positive whole-number quantity." }, { status: 400 });
    }
    requested.set(String(line.productId), (requested.get(String(line.productId)) || 0) + quantity);
  }
  const items = Array.from(requested.entries()).map(([productId, quantity]) => {
    const product = data.store.products.find((entry) => entry.id === productId);
    if (!product) {
      return null;
    }
    if (!product.isActive || !product.allowOnlinePurchase) return null;
    if (quantity > Number(product.stockQuantity || 0)) return null;
    product.stockQuantity = Number(product.stockQuantity || 0) - quantity;
    return {
      id: randomUUID(),
      productId: product.id,
      name: product.name,
      quantity,
      price: Number(product.basePrice || 0)
    };
  });
  if (items.some((item) => !item)) {
    return NextResponse.json({ error: "One or more items are unavailable or do not have enough stock." }, { status: 409 });
  }
  const validItems = items as Array<{ id: string; productId: string; name: string; quantity: number; price: number }>;
  const order = {
    id: randomUUID(),
    userId: user.id,
    status: "PLACED",
    paymentMethod: body.paymentMethod || "eft",
    totalAmount: validItems.reduce((sum: number, item) => sum + item.price * item.quantity, 0),
    createdAt: new Date().toISOString(),
    items: validItems
  };
  data.store.orders.unshift(order);
  for (const item of validItems) {
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
