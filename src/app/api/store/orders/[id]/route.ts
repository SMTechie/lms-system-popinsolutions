import { NextRequest, NextResponse } from "next/server";
import { withWriteTransaction } from "@/src/server/prisma";
import { requireUser, unauthorized } from "@/src/server/http";
import { transitionOrder } from "@/src/server/orders";

export const PATCH = withWriteTransaction(async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireUser(request);
  if (!user) return unauthorized();
  const body = await request.json();
  try { return NextResponse.json(await transitionOrder((await params).id, user, body.status, body.reference)); }
  catch (error) { return NextResponse.json({ error: (error as Error).message }, { status: 409 }); }
});
