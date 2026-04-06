import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import catalogSeedData from "@/lib/catalog-seed-data.json";
import { prisma } from "@/lib/prisma";

async function seedCatalog() {
  let createdGames = 0;
  let createdCategories = 0;

  for (const game of catalogSeedData.games) {
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
      },
      create: {
        name: game.name,
        slug: game.slug,
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

export async function GET() {
  try {
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

export async function POST() {
  try {
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