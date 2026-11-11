import type { User } from "@prisma/client";

const adminPermissions = [
  "operations:read",
  "operations:write",
  "inventory:read",
  "inventory:write",
  "requisitions:read",
  "requisitions:write",
  "tickets:read",
  "tickets:write",
  "store:read",
  "store:write",
  "uniform_store:store.manage",
  "students:create",
  "teachers:create",
  "users:manage",
  "settings:manage",
  "communications:manage",
  "admissions:manage",
  "enquiries:read",
  "appointments:manage"
] as const;

export function getPermissionsForRole(role: string) {
  if (role === "ADMIN") {
    return [...adminPermissions];
  }

  if (role === "PARENT") {
    return ["parent_portal:read", "parent_portal:acknowledge", "store:read", "tickets:read"];
  }

  if (role === "TEACHER") {
    return [
      "tickets:read",
      "tickets:write",
      "students:read",
      "discipline:read",
      "discipline:write",
      "communications:read",
      "communications:write",
      "appointments:read",
      "appointments:update",
      "teacher_portal:read",
      "teacher_portal:write"
    ];
  }

  if (role === "STUDENT") {
    return [
      "student_portal:read",
      "announcements:read",
      "attendance:read",
      "assessments:read"
    ];
  }

  return [];
}

export function getPermissionsForUser(user: Pick<User, "role">) {
  return getPermissionsForRole(user.role);
}

export function hasPermission(user: Pick<User, "role">, permission: string) {
  return getPermissionsForUser(user).includes(permission as never);
}
