const { PrismaClient } = require("@prisma/client");
const cosmeticsSeedData = require("../lib/cosmetics-seed-data.json");

const prisma = new PrismaClient();

async function upsertCosmetic(cosmetic) {
  const existingCosmetic = await prisma.cosmetic.findFirst({
    where: {
      name: cosmetic.name,
      type: cosmetic.type,
    },
    select: {
      id: true,
    },
  });

  if (existingCosmetic) {
    return prisma.cosmetic.update({
      where: {
        id: existingCosmetic.id,
      },
      data: {
        price: cosmetic.price,
        value: cosmetic.value,
      },
    });
  }

  return prisma.cosmetic.create({
    data: {
      name: cosmetic.name,
      type: cosmetic.type,
      price: cosmetic.price,
      value: cosmetic.value,
    },
  });
}

async function main() {
  let seededCount = 0;

  for (const cosmetic of cosmeticsSeedData.cosmetics) {
    await upsertCosmetic(cosmetic);
    seededCount += 1;
  }

  console.log(`Seeded ${seededCount} cosmetics.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });