import type { Metadata } from "next";
import { redirect } from "next/navigation";

import {
  AdminDeleteProductButton,
  AdminReleaseHoldButton,
  AdminToggleBanButton,
  AdminWithdrawalActionButtons,
} from "@/components/admin/admin-action-buttons";
import {
  AdminSafeModeToggle,
} from "@/components/admin/admin-safe-mode";
import CensoredText from "@/components/censored-text";
import { PlatformRevenueCard } from "@/components/admin/platform-revenue-card";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  getCurrentSessionUser,
  hasActiveAdminAccess,
  isAdminRole,
} from "@/lib/access-control";
import { getAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getWithdrawalStatusMeta } from "@/lib/withdrawals";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin Dashboard | SafeLoot Market",
  description: "Панель управления администратора маркетплейса SafeLoot.",
};

function formatUserName(email: string, name?: string | null) {
  const normalizedName = name?.trim();

  if (normalizedName) {
    return normalizedName;
  }

  const localPart = email.split("@")[0]?.trim() ?? "";

  if (!localPart) {
    return "Пользователь";
  }

  return localPart
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (symbol) => symbol.toUpperCase());
}

function formatAmount(value: unknown) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return String(value);
  }

  return new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 8,
  }).format(numericValue);
}

function getRoleBadgeVariant(role: string) {
  return role === "ADMIN" || role === "SUPER_ADMIN" ? "info" : "secondary";
}

function getBanBadgeVariant(isBanned: boolean) {
  return isBanned ? "destructive" : "success";
}

function getBanStatusLabel(isBanned: boolean) {
  return isBanned ? "Заблокирован" : "Активен";
}

function getOrderStatusMeta(status?: string) {
  switch (status) {
    case "PENDING":
      return {
        label: "Ожидает оплаты",
        variant: "warning" as const,
      };
    case "PAID":
      return {
        label: "В сделке",
        variant: "info" as const,
      };
    case "DELIVERED":
      return {
        label: "Передан",
        variant: "info" as const,
      };
    case "COMPLETED":
      return {
        label: "Завершен",
        variant: "success" as const,
      };
    case "DISPUTED":
      return {
        label: "Спор",
        variant: "destructive" as const,
      };
    case "REFUNDED":
      return {
        label: "Возврат",
        variant: "warning" as const,
      };
    case "CANCELLED":
      return {
        label: "Отменен",
        variant: "secondary" as const,
      };
    default:
      return {
        label: "В продаже",
        variant: "success" as const,
      };
  }
}

export default async function AdminDashboardPage() {
  const session = await getAuthSession();
  const currentUser = await getCurrentSessionUser(session);

  if (!currentUser || !hasActiveAdminAccess(currentUser)) {
    redirect("/");
  }

  const [users, products, orders, pendingWithdrawals, disputedOrders] = await Promise.all([
    prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        availableBalance: true,
        holdBalance: true,
        role: true,
        isBanned: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    }),
    prisma.product.findMany({
      select: {
        id: true,
        title: true,
        game: {
          select: {
            name: true,
          },
        },
        category: {
          select: {
            name: true,
          },
        },
        price: true,
        seller: {
          select: {
            email: true,
            name: true,
            rank: true,
          },
        },
        orders: {
          select: {
            status: true,
          },
          orderBy: {
            createdAt: "desc",
          },
          take: 1,
        },
        _count: {
          select: {
            orders: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    }),
    prisma.order.findMany({
      include: {
        product: {
          include: {
            game: {
              select: {
                name: true,
              },
            },
            category: {
              select: {
                name: true,
              },
            },
          },
        },
        buyer: true,
        seller: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    }),
    prisma.withdrawal.findMany({
      where: {
        status: "PENDING",
      },
      select: {
        id: true,
        amount: true,
        paymentMethod: true,
        paymentDetails: true,
        status: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    }),
    prisma.order.findMany({
      where: {
        status: "DISPUTED",
      },
      include: {
        buyer: true,
        seller: true,
        product: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    }),
  ]);

  const adminCount = users.filter(
    (user) => user.role === "ADMIN" || user.role === "SUPER_ADMIN",
  ).length;
  const bannedCount = users.filter((user) => user.isBanned).length;
  const productsInOrdersCount = products.filter(
    (product) => product._count.orders > 0,
  ).length;
  const activeOrdersCount = orders.filter(
    (order) =>
      order.status !== "COMPLETED" &&
      order.status !== "CANCELLED" &&
      order.status !== "REFUNDED",
  ).length;
  const pendingWithdrawalsCount = pendingWithdrawals.length;
  const disputedOrdersCount = disputedOrders.length;
  const canUseSafeMode = isAdminRole(currentUser.role);

  return (
    <main className="mx-auto flex w-full max-w-[92rem] flex-col gap-8 px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
      <section className="overflow-hidden rounded-[2.5rem] border border-white/10 bg-[linear-gradient(145deg,rgba(249,115,22,0.14),rgba(15,23,42,0.88)_38%,rgba(14,165,233,0.12))] p-6 shadow-[0_32px_100px_rgba(0,0,0,0.34)] md:p-8 lg:p-10">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.5fr)_360px] lg:items-end">
          <div>
            <Badge variant="default">Admin Control Center</Badge>
            <h1 className="mt-4 max-w-4xl text-3xl font-semibold tracking-tight text-white md:text-5xl md:leading-[1.02]">
              Панель управления маркетплейсом
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-zinc-300 md:text-base">
              Управляйте пользователями, отслеживайте состояние каталога и контролируйте рисковые объекты из одной защищённой админ-зоны.
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-3 text-sm text-zinc-300">
              <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2">
                Администратор: <span className="font-semibold text-white">{session?.user?.email ?? "неизвестно"}</span>
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2">
                Доступ подтвержден по роли <span className="font-semibold text-white">ADMIN / SUPER_ADMIN</span>
              </span>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            {canUseSafeMode ? <AdminSafeModeToggle /> : null}
            <PlatformRevenueCard revenue={session?.user?.platformRevenue ?? 0} />
            <Card className="bg-black/20 shadow-none">
              <CardHeader className="gap-1 p-5">
                <CardDescription>Пользователи</CardDescription>
                <CardTitle className="text-3xl">{users.length}</CardTitle>
              </CardHeader>
            </Card>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-2">
              <Card className="bg-black/20 shadow-none">
                <CardHeader className="gap-1 p-5">
                  <CardDescription>Админы</CardDescription>
                  <CardTitle className="text-2xl">{adminCount}</CardTitle>
                </CardHeader>
              </Card>
              <Card className="bg-black/20 shadow-none">
                <CardHeader className="gap-1 p-5">
                  <CardDescription>Баны</CardDescription>
                  <CardTitle className="text-2xl">{bannedCount}</CardTitle>
                </CardHeader>
              </Card>
              <Card className="bg-black/20 shadow-none sm:col-span-2 lg:col-span-2">
                <CardHeader className="gap-1 p-5">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <CardDescription>Товары в каталоге</CardDescription>
                      <CardTitle className="text-2xl">{products.length}</CardTitle>
                      <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">
                        В сделках: {productsInOrdersCount}
                      </p>
                    </div>
                    <div>
                      <CardDescription>Сделки</CardDescription>
                      <CardTitle className="text-2xl">{orders.length}</CardTitle>
                      <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">
                        Активные: {activeOrdersCount}
                      </p>
                      <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">
                        Споры: {disputedOrdersCount}
                      </p>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-8 lg:grid-cols-[260px_minmax(0,1fr)] lg:items-start">
        <aside className="lg:sticky lg:top-24">
          <Card>
            <CardHeader>
              <CardDescription>Навигация</CardDescription>
              <CardTitle className="text-xl">Секции дашборда</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <a
                href="#users"
                className="flex items-center justify-between rounded-[1.25rem] border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-zinc-100 transition hover:bg-white/10"
              >
                <span>Пользователи</span>
                <Badge variant="secondary">{users.length}</Badge>
              </a>
              <a
                href="#products"
                className="flex items-center justify-between rounded-[1.25rem] border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-zinc-100 transition hover:bg-white/10"
              >
                <span>Товары</span>
                <Badge variant="secondary">{products.length}</Badge>
              </a>
              <a
                href="#orders"
                className="flex items-center justify-between rounded-[1.25rem] border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-zinc-100 transition hover:bg-white/10"
              >
                <span>Сделки</span>
                <Badge variant="secondary">{orders.length}</Badge>
              </a>
              <a
                href="#disputes"
                className="flex items-center justify-between rounded-[1.25rem] border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-zinc-100 transition hover:bg-white/10"
              >
                <span>Активные споры</span>
                <Badge variant={disputedOrdersCount > 0 ? "destructive" : "secondary"}>
                  {disputedOrdersCount}
                </Badge>
              </a>
              <a
                href="#withdrawals"
                className="flex items-center justify-between rounded-[1.25rem] border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-zinc-100 transition hover:bg-white/10"
              >
                <span>Заявки на вывод</span>
                <Badge variant={pendingWithdrawalsCount > 0 ? "warning" : "secondary"}>
                  {pendingWithdrawalsCount}
                </Badge>
              </a>
              <div className="rounded-[1.5rem] border border-sky-500/15 bg-sky-500/5 p-4 text-sm leading-7 text-zinc-300">
                Блокировка пользователей и удаление товаров уже подключены через server actions с автоматическим обновлением панели.
              </div>
            </CardContent>
          </Card>
        </aside>

        <div className="space-y-8">
          <section id="users" className="scroll-mt-24">
            <Card>
              <CardHeader className="border-b border-white/10">
                <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                  <div>
                    <CardDescription>User Management</CardDescription>
                    <CardTitle>Пользователи</CardTitle>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="info">Администраторы: {adminCount}</Badge>
                    <Badge variant={bannedCount > 0 ? "destructive" : "success"}>
                      Бан-лист: {bannedCount}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="overflow-hidden rounded-[1.5rem] border border-white/10 bg-black/10">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Имя</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Баланс</TableHead>
                          <TableHead>Роль</TableHead>
                          <TableHead>Статус бана</TableHead>
                          <TableHead className="text-right">Действие</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {users.map((user) => (
                          <TableRow key={user.id}>
                            <TableCell>
                              <div className="space-y-1">
                                <p className="font-semibold text-white">
                                  <CensoredText text={formatUserName(user.email, user.name)} />
                                </p>
                                <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">
                                  ID: {user.id.slice(0, 10)}...
                                </p>
                              </div>
                            </TableCell>
                            <TableCell className="text-zinc-300">{user.email}</TableCell>
                            <TableCell>
                              <div className="space-y-1">
                                <p>
                                  <span className="text-zinc-500">Доступно:</span>{" "}
                                  <span className="font-semibold text-white">
                                    {formatAmount(user.availableBalance)} USDT
                                  </span>
                                </p>
                                <p>
                                  <span className="text-zinc-500">Холд:</span>{" "}
                                  <span className="font-semibold text-white">
                                    {formatAmount(user.holdBalance)} USDT
                                  </span>
                                </p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant={getRoleBadgeVariant(user.role)}>{user.role}</Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant={getBanBadgeVariant(user.isBanned)}>
                                {getBanStatusLabel(user.isBanned)}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex flex-col items-end gap-3">
                                <AdminReleaseHoldButton
                                  userId={user.id}
                                  canRelease={Number(user.holdBalance) > 0}
                                />
                                <AdminToggleBanButton
                                  userId={user.id}
                                  currentStatus={user.isBanned}
                                />
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>

          <section id="products" className="scroll-mt-24">
            <Card>
              <CardHeader className="border-b border-white/10">
                <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                  <div>
                    <CardDescription>Catalog Moderation</CardDescription>
                    <CardTitle>Товары</CardTitle>
                  </div>
                  <Badge variant="secondary">Связаны со сделками: {productsInOrdersCount}</Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="overflow-hidden rounded-[1.5rem] border border-white/10 bg-black/10">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Товар</TableHead>
                          <TableHead>Продавец</TableHead>
                          <TableHead>Цена</TableHead>
                          <TableHead>Категория</TableHead>
                          <TableHead>Статус</TableHead>
                          <TableHead className="text-right">Действие</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {products.map((product) => {
                          const latestOrderStatus = product.orders[0]?.status;
                          const statusMeta = getOrderStatusMeta(latestOrderStatus);
                          const canDelete = product._count.orders === 0;

                          return (
                            <TableRow key={product.id}>
                              <TableCell>
                                <div className="space-y-1">
                                  <p className="font-semibold text-white">
                                    <CensoredText text={product.title} />
                                  </p>
                                  <p className="text-sm text-zinc-400">{product.game.name}</p>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="space-y-1">
                                  <p className="text-zinc-200">
                                    <CensoredText
                                      text={formatUserName(product.seller.email, product.seller.name)}
                                    />
                                  </p>
                                  <p className="text-xs text-zinc-500">{product.seller.email}</p>
                                  <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">
                                    Rank: {product.seller.rank}
                                  </p>
                                </div>
                              </TableCell>
                              <TableCell>
                                <span className="font-semibold text-white">
                                  {formatAmount(product.price)} USDT
                                </span>
                              </TableCell>
                              <TableCell>
                                <Badge variant="secondary">{product.category.name}</Badge>
                              </TableCell>
                              <TableCell>
                                <div className="space-y-2">
                                  <Badge variant={statusMeta.variant}>{statusMeta.label}</Badge>
                                  <p className="text-xs text-zinc-500">
                                    Заказов: {product._count.orders}
                                  </p>
                                </div>
                              </TableCell>
                              <TableCell className="text-right">
                                <AdminDeleteProductButton
                                  productId={product.id}
                                  canDelete={canDelete}
                                />
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>

          <section id="orders" className="scroll-mt-24">
            <Card>
              <CardHeader className="border-b border-white/10">
                <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                  <div>
                    <CardDescription>Order Monitoring</CardDescription>
                    <CardTitle>Сделки</CardTitle>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="info">Всего: {orders.length}</Badge>
                    <Badge variant={activeOrdersCount > 0 ? "warning" : "success"}>
                      Активные: {activeOrdersCount}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="overflow-hidden rounded-[1.5rem] border border-white/10 bg-black/10">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>ID заказа</TableHead>
                          <TableHead>Товар</TableHead>
                          <TableHead>Покупатель</TableHead>
                          <TableHead>Продавец</TableHead>
                          <TableHead>Статус заказа</TableHead>
                          <TableHead className="text-right">Цена</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {orders.map((order) => {
                          const statusMeta = getOrderStatusMeta(order.status);

                          return (
                            <TableRow key={order.id}>
                              <TableCell>
                                <div className="space-y-1">
                                  <p className="font-mono text-xs text-zinc-300">{order.id}</p>
                                  <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">
                                    {new Intl.DateTimeFormat("ru-RU", {
                                      dateStyle: "medium",
                                      timeStyle: "short",
                                    }).format(order.createdAt)}
                                  </p>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="space-y-1">
                                  <p className="font-semibold text-white">
                                    <CensoredText text={order.product.title} />
                                  </p>
                                  <p className="text-sm text-zinc-400">
                                    {order.product.game.name} / {order.product.category.name}
                                  </p>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="space-y-1 text-zinc-300">
                                  <p>
                                    <CensoredText
                                      text={formatUserName(order.buyer.email, order.buyer.name)}
                                    />
                                  </p>
                                  <p className="text-xs text-zinc-500">{order.buyer.email}</p>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="space-y-1 text-zinc-300">
                                  <p>
                                    <CensoredText
                                      text={formatUserName(order.seller.email, order.seller.name)}
                                    />
                                  </p>
                                  <p className="text-xs text-zinc-500">{order.seller.email}</p>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant={statusMeta.variant}>{statusMeta.label}</Badge>
                              </TableCell>
                              <TableCell className="text-right font-semibold text-white">
                                {formatAmount(order.price)} USDT
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>

          <section id="disputes" className="scroll-mt-24">
            <Card>
              <CardHeader className="border-b border-white/10">
                <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                  <div>
                    <CardDescription>Dispute Resolution</CardDescription>
                    <CardTitle>Активные споры</CardTitle>
                  </div>
                  <Badge variant={disputedOrdersCount > 0 ? "destructive" : "secondary"}>
                    Открыто: {disputedOrdersCount}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                {disputedOrders.length === 0 ? (
                  <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-6 text-sm leading-7 text-zinc-400">
                    Сейчас нет сделок со статусом DISPUTED.
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-[1.5rem] border border-white/10 bg-black/10">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>ID заказа</TableHead>
                            <TableHead>Товар</TableHead>
                            <TableHead>Покупатель</TableHead>
                            <TableHead>Продавец</TableHead>
                            <TableHead className="text-right">Цена</TableHead>
                            <TableHead className="text-right">Действие</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {disputedOrders.map((order) => (
                            <TableRow key={order.id}>
                              <TableCell>
                                <div className="space-y-1">
                                  <p className="font-mono text-xs text-zinc-300">{order.id}</p>
                                  <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">
                                    {new Intl.DateTimeFormat("ru-RU", {
                                      dateStyle: "medium",
                                      timeStyle: "short",
                                    }).format(order.createdAt)}
                                  </p>
                                </div>
                              </TableCell>
                              <TableCell>
                                <p className="font-semibold text-white">
                                  <CensoredText text={order.product.title} />
                                </p>
                              </TableCell>
                              <TableCell className="text-zinc-300">
                                <CensoredText
                                  text={formatUserName(order.buyer.email, order.buyer.name)}
                                />
                              </TableCell>
                              <TableCell className="text-zinc-300">
                                <CensoredText
                                  text={formatUserName(order.seller.email, order.seller.name)}
                                />
                              </TableCell>
                              <TableCell className="text-right font-semibold text-white">
                                {formatAmount(order.price)} USDT
                              </TableCell>
                              <TableCell className="text-right">
                                <a
                                  href={`/orders/${order.id}`}
                                  className="inline-flex h-10 items-center justify-center rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 text-sm font-semibold text-amber-100 transition hover:bg-amber-500/20"
                                >
                                  Перейти в чат сделки
                                </a>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </section>

          <section id="withdrawals" className="scroll-mt-24">
            <Card>
              <CardHeader className="border-b border-white/10">
                <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                  <div>
                    <CardDescription>Payout Moderation</CardDescription>
                    <CardTitle>Заявки на вывод</CardTitle>
                  </div>
                  <Badge variant={pendingWithdrawalsCount > 0 ? "warning" : "success"}>
                    Pending: {pendingWithdrawalsCount}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                {pendingWithdrawals.length === 0 ? (
                  <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-6 text-sm leading-7 text-zinc-400">
                    Сейчас нет заявок на вывод со статусом PENDING.
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-[1.5rem] border border-white/10 bg-black/10">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Никнейм</TableHead>
                            <TableHead>Сумма</TableHead>
                            <TableHead>Метод</TableHead>
                            <TableHead>Реквизиты</TableHead>
                            <TableHead>Статус</TableHead>
                            <TableHead>Создана</TableHead>
                            <TableHead className="text-right">Действие</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {pendingWithdrawals.map((withdrawal) => {
                            const statusMeta = getWithdrawalStatusMeta(withdrawal.status);

                            return (
                              <TableRow key={withdrawal.id}>
                                <TableCell>
                                  <div className="space-y-1">
                                    <p className="font-semibold text-white">
                                      <CensoredText
                                        text={formatUserName(withdrawal.user.email, withdrawal.user.name)}
                                      />
                                    </p>
                                    <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">
                                      {withdrawal.user.email}
                                    </p>
                                  </div>
                                </TableCell>
                                <TableCell className="font-semibold text-white">
                                  {formatAmount(withdrawal.amount)} USDT
                                </TableCell>
                                <TableCell className="text-zinc-300">
                                  {withdrawal.paymentMethod}
                                </TableCell>
                                <TableCell>
                                  <p className="max-w-[320px] break-all text-sm leading-6 text-zinc-300">
                                    {withdrawal.paymentDetails}
                                  </p>
                                </TableCell>
                                <TableCell>
                                  <Badge variant={statusMeta.variant}>{statusMeta.label}</Badge>
                                </TableCell>
                                <TableCell>
                                  <p className="text-sm text-zinc-300">
                                    {new Intl.DateTimeFormat("ru-RU", {
                                      dateStyle: "medium",
                                      timeStyle: "short",
                                    }).format(withdrawal.createdAt)}
                                  </p>
                                </TableCell>
                                <TableCell className="text-right">
                                  <AdminWithdrawalActionButtons withdrawalId={withdrawal.id} />
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </section>
        </div>
      </div>
    </main>
  );
}