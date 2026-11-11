import { withWriteTransaction } from "@/src/server/prisma";
import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { appendAuditLog, getSetting } from "@/src/server/settings";
import { getPortalData, savePortalData } from "@/src/server/portalData";
import { prisma } from "@/src/server/prisma";
import { transitionOrder } from "@/src/server/orders";

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

async function POSTHandler(request: NextRequest) {
  const rawBody = await request.text();
  const gateways = await getSetting("payment-gateways", defaultPaymentGateways());
  const secretKey = gateways?.primary?.secretKey || process.env.PAYSTACK_SECRET_KEY || "";

  if (!secretKey) {
    return NextResponse.json({ error: "Paystack is not configured." }, { status: 400 });
  }

  const signature = request.headers.get("x-paystack-signature") || "";
  const expected = crypto.createHmac("sha512", secretKey).update(rawBody).digest("hex");
  if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  const event = JSON.parse(rawBody || "{}");
  const reference = String(event?.data?.reference || "");
  if (event?.event === "charge.success" && reference.startsWith("store-")) {
    const order = await prisma.storeOrder.findUnique({ where: { paymentReference: reference } });
    if (!order) return NextResponse.json({ error: "Unknown order." }, { status: 404 });
    if (Number(event.data.amount) !== Math.round(Number(order.totalAmount) * 100) || event.data.currency !== "ZAR") return NextResponse.json({ error: "Payment amount or currency mismatch." }, { status: 400 });
    if (order.status === "PLACED") await transitionOrder(order.id, { id: "paystack", email: "paystack", role: "ADMIN" }, "PAID", reference);
    return NextResponse.json({ ok: true });
  }
  const data = await getPortalData();
  data.parent = data.parent || {};
  data.parent.payments = data.parent.payments || [];
  data.parent.notifications = data.parent.notifications || [];

  if (event?.event === "charge.success" && reference) {
    const payment = data.parent.payments.find((item: any) => item.reference === reference) as any;
    if (payment) {
      if (Number(event.data.amount) !== Math.round(Number(payment.amount) * 100) || event.data.currency !== "ZAR") return NextResponse.json({ error: "Payment amount or currency mismatch." }, { status: 400 });
      if (payment.appliedAt) return NextResponse.json({ ok: true });
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

export const POST = withWriteTransaction(POSTHandler);
