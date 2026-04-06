import { NextResponse } from "next/server";

import { getOrderById, mapMarketplaceErrorToStatusCode } from "@/lib/marketplace";
import { requireActiveSessionUserId } from "@/lib/session-user";

export async function GET(
  _request: Request,
  context: { params: Promise<{ orderId: string }> },
) {
  try {
    const sessionUser = await requireActiveSessionUserId();

    if ("response" in sessionUser) {
      return sessionUser.response;
    }

    const { userId, role } = sessionUser;

    const { orderId } = await context.params;
    const order = await getOrderById(orderId, userId, role);

    return NextResponse.json(order);
  } catch (error) {
    console.error("[ORDER_DETAIL_PROXY_ERROR]", error);

    if (error instanceof Error) {
      return NextResponse.json(
        { message: error.message },
        { status: mapMarketplaceErrorToStatusCode(error.message) },
      );
    }

    return NextResponse.json(
      { message: "Failed to load order." },
      { status: 500 },
    );
  }
}
