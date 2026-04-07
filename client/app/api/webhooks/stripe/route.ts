import Stripe from "stripe";
import { NextResponse } from "next/server";

import {
  handleCompletedTopupSession,
  mapStripeWebhookErrorToStatusCode,
  stripe,
} from "@/lib/stripe";

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get("stripe-signature");

    if (!signature?.trim()) {
      throw new Error("Missing Stripe-Signature header.");
    }

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();

    if (!webhookSecret) {
      throw new Error("STRIPE_WEBHOOK_SECRET is not configured.");
    }

    const event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);

    if (event.type !== "checkout.session.completed") {
      return NextResponse.json({
        received: true,
        processed: false,
        eventType: event.type,
      });
    }

    const result = await handleCompletedTopupSession(
      event.data.object as Stripe.Checkout.Session,
    );

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