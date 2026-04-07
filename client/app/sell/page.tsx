import { redirect } from "next/navigation";

import { SellPageClient } from "@/components/sell/sell-page-client";
import { getCurrentSessionUser } from "@/lib/access-control";
import { getAuthSession } from "@/lib/auth";
import { listCatalogGamesForProductForms } from "@/lib/marketplace";

export default async function SellPage() {
  const currentUser = await getCurrentSessionUser(await getAuthSession());

  if (currentUser?.isBanned) {
    redirect("/");
  }

  const games = await listCatalogGamesForProductForms();

  return <SellPageClient games={games} />;
}