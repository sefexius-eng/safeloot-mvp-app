const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const catalog = [
  {
    name: "CS2",
    slug: "cs2",
    categories: [
      { name: "Аккаунты", slug: "accounts" },
      { name: "Скины", slug: "skins" },
      { name: "Услуги", slug: "services" },
    ],
  },
  {
    name: "Dota 2",
    slug: "dota2",
    categories: [
      { name: "Аккаунты", slug: "accounts" },
      { name: "Предметы", slug: "items" },
      { name: "Рейтинг", slug: "rating" },
    ],
  },
  {
    name: "World of Warcraft",
    slug: "wow",
    categories: [
      { name: "Золото", slug: "gold" },
      { name: "Таймкарты", slug: "timecards" },
      { name: "Услуги", slug: "services" },
    ],
  },
];

async function main() {
  for (const game of catalog) {
    const upsertedGame = await prisma.game.upsert({
      where: { slug: game.slug },
      update: {
        name: game.name,
      },
      create: {
        name: game.name,
        slug: game.slug,
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

  console.log(`Seeded ${catalog.length} games with categories.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });