import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { requireUser, unauthorized } from "@/src/server/http";
import { applyInventoryMovement, getOperationsData, saveOperationsData } from "@/src/server/operations";

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

  for (const line of req.items) {
    let itemId = line.inventoryItemId;
    if (!itemId) {
      itemId = randomUUID();
      data.inventory.items.unshift({
        id: itemId,
        name: line.itemName,
        sku: `${line.itemName.toUpperCase().replace(/[^A-Z0-9]+/g, "-").slice(0, 10)}-${data.inventory.items.length + 1}`,
        type: line.itemType || "STOCK",
        tracking: "NONE",
        reorderPoint: 5,
        minStock: 2,
        isActive: true
      });
      line.inventoryItemId = itemId;
    }

    const deliveredQty = body.items?.find((entry: any) => entry.requisitionItemId === line.id)?.quantity ?? line.quantity;
    applyInventoryMovement(data, {
      type: "RECEIVE",
      itemId,
      locationId: body.locationId,
      quantityChange: Number(deliveredQty || 0),
      reason: `Delivered via ${req.reference}`,
      referencePrefix: "DLV"
    });
  }

  req.status = "DELIVERED";
  req.requisition.procurementStatus = "DELIVERED";
  req.purchaseOrders = req.purchaseOrders.map((po) => ({ ...po, status: "DELIVERED" }));
  await saveOperationsData(data);
  return NextResponse.json(req);
}
