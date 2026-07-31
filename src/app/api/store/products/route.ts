import { NextRequest, NextResponse } from "next/server";
import { requireUser, unauthorized } from "@/src/server/http";
import { createStoreProduct, getOperationsData, saveOperationsData } from "@/src/server/operations";

export async function POST(request: NextRequest) {
  const user = await requireUser(request);
  if (!user) return unauthorized();

  const data = await getOperationsData();
  const body = await request.json();
  const product = createStoreProduct(data, body);
  await saveOperationsData(data);
  return NextResponse.json(product);
}
