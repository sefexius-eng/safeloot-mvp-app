import { NextResponse } from "next/server";

import { mapMarketplaceErrorToStatusCode } from "@/lib/domain/shared";
import { authorizePusherChannelSubscription } from "@/lib/pusher-auth";
import { requireActiveSessionUserId } from "@/lib/session-user";

function readFormField(formData: FormData, fieldName: string) {
  const value = formData.get(fieldName);
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: Request) {
  try {
    const sessionUser = await requireActiveSessionUserId();

    if ("response" in sessionUser) {
      return sessionUser.response;
    }

    const formData = await request.formData();
    const socketId = readFormField(formData, "socket_id");
    const channelName = readFormField(formData, "channel_name");

    if (!socketId || !channelName) {
      return NextResponse.json(
        { message: "socket_id and channel_name are required." },
        { status: 400 },
      );
    }

    const authResponse = await authorizePusherChannelSubscription({
      socketId,
      channelName,
      userId: sessionUser.userId,
      role: sessionUser.role,
    });

    return NextResponse.json(authResponse);
  } catch (error) {
    console.error("[PUSHER_CHANNEL_AUTH_ERROR]", error);

    if (error instanceof Error) {
      return NextResponse.json(
        { message: error.message },
        { status: mapMarketplaceErrorToStatusCode(error.message) },
      );
    }

    return NextResponse.json(
      { message: "Failed to authorize Pusher channel." },
      { status: 500 },
    );
  }
}