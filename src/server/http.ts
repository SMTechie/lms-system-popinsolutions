import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromHeader } from "./auth";
import { hasPermission } from "./permissions";

export async function requireUser(request: NextRequest) {
  try {
    const user = await getCurrentUserFromHeader(request.headers.get("authorization"));
    const pathname = request.nextUrl.pathname;
    const teacherRestrictedPath = pathname.startsWith("/api/inventory") || pathname.startsWith("/api/requisitions") || pathname.startsWith("/api/tickets/requisitions") || pathname.startsWith("/api/store/orders") || pathname.startsWith("/api/store/products") || pathname.startsWith("/api/settings") || pathname.startsWith("/api/audit");
    if (user?.role === "TEACHER" && teacherRestrictedPath) return null;
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
