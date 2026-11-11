import { withWriteTransaction } from "@/src/server/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromHeader } from "@/src/server/auth";
import { appendAuditLog, getSetting, putSetting } from "@/src/server/settings";

const fallbackIntegration = {
  websiteBaseUrl: "",
  webhookTargetUrl: "",
  publicApplyBaseUrl: "",
  catalogEndpoint: "/api/public/site",
  callbackEndpoint: "/api/public/branding",
  syncMode: "api_pull",
  defaultCatalogVisibility: "universal",
  environment: "development",
  requestSigningMode: "hmac",
  requestTimeoutSeconds: 15,
  customHeaders: {},
  retryPolicy: {
    attempts: 5,
    delays: [60, 300, 900]
  },
  shopApiEnabled: true,
  webhookEnabled: true,
  applicationFormApiEnabled: true,
  lastCatalogSyncAt: null
};

export async function GET(request: NextRequest) {
  const user = await getCurrentUserFromHeader(request.headers.get("authorization"));
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const integration = await getSetting("marketing-integration", fallbackIntegration);
  return NextResponse.json(integration);
}

async function PUTHandler(request: NextRequest) {
  const user = await getCurrentUserFromHeader(request.headers.get("authorization"));
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await request.json();
  const value = {
    ...payload,
    lastCatalogSyncAt: null
  };

  await putSetting("marketing-integration", value);
  await appendAuditLog({
    action: "UPSERT",
    entity: "Setting",
    entityId: "marketing-integration",
    actorId: user.email,
    metadata: { updated: true }
  });

  return NextResponse.json(value);
}

export const PUT = withWriteTransaction(PUTHandler);
