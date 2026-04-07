"use server";

import { Prisma, TransactionStatus, TransactionType } from "@prisma/client";
import { revalidatePath } from "next/cache";

import {
  BANNED_USER_MESSAGE,
  getCurrentSessionUser,
} from "@/lib/access-control";
import { getAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSuperAdminRole } from "@/lib/roles";

const MONEY_SCALE = 2;
const PROMO_CODE_PATTERN = /^[A-Z0-9_-]{4,32}$/;

export interface PromoCodeSummary {
  id: string;
  code: string;
  amount: number;
  maxUses: number;
  usedCount: number;
  createdAt: string;
}

export interface PromoCodeActionResult {
  ok: boolean;
  message?: string;
  promoCode?: PromoCodeSummary;
  creditedAmount?: string;
}

async function requireActivePromoUser() {
  const session = await getAuthSession();
  const currentUser = await getCurrentSessionUser(session);

  if (!currentUser) {
    throw new Error("Unauthorized");
  }

  if (currentUser.isBanned) {
    throw new Error(BANNED_USER_MESSAGE);
  }

  return currentUser;
}

async function requireSuperAdminPromoUser() {
  const currentUser = await requireActivePromoUser();

  if (!isSuperAdminRole(currentUser.role)) {
    throw new Error("Только SUPER_ADMIN может создавать промокоды.");
  }

  return currentUser;
}

function normalizePromoCode(code: string) {
  return code.trim().toUpperCase();
}

function normalizePromoAmount(amount: number) {
  const numericAmount = Number(amount);

  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    return null;
  }

  return Math.round((numericAmount + Number.EPSILON) * 100) / 100;
}

function normalizePromoMaxUses(maxUses: number) {
  const numericMaxUses = Number(maxUses);

  if (!Number.isInteger(numericMaxUses) || numericMaxUses <= 0) {
    return null;
  }

  return numericMaxUses;
}

function mapPromoCodeSummary(promoCode: {
  id: string;
  code: string;
  amount: number;
  maxUses: number;
  usedCount: number;
  createdAt: Date;
}): PromoCodeSummary {
  return {
    id: promoCode.id,
    code: promoCode.code,
    amount: promoCode.amount,
    maxUses: promoCode.maxUses,
    usedCount: promoCode.usedCount,
    createdAt: promoCode.createdAt.toISOString(),
  };
}

function revalidatePromoPaths() {
  revalidatePath("/admin");
  revalidatePath("/profile");
}

export async function createPromoCode(
  code: string,
  amount: number,
  maxUses: number,
): Promise<PromoCodeActionResult> {
  try {
    await requireSuperAdminPromoUser();

    const normalizedCode = normalizePromoCode(code);
    const normalizedAmount = normalizePromoAmount(amount);
    const normalizedMaxUses = normalizePromoMaxUses(maxUses);

    if (!normalizedCode) {
      return {
        ok: false,
        message: "Укажите текст промокода.",
      };
    }

    if (!PROMO_CODE_PATTERN.test(normalizedCode)) {
      return {
        ok: false,
        message: "Код должен содержать 4-32 символа: A-Z, 0-9, -, _.",
      };
    }

    if (normalizedAmount === null) {
      return {
        ok: false,
        message: "Укажите корректную сумму зачисления.",
      };
    }

    if (normalizedMaxUses === null) {
      return {
        ok: false,
        message: "Укажите корректное количество активаций.",
      };
    }

    const promoCode = await prisma.promoCode.create({
      data: {
        code: normalizedCode,
        amount: normalizedAmount,
        maxUses: normalizedMaxUses,
      },
      select: {
        id: true,
        code: true,
        amount: true,
        maxUses: true,
        usedCount: true,
        createdAt: true,
      },
    });

    revalidatePromoPaths();

    return {
      ok: true,
      message: "Промокод создан.",
      promoCode: mapPromoCodeSummary(promoCode),
    };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return {
        ok: false,
        message: "Промокод уже существует.",
      };
    }

    return {
      ok: false,
      message:
        error instanceof Error ? error.message : "Не удалось создать промокод.",
    };
  }
}

export async function redeemPromoCode(code: string): Promise<PromoCodeActionResult> {
  try {
    const currentUser = await requireActivePromoUser();
    const normalizedCode = normalizePromoCode(code);

    if (!normalizedCode) {
      return {
        ok: false,
        message: "Введите подарочный код.",
      };
    }

    const promoCode = await prisma.promoCode.findUnique({
      where: {
        code: normalizedCode,
      },
      select: {
        id: true,
        code: true,
        amount: true,
        maxUses: true,
        usedCount: true,
      },
    });

    if (!promoCode) {
      return {
        ok: false,
        message: "Код не существует",
      };
    }

    if (promoCode.usedCount >= promoCode.maxUses) {
      return {
        ok: false,
        message: "Лимит активаций исчерпан",
      };
    }

    const existingUsage = await prisma.promoUsage.findUnique({
      where: {
        userId_promoCodeId: {
          userId: currentUser.id,
          promoCodeId: promoCode.id,
        },
      },
      select: {
        id: true,
      },
    });

    if (existingUsage) {
      return {
        ok: false,
        message: "Вы уже активировали этот код",
      };
    }

    const normalizedAmount = normalizePromoAmount(promoCode.amount);

    if (normalizedAmount === null) {
      return {
        ok: false,
        message: "Промокод содержит некорректную сумму.",
      };
    }

    const creditedAmount = new Prisma.Decimal(normalizedAmount.toFixed(MONEY_SCALE));

    await prisma.$transaction(
      async (transactionClient) => {
        const freshPromoCode = await transactionClient.promoCode.findUnique({
          where: {
            id: promoCode.id,
          },
          select: {
            id: true,
            maxUses: true,
            usedCount: true,
          },
        });

        if (!freshPromoCode) {
          throw new Error("Код не существует");
        }

        if (freshPromoCode.usedCount >= freshPromoCode.maxUses) {
          throw new Error("Лимит активаций исчерпан");
        }

        const freshUsage = await transactionClient.promoUsage.findUnique({
          where: {
            userId_promoCodeId: {
              userId: currentUser.id,
              promoCodeId: freshPromoCode.id,
            },
          },
          select: {
            id: true,
          },
        });

        if (freshUsage) {
          throw new Error("Вы уже активировали этот код");
        }

        await transactionClient.user.update({
          where: {
            id: currentUser.id,
          },
          data: {
            availableBalance: {
              increment: creditedAmount,
            },
          },
        });

        const updatedPromoCode = await transactionClient.promoCode.updateMany({
          where: {
            id: freshPromoCode.id,
            usedCount: {
              lt: freshPromoCode.maxUses,
            },
          },
          data: {
            usedCount: {
              increment: 1,
            },
          },
        });

        if (updatedPromoCode.count !== 1) {
          throw new Error("Лимит активаций исчерпан");
        }

        await transactionClient.promoUsage.create({
          data: {
            userId: currentUser.id,
            promoCodeId: freshPromoCode.id,
          },
        });

        await transactionClient.transaction.create({
          data: {
            userId: currentUser.id,
            amount: creditedAmount,
            type: TransactionType.DEPOSIT,
            status: TransactionStatus.COMPLETED,
          },
        });
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );

    revalidatePromoPaths();

    return {
      ok: true,
      message: "Промокод успешно активирован.",
      creditedAmount: creditedAmount.toFixed(MONEY_SCALE),
    };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return {
        ok: false,
        message: "Вы уже активировали этот код",
      };
    }

    return {
      ok: false,
      message:
        error instanceof Error ? error.message : "Не удалось активировать промокод.",
    };
  }
}