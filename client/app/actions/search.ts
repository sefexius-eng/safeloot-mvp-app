"use server";

import { prisma } from "@/lib/prisma";

export async function searchGames(query: string) {
  const normalizedQuery = query.trim();

  if (!normalizedQuery) {
    return [];
  }

  return prisma.game.findMany({
    where: {
      name: {
        contains: normalizedQuery,
        mode: "insensitive",
      },
    },
    take: 5,
    orderBy: {
      name: "asc",
    },
    select: {
      id: true,
      name: true,
      slug: true,
      imageUrl: true,
    },
  });
}