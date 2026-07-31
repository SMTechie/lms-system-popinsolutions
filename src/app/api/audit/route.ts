import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromHeader } from "@/src/server/auth";
import { prisma } from "@/src/server/prisma";

export async function GET(request: NextRequest) {
  const user = await getCurrentUserFromHeader(request.headers.get("authorization"));
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const pageSizeParam = Number(request.nextUrl.searchParams.get("pageSize") || "50");
  const pageSize = Number.isFinite(pageSizeParam) ? Math.min(Math.max(pageSizeParam, 1), 200) : 50;

  const items = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: pageSize
  });

  return NextResponse.json({
    items
  });
}
