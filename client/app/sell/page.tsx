import { redirect } from "next/navigation";

import { SellPageClient } from "@/components/sell/sell-page-client";
import { SellVerificationBlocker } from "@/components/sell/sell-verification-blocker";
import { getCurrentSessionUser } from "@/lib/access-control";
import { getAuthSession } from "@/lib/auth";
import { listCatalogGamesForProductForms } from "@/lib/marketplace";

export default async function SellPage() {
  const session = await getAuthSession();
  const currentUser = await getCurrentSessionUser(session);

  if (currentUser?.isBanned) {
    redirect("/");
  }

  if (currentUser && !currentUser.emailVerified) {
    return (
      <SellVerificationBlocker email={session?.user?.email ?? "ваш email"} />
    );
  }

  const games = await listCatalogGamesForProductForms();

  return <SellPageClient games={games} />;
}