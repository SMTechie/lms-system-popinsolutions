import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { requireUser, unauthorized } from "@/src/server/http";
import { getOperationsData, saveOperationsData, withInventoryJoins } from "@/src/server/operations";

export async function GET(request: NextRequest) {
  const user = await requireUser(request);
  if (!user) return unauthorized();

  const status = request.nextUrl.searchParams.get("status");
  const data = await getOperationsData();
  const { items, locationMap } = withInventoryJoins(data);
  const requests = data.inventory.requests
    .filter((entry) => !status || entry.status === status)
    .map((entry) => ({
      ...entry,
      location: entry.locationId ? locationMap.get(entry.locationId) : null,
      lines: entry.lines.map((line) => ({
        ...line,
        item: items.find((item) => item.id === line.itemId)
      }))
    }));

  return NextResponse.json(requests);
}

export async function POST(request: NextRequest) {
  const user = await requireUser(request);
  if (!user) return unauthorized();

  const body = await request.json();
  const data = await getOperationsData();
  const entry = {
    id: randomUUID(),
    reference: `ISR-${String(data.inventory.requests.length + 1).padStart(4, "0")}`,
    locationId: body.locationId || undefined,
    department: body.department || undefined,
    status: "PENDING_APPROVAL",
    createdAt: new Date().toISOString(),
    lines: (body.lines || []).map((line: any) => ({
      itemId: line.itemId,
      quantityRequested: Number(line.quantityRequested || 0)
    }))
  };
  data.inventory.requests.unshift(entry);
  await saveOperationsData(data);
  return NextResponse.json(entry);
}
