import { NextRequest, NextResponse } from "next/server";
import { requireUser, unauthorized } from "@/src/server/http";
import { computeInventoryAlerts, getOperationsData, withInventoryJoins } from "@/src/server/operations";

export async function GET(request: NextRequest) {
  const user = await requireUser(request);
  if (!user) return unauthorized();

  const data = await getOperationsData();
  const { locationMap } = withInventoryJoins(data);
  const alerts = computeInventoryAlerts(data).map((alert) => ({
    ...alert,
    location: alert.locationId ? locationMap.get(alert.locationId) : null
  }));
  return NextResponse.json(alerts);
}
