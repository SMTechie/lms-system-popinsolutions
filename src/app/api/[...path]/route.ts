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
  renderDisciplineEmail,
  renderGuardianLinkedEmail,
  renderTeacherWelcomeEmail,
  sendTransactionalEmail,
} from "@/src/server/email";
import { prisma } from "@/src/server/prisma";
import { getOperationsData, saveOperationsData } from "@/src/server/operations";
import { appendAuditLog } from "@/src/server/settings";

type RouteContext = { params: Promise<{ path: string[] }> };

export async function GET(request: NextRequest, context: RouteContext) {
  return handle(request, context);
}

export async function POST(request: NextRequest, context: RouteContext) {
  return handle(request, context);
}

export async function PUT(request: NextRequest, context: RouteContext) {
  return handle(request, context);
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  return handle(request, context);
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  return handle(request, context);
}

async function handle(request: NextRequest, { params }: RouteContext) {
  const { path } = await params;
  const route = path.join("/");
  const method = request.method;
  const data = await getPortalData();
  const operations = await getOperationsData();
  const publicRoute =
    path[0] === "applications" && path[1] === "new";
  const user = publicRoute ? null : await requireCurrentUserFromHeader(request.headers.get("authorization")).catch(() => null);

  if (!publicRoute && !user) {
    return json({ error: "Unauthorized" }, 401);
  }

  try {
    if (path[0] === "admin") return handleAdmin(request, method, path, data, operations, user);
    if (path[0] === "boards") return handleBoards(request, method, path, data, operations, user);
    if (path[0] === "parent") return handleParent(request, method, path, data, user);
    if (path[0] === "teacher") return handleTeacher(request, method, path, data, operations, user);
    if (path[0] === "teacher-assistant") return handleTeacherAssistant(request, method, path, data, user);
    if (path[0] === "students") return handleStudents(request, method, path, data, user);
    if (path[0] === "hostel") return handleHostel(request, method, path, data, user);
    if (path[0] === "applications") return handleApplications(request, method, path, data, user);
    if (path[0] === "identity") return handleIdentity(request, method, path, data, user);
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

async function handleAdmin(request: NextRequest, method: string, path: string[], data: any, operations: any, user: any) {
  ensureRole(user, ["ADMIN", "TEACHER"]);
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

  if (method === "POST" && path[1] === "notifications" && path[2] === "read-all") {
    data.notifications = (data.notifications || []).map((item: any) => ({ ...item, read: true }));
    await savePortalData(data);
    return json(data.notifications);
  }

  if (method === "GET" && path[1] === "users") {
    return json(users);
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

  if (method === "POST" && path[1] === "finance" && path[2] === "payments" && path[3] && ["verify", "reject"].includes(path[4])) {
    const payment = (data.parent?.payments || []).find((item: any) => item.id === path[3]);
    if (!payment) return json({ error: "Payment not found." }, 404);
    payment.status = path[4] === "verify" ? "VERIFIED" : "REJECTED";
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
  ensureRole(user, ["ADMIN", "TEACHER"]);
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
  data.parent.profile = data.parent.profile || {};
  data.parent.settings = data.parent.settings || {};

  if (method === "GET" && path.join("/") === "parent/children") {
    const links = data.learners.flatMap((learner: any) =>
      (learner.guardians || []).map((link: any) => ({
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
    return json(parentEmail ? links.filter((link: any) => link.guardian?.email?.toLowerCase() === parentEmail) : links);
  }

  const learnerId = path[2];
  const learner = data.learners.find((item: any) => item.id === learnerId);
  const learnerLink = learner && parentEmail
    ? (learner.guardians || []).find((link: any) => link.guardian?.email?.toLowerCase() === parentEmail)
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
    return json({
      homework: workItems.filter((item: any) => item.type === "HOMEWORK"),
      attendance,
      assessments: workItems.filter((item: any) => item.type === "ASSESSMENT"),
      announcements: data.teacher.dashboard.announcements || [],
      appointments,
      discipline,
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

  if (method === "GET" && path[1] === "children" && learnerId && path[3] === "fees") {
    const items = (data.parent.fees || []).filter((item: any) => item.learnerId === learnerId);
    const payments = (data.parent.payments || []).filter((item: any) => item.learnerId === learnerId);
    return json({
      items,
      payments,
      summary: {
        total: items.reduce((sum: number, item: any) => sum + Number(item.amount || 0), 0),
        paid: items.reduce((sum: number, item: any) => sum + Number(item.paidAmount || 0), 0),
        outstanding: items.reduce((sum: number, item: any) => sum + Number(item.amount || 0) - Number(item.paidAmount || 0), 0),
      },
    });
  }

  if (method === "POST" && path[1] === "children" && learnerId && path[3] === "fees" && path[4] === "payments") {
    if (!learnerLink?.payFees) return json({ error: "Fee payment is not enabled for this learner." }, 403);
    const body = await readBody(request);
    const paymentAmount = Number(body.amount || 0);
    if (!paymentAmount) return json({ error: "Enter a payment amount." }, 400);
    const fee = (data.parent.fees || []).find((item: any) => item.id === body.feeId && item.learnerId === learnerId);
    if (!fee) return json({ error: "Fee record not found." }, 404);
    const payment = {
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
    fee.paidAmount = Math.min(Number(fee.amount || 0), Number(fee.paidAmount || 0) + paymentAmount);
    fee.status = fee.paidAmount >= fee.amount ? "PAID" : "PARTIAL";
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

  if (method === "GET" && path[1] === "children" && learnerId && path[3] === "applications") {
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
      charges: data.hostel.charges.filter((item: any) => item.learnerId === learnerId),
      notices: data.hostel.notices,
      qrCodeValue,
      qrCodeLabel: learner?.studentNumber || learnerId,
      qrPassVersion: qrPass?.version || 1,
      qrIssuedAt: qrPass?.issuedAt || null,
      movementHistory: buildHostelMovementHistory(data, learnerId),
    });
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
        .filter((item: any) => item.learnerId === learnerId)
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
      teacherEmail: body.teacherEmail || "teacher@popin.school",
      title: body.title || "Parent meeting",
      startsAt: body.startsAt,
      endsAt: body.endsAt || body.startsAt,
      location: body.location || "School campus",
      notes: body.notes || "",
      status: "REQUESTED",
      createdBy: "Parent",
    };
    data.parent.appointments.unshift(appointment);
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
    Object.assign(appointment, body);
    await savePortalData(data);
    return json(appointment);
  }

  if (method === "POST" && path[1] === "children" && learnerId && path[3] === "hostel" && path[4] === "applications") {
    const body = await readBody(request);
    data.hostel.applications.unshift({ id: uid("hostel-app"), learnerId, status: "PENDING", ...body });
    await savePortalData(data);
    return json(data.hostel.applications[0], 201);
  }

  if (method === "POST" && path[1] === "children" && learnerId && path[3] === "hostel" && path[4] === "concerns") {
    const body = await readBody(request);
    data.hostel.maintenance.unshift({ id: uid("maintenance"), learnerId, source: "Parent Portal", status: "OPEN", priority: "MEDIUM", ...body });
    await savePortalData(data);
    return json(data.hostel.maintenance[0], 201);
  }

  if (method === "POST" && path[1] === "children" && learnerId && path[3] === "hostel" && path[4] === "qr" && path[5] === "rotate") {
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
        .filter((item: any) => item.learnerId === learnerId)
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
    const body = await readBody(request);
    const thread = (data.parent.messages || []).find((item: any) => item.id === path[4] && item.learnerId === learnerId);
    if (!thread) return json({ error: "Conversation not found." }, 404);
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
    await savePortalData(data);
    return json(reply, 201);
  }

  if (method === "GET" && path.join("/") === "parent/orders") {
    return json(
      (data.parent.orders || []).filter((item: any) => !parentEmail || data.parent.guardianEmail?.toLowerCase() === parentEmail),
    );
  }

  if (method === "PATCH" && path[1] === "orders" && path[2]) {
    const body = await readBody(request);
    const order = (data.parent.orders || []).find((item: any) => item.id === path[2]);
    if (!order) return json({ error: "Order not found." }, 404);
    Object.assign(order, body);
    await savePortalData(data);
    return json(order);
  }

  if (method === "GET" && path.join("/") === "parent/tickets") {
    return json((data.parent.tickets || []).sort((a: any, b: any) => String(b.createdAt).localeCompare(String(a.createdAt))));
  }

  if (method === "POST" && path.join("/") === "parent/tickets") {
    const body = await readBody(request);
    const ticket = {
      id: uid("parent-ticket"),
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
    const ticket = (data.parent.tickets || []).find((item: any) => item.id === path[2]);
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
    const ticket = (data.parent.tickets || []).find((item: any) => item.id === path[2]);
    if (!ticket) return json({ error: "Ticket not found." }, 404);
    Object.assign(ticket, body);
    await savePortalData(data);
    return json(ticket);
  }

  if (method === "GET" && path.join("/") === "parent/notifications") {
    return json((data.parent.notifications || []).sort((a: any, b: any) => String(b.createdAt).localeCompare(String(a.createdAt))));
  }

  if (method === "POST" && path.join("/") === "parent/notifications/read-all") {
    data.parent.notifications = (data.parent.notifications || []).map((item: any) => ({ ...item, readAt: item.readAt || new Date().toISOString() }));
    await savePortalData(data);
    return json(data.parent.notifications);
  }

  if (method === "POST" && path[1] === "notifications" && path[2] && path[3] === "read") {
    const notification = (data.parent.notifications || []).find((item: any) => item.id === path[2]);
    if (!notification) return json({ error: "Notification not found." }, 404);
    notification.readAt = new Date().toISOString();
    await savePortalData(data);
    return json(notification);
  }

  if (method === "GET" && path.join("/") === "parent/profile") {
    return json({
      profile: data.parent.profile,
      settings: data.parent.settings,
      guardianName: data.parent.guardianName || user.name || "",
      guardianEmail: data.parent.guardianEmail || user.email,
    });
  }

  if (method === "PATCH" && path.join("/") === "parent/profile") {
    const body = await readBody(request);
    data.parent.profile = { ...(data.parent.profile || {}), ...(body.profile || {}) };
    data.parent.settings = { ...(data.parent.settings || {}), ...(body.settings || {}) };
    if (body.guardianName) data.parent.guardianName = body.guardianName;
    await savePortalData(data);
    return json({
      profile: data.parent.profile,
      settings: data.parent.settings,
      guardianName: data.parent.guardianName || user.name || "",
      guardianEmail: data.parent.guardianEmail || user.email,
    });
  }

  return json({ error: `API route not found: /api/${path.join("/")}` }, 404);
}

async function handleTeacher(request: NextRequest, method: string, path: string[], data: any, operations: any, user: any) {
  ensureRole(user, ["ADMIN", "TEACHER"]);
  data.teacher = data.teacher || {};
  data.teacher.dashboard = data.teacher.dashboard || {};
  data.teacher.profile = data.teacher.profile || {};
  if (method === "GET" && path.join("/") === "teacher/dashboard") {
    const parentQueries = (data.parent?.messages || [])
      .filter((thread: any) => thread.status !== "CLOSED")
      .map((thread: any) => ({
        id: thread.id,
        learnerId: thread.learnerId,
        subject: thread.subject,
        status: thread.status,
        teacherName: thread.teacherName || "Assigned Teacher",
        teacherEmail: thread.teacherEmail || "teacher@popin.school",
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
        (item.teacherEmail || "teacher@popin.school").toLowerCase() === user.email?.toLowerCase(),
    );
    data.teacher.dashboard.parentQueries = parentQueries;
    data.teacher.dashboard.requisitions = requisitions;
    data.teacher.dashboard.appointmentRequests = appointmentRequests;
    return json(data.teacher.dashboard);
  }
  if (method === "GET" && path.join("/") === "teacher/classes") return json(data.classes);
  if (method === "GET" && path.join("/") === "teacher/messages") {
    return json(
      (data.parent?.messages || [])
        .filter((thread: any) => (thread.teacherEmail || "teacher@popin.school").toLowerCase() === user.email?.toLowerCase())
        .sort((a: any, b: any) => String(b.updatedAt).localeCompare(String(a.updatedAt))),
    );
  }
  if (method === "POST" && path[1] === "messages" && path[2] && path[3] === "reply") {
    const body = await readBody(request);
    const thread = (data.parent?.messages || []).find((item: any) => item.id === path[2]);
    if (!thread) return json({ error: "Conversation not found." }, 404);
    const reply = {
      id: uid("thread-message"),
      authorRole: "TEACHER",
      authorName: user.name || user.email,
      message: body.message || "",
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
      message: `${user.name || "Your teacher"} replied to your message about ${learnerName(data, thread.learnerId)}.`,
      createdAt: new Date().toISOString(),
      readAt: null,
    });
    await savePortalData(data);
    return json(reply, 201);
  }
  if (method === "PATCH" && path[1] === "messages" && path[2] && path[3] === "status") {
    const body = await readBody(request);
    const thread = (data.parent?.messages || []).find((item: any) => item.id === path[2]);
    if (!thread) return json({ error: "Conversation not found." }, 404);
    thread.status = body.status || thread.status;
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
        .filter((item: any) => (item.teacherEmail || "teacher@popin.school").toLowerCase() === user.email?.toLowerCase())
        .sort((a: any, b: any) => String(a.startsAt).localeCompare(String(b.startsAt))),
    );
  }
  if (method === "GET" && path.join("/") === "teacher/assessments/overview") {
    const classMap = new Map(data.classes.map((item: any) => [item.id, item]));
    const classroomAssessments = data.classes.flatMap((schoolClass: any) =>
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
    const appointment = (data.parent?.appointments || []).find((item: any) => item.id === path[2]);
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
    const workItem = { id: uid("work"), ...body, createdAt: new Date().toISOString() };
    const targetClasses = body.classId ? data.classes.filter((item: any) => item.id === body.classId) : data.classes;
    targetClasses.forEach((item: any) => item.workItems.unshift(workItem));
    data.teacher.dashboard.announcements = body.type === "ANNOUNCEMENT" ? [workItem, ...(data.teacher.dashboard.announcements || [])] : data.teacher.dashboard.announcements;
    await savePortalData(data);
    return json(workItem, 201);
  }

  if (method === "POST" && path.join("/") === "teacher/attendance") {
    const body = await readBody(request);
    const registerDate = String(body.registerDate || new Date().toISOString()).slice(0, 10);
    data.parent = data.parent || {};
    data.parent.attendance = data.parent.attendance || [];
    for (const entry of body.entries || []) {
      const existing = data.parent.attendance.find((item: any) => item.learnerId === entry.learnerId && item.date === registerDate);
      if (existing) {
        existing.status = entry.status;
        existing.note = entry.note || existing.note || "";
        existing.capturedBy = user.name || user.email;
        existing.submittedAt = new Date().toISOString();
        continue;
      }
      data.parent.attendance.unshift({
        id: uid("attendance"),
        learnerId: entry.learnerId,
        date: registerDate,
        status: entry.status,
        note: entry.note || "",
        capturedBy: user.name || user.email,
        submittedAt: new Date().toISOString(),
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

async function handleTeacherAssistant(request: NextRequest, method: string, path: string[], data: any, user: any) {
  ensureRole(user, ["ADMIN", "TEACHER"]);
  const assessments = data.teacherAssistant.assessments;
  if (method === "GET" && path.length === 1) {
    const scripts = assessments.flatMap((assessment: any) => assessment.scripts || []);
    return json({
      metrics: {
        scriptsWaiting: scripts.filter((script: any) => ["QUEUED", "OCR", "MARKING"].includes(script.status)).length,
        readyForReview: scripts.filter((script: any) => script.status === "READY_FOR_REVIEW").length,
        needsAttention: scripts.filter((script: any) => script.status === "NEEDS_REVIEW").length,
        averageReviewSeconds: scripts.length ? 18 : 0,
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
    assessments.unshift(assessment);
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
    const created = scripts.map((script: any) => {
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
        status: "READY_FOR_REVIEW",
        learnerId: script.learnerId || null,
        originalFiles: script.originalFiles || [],
        extractedText: script.extractedText || "",
        ocrConfidence: script.extractedText ? 0.94 : null,
        markingConfidence: null,
        suggestedTotal: 0,
        finalTotal: 0,
        flags: script.extractedText ? [] : ["Awaiting OCR text"],
        results,
        createdAt: new Date().toISOString(),
      };
    });
    assessment.scripts = [...created, ...(assessment.scripts || [])];
    updateAssessmentCounts(assessment);
    await savePortalData(data);
    return json({ scripts: created }, 201);
  }
  if (method === "PATCH" && path[1] === "scripts" && path[3] === "extracted-text") {
    const match = findAssistantScript(assessments, path[2]);
    if (!match) return json({ error: "Script not found" }, 404);
    Object.assign(match.script, await readBody(request), { status: "READY_FOR_REVIEW", ocrConfidence: 0.94 });
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
      if (target) Object.assign(target, { finalMarks: result.finalMarks, note: result.note });
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
      if (scriptIds.has(script.id)) script.status = path[3] === "approve" ? "APPROVED" : "PUBLISHED";
    }
    updateAssessmentCounts(assessment);
    await savePortalData(data);
    return json({ status: "OK" });
  }
  if (method === "POST" || method === "PATCH") {
    return json({ status: "QUEUED" });
  }
  return json({ error: `API route not found: /api/${path.join("/")}` }, 404);
}

async function handleStudents(request: NextRequest, method: string, path: string[], data: any, user: any) {
  ensureRole(user, ["ADMIN", "TEACHER"]);
  if (method === "GET" && path[1] === "discipline" && path.length === 2) {
    const overview = buildDisciplineOverview(data);
    return json({
      ...overview,
      learners: data.learners,
    });
  }

  if (method === "PATCH" && path[1] === "discipline" && path[2]) {
    const record = (data.disciplinary?.records || []).find((item: any) => item.id === path[2]);
    if (!record) return json({ error: "Disciplinary record not found" }, 404);
    Object.assign(record, await readBody(request));
    await savePortalData(data);
    return json(record);
  }

  if (method === "GET" && path.length === 1) {
    const status = request.nextUrl.searchParams.get("status") || "ACTIVE";
    const search = (request.nextUrl.searchParams.get("search") || "").toLowerCase();
    const items = data.learners.filter((item: any) => item.status === status && `${item.firstName} ${item.lastName} ${item.studentNumber} ${item.identityNumber}`.toLowerCase().includes(search));
    return json({ items, grades: data.grades, classes: data.classes, subjects: data.subjects });
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
    const temporaryPassword = String(body.temporaryPassword || "").trim() || "ChangeMe123!";
    if (!email || !name) return json({ error: "Teacher name and email are required." }, 400);
    const teacher = await prisma.user.upsert({
      where: { email },
      update: { name, role: "TEACHER", passwordHash: await hashPassword(temporaryPassword) },
      create: { email, name, role: "TEACHER", passwordHash: await hashPassword(temporaryPassword) },
    });
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

  const learner = data.learners.find((item: any) => item.id === path[1]);
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
    const link = { id: uid("guardian-link"), status: "VERIFIED", guardian: { id: uid("guardian"), email: body.email, name: body.name }, ...body };
    learner.guardians = [link, ...(learner.guardians || [])];
    await savePortalData(data);
    const invite = renderGuardianLinkedEmail(body.name, `${learner.firstName} ${learner.lastName}`, absoluteUrl(request, "/register"));
    await sendTransactionalEmail({ to: body.email, subject: invite.subject, html: invite.html, text: invite.text });
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
  ensureRole(user, ["ADMIN", "TEACHER"]);
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
    ensureRole(user, ["ADMIN", "TEACHER"]);
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
    return json({
      id: form.id,
      formId: form.id,
      slug: form.slug,
      name: form.name,
      admissionsOpen: state !== "closed",
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
    const submission = { id: uid("submission"), submissionReference: `APP-${String((form.submissions || []).length + 1).padStart(4, "0")}`, status: "SUBMITTED", submittedAt: new Date().toISOString(), submissionChannel: "website", ...body };
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

async function handleIdentity(request: NextRequest, method: string, path: string[], data: any, currentUser: any) {
  ensureRole(currentUser, ["ADMIN"]);
  if (method === "GET" && path.join("/") === "identity/providers") return json(data.identityProviders);
  const provider = data.identityProviders.find((item: any) => item.provider === path[2]);
  if (!provider) return json({ error: "Provider not found" }, 404);
  if (method === "PUT" && path[1] === "providers" && path.length === 3) {
    Object.assign(provider, await readBody(request), { status: "CONFIGURED", credentialsConfigured: true, tokenHealth: "Ready" });
    await savePortalData(data);
    return json(provider);
  }
  if (method === "DELETE" && path[1] === "providers" && path.length === 3) {
    Object.assign(provider, { status: "NOT_CONFIGURED", credentialsConfigured: false, tokenHealth: "Disconnected" });
    await savePortalData(data);
    return json(provider);
  }
  if (method === "POST" && path[1] === "providers" && path[3] === "sync") {
    provider.lastSyncAt = new Date().toISOString();
    provider.syncLogs = [{ id: uid("sync"), operation: "MANUAL_SYNC", status: "QUEUED", createdAt: provider.lastSyncAt }, ...(provider.syncLogs || [])];
    await savePortalData(data);
    return json({ status: "QUEUED" });
  }
  return json({ error: `API route not found: /api/${path.join("/")}` }, 404);
}
