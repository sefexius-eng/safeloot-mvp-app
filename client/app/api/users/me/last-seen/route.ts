import { NextResponse } from "next/server";

import { updateUserLastSeenById } from "@/lib/domain/users";
import { requireSessionUserId } from "@/lib/session-user";

export async function POST() {
  try {
    const sessionUser = await requireSessionUserId();

    if ("response" in sessionUser) {
      return sessionUser.response;
    }

    await updateUserLastSeenById(sessionUser.userId);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[USER_LAST_SEEN_UPDATE_ERROR]", error);

    return NextResponse.json(
      { message: "Не удалось обновить статус активности." },
      { status: 500 },
    );
  }
}