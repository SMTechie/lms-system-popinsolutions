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
  "uniform_store:store.manage"
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
      "operations:read",
      "tickets:read",
      "tickets:write",
      "students:read",
      "discipline:read",
      "discipline:write"
    ];
  }

  return ["operations:read", "inventory:read", "requisitions:read", "tickets:read", "store:read"];
}

export function getPermissionsForUser(user: Pick<User, "role">) {
  return getPermissionsForRole(user.role);
}
