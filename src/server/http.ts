import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromHeader } from "./auth";

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
