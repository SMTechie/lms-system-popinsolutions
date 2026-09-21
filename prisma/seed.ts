import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { defaultOperationsData } from "../src/server/operations";
import { defaultPortalData } from "../src/server/portalData";

const prisma = new PrismaClient();

function createCleanPortalData(input: {
  parentEmail: string;
  parentName: string;
  teacherEmail: string;
  teacherName: string;
}) {
  const data = defaultPortalData();

  data.parent.guardianEmail = input.parentEmail;
  data.parent.guardianName = input.parentName;
  data.classes = data.classes.map((schoolClass: any, index: number) => ({
    ...schoolClass,
    teacherName: index === 0 ? "Thabo Mthembu" : "Lerato Naidoo",
    teacherEmail: index === 0 ? "teacher@popin.school" : "teacher.naidoo@popin.school",
  }));

  data.applications.forms = (data.applications.forms || []).map((form: any) => ({
    ...form,
    submissions: [],
  }));

  data.hostel = {
    qrPasses: [],
    buildings: [],
    applications: [],
    allocations: [],
    rollCalls: [],
    scanEvents: [],
    scanExceptions: [],
    meals: [],
    incidents: [],
    maintenance: [],
    visitors: [],
    charges: [],
    notices: [],
  };

  data.disciplinary = { records: [] };
  data.communications = {
    audiences: [],
    campaigns: [],
    resources: [],
    calendar: [],
    templates: [],
    deliveryLogs: [],
  };
  data.activity = [];
  data.notifications = [];
  data.boards = [];
  data.teacherAssistant = { assessments: [] };

  data.identityProviders = (data.identityProviders || []).map((provider: any) => ({
    ...provider,
    lastSyncAt: null,
    lastError: "",
    syncLogs: [],
  }));

  return data;
}

function createCleanOperationsData() {
  const data = defaultOperationsData();

  data.inventory.items = [];
  data.inventory.balances = [];
  data.inventory.movements = [];
  data.inventory.requests = [];
  data.inventory.transfers = [];
  data.inventory.adjustments = [];
  data.inventory.counts = [];
  data.requisitions = [];
  data.store.products = [];
  data.store.orders = [];
  data.store.stockHistory = {};
  data.store.salesHistory = {};
  data.tickets = [];

  return data;
}

async function main() {
  const schoolName = process.env.SEED_SCHOOL_NAME || "POPIN School";
  const schoolMotto = process.env.SEED_SCHOOL_MOTTO || "Connected school operations";
  const adminEmail = process.env.SEED_ADMIN_EMAIL || "admin@popin.school";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || "ChangeMe123!";
  const adminName = process.env.SEED_ADMIN_NAME || "System Administrator";
  const parentEmail = process.env.SEED_PARENT_EMAIL || "parent@popin.school";
  const parentPassword = process.env.SEED_PARENT_PASSWORD || "ChangeMe123!";
  const parentName = process.env.SEED_PARENT_NAME || "Guardian Account";
  const teacherEmail = process.env.SEED_TEACHER_EMAIL || "teacher@popin.school";
  const teacherPassword = process.env.SEED_TEACHER_PASSWORD || "ChangeMe123!";
  const teacherName = process.env.SEED_TEACHER_NAME || "Teacher Account";
  const secondTeacherEmail = process.env.SEED_SECOND_TEACHER_EMAIL || "teacher.naidoo@popin.school";
  const secondTeacherPassword = process.env.SEED_SECOND_TEACHER_PASSWORD || "ChangeMe123!";
  const secondTeacherName = process.env.SEED_SECOND_TEACHER_NAME || "Lerato Naidoo";
  const studentPassword = process.env.SEED_STUDENT_PASSWORD || "ChangeMe123!";
  const passwordHash = await bcrypt.hash(adminPassword, 10);
  const parentPasswordHash = await bcrypt.hash(parentPassword, 10);
  const teacherPasswordHash = await bcrypt.hash(teacherPassword, 10);
  const seededAt = new Date().toISOString();

  await prisma.auditLog.deleteMany();
  await prisma.setting.deleteMany();
  await prisma.user.deleteMany();

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      name: adminName,
      role: "ADMIN",
      passwordHash
    },
    create: {
      email: adminEmail,
      name: adminName,
      role: "ADMIN",
      passwordHash
    }
  });

  const secondTeacherPasswordHash = await bcrypt.hash(secondTeacherPassword, 10);
  await prisma.user.upsert({
    where: { email: secondTeacherEmail },
    update: { name: secondTeacherName, role: "TEACHER", passwordHash: secondTeacherPasswordHash },
    create: { email: secondTeacherEmail, name: secondTeacherName, role: "TEACHER", passwordHash: secondTeacherPasswordHash }
  });

  for (const student of [
    { email: "ari.khumalo@school.co.za", name: "Ari Khumalo" },
    { email: "mila.khumalo@school.co.za", name: "Mila Khumalo" },
  ]) {
    await prisma.user.upsert({
      where: { email: student.email },
      update: { name: student.name, role: "STUDENT", passwordHash: await bcrypt.hash(studentPassword, 10) },
      create: { email: student.email, name: student.name, role: "STUDENT", passwordHash: await bcrypt.hash(studentPassword, 10) }
    });
  }

  await prisma.user.upsert({
    where: { email: parentEmail },
    update: {
      name: parentName,
      role: "PARENT",
      passwordHash: parentPasswordHash
    },
    create: {
      email: parentEmail,
      name: parentName,
      role: "PARENT",
      passwordHash: parentPasswordHash
    }
  });

  await prisma.user.upsert({
    where: { email: teacherEmail },
    update: {
      name: teacherName,
      role: "TEACHER",
      passwordHash: teacherPasswordHash
    },
    create: {
      email: teacherEmail,
      name: teacherName,
      role: "TEACHER",
      passwordHash: teacherPasswordHash
    }
  });

  await prisma.setting.upsert({
    where: { key: "branding" },
    update: {
      value: {
        schoolName,
        schoolMotto,
        primaryColor: "#0f172a",
        accentColor: "#2563eb",
        fontFamily: "Inter",
        email: adminEmail,
        phone: "+27 11 000 0000",
        website: "https://popin.school",
        lastUpdatedAt: seededAt
      }
    },
    create: {
      key: "branding",
      value: {
        schoolName,
        schoolMotto,
        primaryColor: "#0f172a",
        accentColor: "#2563eb",
        fontFamily: "Inter",
        email: adminEmail,
        phone: "+27 11 000 0000",
        website: "https://popin.school",
        lastUpdatedAt: seededAt
      }
    }
  });

  const systemSettings = [
    ["school-profile", { schoolName, emisNumber: "", timezone: "Africa/Johannesburg", academicYear: 2026 }],
    ["users", { defaultRole: "Teacher", passwordExpiryDays: 90, archiveAlumni: true }],
    ["roles-permissions", { inheritPermissions: true, temporaryAccessHours: 8, requireApproval: true }],
    ["authentication", { mfaRequired: false, sessionTimeoutMinutes: 60, allowedDomains: "school.co.za,popin.school", ssoProvider: "None" }],
    ["email-services", { provider: "Resend", fromAddress: process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev", rateLimitPerMinute: 60, retryFailures: true }],
    ["incoming-mail", { enabled: true, pollIntervalMinutes: 5, spamFiltering: true, attachmentProcessing: true }],
    ["admissions", { waitlists: true, interviews: true, documentVerification: true, placementTesting: false }],
    ["academic-settings", { termCount: 4, promotionMark: 50, curriculum: "CAPS" }],
    ["parent-portal", { homeworkVisible: true, feeVisibility: true, teacherMessaging: true, calendarSync: true }],
    ["student-portal", { assignmentSubmission: true, resultsVisibility: true, resourceDownloads: true }],
    ["timetable", { schoolDayStarts: "07:30", schoolDayEnds: "15:00", preventConflicts: true, allowSubstitutions: true }],
    ["attendance", { lateAfterMinutes: 10, notifyParents: true, gpsVerification: false, qrAttendance: true }],
    ["assessments", { gradingSystem: "Percentage", passMark: 50, moderationRequired: true, parentPublish: true }],
    ["communication", { defaultChannel: "Email", quietHoursStart: "20:00", approvalRequired: true }],
    ["uniform-store", { onlineOrdering: true, defaultCollection: "Uniform Room", returnWindowDays: 14, autoProcurement: true }],
    ["inventory", { lowStockAlerts: true, adjustmentApproval: true, barcodeFormat: "Code 128", valuationMethod: "Weighted average" }],
    ["supply-chain", { rfqThreshold: 10000, principalApprovalThreshold: 50000, minimumQuotes: 3, preferredSuppliers: true }],
    ["finance", { currency: "ZAR", vatRate: 15, budgetWarnings: true, restrictReportsForDebt: false }],
    ["licensing", { plan: "Enterprise", seatLimit: 250, storageGb: 100, expiryDate: "2027-06-30" }],
    ["integrations", { microsoft365: false, googleWorkspace: false, accountingProvider: "None", storageProvider: "Local" }],
    ["automation", { enabled: true, dailyTeacherDigest: true, monthlyInvoices: false, archiveAuditDays: 2555 }],
    ["workflow-rules", { admissionOnboarding: true, lowStockProcurement: true, feeEscalation: true }],
    ["notifications", { email: true, sms: false, push: true, whatsapp: false }],
    ["security", { securityScoreTarget: 80, trustedDevices: true, ipRestrictions: "", apiKeyRotationDays: 90 }],
    ["audit-logs", { retentionDays: 2555, captureDevice: true, exportEnabled: true }],
    ["backup-recovery", { schedule: "Daily", retentionCount: 30, provider: "Azure", encryption: true }],
    ["developer-api", { enabled: true, rateLimit: 120, webhookRetries: 5, requestLogging: true }]
  ] as const;

  for (const [key, value] of systemSettings) {
    await prisma.setting.upsert({
      where: { key },
      update: { value: { ...value, lastUpdatedAt: seededAt } },
      create: { key, value: { ...value, lastUpdatedAt: seededAt } }
    });
  }

  await prisma.setting.upsert({
    where: { key: "site" },
    update: {
      value: {
        heroTitle: schoolName,
        heroSubtitle: "School operations, portals, admissions, hostel and communication in one workspace.",
        contactEmail: adminEmail,
        contactPhone: "+27 11 000 0000",
        campusCity: "",
        stats: [
          { label: "Applications", value: 0 },
          { label: "Open tickets", value: 0 },
          { label: "Low stock items", value: 0 }
        ]
      }
    },
    create: {
      key: "site",
      value: {
        heroTitle: schoolName,
        heroSubtitle: "School operations, portals, admissions, hostel and communication in one workspace.",
        contactEmail: adminEmail,
        contactPhone: "+27 11 000 0000",
        campusCity: "",
        stats: [
          { label: "Applications", value: 0 },
          { label: "Open tickets", value: 0 },
          { label: "Low stock items", value: 0 }
        ]
      }
    }
  });

  await prisma.setting.upsert({
    where: { key: "marketing-integration" },
    update: {
      value: {
        websiteBaseUrl: "https://www.popin.school",
        webhookTargetUrl: "https://www.popin.school/api/popin/webhooks",
        publicApplyBaseUrl: "https://www.popin.school/apply",
        catalogEndpoint: "/api/public/site",
        callbackEndpoint: "/api/public/branding",
        syncMode: "api_pull",
        defaultCatalogVisibility: "universal",
        environment: "development",
        requestSigningMode: "hmac",
        requestTimeoutSeconds: 15,
        customHeaders: {
          "X-Source": "popin-lms"
        },
        retryPolicy: {
          attempts: 5,
          delays: [60, 300, 900]
        },
        shopApiEnabled: true,
        webhookEnabled: true,
        applicationFormApiEnabled: true,
        lastCatalogSyncAt: new Date().toISOString()
      }
    },
    create: {
      key: "marketing-integration",
      value: {
        websiteBaseUrl: "https://www.popin.school",
        webhookTargetUrl: "https://www.popin.school/api/popin/webhooks",
        publicApplyBaseUrl: "https://www.popin.school/apply",
        catalogEndpoint: "/api/public/site",
        callbackEndpoint: "/api/public/branding",
        syncMode: "api_pull",
        defaultCatalogVisibility: "universal",
        environment: "development",
        requestSigningMode: "hmac",
        requestTimeoutSeconds: 15,
        customHeaders: {
          "X-Source": "popin-lms"
        },
        retryPolicy: {
          attempts: 5,
          delays: [60, 300, 900]
        },
        shopApiEnabled: true,
        webhookEnabled: true,
        applicationFormApiEnabled: true,
        lastCatalogSyncAt: new Date().toISOString()
      }
    }
  });

  await prisma.setting.upsert({
    where: { key: "operations" },
    update: {
      value: createCleanOperationsData()
    },
    create: {
      key: "operations",
      value: createCleanOperationsData()
    }
  });

  await prisma.setting.upsert({
    where: { key: "portal-data" },
    update: {
      value: createCleanPortalData({
        parentEmail,
        parentName,
        teacherEmail,
        teacherName,
      })
    },
    create: {
      key: "portal-data",
      value: createCleanPortalData({
        parentEmail,
        parentName,
        teacherEmail,
        teacherName,
      })
    }
  });

  await prisma.auditLog.create({
    data: {
      action: "SEED",
      entity: "System",
      entityId: "bootstrap",
      actorId: adminEmail,
      metadata: {
        message: "Initial Neon seed completed"
      }
    }
  });

  console.log("Seed complete", {
    adminUser: {
      email: adminEmail,
      password: adminPassword
    },
    parentUser: {
      email: parentEmail,
      password: parentPassword
    },
    teacherUser: {
      email: teacherEmail,
      password: teacherPassword
    }
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
