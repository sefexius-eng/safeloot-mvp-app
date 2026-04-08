"use server";

import { OrderStatus, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

import {
  BANNED_USER_MESSAGE,
  getCurrentSessionUser,
  type CurrentSessionUser,
} from "@/lib/access-control";
import { getAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSiteUrl } from "@/lib/site-url";
import { escapeTelegramHtml, sendTelegramNotification } from "@/lib/telegram";

const MAX_REVIEW_COMMENT_LENGTH = 1000;
const MAX_REVIEW_REPLY_LENGTH = 1000;

function buildSellerReviewTelegramMessage(input: {
  sellerId: string;
  productTitle: string;
  rating: number;
  comment?: string | null;
}) {
  const stars = "⭐".repeat(input.rating);
  const profileUrl = `${getSiteUrl()}/user/${input.sellerId}`;
  const commentBlock = input.comment?.trim()
    ? [
        "",
        "💬 <b>Текст отзыва:</b>",
        `<i>«${escapeTelegramHtml(input.comment)}»</i>`,
      ].join("\n")
    : "";

  return [
    "🌟 <b>Новый отзыв о вас!</b>",
    "",
    `📦 <b>Товар:</b> ${escapeTelegramHtml(input.productTitle)}`,
    `📊 <b>Оценка:</b> ${stars} (${input.rating}/5)`,
    commentBlock,
    "",
    `<a href="${profileUrl}">Посмотреть в профиле</a>`,
  ]
    .filter(Boolean)
    .join("\n");
}

function triggerSellerReviewTelegramNotification(input: {
  telegramId?: bigint | null;
  sellerId: string;
  productTitle: string;
  rating: number;
  comment?: string | null;
}) {
  if (!input.telegramId) {
    return;
  }

  try {
    void sendTelegramNotification(
      input.telegramId,
      buildSellerReviewTelegramMessage({
        sellerId: input.sellerId,
        productTitle: input.productTitle,
        rating: input.rating,
        comment: input.comment,
      }),
    ).catch((error) => {
      console.error("[SELLER_REVIEW_TELEGRAM_NOTIFICATION_ERROR]", error);
    });
  } catch (error) {
    console.error("[SELLER_REVIEW_TELEGRAM_NOTIFICATION_ERROR]", error);
  }
}

async function requireActiveReviewUser() {
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

function hasReviewAdminAccess(user: CurrentSessionUser) {
  return user.role === "ADMIN" || user.role === "SUPER_ADMIN";
}

function canManageReview(user: CurrentSessionUser, authorId: string) {
  return user.id === authorId || hasReviewAdminAccess(user);
}

function normalizeReviewRating(rating: number) {
  const normalizedRating = Number(rating);

  if (
    !Number.isInteger(normalizedRating) ||
    normalizedRating < 1 ||
    normalizedRating > 5
  ) {
    throw new Error("Поставьте оценку от 1 до 5.");
  }

  return normalizedRating;
}

function revalidateReviewRelatedPaths(input: {
  orderId: string;
  sellerId: string;
  productId: string;
  gameSlug?: string | null;
}) {
  revalidatePath(`/order/${input.orderId}`);
  revalidatePath(`/orders/${input.orderId}`);
  revalidatePath(`/product/${input.productId}`);
  revalidatePath(`/user/${input.sellerId}`);
  revalidatePath("/");
  revalidatePath("/profile");

  if (input.gameSlug) {
    revalidatePath(`/games/${input.gameSlug}`);
  }
}

async function getReviewMutationContext(
  reviewId: string,
  transactionClient: Prisma.TransactionClient,
) {
  return transactionClient.review.findUnique({
    where: {
      id: reviewId,
    },
    select: {
      id: true,
      orderId: true,
      authorId: true,
      sellerId: true,
      rating: true,
      comment: true,
      sellerReply: true,
      replyCreatedAt: true,
      createdAt: true,
      order: {
        select: {
          id: true,
          productId: true,
          product: {
            select: {
              game: {
                select: {
                  slug: true,
                },
              },
            },
          },
        },
      },
    },
  });
}

function normalizeComment(comment?: string | null) {
  const normalizedComment = comment?.trim() ?? "";

  if (normalizedComment.length > MAX_REVIEW_COMMENT_LENGTH) {
    throw new Error(
      `Комментарий не должен превышать ${MAX_REVIEW_COMMENT_LENGTH} символов.`,
    );
  }

  return normalizedComment || null;
}

function stripHtmlTags(value: string) {
  return value.replace(/<[^>]*>?/gm, "");
}

function normalizeReplyText(text?: string | null) {
  const normalizedText = stripHtmlTags(text?.trim() ?? "").trim();

  if (!normalizedText) {
    throw new Error("Текст ответа обязателен.");
  }

  if (normalizedText.length > MAX_REVIEW_REPLY_LENGTH) {
    throw new Error(
      `Ответ не должен превышать ${MAX_REVIEW_REPLY_LENGTH} символов.`,
    );
  }

  return normalizedText;
}

export async function createReview(
  orderId: string,
  rating: number,
  comment?: string | null,
) {
  try {
    const currentUser = await requireActiveReviewUser();
    const normalizedOrderId = orderId.trim();
    const normalizedRating = normalizeReviewRating(rating);
    const normalizedComment = normalizeComment(comment);

    if (!normalizedOrderId) {
      return {
        ok: false,
        message: "orderId is required.",
      };
    }

    const result = await prisma.$transaction(
      async (transactionClient) => {
        const order = await transactionClient.order.findUnique({
          where: {
            id: normalizedOrderId,
          },
          select: {
            id: true,
            buyerId: true,
            sellerId: true,
            productId: true,
            status: true,
            review: {
              select: {
                id: true,
              },
            },
            product: {
              select: {
                id: true,
                title: true,
                game: {
                  select: {
                    slug: true,
                  },
                },
              },
            },
            seller: {
              select: {
                id: true,
                telegramId: true,
              },
            },
          },
        });

        if (!order) {
          throw new Error(`Order with id ${normalizedOrderId} was not found.`);
        }

        if (order.buyerId !== currentUser.id) {
          throw new Error("Только покупатель может оставить отзыв.");
        }

        if (order.status !== OrderStatus.COMPLETED) {
          throw new Error("Оставить отзыв можно только после завершения сделки.");
        }

        if (order.review) {
          throw new Error("Отзыв по этому заказу уже существует.");
        }

        const review = await transactionClient.review.create({
          data: {
            orderId: order.id,
            authorId: currentUser.id,
            sellerId: order.sellerId,
            rating: normalizedRating,
            comment: normalizedComment,
          },
          select: {
            id: true,
            rating: true,
            comment: true,
            createdAt: true,
          },
        });

        return {
          order,
          review,
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );

    revalidateReviewRelatedPaths({
      orderId: result.order.id,
      sellerId: result.order.seller.id,
      productId: result.order.productId,
      gameSlug: result.order.product.game?.slug,
    });

    triggerSellerReviewTelegramNotification({
      telegramId: result.order.seller.telegramId,
      sellerId: result.order.seller.id,
      productTitle: result.order.product.title,
      rating: result.review.rating,
      comment: result.review.comment,
    });

    return {
      ok: true,
      review: {
        ...result.review,
        createdAt: result.review.createdAt.toISOString(),
      },
    };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return {
        ok: false,
        message: "Отзыв по этому заказу уже существует.",
      };
    }

    return {
      ok: false,
      message:
        error instanceof Error ? error.message : "Не удалось сохранить отзыв.",
    };
  }
}

export async function updateReview(
  reviewId: string,
  rating: number,
  comment?: string | null,
) {
  try {
    const currentUser = await requireActiveReviewUser();
    const normalizedReviewId = reviewId.trim();
    const normalizedRating = normalizeReviewRating(rating);
    const normalizedComment = normalizeComment(comment);

    if (!normalizedReviewId) {
      return {
        ok: false,
        message: "reviewId is required.",
      };
    }

    const result = await prisma.$transaction(
      async (transactionClient) => {
        const review = await getReviewMutationContext(
          normalizedReviewId,
          transactionClient,
        );

        if (!review) {
          throw new Error("Отзыв не найден.");
        }

        if (!canManageReview(currentUser, review.authorId)) {
          throw new Error(
            "Редактировать отзывы может только автор или администратор.",
          );
        }

        const updatedReview = await transactionClient.review.update({
          where: {
            id: normalizedReviewId,
          },
          data: {
            rating: normalizedRating,
            comment: normalizedComment,
          },
          select: {
            id: true,
            rating: true,
            comment: true,
            sellerReply: true,
            replyCreatedAt: true,
            createdAt: true,
          },
        });

        return {
          review: updatedReview,
          context: review,
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );

    revalidateReviewRelatedPaths({
      orderId: result.context.order.id,
      sellerId: result.context.sellerId,
      productId: result.context.order.productId,
      gameSlug: result.context.order.product.game?.slug,
    });

    return {
      ok: true,
      review: {
        ...result.review,
        createdAt: result.review.createdAt.toISOString(),
        replyCreatedAt: result.review.replyCreatedAt?.toISOString() ?? null,
      },
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error ? error.message : "Не удалось обновить отзыв.",
    };
  }
}

export async function deleteReview(reviewId: string) {
  try {
    const currentUser = await requireActiveReviewUser();
    const normalizedReviewId = reviewId.trim();

    if (!normalizedReviewId) {
      return {
        ok: false,
        message: "reviewId is required.",
      };
    }

    const result = await prisma.$transaction(
      async (transactionClient) => {
        const review = await getReviewMutationContext(
          normalizedReviewId,
          transactionClient,
        );

        if (!review) {
          throw new Error("Отзыв не найден.");
        }

        if (!canManageReview(currentUser, review.authorId)) {
          throw new Error(
            "Удалять отзывы может только автор или администратор.",
          );
        }

        await transactionClient.review.delete({
          where: {
            id: normalizedReviewId,
          },
        });

        return review;
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );

    revalidateReviewRelatedPaths({
      orderId: result.order.id,
      sellerId: result.sellerId,
      productId: result.order.productId,
      gameSlug: result.order.product.game?.slug,
    });

    return {
      ok: true,
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error ? error.message : "Не удалось удалить отзыв.",
    };
  }
}

export async function replyToReview(reviewId: string, text: string) {
  try {
    const currentUser = await requireActiveReviewUser();
    const normalizedReviewId = reviewId.trim();
    const normalizedReply = normalizeReplyText(text);

    if (!normalizedReviewId) {
      return {
        ok: false,
        message: "reviewId is required.",
      };
    }

    const review = await prisma.review.findUnique({
      where: {
        id: normalizedReviewId,
      },
      select: {
        id: true,
        sellerId: true,
        sellerReply: true,
      },
    });

    if (!review) {
      return {
        ok: false,
        message: "Отзыв не найден.",
      };
    }

    if (review.sellerId !== currentUser.id) {
      return {
        ok: false,
        message: "Отвечать на отзыв может только продавец-получатель.",
      };
    }

    if (review.sellerReply?.trim()) {
      return {
        ok: false,
        message: "Ответ на этот отзыв уже опубликован.",
      };
    }

    await prisma.review.update({
      where: {
        id: normalizedReviewId,
      },
      data: {
        sellerReply: normalizedReply,
        replyCreatedAt: new Date(),
      },
    });

    revalidatePath(`/user/${review.sellerId}`);

    return {
      ok: true,
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error ? error.message : "Не удалось сохранить ответ.",
    };
  }
}