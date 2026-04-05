import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { getApiBaseUrl } from "@/lib/api-base-url";
import { requireSessionUserId } from "@/lib/session-user";

interface CreateProductPayload {
  title?: string;
  description?: string;
  price?: number;
  gameId?: string;
  type?: string;
  sellerId?: string;
}

async function proxyJsonResponse(response: Response) {
  const text = await response.text();
  const contentType =
    response.headers.get("content-type") ?? "application/json";

  return new Response(text, {
    status: response.status,
    headers: {
      "Content-Type": contentType,
    },
  });
}

export async function GET() {
  try {
    const response = await fetch(`${getApiBaseUrl()}/products`, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      const text = await response.text();

      throw new Error(
        `Upstream product list failed with status ${response.status}: ${text}`,
      );
    }

    return proxyJsonResponse(response);
  } catch (error) {
    console.error("[PRODUCT_LIST_ERROR]", error);

    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const sessionUser = await requireSessionUserId();

    if ("response" in sessionUser) {
      return sessionUser.response;
    }

    const { userId } = sessionUser;

    const payload = (await request.json()) as CreateProductPayload;

    const response = await fetch(`${getApiBaseUrl()}/products`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...payload,
        sellerId: userId,
      }),
    });

    if (!response.ok) {
      const text = await response.text();

      throw new Error(
        `Upstream product creation failed with status ${response.status}: ${text}`,
      );
    }

    revalidatePath("/");

    return proxyJsonResponse(response);
  } catch (error) {
    console.error("[PRODUCT_CREATE_ERROR]", error);

    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}