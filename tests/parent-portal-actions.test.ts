// Run against a disposable *_test database and a Next.js server using that database.
// Set NEXT_DIST_DIR=.next/test when starting the test server to isolate its build cache.
// PORTAL_TEST_URL defaults to http://127.0.0.1:3100.
import assert from "node:assert/strict";
import { test } from "node:test";
import { PrismaClient } from "@prisma/client";
import { createAuthToken, hashPassword } from "../src/server/auth";
import { defaultPortalData } from "../src/server/portalData";

test("parent portal actions persist without treating resource IDs as learner IDs", async (t) => {
  const databaseUrl = new URL(process.env.DATABASE_URL || "");
  assert.ok(databaseUrl.pathname.endsWith("_test"), "Use a disposable *_test database.");
  const db = new PrismaClient();
  t.after(() => db.$disconnect());
  const data = defaultPortalData();
  const email = "portal-regression@example.test";
  const user = await db.user.upsert({
    where: { email },
    update: {},
    create: { email, role: "PARENT", name: "Regression Parent", passwordHash: await hashPassword("test-password") },
  });
  data.parent.guardianEmail = email;
  data.learners[0].guardians = data.learners[0].guardians.map((link) => ({ ...link, guardian: { ...link.guardian, email } }));
  data.learners[1].guardians = data.learners[1].guardians.map((link) => ({ ...link, guardian: { ...link.guardian, email: "another-parent@example.test" } }));
  await db.setting.upsert({ where: { key: "portal-data" }, create: { key: "portal-data", value: data }, update: { value: data } });
  const token = await createAuthToken({ sub: user.id, email, role: user.role, name: user.name });
  const baseUrl = process.env.PORTAL_TEST_URL || "http://127.0.0.1:3100";
  const request = async (path: string, method = "GET", body?: unknown) => {
    const response = await fetch(`${baseUrl}/api/parent/${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: response.status, body: await response.json() };
  };

  await t.test("support replies save and remain visible after reload", async () => {
    const ticket = data.parent.tickets[0];
    const result = await request(`tickets/${ticket.id}/replies`, "POST", { message: "Please confirm the collection point." });
    assert.equal(result.status, 201);
    assert.equal(result.body.authorRole, "PARENT");
    const tickets = await request("tickets");
    assert.ok(tickets.body.find((item: typeof ticket) => item.id === ticket.id).replies.some((reply: { message: string }) => reply.message === result.body.message));
  });

  await t.test("ready orders can be collected and retain their status", async () => {
    const order = data.parent.orders[0];
    const result = await request(`orders/${order.id}`, "PATCH", { status: "COLLECTED" });
    assert.equal(result.status, 200);
    const orders = await request("orders");
    assert.equal(orders.body.find((item: typeof order) => item.id === order.id).status, "COLLECTED");
  });

  await t.test("individual and bulk notification reads persist", async () => {
    const notification = data.parent.notifications[0];
    const result = await request(`notifications/${notification.id}/read`, "POST");
    assert.equal(result.status, 200);
    assert.ok(result.body.readAt);
    const notifications = await request("notifications");
    assert.equal(notifications.body.find((item: typeof notification) => item.id === notification.id).readAt, result.body.readAt);
    const bulk = await request("notifications/read-all", "POST");
    assert.equal(bulk.status, 200);
    const reloaded = await request("notifications");
    assert.ok(reloaded.body.every((item: { readAt: string | null }) => item.readAt));
    assert.equal(reloaded.body.find((item: typeof notification) => item.id === notification.id).readAt, result.body.readAt);
  });

  await t.test("learner routes still enforce guardian access", async () => {
    assert.equal((await request(`children/${data.learners[0].id}/overview`)).status, 200);
    assert.equal((await request(`children/${data.learners[1].id}/overview`)).status, 401);
    assert.equal((await request("children/missing-learner/overview")).status, 404);
  });

  await t.test("missing account resources report their own errors", async () => {
    assert.deepEqual(await request("tickets/missing-ticket/replies", "POST", { message: "Hello" }), { status: 404, body: { error: "Ticket not found." } });
    assert.deepEqual(await request("orders/missing-order", "PATCH", { status: "COLLECTED" }), { status: 404, body: { error: "Order not found." } });
    assert.deepEqual(await request("notifications/missing-notification/read", "POST"), { status: 404, body: { error: "Notification not found." } });
  });
});
