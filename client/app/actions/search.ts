"use server";

import type { Role } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export interface SearchGameResult {
  id: string;
  name: string;
  slug: string;
  imageUrl: string | null;
}

export interface SearchProductResult {
  id: string;
  title: string;
  imageUrl: string | null;
  gameName: string;
}

export interface SearchSellerResult {
  id: string;
  name: string;
  image: string | null;
  role: Role;
}

export interface SearchMarketplaceResult {
  games: SearchGameResult[];
  products: SearchProductResult[];
  sellers: SearchSellerResult[];
}

export async function searchMarketplace(query: string): Promise<SearchMarketplaceResult> {
  const normalizedQuery = query.trim();

  if (!normalizedQuery) {
    return {
      games: [],
      products: [],
      sellers: [],
    };
  }

  const [games, products, sellers] = await Promise.all([
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
    prisma.product.findMany({
      where: {
        isActive: true,
        title: {
          contains: normalizedQuery,
          mode: "insensitive",
        },
      },
      take: 5,
      orderBy: {
        updatedAt: "desc",
      },
      select: {
        id: true,
        title: true,
        images: true,
        game: {
          select: {
            name: true,
          },
        },
      },
    }),
    prisma.user.findMany({
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
        image: true,
        role: true,
      },
    }),
  ]);

  return {
    games,
    products: products.map((product) => ({
      id: product.id,
      title: product.title,
      imageUrl: product.images[0] ?? null,
      gameName: product.game.name,
    })),
    sellers: sellers.map((seller) => ({
      id: seller.id,
      name: seller.name?.trim() || "Продавец",
      image: seller.image,
      role: seller.role,
    })),
  };
}