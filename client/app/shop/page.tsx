import type { Role } from "@prisma/client";

import { getCurrentSessionUser } from "@/lib/access-control";
import { getAuthSession } from "@/lib/auth";
import { getCosmeticsShopState } from "@/lib/domain/cosmetics";
import { ShopPageClient } from "@/app/shop/shop-page-client";

export const dynamic = "force-dynamic";

function getShopUserRole(role: Role | null | undefined) {
  return role ?? null;
}

export default async function ShopPage() {
  const currentUser = await getCurrentSessionUser(await getAuthSession());
  const shopState = await getCosmeticsShopState(currentUser?.id ?? null);

  return (
    <ShopPageClient
        initialState={shopState}
        currentUserRole={getShopUserRole(currentUser?.role)}
      />
  );
}