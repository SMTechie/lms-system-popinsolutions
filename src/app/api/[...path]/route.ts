import { markExtractedAnswers, processQueuedScripts } from "@/src/server/assessmentProcessing";
import { syncDirectory } from "@/src/server/directorySync";
import { encryptSecret } from "@/src/server/secrets";
import { rateLimit } from "@/src/server/accountSecurity";
import { timingSafeEqual } from "node:crypto";
import { storeDocument } from "@/src/server/documents";
import { withWriteTransaction } from "@/src/server/prisma";
import { NextRequest, NextResponse } from "next/server";
import {
  buildAnalyticsSnapshot,
  buildAdminDashboard,
  buildBoardsData,
  buildDefaultActivity,
  buildDefaultNotifications,
  createDefaultBoards,
  listAdminUsers,
} from "@/src/server/adminData";
import {
  buildDisciplineOverview,
  buildHostelDashboard,
  buildHostelOverview,
  getPortalData,
  learnerName,
  savePortalData,
  uid,
} from "@/src/server/portalData";
import { hashPassword, requireCurrentUserFromHeader } from "@/src/server/auth";
import {
  renderCommunicationCampaignEmail,
  renderDisciplineEmail,
  renderGuardianLinkedEmail,
  renderTeacherWelcomeEmail,
  sendTransactionalEmail,
} from "@/src/server/email";
import { initializePaystackTransaction, sendTwilioMessage, verifyPaystackTransaction } from "@/src/server/providers";
import { prisma } from "@/src/server/prisma";
import { getOperationsData, saveOperationsData } from "@/src/server/operations";
import { appendAuditLog, getSetting, putSetting } from "@/src/server/settings";
import { hasPermission } from "@/src/server/permissions";
import { transitionOrder } from "@/src/server/orders";
import { addTeacherNotification, assignedTeacherEmail, isNotificationRecipient, isTeacherRecipient, markNotificationReadForUser, notificationForUser, notificationsForUser } from "@/src/server/notifications";

type RouteContext = { params: Promise<{ path: string[] }> };

export async function GET(request: NextRequest, context: RouteContext) {
  // The student hostel view can issue an initial access pass.
  if ((await context.params).path[0] === "student") return withWriteTransaction(handle)(request, context);
  return handle(request, context);
}

async function POSTHandler(request: NextRequest, context: RouteContext) {
  return handle(request, context);
}

async function PUTHandler(request: NextRequest, context: RouteContext) {
  return handle(request, context);
}

async function PATCHHandler(request: NextRequest, context: RouteContext) {
  return handle(request, context);
}

async function DELETEHandler(request: NextRequest, context: RouteContext) {
  return handle(request, context);
}

async function handle(request: NextRequest, { params }: RouteContext) {
  const { path } = await params;
  const route = path.join("/");
  const method = request.method;
  const data = await getPortalData();
  const operations = await getOperationsData();
  if (route === "jobs/run" && method === "POST") {
    const configured = process.env.JOBS_SECRET || "";
    const supplied = request.headers.get("authorization")?.replace(/^Bearer /, "") || "";
    if (configured.length < 24 || configured.length !== supplied.length || !timingSafeEqual(Buffer.from(configured), Buffer.from(supplied))) return json({ error: "Unauthorized" }, 401);
    ensureCommunicationsData(data);
    let processed = 0;
    for (const campaign of data.communications.campaigns.filter((item: any) => ["SCHEDULED", "RETRY"].includes(item.status) && new Date(item.nextAttemptAt || item.scheduledFor).getTime() <= Date.now()).slice(0, 5)) {
      await deliverCampaign(data, campaign, { id: "scheduler", email: "scheduler" });
      processed += 1;
    }
    await savePortalData(data);
    await processQueuedScripts(data);
    await savePortalData(data);
    await prisma.oAuthState.deleteMany({ where: { expiresAt: { lt: new Date() } } });
    await prisma.rateLimit.deleteMany({ where: { resetAt: { lt: new Date(Date.now() - 86400000) } } });
    await prisma.authChallenge.deleteMany({ where: { expiresAt: { lt: new Date(Date.now() - 86400000) } } });
    await putSetting("worker-health", { lastRunAt: new Date().toISOString(), processed });
    return json({ processed });
  }
  const publicRoute =
    (path[0] === "applications" && path[1] === "new") ||
    (path[0] === "public" && ["appointments", "enquiries", "newsletter"].includes(path[1] || ""));
  const user = publicRoute ? null : await requireCurrentUserFromHeader(request.headers.get("authorization")).catch(() => null);
  if (publicRoute && method !== "GET" && !await rateLimit(`public:${request.headers.get("x-forwarded-for")?.split(",")[0] || "unknown"}`, 30, 60)) return json({ error: "Too many submissions. Please try again later." }, 429);

  if (!publicRoute && !user) {
    return json({ error: "Unauthorized" }, 401);
  }

  try {
    if (path[0] === "public") return await handlePublic(request, method, path, data);
    if (path[0] === "admin") return await handleAdmin(request, method, path, data, operations, user);
    if (path[0] === "boards") return await handleBoards(request, method, path, data, operations, user);
    if (path[0] === "parent") return await handleParent(request, method, path, data, user);
    if (path[0] === "teacher") return await handleTeacher(request, method, path, data, operations, user);
    if (path[0] === "student") return await handleStudent(request, method, path, data, user);
    if (path[0] === "teacher-assistant") return await handleTeacherAssistant(request, method, path, data, user);
    if (path[0] === "students") return await handleStudents(request, method, path, data, user);
    if (path[0] === "hostel") return await handleHostel(request, method, path, data, user);
    if (path[0] === "applications") return await handleApplications(request, method, path, data, user);
    if (path[0] === "identity") return await handleIdentity(request, method, path, data, user);
  } catch (error: any) {
    return json({ error: error.message || "Portal request failed" }, 400);
  }

  return json({ error: `API route not found: /api/${route}` }, 404);
}

async function readBody(request: NextRequest) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

function getActiveHostelQrPass(data: any, learner: any) {
  const passes = data.hostel.qrPasses || [];
  const active = passes.find((item: any) => item.learnerId === learner.id && item.active !== false);
  return active || null;
}

function ensureHostelQrPass(data: any, learner: any) {
  data.hostel.qrPasses = data.hostel.qrPasses || [];
  const existing = getActiveHostelQrPass(data, learner);
  if (existing) return existing;
  const pass = {
    id: uid("qr-pass"),
    learnerId: learner.id,
    code: `HST-${learner.studentNumber || learner.id}-V1`,
    version: 1,
    active: true,
    issuedAt: new Date().toISOString(),
    rotatedAt: null,
    rotatedBy: null,
  };
  data.hostel.qrPasses.unshift(pass);
  return pass;
}

function buildHostelQrValue(data: any, learner: any) {
  const pass = getActiveHostelQrPass(data, learner) || ensureHostelQrPass(data, learner);
  return `POPIN-HOSTEL|${pass.code}`;
}

function parseHostelQrValue(data: any, value: string) {
  const parts = String(value || "").split("|");
  if (parts[0] !== "POPIN-HOSTEL") return null;
  if (parts.length === 2) {
    const code = parts[1];
    const pass = (data.hostel.qrPasses || []).find((item: any) => item.code === code && item.active !== false);
    if (!pass) return null;
    return { learnerId: pass.learnerId, code };
  }
  if (parts.length >= 3) {
    return { learnerId: parts[1], studentNumber: parts[2] || "" };
  }
  return null;
}

function buildHostelMovementHistory(data: any, learnerId: string) {
  const history: any[] = [];
  const allocation = (data.hostel.allocations || []).find((item: any) => item.learnerId === learnerId);
  if (allocation) {
    history.push({
      id: `allocation-start-${allocation.id}`,
      eventType: allocation.status,
      source: "ALLOCATION",
      createdAt: allocation.checkedInAt || allocation.startDate || new Date().toISOString(),
      notes: "Hostel allocation opened.",
    });
    if (allocation.checkedInAt) {
      history.push({
        id: `allocation-checkin-${allocation.id}`,
        eventType: "CHECKED_IN_RESIDENCE",
        source: "ALLOCATION",
        createdAt: allocation.checkedInAt,
        notes: "Learner was checked into the hostel residence.",
      });
    }
    if (allocation.checkedOutAt) {
      history.push({
        id: `allocation-checkout-${allocation.id}`,
        eventType: "CHECKED_OUT_RESIDENCE",
        source: "ALLOCATION",
        createdAt: allocation.checkedOutAt,
        notes: allocation.checkOutReason || "Learner was checked out of the hostel residence.",
      });
    }
  }

  for (const event of data.hostel.scanEvents || []) {
    if (event.learnerId !== learnerId) continue;
    history.push({
      id: event.id,
      eventType: event.eventType,
      source: event.context || "SCAN",
      createdAt: event.scannedAt,
      notes: event.notes || "",
      scannedBy: event.scannedBy || "",
    });
  }

  for (const rollCall of data.hostel.rollCalls || []) {
    const entry = (rollCall.entries || []).find((item: any) => item.learnerId === learnerId);
    if (!entry) continue;
    history.push({
      id: `roll-${rollCall.id}-${learnerId}`,
      eventType: `ROLL_CALL_${entry.status || "PRESENT"}`,
      source: rollCall.session || "ROLL_CALL",
      createdAt: rollCall.rollDate || new Date().toISOString(),
      notes: `Recorded during ${String(rollCall.session || "hostel").replaceAll("_", " ").toLowerCase()} roll call.`,
    });
  }

  return history.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

function residentsCountFromHostel(data: any) {
  return (data.hostel.allocations || []).filter((item: any) => ["RESERVED", "CHECKED_IN"].includes(item.status)).length;
}

function addParentHostelNotification(data: any, learnerId: string, title: string, message: string) {
  data.parent.notifications = data.parent.notifications || [];
  data.parent.notifications.unshift({
    id: uid("parent-notification"),
    learnerId,
    type: "hostel",
    title,
    message,
    createdAt: new Date().toISOString(),
    readAt: null,
  });
}

function ensureCommunicationsData(data: any) {
  data.communications = data.communications || {};
  data.communications.audiences = data.communications.audiences || [];
  data.communications.campaigns = data.communications.campaigns || [];
  data.communications.resources = data.communications.resources || [];
  data.communications.calendar = data.communications.calendar || [];
  data.communications.templates = data.communications.templates || [];
  data.communications.deliveryLogs = data.communications.deliveryLogs || [];

  if (!data.communications.audiences.length) {
    data.communications.audiences = [
      {
        id: "audience-all-families",
        name: "All families",
        type: "SYSTEM",
        filters: { roles: ["PARENT"], grades: [], classes: [], languages: [] },
        memberCount: Math.max(
          data.learners.reduce((sum: number, learner: any) => sum + (learner.guardians || []).length, 0),
          0,
        ),
      },
      {
        id: "audience-all-learners",
        name: "All learners",
        type: "SYSTEM",
        filters: { roles: ["STUDENT"], grades: [], classes: [], languages: [] },
        memberCount: data.learners.length,
      },
    ];
  }
  if (!data.communications.audiences.some((item: any) => item.id === "audience-all-teachers")) {
    data.communications.audiences.push({
      id: "audience-all-teachers",
      name: "All teachers",
      type: "SYSTEM",
      filters: { roles: ["TEACHER"], grades: [], classes: [], languages: [] },
      memberCount: 0,
    });
  }
  // Support records created by the earlier single-channel campaign model.
  // This keeps existing school data compatible with the current UI and delivery flow.
  for (const campaign of data.communications.campaigns) {
    campaign.title = campaign.title || campaign.name || "Untitled campaign";
    campaign.channels = Array.isArray(campaign.channels) ? campaign.channels : campaign.channel ? [campaign.channel] : ["APP"];
    campaign.audienceId = campaign.audienceId || "audience-all-families";
    campaign.scheduledFor = campaign.scheduledFor || campaign.scheduledAt || null;
    campaign.metrics = campaign.metrics || {
      recipients: Number(campaign.deliveryCount || 0),
      delivered: Number(campaign.deliveredCount || 0),
      opened: Number(campaign.openedCount || 0),
      failed: Number(campaign.failedCount || 0),
    };
  }
}

function defaultCommunicationProviders() {
  return {
    email: { provider: "RESEND", enabled: true, fromAddress: process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev" },
    sms: {
      provider: "NONE",
      enabled: false,
      senderId: "POPIN",
      callbackUrl: "",
      accountSid: process.env.TWILIO_ACCOUNT_SID || "",
      authToken: process.env.TWILIO_AUTH_TOKEN || "",
      fromNumber: process.env.TWILIO_FROM_NUMBER || "",
      messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID || "",
    },
    whatsapp: {
      provider: "NONE",
      enabled: false,
      businessAccountId: "",
      templateNamespace: "",
      accountSid: process.env.TWILIO_ACCOUNT_SID || "",
      authToken: process.env.TWILIO_AUTH_TOKEN || "",
      fromNumber: process.env.TWILIO_WHATSAPP_FROM || "whatsapp:+14155238886",
      messagingServiceSid: "",
      callbackUrl: "",
    },
    push: { provider: "PWA", enabled: true, vapidConfigured: false },
  };
}

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
    alternatives: [
      {
        provider: "PAYSTACK",
        enabled: false,
        mode: "test",
        merchantId: "",
        publicKey: process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY || "",
        secretKey: process.env.PAYSTACK_SECRET_KEY || "",
        callbackUrl: "",
        currency: "ZAR",
      },
      { provider: "PAYFAST", enabled: false, mode: "test", merchantId: "", publicKey: "", callbackUrl: "" },
    ],
  };
}

function getAvailableCommunicationChannels(providers: any) {
  return [
    providers?.push?.enabled && providers.push.provider !== "NONE" ? "APP" : null,
    providers?.email?.enabled && providers.email.provider !== "NONE" ? "EMAIL" : null,
    providers?.sms?.enabled && providers.sms.provider !== "NONE" ? "SMS" : null,
    providers?.whatsapp?.enabled && providers.whatsapp.provider !== "NONE" ? "WHATSAPP" : null,
  ].filter(Boolean) as string[];
}

function publicCommunicationProviders(providers: any) {
  return {
    email: { provider: providers?.email?.provider || "NONE", enabled: Boolean(providers?.email?.enabled), fromAddress: providers?.email?.fromAddress || "" },
    sms: { provider: providers?.sms?.provider || "NONE", enabled: Boolean(providers?.sms?.enabled), senderId: providers?.sms?.senderId || "", fromNumber: providers?.sms?.fromNumber || "" },
    whatsapp: { provider: providers?.whatsapp?.provider || "NONE", enabled: Boolean(providers?.whatsapp?.enabled), fromNumber: providers?.whatsapp?.fromNumber || "" },
    push: { provider: providers?.push?.provider || "PWA", enabled: Boolean(providers?.push?.enabled), vapidConfigured: Boolean(providers?.push?.vapidConfigured) },
  };
}

async function resolveAudienceRecipients(data: any, audienceId: string | null) {
  const audience = (data.communications?.audiences || []).find((item: any) => item.id === audienceId) || null;
  if (!audience) return [];
  const roleSet = new Set<string>(audience.filters?.roles || []);
  const recipients: Array<{ role: string; email: string; name: string; learnerId?: string | null; phone?: string | null }> = [];

  if (!roleSet.size || roleSet.has("PARENT")) {
    for (const learner of data.learners || []) {
      if (audience.filters?.grades?.length && !audience.filters.grades.includes(learner.gradeId)) continue;
      if (audience.filters?.classes?.length && !audience.filters.classes.includes(learner.classId)) continue;
      for (const link of learner.guardians || []) {
        if (link.guardian?.email && link.receiveAnnouncements !== false && !["REVOKED", "REJECTED", "INACTIVE", "UNLINKED"].includes(link.status)) {
          recipients.push({
            role: "PARENT",
            email: String(link.guardian.email).toLowerCase(),
            name: link.guardian.name || "Parent",
            learnerId: learner.id,
            phone:
              link.guardian.phone ||
              (String(link.guardian.email).toLowerCase() === String(data.parent?.guardianEmail || "").toLowerCase()
                ? data.parent?.profile?.phone || ""
                : ""),
          });
        }
      }
    }
  }

  if (roleSet.has("TEACHER")) {
    const teachers = await prisma.user.findMany({ where: { role: "TEACHER", registrationStatus: "APPROVED" } });
    for (const teacher of teachers) {
      const scopedClasses = (data.classes || []).filter((item: any) =>
        item.teacherEmail?.toLowerCase() === teacher.email.toLowerCase() &&
        (!audience.filters?.grades?.length || audience.filters.grades.includes(item.gradeId)) &&
        (!audience.filters?.classes?.length || audience.filters.classes.includes(item.id)),
      );
      if ((audience.filters?.grades?.length || audience.filters?.classes?.length) && !scopedClasses.length) continue;
      recipients.push({ role: "TEACHER", email: teacher.email.toLowerCase(), name: teacher.name || teacher.email });
    }
  }

  if (roleSet.has("STUDENT")) {
    for (const learner of data.learners || []) {
      if (audience.filters?.grades?.length && !audience.filters.grades.includes(learner.gradeId)) continue;
      if (audience.filters?.classes?.length && !audience.filters.classes.includes(learner.classId)) continue;
      if (learner.email) {
        recipients.push({
          role: "STUDENT",
          email: String(learner.email).toLowerCase(),
          name: `${learner.firstName || ""} ${learner.lastName || ""}`.trim() || "Learner",
          learnerId: learner.id,
          phone: learner.phone || "",
        });
      }
    }
  }

  const seen = new Set<string>();
  return recipients.filter((item) => {
    const key = `${item.role}:${item.email}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getBaseUrl(request: NextRequest) {
  const configured = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "";
  if (configured) return configured.replace(/\/$/, "");
  return request.nextUrl.origin;
}

function applyPaymentToFee(data: any, payment: any) {
  const fee = (data.parent?.fees || []).find((item: any) => item.id === payment.feeId && item.learnerId === payment.learnerId);
  if (!fee) return;
  if (payment.appliedAt) return;
  fee.paidAmount = Math.min(Number(fee.amount || 0), Number(fee.paidAmount || 0) + Number(payment.amount || 0));
  fee.status = Number(fee.paidAmount || 0) >= Number(fee.amount || 0) ? "PAID" : Number(fee.paidAmount || 0) > 0 ? "PARTIAL" : "UNPAID";
  payment.appliedAt = new Date().toISOString();
}

async function deliverCampaign(data: any, campaign: any, actor: any) {
  ensureCommunicationsData(data);
  const providers = await getSetting("communication-providers", defaultCommunicationProviders());
  const recipients = await resolveAudienceRecipients(data, campaign.audienceId);
  const now = new Date().toISOString();
  const logs: any[] = [];
  const alreadyDelivered = (recipient: any, channel: string) => data.communications.deliveryLogs.some((log: any) => log.campaignId === campaign.id && log.channel === channel && log.recipientRole === recipient.role && [recipient.email, recipient.phone].includes(log.recipient) && log.status === "DELIVERED");
  let delivered = 0;
  let failed = 0;

  if ((campaign.channels || []).includes("EMAIL")) {
    const emailTemplate = renderCommunicationCampaignEmail({
      title: campaign.title,
      subject: campaign.subject,
      content: campaign.content,
      schoolName: "POPIN School",
    });
    for (const recipient of recipients) {
      if (alreadyDelivered(recipient, "EMAIL")) { delivered += 1; continue; }
      const result = await sendTransactionalEmail({
        to: recipient.email,
        subject: emailTemplate.subject,
        html: emailTemplate.html,
        text: emailTemplate.text,
      });
      const status = result.ok ? "DELIVERED" : result.skipped ? "SKIPPED" : "FAILED";
      if (result.ok) delivered += 1;
      if (!result.ok) failed += 1;
      logs.push({
        id: uid("delivery-log"),
        campaignId: campaign.id,
        channel: "EMAIL",
        audienceId: campaign.audienceId || null,
        recipient: recipient.email,
        recipientRole: recipient.role,
        learnerId: recipient.learnerId || null,
        status,
        provider: providers.email?.provider || "RESEND",
        providerMessageId: result.id || null,
        error: result.error || null,
        openedAt: result.ok ? null : null,
        createdAt: now,
      });
    }
  }

  for (const channel of (campaign.channels || []).filter((item: string) => item !== "EMAIL")) {
    for (const recipient of recipients) {
      if (alreadyDelivered(recipient, channel)) { delivered += 1; continue; }
      if (channel === "SMS" || channel === "WHATSAPP") {
        const providerConfig = channel === "SMS" ? providers.sms || {} : providers.whatsapp || {};
        if (!recipient.phone) {
          failed += 1;
          logs.push({
            id: uid("delivery-log"),
            campaignId: campaign.id,
            channel,
            audienceId: campaign.audienceId || null,
            recipient: recipient.email,
            recipientRole: recipient.role,
            learnerId: recipient.learnerId || null,
            status: "FAILED",
            provider: providerConfig.provider || "NONE",
            providerMessageId: null,
            error: "Recipient phone number is missing.",
            openedAt: null,
            createdAt: now,
          });
          continue;
        }

        const twilioResult =
          providerConfig.provider === "TWILIO"
            ? await sendTwilioMessage({
                to: recipient.phone,
                body: campaign.content || campaign.subject || campaign.title,
                channel,
                accountSid: providerConfig.accountSid,
                authToken: providerConfig.authToken,
                fromNumber: providerConfig.fromNumber,
                messagingServiceSid: providerConfig.messagingServiceSid,
                statusCallbackUrl: providerConfig.callbackUrl,
              })
            : { ok: false, skipped: true, error: `${channel} provider is not connected yet.` };
        const status = twilioResult.ok ? "DELIVERED" : twilioResult.skipped ? "SKIPPED" : "FAILED";
        if (twilioResult.ok) delivered += 1;
        if (!twilioResult.ok) failed += 1;
        logs.push({
          id: uid("delivery-log"),
          campaignId: campaign.id,
          channel,
          audienceId: campaign.audienceId || null,
          recipient: recipient.phone,
          recipientRole: recipient.role,
          learnerId: recipient.learnerId || null,
          status,
          provider: providerConfig.provider || "NONE",
          providerMessageId: twilioResult.id || null,
          error: twilioResult.error || null,
          openedAt: null,
          createdAt: now,
        });
        continue;
      }

      logs.push({
        id: uid("delivery-log"),
        campaignId: campaign.id,
        channel,
        audienceId: campaign.audienceId || null,
        recipient: recipient.email,
        recipientRole: recipient.role,
        learnerId: recipient.learnerId || null,
        status: channel === "APP" ? "DELIVERED" : "PENDING_PROVIDER_SETUP",
        provider:
          channel === "SMS"
            ? providers.sms?.provider || "NONE"
            : channel === "WHATSAPP"
              ? providers.whatsapp?.provider || "NONE"
              : providers.push?.provider || "PWA",
        providerMessageId: null,
        error: channel === "APP" ? null : `${channel} provider is not connected yet.`,
        openedAt: null,
        createdAt: now,
      });
      if (channel === "APP") {
        const portal = recipient.role.toLowerCase();
        data[portal] = data[portal] || {};
        data[portal].notifications = data[portal].notifications || [];
        data[portal].notifications.unshift({
          id: uid("campaign-notification"),
          campaignId: campaign.id,
          recipientEmail: recipient.email,
          recipientRole: recipient.role,
          learnerId: recipient.learnerId || null,
          type: "announcement",
          title: campaign.title || campaign.subject || "School announcement",
          message: campaign.content || "",
          createdAt: now,
          readAt: null,
        });
        delivered += 1;
      }
    }
  }

  data.communications.deliveryLogs.unshift(...logs);
  campaign.attempts = (campaign.attempts || 0) + 1;
  campaign.status = failed ? (campaign.attempts >= 5 ? "FAILED" : "RETRY") : "SENT";
  campaign.nextAttemptAt = failed ? new Date(Date.now() + Math.min(3600000, 60000 * 2 ** campaign.attempts)).toISOString() : null;
  campaign.sentAt = now;
  campaign.lastDeliveryAt = now;
  campaign.metrics = {
    recipients: recipients.length * Math.max((campaign.channels || []).length, 1),
    delivered,
    opened: data.communications.deliveryLogs.filter((log: any) => log.campaignId === campaign.id && log.openedAt).length,
    failed,
  };

  await appendAuditLog({
    action: "DELIVER",
    entity: "Campaign",
    entityId: campaign.id,
    actorId: actor?.email,
    metadata: {
      campaignId: campaign.id,
      title: campaign.title,
      delivered,
      failed,
      channels: campaign.channels,
    },
  });
}

function resolveStudentLearner(data: any, user: any, request: NextRequest) {
  if (user.role === "ADMIN") {
    const learnerId = request.nextUrl.searchParams.get("learnerId") || "";
    if (learnerId) return data.learners.find((item: any) => item.id === learnerId) || null;
    return data.learners[0] || null;
  }
  return data.learners.find((item: any) => String(item.email || "").toLowerCase() === user.email?.toLowerCase()) || null;
}

function buildAdminAssistantResponse(data: any, prompt: string) {
  const fees = data.parent?.fees || [];
  const payments = data.parent?.payments || [];
  const plans = data.parent?.paymentPlans || [];
  const attendance = data.parent?.attendance || [];
  const campaigns = data.communications?.campaigns || [];
  const hostelEvents = data.hostel?.scanEvents || [];
  const discipline = data.disciplinary?.records || [];
  const applications = data.applications?.forms?.flatMap((form: any) => form.submissions || []) || [];

  if (prompt.includes("balance") || prompt.includes("fee") || prompt.includes("payment")) {
    const outstanding = fees.reduce((sum: number, item: any) => sum + Number(item.amount || 0) - Number(item.paidAmount || 0), 0);
    const pending = payments.filter((item: any) => item.status === "PENDING_VERIFICATION");
    return {
      answer: `Finance snapshot prepared. There is R ${outstanding.toFixed(2)} still outstanding across school accounts, with ${pending.length} payment submission(s) waiting for verification.`,
      bullets: [
        `${plans.filter((item: any) => item.status === "ACTIVE").length} payment plan(s) are currently active.`,
        `${payments.filter((item: any) => item.status === "VERIFIED").length} payment(s) have already been verified.`,
        `${pending.length} submitted payment(s) still need finance review.`,
      ],
      metrics: [
        { label: "Outstanding", value: `R ${outstanding.toFixed(2)}` },
        { label: "Pending verification", value: String(pending.length) },
        { label: "Active plans", value: String(plans.filter((item: any) => item.status === "ACTIVE").length) },
      ],
    };
  }

  if (prompt.includes("attendance") || prompt.includes("absent") || prompt.includes("late")) {
    const risk = attendance.filter((item: any) => ["ABSENT", "LATE"].includes(item.status));
    const byLearner = new Map<string, number>();
    for (const item of risk) byLearner.set(item.learnerId, (byLearner.get(item.learnerId) || 0) + 1);
    const top = Array.from(byLearner.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([learnerId, count]) => `${learnerName(data, learnerId)} (${count})`);
    return {
      answer: `Attendance review complete. ${risk.length} recent attendance records are marked absent or late.`,
      bullets: top.length ? top : ["No high-risk learner pattern was found in the current attendance data."],
      metrics: [
        { label: "Attendance risk items", value: String(risk.length) },
        { label: "Absences", value: String(attendance.filter((item: any) => item.status === "ABSENT").length) },
        { label: "Late arrivals", value: String(attendance.filter((item: any) => item.status === "LATE").length) },
      ],
    };
  }

  if (prompt.includes("campaign") || prompt.includes("communication") || prompt.includes("message")) {
    return {
      answer: `Communications review complete. ${campaigns.filter((item: any) => item.status === "SENT").length} campaign(s) have already been sent and ${campaigns.filter((item: any) => item.status === "SCHEDULED").length} remain scheduled.`,
      bullets: campaigns.slice(0, 3).map((item: any) => `${item.title} / ${item.status} / ${item.channels.join(", ")}`),
      metrics: [
        { label: "Campaigns", value: String(campaigns.length) },
        { label: "Scheduled", value: String(campaigns.filter((item: any) => item.status === "SCHEDULED").length) },
        { label: "Sent", value: String(campaigns.filter((item: any) => item.status === "SENT").length) },
      ],
    };
  }

  if (prompt.includes("hostel") || prompt.includes("meal") || prompt.includes("scan")) {
    return {
      answer: `Hostel activity summary ready. ${hostelEvents.length} hostel scan event(s) are in the current dataset.`,
      bullets: hostelEvents.slice(0, 3).map((item: any) => `${learnerName(data, item.learnerId)} / ${item.eventType} / ${new Date(item.scannedAt).toLocaleString("en-ZA")}`),
      metrics: [
        { label: "Scans", value: String(hostelEvents.length) },
        { label: "Residents", value: String(residentsCountFromHostel(data)) },
        { label: "Incidents", value: String((data.hostel?.incidents || []).length) },
      ],
    };
  }

  if (prompt.includes("discipline")) {
    return {
      answer: `Discipline review complete. ${discipline.length} record(s) are currently stored, with ${discipline.filter((item: any) => item.status === "OPEN").length} still open.`,
      bullets: discipline.slice(0, 3).map((item: any) => `${learnerName(data, item.learnerId)} / ${item.title} / ${item.severity}`),
      metrics: [
        { label: "Open", value: String(discipline.filter((item: any) => item.status === "OPEN").length) },
        { label: "Resolved", value: String(discipline.filter((item: any) => item.status === "RESOLVED").length) },
        { label: "Awaiting parent acknowledgement", value: String(discipline.filter((item: any) => item.requiresAcknowledgement && !item.parentAcknowledgedAt).length) },
      ],
    };
  }

  if (prompt.includes("admission") || prompt.includes("application")) {
    return {
      answer: `Admissions overview prepared. ${applications.length} application record(s) are currently available in the system.`,
      bullets: applications.slice(0, 3).map((item: any) => `${item.applicantName || "Applicant"} / ${item.status} / ${item.submissionReference || "No reference"}`),
      metrics: [
        { label: "Applications", value: String(applications.length) },
        { label: "Approved", value: String(applications.filter((item: any) => item.status === "APPROVED").length) },
        { label: "Pending review", value: String(applications.filter((item: any) => ["SUBMITTED", "IN_REVIEW"].includes(item.status)).length) },
      ],
    };
  }

  return {
    answer: "AI Assist is ready. Ask about finance, attendance, communications, hostel, discipline, or admissions and I will summarise the current school data for you.",
    bullets: [
      "Try: Which payments still need verification?",
      "Try: Summarise attendance risk by learner.",
      "Try: What communications are still scheduled?",
    ],
    metrics: [
      { label: "Learners", value: String((data.learners || []).length) },
      { label: "Campaigns", value: String((data.communications?.campaigns || []).length) },
      { label: "Payments", value: String((data.parent?.payments || []).length) },
    ],
  };
}

async function handleAdmin(request: NextRequest, method: string, path: string[], data: any, operations: any, user: any) {
  ensureRole(user, ["ADMIN"]);
  if (path[1] === "enquiries") ensurePermission(user, "enquiries:read");
  if (path[1] === "appointments") ensurePermission(user, "appointments:manage");
  const users = await listAdminUsers();

  if (!data.activity?.length) data.activity = buildDefaultActivity(data, operations);
  if (!data.notifications?.length) data.notifications = buildDefaultNotifications(data, operations);
  if (!data.boards?.length) data.boards = createDefaultBoards(data);

  if (method === "GET" && path[1] === "dashboard") {
    return json(buildAdminDashboard(data, operations, users));
  }

  if (method === "GET" && path[1] === "analytics") {
    return json(buildAnalyticsSnapshot(data, operations, users));
  }

  if (method === "GET" && path[1] === "notifications") {
    return json(data.notifications);
  }

  if (method === "GET" && path[1] === "enquiries") {
    return json({
      enquiries: data.enquiries || [],
      appointments: data.parent?.appointments || [],
      subscribers: data.newsletterSubscribers || [],
      appointmentSettings: getAppointmentSettings(data),
    });
  }

  if (method === "GET" && path[1] === "appointments" && path[2] === "settings") return json(getAppointmentSettings(data));
  if (method === "PATCH" && path[1] === "appointments" && path[2] === "settings") {
    const body = await readBody(request);
    const current = getAppointmentSettings(data);
    const days = Array.isArray(body.days) ? body.days.map((day: any) => Number(day)).filter((day: number) => day >= 0 && day <= 6) : current.days;
    const opens = String(body.opens || current.opens);
    const closes = String(body.closes || current.closes);
    const durationMinutes = Math.max(15, Math.min(240, Number(body.durationMinutes || current.durationMinutes)));
    const conflictWindowMinutes = Math.max(0, Math.min(240, Number(body.conflictWindowMinutes ?? current.conflictWindowMinutes)));
    if (!days.length || !/^([01]\d|2[0-3]):[0-5]\d$/.test(opens) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(closes) || opens >= closes) return json({ error: "Choose valid appointment days and opening hours." }, 400);
    data.appointmentSettings = { days, opens, closes, durationMinutes, conflictWindowMinutes };
    await savePortalData(data);
    return json(data.appointmentSettings);
  }

  if (method === "PATCH" && path[1] === "enquiries" && path[2]) {
    const item = (data.enquiries || []).find((entry: any) => entry.id === path[2]);
    if (!item) return json({ error: "Enquiry not found." }, 404);
    const body = await readBody(request);
    const status = String(body.status || "").toUpperCase();
    if (!["NEW", "IN_PROGRESS", "CONTACTED", "RESOLVED", "ARCHIVED"].includes(status)) return json({ error: "Invalid enquiry status." }, 400);
    item.status = status;
    item.updatedAt = new Date().toISOString();
    await savePortalData(data);
    return json(item);
  }

  if (method === "POST" && path[1] === "enquiries" && path[2] && path[3] === "reply") {
    const item = (data.enquiries || []).find((entry: any) => entry.id === path[2]);
    if (!item) return json({ error: "Enquiry not found." }, 404);
    const body = await readBody(request);
    const message = String(body.message || "").trim();
    if (!message) return json({ error: "Reply message is required." }, 400);
    item.replies = [{ id: uid("reply"), message, sentAt: new Date().toISOString(), sentBy: user.email }, ...(item.replies || [])];
    item.status = "CONTACTED";
    item.updatedAt = new Date().toISOString();
    await savePortalData(data);
    return json(item);
  }

  if (method === "POST" && path[1] === "notifications" && path[2] === "read-all") {
    data.notifications = (data.notifications || []).map((item: any) => ({ ...item, read: true }));
    await savePortalData(data);
    return json(data.notifications);
  }

  if (method === "GET" && path[1] === "users") {
    return json(users);
  }

  if (method === "POST" && path[1] === "users") {
    ensureRole(user, ["ADMIN"]);
    const body = await readBody(request);
    const email = String(body.email || "").trim().toLowerCase();
    const name = String(body.name || "").trim();
    const password = String(body.password || "");
    const role = String(body.role || "TEACHER").toUpperCase();
    if (!name || !email || !password) return json({ error: "Name, email, and password are required." }, 400);
    if (password.length < 12 || password.length > 128) return json({ error: "Use a password of 12 to 128 characters." }, 400);
    if (!["ADMIN", "TEACHER", "PARENT", "STUDENT"].includes(role)) return json({ error: "Invalid user role." }, 400);
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return json({ error: "A user with this email already exists." }, 409);
    const created = await prisma.user.create({
      data: { name, email, role, passwordHash: await hashPassword(password) },
    });
    await appendAuditLog({ action: "CREATE", entity: "User", entityId: created.id, actorId: user.email, metadata: { email, role } });
    return json({ id: created.id, name: created.name, email: created.email, role: created.role }, 201);
  }

  if (method === "PATCH" && path[1] === "users" && path[2] && path[3] === "registration") {
    ensureRole(user, ["ADMIN"]);
    const body = await readBody(request);
    const registrationStatus = String(body.status || "").toUpperCase();
    if (!["APPROVED", "REJECTED"].includes(registrationStatus)) return json({ error: "Registration status must be APPROVED or REJECTED." }, 400);
    const rejectionReason = registrationStatus === "REJECTED" ? String(body.reason || "Registration rejected by administrator.").trim() : null;
    const target = await prisma.user.findUnique({ where: { id: path[2] } });
    if (!target) return json({ error: "User registration not found." }, 404);
    const updated = await prisma.user.update({
      where: { id: target.id },
      data: { registrationStatus, registrationReviewedAt: new Date(), registrationReviewedBy: user.email, registrationRejectionReason: rejectionReason },
    });
    await appendAuditLog({ action: registrationStatus === "APPROVED" ? "APPROVE" : "REJECT", entity: "UserRegistration", entityId: updated.id, actorId: user.email, metadata: { email: updated.email, reason: rejectionReason } });
    return json({ id: updated.id, email: updated.email, name: updated.name, role: updated.role, registrationStatus: updated.registrationStatus, registrationReviewedAt: updated.registrationReviewedAt, registrationRejectionReason: updated.registrationRejectionReason });
  }

  if (path[1] === "payments") {
    data.parent = data.parent || {};
    data.parent.fees = data.parent.fees || [];
    data.parent.payments = data.parent.payments || [];
    data.parent.paymentPlans = data.parent.paymentPlans || [];
    const gateways = await getSetting("payment-gateways", defaultPaymentGateways());

    if (method === "GET" && path.length === 2) {
      const payments = [...(data.parent.payments || [])].sort((a: any, b: any) =>
        String(b.paidAt || "").localeCompare(String(a.paidAt || "")),
      );
      const plans = [...(data.parent.paymentPlans || [])].sort((a: any, b: any) =>
        String(b.startDate || "").localeCompare(String(a.startDate || "")),
      );
      const fees = data.parent.fees || [];
      const overdueFees = fees.filter((item: any) => {
        if (!item.dueDate || Number(item.amount || 0) <= Number(item.paidAmount || 0)) return false;
        const due = new Date(`${String(item.dueDate).slice(0, 10)}T23:59:59.999`);
        return !Number.isNaN(due.getTime()) && due.getTime() < Date.now();
      });
      return json({
        summary: {
          outstanding: fees.reduce((sum: number, item: any) => sum + Number(item.amount || 0) - Number(item.paidAmount || 0), 0),
          overdue: overdueFees.reduce((sum: number, item: any) => sum + Number(item.amount || 0) - Number(item.paidAmount || 0), 0),
          collected: payments.filter((item: any) => item.status === "VERIFIED").reduce((sum: number, item: any) => sum + Number(item.amount || 0), 0),
          pendingVerification: payments.filter((item: any) => item.status === "PENDING_VERIFICATION").length,
          rejected: payments.filter((item: any) => item.status === "REJECTED").length,
          activePlans: plans.filter((item: any) => item.status === "ACTIVE").length,
        },
        overdueFees: overdueFees.map((item: any) => ({ ...item, learnerName: learnerName(data, item.learnerId), outstanding: Number(item.amount || 0) - Number(item.paidAmount || 0) })),
        payments: payments.map((item: any) => ({
          ...item,
          learnerName: learnerName(data, item.learnerId),
          verifiedAt: item.verifiedAt || null,
          receiptNumber: item.receiptNumber || null,
        })),
        plans: plans.map((item: any) => ({
          ...item,
          learnerName: learnerName(data, item.learnerId),
        })),
        statements: data.learners.map((learner: any) => {
          const learnerFees = fees.filter((item: any) => item.learnerId === learner.id);
          const learnerPayments = payments.filter((item: any) => item.learnerId === learner.id && item.status === "VERIFIED");
          return {
            learnerId: learner.id,
            learnerName: learnerName(data, learner.id),
            balance: learnerFees.reduce((sum: number, item: any) => sum + Number(item.amount || 0) - Number(item.paidAmount || 0), 0),
            lastPaymentAt: learnerPayments[0]?.paidAt || null,
            items: learnerFees.length,
          };
        }),
        gateways,
      });
    }

    if (method === "PUT" && path[2] === "gateways") {
      const body = await readBody(request);
      await putSetting("payment-gateways", body);
      await appendAuditLog({
        action: "UPDATE",
        entity: "PaymentGatewaySettings",
        entityId: "payment-gateways",
        actorId: user.email,
        metadata: {
          primaryProvider: body?.primary?.provider || "MANUAL_EFT",
          primaryEnabled: Boolean(body?.primary?.enabled),
        },
      });
      return json(body);
    }

    if (method === "POST" && path[2] === "plans") {
      const body = await readBody(request);
      if (!body.learnerId || !body.title || !body.instalmentAmount) {
        return json({ error: "Learner, plan title, and instalment amount are required." }, 400);
      }
      const plan = {
        id: uid("payment-plan"),
        learnerId: body.learnerId,
        title: String(body.title).trim(),
        instalmentAmount: Number(body.instalmentAmount || 0),
        frequency: body.frequency || "MONTHLY",
        startDate: body.startDate || new Date().toISOString().slice(0, 10),
        endDate: body.endDate || null,
        status: body.status || "ACTIVE",
        balance: Number(body.balance || 0),
        notes: body.notes || "",
        createdAt: new Date().toISOString(),
      };
      data.parent.paymentPlans.unshift(plan);
      await savePortalData(data);
      return json(plan, 201);
    }

    if (method === "PATCH" && path[2] === "plans" && path[3]) {
      const body = await readBody(request);
      const plan = (data.parent.paymentPlans || []).find((item: any) => item.id === path[3]);
      if (!plan) return json({ error: "Payment plan not found." }, 404);
      Object.assign(plan, body);
      await savePortalData(data);
      return json(plan);
    }
  }

  if (path[1] === "ai-assist") {
    data.parent = data.parent || {};
    data.parent.fees = data.parent.fees || [];
    data.parent.payments = data.parent.payments || [];
    data.parent.paymentPlans = data.parent.paymentPlans || [];
    ensureCommunicationsData(data);

    if (method === "GET" && path.length === 2) {
      return json({
        suggestions: [
          "Which families have outstanding balances this month?",
          "Summarise attendance risk by class.",
          "What communication campaigns still need to be sent?",
          "Show hostel movement highlights for this week.",
        ],
        domains: ["finance", "attendance", "communications", "hostel", "discipline", "admissions"],
      });
    }

    if (method === "POST" && path[2] === "query") {
      const body = await readBody(request);
      const prompt = String(body.prompt || "").trim();
      if (!prompt) return json({ error: "Enter a question for AI Assist." }, 400);
      const lower = prompt.toLowerCase();
      const result = buildAdminAssistantResponse(data, lower);
      return json({
        prompt,
        answer: result.answer,
        bullets: result.bullets,
        metrics: result.metrics,
      });
    }
  }

  if (path[1] === "communications") {
    ensureCommunicationsData(data);
    const providers = await getSetting("communication-providers", defaultCommunicationProviders());

    if (method === "GET" && path.length === 2) {
      for (const audience of data.communications.audiences) {
        audience.memberCount = (await resolveAudienceRecipients(data, audience.id)).length;
      }
      const campaigns = [...data.communications.campaigns].sort((a: any, b: any) =>
        String(b.createdAt || "").localeCompare(String(a.createdAt || "")),
      );
      const deliveryLogs = [...(data.communications.deliveryLogs || [])].sort((a: any, b: any) =>
        String(b.createdAt || "").localeCompare(String(a.createdAt || "")),
      );
      const deliveredCount = deliveryLogs.filter((item: any) => item.status === "DELIVERED").length;
      const loggableCount = deliveryLogs.filter((item: any) => item.status !== "SKIPPED").length;
      const summary = {
        campaigns: campaigns.length,
        scheduled: campaigns.filter((item: any) => item.status === "SCHEDULED").length,
        sent: campaigns.filter((item: any) => item.status === "SENT").length,
        deliveryRate: campaigns.length
          ? Math.round(
              campaigns.reduce((sum: number, item: any) => sum + Number(item.metrics?.delivered || 0), 0) /
                Math.max(campaigns.reduce((sum: number, item: any) => sum + Number(item.metrics?.recipients || 0), 0), 1) *
                100,
            )
          : 0,
        resources: data.communications.resources.length,
        events: data.communications.calendar.length,
        emailDelivered: deliveryLogs.filter((item: any) => item.channel === "EMAIL" && item.status === "DELIVERED").length,
        providerReady: [providers.email, providers.sms, providers.whatsapp, providers.push].filter((item: any) => item?.enabled).length,
        channelDeliveryRate: loggableCount ? Math.round((deliveredCount / loggableCount) * 100) : 0,
      };
      return json({
        summary,
        audiences: data.communications.audiences,
        campaigns,
        resources: data.communications.resources,
        calendar: data.communications.calendar,
        templates: data.communications.templates,
        deliveryLogs: deliveryLogs.slice(0, 120),
        providers: user?.role === "ADMIN" ? providers : publicCommunicationProviders(providers),
      });
    }

    if (method === "POST" && path[2] === "campaigns") {
      const body = await readBody(request);
      const availableChannels = getAvailableCommunicationChannels(providers);
      const requestedChannels = Array.isArray(body.channels) ? body.channels : [];
      const channels = requestedChannels.filter((channel: string) => availableChannels.includes(channel));
      if (!channels.length) return json({ error: "Select at least one configured communication channel." }, 400);
      const audience = data.communications.audiences.find((item: any) => item.id === body.audienceId) || null;
      if (!audience) return json({ error: "Select a valid audience for this campaign." }, 400);
      const recipients = Number(audience?.memberCount || body.recipientCount || 0);
      const status = body.status || (body.scheduledFor ? "SCHEDULED" : "DRAFT");
      const campaign = {
        id: uid("campaign"),
        title: String(body.title || "Untitled campaign").trim(),
        audienceId: body.audienceId || null,
        status,
        channels,
        subject: String(body.subject || "").trim(),
        content: String(body.content || "").trim(),
        scheduledFor: body.scheduledFor || null,
        sentAt: null,
        createdAt: new Date().toISOString(),
        metrics: {
          recipients,
          delivered: status === "SENT" ? recipients : 0,
          opened: 0,
          failed: 0,
        },
      };
      data.communications.campaigns.unshift(campaign);
      if (status === "SENT") await deliverCampaign(data, campaign, user);
      await savePortalData(data);
      return json(campaign, 201);
    }

    if (method === "PATCH" && path[2] === "campaigns" && path[3]) {
      const body = await readBody(request);
      const campaign = data.communications.campaigns.find((item: any) => item.id === path[3]);
      if (!campaign) return json({ error: "Campaign not found." }, 404);
      const availableChannels = getAvailableCommunicationChannels(providers);
      const validChannels = (campaign.channels || []).filter((channel: string) => availableChannels.includes(channel));
      if (body.status === "SENT" && !validChannels.length) return json({ error: "This campaign has no configured delivery channel available." }, 400);
      campaign.channels = validChannels;
      Object.assign(campaign, body);
      if (body.status === "SENT" && !campaign.sentAt) {
        await deliverCampaign(data, campaign, user);
      }
      await savePortalData(data);
      return json(campaign);
    }

    if (method === "PUT" && path[2] === "providers") {
      ensureRole(user, ["ADMIN"]);
      const body = await readBody(request);
      await putSetting("communication-providers", body);
      await appendAuditLog({
        action: "UPDATE",
        entity: "CommunicationProviderSettings",
        entityId: "communication-providers",
        actorId: user.email,
        metadata: {
          emailProvider: body?.email?.provider || "RESEND",
          smsProvider: body?.sms?.provider || "NONE",
          whatsappProvider: body?.whatsapp?.provider || "NONE",
        },
      });
      return json(body);
    }

    if (method === "POST" && path[2] === "providers" && path[3] === "test-email") {
      ensureRole(user, ["ADMIN"]);
      const body = await readBody(request);
      if (!body.email) return json({ error: "A destination email address is required." }, 400);
      const message = renderCommunicationCampaignEmail({
        title: "POPIN Communications Test",
        subject: "Provider test email",
        content: "This is a live provider test from the POPIN communications hub.",
        schoolName: "POPIN School",
      });
      const result = await sendTransactionalEmail({
        to: String(body.email).trim(),
        subject: message.subject,
        html: message.html,
        text: message.text,
      });
      await appendAuditLog({
        action: "SEND",
        entity: "CommunicationProviderTest",
        entityId: "test-email",
        actorId: user.email,
        metadata: {
          to: String(body.email).trim(),
          ok: result.ok,
          skipped: result.skipped,
          provider: providers.email?.provider || "RESEND",
          error: result.error || null,
        },
      });
      return json(result, result.ok || result.skipped ? 200 : 500);
    }

    if (method === "POST" && path[2] === "resources") {
      const body = await readBody(request);
      const resource = {
        id: uid("resource"),
        title: String(body.title || "Untitled resource").trim(),
        type: body.type || "DOCUMENT",
        category: body.category || "General",
        audienceId: body.audienceId || null,
        visibility: body.visibility || "PARENT_STUDENT",
        url: String(body.url || "").trim(),
        updatedAt: new Date().toISOString(),
      };
      data.communications.resources.unshift(resource);
      await savePortalData(data);
      return json(resource, 201);
    }

    if (method === "POST" && path[2] === "calendar") {
      const body = await readBody(request);
      const event = {
        id: uid("calendar"),
        title: String(body.title || "Untitled event").trim(),
        category: body.category || "Event",
        location: body.location || "",
        startsAt: body.startsAt || new Date().toISOString(),
        endsAt: body.endsAt || body.startsAt || new Date().toISOString(),
        audienceId: body.audienceId || null,
      };
      data.communications.calendar.unshift(event);
      await savePortalData(data);
      return json(event, 201);
    }
  }

  if (method === "GET" && path[1] === "audit") {
    const items = await prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return json(items);
  }

  if (method === "POST" && path[1] === "approvals" && path[2] === "requisitions" && path[3] && path[4] === "approve") {
    const requisition = (operations.requisitions || []).find((item: any) => item.id === path[3]);
    if (!requisition) return json({ error: "Requisition not found." }, 404);
    requisition.status = "PROCUREMENT";
    requisition.requisition.procurementStatus = "PROCUREMENT";
    requisition.approvals = [
      {
        id: uid("approval"),
        approvalRole: "Admin",
        decision: "APPROVED",
        comments: "Approved from admin operations hub",
        decidedAt: new Date().toISOString(),
        approver: { name: user.name, email: user.email },
      },
      ...(requisition.approvals || []),
    ];
    await saveOperationsData(operations);
    await appendAuditLog({
      action: "admin.requisition.approve",
      entity: "requisition",
      entityId: requisition.id,
      actorId: user.id,
      metadata: { reference: requisition.reference },
    });
    return json(requisition);
  }

  if (method === "GET" && path[1] === "finance" && path[2] === "fees") {
    const learnerId = request.nextUrl.searchParams.get("learnerId") || "";
    return json((data.parent?.fees || [])
      .map((fee: any) => ({
        ...fee,
        learnerName: learnerName(data, fee.learnerId),
        studentNumber: data.learners.find((learner: any) => learner.id === fee.learnerId)?.studentNumber || "",
        outstanding: Math.max(0, Number(fee.amount || 0) - Number(fee.paidAmount || 0)),
      }))
      .filter((fee: any) => fee.outstanding > 0 && (!learnerId || fee.learnerId === learnerId))
      .sort((a: any, b: any) => String(a.learnerName).localeCompare(String(b.learnerName))));
  }

  if (method === "GET" && path[1] === "finance" && path[2] === "learners") {
    const search = String(request.nextUrl.searchParams.get("search") || "").trim().toLowerCase();
    return json((data.learners || [])
      .filter((learner: any) => learner.status === "ACTIVE" && `${learner.firstName || ""} ${learner.lastName || ""} ${learner.studentNumber || ""}`.toLowerCase().includes(search))
      .slice(0, 20)
      .map((learner: any) => ({ id: learner.id, name: `${learner.firstName || ""} ${learner.lastName || ""}`.trim(), studentNumber: learner.studentNumber || "", gradeId: learner.gradeId || "" })));
  }

  if (method === "POST" && path[1] === "finance" && path[2] === "payments" && path.length === 3) {
    const body = await readBody(request);
    const learner = (data.learners || []).find((item: any) => item.id === String(body.learnerId || "") && item.status === "ACTIVE");
    const paymentType = String(body.paymentType || "SCHOOL_FEES").toUpperCase();
    const fee = (data.parent?.fees || []).find((item: any) => item.id === String(body.feeId || "") && item.learnerId === learner?.id);
    const amount = Number(body.amount);
    const methodName = String(body.method || "").toUpperCase();
    const reference = String(body.reference || "").trim();
    const paidAt = new Date(String(body.paidAt || ""));
    if (!learner) return json({ error: "Select an active learner." }, 400);
    if (!["SCHOOL_FEES", "TRANSPORT", "HOSTEL", "UNIFORM", "ACTIVITY", "OTHER"].includes(paymentType)) return json({ error: "Choose a valid payment type." }, 400);
    if (paymentType === "SCHOOL_FEES" && !fee) return json({ error: "Select a valid outstanding fee for this learner." }, 400);
    if (!Number.isFinite(amount) || amount <= 0) return json({ error: "Enter a payment amount greater than zero." }, 400);
    const outstanding = fee ? Math.max(0, Number(fee.amount || 0) - Number(fee.paidAmount || 0)) : null;
    if (outstanding !== null && amount > outstanding) return json({ error: `Payment cannot exceed the outstanding balance of R ${outstanding.toFixed(2)}.` }, 400);
    if (!["CASH", "EFT", "CARD"].includes(methodName)) return json({ error: "Choose Cash, EFT, or Card as the payment method." }, 400);
    if (reference.length < 2 || reference.length > 100) return json({ error: "Enter a receipt number or payment reference." }, 400);
    if (Number.isNaN(paidAt.getTime()) || paidAt.getTime() > Date.now() + 60000) return json({ error: "Enter a valid payment date and time." }, 400);
    const payment = {
      id: uid("payment"), learnerId: learner.id, feeId: fee?.id || null, paymentType, amount, method: methodName, reference,
      paidAt: paidAt.toISOString(), status: "PENDING_VERIFICATION", proofFileName: "", proofDocumentId: "",
      capturedBy: user.email, captureSource: "OFFICE",
    };
    data.parent.payments = [payment, ...(data.parent.payments || [])];
    data.parent.notifications = data.parent.notifications || [];
    data.parent.notifications.unshift({ id: uid("parent-notification"), learnerId: learner.id, type: "finance", title: "Office payment recorded", message: `A ${methodName} ${paymentType.toLowerCase().replace(/_/g, " ")} payment of R ${amount.toFixed(2)} was recorded by the school and is awaiting verification.`, createdAt: new Date().toISOString(), readAt: null });
    await savePortalData(data);
    await appendAuditLog({ action: "admin.payment.capture", entity: "payment", entityId: payment.id, actorId: user.id, metadata: { learnerId: learner.id, feeId: fee?.id || null, paymentType, amount, method: methodName, reference } });
    return json(payment, 201);
  }

  if (method === "POST" && path[1] === "finance" && path[2] === "payments" && path[3] && ["verify", "reject"].includes(path[4])) {
    const payment = (data.parent?.payments || []).find((item: any) => item.id === path[3]);
    if (!payment) return json({ error: "Payment not found." }, 404);
    payment.status = path[4] === "verify" ? "VERIFIED" : "REJECTED";
    if (path[4] === "verify") {
      payment.verifiedAt = new Date().toISOString();
      payment.receiptNumber = payment.receiptNumber || `RCPT-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
      payment.reconciledBy = user.email;
      applyPaymentToFee(data, payment);
    }
    data.parent.notifications = data.parent.notifications || [];
    data.parent.notifications.unshift({
      id: uid("parent-notification"),
      learnerId: payment.learnerId,
      type: "finance",
      title: path[4] === "verify" ? "Payment verified" : "Payment rejected",
      message:
        path[4] === "verify"
          ? `A school administrator verified the payment for ${learnerName(data, payment.learnerId)}.`
          : `A school administrator rejected the submitted payment for ${learnerName(data, payment.learnerId)}.`,
      createdAt: new Date().toISOString(),
      readAt: null,
    });
    await savePortalData(data);
    await appendAuditLog({
      action: `admin.payment.${path[4]}`,
      entity: "payment",
      entityId: payment.id,
      actorId: user.id,
      metadata: { learnerId: payment.learnerId, amount: payment.amount },
    });
    return json(payment);
  }

  if (method === "POST" && path[1] === "communications" && path[2] === "threads" && path[3] && path[4] === "close") {
    const thread = (data.parent?.messages || []).find((item: any) => item.id === path[3]);
    if (!thread) return json({ error: "Conversation not found." }, 404);
    thread.status = "CLOSED";
    thread.updatedAt = new Date().toISOString();
    await savePortalData(data);
    await appendAuditLog({
      action: "admin.communication.close",
      entity: "message_thread",
      entityId: thread.id,
      actorId: user.id,
      metadata: { learnerId: thread.learnerId },
    });
    return json(thread);
  }

  if (method === "POST" && path[1] === "appointments" && path[2] && ["confirm", "cancel"].includes(path[3])) {
    const appointment = (data.parent?.appointments || []).find((item: any) => item.id === path[2]);
    if (!appointment) return json({ error: "Appointment not found." }, 404);
    appointment.status = path[3] === "confirm" ? "CONFIRMED" : "CANCELLED";
    await savePortalData(data);
    await appendAuditLog({
      action: `admin.appointment.${path[3]}`,
      entity: "appointment",
      entityId: appointment.id,
      actorId: user.id,
      metadata: { learnerId: appointment.learnerId, startsAt: appointment.startsAt },
    });
    return json(appointment);
  }

  if (method === "PATCH" && path[1] === "users" && path[2]) {
    const body = await readBody(request);
    const updated = await prisma.user.update({
      where: { id: path[2] },
      data: {
        role: body.role || undefined,
        name: body.name || undefined,
      },
    });
    await appendAuditLog({
      action: "admin.user.update",
      entity: "user",
      entityId: updated.id,
      actorId: user.id,
      metadata: { role: updated.role, name: updated.name },
    });
    return json(updated);
  }

  return json({ error: `API route not found: /api/${path.join("/")}` }, 404);
}

async function handleBoards(request: NextRequest, method: string, path: string[], data: any, operations: any, user: any) {
  ensureRole(user, ["ADMIN"]);
  if (!data.boards?.length) data.boards = createDefaultBoards(data);

  if (method === "GET" && path.length === 1) {
    return json(buildBoardsData(data, operations));
  }

  if (method === "POST" && path.length === 1) {
    const body = await readBody(request);
    const board = {
      id: uid("board"),
      name: String(body.name || "New Board").trim(),
      slug: String(body.name || "new-board")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, ""),
      color: body.color || "#2563eb",
      columns: [
        { id: uid("column"), title: "Backlog", color: "#64748b", cards: [] },
        { id: uid("column"), title: "In Progress", color: "#2563eb", cards: [] },
        { id: uid("column"), title: "Done", color: "#16a34a", cards: [] },
      ],
    };
    data.boards.unshift(board);
    await savePortalData(data);
    return json(board, 201);
  }

  return json({ error: `API route not found: /api/${path.join("/")}` }, 404);
}

function json(value: unknown, status = 200) {
  return NextResponse.json(value, { status });
}

function ensureRole(user: any, allowed: string[]) {
  if (!user || !allowed.includes(user.role)) {
    throw new Error("Unauthorized");
  }
}

function absoluteUrl(request: NextRequest, path: string) {
  return new URL(path, request.nextUrl.origin).toString();
}

function updateAssessmentCounts(assessment: any) {
  const scripts = assessment.scripts || [];
  assessment.counts = {
    total: scripts.length,
    ready: scripts.filter((script: any) => script.status === "READY_FOR_REVIEW").length,
    needsReview: scripts.filter((script: any) => script.status === "NEEDS_REVIEW").length,
  };
  assessment.status = scripts.some((script: any) => script.status === "NEEDS_REVIEW")
    ? "NEEDS_REVIEW"
    : scripts.some((script: any) => script.status === "READY_FOR_REVIEW")
      ? "READY_FOR_REVIEW"
      : assessment.status || "DRAFT";
}

function findAssistantScript(assessments: any[], scriptId: string) {
  for (const assessment of assessments) {
    const script = (assessment.scripts || []).find((item: any) => item.id === scriptId);
    if (script) return { assessment, script };
  }
  return null;
}

async function handleParent(request: NextRequest, method: string, path: string[], data: any, user: any) {
  ensureRole(user, ["ADMIN", "PARENT"]);
  const parentEmail = user.role === "PARENT" ? user.email.toLowerCase() : null;
  data.parent = data.parent || {};
  data.parent.fees = data.parent.fees || [];
  data.parent.payments = data.parent.payments || [];
  data.parent.orders = data.parent.orders || [];
  data.parent.tickets = data.parent.tickets || [];
  data.parent.appointments = data.parent.appointments || [];
  data.parent.attendance = data.parent.attendance || [];
  data.parent.reports = data.parent.reports || [];
  data.parent.messages = data.parent.messages || [];
  data.parent.notifications = data.parent.notifications || [];
  const ownsRecord = (item: any) => user.role === "ADMIN" || (item.userId ? item.userId === user.id : String(item.parentEmail || data.parent.guardianEmail || "").toLowerCase() === parentEmail);
  data.parent.profiles = data.parent.profiles || {};
  const accountProfile = data.parent.profiles[user.id] || (data.parent.profiles[user.id] = {
    profile: parentEmail === data.parent.guardianEmail?.toLowerCase() ? data.parent.profile || {} : {},
    settings: {}, guardianName: user.name || "", guardianEmail: user.email,
  });
  data.parent.profile = data.parent.profile || {};
  data.parent.settings = data.parent.settings || {};
  data.hostel = data.hostel || {};
  data.hostel.payments = data.hostel.payments || [];

  if (method === "GET" && path.join("/") === "parent/children") {
    const links = data.learners.flatMap((learner: any) =>
      (learner.guardians || []).filter((link: any) => !["REVOKED", "REJECTED", "INACTIVE", "UNLINKED"].includes(link.status)).map((link: any) => ({
        learner,
        guardian: link.guardian,
        permissions: {
          relationshipType: link.relationshipType,
          viewFees: link.viewFees,
          payFees: link.payFees,
          viewReports: link.viewReports,
          viewHomework: link.viewHomework,
          receiveAnnouncements: link.receiveAnnouncements,
          messageTeachers: link.messageTeachers,
          authorisePickup: link.authorisePickup,
          submitApplications: link.submitApplications,
          bookAppointments: link.bookAppointments,
          viewHostel: link.viewHostel,
          applyHostel: link.applyHostel,
          viewHostelBilling: link.viewHostelBilling,
          submitHostelConcerns: link.submitHostelConcerns,
          viewHostelMovement: link.viewHostelMovement,
        },
      })),
    );
    const accessibleLinks = parentEmail ? links.filter((link: any) => link.guardian?.email?.toLowerCase() === parentEmail) : links;
    // A learner should appear once in the parent selector even if legacy data
    // contains more than one guardian link for the same parent and learner.
    const seenLearners = new Set<string>();
    return json(accessibleLinks.filter((link: any) => {
      if (seenLearners.has(link.learner.id)) return false;
      seenLearners.add(link.learner.id);
      return true;
    }));
  }

  const learnerId = path[1] === "children" ? path[2] : undefined;
  const learner = data.learners.find((item: any) => item.id === learnerId);
  const learnerLink = learner && parentEmail
    ? (learner.guardians || []).find((link: any) => link.guardian?.email?.toLowerCase() === parentEmail && !["REVOKED", "REJECTED", "INACTIVE", "UNLINKED"].includes(link.status))
    : null;
  if (learnerId && !learner) return json({ error: "Learner not found" }, 404);
  if (learnerId && parentEmail) {
    const allowed = !!learnerLink;
    if (!allowed) return json({ error: "Unauthorized" }, 401);
  }

  if (method === "GET" && path[1] === "children" && learnerId && path[3] === "overview") {
    const classes = data.classes.filter((item: any) => (item.learners || []).some((learner: any) => learner.id === learnerId));
    const workItems = classes.flatMap((item: any) => item.workItems || []).filter((item: any) => item.visibleToParents !== false);
    const discipline = (data.disciplinary?.records || [])
      .filter((item: any) => item.learnerId === learnerId && item.parentVisible !== false)
      .slice(0, 5);
    const attendance = (data.parent.attendance || [])
      .filter((item: any) => item.learnerId === learnerId)
      .sort((a: any, b: any) => String(b.date).localeCompare(String(a.date)))
      .slice(0, 6);
    const appointments = (data.parent.appointments || [])
      .filter((item: any) => item.learnerId === learnerId)
      .sort((a: any, b: any) => String(a.startsAt).localeCompare(String(b.startsAt)));
    const learnerClassIds = new Set(classes.map((item: any) => item.id));
    return json({
      homework: workItems.filter((item: any) => item.type === "HOMEWORK"),
      attendance,
      assessments: workItems.filter((item: any) => item.type === "ASSESSMENT"),
      announcements: workItems.filter((item: any) => item.type === "ANNOUNCEMENT" && item.status === "PUBLISHED"),
      appointments,
      discipline,
      timetable: classes.flatMap((item: any) => (item.timetable || []).map((period: any) => ({ ...period, className: item.name }))),
      resources: (data.teacher.resources || []).filter((item: any) => !item.classId || learnerClassIds.has(item.classId)),
      calendar: (data.teacher.calendar || []).filter((item: any) => !item.classId || learnerClassIds.has(item.classId)),
    });
  }

  if (method === "GET" && path[1] === "children" && learnerId && path[3] === "attendance") {
    return json(
      (data.parent.attendance || [])
        .filter((item: any) => item.learnerId === learnerId)
        .sort((a: any, b: any) => String(b.date).localeCompare(String(a.date))),
    );
  }

  if (method === "POST" && path[1] === "children" && learnerId && path[3] === "attendance" && path[4] === "excuse") {
    const body = await readBody(request);
    const record = (data.parent.attendance || []).find((item: any) => item.learnerId === learnerId && item.date === body.date);
    if (!record) return json({ error: "Attendance record not found for the selected date." }, 404);
    record.parentNote = String(body.reason || "").trim();
    record.excuseStatus = "SUBMITTED";
    record.excuseSubmittedAt = new Date().toISOString();
    data.parent.notifications.unshift({
      id: uid("parent-notification"),
      learnerId,
      type: "attendance",
      title: "Attendance excuse submitted",
      message: `Your excuse for ${learnerName(data, learnerId)} on ${body.date} was sent to the school.`,
      createdAt: new Date().toISOString(),
      readAt: null,
    });
    await savePortalData(data);
    return json(record);
  }

  if (method === "GET" && path[1] === "children" && learnerId && path[3] === "statement") {
    if (!learnerLink?.viewFees) return json({ error: "Statements are not enabled for this learner." }, 403);
    const items = (data.parent.fees || [])
      .filter((item: any) => item.learnerId === learnerId)
      .sort((a: any, b: any) => String(b.dueDate || "").localeCompare(String(a.dueDate || "")));
    const payments = (data.parent.payments || [])
      .filter((item: any) => item.learnerId === learnerId)
      .sort((a: any, b: any) => String(b.paidAt || b.submittedAt || "").localeCompare(String(a.paidAt || a.submittedAt || "")));
    return json({
      learnerName: learnerName(data, learnerId),
      items,
      payments,
      summary: {
        total: items.reduce((sum: number, item: any) => sum + Number(item.amount || 0), 0),
        paid: items.reduce((sum: number, item: any) => sum + Number(item.paidAmount || 0), 0),
        outstanding: items.reduce((sum: number, item: any) => sum + Math.max(0, Number(item.amount || 0) - Number(item.paidAmount || 0)), 0),
      },
    });
  }

  if (method === "GET" && path[1] === "children" && learnerId && path[3] === "fees") {
    const items = (data.parent.fees || []).filter((item: any) => item.learnerId === learnerId);
    const payments = (data.parent.payments || []).filter((item: any) => item.learnerId === learnerId);
    const gateways = await getSetting("payment-gateways", defaultPaymentGateways());
    return json({
      items,
      payments,
      summary: {
        total: items.reduce((sum: number, item: any) => sum + Number(item.amount || 0), 0),
        paid: items.reduce((sum: number, item: any) => sum + Number(item.paidAmount || 0), 0),
        outstanding: items.reduce((sum: number, item: any) => sum + Number(item.amount || 0) - Number(item.paidAmount || 0), 0),
      },
      gateway: { enabled: gateways.primary?.enabled, provider: gateways.primary?.provider, publicKey: gateways.primary?.publicKey, currency: gateways.primary?.currency },
    });
  }

  if (method === "POST" && path[1] === "children" && learnerId && path[3] === "fees" && path[4] === "payments") {
    if (!learnerLink?.payFees) return json({ error: "Fee payment is not enabled for this learner." }, 403);
    const body = await readBody(request);
    const paymentAmount = Number(body.amount || 0);
    if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) return json({ error: "Enter a payment amount." }, 400);
    const fee = (data.parent.fees || []).find((item: any) => item.id === body.feeId && item.learnerId === learnerId);
    if (!fee) return json({ error: "Fee record not found." }, 404);
    const proof = body.proofDocumentId ? await prisma.document.findFirst({ where: { id: String(body.proofDocumentId), ownerId: user.id }, select: { id: true, name: true } }) : null;
    if (body.proofDocumentId && !proof) return json({ error: "Proof document not found." }, 404);
    const payment = {
      proofDocumentId: proof?.id || null,
      id: uid("payment"),
      learnerId,
      feeId: fee.id,
      amount: paymentAmount,
      method: body.method || "EFT",
      reference: body.reference || `PAY-${Date.now()}`,
      proofFileName: body.proofFileName || "",
      paidAt: new Date().toISOString(),
      status: "PENDING_VERIFICATION",
    };
    data.parent.payments.unshift(payment);
    data.parent.notifications.unshift({
      id: uid("parent-notification"),
      learnerId,
      type: "finance",
      title: "Payment submitted",
      message: `A payment of R ${paymentAmount.toFixed(2)} was submitted for ${learnerName(data, learnerId)}.`,
      createdAt: new Date().toISOString(),
      readAt: null,
    });
    await savePortalData(data);
    return json(payment, 201);
  }

  if (method === "POST" && path[1] === "children" && learnerId && path[3] === "fees" && path[4] === "payments" && path[5] === "checkout") {
    if (!learnerLink?.payFees) return json({ error: "Fee payment is not enabled for this learner." }, 403);
    const gateways = await getSetting("payment-gateways", defaultPaymentGateways());
    const gateway = gateways.primary || {};
    if (!gateway.enabled || gateway.provider !== "PAYSTACK") {
      return json({ error: "Online checkout is not enabled for this school account." }, 400);
    }

    const body = await readBody(request);
    const paymentAmount = Number(body.amount || 0);
    if (!paymentAmount) return json({ error: "Enter a payment amount." }, 400);
    const fee = (data.parent.fees || []).find((item: any) => item.id === body.feeId && item.learnerId === learnerId);
    if (!fee) return json({ error: "Fee record not found." }, 404);

    const reference = body.reference || `PAYSTACK-${Date.now()}`;
    const payment = {
      id: uid("payment"),
      learnerId,
      feeId: fee.id,
      amount: paymentAmount,
      method: "PAYSTACK",
      reference,
      proofFileName: "",
      paidAt: new Date().toISOString(),
      status: "PENDING_PROVIDER",
      gatewayProvider: "PAYSTACK",
      gatewayStatus: "initialized",
      providerResponse: null,
    };

    const callbackBase = gateway.callbackUrl || `${getBaseUrl(request)}/parent-portal/payment-callback`;
    const callbackUrl = `${callbackBase}${callbackBase.includes("?") ? "&" : "?"}reference=${encodeURIComponent(reference)}&learnerId=${encodeURIComponent(learnerId)}`;
    const initializeResult = await initializePaystackTransaction({
      email: parentEmail || data.parent?.guardianEmail || user.email,
      amount: paymentAmount,
      reference,
      callbackUrl,
      currency: gateway.currency || "ZAR",
      secretKey: gateway.secretKey,
      metadata: {
        learnerId,
        feeId: fee.id,
        learnerName: learnerName(data, learnerId),
        schoolName: "POPIN School",
      },
    });

    if (!initializeResult.ok) {
      return json({ error: initializeResult.error || "Could not start online checkout." }, 400);
    }

    payment.providerResponse = initializeResult.raw || null;
    data.parent.payments.unshift(payment);
    await savePortalData(data);
    await appendAuditLog({
      action: "parent.payment.checkout.initialize",
      entity: "payment",
      entityId: payment.id,
      actorId: user.id,
      metadata: { learnerId, amount: paymentAmount, provider: "PAYSTACK", reference },
    });
    return json({
      payment,
      authorizationUrl: initializeResult.authorizationUrl,
      reference,
    });
  }

  if (method === "POST" && path[1] === "children" && learnerId && path[3] === "fees" && path[4] === "payments" && path[5] === "verify") {
    if (!learnerLink?.payFees) return json({ error: "Fee payment is not enabled for this learner." }, 403);
    const body = await readBody(request);
    const reference = String(body.reference || request.nextUrl.searchParams.get("reference") || "").trim();
    if (!reference) return json({ error: "Missing payment reference." }, 400);
    const payment = (data.parent.payments || []).find((item: any) => item.reference === reference && item.learnerId === learnerId);
    if (!payment) return json({ error: "Payment record not found." }, 404);

    const gateways = await getSetting("payment-gateways", defaultPaymentGateways());
    const gateway = gateways.primary || {};
    const verification = await verifyPaystackTransaction({ reference, secretKey: gateway.secretKey });
    if (!verification.ok) {
      return json({ error: verification.error || "Could not verify the transaction." }, 400);
    }

    const transaction = verification.data as any;
    payment.gatewayStatus = transaction?.status || "unknown";
    payment.providerResponse = verification.raw || null;
    payment.gatewayVerifiedAt = new Date().toISOString();
    payment.gatewayAuthorization = transaction?.authorization || null;

    if (transaction?.status === "success") {
      payment.status = "VERIFIED";
      payment.method = "PAYSTACK";
      payment.verifiedAt = payment.verifiedAt || new Date().toISOString();
      payment.receiptNumber = payment.receiptNumber || `RCPT-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
      applyPaymentToFee(data, payment);
      data.parent.notifications.unshift({
        id: uid("parent-notification"),
        learnerId,
        type: "finance",
        title: "Online payment received",
        message: `Your online payment for ${learnerName(data, learnerId)} was received and verified.`,
        createdAt: new Date().toISOString(),
        readAt: null,
      });
      await appendAuditLog({
        action: "parent.payment.checkout.verify",
        entity: "payment",
        entityId: payment.id,
        actorId: user.id,
        metadata: { learnerId, amount: payment.amount, provider: "PAYSTACK", reference },
      });
    } else {
      payment.status = "REJECTED";
    }

    await savePortalData(data);
    return json(payment);
  }

  if (method === "GET" && path[1] === "children" && learnerId && path[3] === "applications" && path[4] !== "forms") {
    const scoped = data.applications.forms.flatMap((form: any) =>
      (form.submissions || [])
        .filter(
          (submission: any) =>
            submission.learnerId === learnerId ||
            (parentEmail && String(submission.guardianEmail || "").toLowerCase() === parentEmail),
        )
        .map((submission: any) => ({
          ...submission,
          formId: form.id,
          formName: form.name,
        })),
    );
    return json(scoped);
  }

  if (method === "GET" && path[1] === "children" && learnerId && path[3] === "applications" && path[4] === "forms") {
    return json((data.applications.forms || []).filter((form: any) => form.admissionsOpenState !== "closed").map((form: any) => ({
      id: form.id, name: form.name, slug: form.slug, version: (form.versions || []).find((item: any) => item.id === form.publishedVersionId) || (form.versions || [])[0] || null,
    })));
  }

  if (method === "POST" && path[1] === "children" && learnerId && path[3] === "applications" && path[4] === "submit") {
    if (!learnerLink?.submitApplications) return json({ error: "Application submission is not enabled for this learner." }, 403);
    const body = await readBody(request);
    const form = (data.applications.forms || []).find((item: any) => item.id === body.formId || item.slug === body.slug);
    if (!form || form.admissionsOpenState === "closed") return json({ error: "Application form is not available." }, 400);
    if ((body.files || []).length > 10) return json({ error: "Upload at most 10 documents." }, 400);
    const submissionId = uid("submission");
    const files = [];
    for (const file of body.files || []) {
      const document = await storeDocument(user.id, { name: file.originalFilename, mimeType: file.mimeType, contentBase64: file.contentBase64 });
      files.push({ ...document, fieldKey: file.fieldKey, originalFilename: document.name });
    }
    const submission = { learnerId, applicantName: learnerName(data, learnerId), guardianName: user.name, guardianEmail: user.email, guardianPhone: String(body.guardianPhone || ""), payload: body.payload || {}, files, id: submissionId, submissionReference: "APP-" + String((form.submissions || []).length + 1).padStart(4, "0"), status: "SUBMITTED", submittedAt: new Date().toISOString(), submissionChannel: "parent" };
    form.submissions = [submission, ...(form.submissions || [])];
    data.parent.notifications.unshift({ id: uid("parent-notification"), learnerId, type: "application", title: "Application submitted", message: `${form.name} was submitted for ${learnerName(data, learnerId)}.`, createdAt: new Date().toISOString(), readAt: null });
    await savePortalData(data);
    return json(submission, 201);
  }

  if (method === "GET" && path[1] === "children" && learnerId && path[3] === "reports") {
    if (!learnerLink?.viewReports) return json({ error: "Reports are not enabled for this learner." }, 403);
    return json((data.parent.reports || []).filter((item: any) => item.learnerId === learnerId));
  }

  if (method === "GET" && path[1] === "children" && learnerId && path[3] === "hostel") {
    const overview = buildHostelOverview(data);
    const allocation = overview.allocations.find((item: any) => item.learnerId === learnerId) || null;
    const learner = data.learners.find((item: any) => item.id === learnerId);
    const hadActivePass = learner ? !!getActiveHostelQrPass(data, learner) : true;
    const qrPass = learner ? ensureHostelQrPass(data, learner) : null;
    const qrCodeValue = learner ? buildHostelQrValue(data, learner) : "";
    if (learner && !hadActivePass) {
      await savePortalData(data);
    }
    return json({
      application: overview.applications.find((item: any) => item.learnerId === learnerId) || null,
      allocation,
      charges: learnerLink?.viewHostelBilling ? data.hostel.charges.filter((item: any) => item.learnerId === learnerId) : [],
      payments: learnerLink?.viewHostelBilling ? data.hostel.payments.filter((item: any) => item.learnerId === learnerId) : [],
      notices: data.hostel.notices,
      qrCodeValue,
      qrCodeLabel: learner?.studentNumber || learnerId,
      qrPassVersion: qrPass?.version || 1,
      qrIssuedAt: qrPass?.issuedAt || null,
      movementHistory: learnerLink?.viewHostelMovement ? buildHostelMovementHistory(data, learnerId) : [],
    });
  }

  if (method === "POST" && path[1] === "children" && learnerId && path[3] === "hostel" && path[4] === "charges" && path[5] === "payments") {
    if (!learnerLink?.viewHostelBilling) return json({ error: "Hostel billing access is not enabled for this learner." }, 403);
    const body = await readBody(request);
    const amount = Number(body.amount || 0);
    const charge = data.hostel.charges.find((item: any) => item.id === body.chargeId && item.learnerId === learnerId);
    if (!charge || amount <= 0) return json({ error: "Select a valid hostel charge and payment amount." }, 400);
    const payment = { id: uid("hostel-payment"), learnerId, chargeId: charge.id, amount, method: body.method || "EFT", reference: body.reference || `HOSTEL-${Date.now()}`, proofFileName: body.proofFileName || "", status: "PENDING_VERIFICATION", submittedAt: new Date().toISOString() };
    data.hostel.payments.unshift(payment);
    addParentHostelNotification(data, learnerId, "Hostel payment submitted", `A hostel payment of R ${amount.toFixed(2)} was submitted for ${learnerName(data, learnerId)}.`);
    await savePortalData(data);
    return json(payment, 201);
  }

  if (method === "GET" && path[1] === "children" && learnerId && path[3] === "discipline") {
    const records = (data.disciplinary?.records || [])
      .filter((item: any) => item.learnerId === learnerId && item.parentVisible !== false)
      .map((item: any) => ({
        ...item,
        learnerName: learnerName(data, learnerId),
      }));
    return json(records);
  }

  if (
    method === "POST" &&
    path[1] === "children" &&
    learnerId &&
    path[3] === "discipline" &&
    path[5] === "acknowledge"
  ) {
    const record = (data.disciplinary?.records || []).find((item: any) => item.id === path[4] && item.learnerId === learnerId);
    if (!record) return json({ error: "Disciplinary record not found" }, 404);
    record.parentAcknowledgedAt = new Date().toISOString();
    await savePortalData(data);
    return json(record);
  }

  if (method === "GET" && path[1] === "children" && learnerId && path[3] === "appointments") {
    if (!learnerLink?.bookAppointments) return json({ error: "Appointments are not enabled for this learner." }, 403);
    return json(
      (data.parent.appointments || [])
        .filter((item: any) => item.learnerId === learnerId && (!item.parentEmail || item.parentEmail.toLowerCase() === parentEmail || user.role === "ADMIN"))
        .sort((a: any, b: any) => String(a.startsAt).localeCompare(String(b.startsAt))),
    );
  }

  if (method === "POST" && path[1] === "children" && learnerId && path[3] === "appointments") {
    if (!learnerLink?.bookAppointments) return json({ error: "Appointments are not enabled for this learner." }, 403);
    const body = await readBody(request);
    const appointment = {
      id: uid("appointment"),
      learnerId,
      teacherName: body.teacherName || "Assigned Teacher",
      teacherEmail: body.teacherEmail || assignedTeacherEmail(data, learnerId),
      title: body.title || "Parent meeting",
      startsAt: body.startsAt,
      endsAt: body.endsAt || body.startsAt,
      location: body.location || "School campus",
      notes: body.notes || "",
      status: "REQUESTED",
      createdBy: "Parent",
    };
    data.parent.appointments.unshift(appointment);
    addTeacherNotification(data, {
      learnerId,
      teacherEmail: appointment.teacherEmail,
      type: "appointment",
      title: "Parent appointment requested",
      message: `${user.name || "A parent"} requested ${appointment.title} for ${learnerName(data, learnerId)}.`,
    });
    data.parent.notifications.unshift({
      id: uid("parent-notification"),
      learnerId,
      type: "appointment",
      title: "Appointment requested",
      message: `A new appointment request was created for ${learnerName(data, learnerId)}.`,
      createdAt: new Date().toISOString(),
      readAt: null,
    });
    await savePortalData(data);
    return json(appointment, 201);
  }

  if (method === "PATCH" && path[1] === "children" && learnerId && path[3] === "appointments" && path[4]) {
    const body = await readBody(request);
    const appointment = (data.parent.appointments || []).find((item: any) => item.id === path[4] && item.learnerId === learnerId);
    if (!appointment) return json({ error: "Appointment not found." }, 404);
    if (!learnerLink?.bookAppointments || body.status !== "CANCELLED") return json({ error: "Parents can cancel their booked appointments." }, 403);
    appointment.status = "CANCELLED";
    await savePortalData(data);
    return json(appointment);
  }

  if (method === "POST" && path[1] === "children" && learnerId && path[3] === "hostel" && path[4] === "applications") {
    if (!learnerLink?.applyHostel) return json({ error: "Hostel applications are not enabled for this learner." }, 403);
    const body = await readBody(request);
    data.hostel.applications.unshift({ id: uid("hostel-app"), learnerId, status: "PENDING", ...body });
    await savePortalData(data);
    return json(data.hostel.applications[0], 201);
  }

  if (method === "POST" && path[1] === "children" && learnerId && path[3] === "hostel" && path[4] === "concerns") {
    if (!learnerLink?.submitHostelConcerns) return json({ error: "Hostel concerns are not enabled for this learner." }, 403);
    const body = await readBody(request);
    data.hostel.maintenance.unshift({ id: uid("maintenance"), learnerId, source: "Parent Portal", status: "OPEN", priority: "MEDIUM", ...body });
    await savePortalData(data);
    return json(data.hostel.maintenance[0], 201);
  }

  if (method === "POST" && path[1] === "children" && learnerId && path[3] === "hostel" && path[4] === "qr" && path[5] === "rotate") {
    if (!learnerLink?.viewHostel) return json({ error: "Hostel access is not enabled for this learner." }, 403);
    const learner = data.learners.find((item: any) => item.id === learnerId);
    if (!learner) return json({ error: "Learner not found." }, 404);
    data.hostel.qrPasses = data.hostel.qrPasses || [];
    for (const pass of data.hostel.qrPasses) {
      if (pass.learnerId === learnerId && pass.active !== false) {
        pass.active = false;
        pass.rotatedAt = new Date().toISOString();
        pass.rotatedBy = user?.name || data.parent.guardianName || "Parent";
      }
    }
    const nextVersion =
      Math.max(
        0,
        ...data.hostel.qrPasses
          .filter((item: any) => item.learnerId === learnerId)
          .map((item: any) => Number(item.version || 0)),
      ) + 1;
    const pass = {
      id: uid("qr-pass"),
      learnerId,
      code: `HST-${learner.studentNumber || learnerId}-V${nextVersion}`,
      version: nextVersion,
      active: true,
      issuedAt: new Date().toISOString(),
      rotatedAt: null,
      rotatedBy: null,
    };
    data.hostel.qrPasses.unshift(pass);
    addParentHostelNotification(
      data,
      learnerId,
      "Hostel QR pass rotated",
      `A new hostel QR pass was issued for ${learnerName(data, learnerId)}. Please use the latest QR code in the parent portal.`,
    );
    await savePortalData(data);
    return json({
      qrCodeValue: buildHostelQrValue(data, learner),
      qrCodeLabel: learner.studentNumber || learnerId,
      qrPassVersion: pass.version,
      qrIssuedAt: pass.issuedAt,
    });
  }

  if (method === "GET" && path[1] === "children" && learnerId && path[3] === "messages") {
    if (!learnerLink?.messageTeachers) return json({ error: "Messaging is not enabled for this learner." }, 403);
    return json(
      (data.parent.messages || [])
        .filter((item: any) => item.learnerId === learnerId && (!item.parentEmail || item.parentEmail.toLowerCase() === parentEmail || user.role === "ADMIN"))
        .sort((a: any, b: any) => String(b.updatedAt).localeCompare(String(a.updatedAt))),
    );
  }

  if (method === "POST" && path[1] === "children" && learnerId && path[3] === "messages") {
    if (!learnerLink?.messageTeachers) return json({ error: "Messaging is not enabled for this learner." }, 403);
    const body = await readBody(request);
    const thread = {
      id: uid("thread"),
      learnerId,
      subject: body.subject || "Parent message",
      parentEmail: user.email,
      teacherEmail: assignedTeacherEmail(data, learnerId),
      status: "OPEN",
      updatedAt: new Date().toISOString(),
      messages: [
        {
          id: uid("thread-message"),
          authorRole: "PARENT",
          authorName: user.name || data.parent.guardianName || "Parent",
          message: body.message || "",
          createdAt: new Date().toISOString(),
        },
      ],
    };
    data.parent.messages.unshift(thread);
    addTeacherNotification(data, {
      learnerId,
      teacherEmail: thread.teacherEmail,
      type: "message",
      title: "New parent message",
      message: `${user.name || "A parent"} sent a message: ${thread.subject}.`,
    });
    data.teacher.dashboard.parentQueries.unshift({
      id: uid("query"),
      learnerId,
      subject: thread.subject,
      status: "OPEN",
      message: body.message || "",
    });
    await savePortalData(data);
    return json(thread, 201);
  }

  if (
    method === "POST" &&
    path[1] === "children" &&
    learnerId &&
    path[3] === "messages" &&
    path[4] &&
    path[5] === "reply"
  ) {
    if (!learnerLink?.messageTeachers && user.role !== "ADMIN") return json({ error: "Messaging is not enabled for this learner." }, 403);
    const body = await readBody(request);
    const thread = (data.parent.messages || []).find((item: any) => item.id === path[4] && item.learnerId === learnerId && (!item.parentEmail || item.parentEmail.toLowerCase() === parentEmail || user.role === "ADMIN"));
    if (!thread) return json({ error: "Conversation not found." }, 404);
    if (!String(body.message || "").trim()) return json({ error: "Enter a reply." }, 400);
    const reply = {
      id: uid("thread-message"),
      authorRole: "PARENT",
      authorName: user.name || data.parent.guardianName || "Parent",
      message: body.message || "",
      createdAt: new Date().toISOString(),
    };
    thread.messages.push(reply);
    thread.updatedAt = reply.createdAt;
    thread.status = "OPEN";
    addTeacherNotification(data, {
      learnerId,
      teacherEmail: thread.teacherEmail || assignedTeacherEmail(data, learnerId),
      type: "message",
      title: "Parent reply received",
      message: `${user.name || "A parent"} replied to ${thread.subject}.`,
    });
    await savePortalData(data);
    return json(reply, 201);
  }

  if (method === "GET" && path.join("/") === "parent/orders") {
    return json(
      [...await prisma.storeOrder.findMany({ where: user.role === "ADMIN" ? {} : { userId: user.id }, orderBy: { createdAt: "desc" } }), ...(data.parent.orders || []).filter(ownsRecord)],
    );
  }

  if (method === "PATCH" && path[1] === "orders" && path[2]) {
    const body = await readBody(request);
    if (await prisma.storeOrder.findUnique({ where: { id: path[2] } })) return json(await transitionOrder(path[2], user, body.status, body.reference));
    const order = (data.parent.orders || []).find((item: any) => item.id === path[2] && ownsRecord(item));
    if (!order) return json({ error: "Order not found." }, 404);
    if (body.status !== "COLLECTED" || order.status !== "READY_FOR_COLLECTION") return json({ error: "Only orders ready for collection can be collected." }, 409);
    order.status = "COLLECTED";
    order.collectedAt = new Date().toISOString();
    await savePortalData(data);
    return json(order);
  }

  if (method === "GET" && path.join("/") === "parent/tickets") {
    return json((data.parent.tickets || []).filter(ownsRecord).sort((a: any, b: any) => String(b.createdAt).localeCompare(String(a.createdAt))));
  }

  if (method === "POST" && path.join("/") === "parent/tickets") {
    const body = await readBody(request);
    const ticket = {
      id: uid("parent-ticket"),
      userId: user.id, parentEmail: user.email,
      learnerId: body.learnerId || null,
      title: body.title || "Support request",
      category: body.category || "General",
      priority: body.priority || "MEDIUM",
      status: "OPEN",
      description: body.description || "",
      createdAt: new Date().toISOString(),
      replies: [
        {
          id: uid("ticket-reply"),
          authorRole: "PARENT",
          authorName: user.name || data.parent.guardianName || "Parent",
          message: body.description || "",
          createdAt: new Date().toISOString(),
        },
      ],
    };
    data.parent.tickets.unshift(ticket);
    await savePortalData(data);
    return json(ticket, 201);
  }

  if (method === "POST" && path[1] === "tickets" && path[2] && path[3] === "replies") {
    const body = await readBody(request);
    const ticket = (data.parent.tickets || []).find((item: any) => item.id === path[2] && ownsRecord(item));
    if (!ticket) return json({ error: "Ticket not found." }, 404);
    const reply = {
      id: uid("ticket-reply"),
      authorRole: "PARENT",
      authorName: user.name || data.parent.guardianName || "Parent",
      message: body.message || "",
      createdAt: new Date().toISOString(),
    };
    ticket.replies = [...(ticket.replies || []), reply];
    await savePortalData(data);
    return json(reply, 201);
  }

  if (method === "PATCH" && path[1] === "tickets" && path[2]) {
    const body = await readBody(request);
    const ticket = (data.parent.tickets || []).find((item: any) => item.id === path[2] && ownsRecord(item));
    if (!ticket) return json({ error: "Ticket not found." }, 404);
    if (!["OPEN", "CLOSED"].includes(body.status)) return json({ error: "Choose OPEN or CLOSED." }, 400);
    ticket.status = body.status;
    await savePortalData(data);
    return json(ticket);
  }

  if (method === "GET" && path.join("/") === "parent/notifications") {
    return json(notificationsForUser(data, user, "PARENT"));
  }

  if (method === "POST" && path.join("/") === "parent/notifications/read-all") {
    data.parent.notifications.filter((item: any) => isNotificationRecipient(data, user, item, "PARENT")).forEach((item: any) => markNotificationReadForUser(item, user));
    await savePortalData(data);
    return json(notificationsForUser(data, user, "PARENT"));
  }

  if (method === "POST" && path[1] === "notifications" && path[2] && path[3] === "read") {
    const notification = data.parent.notifications.find((item: any) => item.id === path[2] && isNotificationRecipient(data, user, item, "PARENT"));
    if (!notification) return json({ error: "Notification not found." }, 404);
    markNotificationReadForUser(notification, user);
    await savePortalData(data);
    return json(notificationsForUser(data, user, "PARENT").find((item: any) => item.id === notification.id));
  }

  if (path.join("/") === "parent/profile") {
    if (method === "PATCH") {
      const body = await readBody(request);
      accountProfile.profile = { ...accountProfile.profile, ...(body.profile || {}) };
      accountProfile.settings = { ...accountProfile.settings, ...(body.settings || {}) };
      if (typeof body.guardianName === "string") accountProfile.guardianName = body.guardianName.trim();
      await savePortalData(data);
    }
    if (["GET", "PATCH"].includes(method)) return json(accountProfile);
  }

  return json({ error: `API route not found: /api/${path.join("/")}` }, 404);
}

async function handleTeacher(request: NextRequest, method: string, path: string[], data: any, operations: any, user: any) {
  ensureRole(user, ["ADMIN", "TEACHER"]);
  data.teacher = data.teacher || {};
  data.teacher.dashboard = data.teacher.dashboard || {};
  data.teacher.profile = data.teacher.profile || {};
  data.teacher.resources = data.teacher.resources || [];
  data.teacher.progressReports = data.teacher.progressReports || [];
  data.teacher.calendar = data.teacher.calendar || [];
  data.teacher.notifications = data.teacher.notifications || [];
  data.teacher.gradebook = data.teacher.gradebook || {};
  const teacherClasses = user.role === "ADMIN"
    ? data.classes
    : data.classes.filter((item: any) => item.teacherEmail?.toLowerCase() === user.email?.toLowerCase());
  for (const schoolClass of teacherClasses) {
    const rosterIds = new Set((schoolClass.learners || []).map((item: any) => item.id));
    schoolClass.learners = (data.learners || []).filter((learner: any) => learner.classId ? learner.classId === schoolClass.id : rosterIds.has(learner.id));
    schoolClass.assignments = schoolClass.assignments || [];
    schoolClass.timetable = schoolClass.timetable || [];
    schoolClass.workItems = schoolClass.workItems || [];
    schoolClass.grade = schoolClass.grade || (data.grades || []).find((grade: any) => grade.id === schoolClass.gradeId);
  }
  if (method === "GET" && path.join("/") === "teacher/dashboard") {
    const parentQueries = (data.parent?.messages || [])
      .filter((thread: any) => isTeacherRecipient(data, user, thread))
      .filter((thread: any) => thread.status !== "CLOSED")
      .map((thread: any) => ({
        id: thread.id,
        learnerId: thread.learnerId,
        subject: thread.subject,
        status: thread.status,
        teacherName: thread.teacherName || "Assigned Teacher",
        teacherEmail: thread.teacherEmail || assignedTeacherEmail(data, thread.learnerId),
        learnerName: learnerName(data, thread.learnerId),
        updatedAt: thread.updatedAt,
        message: thread.messages?.[thread.messages.length - 1]?.message || "",
      }));
    const requisitions = (operations?.requisitions || []).filter(
      (item: any) =>
        item.createdBy?.email?.toLowerCase() === user.email?.toLowerCase() ||
        item.createdBy?.name === user.name,
    );
    const appointmentRequests = (data.parent?.appointments || []).filter(
      (item: any) =>
        isTeacherRecipient(data, user, item),
    );
    data.teacher.dashboard.parentQueries = parentQueries;
    data.teacher.dashboard.requisitions = requisitions;
    data.teacher.dashboard.appointmentRequests = appointmentRequests;
    return json(data.teacher.dashboard);
  }
  if (method === "GET" && path.join("/") === "teacher/classes") return json(teacherClasses);
  if (method === "POST" && path.join("/") === "teacher/timetable") {
    const body = await readBody(request);
    const schoolClass = teacherClasses.find((item: any) => item.id === body.classId);
    if (!schoolClass) return json({ error: "Class not found." }, 404);
    const startsAt = String(body.startsAt || "");
    const endsAt = String(body.endsAt || "");
    if (!body.subject || !startsAt || !endsAt || startsAt >= endsAt) return json({ error: "Enter a valid subject and time range." }, 400);
    const day = String(body.day || "Monday");
    const overlaps = (schoolClass.timetable || []).some((item: any) => item.day === day && startsAt < item.endsAt && endsAt > item.startsAt);
    if (overlaps) return json({ error: "This class already has a timetable period during that time." }, 409);
    const room = String(body.room || schoolClass.room || "");
    const crossClassConflict = data.classes.some((candidate: any) =>
      (candidate.timetable || []).some((item: any) => item.day === day && startsAt < item.endsAt && endsAt > item.startsAt &&
        ((room && item.room === room) || candidate.teacherEmail?.toLowerCase() === user.email?.toLowerCase())),
    );
    if (crossClassConflict) return json({ error: "This teacher or room is already booked during that time." }, 409);
    const period = { id: uid("timetable"), day, subject: String(body.subject).trim(), startsAt, endsAt, room, class: { name: schoolClass.name, room: schoolClass.room } };
    schoolClass.timetable = [...(schoolClass.timetable || []), period].sort((a: any, b: any) => `${a.day || ""}${a.startsAt}`.localeCompare(`${b.day || ""}${b.startsAt}`));
    await savePortalData(data);
    return json(period, 201);
  }

  if ((method === "PATCH" || method === "DELETE") && path[1] === "timetable" && path[2]) {
    const schoolClass = teacherClasses.find((item: any) => (item.timetable || []).some((period: any) => period.id === path[2]));
    if (!schoolClass) return json({ error: "Timetable period not found." }, 404);
    if (method === "DELETE") {
      schoolClass.timetable = (schoolClass.timetable || []).filter((period: any) => period.id !== path[2]);
      await savePortalData(data);
      return json({ ok: true });
    }
    const body = await readBody(request);
    const period = (schoolClass.timetable || []).find((item: any) => item.id === path[2]);
    const updated = { ...period, ...body };
    if (!updated.subject || !updated.startsAt || !updated.endsAt || updated.startsAt >= updated.endsAt) {
      return json({ error: "Enter a valid subject and time range." }, 400);
    }
    const overlaps = (schoolClass.timetable || []).some((item: any) => item.id !== path[2] && item.day === updated.day && updated.startsAt < item.endsAt && updated.endsAt > item.startsAt);
    if (overlaps) return json({ error: "This class already has a timetable period during that time." }, 409);
    Object.assign(period, { day: String(updated.day || "Monday"), subject: String(updated.subject).trim(), startsAt: String(updated.startsAt), endsAt: String(updated.endsAt), room: String(updated.room || schoolClass.room || "") });
    await savePortalData(data);
    return json(period);
  }
  if (method === "GET" && path.join("/") === "teacher/resources") return json(data.teacher.resources);
  if (method === "POST" && path.join("/") === "teacher/resources") {
    const body = await readBody(request);
    if (!String(body.title || "").trim() || !String(body.url || "").trim()) return json({ error: "A resource title and file/link are required." }, 400);
    const resource = { id: uid("resource"), title: String(body.title).trim(), url: String(body.url).trim(), category: String(body.category || "General"), classId: body.classId || "", createdAt: new Date().toISOString(), createdBy: user.email };
    data.teacher.resources.unshift(resource);
    await savePortalData(data);
    return json(resource, 201);
  }
  if (method === "GET" && path.join("/") === "teacher/reports") return json(data.teacher.progressReports);
  if (method === "POST" && path.join("/") === "teacher/reports") {
    const body = await readBody(request);
    const schoolClass = teacherClasses.find((item: any) => item.id === body.classId);
    const learner = schoolClass?.learners?.find((item: any) => item.id === body.learnerId);
    if (!schoolClass || !learner || !String(body.comment || "").trim()) return json({ error: "Select a learner and enter a progress comment." }, 400);
    const report = { id: uid("progress-report"), learnerId: learner.id, learnerName: `${learner.firstName} ${learner.lastName}`, classId: schoolClass.id, className: schoolClass.name, term: String(body.term || "Current term"), comment: String(body.comment).trim(), createdAt: new Date().toISOString(), teacherEmail: user.email };
    data.teacher.progressReports.unshift(report);
    await savePortalData(data);
    return json(report, 201);
  }
  if (method === "GET" && path.join("/") === "teacher/calendar") return json(data.teacher.calendar);
  if (method === "POST" && path.join("/") === "teacher/calendar") {
    const body = await readBody(request);
    if (!String(body.title || "").trim() || !String(body.startsAt || "").trim()) return json({ error: "A title and start time are required." }, 400);
    const event = { id: uid("teacher-event"), title: String(body.title).trim(), type: String(body.type || "Lesson"), startsAt: String(body.startsAt), endsAt: String(body.endsAt || ""), notes: String(body.notes || ""), classId: body.classId || "", createdAt: new Date().toISOString(), teacherEmail: user.email };
    data.teacher.calendar.unshift(event);
    await savePortalData(data);
    return json(event, 201);
  }
  if (method === "GET" && path.join("/") === "teacher/notifications") return json(notificationsForUser(data, user, "TEACHER"));
  if (method === "POST" && path.join("/") === "teacher/notifications/read-all") {
    data.teacher.notifications.filter((item: any) => isNotificationRecipient(data, user, item, "TEACHER")).forEach((item: any) => markNotificationReadForUser(item, user));
    await savePortalData(data);
    return json(notificationsForUser(data, user, "TEACHER"));
  }
  if (method === "POST" && path[1] === "notifications" && path[2] && path[3] === "read") {
    const notification = data.teacher.notifications.find((item: any) => item.id === path[2] && isNotificationRecipient(data, user, item, "TEACHER"));
    if (!notification) return json({ error: "Notification not found." }, 404);
    markNotificationReadForUser(notification, user);
    await savePortalData(data);
    return json(notificationsForUser(data, user, "TEACHER").find((item: any) => item.id === notification.id));
  }
  if (method === "GET" && path.join("/") === "teacher/gradebook") {
    const assessments = teacherClasses.flatMap((schoolClass: any) => (schoolClass.workItems || []).filter((item: any) => item.type === "ASSESSMENT").map((item: any) => ({ ...item, classId: schoolClass.id, className: schoolClass.name, learners: schoolClass.learners || [] })));
    const assessmentId = request.nextUrl.searchParams.get("assessmentId");
    return json({ assessments, entries: assessmentId ? data.teacher.gradebook[assessmentId] || [] : [] });
  }
  if (method === "POST" && path.join("/") === "teacher/gradebook") {
    const body = await readBody(request);
    const assessment = teacherClasses.flatMap((schoolClass: any) => (schoolClass.workItems || []).filter((item: any) => item.type === "ASSESSMENT").map((item: any) => ({ ...item, classId: schoolClass.id, learners: schoolClass.learners || [] }))).find((item: any) => item.id === body.assessmentId);
    if (!assessment || !Array.isArray(body.entries)) return json({ error: "Assessment or grade entries not found." }, 400);
    const learnerIds = new Set((assessment.learners || []).map((item: any) => item.id));
    data.teacher.gradebook[assessment.id] = body.entries.filter((item: any) => learnerIds.has(item.learnerId)).map((item: any) => ({ learnerId: item.learnerId, mark: item.mark === "" ? "" : Number(item.mark), comment: String(item.comment || ""), updatedAt: new Date().toISOString(), updatedBy: user.email }));
    await savePortalData(data);
    return json(data.teacher.gradebook[assessment.id]);
  }
  if (method === "GET" && path.join("/") === "teacher/messages") {
    return json(
      (data.parent?.messages || [])
        .filter((thread: any) => isTeacherRecipient(data, user, thread))
        .map((thread: any) => ({ ...thread, learnerName: learnerName(data, thread.learnerId) }))
        .sort((a: any, b: any) => String(b.updatedAt).localeCompare(String(a.updatedAt))),
    );
  }
  if (method === "POST" && path.join("/") === "teacher/messages") {
    const body = await readBody(request);
    const learner = teacherClasses.flatMap((item: any) => item.learners).find((item: any) => item.id === body.learnerId);
    if (!learner) return json({ error: "Learner not found in your assigned classes." }, 404);
    const subject = String(body.subject || "").trim();
    const message = String(body.message || "").trim();
    if (!subject || !message) return json({ error: "Enter a subject and message." }, 400);
    if (!(learner.guardians || []).some((link: any) => link.guardian?.email && link.messageTeachers !== false && !["REVOKED", "REJECTED", "INACTIVE", "UNLINKED"].includes(link.status))) {
      return json({ error: "No linked guardian is available for this learner's messages." }, 400);
    }
    const now = new Date().toISOString();
    const thread = {
      id: uid("thread"), learnerId: learner.id, subject, teacherEmail: user.email, teacherName: user.name || user.email,
      status: "OPEN", updatedAt: now,
      messages: [{ id: uid("thread-message"), authorRole: "TEACHER", authorName: user.name || user.email, message, createdAt: now }],
    };
    data.parent = data.parent || {};
    data.parent.messages = data.parent.messages || [];
    data.parent.messages.unshift(thread);
    data.parent.notifications = data.parent.notifications || [];
    const recipientEmails = (learner.guardians || []).filter((link: any) => link.guardian?.email && link.messageTeachers !== false && !["REVOKED", "REJECTED", "INACTIVE", "UNLINKED"].includes(link.status)).map((link: any) => link.guardian.email);
    data.parent.notifications.unshift({
      id: uid("parent-notification"), learnerId: learner.id, recipientEmails, recipientRole: "PARENT", type: "message",
      title: "New teacher message", message: `${user.name || "Your teacher"} sent a message: ${subject}.`, createdAt: now, readAt: null,
    });
    await savePortalData(data);
    return json({ ...thread, learnerName: learnerName(data, learner.id) }, 201);
  }
  if (method === "POST" && path[1] === "messages" && path[2] && path[3] === "reply") {
    const body = await readBody(request);
    const thread = (data.parent?.messages || []).find((item: any) => item.id === path[2] && isTeacherRecipient(data, user, item));
    if (!thread) return json({ error: "Conversation not found." }, 404);
    const message = String(body.message || "").trim();
    if (!message) return json({ error: "Enter a reply before sending." }, 400);
    if (thread.status === "CLOSED") return json({ error: "Reopen the conversation before replying." }, 409);
    const reply = {
      id: uid("thread-message"),
      authorRole: "TEACHER",
      authorName: user.name || user.email,
      message,
      createdAt: new Date().toISOString(),
    };
    thread.teacherName = user.name || thread.teacherName || "Assigned Teacher";
    thread.teacherEmail = user.email || thread.teacherEmail || "teacher@popin.school";
    thread.messages = [...(thread.messages || []), reply];
    thread.updatedAt = reply.createdAt;
    thread.status = body.status || "ANSWERED";
    data.parent.notifications = data.parent.notifications || [];
    data.parent.notifications.unshift({
      id: uid("parent-notification"),
      learnerId: thread.learnerId,
      type: "message",
      title: "Teacher reply received",
      recipientEmail: thread.parentEmail || null,
      message: `${user.name || "Your teacher"} replied to your message about ${learnerName(data, thread.learnerId)}.`,
      createdAt: new Date().toISOString(),
      readAt: null,
    });
    await savePortalData(data);
    return json(reply, 201);
  }
  if (method === "PATCH" && path[1] === "messages" && path[2] && path[3] === "status") {
    const body = await readBody(request);
    const thread = (data.parent?.messages || []).find((item: any) => item.id === path[2] && isTeacherRecipient(data, user, item));
    if (!thread) return json({ error: "Conversation not found." }, 404);
    if (!["OPEN", "ANSWERED", "CLOSED"].includes(body.status)) return json({ error: "Select a valid conversation status." }, 400);
    thread.status = body.status;
    thread.updatedAt = new Date().toISOString();
    await savePortalData(data);
    return json(thread);
  }
  if (method === "GET" && path.join("/") === "teacher/profile") {
    return json({
      profile: data.teacher.profile,
      identity: {
        name: user.name || "",
        email: user.email || "",
      },
    });
  }
  if (method === "PATCH" && path.join("/") === "teacher/profile") {
    const body = await readBody(request);
    data.teacher.profile = {
      ...(data.teacher.profile || {}),
      ...(body.profile || {}),
      notificationPreferences: {
        ...(data.teacher.profile?.notificationPreferences || {}),
        ...(body.profile?.notificationPreferences || {}),
      },
    };
    if (body.identity?.name) {
      await prisma.user.update({
        where: { id: user.id },
        data: { name: String(body.identity.name).trim() },
      });
    }
    await savePortalData(data);
    return json({
      profile: data.teacher.profile,
      identity: {
        name: body.identity?.name || user.name || "",
        email: user.email || "",
      },
    });
  }
  if (method === "GET" && path.join("/") === "teacher/requisitions") {
    ensureRole(user, ["ADMIN"]);
    return json(
      (operations?.requisitions || []).filter(
        (item: any) =>
          item.createdBy?.email?.toLowerCase() === user.email?.toLowerCase() ||
          item.createdBy?.name === user.name,
      ),
    );
  }
  if (method === "GET" && path.join("/") === "teacher/appointments") {
    return json(
      (data.parent?.appointments || [])
        .filter((item: any) => isTeacherRecipient(data, user, item))
        .sort((a: any, b: any) => String(a.startsAt).localeCompare(String(b.startsAt))),
    );
  }
  if (method === "GET" && path.join("/") === "teacher/assessments/overview") {
    const classMap = new Map(teacherClasses.map((item: any) => [item.id, item]));
    const classroomAssessments = teacherClasses.flatMap((schoolClass: any) =>
      (schoolClass.workItems || [])
        .filter((item: any) => item.type === "ASSESSMENT")
        .map((item: any) => ({
          ...item,
          classId: schoolClass.id,
          className: schoolClass.name,
          gradeName: schoolClass.grade?.name || "",
        })),
    );
    const assistantAssessments = (data.teacherAssistant?.assessments || []).map((assessment: any) => {
      const scripts = assessment.scripts || [];
      const releasableScripts = scripts.filter((script: any) => script.learnerId && script.status === "PUBLISHED");
      return {
        ...assessment,
        classNames: (assessment.classIds || []).map((classId: string) => (classMap.get(classId) as any)?.name || classId),
        releasableCount: releasableScripts.length,
        releasedCount: (data.parent?.reports || []).filter((report: any) => report.originAssessmentId === assessment.id).length,
      };
    });
    return json({
      classroomAssessments,
      assistantAssessments,
      metrics: {
        classroomCount: classroomAssessments.length,
        assistantCount: assistantAssessments.length,
        readyForRelease: assistantAssessments.filter((assessment: any) => assessment.releasableCount > 0 && !assessment.resultsReleasedAt).length,
        released: assistantAssessments.filter((assessment: any) => !!assessment.resultsReleasedAt).length,
      },
    });
  }
  if (method === "POST" && path[1] === "assessments" && path[2] && path[3] === "release") {
    const assessment = (data.teacherAssistant?.assessments || []).find((item: any) => item.id === path[2]);
    if (!assessment) return json({ error: "Assessment not found." }, 404);
    const publishedScripts = (assessment.scripts || []).filter((script: any) => script.learnerId && script.status === "PUBLISHED");
    if (!publishedScripts.length) return json({ error: "No published scripts are ready for release." }, 400);
    data.parent = data.parent || {};
    data.parent.reports = data.parent.reports || [];
    data.parent.notifications = data.parent.notifications || [];

    const releasedReports = publishedScripts.map((script: any) => {
      const learner = data.learners.find((item: any) => item.id === script.learnerId);
      const percentage = assessment.totalMarks ? Math.round((Number(script.finalTotal || 0) / Number(assessment.totalMarks || 1)) * 100) : 0;
      const existing = data.parent.reports.find(
        (report: any) => report.originAssessmentId === assessment.id && report.learnerId === script.learnerId,
      );
      const payload = {
        id: existing?.id || uid("report"),
        learnerId: script.learnerId,
        originAssessmentId: assessment.id,
        term: `Assessment / ${assessment.name}`,
        average: percentage,
        publishedAt: new Date().toISOString(),
        teacherComment: `${assessment.subject} assessment released from the teacher marking workflow.`,
        subjects: [
          {
            name: assessment.subject,
            mark: percentage,
            grade: percentage >= 80 ? "A" : percentage >= 70 ? "B" : percentage >= 60 ? "C" : percentage >= 50 ? "D" : "E",
          },
        ],
        assessmentSummary: {
          rawScore: Number(script.finalTotal || 0),
          totalMarks: Number(assessment.totalMarks || 0),
          learnerName: learner ? `${learner.firstName} ${learner.lastName}` : "Learner",
        },
      };
      if (existing) Object.assign(existing, payload);
      else data.parent.reports.unshift(payload);
      data.parent.notifications.unshift({
        id: uid("parent-notification"),
        learnerId: script.learnerId,
        type: "results",
        title: "Assessment result released",
        message: `${assessment.subject} results for ${assessment.name} are now available in the parent portal.`,
        createdAt: new Date().toISOString(),
        readAt: null,
      });
      return payload;
    });

    assessment.resultsReleasedAt = new Date().toISOString();
    await savePortalData(data);
    return json({ released: releasedReports.length, reports: releasedReports });
  }
  if (method === "PATCH" && path[1] === "appointments" && path[2]) {
    const body = await readBody(request);
    const appointment = (data.parent?.appointments || []).find((item: any) => item.id === path[2] && isTeacherRecipient(data, user, item));
    if (!appointment) return json({ error: "Appointment not found." }, 404);
    Object.assign(appointment, body, {
      teacherName: user.name || appointment.teacherName || "Assigned Teacher",
      teacherEmail: user.email || appointment.teacherEmail || "teacher@popin.school",
    });
    data.parent.notifications = data.parent.notifications || [];
    data.parent.notifications.unshift({
      id: uid("parent-notification"),
      learnerId: appointment.learnerId,
      type: "appointment",
      title: "Appointment updated",
      message: `${user.name || "Your teacher"} updated an appointment for ${learnerName(data, appointment.learnerId)}.`,
      createdAt: new Date().toISOString(),
      readAt: null,
    });
    await savePortalData(data);
    return json(appointment);
  }

  if (method === "POST" && path.join("/") === "teacher/work-items") {
    const body = await readBody(request);
    const title = String(body.title || "").trim();
    if (!title || !["HOMEWORK", "LESSON_PLAN", "ANNOUNCEMENT", "ASSESSMENT"].includes(body.type)) return json({ error: "Select an item type and enter a title." }, 400);
    const workItem = { ...body, id: uid("work"), title, createdAt: new Date().toISOString() };
    const targetClasses = body.classId ? teacherClasses.filter((item: any) => item.id === body.classId) : teacherClasses;
    if (!targetClasses.length) return json({ error: "Class not found." }, 404);
    targetClasses.forEach((item: any) => item.workItems.unshift(workItem));
    if (workItem.visibleToParents !== false && ["ANNOUNCEMENT", "HOMEWORK", "ASSESSMENT"].includes(workItem.type) && workItem.status === "PUBLISHED") {
      data.parent = data.parent || {};
      data.parent.notifications = data.parent.notifications || [];
      const learnerIds = new Set<string>(targetClasses.flatMap((item: any) => (item.learners || []).map((learner: any) => learner.id)));
      for (const learnerId of learnerIds) {
        data.parent.notifications.unshift({
          id: uid("parent-notification"), learnerId, type: workItem.type.toLowerCase(),
          title: workItem.type === "ANNOUNCEMENT" ? "Class announcement" : "New class work published",
          message: workItem.title || "Your learner's teacher published an update.", createdAt: new Date().toISOString(), readAt: null,
        });
      }
    }
    data.teacher.dashboard.announcements = body.type === "ANNOUNCEMENT" ? [workItem, ...(data.teacher.dashboard.announcements || [])] : data.teacher.dashboard.announcements;
    await savePortalData(data);
    return json(workItem, 201);
  }

  if (method === "GET" && path.join("/") === "teacher/attendance") {
    const classId = request.nextUrl.searchParams.get("classId");
    const schoolClass = teacherClasses.find((item: any) => item.id === classId);
    if (!schoolClass) return json({ error: "Class not found." }, 404);
    const registerDate = request.nextUrl.searchParams.get("date") || new Date().toISOString().slice(0, 10);
    const learnerIds = new Set(schoolClass.learners.map((item: any) => item.id));
    return json((data.parent?.attendance || []).filter((item: any) => learnerIds.has(item.learnerId) && item.date === registerDate));
  }
  if (method === "POST" && path.join("/") === "teacher/attendance") {
    const body = await readBody(request);
    const schoolClass = teacherClasses.find((item: any) => item.id === body.classId);
    if (!schoolClass) return json({ error: "Class not found." }, 404);
    const learnerIds = new Set(schoolClass.learners.map((item: any) => item.id));
    if (!Array.isArray(body.entries) || !body.entries.length || body.entries.some((entry: any) => !learnerIds.has(entry.learnerId) || !["PRESENT", "ABSENT", "LATE", "EXCUSED"].includes(entry.status))) {
      return json({ error: "Enter valid attendance for learners in this class." }, 400);
    }
    const registerDate = String(body.registerDate || new Date().toISOString()).slice(0, 10);
    data.parent = data.parent || {};
    data.parent.attendance = data.parent.attendance || [];
    for (const entry of body.entries || []) {
      const existing = data.parent.attendance.find((item: any) => item.learnerId === entry.learnerId && item.date === registerDate);
      if (existing) {
        existing.status = entry.status;
        existing.note = String(entry.note || "");
        existing.capturedBy = user.name || user.email;
        existing.submittedAt = body.submit ? new Date().toISOString() : null;
        continue;
      }
      data.parent.attendance.unshift({
        id: uid("attendance"),
        learnerId: entry.learnerId,
        date: registerDate,
        status: entry.status,
        note: entry.note || "",
        capturedBy: user.name || user.email,
        submittedAt: body.submit ? new Date().toISOString() : null,
      });
    }
    if (body.submit) {
      for (const entry of body.entries || []) {
        if (["ABSENT", "LATE"].includes(String(entry.status || ""))) {
          data.parent.notifications = data.parent.notifications || [];
          data.parent.notifications.unshift({
            id: uid("parent-notification"),
            learnerId: entry.learnerId,
            type: "attendance",
            title: entry.status === "ABSENT" ? "Absence recorded" : "Late arrival recorded",
            message: `${learnerName(data, entry.learnerId)} was marked ${String(entry.status).toLowerCase()} on ${registerDate}.`,
            createdAt: new Date().toISOString(),
            readAt: null,
          });
        }
      }
    }
    await savePortalData(data);
    return json({ id: uid("attendance-submit"), status: body.submit ? "SUBMITTED" : "DRAFT", ...body }, 201);
  }

  return json({ error: `API route not found: /api/${path.join("/")}` }, 404);
}

async function handleStudent(request: NextRequest, method: string, path: string[], data: any, user: any) {
  ensureRole(user, ["ADMIN", "STUDENT"]);
  data.student = data.student || {};
  data.student.submissions = data.student.submissions || [];
  const learner = resolveStudentLearner(data, user, request);
  if (!learner) return json({ error: "Student profile not found for this account." }, 404);

  const learnerClasses = data.classes.filter((item: any) =>
    (item.learners || []).some((classLearner: any) => classLearner.id === learner.id),
  );
  const workItems = learnerClasses.flatMap((item: any) => item.workItems || []);
  const attendance = (data.parent?.attendance || [])
    .filter((item: any) => item.learnerId === learner.id)
    .sort((a: any, b: any) => String(b.date).localeCompare(String(a.date)));
  const reports = (data.parent?.reports || [])
    .filter((item: any) => item.learnerId === learner.id)
    .sort((a: any, b: any) => String(b.publishedAt || "").localeCompare(String(a.publishedAt || "")));
  const discipline = (data.disciplinary?.records || [])
    .filter((item: any) => item.learnerId === learner.id && item.parentVisible !== false)
    .sort((a: any, b: any) => String(b.occurredAt || "").localeCompare(String(a.occurredAt || "")));
  const announcements = data.teacher?.dashboard?.announcements || [];
  const resources = [
    ...(data.communications?.resources || []).filter((item: any) => ["PARENT_STUDENT", "STUDENT"].includes(item.visibility)),
    ...(data.teacher?.resources || []).filter((item: any) => !item.classId || learnerClasses.some((schoolClass: any) => schoolClass.id === item.classId)),
  ];
  const calendar = [
    ...(data.communications?.calendar || []),
    ...(data.teacher?.calendar || []).filter((item: any) => !item.classId || learnerClasses.some((schoolClass: any) => schoolClass.id === item.classId)),
  ];
  const grades = workItems.filter((item: any) => item.type === "ASSESSMENT").flatMap((assessment: any) =>
    (data.teacher?.gradebook?.[assessment.id] || []).filter((entry: any) => entry.learnerId === learner.id).map((entry: any) => ({ ...entry, assessmentId: assessment.id, assessmentTitle: assessment.title })),
  );
  const studentNotificationSources = [
    ...((data.parent?.notifications || []).filter((item: any) => item.learnerId === learner.id && !item.recipientRole && !item.recipientEmail)),
    ...((data.notifications || []).filter((item: any) => item.type === "announcement" || item.type === "approval")),
    ...((data.student?.notifications || []).filter((item: any) => isNotificationRecipient(data, user, item, "STUDENT"))),
  ]
    .sort((a: any, b: any) => String(b.createdAt || b.time || "").localeCompare(String(a.createdAt || a.time || "")));
  const notifications = studentNotificationSources.map((item: any) => notificationForUser(item, user));
  ensureCommunicationsData(data);

  if (method === "GET" && path.join("/") === "student/overview") {
    return json({
      learner,
      classes: learnerClasses,
      timetable: learnerClasses.flatMap((item: any) => item.timetable || []),
      homework: workItems.filter((item: any) => item.type === "HOMEWORK"),
      assessments: workItems.filter((item: any) => item.type === "ASSESSMENT"),
      lessonPlans: workItems.filter((item: any) => item.type === "LESSON_PLAN"),
      attendance,
      reports,
      discipline,
      announcements,
      grades,
      submissions: data.student.submissions.filter((item: any) => item.learnerId === learner.id),
      resources,
      calendar,
    });
  }

  if (method === "GET" && path.join("/") === "student/hostel") {
    const overview = buildHostelOverview(data);
    const allocation = overview.allocations.find((item: any) => item.learnerId === learner.id) || null;
    const learnerRecord = data.learners.find((item: any) => item.id === learner.id);
    const hadActivePass = learnerRecord ? !!getActiveHostelQrPass(data, learnerRecord) : true;
    const qrPass = learnerRecord ? ensureHostelQrPass(data, learnerRecord) : null;
    if (learnerRecord && !hadActivePass && allocation) await savePortalData(data);
    return json({
      allocation,
      application: overview.applications.find((item: any) => item.learnerId === learner.id) || null,
      charges: data.hostel.charges.filter((item: any) => item.learnerId === learner.id),
      notices: data.hostel.notices,
      movementHistory: buildHostelMovementHistory(data, learner.id),
      qrCodeValue: allocation ? buildHostelQrValue(data, learnerRecord) : "",
      qrCodeLabel: learnerRecord?.studentNumber || learner.id,
      qrPassVersion: qrPass?.version || 1,
    });
  }

  if (method === "GET" && path.join("/") === "student/timetable") {
    return json(learnerClasses.flatMap((item: any) => item.timetable || []));
  }

  if (method === "GET" && path.join("/") === "student/attendance") {
    return json(attendance);
  }

  if (method === "GET" && path.join("/") === "student/reports") {
    return json(reports);
  }

  if (method === "GET" && path.join("/") === "student/announcements") {
    return json(announcements);
  }

  if (method === "GET" && path.join("/") === "student/resources") {
    return json(data.communications.resources.filter((item: any) => ["PARENT_STUDENT", "STUDENT"].includes(item.visibility)));
  }

  if (method === "GET" && path.join("/") === "student/calendar") {
    return json(data.communications.calendar);
  }

  if (method === "GET" && path.join("/") === "student/notifications") {
    return json(notifications);
  }

  if (method === "POST" && path[1] === "notifications" && path[2] && path[3] === "read") {
    const notification = studentNotificationSources.find((item: any) => item.id === path[2]);
    if (!notification) return json({ error: "Notification not found." }, 404);
    markNotificationReadForUser(notification, user);
    await savePortalData(data);
    return json(notificationForUser(notification, user));
  }

  if (method === "POST" && path.join("/") === "student/notifications/read-all") {
    studentNotificationSources.forEach((item: any) => markNotificationReadForUser(item, user));
    await savePortalData(data);
    return json(studentNotificationSources.map((item: any) => notificationForUser(item, user)));
  }

  if (method === "POST" && path[1] === "work-items" && path[2] && path[3] === "submissions") {
    const workItem = workItems.find((item: any) => item.id === path[2]);
    if (!workItem || !["HOMEWORK", "ASSESSMENT"].includes(workItem.type)) return json({ error: "Teaching item not found." }, 404);
    const body = await readBody(request);
    if (!String(body.content || body.fileName || "").trim()) return json({ error: "Add a response or file name before submitting." }, 400);
    const existing = data.student.submissions.find((item: any) => item.workItemId === workItem.id && item.learnerId === learner.id);
    const submission = { id: existing?.id || uid("student-submission"), learnerId: learner.id, workItemId: workItem.id, title: workItem.title, content: String(body.content || ""), fileName: String(body.fileName || ""), status: "SUBMITTED", submittedAt: new Date().toISOString() };
    if (existing) Object.assign(existing, submission); else data.student.submissions.unshift(submission);
    await savePortalData(data);
    return json(submission, existing ? 200 : 201);
  }

  return json({ error: `API route not found: /api/${path.join("/")}` }, 404);
}

async function handleTeacherAssistant(request: NextRequest, method: string, path: string[], data: any, user: any) {
  ensureRole(user, ["ADMIN", "TEACHER"]);
  const ownsAssessment = (assessment: any) => user.role === "ADMIN" || ((assessment.classIds || [assessment.classId]).filter(Boolean).length > 0 && (assessment.classIds || [assessment.classId]).every((id: string) => data.classes.some((item: any) => item.id === id && item.teacherEmail?.toLowerCase() === user.email.toLowerCase())));
  const assessments = data.teacherAssistant.assessments.filter(ownsAssessment);
  if (method === "GET" && path.length === 1) {
    const scripts = assessments.flatMap((assessment: any) => assessment.scripts || []);
    return json({
      metrics: {
        scriptsWaiting: scripts.filter((script: any) => ["QUEUED", "OCR", "MARKING"].includes(script.status)).length,
        readyForReview: scripts.filter((script: any) => script.status === "READY_FOR_REVIEW").length,
        needsAttention: scripts.filter((script: any) => script.status === "NEEDS_REVIEW").length,
        averageReviewSeconds: null,
      },
      assessments,
    });
  }
  if (method === "GET" && path[1] === "assessments" && path[2] && path.length === 3) {
    return json(assessments.find((item: any) => item.id === path[2]) || null);
  }
  if (method === "POST" && path[1] === "assessments" && path.length === 2) {
    const body = await readBody(request);
    const assessment = { id: uid("assessment"), status: "DRAFT", counts: { total: 0, ready: 0, needsReview: 0 }, scripts: [], ...body };
    if (!ownsAssessment(assessment)) return json({ error: "Choose one of your assigned classes." }, 403);
    data.teacherAssistant.assessments.unshift(assessment);
    await savePortalData(data);
    return json(assessment, 201);
  }
  if (method === "GET" && path[1] === "assessments" && path[3] === "analytics") {
    const assessment = assessments.find((item: any) => item.id === path[2]);
    const totals: number[] = (assessment?.scripts || []).map((script: any) => Number(script.finalTotal ?? script.suggestedTotal ?? 0));
    const sorted = [...totals].sort((a, b) => a - b);
    const average = totals.length ? totals.reduce((sum, value) => sum + value, 0) / totals.length : 0;
    return json({
      classAverage: average,
      highest: sorted.at(-1) || 0,
      lowest: sorted[0] || 0,
      median: sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0,
      passRate: totals.length ? Math.round((totals.filter((value) => value >= Number(assessment?.totalMarks || 1) * 0.5).length / totals.length) * 100) : 0,
    });
  }
  if (method === "POST" && path[1] === "assessments" && path[3] === "scripts") {
    const assessment = assessments.find((item: any) => item.id === path[2]);
    if (!assessment) return json({ error: "Assessment not found" }, 404);
    const body = await readBody(request);
    const scripts = Array.isArray(body.scripts) ? body.scripts : [];
    if (!scripts.length || scripts.length > 10) return json({ error: "Upload between 1 and 10 scripts." }, 400);
    const created = await Promise.all(scripts.map(async (script: any) => {
      if ((script.originalFiles || []).length > 3) throw new Error("Upload at most three files per script.");
      if (script.learnerId && !data.learners.some((learner: any) => learner.id === script.learnerId && (assessment.classIds || [assessment.classId]).includes(learner.classId))) throw new Error("Learner does not belong to this class.");
      const originalFiles = [];
      for (const file of script.originalFiles || []) originalFiles.push(await storeDocument(user.id, file));
      const results = (assessment.questions || []).map((question: any) => ({
        id: uid("result"),
        questionNumber: question.questionNumber,
        expectedAnswer: question.expectedAnswers || [],
        detectedAnswer: "",
        matchingRule: "Ready for teacher review",
        suggestedMarks: 0,
        finalMarks: 0,
      }));
      return {
        id: uid("script"),
        status: script.extractedText ? "READY_FOR_REVIEW" : process.env.OCR_URL ? "QUEUED" : "NEEDS_REVIEW",
        learnerId: script.learnerId || null,
        originalFiles,
        extractedText: script.extractedText || "",
        ocrConfidence: null,
        markingConfidence: null,
        suggestedTotal: 0,
        finalTotal: 0,
        flags: script.extractedText ? [] : ["Enter the script text and review marks manually."],
        results,
        createdAt: new Date().toISOString(),
      };
    }));
    for (const script of created) if (script.extractedText) markExtractedAnswers(assessment, script);
    assessment.scripts = [...created, ...(assessment.scripts || [])];
    updateAssessmentCounts(assessment);
    await savePortalData(data);
    return json({ scripts: created }, 201);
  }
  if (method === "PATCH" && path[1] === "scripts" && path[3] === "extracted-text") {
    const match = findAssistantScript(assessments, path[2]);
    if (!match) return json({ error: "Script not found" }, 404);
    const body = await readBody(request);
    match.script.editableText = String(body.editableText || body.extractedText || "");
    if (body.learnerId) {
      if (!data.learners.some((learner: any) => learner.id === body.learnerId && (match.assessment.classIds || [match.assessment.classId]).includes(learner.classId))) return json({ error: "Learner does not belong to the assessment class." }, 400);
      match.script.learnerId = body.learnerId;
    }
    markExtractedAnswers(match.assessment, match.script);
    updateAssessmentCounts(match.assessment);
    await savePortalData(data);
    return json(match.script);
  }
  if (method === "PATCH" && path[1] === "scripts" && path[3] === "results") {
    const match = findAssistantScript(assessments, path[2]);
    if (!match) return json({ error: "Script not found" }, 404);
    const body = await readBody(request);
    for (const result of body.results || []) {
      const target = (match.script.results || []).find((item: any) => item.id === result.resultId);
      if (target) {
        const marks = Number(result.finalMarks);
        const question = match.assessment.questions.find((q: any) => String(q.questionNumber) === String(target.questionNumber));
        if (!Number.isFinite(marks) || marks < 0 || marks > Number(question?.marks || 0)) return json({ error: "Marks must be within the question total." }, 400);
        Object.assign(target, { finalMarks: marks, note: String(result.note || "") });
      }
    }
    match.script.finalTotal = (match.script.results || []).reduce((sum: number, result: any) => sum + Number(result.finalMarks || 0), 0);
    await savePortalData(data);
    return json(match.script);
  }
  if (method === "POST" && path[1] === "assessments" && ["approve", "publish"].includes(path[3])) {
    const assessment = assessments.find((item: any) => item.id === path[2]);
    if (!assessment) return json({ error: "Assessment not found" }, 404);
    const body = await readBody(request);
    const scriptIds = new Set(body.scriptIds || []);
    for (const script of assessment.scripts || []) {
      if (scriptIds.has(script.id)) {
        if (path[3] === "publish" && (script.status !== "APPROVED" || !script.learnerId)) return json({ error: "Only approved scripts linked to a learner can be published." }, 409);
        if (path[3] === "approve" && !["READY_FOR_REVIEW", "NEEDS_REVIEW"].includes(script.status)) return json({ error: "Review the script before approval." }, 409);
        script.status = path[3] === "approve" ? "APPROVED" : "PUBLISHED";
        script.reviewedBy = user.id;
        script.reviewedAt = new Date().toISOString();
      }
    }
    updateAssessmentCounts(assessment);
    await savePortalData(data);
    return json({ status: "OK" });
  }
  return json({ error: `API route not found: /api/${path.join("/")}` }, 404);
}

async function handleStudents(request: NextRequest, method: string, path: string[], data: any, user: any) {
  ensureRole(user, ["ADMIN", "TEACHER"]);
  const assignedClasses = data.classes.filter((item: any) => user.role === "ADMIN" || item.teacherEmail?.toLowerCase() === user.email.toLowerCase());
  const assignedLearners = data.learners.filter((learner: any) => user.role === "ADMIN" || assignedClasses.some((item: any) => learner.classId ? learner.classId === item.id : (item.learners || []).some((entry: any) => entry.id === learner.id)));
  const allowedLearnerIds = new Set(assignedLearners.map((item: any) => item.id));
  if (user.role === "TEACHER" && method !== "GET" && path[1] !== "discipline" && path[2] !== "discipline") return json({ error: "Student administration requires administrator access." }, 403);
  if (method === "POST" && ["", "import", "teachers", "grades", "classes", "subjects"].includes(path[1] || "")) {
    ensureRole(user, ["ADMIN"]);
  }
  if (method === "GET" && path[1] === "discipline" && path.length === 2) {
    const overview = buildDisciplineOverview({ ...data, learners: assignedLearners, disciplinary: { ...data.disciplinary, records: (data.disciplinary?.records || []).filter((item: any) => allowedLearnerIds.has(item.learnerId)) } });
    return json({
      ...overview,
      learners: assignedLearners,
    });
  }

  if (method === "PATCH" && path[1] === "discipline" && path[2]) {
    const record = (data.disciplinary?.records || []).find((item: any) => item.id === path[2] && allowedLearnerIds.has(item.learnerId));
    if (!record) return json({ error: "Disciplinary record not found" }, 404);
    const body = await readBody(request);
    for (const key of ["title", "description", "actionTaken", "status", "severity", "category", "parentVisible", "followUpAt"]) if (body[key] !== undefined) record[key] = body[key];
    await savePortalData(data);
    return json(record);
  }

  if (method === "GET" && path.length === 1) {
    const status = request.nextUrl.searchParams.get("status") || "ACTIVE";
    const search = (request.nextUrl.searchParams.get("search") || "").toLowerCase();
    const items = assignedLearners.filter((item: any) => item.status === status && `${item.firstName} ${item.lastName} ${item.studentNumber} ${item.identityNumber}`.toLowerCase().includes(search));
    return json({ items, grades: data.grades, classes: assignedClasses, subjects: data.subjects });
  }

  if (method === "POST" && path.length === 1) {
    const body = await readBody(request);
    const learner = { id: uid("learner"), status: "ACTIVE", guardians: [], classHistory: [], ...body };
    data.learners.unshift(learner);
    await savePortalData(data);
    return json(learner, 201);
  }

  if (method === "POST" && path[1] === "import") {
    const body = await readBody(request);
    const students = Array.isArray(body.students) ? body.students : [];
    students.forEach((student: any) => data.learners.unshift({ id: uid("learner"), status: "ACTIVE", guardians: [], classHistory: [], ...student }));
    await savePortalData(data);
    return json({ created: students.length, rejected: 0 });
  }

  if (method === "POST" && path[1] === "teachers") {
    const body = await readBody(request);
    const email = String(body.email || "").trim().toLowerCase();
    const name = String(body.name || "").trim();
    const temporaryPassword = String(body.temporaryPassword || "");
    if (temporaryPassword.length < 12 || temporaryPassword.length > 128) return json({ error: "Enter a temporary password of 12 to 128 characters." }, 400);
    if (!email || !name) return json({ error: "Teacher name and email are required." }, 400);
    const teacher = await prisma.user.upsert({
      where: { email },
      update: { name, role: "TEACHER", passwordHash: await hashPassword(temporaryPassword) },
      create: { email, name, role: "TEACHER", passwordHash: await hashPassword(temporaryPassword) },
    });
    await prisma.authSession.updateMany({ where: { userId: teacher.id }, data: { revokedAt: new Date() } });
    const welcome = renderTeacherWelcomeEmail(name, absoluteUrl(request, "/login"), temporaryPassword);
    await sendTransactionalEmail({ to: email, subject: welcome.subject, html: welcome.html, text: welcome.text });
    return json({ id: teacher.id, email: teacher.email, name: teacher.name, role: teacher.role }, 201);
  }
  if (method === "POST" && ["grades", "classes", "subjects"].includes(path[1])) {
    const body = await readBody(request);
    const item = { id: uid(path[1].slice(0, -1)), ...body };
    data[path[1]].push(item);
    await savePortalData(data);
    return json(item, 201);
  }

  const learner = assignedLearners.find((item: any) => item.id === path[1]);
  if (!learner) return json({ error: "Student not found" }, 404);
  if (method === "GET" && path[2] === "discipline") {
    return json((data.disciplinary?.records || []).filter((item: any) => item.learnerId === learner.id));
  }
  if (method === "POST" && path[2] === "discipline") {
    const body = await readBody(request);
    const record = {
      id: uid("discipline"),
      learnerId: learner.id,
      title: body.title,
      category: body.category || "Conduct",
      severity: body.severity || "MEDIUM",
      status: body.status || "OPEN",
      description: body.description || "",
      actionTaken: body.actionTaken || "",
      points: Number(body.points || 0),
      parentVisible: body.parentVisible !== false,
      requiresAcknowledgement: body.requiresAcknowledgement !== false,
      parentAcknowledgedAt: null,
      occurredAt: new Date().toISOString(),
      followUpAt: body.followUpAt || null,
      reportedBy: { name: user.name, email: user.email },
    };
    data.disciplinary = data.disciplinary || { records: [] };
    data.disciplinary.records.unshift(record);
    await savePortalData(data);

    const guardians = (learner.guardians || []).filter((link: any) => link.guardian?.email && record.parentVisible);
    for (const link of guardians) {
      const email = renderDisciplineEmail({
        guardianName: link.guardian?.name,
        learnerName: `${learner.firstName} ${learner.lastName}`,
        incidentTitle: record.title,
        category: record.category,
        severity: record.severity,
        actionTaken: record.actionTaken,
        portalUrl: absoluteUrl(request, "/parent-portal"),
      });
      await sendTransactionalEmail({ to: link.guardian.email, subject: email.subject, html: email.html, text: email.text });
    }
    return json(record, 201);
  }
  if (method === "GET" && path.length === 2) return json(learner);
  if (method === "PATCH" && path.length === 2) {
    Object.assign(learner, await readBody(request));
    await savePortalData(data);
    return json(learner);
  }
  if (method === "POST" && path[2] === "guardians") {
    const body = await readBody(request);
    const email = String(body.email || "").trim().toLowerCase();
    const name = String(body.name || "").trim();
    const relationshipType = String(body.relationshipType || "").trim();
    const allowedRelationships = ["Mother", "Father", "Guardian", "Grandparent", "Sponsor", "Emergency contact", "Pickup authorised person"];
    if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 254) return json({ error: "Enter a valid guardian email address." }, 400);
    if (name.length < 2 || name.length > 120) return json({ error: "Guardian name must be between 2 and 120 characters." }, 400);
    if (!allowedRelationships.includes(relationshipType)) return json({ error: "Choose a valid relationship to the learner." }, 400);
    if ((learner.guardians || []).some((link: any) => String(link.guardian?.email || "").toLowerCase() === email && !["REVOKED", "REJECTED", "INACTIVE", "UNLINKED"].includes(link.status))) return json({ error: "This guardian is already linked to the learner." }, 409);
    const permissions = Object.fromEntries(["viewFees", "payFees", "viewReports", "viewHomework", "receiveAnnouncements", "messageTeachers", "authorisePickup", "submitApplications", "bookAppointments", "viewHostel", "applyHostel", "viewHostelBilling", "submitHostelConcerns", "viewHostelMovement"].map((key) => [key, body[key] === true]));
    if (!Object.values(permissions).some(Boolean)) return json({ error: "Select at least one permission for this guardian." }, 400);
    const link = { id: uid("guardian-link"), status: "VERIFIED", guardian: { id: uid("guardian"), email, name }, relationshipType, isPrimary: body.isPrimary === true, ...permissions };
    learner.guardians = [link, ...(learner.guardians || [])];
    await savePortalData(data);
    const invite = renderGuardianLinkedEmail(name, `${learner.firstName} ${learner.lastName}`, absoluteUrl(request, "/register"));
    await sendTransactionalEmail({ to: email, subject: invite.subject, html: invite.html, text: invite.text });
    return json(link, 201);
  }
  if (method === "POST" && path[2] === "move") {
    const body = await readBody(request);
    learner.gradeId = body.gradeId || learner.gradeId;
    learner.classId = body.classId || learner.classId;
    learner.classHistory = [{ id: uid("history"), changedAt: new Date().toISOString(), reason: body.reason || "Placement updated" }, ...(learner.classHistory || [])];
    await savePortalData(data);
    return json(learner);
  }
  if (method === "PATCH" && path[2] === "archive") {
    learner.status = "ARCHIVED";
    await savePortalData(data);
    return json(learner);
  }

  return json({ error: `API route not found: /api/${path.join("/")}` }, 404);
}

async function handleHostel(request: NextRequest, method: string, path: string[], data: any, user: any) {
  ensureRole(user, ["ADMIN"]);
  const activeAllocationStatuses = ["RESERVED", "CHECKED_IN"];
  const isBedOccupied = (bedId: string, ignoreAllocationId?: string) =>
    data.hostel.allocations.some(
      (item: any) =>
        item.id !== ignoreAllocationId && item.bedId === bedId && activeAllocationStatuses.includes(item.status),
    );
  const learnerHasActiveAllocation = (learnerId: string, ignoreAllocationId?: string) =>
    data.hostel.allocations.some(
      (item: any) =>
        item.id !== ignoreAllocationId &&
        item.learnerId === learnerId &&
        activeAllocationStatuses.includes(item.status),
    );

  if (method === "GET" && path[1] === "dashboard") return json(buildHostelDashboard(data));
  if (method === "GET" && path[1] === "overview") return json(buildHostelOverview(data));
  if (method === "GET" && path[1] === "reports") {
    const dashboard = buildHostelDashboard(data);
    const overview = buildHostelOverview(data);
    const today = new Date().toISOString().slice(0, 10);
    const todayScans = (data.hostel.scanEvents || []).filter((item: any) => String(item.scannedAt || "").slice(0, 10) === today);
    const byEventType = Array.from(
      todayScans.reduce((map: Map<string, number>, item: any) => {
        map.set(item.eventType, (map.get(item.eventType) || 0) + 1);
        return map;
      }, new Map<string, number>()),
    ) as [string, number][];
    const byStationRole = Array.from(
      todayScans.reduce((map: Map<string, number>, item: any) => {
        const key = item.stationRole || "HOSTEL_STAFF";
        map.set(key, (map.get(key) || 0) + 1);
        return map;
      }, new Map<string, number>()),
    ) as [string, number][];
    return json({
      dashboard,
      meals: { servedCount: data.hostel.meals.reduce((sum: number, item: any) => sum + Number(item.servedCount || 0), 0) },
      occupancyByBuilding: overview.buildings.map((building: any) => {
        const beds = building.blocks.flatMap((block: any) => block.rooms.flatMap((room: any) => room.beds));
        const occupied = beds.filter((bed: any) => bed.status === "OCCUPIED").length;
        return { id: building.id, name: building.name, capacity: beds.length, occupied };
      }),
      scansToday: todayScans.length,
      scanBreakdown: byEventType.map(([eventType, count]) => ({ eventType, count })),
      scanRoles: byStationRole.map(([stationRole, count]) => ({ stationRole, count })),
      scanExceptions: overview.scanExceptions || [],
    });
  }
  if (method === "GET" && path[1] === "payments") return json(data.hostel.payments || []);
  if (method === "POST" && path[1] === "payments" && path[2] && ["verify", "reject"].includes(path[3])) {
    const payment = (data.hostel.payments || []).find((item: any) => item.id === path[2]);
    if (!payment) return json({ error: "Hostel payment not found." }, 404);
    const body = await readBody(request);
    payment.status = path[3] === "verify" ? "VERIFIED" : "REJECTED";
    payment.reviewedAt = new Date().toISOString();
    payment.reviewedBy = user?.name || user?.email;
    payment.reviewNote = body.note || "";
    if (payment.status === "VERIFIED") {
      const charge = (data.hostel.charges || []).find((item: any) => item.id === payment.chargeId);
      if (charge) {
        charge.paidAmount = Math.min(Number(charge.amount || 0), Number(charge.paidAmount || 0) + Number(payment.amount || 0));
        charge.status = charge.paidAmount >= Number(charge.amount || 0) ? "PAID" : "PARTIALLY_PAID";
      }
    }
    addParentHostelNotification(data, payment.learnerId, `Hostel payment ${payment.status.toLowerCase()}`, `Your hostel payment of R ${Number(payment.amount || 0).toFixed(2)} was ${payment.status.toLowerCase()}.`);
    await savePortalData(data);
    return json(payment);
  }

  if (method === "POST") {
    const body = await readBody(request);
    if (path[1] === "scans") {
      const parsed = parseHostelQrValue(data, String(body.qrCodeValue || ""));
      if (!parsed?.learnerId) return json({ error: "Invalid hostel QR code." }, 400);
      const learner = data.learners.find((item: any) => item.id === parsed.learnerId);
      if (!learner) return json({ error: "Learner linked to this QR code was not found." }, 404);
      const activeAllocation = data.hostel.allocations.find(
        (item: any) => item.learnerId === learner.id && activeAllocationStatuses.includes(item.status),
      );
      if (!activeAllocation) {
        return json({ error: "This learner does not have an active hostel allocation." }, 400);
      }
      const eventType = body.eventType || "ROLL_CALL_PRESENT";
      const stationRole = body.stationRole || (
        String(eventType).startsWith("MEAL_")
          ? "DINING_HALL"
          : String(eventType).includes("GATE")
            ? "GATE_CONTROL"
            : "HOSTEL_SUPERVISOR"
      );
      const duplicateWindowMs = Number(body.duplicateWindowMs || 10 * 60 * 1000);
      const duplicate = (data.hostel.scanEvents || []).find(
        (item: any) =>
          item.learnerId === learner.id &&
          item.eventType === eventType &&
          Math.abs(new Date(item.scannedAt).getTime() - Date.now()) <= duplicateWindowMs,
      );
      if (duplicate && body.allowDuplicate !== true) {
        data.hostel.scanExceptions = data.hostel.scanExceptions || [];
        data.hostel.scanExceptions.unshift({
          id: uid("scan-exception"),
          learnerId: learner.id,
          eventType,
          reason: `Duplicate ${String(eventType).replaceAll("_", " ").toLowerCase()} scan blocked within duplicate protection window.`,
          createdAt: new Date().toISOString(),
          createdBy: user?.name || "Hostel Staff",
        });
        await savePortalData(data);
        return json({ error: "A recent matching scan already exists for this learner." }, 409);
      }
      const event = {
        id: uid("scan"),
        learnerId: learner.id,
        eventType,
        context: body.context || "HOSTEL_SCAN",
        scannedAt: new Date().toISOString(),
        scannedBy: user?.name || "Hostel Staff",
        stationRole,
        notes:
          body.notes ||
          (eventType === "MEAL_BREAKFAST"
            ? "Learner scanned for hostel breakfast."
            : eventType === "MEAL_LUNCH"
              ? "Learner scanned for hostel lunch."
              : eventType === "MEAL_DINNER"
                ? "Learner scanned for hostel dinner."
                : eventType === "MEAL_SPECIAL"
                  ? "Learner scanned for a special hostel meal."
                  : eventType === "CHECKED_OUT_GATE"
                    ? "Learner scanned out of the hostel."
                    : eventType === "CHECKED_IN_GATE"
                      ? "Learner scanned back into the hostel."
                      : "Learner scanned during hostel roll call."),
      };
      if (String(eventType).startsWith("MEAL_")) {
        const mealType = String(eventType).replace("MEAL_", "");
        const today = event.scannedAt.slice(0, 10);
        data.hostel.meals = data.hostel.meals || [];
        let mealRecord = data.hostel.meals.find(
          (item: any) => item.mealDate === today && item.mealType === mealType,
        );
        if (!mealRecord) {
          mealRecord = {
            id: uid("meal"),
            mealDate: today,
            mealType,
            plannedCount: residentsCountFromHostel(data),
            servedCount: 0,
            scannedLearnerIds: [],
          };
          data.hostel.meals.unshift(mealRecord);
        }
        mealRecord.scannedLearnerIds = mealRecord.scannedLearnerIds || [];
        if (!mealRecord.scannedLearnerIds.includes(learner.id)) {
          mealRecord.scannedLearnerIds.push(learner.id);
          mealRecord.servedCount = Number(mealRecord.servedCount || 0) + 1;
        }
      }
      data.hostel.scanEvents = data.hostel.scanEvents || [];
      data.hostel.scanEvents.unshift(event);
      addParentHostelNotification(
        data,
        learner.id,
        String(eventType).startsWith("MEAL_") ? "Hostel meal scan recorded" : "Hostel scan recorded",
        `${learnerName(data, learner.id)} was recorded for ${String(eventType).replaceAll("_", " ").toLowerCase()}.`,
      );
      await savePortalData(data);
      return json({
        ...event,
        learner: { id: learner.id, name: `${learner.firstName} ${learner.lastName}`, studentNumber: learner.studentNumber },
      }, 201);
    }
    if (path[1] === "allocations" && path[3] === "check-in") {
      const allocation = data.hostel.allocations.find((item: any) => item.id === path[2]);
      if (!allocation) return json({ error: "Allocation not found" }, 404);
      if (isBedOccupied(allocation.bedId, allocation.id)) {
        return json({ error: "This bed is already assigned to another active allocation." }, 400);
      }
      Object.assign(allocation, { status: "CHECKED_IN", checkedInAt: new Date().toISOString() });
      data.hostel.scanEvents = data.hostel.scanEvents || [];
      data.hostel.scanEvents.unshift({
        id: uid("scan"),
        learnerId: allocation.learnerId,
        eventType: "CHECKED_IN_RESIDENCE",
        context: "HOSTEL_RESIDENCE",
        scannedAt: allocation.checkedInAt,
        scannedBy: user?.name || "Hostel Staff",
        stationRole: "HOSTEL_SUPERVISOR",
        notes: "Learner was checked into the hostel residence.",
      });
      addParentHostelNotification(
        data,
        allocation.learnerId,
        "Hostel check-in recorded",
        `${learnerName(data, allocation.learnerId)} was checked into hostel residence.`,
      );
      await savePortalData(data);
      return json(allocation);
    }
    if (path[1] === "allocations" && path[3] === "check-out") {
      const allocation = data.hostel.allocations.find((item: any) => item.id === path[2]);
      if (!allocation) return json({ error: "Allocation not found" }, 404);
      Object.assign(allocation, { status: "CHECKED_OUT", checkedOutAt: new Date().toISOString(), checkOutReason: body.reason || "" });
      data.hostel.scanEvents = data.hostel.scanEvents || [];
      data.hostel.scanEvents.unshift({
        id: uid("scan"),
        learnerId: allocation.learnerId,
        eventType: "CHECKED_OUT_RESIDENCE",
        context: "HOSTEL_RESIDENCE",
        scannedAt: allocation.checkedOutAt,
        scannedBy: user?.name || "Hostel Staff",
        stationRole: "HOSTEL_SUPERVISOR",
        notes: body.reason || "Learner was checked out of the hostel residence.",
      });
      addParentHostelNotification(
        data,
        allocation.learnerId,
        "Hostel check-out recorded",
        `${learnerName(data, allocation.learnerId)} was checked out of hostel residence.`,
      );
      await savePortalData(data);
      return json(allocation);
    }
    if (path[1] === "allocations" && path[3] === "transfer") {
      const allocation = data.hostel.allocations.find((item: any) => item.id === path[2]);
      if (!allocation) return json({ error: "Allocation not found" }, 404);
      if (!body.bedId) return json({ error: "A destination bed is required." }, 400);
      if (isBedOccupied(body.bedId, allocation.id)) {
        return json({ error: "The selected bed is already occupied." }, 400);
      }
      Object.assign(allocation, { bedId: body.bedId || allocation.bedId, status: "CHECKED_IN", transferReason: body.reason || "", transferredAt: new Date().toISOString() });
      await savePortalData(data);
      return json(allocation);
    }
    if (path[1] === "visitors" && path[3] === "check-out") {
      const visitor = data.hostel.visitors.find((item: any) => item.id === path[2]);
      if (!visitor) return json({ error: "Visitor not found" }, 404);
      Object.assign(visitor, { status: "CHECKED_OUT", checkedOutAt: new Date().toISOString() });
      await savePortalData(data);
      return json(visitor);
    }

    const collectionMap: Record<string, string> = {
      buildings: "buildings",
      applications: "applications",
      allocations: "allocations",
      "roll-calls": "rollCalls",
      meals: "meals",
      incidents: "incidents",
      maintenance: "maintenance",
      visitors: "visitors",
      charges: "charges",
      notices: "notices",
    };
    if (path[1] === "blocks") {
      const building = data.hostel.buildings.find((item: any) => item.id === body.buildingId);
      if (!building) return json({ error: "Building not found" }, 404);
      const block = { id: uid("block"), rooms: [], ...body };
      building.blocks = [block, ...(building.blocks || [])];
      await savePortalData(data);
      return json(block, 201);
    }
    if (path[1] === "rooms") {
      const building = data.hostel.buildings.find((item: any) => (item.blocks || []).some((block: any) => block.id === body.blockId));
      const block = building?.blocks.find((item: any) => item.id === body.blockId);
      if (!block) return json({ error: "Block not found" }, 404);
      const capacity = Math.max(Number(body.capacity || 1), 1);
      if (!body.roomNumber) return json({ error: "Room number is required." }, 400);
      if ((block.rooms || []).some((room: any) => room.roomNumber === body.roomNumber)) {
        return json({ error: "A room with this number already exists in the selected block." }, 400);
      }
      const room = {
        id: uid("room"),
        ...body,
        capacity,
        monthlyFee: Number(body.monthlyFee || 0),
        beds: Array.from({ length: capacity }, (_, index) => ({ id: uid("bed"), label: `Bed ${index + 1}`, status: "AVAILABLE" })),
      };
      block.rooms = [room, ...(block.rooms || [])];
      await savePortalData(data);
      return json(room, 201);
    }
    const key = collectionMap[path[1]];
    if (key) {
      if (key === "applications") {
        if (!body.learnerId) return json({ error: "Learner is required for a hostel application." }, 400);
        if (data.hostel.applications.some((item: any) => item.learnerId === body.learnerId && ["PENDING", "WAITLISTED", "APPROVED"].includes(item.status))) {
          return json({ error: "This learner already has an active hostel application." }, 400);
        }
      }
      if (key === "allocations") {
        if (!body.learnerId || !body.bedId) return json({ error: "Learner and bed are required for allocation." }, 400);
        if (learnerHasActiveAllocation(body.learnerId)) {
          return json({ error: "This learner already has an active hostel allocation." }, 400);
        }
        if (isBedOccupied(body.bedId)) {
          return json({ error: "The selected bed is already occupied." }, 400);
        }
      }
      if (key === "charges" && !body.learnerId) {
        return json({ error: "Learner is required for a hostel charge." }, 400);
      }
      const defaultStatus: Record<string, string> = {
        applications: "PENDING",
        allocations: "RESERVED",
        incidents: "OPEN",
        maintenance: "OPEN",
        visitors: "CHECKED_IN",
        charges: "UNPAID",
      };
      const item = {
        id: uid(path[1]),
        status: body.status || defaultStatus[key] || "OPEN",
        ...(key === "buildings" ? { blocks: [] } : {}),
        ...(key === "visitors" ? { checkedInAt: new Date().toISOString() } : {}),
        ...(key === "charges" ? { paidAmount: 0 } : {}),
        ...(key === "applications" ? { submittedAt: new Date().toISOString() } : {}),
        ...body,
      };
      data.hostel[key].unshift(item);
      await savePortalData(data);
      return json(item, 201);
    }
  }

  if (method === "PATCH") {
    const collections = ["applications", "incidents", "maintenance"];
    const collection = collections.includes(path[1]) ? data.hostel[path[1]] : null;
    const item = collection?.find((entry: any) => entry.id === path[2]);
    if (item) {
      Object.assign(item, await readBody(request));
      await savePortalData(data);
      return json(item);
    }
  }

  return json({ error: `API route not found: /api/${path.join("/")}` }, 404);
}

async function handleApplications(request: NextRequest, method: string, path: string[], data: any, user: any) {
  if (path.join("/") !== "applications/new") {
    ensureRole(user, ["ADMIN"]);
    ensurePermission(user, "admissions:manage");
  }
  const forms = data.applications.forms;
  if (method === "GET" && path.join("/") === "applications/forms") return json(forms);
  if (method === "POST" && path.join("/") === "applications/forms") {
    const body = await readBody(request);
    const form = { id: uid("form"), name: body.name, slug: body.slug, admissionsOpenState: "open", versions: [], submissions: [] };
    forms.unshift(form);
    await savePortalData(data);
    return json(form, 201);
  }

  if (method === "GET" && path.join("/") === "applications/new") {
    const slug = request.nextUrl.searchParams.get("slug") || "admissions";
    const formId = request.nextUrl.searchParams.get("formId");
    const versionId = request.nextUrl.searchParams.get("versionId");
    const form =
      forms.find((item: any) => item.id === formId) ||
      forms.find((item: any) => item.slug === slug) ||
      forms[0] ||
      null;
    if (!form) {
      return json({
        admissionsOpen: false,
        closedMessage: "Application form not available.",
        form: null,
      });
    }
    const version =
      (form.versions || []).find((item: any) => item.id === versionId) ||
      (form.versions || []).find((item: any) => item.id === form.publishedVersionId) ||
      (form.versions || [])[0] ||
      null;
    const state = form.admissionsOpenState || "open";
    const now = Date.now();
    const opensAt = form.opensAt ? new Date(form.opensAt).getTime() : null;
    const closesAt = form.closesAt ? new Date(form.closesAt).getTime() : null;
    const admissionsOpen = state !== "closed" && (!opensAt || now >= opensAt) && (!closesAt || now <= closesAt);
    return json({
      id: form.id,
      formId: form.id,
      slug: form.slug,
      name: form.name,
      admissionsOpen,
      admissionsOpenState: state,
      opensAt: form.opensAt || null,
      closesAt: form.closesAt || null,
      openingMessage: form.openingMessage || "",
      closedMessage: form.closedMessage || "Admissions are currently closed. Please check back later.",
      form: version,
    });
  }

  if (method === "POST" && path.join("/") === "applications/new") {
    const body = await readBody(request);
    const form = forms.find((item: any) => item.slug === body.slug) || forms[0];
    if (!form) return json({ error: "Application form not available." }, 404);
    const now = Date.now();
    const opensAt = form.opensAt ? new Date(form.opensAt).getTime() : null;
    const closesAt = form.closesAt ? new Date(form.closesAt).getTime() : null;
    if ((form.admissionsOpenState || "open") === "closed" || (opensAt && now < opensAt) || (closesAt && now > closesAt)) return json({ error: form.closedMessage || "Admissions are currently closed." }, 400);
    if ((body.files || []).length > 10) return json({ error: "Upload at most 10 documents." }, 400);
    const submissionId = uid("submission");
    const files = [];
    for (const file of body.files || []) {
      const document = await storeDocument(submissionId, { name: file.originalFilename, mimeType: file.mimeType, contentBase64: file.contentBase64 });
      files.push({ ...document, fieldKey: file.fieldKey, originalFilename: document.name });
    }
    const submission = { applicantName: String(body.applicantName || ""), guardianName: String(body.guardianName || ""), guardianEmail: String(body.guardianEmail || ""), guardianPhone: String(body.guardianPhone || ""), payload: body.payload || {}, files, id: submissionId, submissionReference: "APP-" + String((form.submissions || []).length + 1).padStart(4, "0"), status: "SUBMITTED", submittedAt: new Date().toISOString(), submissionChannel: "website" };
    form.submissions = [submission, ...(form.submissions || [])];
    await savePortalData(data);
    return json(submission, 201);
  }

  const form = forms.find((item: any) => item.id === path[2]);
  if (!form) return json({ error: "Form not found" }, 404);
  if (method === "GET" && path.length === 3) return json(form);
  if (method === "GET" && path[3] === "submissions") return json(form.submissions || []);
  if (method === "POST" && path[3] === "versions") {
    const body = await readBody(request);
    const version = { id: uid("form-version"), version: (form.versions || []).length + 1, createdAt: new Date().toISOString(), schemaJson: body.schema };
    form.versions = [version, ...(form.versions || [])];
    await savePortalData(data);
    return json(version, 201);
  }
  if (method === "POST" && path[3] === "publish") {
    const body = await readBody(request);
    form.publishedVersionId = body.versionId;
    await savePortalData(data);
    return json(form);
  }
  if (method === "PATCH" && path[3] === "status") {
    Object.assign(form, await readBody(request));
    await savePortalData(data);
    return json(form);
  }

  return json({ error: `API route not found: /api/${path.join("/")}` }, 404);
}

function ensurePermission(user: any, permission: string) {
  if (!user || !hasPermission(user, permission)) {
    throw new Error("Unauthorized");
  }
}

function getAppointmentSettings(data: any) {
  return { days: data.appointmentSettings?.days || [1, 2, 3, 4, 5], opens: data.appointmentSettings?.opens || "08:00", closes: data.appointmentSettings?.closes || "16:00", durationMinutes: data.appointmentSettings?.durationMinutes || 30, conflictWindowMinutes: data.appointmentSettings?.conflictWindowMinutes ?? 30 };
}

async function handlePublic(request: NextRequest, method: string, path: string[], data: any) {
  if (method === "GET" && path[1] === "appointments") {
    return json({ businessHours: getAppointmentSettings(data), bookedStartsAt: (data.parent?.appointments || []).filter((item: any) => ["REQUESTED", "CONFIRMED"].includes(item.status)).map((item: any) => item.startsAt) });
  }
  if (method !== "POST") return json({ error: "Public form route not found." }, 404);
  const body = await readBody(request);
  const name = String(body.name || body.contactName || "").trim();
  const email = String(body.email || "").trim().toLowerCase();
  const phone = String(body.phone || "").trim();
  if (!name || !email) return json({ error: "Name and email are required." }, 400);

  if (path[1] === "appointments") {
    const startsAt = String(body.startsAt || "").trim();
    if (!startsAt) return json({ error: "Please select a preferred appointment time." }, 400);
    const parsed = new Date(startsAt);
    const settings = getAppointmentSettings(data);
    const [openHour, openMinute] = settings.opens.split(":").map(Number);
    const [closeHour, closeMinute] = settings.closes.split(":").map(Number);
    const minutes = parsed.getHours() * 60 + parsed.getMinutes();
    if (Number.isNaN(parsed.getTime()) || parsed.getTime() <= Date.now()) return json({ error: "Please choose a future appointment time." }, 400);
    if (!settings.days.includes(parsed.getDay()) || minutes < openHour * 60 + openMinute || minutes >= closeHour * 60 + closeMinute) return json({ error: `Appointments are available on selected school days, ${settings.opens} to ${settings.closes}.` }, 400);
    data.parent = data.parent || {};
    data.parent.appointments = data.parent.appointments || [];
    if (data.parent.appointments.some((item: any) => ["REQUESTED", "CONFIRMED"].includes(item.status) && item.startsAt && Math.abs(new Date(item.startsAt).getTime() - parsed.getTime()) < settings.conflictWindowMinutes * 60 * 1000)) return json({ error: "That time is already requested. Please choose another time." }, 409);
    const appointment = {
      id: uid("public-appointment"),
      learnerId: null,
      title: String(body.title || "School enquiry appointment").trim(),
      teacherName: "Admissions team",
      teacherEmail: "",
      parentName: name,
      parentEmail: email,
      phone,
      startsAt,
      endsAt: String(body.endsAt || "").trim(),
      location: String(body.location || "School office / online").trim(),
      notes: String(body.message || body.notes || "").trim(),
      status: "REQUESTED",
      createdAt: new Date().toISOString(),
    };
    data.parent.appointments.unshift(appointment);
    data.notifications = [{ id: uid("notification"), type: "appointment", title: "New appointment request", message: `${name} requested an appointment.`, createdAt: new Date().toISOString(), read: false }, ...(data.notifications || [])];
    await savePortalData(data);
    return json({ ok: true, appointment }, 201);
  }

  if (path[1] === "enquiries") {
    data.enquiries = data.enquiries || [];
    const enquiry = {
      id: uid("enquiry"),
      name,
      email,
      phone,
      subject: String(body.subject || "Website enquiry").trim(),
      message: String(body.message || "").trim(),
      status: "NEW",
      createdAt: new Date().toISOString(),
    };
    if (!enquiry.message) return json({ error: "Please enter a message." }, 400);
    data.enquiries.unshift(enquiry);
    data.notifications = [{ id: uid("notification"), type: "enquiry", title: "New website enquiry", message: `${name} sent a new enquiry.`, createdAt: new Date().toISOString(), read: false }, ...(data.notifications || [])];
    await savePortalData(data);
    return json({ ok: true, enquiry }, 201);
  }

  if (path[1] === "newsletter") {
    data.newsletterSubscribers = data.newsletterSubscribers || [];
    if (data.newsletterSubscribers.some((item: any) => item.email === email)) return json({ ok: true, alreadySubscribed: true });
    data.newsletterSubscribers.unshift({ id: uid("subscriber"), name, email, subscribedAt: new Date().toISOString(), status: "ACTIVE" });
    await savePortalData(data);
    return json({ ok: true }, 201);
  }

  return json({ error: "Public form route not found." }, 404);
}

async function handleIdentity(request: NextRequest, method: string, path: string[], data: any, currentUser: any) {
  ensureRole(currentUser, ["ADMIN"]);
  const publicConfig = (provider: any) => ({ ...provider, clientSecret: undefined, privateKey: undefined });
  if (method === "GET" && path.join("/") === "identity/providers") return json(data.identityProviders.map(publicConfig));
  const provider = data.identityProviders.find((item: any) => item.provider === path[2]);
  if (!provider) return json({ error: "Provider not found" }, 404);
  if (method === "PUT" && path[1] === "providers" && path.length === 3) {
    const body = await readBody(request);
    for (const key of ["displayName", "tenantDomain", "externalTenantId", "clientId", "settings", "roleMappings"]) if (body[key] !== undefined) provider[key] = body[key];
    if (body.clientSecret) provider.clientSecret = encryptSecret(String(body.clientSecret));
    provider.credentialsConfigured = Boolean(provider.clientId && provider.clientSecret);
    provider.status = provider.credentialsConfigured ? "CONFIGURED" : "NOT_CONFIGURED";
    provider.tokenHealth = "Not tested";
    await savePortalData(data);
    return json(publicConfig(provider));
  }
  if (method === "DELETE" && path[1] === "providers" && path.length === 3) {
    Object.assign(provider, { status: "NOT_CONFIGURED", credentialsConfigured: false, tokenHealth: "Disconnected" });
    await savePortalData(data);
    return json(publicConfig(provider));
  }
  if (method === "POST" && path[1] === "providers" && path[3] === "sync") {
    let result: any;
    try { result = await syncDirectory(provider); provider.lastSyncAt = new Date().toISOString(); provider.lastError = null; provider.tokenHealth = "Verified"; }
    catch (error) { result = { status: "FAILED", error: (error as Error).message }; provider.lastError = result.error; provider.tokenHealth = "Failed"; }
    provider.syncLogs = [{ id: uid("sync"), operation: "MANUAL_SYNC", ...result, createdAt: new Date().toISOString() }, ...(provider.syncLogs || [])].slice(0, 100);
    await savePortalData(data);
    return json(result);
  }
  return json({ error: `API route not found: /api/${path.join("/")}` }, 404);
}

export const POST = withWriteTransaction(POSTHandler);

export const PUT = withWriteTransaction(PUTHandler);

export const PATCH = withWriteTransaction(PATCHHandler);

export const DELETE = withWriteTransaction(DELETEHandler);
