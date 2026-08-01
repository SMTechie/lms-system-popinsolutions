import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { appendAuditLog, getSetting } from "@/src/server/settings";
import { getPortalData, savePortalData } from "@/src/server/portalData";

function defaultPaymentGateways() {
  return {
    primary: {
      provider: "MANUAL_EFT",
      enabled: true,
      mode: "manual",
      merchantId: "",
      publicKey: process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY || "",
      secretKey: process.env.PAYSTACK_SECRET_KEY || "",
      callbackUrl: "",
      currency: "ZAR",
    },
    alternatives: [],
  };
}

function applyPaymentToFee(data: any, payment: any) {
  const fee = (data.parent?.fees || []).find((item: any) => item.id === payment.feeId && item.learnerId === payment.learnerId);
  if (!fee || payment.appliedAt) return;
  fee.paidAmount = Math.min(Number(fee.amount || 0), Number(fee.paidAmount || 0) + Number(payment.amount || 0));
  fee.status = Number(fee.paidAmount || 0) >= Number(fee.amount || 0) ? "PAID" : Number(fee.paidAmount || 0) > 0 ? "PARTIAL" : "UNPAID";
  payment.appliedAt = new Date().toISOString();
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const gateways = await getSetting("payment-gateways", defaultPaymentGateways());
  const secretKey = gateways?.primary?.secretKey || process.env.PAYSTACK_SECRET_KEY || "";

  if (!secretKey) {
    return NextResponse.json({ error: "Paystack is not configured." }, { status: 400 });
  }

  const signature = request.headers.get("x-paystack-signature") || "";
  const expected = crypto.createHmac("sha512", secretKey).update(rawBody).digest("hex");
  if (!signature || signature !== expected) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  const event = JSON.parse(rawBody || "{}");
  const reference = String(event?.data?.reference || "");
  const data = await getPortalData();
  data.parent = data.parent || {};
  data.parent.payments = data.parent.payments || [];
  data.parent.notifications = data.parent.notifications || [];

  if (event?.event === "charge.success" && reference) {
    const payment = data.parent.payments.find((item: any) => item.reference === reference) as any;
    if (payment) {
      payment.status = "VERIFIED";
      payment.method = payment.method || "PAYSTACK";
      payment.gatewayProvider = "PAYSTACK";
      payment.gatewayStatus = "success";
      payment.gatewayVerifiedAt = new Date().toISOString();
      payment.verifiedAt = payment.verifiedAt || new Date().toISOString();
      payment.receiptNumber = payment.receiptNumber || `RCPT-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
      payment.providerResponse = event;
      applyPaymentToFee(data, payment);

      data.parent.notifications.unshift({
        id: `parent-notification-${Date.now()}`,
        learnerId: payment.learnerId,
        type: "finance",
        title: "Online payment received",
        message: "A Paystack payment was confirmed and applied to the learner fee account.",
        createdAt: new Date().toISOString(),
        readAt: null,
      });
      await savePortalData(data);
    }
  }

  await appendAuditLog({
    action: "webhook.paystack",
    entity: "payment_event",
    entityId: reference || `event-${Date.now()}`,
    metadata: {
      event: event?.event || null,
      reference,
    },
  });

  return NextResponse.json({ ok: true });
}
