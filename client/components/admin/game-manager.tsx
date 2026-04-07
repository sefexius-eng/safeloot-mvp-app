"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import {
  createCatalogGame,
  updateCatalogGameImage,
  type CatalogGameSummary,
} from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface GameManagerProps {
  games: CatalogGameSummary[];
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

export function GameManager({ games: initialGames }: GameManagerProps) {
  const router = useRouter();
  const [games, setGames] = useState(initialGames);
  const [formState, setFormState] = useState({
    name: "",
    slug: "",
    imageUrl: "",
  });
  const [imageDrafts, setImageDrafts] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      initialGames.map((game) => [game.id, game.imageUrl ?? ""]),
    ),
  );
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [isSlugDirty, setIsSlugDirty] = useState(false);
  const [savingGameId, setSavingGameId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setGames(initialGames);
    setImageDrafts(
      Object.fromEntries(
        initialGames.map((game) => [game.id, game.imageUrl ?? ""]),
      ),
    );
  }, [initialGames]);

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

          setGames((currentGames) => [
            result.game as CatalogGameSummary,
            ...currentGames.filter((game) => game.id !== result.game?.id),
          ]);
          setImageDrafts((currentDrafts) => ({
            ...currentDrafts,
            [result.game!.id]: result.game!.imageUrl ?? "",
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
        .catch(() => {
          setFeedback({
            type: "error",
            message: "Не удалось добавить игру.",
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

        setGames((currentGames) =>
          currentGames.map((game) =>
            game.id === result.game?.id ? (result.game as CatalogGameSummary) : game,
          ),
        );
        setImageDrafts((currentDrafts) => ({
          ...currentDrafts,
          [result.game!.id]: result.game!.imageUrl ?? "",
        }));
        setFeedback({
          type: "success",
          message: result.message ?? "Обложка игры обновлена.",
        });
        router.refresh();
      })
      .catch(() => {
        setFeedback({
          type: "error",
          message: "Не удалось обновить обложку игры.",
        });
      })
      .finally(() => {
        setSavingGameId(null);
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
            placeholder="https://example.com/game-cover.jpg"
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
        Если URL постера не указан, на витрине и в поиске будет использоваться градиентный fallback с буквой игры.
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
            const isSaving = savingGameId === game.id;

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
                        placeholder="https://example.com/game-cover.jpg"
                        className="border-white/10 bg-white/5 text-zinc-100 placeholder:text-zinc-500 focus:border-orange-500/45 focus:bg-white/8"
                        disabled={isSaving}
                      />
                    </label>

                    <div className="flex flex-wrap gap-3">
                      <Button
                        type="button"
                        onClick={() => handleImageSave(game.id)}
                        disabled={isSaving}
                        className="h-11 rounded-2xl bg-sky-600 px-5 text-sm font-semibold text-white shadow-[0_16px_40px_rgba(2,132,199,0.24)] hover:bg-sky-500"
                      >
                        {isSaving ? "Сохраняем..." : "Сохранить URL"}
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
                        disabled={isSaving}
                      >
                        Очистить
                      </button>
                    </div>
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