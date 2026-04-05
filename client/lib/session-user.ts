import { NextResponse } from "next/server";

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
