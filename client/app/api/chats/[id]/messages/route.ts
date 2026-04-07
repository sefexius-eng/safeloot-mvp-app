import { NextResponse } from "next/server";

import {
  createConversationMessage,
  getConversationMessages,
  mapMarketplaceErrorToStatusCode,
} from "@/lib/marketplace";
import { requireActiveSessionUserId } from "@/lib/session-user";

function getAfterTimestamp(request: Request) {
  const after = new URL(request.url).searchParams.get("after")?.trim();

  if (!after) {
    return null;
  }

  const timestamp = Date.parse(after);

  return Number.isNaN(timestamp) ? null : timestamp;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const sessionUser = await requireActiveSessionUserId();

    if ("response" in sessionUser) {
      return sessionUser.response;
    }

    const { userId, role } = sessionUser;
    const { id: conversationId } = await context.params;
    const response = await getConversationMessages(conversationId, userId, role);
    const afterTimestamp = getAfterTimestamp(request);
    const latestMessageCreatedAt =
      response.messages[response.messages.length - 1]?.createdAt ?? null;

    const messages = afterTimestamp
      ? response.messages.filter(
          (message) => Date.parse(message.createdAt) > afterTimestamp,
        )
      : response.messages;

    return NextResponse.json({
      conversationId: response.conversationId,
      messages,
      messageCount: response.messages.length,
      latestMessageCreatedAt,
    });
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
  context: { params: Promise<{ id: string }> },
) {
  try {
    const sessionUser = await requireActiveSessionUserId();

    if ("response" in sessionUser) {
      return sessionUser.response;
    }

    const { userId } = sessionUser;
    const { id: conversationId } = await context.params;
    const payload = await request.json();
    const result = await createConversationMessage({
      conversationId,
      senderId: userId,
      text: payload?.text,
      imageBase64: payload?.imageBase64,
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