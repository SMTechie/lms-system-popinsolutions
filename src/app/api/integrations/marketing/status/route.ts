import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromHeader } from "@/src/server/auth";
import { getSetting } from "@/src/server/settings";

export async function GET(request: NextRequest) {
  const user = await getCurrentUserFromHeader(request.headers.get("authorization"));
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const integration = await getSetting<any>("marketing-integration", {});
  const now = new Date().toISOString();

  return NextResponse.json({
    lastApi: {
      createdAt: integration.lastCatalogSyncAt ?? now
    },
    lastWebhook: {
      createdAt: now
    },
    webhookFailureCount: 0
  });
}
