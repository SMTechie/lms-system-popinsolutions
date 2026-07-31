import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromHeader } from "@/src/server/auth";
import { prisma } from "@/src/server/prisma";

async function requireUser(request: NextRequest) {
  const user = await getCurrentUserFromHeader(request.headers.get("authorization"));
  if (!user) {
    return null;
  }
  return user;
}

export async function GET(request: NextRequest) {
  const user = await requireUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const settings = await prisma.setting.findMany({
    orderBy: { key: "asc" }
  });

  return NextResponse.json(settings);
}
