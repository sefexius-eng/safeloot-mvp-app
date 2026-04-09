import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import {
  mapMarketplaceErrorToStatusCode,
} from "@/lib/domain/shared";
import { createProduct, listProducts } from "@/lib/domain/products";
import { requireActiveSessionUserId } from "@/lib/session-user";

interface CreateProductPayload {
  title?: string;
  description?: string;
  images?: string[];
  price?: number;
  gameId?: string;
  categoryId?: string;
  sellerId?: string;
}

export async function GET() {
  try {
    const products = await listProducts();

    return NextResponse.json(products);
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
    const sessionUser = await requireActiveSessionUserId();

    if ("response" in sessionUser) {
      return sessionUser.response;
    }

    const { userId } = sessionUser;

    const payload = (await request.json()) as CreateProductPayload;

    const product = await createProduct({
      ...payload,
      sellerId: userId,
    });

    revalidatePath("/");

    return NextResponse.json(product, { status: 201 });
  } catch (error) {
    console.error("[PRODUCT_CREATE_ERROR]", error);

    if (error instanceof Error) {
      return NextResponse.json(
        { message: error.message },
        { status: mapMarketplaceErrorToStatusCode(error.message) },
      );
    }

    return NextResponse.json(
      { message: "Не удалось создать товар." },
      { status: 500 },
    );
  }
}