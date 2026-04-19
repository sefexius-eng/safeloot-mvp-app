"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { ProductImageUploader } from "@/components/product/product-image-uploader";
import { useCurrency } from "@/components/providers/currency-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

interface SellCategory {
  id: string;
  name: string;
  slug: string;
}

interface SellGame {
  id: string;
  name: string;
  slug: string;
  categories: SellCategory[];
}

interface SellPageClientProps {
  games: SellGame[];
}

function createInitialFormState(games: SellGame[]) {
  const firstGame = games[0];
  const firstCategory = firstGame?.categories[0];

  return {
    title: "",
    description: "",
    autoDeliveryContent: "",
    images: [] as string[],
    price: "",
    gameId: firstGame?.id ?? "",
    categoryId: firstCategory?.id ?? "",
  };
}

export function SellPageClient({ games }: SellPageClientProps) {
  const router = useRouter();
  const { currentRate, currencySymbol } = useCurrency();
  const [formState, setFormState] = useState(() => createInitialFormState(games));
  const [errorMessage, setErrorMessage] = useState("");
  const [descriptionGeneratorError, setDescriptionGeneratorError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeneratingDescription, setIsGeneratingDescription] = useState(false);

  const selectedGame =
    games.find((game) => game.id === formState.gameId) ?? games[0] ?? null;
  const availableCategories = selectedGame?.categories ?? [];
  const localPriceValue = Number(formState.price);
  const previewBasePrice =
    Number.isFinite(localPriceValue) && localPriceValue > 0 && currentRate > 0
      ? Math.round(((localPriceValue / currentRate) + Number.EPSILON) * 100000000) /
        100000000
      : 0;

  async function handleGenerateAI() {
    const title = formState.title.trim();

    if (!title) {
      alert("Сначала введите название товара");
      return;
    }

    setDescriptionGeneratorError("");
    setIsGeneratingDescription(true);

    try {
      const response = await fetch("/api/ai/generate-description", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ title }),
      });

      const payload = (await response.json().catch(() => null)) as
        | {
            description?: string;
            message?: string;
          }
        | null;

      if (!response.ok) {
        throw new Error(payload?.message ?? "Не удалось сгенерировать описание.");
      }

      const generatedDescription = payload?.description?.trim();

      if (!generatedDescription) {
        throw new Error("ИИ вернул пустой текст. Попробуйте снова.");
      }

      setFormState((current) => ({
        ...current,
        description: generatedDescription.slice(0, 1000),
      }));
    } catch (error) {
      setDescriptionGeneratorError(
        error instanceof Error
          ? error.message
          : "Не удалось сгенерировать описание.",
      );
    } finally {
      setIsGeneratingDescription(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");
    setIsSubmitting(true);

    try {
      const numericLocalPrice = Number(formState.price);

      if (!Number.isFinite(numericLocalPrice) || numericLocalPrice <= 0) {
        throw new Error("Введите корректную цену товара.");
      }

      if (!Number.isFinite(currentRate) || currentRate <= 0) {
        throw new Error("Не удалось определить курс валюты для публикации товара.");
      }

      const basePriceInUsdt =
        Math.round(((numericLocalPrice / currentRate) + Number.EPSILON) * 100000000) /
        100000000;

      const response = await fetch("/api/products", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...formState,
          price: basePriceInUsdt,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { message?: string }
          | null;

        throw new Error(payload?.message ?? "Не удалось создать товар.");
      }

      router.push("/");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Не удалось создать товар.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
      <section className="rounded-[2rem] border border-black/8 bg-white/78 p-6 shadow-[0_18px_48px_rgba(48,32,18,0.1)] backdrop-blur md:p-8 lg:p-10">
        <div className="max-w-3xl space-y-4">
          <div className="inline-flex rounded-full border border-orange-700/15 bg-orange-700/8 px-4 py-2 text-xs font-semibold tracking-[0.28em] uppercase text-orange-800">
            Создание товара
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-neutral-950 md:text-5xl">
            Разместите новое предложение в маркетплейсе.
          </h1>
          <p className="text-base leading-8 text-neutral-700 md:text-lg">
            Заполните базовую информацию о товаре. После отправки форма создаст новую запись продукта через API и вернет вас на главную страницу.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="space-y-5">
            <FormField label="Название товара">
              <Input
                value={formState.title}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    title: event.target.value,
                  }))
                }
                placeholder="Например: Аккаунт CS2 Prime с инвентарем"
                maxLength={60}
                required
              />
            </FormField>

            <div className="space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-sm font-semibold text-neutral-800">Описание</span>
                <Button
                  type="button"
                  onClick={handleGenerateAI}
                  disabled={isGeneratingDescription || isSubmitting}
                  className="h-9 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-500 px-3.5 text-xs font-semibold text-white shadow-[0_12px_26px_rgba(99,102,241,0.34)] hover:brightness-110 focus-visible:ring-purple-500/35"
                >
                  {isGeneratingDescription ? "Генерация... ⏳" : "✨ Сгенерировать ИИ"}
                </Button>
              </div>

              <Textarea
                value={formState.description}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                placeholder="Опишите состав товара, прогресс, условия передачи и важные детали для покупателя"
                maxLength={1000}
                required
              />

              <p className="text-xs leading-6 text-neutral-500">
                ИИ использует название товара и формирует продающее SEO-описание с
                акцентом на безопасность сделки.
              </p>

              {descriptionGeneratorError ? (
                <p className="rounded-xl border border-red-500/15 bg-red-500/8 px-3 py-2 text-xs leading-6 text-red-800">
                  {descriptionGeneratorError}
                </p>
              ) : null}
            </div>

            <FormField label="Автовыдача (необязательно)">
              <Textarea
                value={formState.autoDeliveryContent}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    autoDeliveryContent: event.target.value,
                  }))
                }
                placeholder="Ключ, данные аккаунта или инструкция, которая автоматически уйдет в чат сделки после оплаты"
                maxLength={2000}
              />
              <p className="text-xs leading-6 text-neutral-500">
                Поле скрыто из публичной карточки и отправляется покупателю только после успешной оплаты.
              </p>
            </FormField>

            <ProductImageUploader
              images={formState.images}
              onChange={(images) =>
                setFormState((current) => ({
                  ...current,
                  images,
                }))
              }
              disabled={isSubmitting}
            />

            <div className="grid gap-5 md:grid-cols-2">
              <FormField label={`Цена в ${currencySymbol}`}>
                <Input
                  type="number"
                  min="0"
                  step="0.00000001"
                  inputMode="decimal"
                  value={formState.price}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      price: event.target.value,
                    }))
                  }
                  placeholder="0.00"
                  required
                />
                <p className="text-xs leading-6 text-neutral-500">
                  В базу будет сохранено {previewBasePrice > 0 ? `${previewBasePrice} USDT` : "0 USDT"} по текущему курсу.
                </p>
              </FormField>

              <FormField label="Игра">
                <Select
                  value={formState.gameId}
                  onChange={(event) =>
                    setFormState((current) => {
                      const nextGame = games.find(
                        (game) => game.id === event.target.value,
                      );

                      return {
                        ...current,
                        gameId: event.target.value,
                        categoryId: nextGame?.categories[0]?.id ?? "",
                      };
                    })
                  }
                  required
                >
                  {games.map((game) => (
                    <option key={game.id} value={game.id}>
                      {game.name}
                    </option>
                  ))}
                </Select>
              </FormField>
            </div>

            <FormField label="Категория">
              <Select
                value={formState.categoryId}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    categoryId: event.target.value,
                  }))
                }
                required
                disabled={!selectedGame || availableCategories.length === 0}
              >
                {availableCategories.length === 0 ? (
                  <option value="">Нет доступных категорий</option>
                ) : (
                  availableCategories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))
                )}
              </Select>
            </FormField>
          </div>

          <aside className="rounded-[1.75rem] border border-black/8 bg-[#faf7f2] p-5 shadow-[0_12px_30px_rgba(48,32,18,0.06)]">
            <div className="space-y-4">
              <h2 className="text-lg font-semibold tracking-tight text-neutral-950">
                Публикация предложения
              </h2>
              <p className="text-sm leading-7 text-neutral-600">
                Сейчас форма отправляет данные на route handler client-приложения, который проксирует запрос в backend на создание Product.
              </p>
              <div className="rounded-2xl border border-black/8 bg-white/75 p-4 text-sm leading-7 text-neutral-700">
                Товар публикуется от имени пользователя из активной сессии. Если вы не вошли в аккаунт, API вернет ошибку авторизации.
              </div>

              {games.length === 0 ? (
                <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm leading-7 text-amber-900">
                  Каталог игр пока не инициализирован. Запустите seed командой npm run seed:catalog.
                </div>
              ) : null}

              {errorMessage ? (
                <div className="rounded-2xl border border-red-500/15 bg-red-500/8 p-4 text-sm leading-7 text-red-800">
                  {errorMessage}
                </div>
              ) : null}

              <Button type="submit" disabled={isSubmitting || games.length === 0} className="w-full">
                {isSubmitting ? "Публикуем товар..." : "Опубликовать товар"}
              </Button>
            </div>
          </aside>
        </form>
      </section>
    </main>
  );
}

function FormField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-2.5">
      <span className="text-sm font-semibold text-neutral-800">{label}</span>
      {children}
    </label>
  );
}