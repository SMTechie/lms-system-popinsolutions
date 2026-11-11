import { withWriteTransaction } from "@/src/server/prisma";
import { NextRequest, NextResponse } from "next/server";
import { canManageStore, forbidden, requireUser, unauthorized } from "@/src/server/http";
import { createStoreProduct, getOperationsData, saveOperationsData } from "@/src/server/operations";

async function POSTHandler(request: NextRequest) {
  const user = await requireUser(request);
  if (!user) return unauthorized();
  if (!canManageStore(user)) return forbidden();

  const data = await getOperationsData();
  const body = await request.json();
  const product = createStoreProduct(data, body);
  await saveOperationsData(data);
  return NextResponse.json(product);
}

export const POST = withWriteTransaction(POSTHandler);
