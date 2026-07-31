import { NextRequest, NextResponse } from "next/server";
import { requireUser, unauthorized } from "@/src/server/http";
import { computeInventoryAlerts, getOperationsData, withInventoryJoins } from "@/src/server/operations";

export async function GET(request: NextRequest) {
  const user = await requireUser(request);
  if (!user) return unauthorized();

  const data = await getOperationsData();
  const { items } = withInventoryJoins(data);
  const lowStockIds = new Set(computeInventoryAlerts(data).map((item) => item.itemId));
  return NextResponse.json(items.filter((item) => lowStockIds.has(item.id)));
}
