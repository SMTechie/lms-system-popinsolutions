import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromHeader } from "@/src/server/auth";
import { withWriteTransaction } from "@/src/server/prisma";
import { storeDocument } from "@/src/server/documents";

export const POST = withWriteTransaction(async (request: NextRequest) => {
  const user = await getCurrentUserFromHeader(request.headers.get("authorization")).catch(() => null);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (Number(request.headers.get("content-length") || 0) > 8 * 1024 * 1024) return NextResponse.json({ error: "File too large." }, { status: 413 });
  try { return NextResponse.json(await storeDocument(user.id, await request.json()), { status: 201 }); }
  catch (error) { return NextResponse.json({ error: (error as Error).message }, { status: 400 }); }
});
