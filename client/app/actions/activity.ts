"use server";

import { getSessionUserId } from "@/lib/access-control";
import { getAuthSession } from "@/lib/auth";
import { updateUserLastSeenById } from "@/lib/domain/users";

export async function updateLastSeen() {
  const session = await getAuthSession();
  const userId = getSessionUserId(session);

  if (!userId) {
    return {
      ok: false,
    };
  }

  await updateUserLastSeenById(userId);

  return {
    ok: true,
  };
}