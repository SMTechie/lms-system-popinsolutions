import { NextRequest, NextResponse } from "next/server";
import { requireUser, unauthorized } from "@/src/server/http";
import { getOperationsData, withInventoryJoins } from "@/src/server/operations";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireUser(request);
  if (!user) return unauthorized();

  const { id } = await params;
  const { items } = withInventoryJoins(await getOperationsData());
  const item = items.find((entry) => entry.id === id);
  if (!item) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }

  return NextResponse.json(item);
}
