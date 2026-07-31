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
  const req = data.requisitions.find((entry) => entry.id === id);
  if (!req) return NextResponse.json({ error: "Requisition not found" }, { status: 404 });

  const po = {
    id: randomUUID(),
    reference: `PO-${String(req.purchaseOrders.length + 1).padStart(4, "0")}`,
    vendor: body.vendor || req.requisition.vendorPreference || undefined,
    status: "ORDERED",
    orderDate: new Date().toISOString(),
    expectedDeliveryDate: body.expectedDeliveryDate || null,
    items: req.items.map((item) => ({ id: randomUUID(), name: item.itemName, quantity: item.quantity }))
  };
  req.purchaseOrders.unshift(po);
  req.status = "ORDERED";
  req.requisition.procurementStatus = "ORDERED";
  await saveOperationsData(data);
  return NextResponse.json(po);
}
