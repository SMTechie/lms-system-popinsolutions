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

function dateAt(end: Date, daysAgo: number, hour = 8) {
  const value = new Date(end);
  value.setUTCDate(value.getUTCDate() - daysAgo);
  value.setUTCHours(hour, 0, 0, 0);
  return value.toISOString();
}

function populateThreeMonthHistory(portal: any, operations: any, end: Date) {
  const subjects = ["Mathematics", "English", "Natural Sciences", "Life Skills", "Creative Arts"];
  const extraLearners = [
    ["Lebo", "Mokoena", "POP-7002", "grade-8", "class-8a"], ["Thandi", "Dlamini", "POP-7003", "grade-8", "class-8a"],
    ["Sipho", "Nkosi", "POP-7004", "grade-8", "class-8a"], ["Zanele", "Maseko", "POP-7005", "grade-9", "class-9b"],
    ["Neo", "Molefe", "POP-7006", "grade-9", "class-9b"], ["Amara", "Naidoo", "POP-7007", "grade-9", "class-9b"],
    ["Kea", "Pillay", "POP-7008", "grade-8", "class-8a"], ["Daniel", "Jacobs", "POP-7009", "grade-9", "class-9b"],
  ];
  for (const [index, [firstName, lastName, studentNumber, gradeId, classId]] of extraLearners.entries()) {
    const learnerId = `learner-seeded-${index + 1}`;
    const parentEmail = `parent.${String(firstName).toLowerCase()}@school.co.za`;
    const learner = {
      id: learnerId, firstName, lastName, preferredName: firstName, dateOfBirth: `201${index % 4}-0${(index % 8) + 1}-1${index + 1}`,
      identityNumber: `201${index % 4}${String(index + 1).padStart(2, "0")}000000`, email: `${String(firstName).toLowerCase()}.${String(lastName).toLowerCase()}@school.co.za`, phone: "",
      studentNumber, gradeId, classId, status: index === 7 ? "ARCHIVED" : "ACTIVE", medicalNotes: index === 2 ? "Asthma action plan on file." : "",
      guardians: [{ id: `guardian-link-seeded-${index + 1}`, learnerId, guardian: { id: `guardian-seeded-${index + 1}`, email: parentEmail, name: `${firstName} Parent` }, relationshipType: "Parent", status: "VERIFIED", isPrimary: true, viewFees: true, payFees: true, viewReports: true, viewHomework: true, receiveAnnouncements: true, messageTeachers: true, authorisePickup: true, submitApplications: true, bookAppointments: true, viewHostel: true, applyHostel: true, viewHostelBilling: true, submitHostelConcerns: true, viewHostelMovement: true }],
      classHistory: [{ id: `history-seeded-${index + 1}`, changedAt: dateAt(end, 78), reason: "Term placement confirmed" }],
    };
    portal.learners.push(learner);
    portal.parent.fees.push({ id: `fee-seeded-${index + 1}`, learnerId, term: "Term 3", category: "Tuition", amount: 9800 + index * 250, paidAmount: index % 3 === 0 ? 9800 + index * 250 : index % 3 === 1 ? 4900 : 0, dueDate: dateAt(end, 38, 12).slice(0, 10), reference: `INV-2026-${studentNumber}`, status: index % 3 === 0 ? "PAID" : index % 3 === 1 ? "PARTIAL" : "UNPAID" });
    portal.parent.payments.push({ id: `payment-seeded-${index + 1}`, learnerId, feeId: `fee-seeded-${index + 1}`, amount: 4900 + index * 100, method: index % 2 ? "EFT" : "CARD", reference: `PAY-${7000 + index}`, paidAt: dateAt(end, 12 + index, 10), status: index % 4 === 0 ? "PENDING_VERIFICATION" : "VERIFIED" });
    for (let day = 0; day < 18; day += 1) portal.parent.attendance.push({ id: `attendance-seeded-${index}-${day}`, learnerId, date: dateAt(end, 4 + day, 7).slice(0, 10), status: day === index % 6 ? "LATE" : day === 7 && index % 4 === 0 ? "ABSENT" : "PRESENT", note: day === index % 6 ? "Late arrival recorded." : "", capturedBy: index % 2 ? "Lerato Naidoo" : "Thabo Mthembu", submittedAt: dateAt(end, 4 + day, 7) });
    portal.parent.reports.push({ id: `report-seeded-${index + 1}`, learnerId, term: "Term 2", average: 61 + index * 3, publishedAt: dateAt(end, 45, 12), teacherComment: index % 2 ? "Good improvement and consistent participation." : "Please continue with the weekly revision routine.", subjects: subjects.slice(0, 3).map((name, subjectIndex) => ({ name, mark: 57 + index * 2 + subjectIndex * 4, grade: index > 4 ? "B" : "C" })) });
    portal.parent.notifications.push({ id: `parent-notification-seeded-${index + 1}`, learnerId, type: index % 2 ? "attendance" : "finance", title: index % 2 ? "Attendance update" : "Fee reminder", message: index % 2 ? `${firstName} had a recent attendance update.` : `The Term 3 account for ${firstName} is ready to review.`, createdAt: dateAt(end, 3 + index), readAt: index % 3 === 0 ? dateAt(end, 1) : null });
    if (index < 5) portal.parent.messages.push({ id: `thread-seeded-${index + 1}`, learnerId, subject: index % 2 ? "Homework support" : "Attendance question", status: index % 3 === 0 ? "CLOSED" : "OPEN", updatedAt: dateAt(end, 6 + index, 15), messages: [{ id: `message-seeded-${index + 1}`, authorRole: "PARENT", authorName: `${firstName} Parent`, message: "Please can you share an update for this learner?", createdAt: dateAt(end, 7 + index, 14) }, { id: `reply-seeded-${index + 1}`, authorRole: "TEACHER", authorName: "Assigned Teacher", message: "Thank you. We have added this to the class follow-up list.", createdAt: dateAt(end, 6 + index, 15) }] });
    portal.parent.tickets.push({ id: `parent-ticket-seeded-${index + 1}`, learnerId, title: index % 2 ? "Transport query" : "Fee statement request", category: index % 2 ? "Transport" : "Finance", priority: index % 3 === 0 ? "HIGH" : "MEDIUM", status: index % 3 === 0 ? "OPEN" : "RESOLVED", description: "Parent requested an update from the school office.", createdAt: dateAt(end, 15 + index, 11), replies: [] });
  }
  const sectionDefinitions = [
    ["class-8b", "8B", "grade-8", "B13", "Thabo Mthembu", "teacher.mthembu@popin.school"], ["class-8c", "8C", "grade-8", "B14", "Daniel Jacobs", "teacher.jacobs@popin.school"],
    ["class-9c", "9C", "grade-9", "C09", "Lerato Naidoo", "teacher.naidoo@popin.school"], ["class-9d", "9D", "grade-9", "C10", "Naledi Molefe", "teacher.naledi@popin.school"],
  ];
  for (const [index, [id, name, gradeId, room, teacherName, teacherEmail]] of sectionDefinitions.entries()) {
    portal.classes.push({ id, name, gradeId, room, grade: portal.grades.find((grade: any) => grade.id === gradeId), teacherName, teacherEmail, learners: [], assignments: subjects.slice(0, 4).map((subject) => ({ subject })), timetable: ["Mathematics", "English", "Natural Sciences", "Life Skills", "Creative Arts"].map((subject, day) => ({ id: `tt-extra-${index}-${day}`, day: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"][day], startsAt: "08:00", endsAt: "08:45", subject, room, class: { name, room } })), workItems: subjects.slice(0, 4).flatMap((subject, homeworkIndex) => [{ id: `homework-extra-${index}-${homeworkIndex}`, type: "HOMEWORK", title: `${subject} weekly practice`, status: homeworkIndex === 3 ? "DRAFT" : "PUBLISHED", dueAt: dateAt(end, 2 + homeworkIndex * 6, 14), instructions: `Complete the ${subject.toLowerCase()} activities and submit before the due date.`, visibleToParents: homeworkIndex !== 3 }, { id: `lesson-extra-${index}-${homeworkIndex}`, type: "LESSON_PLAN", title: `${subject} lesson plan`, status: "PUBLISHED", instructions: `Weekly ${subject.toLowerCase()} lesson plan for ${name}.`, visibleToParents: false }]) });
  }
  const moreLearners = Array.from({ length: 30 }, (_, index) => {
    const firstNames = ["Ayesha", "Bongani", "Cebo", "Dineo", "Elijah", "Faith", "Gugu", "Hlumelo", "Ivy", "Jason", "Kamo", "Lihle", "Mpho", "Nandi", "Ofentse", "Palesa", "Qhawe", "Rethabile", "Sanele", "Tebogo", "Ulwazi", "Vuyo", "Wandile", "Xolani", "Yanga", "Zinzi", "Andile", "Busisiwe", "Caitlin", "Dumisani"];
    const lastNames = ["Mabena", "Mthethwa", "Pillay", "Mahlangu", "Botha", "Mokoena"];
    const firstName = firstNames[index]; const lastName = lastNames[index % lastNames.length]; const gradeId = index % 2 ? "grade-9" : "grade-8"; const classId = ["class-8a", "class-8b", "class-8c", "class-9b", "class-9c", "class-9d"][index % 6]; const learnerId = `learner-additional-${index + 1}`; const parentEmail = `parent.${String(firstName).toLowerCase()}.${String(lastName).toLowerCase()}@school.co.za`;
    const learner = { id: learnerId, firstName, lastName, preferredName: firstName, dateOfBirth: `201${index % 5}-0${(index % 8) + 1}-${String((index % 20) + 1).padStart(2, "0")}`, identityNumber: `201${index % 5}${String(index + 10).padStart(3, "0")}000000`, email: `${String(firstName).toLowerCase()}.${String(lastName).toLowerCase()}@school.co.za`, phone: "", studentNumber: `POP-${String(7010 + index).padStart(4, "0")}`, gradeId, classId, status: "ACTIVE", medicalNotes: index % 11 === 0 ? "Medical information held confidentially by the office." : "", guardians: [{ id: `guardian-link-additional-${index + 1}`, learnerId, guardian: { id: `guardian-additional-${index + 1}`, email: parentEmail, name: `${firstName} Parent` }, relationshipType: "Parent", status: "VERIFIED", isPrimary: true, viewFees: true, payFees: true, viewReports: true, viewHomework: true, receiveAnnouncements: true, messageTeachers: true, authorisePickup: true, submitApplications: true, bookAppointments: true, viewHostel: true, applyHostel: true, viewHostelBilling: true, submitHostelConcerns: true, viewHostelMovement: true }], classHistory: [{ id: `history-additional-${index + 1}`, changedAt: dateAt(end, 80), reason: "Academic year placement" }] };
    portal.learners.push(learner);
    const classRecord = portal.classes.find((schoolClass: any) => schoolClass.id === classId); if (classRecord) classRecord.learners.push(learner);
    portal.parent.attendance.push(...Array.from({ length: 12 }, (_, day) => ({ id: `attendance-additional-${index}-${day}`, learnerId, date: dateAt(end, day + 1 + index % 4, 7).slice(0, 10), status: day === index % 7 ? "LATE" : "PRESENT", note: day === index % 7 ? "Late arrival recorded." : "", capturedBy: classRecord?.teacherName || "Assigned Teacher", submittedAt: dateAt(end, day + 1 + index % 4, 7) })));
    portal.parent.fees.push({ id: `fee-additional-${index + 1}`, learnerId, term: "Term 3", category: "Tuition", amount: 9800, paidAmount: index % 4 === 0 ? 9800 : index % 4 === 1 ? 4900 : 0, dueDate: dateAt(end, 32, 12).slice(0, 10), reference: `INV-ADD-${index + 1}`, status: index % 4 === 0 ? "PAID" : index % 4 === 1 ? "PARTIAL" : "UNPAID" });
    portal.parent.reports.push({ id: `report-additional-${index + 1}`, learnerId, term: "Term 2", average: 58 + (index % 35), publishedAt: dateAt(end, 45, 12), teacherComment: "Progress reviewed during the term reporting cycle.", subjects: subjects.slice(0, 4).map((name, subjectIndex) => ({ name, mark: 52 + ((index + subjectIndex * 5) % 40), grade: "B" })) });
    return { parentEmail, parentName: `${firstName} Parent`, studentEmail: learner.email, studentName: `${firstName} ${lastName}` };
  });
  portal.teacher.dashboard.attendanceTasks = portal.classes.map((schoolClass: any) => ({ id: `attendance-task-${schoolClass.id}`, classId: schoolClass.id, title: schoolClass.name }));
  portal.teacher.dashboard.today = portal.classes.flatMap((schoolClass: any) => schoolClass.timetable || []).slice(0, 12);
  portal.teacher.dashboard.homeworkDueToday = portal.classes.flatMap((schoolClass: any) => schoolClass.workItems || []).filter((item: any) => item.type === "HOMEWORK").slice(0, 12);
  portal.applications.forms[0].submissions.push(...Array.from({ length: 9 }, (_, index) => ({ id: `application-seeded-${index + 1}`, submissionReference: `APP-2026-${String(index + 1).padStart(4, "0")}`, submittedAt: dateAt(end, 8 + index * 7, 9), status: ["SUBMITTED", "UNDER_REVIEW", "ACCEPTED", "WAITLISTED"][index % 4], submissionChannel: index % 2 ? "website" : "admin", data: { student_name: `Applicant ${index + 1}`, guardian_name: `Family ${index + 1}`, academic_year: 2026 } })));
  portal.disciplinary.records.push(...Array.from({ length: 7 }, (_, index) => ({ id: `discipline-seeded-${index + 1}`, learnerId: portal.learners[index % portal.learners.length].id, title: ["Late arrival", "Uniform reminder", "Positive conduct follow-up"][index % 3], category: "Conduct", severity: index % 4 === 0 ? "HIGH" : "LOW", status: index % 3 === 0 ? "OPEN" : "RESOLVED", description: "Recorded during normal daily school operations.", actionTaken: index % 3 === 0 ? "Parent acknowledgement requested." : "Discussed with learner.", occurredAt: dateAt(end, 5 + index * 8, 10), parentVisible: true, requiresAcknowledgement: index % 3 === 0, parentAcknowledgedAt: index % 3 === 0 ? null : dateAt(end, 2 + index, 12) })));
  portal.hostel.applications.push(...Array.from({ length: 5 }, (_, index) => ({ id: `hostel-app-seeded-${index + 1}`, learnerId: portal.learners[(index + 1) % portal.learners.length].id, academicYear: 2026, preferredBuildingId: "hostel-building-1", status: ["PENDING", "APPROVED", "WAITLISTED"][index % 3], submittedAt: dateAt(end, 12 + index * 11, 9), boardingType: index % 2 ? "WEEKLY" : "FULL" })));
  portal.hostel.rollCalls.push(...Array.from({ length: 15 }, (_, index) => ({ id: `rollcall-seeded-${index + 1}`, date: dateAt(end, index + 1, 6).slice(0, 10), buildingId: "hostel-building-1", status: "COMPLETED", presentCount: 18 + (index % 4), absentCount: index % 3, capturedBy: "Hostel Supervisor" })));
  portal.hostel.meals.push(...Array.from({ length: 12 }, (_, index) => ({ id: `meal-seeded-${index + 1}`, date: dateAt(end, index + 2, 12).slice(0, 10), meal: index % 2 ? "DINNER" : "LUNCH", servedCount: 20 + (index % 6), menu: index % 2 ? "Chicken and vegetables" : "Pasta and salad" })));
  portal.hostel.incidents.push({ id: "hostel-incident-seeded-1", learnerId: portal.learners[2].id, type: "WELLBEING", severity: "LOW", status: "RESOLVED", description: "Minor headache reported and parent notified.", occurredAt: dateAt(end, 19, 18), resolvedAt: dateAt(end, 18, 10) });
  portal.hostel.maintenance.push({ id: "hostel-maintenance-seeded-1", title: "Replace study-room light", source: "Hostel", buildingId: "hostel-building-1", priority: "LOW", status: "RESOLVED", category: "Facilities", description: "Light replaced after evening inspection.", createdAt: dateAt(end, 28, 11), resolvedAt: dateAt(end, 26, 14) });
  portal.hostel.charges.push(...Array.from({ length: 6 }, (_, index) => ({ id: `hostel-charge-seeded-${index + 1}`, learnerId: portal.learners[index % portal.learners.length].id, description: "Monthly hostel fee", billingPeriod: `2026-${String(6 + (index % 3)).padStart(2, "0")}`, amount: 2500, paidAmount: index % 3 === 0 ? 2500 : index % 3 === 1 ? 1250 : 0, dueDate: dateAt(end, 25 + index, 12).slice(0, 10), status: index % 3 === 0 ? "PAID" : index % 3 === 1 ? "PARTIAL" : "UNPAID" })));
  portal.communications.campaigns.push(...Array.from({ length: 8 }, (_, index) => ({ id: `campaign-seeded-${index + 1}`, name: ["Term newsletter", "Attendance reminder", "Sports day notice", "Fee reminder"][index % 4], channel: index % 2 ? "SMS" : "EMAIL", status: index % 4 === 0 ? "DRAFT" : "SENT", scheduledAt: dateAt(end, 7 + index * 9, 8), audience: index % 2 ? "Parents" : "All families", deliveryCount: 24 + index, deliveredCount: 22 + index, failedCount: index % 3 }))); 
  portal.communications.calendar.push(...Array.from({ length: 10 }, (_, index) => ({ id: `calendar-seeded-${index + 1}`, title: ["Staff briefing", "Parent meeting", "Sports practice", "School assembly"][index % 4], startsAt: dateAt(end, 2 + index * 5, 9), endsAt: dateAt(end, 2 + index * 5, 10), location: index % 2 ? "Hall" : "Main campus", audience: "School community" })));
  portal.teacherAssistant.assessments.push(...Array.from({ length: 8 }, (_, index) => ({ id: `assessment-seeded-${index + 1}`, name: `${subjects[index % subjects.length]} ${index % 2 ? "Quiz" : "Test"}`, subject: subjects[index % subjects.length], assessmentType: index % 2 ? "Quiz" : "Test", classIds: [index % 2 ? "class-9b" : "class-8a"], gradeId: index % 2 ? "grade-9" : "grade-8", totalMarks: 50, dueAt: dateAt(end, 4 + index * 10, 9), status: index < 5 ? "PUBLISHED" : "DRAFT", submissions: index < 5 ? portal.learners.slice(0, 4).map((learner: any, learnerIndex: number) => ({ learnerId: learner.id, score: 31 + learnerIndex * 4 + index, status: "MARKED" })) : [] })));
  portal.activity.push(...Array.from({ length: 30 }, (_, index) => ({ id: `activity-seeded-${index + 1}`, action: ["marked attendance", "published assessment", "updated a parent message", "received stock", "reviewed admission"][index % 5], target: `Daily school operation ${index + 1}`, actor: ["Thabo Mthembu", "Lerato Naidoo", "System Administrator"][index % 3], createdAt: dateAt(end, index * 3, 9) })));
  portal.notifications.push(...Array.from({ length: 15 }, (_, index) => ({ id: `notification-seeded-${index + 1}`, title: ["Attendance register complete", "New application received", "Low stock alert", "Parent message received"][index % 4], message: "This activity was recorded during the three-month operating period.", createdAt: dateAt(end, index * 4, 10), read: index % 3 === 0 })));

  operations.inventory.items.push(...[
    ["A4 Copy Paper", "INV-PAPER", "CONSUMABLE", "unit-box", 18], ["Whiteboard Markers", "INV-MARKER", "CONSUMABLE", "unit-pack", 12], ["Grade 8 Blazer", "UNI-G8-BLZ", "STOCK", "unit-ea", 8], ["School Shirts", "UNI-SHIRT", "STOCK", "unit-ea", 15], ["Projector", "INV-PROJ", "ASSET", "unit-ea", 2], ["Cleaning Detergent", "CLN-DET", "CONSUMABLE", "unit-pack", 6], ["First Aid Kit", "MED-FIRST", "ASSET", "unit-ea", 2], ["Sports Cones", "SPORT-CONE", "ASSET", "unit-ea", 10],
  ].map(([name, sku, type, unitId, reorderPoint], index) => ({ id: `inv-seeded-${index + 1}`, name, sku, type, tracking: type === "ASSET" ? "SERIAL" : "NONE", reorderPoint, minStock: Math.max(1, Number(reorderPoint) - 4), isActive: true, categoryId: type === "STOCK" ? "cat-uniform" : type === "ASSET" ? "cat-it" : "cat-stationery", unitId })));
  operations.inventory.balances.push(...operations.inventory.items.map((item: any, index: number) => ({ id: `balance-seeded-${index + 1}`, itemId: item.id, locationId: index % 2 ? "loc-lab" : "loc-main", quantityOnHand: 12 + index * 4, location: operations.inventory.locations[index % 2] })));
  operations.inventory.movements.push(...Array.from({ length: 28 }, (_, index) => { const item = operations.inventory.items[index % operations.inventory.items.length]; return { id: `movement-seeded-${index + 1}`, reference: `MOV-${String(index + 1).padStart(4, "0")}`, type: index % 3 ? "ISSUE" : "RECEIPT", itemId: item.id, quantity: index % 3 ? 2 : 12, previousQuantity: 20 + index, newQuantity: index % 3 ? 18 + index : 32 + index, locationId: index % 2 ? "loc-lab" : "loc-main", reason: index % 3 ? "Daily school issue" : "Supplier delivery", unitCost: 25 + index, createdAt: dateAt(end, index * 3, 11) }; }));
  operations.inventory.requests.push(...Array.from({ length: 8 }, (_, index) => ({ id: `inventory-request-seeded-${index + 1}`, reference: `INV-REQ-${String(index + 1).padStart(4, "0")}`, locationId: index % 2 ? "loc-lab" : "loc-main", department: ["Science", "Sports", "Administration", "Uniform Store"][index % 4], status: ["SUBMITTED", "APPROVED", "FULFILLED"][index % 3], createdAt: dateAt(end, 6 + index * 8, 9), lines: [{ itemId: operations.inventory.items[index % operations.inventory.items.length].id, quantityRequested: 4 + index }] })));
  operations.inventory.transfers.push(...Array.from({ length: 5 }, (_, index) => ({ id: `transfer-seeded-${index + 1}`, reference: `TRF-${String(index + 1).padStart(4, "0")}`, fromLocationId: "loc-main", toLocationId: "loc-lab", status: index % 3 === 0 ? "IN_TRANSIT" : "COMPLETED", createdAt: dateAt(end, 14 + index * 9, 13), items: [{ itemId: operations.inventory.items[index % operations.inventory.items.length].id, quantity: 3 + index }] })));
  operations.inventory.adjustments.push(...Array.from({ length: 5 }, (_, index) => ({ id: `adjustment-seeded-${index + 1}`, reference: `ADJ-${String(index + 1).padStart(4, "0")}`, locationId: "loc-main", status: index % 3 ? "APPROVED" : "PENDING_APPROVAL", reason: index % 2 ? "Cycle count correction" : "Damaged stock", createdAt: dateAt(end, 10 + index * 12, 14), lines: [{ itemId: operations.inventory.items[index % operations.inventory.items.length].id, quantityDelta: index % 2 ? 2 : -1 }] })));
  operations.inventory.counts.push(...Array.from({ length: 4 }, (_, index) => ({ id: `count-seeded-${index + 1}`, reference: `CNT-${String(index + 1).padStart(4, "0")}`, locationId: index % 2 ? "loc-lab" : "loc-main", status: index === 3 ? "OPEN" : "COMPLETED", type: "Cycle Count", createdAt: dateAt(end, 20 + index * 15, 7) })));
  operations.requisitions = Array.from({ length: 12 }, (_, index) => ({ id: `requisition-seeded-${index + 1}`, reference: `REQ-${String(index + 1).padStart(4, "0")}`, title: ["Classroom supplies", "Uniform replenishment", "Science equipment", "Sports equipment"][index % 4], description: "Three-month seeded procurement history.", department: ["Administration", "Uniform Store", "Science", "Sports"][index % 4], priority: index % 4 === 0 ? "HIGH" : "MEDIUM", status: ["PENDING_APPROVAL", "APPROVED", "ORDERED", "DELIVERED"][index % 4], createdAt: dateAt(end, 4 + index * 7, 8), createdBy: { id: "seed-admin", name: "System Administrator", email: "admin@popin.school" }, requisition: { id: `requisition-detail-seeded-${index + 1}`, budgetCode: `BUD-2026-${index + 1}`, requiredDate: dateAt(end, index, 12).slice(0, 10), deliveryLocation: "Main campus", vendorPreference: "Approved school supplier", procurementStatus: ["PENDING_APPROVAL", "APPROVED", "ORDERED", "DELIVERED"][index % 4], approvalLevel: index % 3 + 1, estimatedTotalCost: 1200 + index * 950 }, items: [{ id: `requisition-item-seeded-${index + 1}`, itemName: ["Paper", "Blazer", "Lab kit", "Sports cones"][index % 4], category: "School operations", quantity: 5 + index, estimatedUnitCost: 120 + index * 10, totalCost: (5 + index) * (120 + index * 10), itemType: "NEW_INVENTORY" }], approvals: index % 4 === 0 ? [] : [{ id: `approval-seeded-${index + 1}`, approvalRole: "Principal", decision: "APPROVED", comments: "Approved in normal workflow.", decidedAt: dateAt(end, 3 + index * 7, 12), approver: { name: "System Administrator", email: "admin@popin.school" } }], purchaseOrders: index % 4 > 1 ? [{ id: `purchase-order-seeded-${index + 1}`, reference: `PO-${String(index + 1).padStart(4, "0")}`, vendor: "Approved school supplier", status: index % 4 === 3 ? "DELIVERED" : "ORDERED", orderDate: dateAt(end, 2 + index * 7, 9), expectedDeliveryDate: dateAt(end, index * 2, 12).slice(0, 10), items: [{ id: `purchase-item-${index + 1}`, name: "School supplies", quantity: 5 + index }] }] : [], estimatedTotal: 1200 + index * 950 }));
  operations.tickets.push(...Array.from({ length: 12 }, (_, index) => ({ id: `ticket-seeded-${index + 1}`, title: ["Projector issue", "Broken window", "Uniform query", "Password reset"][index % 4], category: ["IT", "Facilities", "Uniform", "Access"][index % 4], priority: index % 5 === 0 ? "high" : "medium", assignee: ["John M.", "Lerato Naidoo", "System Administrator"][index % 3], status: ["open", "in-progress", "resolved"][index % 3], created: dateAt(end, 5 + index * 6, 10).slice(0, 10) })));
  operations.store.products = [
    ["Grade 8 Blazer", "store-blazers", 850, 22, ["30", "32", "34", "36"]], ["School Shirt", "store-shirts", 180, 58, ["S", "M", "L", "XL"]], ["Sports Shorts", "store-sports", 240, 35, ["S", "M", "L", "XL"]], ["School Tracksuit", "store-sports", 680, 18, ["28", "30", "32", "34"]], ["School Tie", "store-shirts", 95, 45, ["One size"]], ["Winter Jersey", "store-blazers", 420, 26, ["30", "32", "34", "36"]],
  ].map(([name, categoryId, basePrice, stockQuantity, sizeOptions], index) => ({ id: `product-seeded-${index + 1}`, name, slug: String(name).toLowerCase().replace(/[^a-z0-9]+/g, "-"), sku: `UNI-${String(index + 1).padStart(3, "0")}`, basePrice, costPrice: Number(basePrice) * 0.6, vatRate: 15, vatInclusive: true, shortDescription: `Official school ${String(name).toLowerCase()} for learners.`, primaryImage: "https://placehold.co/600x400", stockQuantity, lowStockThreshold: 5, reorderQuantity: 20, categoryId, isActive: true, isFeatured: index < 2, allowOnlinePurchase: true, sizeOptions, colorOptions: [index % 2 ? "White" : "Navy"], collectionLocation: "Uniform Room", returnPolicy: "Exchange within 14 days." }));
  operations.store.orders = Array.from({ length: 14 }, (_, index) => { const product = operations.store.products[index % operations.store.products.length]; return { id: `order-seeded-${index + 1}`, userId: index % 2 ? "parent-seeded-1" : "seed-admin", status: ["PAID", "PROCESSING", "READY_FOR_COLLECTION", "COLLECTED"][index % 4], paymentMethod: index % 3 ? "eft" : "payfast", totalAmount: Number(product.basePrice) * (1 + index % 2), createdAt: dateAt(end, 3 + index * 6, 12), items: [{ id: `order-item-seeded-${index + 1}`, productId: product.id, name: product.name, quantity: 1 + index % 2, price: product.basePrice }] }; });
  operations.store.products.forEach((product: any, index: number) => { operations.store.stockHistory[product.id] = Array.from({ length: 4 }, (_, entry) => ({ id: `stock-history-${index}-${entry}`, type: entry === 0 ? "RESTOCK" : "SALE", quantityChange: entry === 0 ? product.stockQuantity + 10 : -1, previousQuantity: product.stockQuantity + 10 - entry, newQuantity: product.stockQuantity + 10 - entry + (entry === 0 ? product.stockQuantity : -1), reason: entry === 0 ? "Supplier delivery" : "Uniform sale", createdAt: dateAt(end, 10 + entry * 20 + index, 11) })); operations.store.salesHistory[product.id] = operations.store.orders.filter((order: any) => order.items[0].productId === product.id).map((order: any, saleIndex: number) => ({ id: `sale-history-${index}-${saleIndex}`, quantity: order.items[0].quantity, price: order.items[0].price, order: { id: order.id, createdAt: order.createdAt, status: order.status } })); });
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
  const historyEnd = new Date("2026-09-21T16:00:00.000Z");
  const portalData = createCleanPortalData({ parentEmail, parentName, teacherEmail, teacherName });
  const operationsData = createCleanOperationsData();
  populateThreeMonthHistory(portalData, operationsData, historyEnd);

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

  const additionalUsers = [
    ["teacher.mthembu@popin.school", "Thabo Mthembu", "TEACHER"], ["teacher.jacobs@popin.school", "Daniel Jacobs", "TEACHER"],
    ["parent.seeded@school.co.za", "Seeded Parent", "PARENT"], ["parent.mokoena@school.co.za", "Lebo Parent", "PARENT"], ["parent.dlamini@school.co.za", "Thandi Parent", "PARENT"],
    ["ari.khumalo@school.co.za", "Ari Khumalo", "STUDENT"], ["mila.khumalo@school.co.za", "Mila Khumalo", "STUDENT"],
    ["lebo.mokoena@school.co.za", "Lebo Mokoena", "STUDENT"], ["thandi.dlamini@school.co.za", "Thandi Dlamini", "STUDENT"], ["sipho.nkosi@school.co.za", "Sipho Nkosi", "STUDENT"], ["zanele.maseko@school.co.za", "Zanele Maseko", "STUDENT"], ["neo.molefe@school.co.za", "Neo Molefe", "STUDENT"],
  ] as const;
  for (const [email, name, role] of additionalUsers) {
    await prisma.user.upsert({ where: { email }, update: { name, role, passwordHash: await bcrypt.hash(role === "STUDENT" ? studentPassword : role === "PARENT" ? parentPassword : teacherPassword, 10), registrationStatus: "APPROVED" }, create: { email, name, role, passwordHash: await bcrypt.hash(role === "STUDENT" ? studentPassword : role === "PARENT" ? parentPassword : teacherPassword, 10), registrationStatus: "APPROVED" } });
  }

  await prisma.user.upsert({
    where: { email: "teacher.naledi@popin.school" },
    update: { name: "Naledi Molefe", role: "TEACHER", passwordHash: await bcrypt.hash(teacherPassword, 10), registrationStatus: "APPROVED" },
    create: { email: "teacher.naledi@popin.school", name: "Naledi Molefe", role: "TEACHER", passwordHash: await bcrypt.hash(teacherPassword, 10), registrationStatus: "APPROVED" }
  });

  const generatedLearnerNames = ["Ayesha", "Bongani", "Cebo", "Dineo", "Elijah", "Faith", "Gugu", "Hlumelo", "Ivy", "Jason", "Kamo", "Lihle", "Mpho", "Nandi", "Ofentse", "Palesa", "Qhawe", "Rethabile", "Sanele", "Tebogo", "Ulwazi", "Vuyo", "Wandile", "Xolani", "Yanga", "Zinzi", "Andile", "Busisiwe", "Caitlin", "Dumisani"];
  const generatedLastNames = ["Mabena", "Mthethwa", "Pillay", "Mahlangu", "Botha", "Mokoena"];
  for (const [index, firstName] of generatedLearnerNames.entries()) {
    const lastName = generatedLastNames[index % generatedLastNames.length];
    const parentEmail = `parent.${firstName.toLowerCase()}.${lastName.toLowerCase()}@school.co.za`;
    const studentEmail = `${firstName.toLowerCase()}.${lastName.toLowerCase()}@school.co.za`;
    for (const [email, name, role, password] of [[parentEmail, `${firstName} Parent`, "PARENT", parentPassword], [studentEmail, `${firstName} ${lastName}`, "STUDENT", studentPassword]] as const) {
      await prisma.user.upsert({ where: { email }, update: { name, role, passwordHash: await bcrypt.hash(password, 10), registrationStatus: "APPROVED" }, create: { email, name, role, passwordHash: await bcrypt.hash(password, 10), registrationStatus: "APPROVED" } });
    }
  }

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
      value: operationsData
    },
    create: {
      key: "operations",
      value: operationsData
    }
  });

  await prisma.setting.upsert({
    where: { key: "portal-data" },
    update: {
      value: portalData
    },
    create: {
      key: "portal-data",
      value: portalData
    }
  });

  await prisma.auditLog.createMany({
    data: Array.from({ length: 90 }, (_, index) => ({
      action: ["CREATE", "UPDATE", "APPROVE", "PUBLISH", "LOGIN"][index % 5],
      entity: ["Student", "Attendance", "Payment", "Requisition", "Communication", "User"][index % 6],
      entityId: `seed-history-${index + 1}`,
      actorId: [adminEmail, teacherEmail, secondTeacherEmail][index % 3],
      metadata: { seeded: true, period: "three-month-history", sequence: index + 1 },
      createdAt: new Date(dateAt(historyEnd, index, 8 + (index % 8)))
    }))
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
