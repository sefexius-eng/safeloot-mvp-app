import { NextResponse } from "next/server";

import { getApiBaseUrl } from "@/lib/api-base-url";
import { prisma } from "@/lib/prisma";
import { requireSessionUserId } from "@/lib/session-user";

interface CreateOrderPayload {
  productId?: string;
}

export async function POST(request: Request) {
  try {
    const sessionUser = await requireSessionUserId();

    if ("response" in sessionUser) {
      return sessionUser.response;
    }

    const { userId } = sessionUser;

    const payload = (await request.json()) as CreateOrderPayload;
    const productId = payload.productId?.trim() ?? "";

    if (productId) {
      const product = await prisma.product.findUnique({
        where: {
          id: productId,
        },
        select: {
          sellerId: true,
        },
      });

      if (product?.sellerId === userId) {
        return NextResponse.json(
          { message: "Вы не можете купить свой собственный товар" },
          { status: 400 },
        );
      }
    }

    const response = await fetch(`${getApiBaseUrl()}/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...payload,
        buyerId: userId,
      }),
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
    console.error("[ORDER_CREATE_PROXY_ERROR]", error);

    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}