const { PrismaClient } = require("@prisma/client");
const catalogSeedData = require("../lib/catalog-seed-data.json");

const prisma = new PrismaClient();

async function main() {
  for (const game of catalogSeedData.games) {
    const upsertedGame = await prisma.game.upsert({
      where: { slug: game.slug },
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

    for (const category of game.categories) {
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
    }
  }

  console.log(`Seeded ${catalogSeedData.games.length} games with categories.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });