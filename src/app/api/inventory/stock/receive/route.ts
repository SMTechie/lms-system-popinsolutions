import { NextRequest, NextResponse } from "next/server";
import { requireUser, unauthorized } from "@/src/server/http";
import { applyInventoryMovement, getOperationsData, saveOperationsData } from "@/src/server/operations";

export async function POST(request: NextRequest) {
  const user = await requireUser(request);
  if (!user) return unauthorized();

  const body = await request.json();
  const data = await getOperationsData();
  const items = body.items || [];

  for (const item of items) {
    applyInventoryMovement(data, {
      type: "RECEIVE",
      itemId: item.itemId,
      locationId: body.locationId,
      quantityChange: Number(item.quantity || 0),
      unitCost: Number(item.unitCost || 0),
      reason: "Stock receipt",
      referencePrefix: "RCV"
    });
  }

  await saveOperationsData(data);
  return NextResponse.json({ ok: true });
}
