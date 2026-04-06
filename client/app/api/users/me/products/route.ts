import { NextResponse } from "next/server";

import {
  listProductsBySeller,
  mapMarketplaceErrorToStatusCode,
} from "@/lib/marketplace";
import { requireSessionUserId } from "@/lib/session-user";

export async function GET() {
  try {
    const sessionUser = await requireSessionUserId();

    if ("response" in sessionUser) {
      return sessionUser.response;
    }

    const { userId } = sessionUser;

    const products = await listProductsBySeller(userId);

    return NextResponse.json(products);
  } catch (error) {
    console.error("[USER_ME_PRODUCTS_PROXY_ERROR]", error);

    if (error instanceof Error) {
      return NextResponse.json(
        { message: error.message },
        { status: mapMarketplaceErrorToStatusCode(error.message) },
      );
    }

    return NextResponse.json(
      { message: "Failed to load user products." },
      { status: 500 },
    );
  }
}