import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { OrdersHubClient } from "@/components/order/orders-hub-client";
import { getCurrentSessionUser } from "@/lib/access-control";
import { getAuthSession } from "@/lib/auth";
import {
  getOrderPartyDisplayName,
  type OrdersHubOrderItem,
} from "@/lib/orders-hub";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Мои заказы | SafeLoot Market",
  description:
    "Центр управления покупками и продажами SafeLoot с поиском, статусами и быстрым переходом в чат сделки.",
};

export default async function OrdersPage() {
  const session = await getAuthSession();
  const currentUser = await getCurrentSessionUser(session);

  if (!currentUser?.id) {
    redirect("/login?callbackUrl=/orders");
  }

  if (currentUser.isBanned) {
    redirect("/");
  }

  const orders = await prisma.order.findMany({
    where: {
      OR: [{ buyerId: currentUser.id }, { sellerId: currentUser.id }],
    },
    select: {
      id: true,
      buyerId: true,
      sellerId: true,
      status: true,
      price: true,
      currency: true,
      createdAt: true,
      updatedAt: true,
      product: {
        select: {
          id: true,
          title: true,
        },
      },
      buyer: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      seller: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
  });

  const purchases = orders
    .filter((order) => order.buyerId === currentUser.id)
    .map(
      (order) =>
        ({
          id: order.id,
          status: order.status,
          price: order.price.toString(),
          currency: order.currency,
          createdAt: order.createdAt.toISOString(),
          updatedAt: order.updatedAt.toISOString(),
          productId: order.product.id,
          productTitle: order.product.title,
          counterparty: {
            id: order.seller.id,
            name: getOrderPartyDisplayName(order.seller),
            email: order.seller.email,
          },
        }) satisfies OrdersHubOrderItem,
    );

  const sales = orders
    .filter((order) => order.sellerId === currentUser.id)
    .map(
      (order) =>
        ({
          id: order.id,
          status: order.status,
          price: order.price.toString(),
          currency: order.currency,
          createdAt: order.createdAt.toISOString(),
          updatedAt: order.updatedAt.toISOString(),
          productId: order.product.id,
          productTitle: order.product.title,
          counterparty: {
            id: order.buyer.id,
            name: getOrderPartyDisplayName(order.buyer),
            email: order.buyer.email,
          },
        }) satisfies OrdersHubOrderItem,
    );

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
      <OrdersHubClient
        purchases={purchases}
        sales={sales}
        accountEmail={session?.user?.email ?? null}
      />
    </main>
  );
}