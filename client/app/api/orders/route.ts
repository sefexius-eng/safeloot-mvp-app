import { NextResponse } from "next/server";

import { createOrder, mapMarketplaceErrorToStatusCode } from "@/lib/marketplace";
import { requireActiveSessionUserId } from "@/lib/session-user";

interface CreateOrderPayload {
  productId?: string;
}

export async function POST(request: Request) {
  try {
    const sessionUser = await requireActiveSessionUserId();

    if ("response" in sessionUser) {
      return sessionUser.response;
    }

    const { userId } = sessionUser;

    const payload = (await request.json()) as CreateOrderPayload;
    const order = await createOrder({
      ...payload,
      buyerId: userId,
    });

    return NextResponse.json(order, { status: 201 });
  } catch (error) {
    console.error("[ORDER_CREATE_PROXY_ERROR]", error);

    if (error instanceof Error) {
      return NextResponse.json(
        { message: error.message },
        { status: mapMarketplaceErrorToStatusCode(error.message) },
      );
    }

    return NextResponse.json(
      { message: "Failed to create order." },
      { status: 500 },
    );
  }
}