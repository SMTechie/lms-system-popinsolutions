import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromHeader } from "@/src/server/auth";

export async function POST(request: NextRequest) {
  const user = await getCurrentUserFromHeader(request.headers.get("authorization"));
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({ ok: true, status: 200 });
}
