import { redirect } from "next/navigation";

import { SellPageClient } from "@/components/sell/sell-page-client";
import { getCurrentSessionUser } from "@/lib/access-control";
import { getAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function SellPage() {
  const currentUser = await getCurrentSessionUser(await getAuthSession());

  if (currentUser?.isBanned) {
    redirect("/");
  }

  const games = await prisma.game.findMany({
    include: {
      categories: {
        orderBy: {
          name: "asc",
        },
      },
    },
    orderBy: {
      name: "asc",
    },
  });

  return <SellPageClient games={games} />;
}