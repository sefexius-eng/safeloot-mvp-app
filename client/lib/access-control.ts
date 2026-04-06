import type { Role } from "@prisma/client";
import type { Session } from "next-auth";

import { prisma } from "@/lib/prisma";

export const BANNED_AUTH_ERROR = "ACCOUNT_BANNED";
export const BANNED_USER_MESSAGE =
  "Ваш аккаунт заблокирован. Вход и торговые действия недоступны.";

export interface CurrentSessionUser {
  id: string;
  role: Role;
  isBanned: boolean;
}

export function isAdminRole(role: Role | null | undefined) {
  return role === "ADMIN" || role === "SUPER_ADMIN";
}

export function getSessionUserId(session: Session | null) {
  return session?.user?.id?.trim() ?? "";
}

export async function getCurrentSessionUser(
  session: Session | null,
): Promise<CurrentSessionUser | null> {
  const userId = getSessionUserId(session);

  if (!userId) {
    return null;
  }

  return prisma.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      id: true,
      role: true,
      isBanned: true,
    },
  });
}

export function hasActiveAdminAccess(user: CurrentSessionUser | null) {
  return Boolean(user && isAdminRole(user.role) && !user.isBanned);
}