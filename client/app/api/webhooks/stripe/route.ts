import { NextResponse } from "next/server";

import {
  handleStripeWebhook,
  mapStripeWebhookErrorToStatusCode,
  type StripeWebhookPayload,
} from "@/lib/stripe";

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get("stripe-signature");
    const payload = rawBody
      ? (JSON.parse(rawBody) as StripeWebhookPayload)
      : ({} as StripeWebhookPayload);

    // TODO: Validate Stripe webhook signature.
    const result = await handleStripeWebhook({
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
    console.error("[STRIPE_WEBHOOK_ERROR]", error);

    if (error instanceof Error) {
      return NextResponse.json(
        { message: error.message },
        { status: mapStripeWebhookErrorToStatusCode(error.message) },
      );
    }

    return NextResponse.json(
      { message: "Webhook processing failed." },
      { status: 500 },
    );
  }
}