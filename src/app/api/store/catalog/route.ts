import { NextRequest, NextResponse } from "next/server";
import { requireUser, unauthorized } from "@/src/server/http";
import { getOperationsData } from "@/src/server/operations";

export async function GET(request: NextRequest) {
  const visibility = request.nextUrl.searchParams.get("visibility");
  if (visibility === "internal") {
    const user = await requireUser(request);
    if (!user) return unauthorized();
  }

  const data = await getOperationsData();
  const products = data.store.products
    .filter((product) => visibility === "internal" || (product.isActive && product.allowOnlinePurchase))
    .map((product) => ({
      ...product,
      category: data.store.categories.find((category) => category.id === product.categoryId) || null
    }));
  return NextResponse.json({
    products,
    categories: data.store.categories
  });
}
