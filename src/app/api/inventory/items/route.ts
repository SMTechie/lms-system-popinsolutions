import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { requireUser, unauthorized } from "@/src/server/http";
import { getOperationsData, saveOperationsData, withInventoryJoins } from "@/src/server/operations";

export async function GET(request: NextRequest) {
  const user = await requireUser(request);
  if (!user) return unauthorized();

  const search = request.nextUrl.searchParams.get("search")?.toLowerCase() || "";
  const active = request.nextUrl.searchParams.get("active");
  const { items } = withInventoryJoins(await getOperationsData());
  const filtered = items.filter((item) => {
    const matchesSearch = !search || `${item.name} ${item.sku}`.toLowerCase().includes(search);
    const matchesActive = active === "true" ? item.isActive : true;
    return matchesSearch && matchesActive;
  });
  return NextResponse.json({ items: filtered });
}

export async function POST(request: NextRequest) {
  const user = await requireUser(request);
  if (!user) return unauthorized();

  const body = await request.json();
  const data = await getOperationsData();
  const item = {
    id: randomUUID(),
    name: body.name,
    sku: body.sku,
    categoryId: body.categoryId || undefined,
    unitId: body.unitId || undefined,
    type: body.type || "CONSUMABLE",
    tracking: body.tracking || "NONE",
    reorderPoint: Number(body.reorderPoint || 0),
    minStock: Number(body.minStock || 0),
    isActive: true
  };
  data.inventory.items.unshift(item);
  await saveOperationsData(data);
  return NextResponse.json(item);
}
