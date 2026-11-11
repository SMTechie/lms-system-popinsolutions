import { withWriteTransaction } from "@/src/server/prisma";
import { NextRequest, NextResponse } from "next/server";
import { canManageStore, forbidden, requireUser, unauthorized } from "@/src/server/http";
import { createStoreProduct, getOperationsData, saveOperationsData } from "@/src/server/operations";

async function POSTHandler(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireUser(request);
  if (!user) return unauthorized();
  if (!canManageStore(user)) return forbidden();
  const { id } = await params;
  const data = await getOperationsData();
  const source = data.store.products.find((entry) => entry.id === id);
  if (!source) return NextResponse.json({ error: "Product not found" }, { status: 404 });
  const duplicate = createStoreProduct(data, {
    ...source,
    slug: `${source.slug}-copy-${Date.now()}`,
    name: `${source.name} Copy`
  });
  await saveOperationsData(data);
  return NextResponse.json(duplicate);
}

export const POST = withWriteTransaction(POSTHandler);
