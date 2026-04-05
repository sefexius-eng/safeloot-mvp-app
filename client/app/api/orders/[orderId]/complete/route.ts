import { NextResponse } from "next/server";

import { getApiBaseUrl } from "@/lib/api-base-url";
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
    const response = await fetch(`${getApiBaseUrl()}/orders/${orderId}/complete`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-User-Id": userId,
      },
      cache: "no-store",
    });

    const text = await response.text();
    const contentType =
      response.headers.get("content-type") ?? "application/json";

    return new Response(text, {
      status: response.status,
      headers: {
        "Content-Type": contentType,
      },
    });
  } catch (error) {
    console.error("[ORDER_COMPLETE_PROXY_ERROR]", error);

    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}