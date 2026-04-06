import { NextResponse } from "next/server";

import {
  getConversationTyping,
  mapMarketplaceErrorToStatusCode,
  setConversationTyping,
} from "@/lib/marketplace";
import { requireActiveSessionUserId } from "@/lib/session-user";

export async function GET(
  _request: Request,
  context: { params: Promise<{ conversationId: string }> },
) {
  try {
    const sessionUser = await requireActiveSessionUserId();

    if ("response" in sessionUser) {
      return sessionUser.response;
    }

    const { userId, role } = sessionUser;
    const { conversationId } = await context.params;
    const typingState = await getConversationTyping(conversationId, userId, role);

    return NextResponse.json(typingState);
  } catch (error) {
    console.error("[CONVERSATION_TYPING_PROXY_ERROR]", error);

    if (error instanceof Error) {
      return NextResponse.json(
        { message: error.message },
        { status: mapMarketplaceErrorToStatusCode(error.message) },
      );
    }

    return NextResponse.json(
      { message: "Failed to load conversation typing state." },
      { status: 500 },
    );
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ conversationId: string }> },
) {
  try {
    const sessionUser = await requireActiveSessionUserId();

    if ("response" in sessionUser) {
      return sessionUser.response;
    }

    const { userId } = sessionUser;
    const { conversationId } = await context.params;
    const payload = await request.json();
    const typingState = await setConversationTyping({
      conversationId,
      senderId: userId,
      isTyping: payload?.isTyping,
    });

    return NextResponse.json(typingState);
  } catch (error) {
    console.error("[CONVERSATION_TYPING_UPDATE_PROXY_ERROR]", error);

    if (error instanceof Error) {
      return NextResponse.json(
        { message: error.message },
        { status: mapMarketplaceErrorToStatusCode(error.message) },
      );
    }

    return NextResponse.json(
      { message: "Failed to update conversation typing state." },
      { status: 500 },
    );
  }
}