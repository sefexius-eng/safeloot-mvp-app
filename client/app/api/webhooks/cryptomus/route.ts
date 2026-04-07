import { NextResponse } from "next/server";

import {
  handleCryptomusWebhook,
  mapCryptomusWebhookErrorToStatusCode,
  type CryptomusWebhookPayload,
} from "@/lib/cryptomus";

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get("sign");
    const payload = rawBody
      ? (JSON.parse(rawBody) as CryptomusWebhookPayload)
      : ({} as CryptomusWebhookPayload);

    // TODO: Validate signature.
    const result = await handleCryptomusWebhook({
      rawBody,
      signature,
      payload,
    });

    if (result.alreadyProcessed) {
      return new NextResponse("Already processed", { status: 200 });
    }

    return NextResponse.json({
      received: true,
      processed: result.processed,
      transactionId: result.transactionId,
    });
  } catch (error) {
    console.error("[CRYPTOMUS_WEBHOOK_ERROR]", error);

    if (error instanceof Error) {
      return NextResponse.json(
        { message: error.message },
        { status: mapCryptomusWebhookErrorToStatusCode(error.message) },
      );
    }

    return NextResponse.json(
      { message: "Webhook processing failed." },
      { status: 500 },
    );
  }
}