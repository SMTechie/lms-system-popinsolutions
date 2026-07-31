import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { requireUser, unauthorized } from "@/src/server/http";
import { getOperationsData, saveOperationsData, withInventoryJoins } from "@/src/server/operations";

export async function GET(request: NextRequest) {
  const user = await requireUser(request);
  if (!user) return unauthorized();

  const data = await getOperationsData();
  const { locationMap } = withInventoryJoins(data);
  return NextResponse.json(
    data.inventory.counts.map((entry) => ({
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
  const count = {
    id: randomUUID(),
    reference: `CNT-${String(data.inventory.counts.length + 1).padStart(4, "0")}`,
    locationId: body.locationId,
    status: "OPEN",
    type: body.type || "Full Count",
    createdAt: new Date().toISOString()
  };
  data.inventory.counts.unshift(count);
  await saveOperationsData(data);
  return NextResponse.json(count);
}
