import { NextRequest, NextResponse } from "next/server";
import { appendAuditLog } from "@/src/server/settings";
import { getPortalData, savePortalData } from "@/src/server/portalData";

function mapTwilioStatus(status: string) {
  const value = String(status || "").toLowerCase();
  if (["delivered", "sent", "read"].includes(value)) return "DELIVERED";
  if (["failed", "undelivered"].includes(value)) return "FAILED";
  if (["queued", "accepted", "scheduled"].includes(value)) return "QUEUED";
  return value.toUpperCase() || "UNKNOWN";
}

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const messageSid = String(form.get("MessageSid") || "");
  const messageStatus = String(form.get("MessageStatus") || "");
  const to = String(form.get("To") || "");
  const errorCode = String(form.get("ErrorCode") || "");
  const errorMessage = String(form.get("ErrorMessage") || "");

  if (!messageSid) {
    return NextResponse.json({ error: "Missing MessageSid" }, { status: 400 });
  }

  const data = await getPortalData();
  data.communications = data.communications || {};
  data.communications.deliveryLogs = data.communications.deliveryLogs || [];

  const delivery = data.communications.deliveryLogs.find((item: any) => item.providerMessageId === messageSid) as any;
  if (delivery) {
    delivery.status = mapTwilioStatus(messageStatus);
    delivery.error = errorMessage || errorCode || null;
    delivery.lastProviderUpdateAt = new Date().toISOString();
    if (String(messageStatus).toLowerCase() === "read") {
      delivery.openedAt = delivery.openedAt || new Date().toISOString();
    }
    await savePortalData(data);
  }

  await appendAuditLog({
    action: "webhook.twilio.status",
    entity: "delivery",
    entityId: messageSid,
    metadata: {
      to,
      messageStatus,
      errorCode,
      errorMessage,
    },
  });

  return NextResponse.json({ ok: true });
}
