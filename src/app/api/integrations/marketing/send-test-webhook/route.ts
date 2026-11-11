import { withWriteTransaction } from "@/src/server/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromHeader } from "@/src/server/auth";
import { callMarketing } from "@/src/server/marketing";

async function POSTHandler(request: NextRequest) {
  const user = await getCurrentUserFromHeader(request.headers.get("authorization"));
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try { return NextResponse.json(await callMarketing(true)); }
  catch (error) { return NextResponse.json({ ok: false, error: (error as Error).message }); }
}

export const POST = withWriteTransaction(POSTHandler);
