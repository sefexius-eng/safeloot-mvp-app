import type { Metadata } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { getAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin Dashboard | SafeLoot Market",
  description: "Панель управления администратора маркетплейса SafeLoot.",
};

async function deleteProductAction(formData: FormData) {
  "use server";

  const session = await getAuthSession();

  if (session?.user?.role !== "ADMIN") {
    redirect("/");
  }

  const productId = formData.get("productId")?.toString().trim() ?? "";

  if (!productId) {
    redirect("/admin");
  }

  const product = await prisma.product.findUnique({
    where: {
      id: productId,
    },
    select: {
      _count: {
        select: {
          orders: true,
        },
      },
    },
  });

  if (!product || product._count.orders > 0) {
    redirect("/admin");
  }

  await prisma.product.delete({
    where: {
      id: productId,
    },
  });

  revalidatePath("/");
  revalidatePath("/admin");
  redirect("/admin");
}

function formatUserName(email: string) {
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
  return role === "ADMIN" ? "info" : "secondary";
}

function getBanBadgeVariant(isBanned: boolean) {
  return isBanned ? "destructive" : "success";
}

function getBanStatusLabel(isBanned: boolean) {
  return isBanned ? "Заблокирован" : "Активен";
}

function getProductStatusMeta(status?: string) {
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

  if (session?.user?.role !== "ADMIN") {
    redirect("/");
  }

  const [users, products] = await Promise.all([
    prisma.user.findMany({
      select: {
        id: true,
        email: true,
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
        gameId: true,
        type: true,
        price: true,
        seller: {
          select: {
            email: true,
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
  ]);

  const adminCount = users.filter((user) => user.role === "ADMIN").length;
  const bannedCount = users.filter((user) => user.isBanned).length;
  const productsInOrdersCount = products.filter(
    (product) => product._count.orders > 0,
  ).length;

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
                Администратор: <span className="font-semibold text-white">{session.user.email}</span>
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2">
                Доступ подтвержден по роли <span className="font-semibold text-white">ADMIN</span>
              </span>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
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
                  <CardDescription>Товары в каталоге</CardDescription>
                  <CardTitle className="text-2xl">{products.length}</CardTitle>
                  <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">
                    В сделках: {productsInOrdersCount}
                  </p>
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
              <div className="rounded-[1.5rem] border border-sky-500/15 bg-sky-500/5 p-4 text-sm leading-7 text-zinc-300">
                Кнопка бана добавлена как UI-заготовка. Удаление товара доступно только для позиций без заказов.
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
                                <p className="font-semibold text-white">{formatUserName(user.email)}</p>
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
                              <Button
                                disabled
                                className="h-10 rounded-xl bg-zinc-800 text-zinc-500 shadow-none hover:translate-y-0 hover:bg-zinc-800"
                              >
                                Забанить
                              </Button>
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
                          <TableHead>Тип</TableHead>
                          <TableHead>Статус</TableHead>
                          <TableHead className="text-right">Действие</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {products.map((product) => {
                          const latestOrderStatus = product.orders[0]?.status;
                          const statusMeta = getProductStatusMeta(latestOrderStatus);
                          const canDelete = product._count.orders === 0;

                          return (
                            <TableRow key={product.id}>
                              <TableCell>
                                <div className="space-y-1">
                                  <p className="font-semibold text-white">{product.title}</p>
                                  <p className="text-sm text-zinc-400">Game ID: {product.gameId}</p>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="space-y-1">
                                  <p className="text-zinc-200">{product.seller.email}</p>
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
                                <Badge variant="secondary">{product.type}</Badge>
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
                                <form action={deleteProductAction} className="inline-flex">
                                  <input type="hidden" name="productId" value={product.id} />
                                  <Button
                                    type="submit"
                                    disabled={!canDelete}
                                    className={cn(
                                      "h-10 rounded-xl px-4 shadow-none",
                                      canDelete
                                        ? "bg-rose-600 text-white hover:bg-rose-500"
                                        : "bg-zinc-800 text-zinc-500 hover:translate-y-0 hover:bg-zinc-800",
                                    )}
                                  >
                                    Удалить
                                  </Button>
                                </form>
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
        </div>
      </div>
    </main>
  );
}