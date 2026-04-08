"use client";

import type { Role } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition, type FormEvent } from "react";

import { deleteReview, updateReview } from "@/app/actions/reviews";
import CensoredText from "@/components/censored-text";
import { RatingStars } from "@/components/reviews/rating-stars";
import { SellerReviewReplyForm } from "@/components/reviews/seller-review-reply-form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { UserAvatar } from "@/components/ui/user-avatar";

const MAX_REVIEW_COMMENT_LENGTH = 1000;

export interface SellerReviewCardData {
  id: string;
  rating: number;
  comment: string | null;
  sellerReply: string | null;
  createdAt: string;
  replyCreatedAt: string | null;
  author: {
    id: string;
    name: string | null;
    image: string | null;
    email?: string | null;
  };
}

interface SellerReviewCardProps {
  review: SellerReviewCardData;
  sellerId: string;
  currentUserId?: string | null;
  currentUserRole?: Role | null;
  onUpdated?: (review: SellerReviewCardData) => void;
  onDeleted?: (reviewId: string) => void;
}

function formatReviewDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function hasAdminReviewAccess(role?: Role | null) {
  return role === "ADMIN" || role === "SUPER_ADMIN";
}

function PencilIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="h-4 w-4">
      <path
        d="M11.667 4.166 15.833 8.333M5 15l2.96-.592a2 2 0 0 0 1.024-.544l7.56-7.56a1.768 1.768 0 1 0-2.5-2.5l-7.56 7.56a2 2 0 0 0-.544 1.024L5 15Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="h-4 w-4">
      <path
        d="M3.333 5.833h13.334M8.333 9.167v4.166M11.667 9.167v4.166M5.833 5.833l.236 8.254A1.667 1.667 0 0 0 7.734 15.833h4.532a1.667 1.667 0 0 0 1.665-1.746l.236-8.254M7.5 5.833V4.167A.833.833 0 0 1 8.333 3.333h3.334a.833.833 0 0 1 .833.834v1.666"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function SellerReviewCard({
  review: initialReview,
  sellerId,
  currentUserId,
  currentUserRole,
  onUpdated,
  onDeleted,
}: SellerReviewCardProps) {
  const router = useRouter();
  const [review, setReview] = useState(initialReview);
  const [isDeleted, setIsDeleted] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [draftRating, setDraftRating] = useState(initialReview.rating);
  const [draftComment, setDraftComment] = useState(initialReview.comment ?? "");
  const [editError, setEditError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isUpdatePending, startUpdateTransition] = useTransition();
  const [isDeletePending, startDeleteTransition] = useTransition();

  useEffect(() => {
    setReview(initialReview);
    setDraftRating(initialReview.rating);
    setDraftComment(initialReview.comment ?? "");
    setEditError(null);
    setDeleteError(null);
    setIsDeleted(false);
  }, [initialReview]);

  if (isDeleted) {
    return null;
  }

  const authorName =
    review.author.name?.trim() || review.author.email?.trim() || "Покупатель";
  const isSellerOwner = currentUserId === sellerId;
  const hasManageAccess =
    Boolean(currentUserId) &&
    (currentUserId === review.author.id || hasAdminReviewAccess(currentUserRole));
  const isAdminManaging =
    hasManageAccess &&
    currentUserId !== review.author.id &&
    hasAdminReviewAccess(currentUserRole);
  const canReply = isSellerOwner && !review.sellerReply?.trim();
  const normalizedCurrentComment = review.comment?.trim() ?? "";
  const normalizedDraftComment = draftComment.trim();
  const isUnchanged =
    draftRating === review.rating &&
    normalizedDraftComment === normalizedCurrentComment;

  function handleEditOpenChange(nextOpen: boolean) {
    setIsEditOpen(nextOpen);

    if (nextOpen) {
      setDraftRating(review.rating);
      setDraftComment(review.comment ?? "");
      setEditError(null);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setEditError(null);

    startUpdateTransition(() => {
      void updateReview(review.id, draftRating, draftComment)
        .then((result) => {
          if (!result.ok || !result.review) {
            setEditError(result.message ?? "Не удалось обновить отзыв.");
            return;
          }

          const updatedReview: SellerReviewCardData = {
            ...review,
            rating: result.review.rating,
            comment: result.review.comment,
            sellerReply: result.review.sellerReply,
            createdAt: result.review.createdAt,
            replyCreatedAt: result.review.replyCreatedAt,
          };

          setReview(updatedReview);
          onUpdated?.(updatedReview);
          setIsEditOpen(false);
          router.refresh();
        })
        .catch(() => {
          setEditError("Не удалось обновить отзыв.");
        });
    });
  }

  function handleDelete() {
    if (
      !window.confirm(
        "Удалить этот отзыв? Действие нельзя будет отменить.",
      )
    ) {
      return;
    }

    setDeleteError(null);

    startDeleteTransition(() => {
      void deleteReview(review.id)
        .then((result) => {
          if (!result.ok) {
            setDeleteError(result.message ?? "Не удалось удалить отзыв.");
            return;
          }

          onDeleted?.(review.id);
          setIsDeleted(true);
          router.refresh();
        })
        .catch(() => {
          setDeleteError("Не удалось удалить отзыв.");
        });
    });
  }

  return (
    <article className="rounded-[1.75rem] border border-white/10 bg-white/5 p-5 shadow-[0_14px_36px_rgba(0,0,0,0.16)]">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <UserAvatar
            src={review.author.image}
            name={authorName}
            email={review.author.email ?? undefined}
            className="h-12 w-12 shrink-0 border-white/10 bg-zinc-900/80"
            imageClassName="rounded-full object-cover"
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">
              <CensoredText text={authorName} />
            </p>
            <p className="truncate text-xs uppercase tracking-[0.16em] text-zinc-500">
              Покупатель
            </p>
          </div>
        </div>

        <div className="flex flex-col items-start gap-2 md:items-end">
          <RatingStars value={review.rating} size="sm" />
          <span className="text-xs uppercase tracking-[0.16em] text-zinc-500">
            {formatReviewDate(review.createdAt)}
          </span>

          {hasManageAccess ? (
            <div className="flex items-center gap-2">
              <Dialog open={isEditOpen} onOpenChange={handleEditOpenChange}>
                <button
                  type="button"
                  onClick={() => handleEditOpenChange(true)}
                  disabled={isUpdatePending || isDeletePending}
                  title="Редактировать отзыв"
                  aria-label="Редактировать отзыв"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-sky-500/20 bg-sky-500/10 text-sky-100 transition hover:bg-sky-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <PencilIcon />
                </button>

                <DialogContent className="border-white/10 bg-[#10151c] text-zinc-100 sm:max-w-xl">
                  <DialogHeader className="space-y-3 pr-10">
                    <DialogTitle className="text-2xl font-semibold tracking-tight text-white">
                      Редактирование отзыва
                    </DialogTitle>
                    <DialogDescription className="text-sm leading-7 text-zinc-400">
                      Обновите оценку и текст отзыва. Изменения сразу повлияют на рейтинг продавца.
                    </DialogDescription>
                  </DialogHeader>

                  <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                        Оценка
                      </p>
                      <RatingStars
                        value={draftRating}
                        size="lg"
                        onChange={setDraftRating}
                        disabled={isUpdatePending}
                        className="mt-3"
                      />
                    </div>

                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                        Комментарий
                      </p>
                      <Textarea
                        value={draftComment}
                        onChange={(event) => setDraftComment(event.target.value)}
                        maxLength={MAX_REVIEW_COMMENT_LENGTH}
                        placeholder="Опишите впечатления от сделки..."
                        className="mt-3 min-h-32 border-white/10 bg-zinc-950/70 text-zinc-100 shadow-none placeholder:text-zinc-500 focus:border-orange-500/45 focus:bg-zinc-950 focus:ring-orange-500/10"
                      />
                      <div className="mt-3 flex items-center justify-between gap-3 text-xs text-zinc-500">
                        <span>Пустой комментарий допустим, оценка сохранится отдельно.</span>
                        <span>{draftComment.trim().length}/{MAX_REVIEW_COMMENT_LENGTH}</span>
                      </div>
                    </div>

                    {editError ? (
                      <p className="text-sm text-rose-300">{editError}</p>
                    ) : null}

                    <DialogFooter className="gap-3 sm:justify-end">
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => handleEditOpenChange(false)}
                        disabled={isUpdatePending}
                        className="border border-white/10 bg-white/5 hover:bg-white/10"
                      >
                        Отмена
                      </Button>
                      <Button
                        type="submit"
                        disabled={isUpdatePending || isUnchanged}
                        className="bg-orange-600 hover:bg-orange-500"
                      >
                        {isUpdatePending ? "Сохраняем..." : "Сохранить"}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>

              <button
                type="button"
                onClick={handleDelete}
                disabled={isUpdatePending || isDeletePending}
                title="Удалить отзыв"
                aria-label="Удалить отзыв"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-rose-500/20 bg-rose-500/10 text-rose-100 transition hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <TrashIcon />
              </button>
            </div>
          ) : null}

          {isAdminManaging ? (
            <span className="text-[11px] uppercase tracking-[0.16em] text-amber-300/80">
              Режим администратора
            </span>
          ) : null}
        </div>
      </div>

      <div className="mt-4 rounded-[1.35rem] border border-white/10 bg-black/20 px-4 py-4 text-sm leading-7 text-zinc-200">
        <CensoredText
          text={review.comment?.trim() || "Покупатель поставил оценку без текстового комментария."}
        />
      </div>

      {deleteError ? (
        <p className="mt-3 text-sm text-rose-300">{deleteError}</p>
      ) : null}

      {review.sellerReply?.trim() ? (
        <div className="ml-6 mt-4 rounded-[1.35rem] border-l-2 border-gray-600 bg-gray-800/50 px-4 py-4 text-sm leading-7 text-zinc-200">
          <p className="text-xs font-semibold tracking-[0.16em] uppercase text-zinc-400">
            Ответ продавца
          </p>
          <div className="mt-2">
            <CensoredText text={review.sellerReply} />
          </div>
          {review.replyCreatedAt ? (
            <p className="mt-3 text-xs uppercase tracking-[0.16em] text-zinc-500">
              {formatReviewDate(review.replyCreatedAt)}
            </p>
          ) : null}
        </div>
      ) : canReply ? (
        <div className="mt-4">
          <SellerReviewReplyForm reviewId={review.id} />
        </div>
      ) : null}
    </article>
  );
}