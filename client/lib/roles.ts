import type { Role } from "@prisma/client";

export const ROLE_OPTIONS: Role[] = [
  "USER",
  "MODERATOR",
  "ADMIN",
  "SUPER_ADMIN",
];

export function isTeamRole(role: Role | null | undefined) {
  return role === "MODERATOR" || role === "ADMIN" || role === "SUPER_ADMIN";
}

export function isAdminRole(role: Role | null | undefined) {
  return isTeamRole(role);
}

export function isSuperAdminRole(role: Role | null | undefined) {
  return role === "SUPER_ADMIN";
}

export function canManageForeignProducts(role: Role | null | undefined) {
  return role === "ADMIN" || role === "SUPER_ADMIN";
}

export function getRoleLabel(role: Role) {
  switch (role) {
    case "MODERATOR":
      return "Модератор";
    case "ADMIN":
      return "Администратор";
    case "SUPER_ADMIN":
      return "Супер-админ";
    case "USER":
    default:
      return "Пользователь";
  }
}