"use server";

import { OrderStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  getCurrentSessionUser,
  hasActiveAdminAccess,
} from "@/lib/access-control";
import { getAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export interface AdminActionResult {
  ok: boolean;
  message?: string;
}

async function requireAdminAccess() {
  const session = await getAuthSession();
  const currentUser = await getCurrentSessionUser(session);

  if (!hasActiveAdminAccess(currentUser)) {
    redirect("/");
  }

  return currentUser;
}

export async function toggleBanUser(
  userId: string,
  currentStatus: boolean,
): Promise<AdminActionResult> {
  await requireAdminAccess();

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
    },
  });

  if (!user) {
    return {
      ok: false,
      message: "Пользователь не найден.",
    };
  }

  await prisma.user.update({
    where: {
      id: normalizedUserId,
    },
    data: {
      isBanned: !currentStatus,
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