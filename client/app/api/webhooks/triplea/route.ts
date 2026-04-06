import { NextResponse } from "next/server";

import {
  handleTripleAWebhook,
  mapTripleAWebhookErrorToStatusCode,
  type TripleAWebhookPayload,
} from "@/lib/triplea-webhook";

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get("triplea-signature");
    const payload = rawBody
      ? (JSON.parse(rawBody) as TripleAWebhookPayload)
      : ({} as TripleAWebhookPayload);
    const result = await handleTripleAWebhook({
      rawBody,
      signature,
      payload,
    });

    return NextResponse.json({
      received: true,
      processed: result.processed,
      transactionId: result.transactionId,
    });
  } catch (error) {
    console.error("[TRIPLEA_WEBHOOK_ERROR]", error);

    if (error instanceof Error) {
      return NextResponse.json(
        { message: error.message },
        { status: mapTripleAWebhookErrorToStatusCode(error.message) },
      );
    }

    return NextResponse.json(
      { message: "Webhook processing failed." },
      { status: 500 },
    );
  }
}
