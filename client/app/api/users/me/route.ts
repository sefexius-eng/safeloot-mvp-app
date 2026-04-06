import { NextResponse } from "next/server";

import { getUserById, mapMarketplaceErrorToStatusCode } from "@/lib/marketplace";
import { requireSessionUserId } from "@/lib/session-user";

export async function GET() {
  try {
    const sessionUser = await requireSessionUserId();

    if ("response" in sessionUser) {
      return sessionUser.response;
    }

    const { userId } = sessionUser;

    const user = await getUserById(userId);

    return NextResponse.json(user);
  } catch (error) {
    console.error("[USER_ME_PROXY_ERROR]", error);

    if (error instanceof Error) {
      return NextResponse.json(
        { message: error.message },
        { status: mapMarketplaceErrorToStatusCode(error.message) },
      );
    }

    return NextResponse.json(
      { message: "Failed to load user profile." },
      { status: 500 },
    );
  }
}
