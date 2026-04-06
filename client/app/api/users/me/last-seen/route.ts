import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { requireSessionUserId } from "@/lib/session-user";

export async function POST() {
  try {
    const sessionUser = await requireSessionUserId();

    if ("response" in sessionUser) {
      return sessionUser.response;
    }

    await prisma.user.update({
      where: {
        id: sessionUser.userId,
      },
      data: {
        lastSeen: new Date(),
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[USER_LAST_SEEN_UPDATE_ERROR]", error);

    return NextResponse.json(
      { message: "Не удалось обновить статус активности." },
      { status: 500 },
    );
  }
}