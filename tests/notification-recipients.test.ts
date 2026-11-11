// Run against a disposable *_test database and a Next.js server using that database.
// Set NEXT_DIST_DIR=.next/test when starting the test server to isolate its build cache.
import assert from "node:assert/strict";
import { test } from "node:test";
import { PrismaClient } from "@prisma/client";
import { createAuthToken, hashPassword } from "../src/server/auth";
import { defaultPortalData, getPortalData } from "../src/server/portalData";

test("notifications reach their recipients and read state belongs to each account", async (t) => {
  assert.ok(new URL(process.env.DATABASE_URL || "").pathname.endsWith("_test"), "Use a disposable *_test database.");
  const db = new PrismaClient();
  t.after(() => db.$disconnect());
  const actors: Record<string, { id: string; email: string; role: string; token: string }> = {};
  for (const [name, role] of [["parentA", "PARENT"], ["parentB", "PARENT"], ["coGuardian", "PARENT"], ["teacherA", "TEACHER"], ["teacherB", "TEACHER"], ["admin", "ADMIN"]]) {
    const email = `${name.toLowerCase()}@notifications.example.test`;
    const user = await db.user.upsert({ where: { email }, update: {}, create: { email, role, name, passwordHash: await hashPassword("test-password") } });
    actors[name] = { ...user, token: await createAuthToken({ sub: user.id, email, role }) };
  }
  const data: any = defaultPortalData();
  const learnerA = data.learners[0];
  const learnerB = data.learners[1];
  const templateLink = learnerA.guardians[0];
  learnerA.guardians = [actors.parentA, actors.coGuardian].map((actor) => ({ ...templateLink, guardian: { ...templateLink.guardian, email: actor.email } }));
  learnerB.guardians = [{ ...templateLink, guardian: { ...templateLink.guardian, email: actors.parentB.email } }];
  data.parent.guardianEmail = actors.parentA.email;
  data.classes[0].teacherEmail = actors.teacherA.email;
  data.classes[1].teacherEmail = actors.teacherB.email;
  data.classes[0].learners = [learnerB]; // Stale roster must not override current enrolment.
  delete data.classes[0].assignments;
  delete data.classes[0].timetable;
  delete data.classes[0].workItems;
  const notification = (id: string, targets: object) => ({ id, type: "message", title: id, message: id, createdAt: new Date().toISOString(), readAt: null, ...targets });
  data.parent.notifications = [
    notification("learner-a", { learnerId: learnerA.id }),
    notification("learner-b", { learnerId: learnerB.id }),
    notification("parent-a-direct", { recipientEmail: actors.parentA.email.toUpperCase(), recipientRole: "PARENT" }),
    notification("parent-b-direct", { recipientUserId: actors.parentB.id, recipientRole: "PARENT" }),
    notification("parent-broadcast", { recipientRoles: ["PARENT"] }),
    notification("unaddressed-parent", {}),
  ];
  data.teacher.notifications = [
    notification("teacher-a-direct", { teacherEmail: actors.teacherA.email }),
    notification("teacher-b-direct", { recipientEmail: actors.teacherB.email, recipientRole: "TEACHER" }),
    notification("teacher-a-class", { classId: data.classes[0].id }),
    notification("teacher-b-learner", { learnerId: learnerB.id }),
    notification("teacher-broadcast", { recipientRoles: ["TEACHER"] }),
    notification("unaddressed-teacher", {}),
  ];
  data.communications.audiences = [
    { id: "grade-eight-parents", filters: { roles: ["PARENT"], grades: [data.classes[0].gradeId], classes: [] } },
    { id: "class-eight-teachers", filters: { roles: ["TEACHER"], grades: [], classes: [data.classes[0].id] } },
  ];
  data.communications.campaigns = [];
  await db.setting.upsert({ where: { key: "portal-data" }, create: { key: "portal-data", value: data }, update: { value: data } });
  const base = process.env.PORTAL_TEST_URL || "http://127.0.0.1:3100";
  const request = async (actor: string, path: string, method = "GET", body?: unknown) => {
    const response = await fetch(`${base}/api/${path}`, { method, headers: { Authorization: `Bearer ${actors[actor].token}`, "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: response.status, body: await response.json() };
  };
  const list = async (actor: string, portal: string) => {
    const result = await request(actor, `${portal}/notifications`);
    assert.equal(result.status, 200);
    return result.body as any[];
  };
  const ids = (items: any[]) => items.map((item) => item.id).sort();

  await t.test("parent feeds contain only linked learners, direct recipients, and explicit broadcasts", async () => {
    assert.deepEqual(ids(await list("parentA", "parent")), ["learner-a", "parent-a-direct", "parent-broadcast"]);
    assert.deepEqual(ids(await list("parentB", "parent")), ["learner-b", "parent-b-direct", "parent-broadcast"]);
    assert.deepEqual(ids(await list("coGuardian", "parent")), ["learner-a", "parent-broadcast"]);
    assert.equal((await request("parentA", "parent/notifications/learner-b/read", "POST")).status, 404);
  });

  await t.test("reading shared parent notifications does not dismiss them for another guardian", async () => {
    assert.equal((await request("parentA", "parent/notifications/read-all", "POST")).status, 200);
    assert.ok((await list("parentA", "parent")).every((item) => item.readAt && item.read && !item.readBy));
    assert.ok((await list("coGuardian", "parent")).every((item) => !item.readAt && !item.read));
    assert.ok((await list("parentB", "parent")).every((item) => !item.readAt && !item.read));
  });

  await t.test("teachers get assigned notices and cannot mark other teachers' notices as read", async () => {
    assert.deepEqual(ids(await list("teacherA", "teacher")), ["teacher-a-class", "teacher-a-direct", "teacher-broadcast"]);
    assert.deepEqual(ids(await list("teacherB", "teacher")), ["teacher-b-direct", "teacher-b-learner", "teacher-broadcast"]);
    assert.equal((await request("teacherA", "teacher/notifications/teacher-b-direct/read", "POST")).status, 404);
    assert.equal((await request("teacherA", "teacher/notifications/teacher-a-direct/read", "POST")).status, 200);
    assert.equal((await request("teacherA", "teacher/notifications/read-all", "POST")).status, 200);
    assert.ok((await list("teacherA", "teacher")).every((item) => item.readAt));
    assert.ok((await list("teacherB", "teacher")).every((item) => !item.readAt));
  });

  await t.test("parent conversations notify the assigned teacher, whose reply notifies the parent", async () => {
    const thread = await request("parentA", `parent/children/${learnerA.id}/messages`, "POST", { subject: "Regression question", message: "When is collection?" });
    assert.equal(thread.status, 201);
    assert.equal(thread.body.teacherEmail, actors.teacherA.email);
    assert.ok((await list("teacherA", "teacher")).some((item) => item.title === "New parent message"));
    assert.ok(!(await list("teacherB", "teacher")).some((item) => item.title === "New parent message"));
    const dashboard = await request("teacherB", "teacher/dashboard");
    assert.ok(!dashboard.body.parentQueries.some((item: any) => item.id === thread.body.id));
    assert.equal((await request("teacherB", `teacher/messages/${thread.body.id}/reply`, "POST", { message: "Wrong teacher" })).status, 404);
    assert.equal((await request("teacherA", `teacher/messages/${thread.body.id}/reply`, "POST", { message: "Friday" })).status, 201);
    assert.ok((await list("parentA", "parent")).some((item) => item.title === "Teacher reply received"));
    assert.ok(!(await list("parentB", "parent")).some((item) => item.title === "Teacher reply received"));
    assert.ok(!(await list("coGuardian", "parent")).some((item) => item.title === "Teacher reply received"));
  });

  await t.test("in-app campaigns create notifications for their selected grade and teacher class", async () => {
    for (const [audienceId, title] of [["grade-eight-parents", "Grade eight parent notice"], ["class-eight-teachers", "Class eight teacher notice"]]) {
      const campaign = await request("admin", "admin/communications/campaigns", "POST", { audienceId, title, content: "An intended audience update.", channels: ["APP"], status: "SENT" });
      assert.equal(campaign.status, 201);
      assert.ok(campaign.body.sentAt);
      assert.ok(campaign.body.metrics.delivered > 0);
    }
    assert.ok((await list("parentA", "parent")).some((item) => item.title === "Grade eight parent notice"));
    assert.ok((await list("coGuardian", "parent")).some((item) => item.title === "Grade eight parent notice"));
    assert.ok(!(await list("parentB", "parent")).some((item) => item.title === "Grade eight parent notice"));
    assert.ok((await list("teacherA", "teacher")).some((item) => item.title === "Class eight teacher notice"));
    assert.ok(!(await list("teacherB", "teacher")).some((item) => item.title === "Class eight teacher notice"));
  });

  await t.test("appointments notify the assigned teacher and cannot be updated by another teacher", async () => {
    const appointment = await request("parentB", `parent/children/${learnerB.id}/appointments`, "POST", { title: "Class nine meeting", startsAt: "2026-11-02T09:00:00Z" });
    assert.equal(appointment.status, 201);
    assert.equal(appointment.body.teacherEmail, actors.teacherB.email);
    assert.ok((await list("teacherB", "teacher")).some((item) => item.title === "Parent appointment requested"));
    assert.ok(!(await list("teacherA", "teacher")).some((item) => item.title === "Parent appointment requested"));
    assert.equal((await request("teacherA", `teacher/appointments/${appointment.body.id}`, "PATCH", { status: "CONFIRMED" })).status, 404);
  });

  await t.test("published class updates reach that class's guardians", async () => {
    const work = await request("teacherA", "teacher/work-items", "POST", { classId: data.classes[0].id, type: "ANNOUNCEMENT", title: "Class eight reminder", status: "PUBLISHED", visibleToParents: true });
    assert.equal(work.status, 201);
    assert.ok((await list("parentA", "parent")).some((item) => item.message === "Class eight reminder"));
    assert.ok((await list("coGuardian", "parent")).some((item) => item.message === "Class eight reminder"));
    assert.ok(!(await list("parentB", "parent")).some((item) => item.message === "Class eight reminder"));
    assert.equal((await request("teacherB", "teacher/work-items", "POST", { classId: data.classes[0].id, type: "ANNOUNCEMENT", title: "Wrong class", status: "PUBLISHED" })).status, 404);
    assert.equal((await request("teacherA", "teacher/work-items", "POST", { classId: data.classes[0].id, type: "HOMEWORK", title: " " })).status, 400);
  });

  await t.test("My Classes uses current enrolment and provides complete class collections", async () => {
    const result = await request("teacherA", "teacher/classes");
    assert.equal(result.status, 200);
    assert.equal(result.body.length, 1);
    assert.equal(result.body[0].id, data.classes[0].id);
    assert.deepEqual(result.body[0].learners.map((learner: any) => learner.id), [learnerA.id]);
    for (const key of ["assignments", "timetable", "workItems"]) assert.ok(Array.isArray(result.body[0][key]));
    assert.ok(result.body[0].grade.name);
    assert.equal((await request("teacherB", "teacher/classes")).body[0].id, data.classes[1].id);
  });

  await t.test("teachers can start, reply to, close and reopen their parent conversations", async () => {
    assert.equal((await request("teacherA", "teacher/messages", "POST", { learnerId: learnerB.id, subject: "Other class", message: "Hello" })).status, 404);
    assert.equal((await request("teacherA", "teacher/messages", "POST", { learnerId: learnerA.id, subject: " ", message: " " })).status, 400);
    const created = await request("teacherA", "teacher/messages", "POST", { learnerId: learnerA.id, subject: "Teacher started discussion", message: "Please review the homework." });
    assert.equal(created.status, 201);
    assert.ok(created.body.learnerName);
    const threadId = created.body.id;
    assert.ok((await request("parentA", `parent/children/${learnerA.id}/messages`)).body.some((thread: any) => thread.id === threadId));
    assert.ok((await list("parentA", "parent")).some((item) => item.title === "New teacher message"));
    assert.ok(!(await list("parentB", "parent")).some((item) => item.title === "New teacher message"));
    assert.equal((await request("teacherB", `teacher/messages/${threadId}/status`, "PATCH", { status: "CLOSED" })).status, 404);
    assert.equal((await request("teacherA", `teacher/messages/${threadId}/reply`, "POST", { message: " " })).status, 400);
    assert.equal((await request("teacherA", `teacher/messages/${threadId}/status`, "PATCH", { status: "INVALID" })).status, 400);
    assert.equal((await request("teacherA", `teacher/messages/${threadId}/status`, "PATCH", { status: "CLOSED" })).status, 200);
    assert.equal((await request("teacherA", `teacher/messages/${threadId}/reply`, "POST", { message: "Closed reply" })).status, 409);
    assert.equal((await request("teacherA", `teacher/messages/${threadId}/status`, "PATCH", { status: "OPEN" })).status, 200);
    assert.equal((await request("teacherA", `teacher/messages/${threadId}/reply`, "POST", { message: "Follow-up saved" })).status, 201);
    const reloaded = await request("teacherA", "teacher/messages");
    assert.ok(reloaded.body.find((thread: any) => thread.id === threadId).messages.some((message: any) => message.message === "Follow-up saved"));
  });

  await t.test("attendance drafts reload, submissions persist, and other class entries are rejected", async () => {
    const register = { classId: data.classes[0].id, registerDate: "2026-11-02", submit: false, entries: [{ learnerId: learnerA.id, status: "LATE", note: "Transport delay" }] };
    assert.equal((await request("teacherA", "teacher/attendance", "POST", register)).status, 201);
    const query = `teacher/attendance?classId=${data.classes[0].id}&date=${register.registerDate}`;
    const draft = await request("teacherA", query);
    assert.equal(draft.status, 200);
    assert.equal(draft.body[0].status, "LATE");
    assert.equal(draft.body[0].note, "Transport delay");
    assert.equal(draft.body[0].submittedAt, null);
    assert.equal((await request("teacherA", "teacher/attendance", "POST", { ...register, entries: [{ learnerId: learnerA.id, status: "LATE", note: "" }] })).status, 201);
    assert.equal((await request("teacherA", query)).body[0].note, "");
    assert.equal((await request("teacherA", "teacher/attendance", "POST", { ...register, submit: true })).status, 201);
    assert.ok((await request("teacherA", query)).body[0].submittedAt);
    assert.equal((await request("teacherB", query)).status, 404);
    assert.equal((await request("teacherB", "teacher/attendance", "POST", register)).status, 404);
    assert.equal((await request("teacherA", "teacher/attendance", "POST", { ...register, entries: [{ learnerId: learnerB.id, status: "PRESENT" }] })).status, 400);
  });

  await t.test("default audiences remain usable across requests and include all teachers", async () => {
    const stored: any = await getPortalData();
    stored.communications.audiences = [];
    await db.setting.update({ where: { key: "portal-data" }, data: { value: stored } });
    const first = await request("admin", "admin/communications");
    const second = await request("admin", "admin/communications");
    assert.deepEqual(ids(first.body.audiences), ids(second.body.audiences));
    assert.equal(first.body.audiences.find((item: any) => item.id === "audience-all-teachers").memberCount, 2);
    const campaign = await request("admin", "admin/communications/campaigns", "POST", { audienceId: "audience-all-teachers", title: "Staff update", content: "For teachers only.", channels: ["APP"], status: "SENT" });
    assert.equal(campaign.status, 201);
    assert.ok((await list("teacherA", "teacher")).some((item) => item.title === "Staff update"));
    assert.ok((await list("teacherB", "teacher")).some((item) => item.title === "Staff update"));
    assert.ok(!(await list("parentA", "parent")).some((item) => item.title === "Staff update"));
    assert.equal((await request("admin", "admin/communications/campaigns", "POST", { audienceId: "missing-audience", channels: ["APP"], status: "SENT" })).status, 400);
  });
});
