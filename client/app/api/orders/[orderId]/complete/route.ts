import { NextResponse } from "next/server";

import { completeOrder, mapMarketplaceErrorToStatusCode } from "@/lib/marketplace";
import { requireSessionUserId } from "@/lib/session-user";

export async function POST(
  _request: Request,
  context: { params: Promise<{ orderId: string }> },
) {
  try {
    const sessionUser = await requireSessionUserId();

    if ("response" in sessionUser) {
      return sessionUser.response;
    }

    const { userId } = sessionUser;

    const { orderId } = await context.params;
    const result = await completeOrder({
      orderId,
      buyerId: userId,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("[ORDER_COMPLETE_PROXY_ERROR]", error);

    if (error instanceof Error) {
      return NextResponse.json(
        { message: error.message },
        { status: mapMarketplaceErrorToStatusCode(error.message) },
      );
    }

    return NextResponse.json(
      { message: "Failed to complete order." },
      { status: 500 },
    );
  }
}