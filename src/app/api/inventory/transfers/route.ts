import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { requireUser, unauthorized } from "@/src/server/http";
import { applyInventoryMovement, getOperationsData, saveOperationsData, withInventoryJoins } from "@/src/server/operations";

export async function GET(request: NextRequest) {
  const user = await requireUser(request);
  if (!user) return unauthorized();

  const data = await getOperationsData();
  const { locationMap } = withInventoryJoins(data);
  return NextResponse.json(
    data.inventory.transfers.map((entry) => ({
      ...entry,
      fromLocation: locationMap.get(entry.fromLocationId),
      toLocation: locationMap.get(entry.toLocationId)
    }))
  );
}

export async function POST(request: NextRequest) {
  const user = await requireUser(request);
  if (!user) return unauthorized();

  const body = await request.json();
  const data = await getOperationsData();
  const transfer = {
    id: randomUUID(),
    reference: `TRF-${String(data.inventory.transfers.length + 1).padStart(4, "0")}`,
    fromLocationId: body.fromLocationId,
    toLocationId: body.toLocationId,
    status: "COMPLETED",
    createdAt: new Date().toISOString(),
    items: (body.items || []).map((item: any) => ({
      itemId: item.itemId,
      quantity: Number(item.quantity || 0)
    }))
  };

  for (const item of transfer.items) {
    applyInventoryMovement(data, { type: "TRANSFER_OUT", itemId: item.itemId, locationId: transfer.fromLocationId, quantityChange: -item.quantity, reason: transfer.reference, referencePrefix: "TRF" });
    applyInventoryMovement(data, { type: "TRANSFER_IN", itemId: item.itemId, locationId: transfer.toLocationId, quantityChange: item.quantity, reason: transfer.reference, referencePrefix: "TRF" });
  }

  data.inventory.transfers.unshift(transfer);
  await saveOperationsData(data);
  return NextResponse.json(transfer);
}
