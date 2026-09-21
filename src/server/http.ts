import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromHeader } from "./auth";
import { hasPermission } from "./permissions";

export async function requireUser(request: NextRequest) {
  try {
    return await getCurrentUserFromHeader(request.headers.get("authorization"));
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
