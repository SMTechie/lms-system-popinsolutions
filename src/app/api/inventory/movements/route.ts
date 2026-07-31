import { NextRequest, NextResponse } from "next/server";
import { requireUser, unauthorized } from "@/src/server/http";
import { getOperationsData, withInventoryJoins } from "@/src/server/operations";

export async function GET(request: NextRequest) {
  const user = await requireUser(request);
  if (!user) return unauthorized();

  const data = await getOperationsData();
  const { items, locationMap } = withInventoryJoins(data);
  const movements = data.inventory.movements.map((movement) => ({
    ...movement,
    location: locationMap.get(movement.locationId),
    item: items.find((item) => item.id === movement.itemId)
  }));
  return NextResponse.json(movements);
}
