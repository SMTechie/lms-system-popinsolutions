import { NextResponse } from "next/server";
import { prisma } from "@/src/server/prisma";

export async function GET() {
  try { await prisma.$queryRaw`SELECT 1`; }
  catch { return NextResponse.json({ ok: false, service: "popin-lms", database: "unavailable" }, { status: 503 }); }

  return NextResponse.json({
    ok: true,
    service: "popin-lms",
    database: "connected"
  });
}
