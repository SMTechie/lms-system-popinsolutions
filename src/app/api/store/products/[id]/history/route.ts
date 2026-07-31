import { NextRequest, NextResponse } from "next/server";
import { requireUser, unauthorized } from "@/src/server/http";
import { getOperationsData } from "@/src/server/operations";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireUser(request);
  if (!user) return unauthorized();
  const { id } = await params;
  const data = await getOperationsData();
  return NextResponse.json({
    stock: data.store.stockHistory[id] || [],
    sales: data.store.salesHistory[id] || []
  });
}
