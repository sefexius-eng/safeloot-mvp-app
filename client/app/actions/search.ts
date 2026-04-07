"use server";

import type { Role } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export interface SearchGameResult {
  id: string;
  name: string;
  slug: string;
  imageUrl: string | null;
}

export interface SearchCategoryResult {
  id: string;
  name: string;
  slug: string;
  gameName: string;
  gameSlug: string;
  gameImageUrl: string | null;
}

export interface SearchCatalogResult {
  games: SearchGameResult[];
  categories: SearchCategoryResult[];
}

export interface SearchUserResult {
  id: string;
  name: string;
  email: string;
  image: string | null;
  role: Role;
}

export async function searchCatalog(query: string): Promise<SearchCatalogResult> {
  const normalizedQuery = query.trim();

  if (!normalizedQuery) {
    return {
      games: [],
      categories: [],
    };
  }

  const [games, categories] = await Promise.all([
    prisma.game.findMany({
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
    }),
    prisma.category.findMany({
      where: {
        name: {
          contains: normalizedQuery,
          mode: "insensitive",
        },
      },
      take: 6,
      orderBy: {
        name: "asc",
      },
      select: {
        id: true,
        name: true,
        slug: true,
        game: {
          select: {
            slug: true,
            name: true,
            imageUrl: true,
          },
        },
      },
    }),
  ]);

  return {
    games,
    categories: categories.map((category) => ({
      id: category.id,
      name: category.name,
      slug: category.slug,
      gameName: category.game.name,
      gameSlug: category.game.slug,
      gameImageUrl: category.game.imageUrl,
    })),
  };
}

export async function searchUsers(query: string): Promise<SearchUserResult[]> {
  const normalizedQuery = query.trim();

  if (!normalizedQuery) {
    return [];
  }

  const users = await prisma.user.findMany({
    where: {
      OR: [
        {
          name: {
            contains: normalizedQuery,
            mode: "insensitive",
          },
        },
        {
          email: {
            contains: normalizedQuery,
            mode: "insensitive",
          },
        },
      ],
    },
    take: 8,
    orderBy: {
      name: "asc",
    },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      role: true,
    },
  });

  return users.map((user) => ({
    id: user.id,
    name: user.name?.trim() || user.email.split("@")[0],
    email: user.email,
    image: user.image,
    role: user.role,
  }));
}