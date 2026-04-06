"use server";

import { OrderStatus, Prisma, Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  getCurrentSessionUser,
  hasActiveAdminAccess,
} from "@/lib/access-control";
import { getAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSuperAdminRole, isTeamRole, ROLE_OPTIONS } from "@/lib/roles";

export interface AdminActionResult {
  ok: boolean;
  message?: string;
}

async function requireAdminAccess() {
  const session = await getAuthSession();
  const currentUser = await getCurrentSessionUser(session);

  if (!currentUser) {
    redirect("/");
  }

  if (!hasActiveAdminAccess(currentUser)) {
    redirect("/");
  }

  return currentUser;
}

async function requireSuperAdminAccess() {
  const session = await getAuthSession();
  const currentUser = await getCurrentSessionUser(session);

  if (!currentUser || currentUser.isBanned || !isSuperAdminRole(currentUser.role)) {
    throw new Error("Нет прав");
  }

  return currentUser;
}

export async function changeUserRole(
  userId: string,
  newRole: Role,
): Promise<AdminActionResult> {
  const currentUser = await requireSuperAdminAccess();
  const normalizedUserId = userId.trim();

  if (!normalizedUserId) {
    return {
      ok: false,
      message: "Не удалось определить пользователя.",
    };
  }

  if (!ROLE_OPTIONS.includes(newRole)) {
    return {
      ok: false,
      message: "Недопустимая роль.",
    };
  }

  if (normalizedUserId === currentUser.id) {
    return {
      ok: false,
      message: "Нельзя изменить свою роль.",
    };
  }

  const user = await prisma.user.findUnique({
    where: {
      id: normalizedUserId,
    },
    select: {
      id: true,
      role: true,
    },
  });

  if (!user) {
    return {
      ok: false,
      message: "Пользователь не найден.",
    };
  }

  if (user.role === newRole) {
    return {
      ok: true,
    };
  }

  await prisma.user.update({
    where: {
      id: normalizedUserId,
    },
    data: {
      role: newRole,
    },
  });

  revalidatePath("/admin");
  revalidatePath(`/user/${normalizedUserId}`);

  return {
    ok: true,
  };
}

export async function toggleBanUser(
  userId: string,
  _currentStatus: boolean,
): Promise<AdminActionResult> {
  const currentUser = await requireAdminAccess();

  const normalizedUserId = userId.trim();

  if (!normalizedUserId) {
    return {
      ok: false,
      message: "Не удалось определить пользователя.",
    };
  }

  const user = await prisma.user.findUnique({
    where: {
      id: normalizedUserId,
    },
    select: {
      id: true,
      role: true,
      isBanned: true,
    },
  });

  if (!user) {
    return {
      ok: false,
      message: "Пользователь не найден.",
    };
  }

  if (currentUser.role === "MODERATOR" && isTeamRole(user.role)) {
    return {
      ok: false,
      message: "Модератор не может банить сотрудников команды.",
    };
  }

  await prisma.user.update({
    where: {
      id: normalizedUserId,
    },
    data: {
      isBanned: !user.isBanned,
    },
  });

  revalidatePath("/admin");

  return {
    ok: true,
  };
}

export async function deleteProductAdmin(
  productId: string,
): Promise<AdminActionResult> {
  await requireAdminAccess();

  const normalizedProductId = productId.trim();

  if (!normalizedProductId) {
    return {
      ok: false,
      message: "Не удалось определить товар.",
    };
  }

  const product = await prisma.product.findUnique({
    where: {
      id: normalizedProductId,
    },
    select: {
      id: true,
      _count: {
        select: {
          orders: true,
        },
      },
      orders: {
        where: {
          status: {
            notIn: [OrderStatus.COMPLETED, OrderStatus.CANCELLED],
          },
        },
        select: {
          id: true,
        },
        take: 1,
      },
    },
  });

  if (!product) {
    return {
      ok: false,
      message: "Товар не найден.",
    };
  }

  if (product.orders.length > 0) {
    return {
      ok: false,
      message: "Нельзя удалить товар, пока у него есть активные сделки.",
    };
  }

  if (product._count.orders > 0) {
    return {
      ok: false,
      message: "Нельзя удалить товар с историей сделок.",
    };
  }

  await prisma.product.delete({
    where: {
      id: normalizedProductId,
    },
  });

  revalidatePath("/");
  revalidatePath("/profile");
  revalidatePath("/admin");

  return {
    ok: true,
  };
}

export async function releaseUserHoldBalance(
  userId: string,
): Promise<AdminActionResult> {
  await requireAdminAccess();

  const normalizedUserId = userId.trim();

  if (!normalizedUserId) {
    return {
      ok: false,
      message: "Не удалось определить пользователя.",
    };
  }

  try {
    await prisma.$transaction(
      async (transactionClient) => {
        const user = await transactionClient.user.findUnique({
          where: {
            id: normalizedUserId,
          },
          select: {
            id: true,
            holdBalance: true,
          },
        });

        if (!user) {
          throw new Error("Пользователь не найден.");
        }

        if (user.holdBalance.lte(new Prisma.Decimal(0))) {
          throw new Error("У пользователя нет средств в холде.");
        }

        await transactionClient.user.update({
          where: {
            id: normalizedUserId,
          },
          data: {
            availableBalance: {
              increment: user.holdBalance,
            },
            holdBalance: {
              decrement: user.holdBalance,
            },
          },
        });
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );

    revalidatePath("/admin");
    revalidatePath("/profile");

    return {
      ok: true,
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error ? error.message : "Не удалось снять холд пользователя.",
    };
  }
}