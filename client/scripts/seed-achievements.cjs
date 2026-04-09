const { PrismaClient } = require("@prisma/client");
const achievementsSeedData = require("../lib/achievements-seed-data.json");

const prisma = new PrismaClient();

async function upsertAchievement(achievement) {
  return prisma.achievement.upsert({
    where: {
      code: achievement.code,
    },
    update: {
      title: achievement.title,
      description: achievement.description,
      iconUrl: achievement.iconUrl,
      rarity: achievement.rarity,
    },
    create: {
      code: achievement.code,
      title: achievement.title,
      description: achievement.description,
      iconUrl: achievement.iconUrl,
      rarity: achievement.rarity,
    },
  });
}

async function main() {
  let seededCount = 0;

  for (const achievement of achievementsSeedData.achievements) {
    await upsertAchievement(achievement);
    seededCount += 1;
  }

  console.log(`Seeded ${seededCount} achievements.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });