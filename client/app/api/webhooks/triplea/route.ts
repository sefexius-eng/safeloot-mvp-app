import { NextResponse } from "next/server";

import { getApiBaseUrl } from "@/lib/api-base-url";

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get("triplea-signature");
    const contentType =
      request.headers.get("content-type") ?? "application/json";

    const response = await fetch(`${getApiBaseUrl()}/webhooks/triplea`, {
      method: "POST",
      headers: {
        "Content-Type": contentType,
        ...(signature
          ? {
              "Triplea-Signature": signature,
            }
          : {}),
      },
      body: rawBody,
      cache: "no-store",
    });

    const text = await response.text();
    const upstreamContentType =
      response.headers.get("content-type") ?? "application/json";

    return new Response(text, {
      status: response.status,
      headers: {
        "Content-Type": upstreamContentType,
      },
    });
  } catch (error) {
    console.error("[TRIPLEA_WEBHOOK_PROXY_ERROR]", error);

    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
