import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromHeader } from "@/src/server/auth";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ scope: string; action: string }> }
) {
  const user = await getCurrentUserFromHeader(request.headers.get("authorization"));
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { scope, action } = await params;
  if (!["generate", "rotate"].includes(action)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (scope === "api-key") {
    return NextResponse.json({ apiKey: `pk_${randomUUID().replace(/-/g, "")}` });
  }

  if (scope === "api-secret") {
    return NextResponse.json({ apiSecret: `ps_${randomUUID().replace(/-/g, "")}` });
  }

  if (scope === "webhook-secret") {
    return NextResponse.json({ webhookSecret: `whs_${randomUUID().replace(/-/g, "")}` });
  }

  return NextResponse.json({ error: "Not found" }, { status: 404 });
}
