import { prisma } from "./prisma";
import {
  PortalData,
  buildDisciplineOverview,
  learnerName,
} from "./portalData";
import {
  OperationsData,
  computeInventoryOverview,
  computeRequisitionOverview,
} from "./operations";

type UserSummary = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  createdAt: Date;
  updatedAt: Date;
};

const monthLabel = (input: Date) =>
  input.toLocaleString("en-ZA", { month: "short" });

export async function listAdminUsers() {
  const users = await prisma.user.findMany({
    orderBy: { updatedAt: "desc" },
  });

  return users.map((user) => ({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    registrationStatus: user.registrationStatus,
    registrationReviewedAt: user.registrationReviewedAt,
    registrationRejectionReason: user.registrationRejectionReason,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    status: user.registrationStatus === "REJECTED" ? "rejected" : user.registrationStatus === "PENDING" ? "pending" : "active",
    lastLogin: user.updatedAt.toISOString(),
    avatar: initials(user.name || user.email),
  }));
}

export function buildAdminDashboard(
  portalData: PortalData,
  operationsData: OperationsData,
  users: UserSummary[],
) {
  const inventory = computeInventoryOverview(operationsData);
  const requisitions = computeRequisitionOverview(operationsData);
  const discipline = buildDisciplineOverview(portalData);
  const admissions = portalData.applications.forms.flatMap(
    (form: any) => form.submissions || [],
  );
  const storeSalesToday = operationsData.store.orders.reduce(
    (sum, order) => sum + Number(order.totalAmount || 0),
    0,
  );
  const outstandingFees = portalData.parent.fees.reduce(
    (sum: number, fee: any) => sum + Number(fee.amount || 0) - Number(fee.paidAmount || 0),
    0,
  ) + portalData.hostel.charges.reduce(
    (sum: number, charge: any) => sum + Number(charge.amount || 0) - Number(charge.paidAmount || 0),
    0,
  );
  const paymentQueue = (portalData.parent.payments || []).filter(
    (payment: any) => payment.status === "PENDING_VERIFICATION",
  );
  const appointmentQueue = (portalData.parent.appointments || []).filter(
    (appointment: any) => ["REQUESTED", "CONFIRMED"].includes(appointment.status),
  );
  const communicationQueue = (portalData.parent.messages || []).filter(
    (thread: any) => thread.status !== "CLOSED",
  );
  const accessQueue = users.filter((user) => user.role !== "ADMIN");
  const approvalQueue = [
    ...operationsData.requisitions
      .filter((item) => item.status === "PENDING_APPROVAL")
      .map((item) => ({
        id: item.id,
        type: "REQUISITION",
        title: item.title,
        owner: item.createdBy?.name || item.createdBy?.email || "Staff member",
        detail: `${item.reference} • ${item.department || "General"} • R ${(item.estimatedTotal || 0).toLocaleString("en-ZA")}`,
        status: item.status,
        createdAt: item.createdAt,
      })),
    ...portalData.hostel.applications
      .filter((item) => item.status === "PENDING")
      .map((item) => ({
        id: item.id,
        type: "HOSTEL_APPLICATION",
        title: `Hostel application for ${learnerName(portalData, item.learnerId)}`,
        owner: "Parent Portal",
        detail: `Academic year ${item.academicYear || new Date().getFullYear()}`,
        status: item.status,
        createdAt: (item as any).createdAt || new Date().toISOString(),
      })),
    ...portalData.disciplinary.records
      .filter((item) => item.parentVisible && item.requiresAcknowledgement && !item.parentAcknowledgedAt)
      .map((item) => ({
        id: item.id,
        type: "DISCIPLINE_ACK",
        title: item.title,
        owner: learnerName(portalData, item.learnerId),
        detail: `${item.category} • ${item.severity}`,
        status: item.status,
        createdAt: item.occurredAt,
      })),
  ].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));

  const overviewCards = [
    {
      title: "Open Tasks",
      value:
        requisitions.pendingApprovals +
        inventory.pendingRequests +
        discipline.stats.awaitingAcknowledgement,
      subtitle: "Approvals, requests, and follow-ups",
      tone: "blue",
    },
    {
      title: "Open Tickets",
      value: operationsData.tickets.filter((item) => item.status !== "resolved").length,
      subtitle: "Support and maintenance issues",
      tone: "violet",
    },
    {
      title: "Store Sales Today",
      value: `R ${storeSalesToday.toLocaleString("en-ZA", {
        minimumFractionDigits: 2,
      })}`,
      subtitle: `${operationsData.store.orders.length} orders`,
      tone: "emerald",
    },
    {
      title: "Outstanding Fees",
      value: `R ${outstandingFees.toLocaleString("en-ZA", {
        minimumFractionDigits: 2,
      })}`,
      subtitle: "School and hostel balances",
      tone: "amber",
    },
  ];

  const pipelineCards = [
    {
      title: "Admissions Pipeline",
      value: admissions.length,
      subtitle: "Submitted applications",
      tone: "cyan",
    },
    {
      title: "Pending Approvals",
      value: requisitions.pendingApprovals,
      subtitle: "Procurement and workflow",
      tone: "rose",
    },
    {
      title: "Low Stock Alerts",
      value: inventory.lowStockCount + inventory.outOfStockCount,
      subtitle: "Items below threshold",
      tone: "orange",
    },
    {
      title: "Active Users",
      value: users.length,
      subtitle: "Configured workspace accounts",
      tone: "indigo",
    },
  ];

  return {
    headline: {
      title: "School operations at a glance",
      description:
        "Live operational summary across admissions, procurement, inventory, portals, discipline, and school commerce.",
      quickStats: [
        {
          label: "Approvals waiting",
          value: String(requisitions.pendingApprovals),
        },
        {
          label: "Parents notified",
          value: String(discipline.stats.awaitingAcknowledgement),
        },
        {
          label: "Store orders ready",
          value: String(
            operationsData.store.orders.filter(
              (order) => order.status === "READY_FOR_COLLECTION",
            ).length,
          ),
        },
      ],
    },
    overviewCards,
    pipelineCards,
    revenueChart: buildRevenueSeries(operationsData),
    ticketChart: buildTicketBreakdown(operationsData),
    admissions,
    activity: portalData.activity || [],
    approvalQueue,
    financeQueue: paymentQueue.map((payment: any) => ({
      ...payment,
      learnerName: learnerName(portalData, payment.learnerId),
    })),
    communicationQueue: communicationQueue.map((thread: any) => ({
      ...thread,
      learnerName: learnerName(portalData, thread.learnerId),
      latestMessage: thread.messages?.[thread.messages.length - 1]?.message || "",
    })),
    appointmentQueue: appointmentQueue.map((appointment: any) => ({
      ...appointment,
      learnerName: learnerName(portalData, appointment.learnerId),
    })),
    accessQueue: accessQueue,
  };
}

export function buildAnalyticsSnapshot(
  portalData: PortalData,
  operationsData: OperationsData,
  users: UserSummary[],
) {
  const requisitions = computeRequisitionOverview(operationsData);
  const admissions = portalData.applications.forms.flatMap(
    (form: any) => form.submissions || [],
  );
  const ticketsResolved = operationsData.tickets.filter(
    (item) => item.status === "resolved",
  ).length;
  const totalRevenue = operationsData.store.orders.reduce(
    (sum, order) => sum + Number(order.totalAmount || 0),
    0,
  );

  const totalFees = portalData.parent.fees.reduce(
    (sum: number, fee: any) => sum + Number(fee.paidAmount || 0),
    0,
  ) + portalData.hostel.charges.reduce(
    (sum: number, charge: any) => sum + Number(charge.paidAmount || 0),
    0,
  );

  return {
    rangeLabel: "Operational year to date",
    kpis: [
      {
        label: "Total Revenue",
        value: `R ${totalRevenue.toLocaleString("en-ZA", {
          minimumFractionDigits: 2,
        })}`,
        change: `${operationsData.store.orders.length} orders`,
      },
      {
        label: "Fees Collected",
        value: `R ${totalFees.toLocaleString("en-ZA", {
          minimumFractionDigits: 2,
        })}`,
        change: `${portalData.parent.fees.length + portalData.hostel.charges.length} billing records`,
      },
      {
        label: "Tickets Resolved",
        value: String(ticketsResolved),
        change: `${operationsData.tickets.length} total tickets`,
      },
      {
        label: "New Enrolments",
        value: String(portalData.learners.length),
        change: `${users.length} total users`,
      },
    ],
    revenueTrend: buildRevenueSeries(operationsData),
    feeTrend: buildFeeSeries(portalData),
    ticketBreakdown: buildTicketBreakdown(operationsData),
    admissionsFunnel: buildAdmissionsFunnel(admissions),
    spendByDepartment: requisitions.byDepartment,
  };
}

export function buildBoardsData(
  portalData: PortalData,
  operationsData: OperationsData,
) {
  const boards = portalData.boards || [];
  return boards.map((board: any) => ({
    ...board,
    cards: board.columns.reduce(
      (sum: number, column: any) => sum + (column.cards || []).length,
      0,
    ),
    members: Array.from(
      new Set(
        board.columns.flatMap((column: any) =>
          (column.cards || []).map((card: any) => card.assignee),
        ),
      ),
    ).length,
    linkedMetrics:
      board.slug === "procurement"
        ? { pendingApprovals: computeRequisitionOverview(operationsData).pendingApprovals }
        : board.slug === "discipline"
          ? { awaitingAcknowledgement: buildDisciplineOverview(portalData).stats.awaitingAcknowledgement }
          : null,
  }));
}

export function createDefaultBoards(portalData: PortalData) {
  const requisitions = portalData.teacher.dashboard.requisitions || [];

  return [
    {
      id: "board-procurement",
      name: "Procurement Workflow",
      slug: "procurement",
      color: "#2563eb",
      columns: [
        {
          id: "board-procurement-backlog",
          title: "Backlog",
          color: "#64748b",
          cards: [
            {
              id: "card-procurement-1",
              title: "Review science lab starter kits",
              priority: "high",
              assignee: "Sarah Khumalo",
              tags: ["Procurement", "Approval"],
              comments: 2,
              attachments: 1,
              dueDate: "2026-08-05",
              description:
                "Validate supplier pricing, budget code, and turnaround for the pending science requisition.",
              activity: [
                {
                  id: "card-procurement-1-activity-1",
                  author: "Sarah Khumalo",
                  avatar: initials("Sarah Khumalo"),
                  text: "Budget check requested from finance.",
                  time: "Today",
                },
              ],
            },
          ],
        },
        {
          id: "board-procurement-review",
          title: "In Review",
          color: "#f59e0b",
          cards: [
            {
              id: "card-procurement-2",
              title: "Approve uniform replenishment delivery",
              priority: "medium",
              assignee: "Assigned Teacher",
              tags: ["Uniform", "Receiving"],
              comments: 1,
              attachments: 0,
              dueDate: "2026-08-02",
              description:
                "Confirm expected delivery date and receiving plan for the blazer replenishment order.",
              activity: [
                {
                  id: "card-procurement-2-activity-1",
                  author: "Assigned Teacher",
                  avatar: initials("Assigned Teacher"),
                  text: "Receiving team prepared for collection and stock intake.",
                  time: "Yesterday",
                },
              ],
            },
          ],
        },
        {
          id: "board-procurement-done",
          title: "Done",
          color: "#16a34a",
          cards: requisitions.slice(0, 1).map((item: any) => ({
            id: `card-requisition-${item.id}`,
            title: item.title,
            priority: String(item.priority || "medium").toLowerCase(),
            assignee: item.createdBy?.name || item.createdBy?.email || "POPIN LMS",
            tags: [item.department || "General"],
            comments: item.approvals?.length || 0,
            attachments: item.items?.length || 0,
            dueDate: item.requisition?.requiredDate || item.createdAt.slice(0, 10),
            description: item.description || "Workflow item linked from the requisitions module.",
            activity: [
              {
                id: `card-requisition-activity-${item.id}`,
                author: item.createdBy?.name || item.createdBy?.email || "POPIN LMS",
                avatar: initials(item.createdBy?.name || item.createdBy?.email || "PL"),
                text: `Created requisition ${item.reference}.`,
                time: new Date(item.createdAt).toLocaleDateString("en-ZA"),
              },
            ],
          })),
        },
      ],
    },
    {
      id: "board-parent",
      name: "Parent & Student Follow-up",
      slug: "parent-student",
      color: "#0f766e",
      columns: [
        {
          id: "board-parent-open",
          title: "Open",
          color: "#2563eb",
          cards: [
            {
              id: "card-parent-1",
              title: "Acknowledge learner conduct follow-up",
              priority: "high",
              assignee: "Parent Representative",
              tags: ["Parent Portal", "Discipline"],
              comments: 1,
              attachments: 0,
              dueDate: "2026-08-04",
              description:
                "Monitor acknowledgements and follow-up actions for conduct records visible to parents.",
              activity: [
                {
                  id: "card-parent-1-activity-1",
                  author: "POPIN LMS",
                  avatar: "PL",
                  text: "Parent acknowledgement request delivered.",
                  time: "Today",
                },
              ],
            },
          ],
        },
        {
          id: "board-parent-progress",
          title: "In Progress",
          color: "#f59e0b",
          cards: [
            {
              id: "card-parent-2",
              title: "Hostel concern review",
              priority: "medium",
              assignee: "Operations Admin",
              tags: ["Hostel", "Support"],
              comments: 0,
              attachments: 0,
              dueDate: "2026-08-06",
              description:
                "Track new parent hostel requests from the family portal and route them to facilities.",
              activity: [],
            },
          ],
        },
        {
          id: "board-parent-done",
          title: "Completed",
          color: "#16a34a",
          cards: [],
        },
      ],
    },
  ];
}

function buildRevenueSeries(operationsData: OperationsData) {
  const months = buildRecentMonthKeys();
  return months.map((month) => {
    const monthOrders = operationsData.store.orders.filter(
      (order) => new Date(order.createdAt).getMonth() === month.getMonth(),
    );
    return {
      month: monthLabel(month),
      revenue: monthOrders.reduce(
        (sum, order) => sum + Number(order.totalAmount || 0),
        0,
      ),
      fees: 0,
    };
  });
}

function buildFeeSeries(portalData: PortalData) {
  const months = buildRecentMonthKeys();
  return months.map((month) => ({
    month: monthLabel(month),
    fees:
      portalData.parent.fees.reduce(
        (sum: number, fee: any) => sum + Number(fee.paidAmount || 0),
        0,
      ) / months.length,
  }));
}

function buildTicketBreakdown(operationsData: OperationsData) {
  const colorMap: Record<string, string> = {
    it: "#2563eb",
    maintenance: "#f59e0b",
    supplies: "#10b981",
    finance: "#8b5cf6",
    other: "#64748b",
  };
  const counts = new Map<string, number>();
  for (const ticket of operationsData.tickets) {
    counts.set(ticket.category, (counts.get(ticket.category) || 0) + 1);
  }
  return Array.from(counts.entries()).map(([name, value]) => ({
    name,
    value,
    color: colorMap[name.toLowerCase()] || colorMap.other,
  }));
}

function buildAdmissionsFunnel(submissions: any[]) {
  const statusMap = [
    ["Enquiries", submissions.length + 2],
    ["Applications", submissions.length],
    [
      "Assessments",
      submissions.filter((item: any) =>
        ["IN_REVIEW", "ASSESSMENT", "INTERVIEW", "APPROVED"].includes(
          item.status,
        ),
      ).length || Math.max(submissions.length - 1, 0),
    ],
    [
      "Interviews",
      submissions.filter((item: any) =>
        ["INTERVIEW", "APPROVED"].includes(item.status),
      ).length || Math.max(submissions.length - 1, 0),
    ],
    [
      "Offers",
      submissions.filter((item: any) => item.status === "APPROVED").length,
    ],
    [
      "Enrolled",
      submissions.filter((item: any) => item.status === "ENROLLED").length,
    ],
  ];
  return statusMap.map(([stage, count]) => ({ stage, count }));
}

function buildRecentMonthKeys() {
  const now = new Date();
  return Array.from({ length: 6 }).map((_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
    return date;
  });
}

export function buildDefaultActivity(portalData: PortalData, operationsData: OperationsData) {
  const activity = [
    {
      id: "activity-1",
      user: "Sarah Khumalo",
      action: "approved workflow for",
      target: operationsData.requisitions[0]?.reference || "requisition queue",
      time: "Today",
      avatar: initials("Sarah Khumalo"),
    },
    {
      id: "activity-2",
      user: "Assigned Teacher",
      action: "published class work in",
      target: portalData.classes[0]?.name || "teacher portal",
      time: "Today",
      avatar: initials("Assigned Teacher"),
    },
    {
      id: "activity-3",
      user: "Parent Representative",
      action: "reviewed learner updates for",
      target: learnerName(portalData, portalData.learners[0]?.id || ""),
      time: "Yesterday",
      avatar: initials("Parent Representative"),
    },
  ];
  return activity;
}

export function buildDefaultNotifications(portalData: PortalData, operationsData: OperationsData) {
  return [
    {
      id: "notif-1",
      type: "approval",
      title: "Approval Required",
      message: `${computeRequisitionOverview(operationsData).pendingApprovals} requisition item(s) need review.`,
      time: "Now",
      read: false,
    },
    {
      id: "notif-2",
      type: "ticket",
      title: "Ticket Queue Active",
      message: `${operationsData.tickets.filter((item) => item.status !== "resolved").length} support ticket(s) remain open.`,
      time: "Today",
      read: false,
    },
    {
      id: "notif-3",
      type: "appointment",
      title: "Parent Follow-up",
      message: `${buildDisciplineOverview(portalData).stats.awaitingAcknowledgement} family acknowledgement(s) are waiting.`,
      time: "Today",
      read: true,
    },
  ];
}

function initials(value: string) {
  return value
    .split(/\s+/)
    .map((part) => part[0] || "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
