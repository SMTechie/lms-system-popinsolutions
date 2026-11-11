import { NextRequest, NextResponse } from "next/server";
import { getBearerToken, verifyAuthToken } from "@/src/server/auth";
import { prisma } from "@/src/server/prisma";

export async function POST(request: NextRequest) {
  const token = getBearerToken(request.headers.get("authorization")) || request.cookies.get("popin_session")?.value;
  const payload = token ? await verifyAuthToken(token).catch(() => null) : null;
  if (payload?.sid) await prisma.authSession.updateMany({ where: { id: payload.sid, userId: payload.sub }, data: { revokedAt: new Date() } });
  const response = NextResponse.json({ ok: true });
  response.cookies.delete("popin_session");
  return response;
}
