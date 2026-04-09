import { NextResponse } from "next/server";

import {
  getChatTyping,
  setChatTyping,
} from "@/lib/domain/chat-service";
import { mapMarketplaceErrorToStatusCode } from "@/lib/domain/shared";
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
    const typingState = await getChatTyping(orderId, userId, role);

    return NextResponse.json(typingState);
  } catch (error) {
    console.error("[CHAT_TYPING_PROXY_ERROR]", error);

    if (error instanceof Error) {
      return NextResponse.json(
        { message: error.message },
        { status: mapMarketplaceErrorToStatusCode(error.message) },
      );
    }

    return NextResponse.json(
      { message: "Failed to load typing state." },
      { status: 500 },
    );
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ orderId: string }> },
) {
  try {
    const sessionUser = await requireActiveSessionUserId();

    if ("response" in sessionUser) {
      return sessionUser.response;
    }

    const { userId } = sessionUser;

    const { orderId } = await context.params;
    const payload = await request.json();
    const typingState = await setChatTyping({
      orderId,
      senderId: userId,
      isTyping: payload?.isTyping,
    });

    return NextResponse.json(typingState);
  } catch (error) {
    console.error("[CHAT_TYPING_UPDATE_PROXY_ERROR]", error);

    if (error instanceof Error) {
      return NextResponse.json(
        { message: error.message },
        { status: mapMarketplaceErrorToStatusCode(error.message) },
      );
    }

    return NextResponse.json(
      { message: "Failed to update typing state." },
      { status: 500 },
    );
  }
}