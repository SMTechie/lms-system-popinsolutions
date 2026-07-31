import { NextRequest, NextResponse } from "next/server";
import { requireUser, unauthorized } from "@/src/server/http";
import { getOperationsData, withInventoryJoins } from "@/src/server/operations";

export async function GET(request: NextRequest) {
  const user = await requireUser(request);
  if (!user) return unauthorized();

  const data = await getOperationsData();
  const { items, locationMap } = withInventoryJoins(data);
  const balances = data.inventory.balances.map((balance) => ({
    ...balance,
    location: locationMap.get(balance.locationId),
    item: items.find((item) => item.id === balance.itemId)
  }));
  return NextResponse.json(balances);
}
