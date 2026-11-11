import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromHeader } from "./auth";
import { hasPermission } from "./permissions";

export async function requireUser(request: NextRequest) {
  try {
    const user = await getCurrentUserFromHeader(request.headers.get("authorization"));
    const pathname = request.nextUrl.pathname;
    const adminPath = ["/api/inventory", "/api/requisitions", "/api/tickets", "/api/store/products", "/api/settings", "/api/audit", "/api/integrations"].some(prefix => pathname === prefix || pathname.startsWith(`${prefix}/`));
    if (user && user.role !== "ADMIN" && adminPath) return null;
    if (pathname.startsWith("/api/store/orders") && user && !["ADMIN", "PARENT"].includes(user.role)) return null;
    return user;
  } catch {
    return null;
  }
}

export function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export function forbidden() {
  return NextResponse.json({ error: "You do not have permission to perform this action." }, { status: 403 });
}

export function canManageStore(user: NonNullable<Awaited<ReturnType<typeof getCurrentUserFromHeader>>>) {
  return hasPermission(user, "uniform_store:store.manage");
}
