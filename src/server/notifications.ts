import { randomUUID } from "node:crypto";

type PortalUser = { id: string; email: string; role: string };
type NotificationRole = "PARENT" | "TEACHER" | "STUDENT";

const emailMatches = (left: unknown, right: string) =>
  typeof left === "string" && left.trim().toLowerCase() === right.trim().toLowerCase();

export function assignedTeacherEmail(data: any, learnerId: string) {
  const learner = (data.learners || []).find((item: any) => item.id === learnerId);
  const schoolClass = (data.classes || []).find((item: any) => item.id === learner?.classId) ||
    (data.classes || []).find((item: any) => (item.learners || []).some((entry: any) => entry.id === learnerId));
  return schoolClass?.teacherEmail;
}

export function isTeacherRecipient(data: any, user: PortalUser, item: any): boolean {
  if (user.role === "ADMIN") return true;
  if (item.teacherEmail) return emailMatches(item.teacherEmail, user.email);
  return (data.classes || []).some((schoolClass: any) =>
    emailMatches(schoolClass.teacherEmail, user.email) &&
    (schoolClass.id === item.classId || (schoolClass.learners || []).some((learner: any) => learner.id === item.learnerId)),
  );
}

export function isNotificationRecipient(data: any, user: PortalUser, item: any, role: NotificationRole): boolean {
  if (user.role === "ADMIN") return true;
  if (user.role !== role || (item.recipientRole && item.recipientRole !== role)) return false;
  const emails = [item.recipientEmail, item.teacherEmail, item.parentEmail, ...(item.recipientEmails || [])].filter(Boolean);
  const userIds = [item.recipientUserId, ...(item.recipientUserIds || [])].filter(Boolean);
  if (emails.length || userIds.length) return userIds.includes(user.id) || emails.some((email) => emailMatches(email, user.email));
  if (item.recipientRoles?.includes(role)) return true;
  if (role === "TEACHER") return isTeacherRecipient(data, user, item);
  if (role === "STUDENT") return (data.learners || []).some((learner: any) => learner.id === item.learnerId && emailMatches(learner.email, user.email));
  if (!item.learnerId) return false;
  return (data.learners || []).some((learner: any) =>
    learner.id === item.learnerId && (learner.guardians || []).some((link: any) =>
      emailMatches(link.guardian?.email, user.email) && !["REVOKED", "REJECTED", "INACTIVE", "UNLINKED"].includes(link.status) &&
      (item.type !== "announcement" || link.receiveAnnouncements !== false),
    ),
  );
}

export function notificationsForUser(data: any, user: PortalUser, role: NotificationRole) {
  return (data[role.toLowerCase()]?.notifications || [])
    .filter((item: any) => isNotificationRecipient(data, user, item, role))
    .map((item: any) => notificationForUser(item, user))
    .sort((a: any, b: any) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

export function notificationForUser(item: any, user: PortalUser) {
  const { readBy, ...notification } = item;
  const readAt = readBy?.[user.id] || item.readAt || null;
  return { ...notification, readAt, read: Boolean(readAt) };
}

export function markNotificationReadForUser(item: any, user: PortalUser) {
  item.readBy = { ...(item.readBy || {}), [user.id]: item.readBy?.[user.id] || item.readAt || new Date().toISOString() };
}

export function addTeacherNotification(data: any, item: { learnerId?: string; teacherEmail?: string; type: string; title: string; message: string }) {
  data.teacher = data.teacher || {};
  data.teacher.notifications = data.teacher.notifications || [];
  data.teacher.notifications.unshift({
    ...item,
    id: randomUUID(),
    recipientRole: "TEACHER",
    createdAt: new Date().toISOString(),
    readAt: null,
  });
}

