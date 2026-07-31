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
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const integration = await getSetting("marketing-integration", fallbackIntegration);
  return NextResponse.json(integration);
}

export async function PUT(request: NextRequest) {
  const user = await getCurrentUserFromHeader(request.headers.get("authorization"));
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await request.json();
  const value = {
    ...payload,
    lastCatalogSyncAt: new Date().toISOString()
  };

  await putSetting("marketing-integration", value);
  await appendAuditLog({
    action: "UPSERT",
    entity: "Setting",
    entityId: "marketing-integration",
    actorId: user.email,
    metadata: value
  });

  return NextResponse.json(value);
}
