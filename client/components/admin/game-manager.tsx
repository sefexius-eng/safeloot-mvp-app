"use client";

import type { Role } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import {
  createCatalogGame,
  createCategory,
  deleteCatalogGame,
  deleteCategory,
  updateCatalogGameImage,
  updateCategory,
  type CatalogCategorySummary,
  type CatalogGameSummary,
} from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface GameManagerProps {
  games: CatalogGameSummary[];
  currentUserRole: Role;
}

interface CategoryDraft {
  name: string;
  slug: string;
}

const POSTER_GRADIENTS = [
  "linear-gradient(160deg, rgba(249,115,22,0.85), rgba(234,88,12,0.28) 45%, rgba(12,10,9,0.92))",
  "linear-gradient(160deg, rgba(14,165,233,0.82), rgba(59,130,246,0.26) 48%, rgba(2,6,23,0.94))",
  "linear-gradient(160deg, rgba(236,72,153,0.82), rgba(168,85,247,0.24) 46%, rgba(9,9,11,0.94))",
  "linear-gradient(160deg, rgba(16,185,129,0.82), rgba(6,182,212,0.24) 44%, rgba(3,7,18,0.94))",
  "linear-gradient(160deg, rgba(250,204,21,0.76), rgba(234,88,12,0.28) 40%, rgba(17,24,39,0.94))",
];

function buildCatalogGameSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function getPosterGradient(key: string) {
  const hash = Array.from(key).reduce(
    (accumulator, symbol) => accumulator + symbol.charCodeAt(0),
    0,
  );

  return POSTER_GRADIENTS[hash % POSTER_GRADIENTS.length];
}

function createEmptyCategoryDraft(): CategoryDraft {
  return {
    name: "",
    slug: "",
  };
}

function buildImageDrafts(games: CatalogGameSummary[]) {
  return Object.fromEntries(games.map((game) => [game.id, game.imageUrl ?? ""]));
}

function buildCategoryDrafts(games: CatalogGameSummary[]) {
  return Object.fromEntries(games.map((game) => [game.id, createEmptyCategoryDraft()]));
}

function shouldSyncSlug(currentName: string, currentSlug: string) {
  return !currentSlug.trim() || currentSlug === buildCatalogGameSlug(currentName);
}

export function GameManager({ games: initialGames, currentUserRole }: GameManagerProps) {
  const router = useRouter();
  const [games, setGames] = useState(initialGames);
  const [formState, setFormState] = useState({
    name: "",
    slug: "",
    imageUrl: "",
  });
  const [imageDrafts, setImageDrafts] = useState<Record<string, string>>(() =>
    buildImageDrafts(initialGames),
  );
  const [newCategoryDrafts, setNewCategoryDrafts] = useState<Record<string, CategoryDraft>>(
    () => buildCategoryDrafts(initialGames),
  );
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCategoryDrafts, setEditingCategoryDrafts] = useState<
    Record<string, CategoryDraft>
  >({});
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [isSlugDirty, setIsSlugDirty] = useState(false);
  const [savingGameId, setSavingGameId] = useState<string | null>(null);
  const [deletingGameId, setDeletingGameId] = useState<string | null>(null);
  const [addingCategoryGameId, setAddingCategoryGameId] = useState<string | null>(null);
  const [savingCategoryId, setSavingCategoryId] = useState<string | null>(null);
  const [deletingCategoryId, setDeletingCategoryId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const canDeleteContent = currentUserRole === "SUPER_ADMIN";

  useEffect(() => {
    setGames(initialGames);
    setImageDrafts(buildImageDrafts(initialGames));
    setNewCategoryDrafts(buildCategoryDrafts(initialGames));
  }, [initialGames]);

  function upsertGame(nextGame: CatalogGameSummary, options?: { prepend?: boolean }) {
    setGames((currentGames) => {
      const existingGame = currentGames.find((game) => game.id === nextGame.id);

      if (!existingGame) {
        return options?.prepend ? [nextGame, ...currentGames] : [...currentGames, nextGame];
      }

      if (options?.prepend) {
        return [nextGame, ...currentGames.filter((game) => game.id !== nextGame.id)];
      }

      return currentGames.map((game) => (game.id === nextGame.id ? nextGame : game));
    });

    setImageDrafts((currentDrafts) => ({
      ...currentDrafts,
      [nextGame.id]: nextGame.imageUrl ?? "",
    }));
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);

    startTransition(() => {
      void createCatalogGame(formState.name, formState.slug, formState.imageUrl)
        .then((result) => {
          if (!result.ok || !result.game) {
            setFeedback({
              type: "error",
              message: result.message ?? "Не удалось добавить игру.",
            });
            return;
          }

          const game = result.game;

          upsertGame(game, { prepend: true });
          setNewCategoryDrafts((currentDrafts) => ({
            ...currentDrafts,
            [game.id]: createEmptyCategoryDraft(),
          }));
          setFormState({
            name: "",
            slug: "",
            imageUrl: "",
          });
          setIsSlugDirty(false);
          setFeedback({
            type: "success",
            message: result.message ?? "Игра добавлена.",
          });
          router.refresh();
        })
        .catch((error) => {
          setFeedback({
            type: "error",
            message: error instanceof Error ? error.message : "Не удалось добавить игру.",
          });
        });
    });
  }

  function handleImageSave(gameId: string) {
    setFeedback(null);
    setSavingGameId(gameId);

    void updateCatalogGameImage(gameId, imageDrafts[gameId] ?? "")
      .then((result) => {
        if (!result.ok || !result.game) {
          setFeedback({
            type: "error",
            message: result.message ?? "Не удалось обновить обложку игры.",
          });
          return;
        }

        upsertGame(result.game);
        setFeedback({
          type: "success",
          message: result.message ?? "Обложка игры обновлена.",
        });
        router.refresh();
      })
      .catch((error) => {
        setFeedback({
          type: "error",
          message:
            error instanceof Error
              ? error.message
              : "Не удалось обновить обложку игры.",
        });
      })
      .finally(() => {
        setSavingGameId(null);
      });
  }

  function handleDeleteGame(game: CatalogGameSummary) {
    if (!canDeleteContent) {
      return;
    }

    if (!window.confirm(`Удалить игру ${game.name}?`)) {
      return;
    }

    setFeedback(null);
    setDeletingGameId(game.id);

    void deleteCatalogGame(game.id)
      .then((result) => {
        if (!result.ok) {
          setFeedback({
            type: "error",
            message: result.message ?? "Не удалось удалить игру.",
          });
          return;
        }

        setGames((currentGames) => currentGames.filter((item) => item.id !== game.id));
        setImageDrafts((currentDrafts) => {
          const nextDrafts = { ...currentDrafts };
          delete nextDrafts[game.id];
          return nextDrafts;
        });
        setNewCategoryDrafts((currentDrafts) => {
          const nextDrafts = { ...currentDrafts };
          delete nextDrafts[game.id];
          return nextDrafts;
        });
        setFeedback({
          type: "success",
          message: result.message ?? "Игра удалена.",
        });
        router.refresh();
      })
      .catch((error) => {
        setFeedback({
          type: "error",
          message: error instanceof Error ? error.message : "Не удалось удалить игру.",
        });
      })
      .finally(() => {
        setDeletingGameId(null);
      });
  }

  function handleCreateCategory(event: React.FormEvent<HTMLFormElement>, gameId: string) {
    event.preventDefault();
    setFeedback(null);
    setAddingCategoryGameId(gameId);

    const draft = newCategoryDrafts[gameId] ?? createEmptyCategoryDraft();

    void createCategory(gameId, draft.name, draft.slug)
      .then((result) => {
        if (!result.ok || !result.game) {
          setFeedback({
            type: "error",
            message: result.message ?? "Не удалось добавить подкатегорию.",
          });
          return;
        }

        upsertGame(result.game);
        setNewCategoryDrafts((currentDrafts) => ({
          ...currentDrafts,
          [gameId]: createEmptyCategoryDraft(),
        }));
        setFeedback({
          type: "success",
          message: result.message ?? "Подкатегория добавлена.",
        });
        router.refresh();
      })
      .catch((error) => {
        setFeedback({
          type: "error",
          message:
            error instanceof Error
              ? error.message
              : "Не удалось добавить подкатегорию.",
        });
      })
      .finally(() => {
        setAddingCategoryGameId(null);
      });
  }

  function startCategoryEditing(category: CatalogCategorySummary) {
    setEditingCategoryId(category.id);
    setEditingCategoryDrafts((currentDrafts) => ({
      ...currentDrafts,
      [category.id]: {
        name: category.name,
        slug: category.slug,
      },
    }));
  }

  function stopCategoryEditing() {
    setEditingCategoryId(null);
  }

  function handleCategorySave(category: CatalogCategorySummary) {
    const draft = editingCategoryDrafts[category.id] ?? {
      name: category.name,
      slug: category.slug,
    };

    setFeedback(null);
    setSavingCategoryId(category.id);

    void updateCategory(category.id, draft.name, draft.slug)
      .then((result) => {
        if (!result.ok || !result.game) {
          setFeedback({
            type: "error",
            message: result.message ?? "Не удалось обновить подкатегорию.",
          });
          return;
        }

        upsertGame(result.game);
        setEditingCategoryId(null);
        setFeedback({
          type: "success",
          message: result.message ?? "Подкатегория обновлена.",
        });
        router.refresh();
      })
      .catch((error) => {
        setFeedback({
          type: "error",
          message:
            error instanceof Error
              ? error.message
              : "Не удалось обновить подкатегорию.",
        });
      })
      .finally(() => {
        setSavingCategoryId(null);
      });
  }

  function handleCategoryDelete(category: CatalogCategorySummary) {
    if (!canDeleteContent) {
      return;
    }

    if (!window.confirm(`Удалить подкатегорию ${category.name}?`)) {
      return;
    }

    setFeedback(null);
    setDeletingCategoryId(category.id);

    void deleteCategory(category.id)
      .then((result) => {
        if (!result.ok || !result.game) {
          setFeedback({
            type: "error",
            message: result.message ?? "Не удалось удалить подкатегорию.",
          });
          return;
        }

        upsertGame(result.game);
        if (editingCategoryId === category.id) {
          setEditingCategoryId(null);
        }
        setFeedback({
          type: "success",
          message: result.message ?? "Подкатегория удалена.",
        });
        router.refresh();
      })
      .catch((error) => {
        setFeedback({
          type: "error",
          message:
            error instanceof Error
              ? error.message
              : "Не удалось удалить подкатегорию.",
        });
      })
      .finally(() => {
        setDeletingCategoryId(null);
      });
  }

  return (
    <div className="space-y-6">
      <form
        onSubmit={handleSubmit}
        className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1.3fr)_auto] xl:items-end"
      >
        <label className="space-y-2">
          <span className="text-sm font-semibold text-zinc-200">Название игры</span>
          <Input
            value={formState.name}
            onChange={(event) => {
              const nextName = event.target.value;

              setFormState((currentState) => ({
                ...currentState,
                name: nextName,
                slug: isSlugDirty
                  ? currentState.slug
                  : buildCatalogGameSlug(nextName),
              }));
            }}
            placeholder="Counter-Strike 2"
            className="border-white/10 bg-white/5 text-zinc-100 placeholder:text-zinc-500 focus:border-orange-500/45 focus:bg-white/8"
            disabled={isPending}
          />
        </label>

        <label className="space-y-2">
          <span className="text-sm font-semibold text-zinc-200">Slug</span>
          <Input
            value={formState.slug}
            onChange={(event) => {
              setIsSlugDirty(true);
              setFormState((currentState) => ({
                ...currentState,
                slug: buildCatalogGameSlug(event.target.value),
              }));
            }}
            placeholder="counter-strike-2"
            className="border-white/10 bg-white/5 text-zinc-100 placeholder:text-zinc-500 focus:border-orange-500/45 focus:bg-white/8"
            disabled={isPending}
          />
        </label>

        <label className="space-y-2">
          <span className="text-sm font-semibold text-zinc-200">URL постера / логотипа</span>
          <Input
            value={formState.imageUrl}
            onChange={(event) => {
              setFormState((currentState) => ({
                ...currentState,
                imageUrl: event.target.value,
              }));
            }}
            placeholder="/game-cover/cs2 или https://example.com/game-cover.jpg"
            className="border-white/10 bg-white/5 text-zinc-100 placeholder:text-zinc-500 focus:border-orange-500/45 focus:bg-white/8"
            disabled={isPending}
          />
        </label>

        <Button
          type="submit"
          disabled={isPending || !formState.name.trim() || !formState.slug.trim()}
          className="h-12 rounded-2xl bg-orange-600 px-5 text-sm font-semibold text-white shadow-[0_16px_40px_rgba(249,115,22,0.28)] hover:bg-orange-500"
        >
          {isPending ? "Добавляем..." : "Добавить игру"}
        </Button>
      </form>

      <div className="rounded-[1.35rem] border border-white/10 bg-white/5 px-4 py-3 text-sm leading-7 text-zinc-400">
        Добавление и редактирование игр и подкатегорий доступно MODERATOR, ADMIN и SUPER_ADMIN. Удаление скрыто в интерфейсе и дополнительно защищено server actions только для SUPER_ADMIN.
      </div>

      {feedback ? (
        <div
          className={[
            "rounded-[1.25rem] border px-4 py-3 text-sm leading-7",
            feedback.type === "success"
              ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-100"
              : "border-red-500/20 bg-red-500/10 text-red-100",
          ].join(" ")}
        >
          {feedback.message}
        </div>
      ) : null}

      {games.length === 0 ? (
        <div className="rounded-[1.5rem] border border-dashed border-white/10 bg-white/5 px-5 py-8 text-sm leading-7 text-zinc-400">
          В каталоге пока нет игр.
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {games.map((game) => {
            const fallbackLetter = game.name.slice(0, 1).toUpperCase() || "G";
            const isSavingGame = savingGameId === game.id;
            const isDeletingGame = deletingGameId === game.id;
            const isAddingCategory = addingCategoryGameId === game.id;
            const categoryDraft = newCategoryDrafts[game.id] ?? createEmptyCategoryDraft();

            return (
              <article
                key={game.id}
                className="rounded-[1.75rem] border border-white/10 bg-white/5 p-4 shadow-[0_18px_48px_rgba(0,0,0,0.18)]"
              >
                <div className="grid gap-4 md:grid-cols-[180px_minmax(0,1fr)] md:items-start">
                  <div className="relative aspect-[4/5] overflow-hidden rounded-[1.5rem] border border-white/10 bg-black/20">
                    {game.imageUrl?.trim() ? (
                      <div
                        className="absolute inset-0 bg-cover bg-center"
                        style={{
                          backgroundImage: `url(${game.imageUrl})`,
                        }}
                      />
                    ) : (
                      <div
                        className="absolute inset-0"
                        style={{
                          background: getPosterGradient(game.slug),
                        }}
                      />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
                    <div className="absolute inset-x-0 bottom-0 p-4">
                      <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-black/30 text-lg font-semibold text-white shadow-[0_12px_28px_rgba(0,0,0,0.26)]">
                        {fallbackLetter}
                      </div>
                      <p className="mt-3 text-lg font-semibold tracking-tight text-white">
                        {game.name}
                      </p>
                      <p className="mt-1 text-xs uppercase tracking-[0.18em] text-zinc-300">
                        {game.slug}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-300">
                        Товаров: {game.productCount}
                      </span>
                      <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-300">
                        Категорий: {game.categoryCount}
                      </span>
                    </div>

                    <label className="space-y-2">
                      <span className="text-sm font-semibold text-zinc-200">URL обложки</span>
                      <Input
                        value={imageDrafts[game.id] ?? ""}
                        onChange={(event) => {
                          setImageDrafts((currentDrafts) => ({
                            ...currentDrafts,
                            [game.id]: event.target.value,
                          }));
                        }}
                        placeholder="/game-cover/cs2 или https://example.com/game-cover.jpg"
                        className="border-white/10 bg-white/5 text-zinc-100 placeholder:text-zinc-500 focus:border-orange-500/45 focus:bg-white/8"
                        disabled={isSavingGame || isDeletingGame}
                      />
                    </label>

                    <div className="flex flex-wrap gap-3">
                      <Button
                        type="button"
                        onClick={() => handleImageSave(game.id)}
                        disabled={isSavingGame || isDeletingGame}
                        className="h-11 rounded-2xl bg-sky-600 px-5 text-sm font-semibold text-white shadow-[0_16px_40px_rgba(2,132,199,0.24)] hover:bg-sky-500"
                      >
                        {isSavingGame ? "Сохраняем..." : "Сохранить URL"}
                      </Button>
                      <button
                        type="button"
                        onClick={() => {
                          setImageDrafts((currentDrafts) => ({
                            ...currentDrafts,
                            [game.id]: "",
                          }));
                        }}
                        className="inline-flex h-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-5 text-sm font-semibold text-zinc-200 transition hover:bg-white/10"
                        disabled={isSavingGame || isDeletingGame}
                      >
                        Очистить
                      </button>
                      {canDeleteContent ? (
                        <button
                          type="button"
                          onClick={() => handleDeleteGame(game)}
                          className="inline-flex h-11 items-center justify-center rounded-2xl border border-red-500/20 bg-red-500/10 px-5 text-sm font-semibold text-red-100 transition hover:bg-red-500/20"
                          disabled={isSavingGame || isDeletingGame}
                        >
                          {isDeletingGame ? "Удаляем..." : "🗑️ Удалить игру"}
                        </button>
                      ) : null}
                    </div>

                    <section className="rounded-[1.35rem] border border-white/10 bg-black/15 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-zinc-100">Подкатегории</p>
                          <p className="text-xs leading-6 text-zinc-500">
                            Компактное управление slug и структурой игры прямо из карточки.
                          </p>
                        </div>
                        <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-400">
                          {game.categories.length}
                        </span>
                      </div>

                      <div className="mt-4 space-y-2">
                        {game.categories.length > 0 ? (
                          game.categories.map((category) => {
                            const isEditing = editingCategoryId === category.id;
                            const editDraft = editingCategoryDrafts[category.id] ?? {
                              name: category.name,
                              slug: category.slug,
                            };
                            const isSavingCategory = savingCategoryId === category.id;
                            const isDeletingCategory = deletingCategoryId === category.id;

                            return (
                              <div
                                key={category.id}
                                className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5"
                              >
                                {isEditing ? (
                                  <div className="space-y-2">
                                    <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] md:items-center">
                                      <Input
                                        value={editDraft.name}
                                        onChange={(event) => {
                                          const nextName = event.target.value;

                                          setEditingCategoryDrafts((currentDrafts) => {
                                            const currentDraft = currentDrafts[category.id] ?? editDraft;

                                            return {
                                              ...currentDrafts,
                                              [category.id]: {
                                                name: nextName,
                                                slug: shouldSyncSlug(
                                                  currentDraft.name,
                                                  currentDraft.slug,
                                                )
                                                  ? buildCatalogGameSlug(nextName)
                                                  : currentDraft.slug,
                                              },
                                            };
                                          });
                                        }}
                                        className="h-9 border-white/10 bg-white/5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-orange-500/45 focus:bg-white/8"
                                        disabled={isSavingCategory || isDeletingCategory}
                                      />
                                      <Input
                                        value={editDraft.slug}
                                        onChange={(event) => {
                                          setEditingCategoryDrafts((currentDrafts) => ({
                                            ...currentDrafts,
                                            [category.id]: {
                                              name: editDraft.name,
                                              slug: buildCatalogGameSlug(event.target.value),
                                            },
                                          }));
                                        }}
                                        className="h-9 border-white/10 bg-white/5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-orange-500/45 focus:bg-white/8"
                                        disabled={isSavingCategory || isDeletingCategory}
                                      />
                                      <div className="flex gap-2">
                                        <button
                                          type="button"
                                          onClick={() => handleCategorySave(category)}
                                          className="inline-flex h-9 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-500/20"
                                          disabled={isSavingCategory || isDeletingCategory}
                                        >
                                          {isSavingCategory ? "..." : "Сохранить"}
                                        </button>
                                        <button
                                          type="button"
                                          onClick={stopCategoryEditing}
                                          className="inline-flex h-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 px-3 text-xs font-semibold text-zinc-300 transition hover:bg-white/10"
                                          disabled={isSavingCategory || isDeletingCategory}
                                        >
                                          Отмена
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                      <p className="truncate text-sm font-semibold text-zinc-100">
                                        {category.name}
                                      </p>
                                      <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-zinc-500">
                                        <span>{category.slug}</span>
                                        <span className="rounded-full border border-white/10 bg-black/20 px-2 py-1 tracking-normal text-zinc-400">
                                          Товаров: {category.productCount}
                                        </span>
                                      </div>
                                    </div>
                                    <div className="flex shrink-0 gap-2">
                                      <button
                                        type="button"
                                        onClick={() => startCategoryEditing(category)}
                                        className="inline-flex h-8 items-center justify-center rounded-xl border border-white/10 bg-white/5 px-3 text-xs font-semibold text-zinc-200 transition hover:bg-white/10"
                                      >
                                        ✏️ Редактировать
                                      </button>
                                      {canDeleteContent ? (
                                        <button
                                          type="button"
                                          onClick={() => handleCategoryDelete(category)}
                                          className="inline-flex h-8 items-center justify-center rounded-xl border border-red-500/20 bg-red-500/10 px-3 text-xs font-semibold text-red-100 transition hover:bg-red-500/20"
                                          disabled={isDeletingCategory}
                                        >
                                          {isDeletingCategory ? "Удаляем..." : "🗑️ Удалить"}
                                        </button>
                                      ) : null}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })
                        ) : (
                          <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 px-3 py-3 text-xs leading-6 text-zinc-500">
                            Для этой игры подкатегории ещё не созданы.
                          </div>
                        )}
                      </div>

                      <form
                        onSubmit={(event) => handleCreateCategory(event, game.id)}
                        className="mt-4 grid gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] md:items-center"
                      >
                        <Input
                          value={categoryDraft.name}
                          onChange={(event) => {
                            const nextName = event.target.value;

                            setNewCategoryDrafts((currentDrafts) => {
                              const currentDraft =
                                currentDrafts[game.id] ?? createEmptyCategoryDraft();

                              return {
                                ...currentDrafts,
                                [game.id]: {
                                  name: nextName,
                                  slug: shouldSyncSlug(
                                    currentDraft.name,
                                    currentDraft.slug,
                                  )
                                    ? buildCatalogGameSlug(nextName)
                                    : currentDraft.slug,
                                },
                              };
                            });
                          }}
                          placeholder="Name"
                          className="h-9 border-white/10 bg-white/5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-orange-500/45 focus:bg-white/8"
                          disabled={isAddingCategory || isDeletingGame}
                        />
                        <Input
                          value={categoryDraft.slug}
                          onChange={(event) => {
                            setNewCategoryDrafts((currentDrafts) => ({
                              ...currentDrafts,
                              [game.id]: {
                                name: categoryDraft.name,
                                slug: buildCatalogGameSlug(event.target.value),
                              },
                            }));
                          }}
                          placeholder="Slug"
                          className="h-9 border-white/10 bg-white/5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-orange-500/45 focus:bg-white/8"
                          disabled={isAddingCategory || isDeletingGame}
                        />
                        <button
                          type="submit"
                          className="inline-flex h-9 items-center justify-center rounded-xl bg-orange-600 px-4 text-sm font-semibold text-white transition hover:bg-orange-500 disabled:cursor-not-allowed disabled:bg-orange-950/40 disabled:text-orange-200/60"
                          disabled={
                            isAddingCategory ||
                            isDeletingGame ||
                            !categoryDraft.name.trim() ||
                            !categoryDraft.slug.trim()
                          }
                        >
                          {isAddingCategory ? "Добавляем..." : "+"}
                        </button>
                      </form>
                    </section>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}