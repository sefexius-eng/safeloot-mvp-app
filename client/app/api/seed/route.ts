import { timingSafeEqual } from "node:crypto";

import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import catalogSeedData from "@/lib/catalog-seed-data.json";
import { prisma } from "@/lib/prisma";

type SeedCatalogGame = {
  name: string;
  slug: string;
  imageUrl?: string | null;
  categories: Array<{
    name: string;
    slug: string;
  }>;
};

function getSeedRequestSecret(request: Request) {
  const requestUrl = new URL(request.url);

  return (
    request.headers.get("x-admin-seed-secret")?.trim() ??
    request.headers.get("x-seed-secret")?.trim() ??
    requestUrl.searchParams.get("secret")?.trim() ??
    requestUrl.searchParams.get("token")?.trim() ??
    null
  );
}

function areSecretsEqual(expectedSecret: string, receivedSecret: string) {
  const expectedBuffer = Buffer.from(expectedSecret);
  const receivedBuffer = Buffer.from(receivedSecret);

  if (expectedBuffer.length !== receivedBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, receivedBuffer);
}

function authorizeSeedRequest(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { ok: false, message: "Forbidden." },
      { status: 403 },
    );
  }

  const expectedSecret = process.env.ADMIN_SEED_SECRET?.trim();
  const receivedSecret = getSeedRequestSecret(request);

  if (!expectedSecret || !receivedSecret || !areSecretsEqual(expectedSecret, receivedSecret)) {
    return NextResponse.json(
      { ok: false, message: "Forbidden." },
      { status: 403 },
    );
  }

  return null;
}

async function seedCatalog() {
  let createdGames = 0;
  let createdCategories = 0;

  for (const game of catalogSeedData.games as SeedCatalogGame[]) {
    const existingGame = await prisma.game.findUnique({
      where: {
        slug: game.slug,
      },
      select: {
        id: true,
      },
    });

    const upsertedGame = await prisma.game.upsert({
      where: {
        slug: game.slug,
      },
      update: {
        name: game.name,
        imageUrl: game.imageUrl ?? null,
      },
      create: {
        name: game.name,
        slug: game.slug,
        imageUrl: game.imageUrl ?? null,
      },
    });

    if (!existingGame) {
      createdGames += 1;
    }

    for (const category of game.categories) {
      const existingCategory = await prisma.category.findUnique({
        where: {
          gameId_slug: {
            gameId: upsertedGame.id,
            slug: category.slug,
          },
        },
        select: {
          id: true,
        },
      });

      await prisma.category.upsert({
        where: {
          gameId_slug: {
            gameId: upsertedGame.id,
            slug: category.slug,
          },
        },
        update: {
          name: category.name,
        },
        create: {
          gameId: upsertedGame.id,
          name: category.name,
          slug: category.slug,
        },
      });

      if (!existingCategory) {
        createdCategories += 1;
      }
    }
  }

  revalidatePath("/");
  revalidatePath("/sell");
  revalidatePath("/games/[slug]", "page");

  return {
    games: catalogSeedData.games.length,
    createdGames,
    createdCategories,
  };
}

export async function GET(request: Request) {
  try {
    const authorizationError = authorizeSeedRequest(request);

    if (authorizationError) {
      return authorizationError;
    }

    const result = await seedCatalog();

    return NextResponse.json({
      ok: true,
      ...result,
    });
  } catch (error) {
    console.error("[CATALOG_SEED_GET_ERROR]", error);

    return NextResponse.json(
      { ok: false, message: "Не удалось заполнить каталог игр." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const authorizationError = authorizeSeedRequest(request);

    if (authorizationError) {
      return authorizationError;
    }

    const result = await seedCatalog();

    return NextResponse.json({
      ok: true,
      ...result,
    });
  } catch (error) {
    console.error("[CATALOG_SEED_POST_ERROR]", error);

    return NextResponse.json(
      { ok: false, message: "Не удалось заполнить каталог игр." },
      { status: 500 },
    );
  }
}