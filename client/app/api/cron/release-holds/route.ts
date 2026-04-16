import { timingSafeEqual } from "node:crypto";

import {
  Prisma,
  TransactionStatus,
  TransactionType,
} from "@prisma/client";
import { NextResponse } from "next/server";

import { ensureSufficientUserBalance } from "@/lib/domain/shared";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function areSecretsEqual(expectedSecret: string, receivedSecret: string) {
  const expectedBuffer = Buffer.from(expectedSecret);
  const receivedBuffer = Buffer.from(receivedSecret);

  if (expectedBuffer.length !== receivedBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, receivedBuffer);
}

function authorizeCronRequest(request: Request) {
  const expectedSecret = process.env.CRON_SECRET?.trim();

  if (!expectedSecret) {
    return NextResponse.json(
      { ok: false, message: "CRON_SECRET is not configured." },
      { status: 500 },
    );
  }

  const authorizationHeader = request.headers.get("authorization")?.trim();
  const expectedAuthorizationHeader = `Bearer ${expectedSecret}`;

  if (
    !authorizationHeader ||
    !areSecretsEqual(expectedAuthorizationHeader, authorizationHeader)
  ) {
    return NextResponse.json(
      { ok: false, message: "Unauthorized." },
      { status: 401 },
    );
  }

  return null;
}

export async function GET(request: Request) {
  const authorizationError = authorizeCronRequest(request);

  if (authorizationError) {
    return authorizationError;
  }

  const now = new Date();
  const releasableTransactions = await prisma.transaction.findMany({
    where: {
      type: TransactionType.ESCROW_RELEASE,
      status: TransactionStatus.PENDING,
      holdEndsAt: {
        lte: now,
      },
    },
    select: {
      id: true,
    },
    orderBy: {
      holdEndsAt: "asc",
    },
  });

  const releasedTransactionIds: string[] = [];
  const failedTransactions: Array<{
    transactionId: string;
    message: string;
  }> = [];

  for (const releasableTransaction of releasableTransactions) {
    try {
      const wasReleased = await prisma.$transaction(
        async (transactionClient) => {
          const pendingRelease = await transactionClient.transaction.findFirst({
            where: {
              id: releasableTransaction.id,
              type: TransactionType.ESCROW_RELEASE,
              status: TransactionStatus.PENDING,
              holdEndsAt: {
                lte: now,
              },
            },
            select: {
              id: true,
              userId: true,
              amount: true,
            },
          });

          if (!pendingRelease) {
            return false;
          }

          await ensureSufficientUserBalance(transactionClient, {
            userId: pendingRelease.userId,
            balanceField: "holdBalance",
            requiredAmount: pendingRelease.amount,
            errorMessage:
              "Insufficient seller hold balance for scheduled release.",
          });

          await transactionClient.user.update({
            where: {
              id: pendingRelease.userId,
            },
            data: {
              holdBalance: {
                decrement: pendingRelease.amount,
              },
              availableBalance: {
                increment: pendingRelease.amount,
              },
            },
          });

          await transactionClient.transaction.update({
            where: {
              id: pendingRelease.id,
            },
            data: {
              status: TransactionStatus.COMPLETED,
            },
          });

          return true;
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        },
      );

      if (wasReleased) {
        releasedTransactionIds.push(releasableTransaction.id);
      }
    } catch (error) {
      console.error("[CRON_RELEASE_HOLD_ERROR]", {
        transactionId: releasableTransaction.id,
        error,
      });

      failedTransactions.push({
        transactionId: releasableTransaction.id,
        message: error instanceof Error ? error.message : "Unknown error.",
      });
    }
  }

  return NextResponse.json({
    ok: failedTransactions.length === 0,
    scannedCount: releasableTransactions.length,
    releasedCount: releasedTransactionIds.length,
    failedCount: failedTransactions.length,
    releasedTransactionIds,
    failedTransactions,
  });
}
