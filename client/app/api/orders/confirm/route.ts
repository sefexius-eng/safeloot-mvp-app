import { NextResponse } from "next/server";

import { confirmOrder } from "@/lib/domain/orders";
import { mapMarketplaceErrorToStatusCode } from "@/lib/domain/shared";
import { requireActiveSessionUserId } from "@/lib/session-user";

export async function POST(request: Request) {
  try {
    const sessionUser = await requireActiveSessionUserId();

    if ("response" in sessionUser) {
      return sessionUser.response;
    }

    const { userId } = sessionUser;

    const payload = await request.json();
    const result = await confirmOrder({
      orderId: payload?.orderId,
      buyerId: userId,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("[ORDER_CONFIRM_PROXY_ERROR]", error);

    if (error instanceof Error) {
      return NextResponse.json(
        { message: error.message },
        { status: mapMarketplaceErrorToStatusCode(error.message) },
      );
    }

    return NextResponse.json(
      { message: "Failed to confirm order." },
      { status: 500 },
    );
  }
}
