import { NextResponse } from "next/server";

import {
  createConversationMessage,
  getConversationMessages,
  mapMarketplaceErrorToStatusCode,
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
    const conversation = await getConversationMessages(conversationId, userId, role);

    return NextResponse.json(conversation);
  } catch (error) {
    console.error("[CONVERSATION_MESSAGES_PROXY_ERROR]", error);

    if (error instanceof Error) {
      return NextResponse.json(
        { message: error.message },
        { status: mapMarketplaceErrorToStatusCode(error.message) },
      );
    }

    return NextResponse.json(
      { message: "Failed to load conversation messages." },
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
    const result = await createConversationMessage({
      conversationId,
      senderId: userId,
      text: payload?.text,
      imageBase64: payload?.imageBase64,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("[CONVERSATION_MESSAGE_CREATE_PROXY_ERROR]", error);

    if (error instanceof Error) {
      return NextResponse.json(
        { message: error.message },
        { status: mapMarketplaceErrorToStatusCode(error.message) },
      );
    }

    return NextResponse.json(
      { message: "Failed to create conversation message." },
      { status: 500 },
    );
  }
}