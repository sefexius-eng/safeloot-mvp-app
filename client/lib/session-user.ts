import { NextResponse } from "next/server";

import {
  BANNED_USER_MESSAGE,
  getCurrentSessionUser,
} from "@/lib/access-control";
import { getAuthSession } from "@/lib/auth";

export async function requireSessionUserId() {
  const session = await getAuthSession();
  const userId = session?.user?.id?.trim();

  if (!userId) {
    return {
      response: NextResponse.json({ message: "Unauthorized" }, { status: 401 }),
    };
  }

  return {
    userId,
  };
}

export async function requireActiveSessionUserId() {
  const session = await getAuthSession();
  const currentUser = await getCurrentSessionUser(session);

  if (!currentUser) {
    return {
      response: NextResponse.json({ message: "Unauthorized" }, { status: 401 }),
    };
  }

  if (currentUser.isBanned) {
    return {
      response: NextResponse.json(
        { message: BANNED_USER_MESSAGE },
        { status: 403 },
      ),
    };
  }

  return {
    userId: currentUser.id,
  };
}
