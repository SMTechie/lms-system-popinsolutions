import { NextRequest, NextResponse } from "next/server";
import { canManageStore, requireUser, unauthorized, forbidden } from "@/src/server/http";
import { getOperationsData } from "@/src/server/operations";
import { getSetting } from "@/src/server/settings";

export async function GET(request: NextRequest) {
  const visibility = request.nextUrl.searchParams.get("visibility");
  if (visibility === "internal") {
    const user = await requireUser(request);
    if (!user) return unauthorized();
    if (!canManageStore(user)) return forbidden();
  }

  const data = await getOperationsData();
  const gateways = await getSetting<any>("payment-gateways", {});
  const products = data.store.products
    .filter((product) => visibility === "internal" || (product.isActive && product.allowOnlinePurchase))
    .map((product) => ({
      ...product,
      ...(visibility === "internal" ? {} : { costPrice: undefined, supplierId: undefined }),
      category: data.store.categories.find((category) => category.id === product.categoryId) || null
    }));
  return NextResponse.json({
    products,
    categories: data.store.categories,
    paymentMethods: ["eft", ...(process.env.PAYSTACK_SECRET_KEY || (gateways.primary?.provider === "PAYSTACK" && gateways.primary?.enabled && gateways.primary?.secretKey) ? ["paystack"] : [])]
  });
}
