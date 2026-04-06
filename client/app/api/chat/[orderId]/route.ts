import { NextResponse } from "next/server";

import {
  createChatMessage,
  getChatMessages,
  mapMarketplaceErrorToStatusCode,
} from "@/lib/marketplace";
import { requireSessionUserId } from "@/lib/session-user";

export async function GET(
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
    const chat = await getChatMessages(orderId, userId);

    return NextResponse.json(chat);
  } catch (error) {
    console.error("[CHAT_MESSAGES_PROXY_ERROR]", error);

    if (error instanceof Error) {
      return NextResponse.json(
        { message: error.message },
        { status: mapMarketplaceErrorToStatusCode(error.message) },
      );
    }

    return NextResponse.json(
      { message: "Failed to load chat messages." },
      { status: 500 },
    );
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ orderId: string }> },
) {
  try {
    const sessionUser = await requireSessionUserId();

    if ("response" in sessionUser) {
      return sessionUser.response;
    }

    const { userId } = sessionUser;

    const { orderId } = await context.params;
    const payload = await request.json();
    const result = await createChatMessage({
      orderId,
      senderId: userId,
      content: payload?.content,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("[CHAT_MESSAGE_CREATE_PROXY_ERROR]", error);

    if (error instanceof Error) {
      return NextResponse.json(
        { message: error.message },
        { status: mapMarketplaceErrorToStatusCode(error.message) },
      );
    }

    return NextResponse.json(
      { message: "Failed to create chat message." },
      { status: 500 },
    );
  }
}
