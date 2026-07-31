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
    data.inventory.adjustments.map((entry) => ({
      ...entry,
      location: locationMap.get(entry.locationId)
    }))
  );
}

export async function POST(request: NextRequest) {
  const user = await requireUser(request);
  if (!user) return unauthorized();

  const body = await request.json();
  const data = await getOperationsData();
  const adjustment = {
    id: randomUUID(),
    reference: `ADJ-${String(data.inventory.adjustments.length + 1).padStart(4, "0")}`,
    locationId: body.locationId,
    status: "APPROVED",
    reason: body.reason || "Adjustment",
    createdAt: new Date().toISOString(),
    lines: (body.lines || []).map((line: any) => ({
      itemId: line.itemId,
      quantityDelta: Number(line.quantityDelta || 0)
    }))
  };
  for (const line of adjustment.lines) {
    applyInventoryMovement(data, {
      type: "ADJUSTMENT",
      itemId: line.itemId,
      locationId: adjustment.locationId,
      quantityChange: line.quantityDelta,
      reason: adjustment.reason,
      referencePrefix: "ADJ"
    });
  }
  data.inventory.adjustments.unshift(adjustment);
  await saveOperationsData(data);
  return NextResponse.json(adjustment);
}
