"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  getCurrentSessionUser,
  hasActiveAdminAccess,
} from "@/lib/access-control";
import { getAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  isWithdrawalStatus,
  normalizeWithdrawalMethod,
} from "@/lib/withdrawals";

const MONEY_SCALE = 2;

export interface WithdrawalActionResult {
  ok: boolean;
  message?: string;
}

async function requireActiveUserId() {
  const session = await getAuthSession();
  const currentUser = await getCurrentSessionUser(session);

  if (!currentUser) {
    throw new Error("Unauthorized");
  }

  if (currentUser.isBanned) {
    throw new Error("Ваш аккаунт заблокирован. Вывод средств недоступен.");
  }

  return currentUser.id;
}

async function requireAdminAccess() {
  const session = await getAuthSession();
  const currentUser = await getCurrentSessionUser(session);

  if (!hasActiveAdminAccess(currentUser)) {
    redirect("/");
  }

  return currentUser;
}

function normalizeWithdrawalAmount(amount: number) {
  const numericAmount = Number(amount);

  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    return null;
  }

  return new Prisma.Decimal(numericAmount.toFixed(MONEY_SCALE));
}

function normalizePaymentDetails(details: string) {
  const normalizedDetails = details.trim();

  if (!normalizedDetails) {
    return null;
  }

  if (normalizedDetails.length > 160) {
    throw new Error("Реквизиты не должны превышать 160 символов.");
  }

  return normalizedDetails;
}

export async function requestWithdrawal(
  amount: number,
  method: string,
  details: string,
): Promise<WithdrawalActionResult> {
  try {
    const userId = await requireActiveUserId();
    const normalizedAmount = normalizeWithdrawalAmount(amount);
    const normalizedMethod = normalizeWithdrawalMethod(method);
    const normalizedDetails = normalizePaymentDetails(details);

    if (!normalizedAmount) {
      return {
        ok: false,
        message: "Введите корректную сумму вывода.",
      };
    }

    if (!normalizedMethod) {
      return {
        ok: false,
        message: "Выберите корректный способ вывода.",
      };
    }

    if (!normalizedDetails) {
      return {
        ok: false,
        message: "Укажите реквизиты для вывода.",
      };
    }

    await prisma.$transaction(
      async (transactionClient) => {
        const user = await transactionClient.user.findUnique({
          where: {
            id: userId,
          },
          select: {
            id: true,
            availableBalance: true,
          },
        });

        if (!user) {
          throw new Error("Пользователь не найден.");
        }

        if (user.availableBalance.lessThan(normalizedAmount)) {
          throw new Error("Недостаточно средств на доступном балансе.");
        }

        const updatedUser = await transactionClient.user.updateMany({
          where: {
            id: userId,
            availableBalance: {
              gte: normalizedAmount,
            },
          },
          data: {
            availableBalance: {
              decrement: normalizedAmount,
            },
          },
        });

        if (updatedUser.count !== 1) {
          throw new Error("Недостаточно средств на доступном балансе.");
        }

        await transactionClient.withdrawal.create({
          data: {
            amount: normalizedAmount,
            paymentMethod: normalizedMethod,
            paymentDetails: normalizedDetails,
            userId,
          },
        });
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );

    revalidatePath("/profile");
    revalidatePath("/admin");

    return {
      ok: true,
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error ? error.message : "Не удалось создать заявку на вывод.",
    };
  }
}

export async function adminApproveWithdrawal(
  id: string,
): Promise<WithdrawalActionResult> {
  try {
    await requireAdminAccess();
    const withdrawalId = id.trim();

    if (!withdrawalId) {
      return {
        ok: false,
        message: "Не удалось определить заявку на вывод.",
      };
    }

    const updatedWithdrawal = await prisma.withdrawal.updateMany({
      where: {
        id: withdrawalId,
        status: "PENDING",
      },
      data: {
        status: "COMPLETED",
      },
    });

    if (updatedWithdrawal.count !== 1) {
      return {
        ok: false,
        message: "Заявка уже обработана или не найдена.",
      };
    }

    revalidatePath("/admin");
    revalidatePath("/profile");

    return {
      ok: true,
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error ? error.message : "Не удалось подтвердить выплату.",
    };
  }
}

export async function adminRejectWithdrawal(
  id: string,
): Promise<WithdrawalActionResult> {
  try {
    await requireAdminAccess();
    const withdrawalId = id.trim();

    if (!withdrawalId) {
      return {
        ok: false,
        message: "Не удалось определить заявку на вывод.",
      };
    }

    await prisma.$transaction(
      async (transactionClient) => {
        const withdrawal = await transactionClient.withdrawal.findUnique({
          where: {
            id: withdrawalId,
          },
          select: {
            id: true,
            amount: true,
            userId: true,
            status: true,
          },
        });

        if (!withdrawal) {
          throw new Error("Заявка на вывод не найдена.");
        }

        if (!isWithdrawalStatus(withdrawal.status) || withdrawal.status !== "PENDING") {
          throw new Error("Заявка уже обработана и не может быть отклонена.");
        }

        const updatedWithdrawal = await transactionClient.withdrawal.updateMany({
          where: {
            id: withdrawal.id,
            status: "PENDING",
          },
          data: {
            status: "REJECTED",
          },
        });

        if (updatedWithdrawal.count !== 1) {
          throw new Error("Заявка уже обработана и не может быть отклонена.");
        }

        await transactionClient.user.update({
          where: {
            id: withdrawal.userId,
          },
          data: {
            availableBalance: {
              increment: withdrawal.amount,
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
        error instanceof Error ? error.message : "Не удалось отклонить заявку.",
    };
  }
}