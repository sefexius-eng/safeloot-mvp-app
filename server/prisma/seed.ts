import dotenv from "dotenv";

dotenv.config({ override: true });

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.user.upsert({
    where: {
      id: "test-user-1",
    },
    update: {
      email: "test@safeloot.com",
      password: "hashedpassword",
    },
    create: {
      id: "test-user-1",
      email: "test@safeloot.com",
      password: "hashedpassword",
    },
  });

  await prisma.user.upsert({
    where: {
      id: "test-buyer-1",
    },
    update: {
      email: "buyer@safeloot.com",
      password: "hashedpassword",
    },
    create: {
      id: "test-buyer-1",
      email: "buyer@safeloot.com",
      password: "hashedpassword",
    },
  });

  console.log("Seed completed: test-user-1 and test-buyer-1 are ready.");
}

main()
  .catch((error) => {
    console.error("Seed failed.", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });