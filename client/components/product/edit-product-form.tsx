"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { updateProduct } from "@/app/actions/product";
import { ProductImageUploader } from "@/components/product/product-image-uploader";
import { useCurrency } from "@/components/providers/currency-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

interface EditCategory {
  id: string;
  name: string;
  slug: string;
}

interface EditGame {
  id: string;
  name: string;
  slug: string;
  categories: EditCategory[];
}

interface EditProductInitialData {
  id: string;
  title: string;
  description: string;
  images: string[];
  price: string;
  gameId: string;
  categoryId: string;
}

interface EditProductFormProps {
  product: EditProductInitialData;
  games: EditGame[];
}

function formatEditablePrice(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return "";
  }

  return value.toFixed(8).replace(/\.0+$|0+$/g, "").replace(/\.$/, "");
}

export function EditProductForm({ product, games }: EditProductFormProps) {
  const router = useRouter();
  const { currentRate, currencySymbol, isHydrated } = useCurrency();
  const [formState, setFormState] = useState({
    title: product.title,
    description: product.description,
    images: product.images,
    price: "",
    gameId: product.gameId,
    categoryId: product.categoryId,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isPriceInitialized, setIsPriceInitialized] = useState(false);

  const selectedGame =
    games.find((game) => game.id === formState.gameId) ?? games[0] ?? null;
  const availableCategories = selectedGame?.categories ?? [];
  const localPriceValue = Number(formState.price);
  const previewBasePrice =
    Number.isFinite(localPriceValue) && localPriceValue > 0 && currentRate > 0
      ? Math.round(((localPriceValue / currentRate) + Number.EPSILON) * 100000000) /
        100000000
      : 0;

  useEffect(() => {
    if (!isHydrated || isPriceInitialized) {
      return;
    }

    const localizedPrice = formatEditablePrice(Number(product.price) * currentRate);

    setFormState((current) => ({
      ...current,
      price: localizedPrice,
    }));
    setIsPriceInitialized(true);
  }, [currentRate, isHydrated, isPriceInitialized, product.price]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");
    setIsSubmitting(true);

    try {
      const numericLocalPrice = Number(formState.price);

      if (!Number.isFinite(numericLocalPrice) || numericLocalPrice <= 0) {
        throw new Error("Введите корректную цену товара.");
      }

      if (!Number.isFinite(currentRate) || currentRate <= 0) {
        throw new Error("Не удалось определить курс валюты для обновления товара.");
      }

      const basePriceInUsdt =
        Math.round(((numericLocalPrice / currentRate) + Number.EPSILON) * 100000000) /
        100000000;

      const result = await updateProduct(product.id, {
        title: formState.title,
        description: formState.description,
        images: formState.images,
        price: basePriceInUsdt,
        gameId: formState.gameId,
        categoryId: formState.categoryId,
      });

      if (!result.ok) {
        throw new Error(result.message ?? "Не удалось обновить товар.");
      }

      router.push("/profile");
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Не удалось обновить товар.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!isPriceInitialized) {
    return (
      <div className="rounded-[2rem] border border-black/8 bg-white/78 p-8 text-sm text-neutral-600 shadow-[0_18px_48px_rgba(48,32,18,0.1)] backdrop-blur">
        Подготавливаем форму редактирования...
      </div>
    );
  }

  return (
    <section className="rounded-[2rem] border border-black/8 bg-white/78 p-6 shadow-[0_18px_48px_rgba(48,32,18,0.1)] backdrop-blur md:p-8 lg:p-10">
      <div className="max-w-3xl space-y-4">
        <div className="inline-flex rounded-full border border-sky-700/15 bg-sky-700/8 px-4 py-2 text-xs font-semibold tracking-[0.28em] uppercase text-sky-800">
          Редактирование товара
        </div>
        <h1 className="text-3xl font-semibold tracking-tight text-neutral-950 md:text-5xl">
          Обновите публикацию без потери карточки товара.
        </h1>
        <p className="text-base leading-8 text-neutral-700 md:text-lg">
          Изменения сохраняются от имени владельца товара. Цена отображается в вашей локальной валюте, а в базу отправляется в USDT.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="space-y-5">
          <EditFormField label="Название товара">
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
          </EditFormField>

          <EditFormField label="Описание">
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
          </EditFormField>

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
            <EditFormField label={`Цена в ${currencySymbol}`}>
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
                После сохранения в базу попадет {previewBasePrice > 0 ? `${previewBasePrice} USDT` : "0 USDT"} по текущему курсу.
              </p>
            </EditFormField>

            <EditFormField label="Игра">
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
            </EditFormField>
          </div>

          <EditFormField label="Категория">
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
          </EditFormField>
        </div>

        <aside className="rounded-[1.75rem] border border-black/8 bg-[#faf7f2] p-5 shadow-[0_12px_30px_rgba(48,32,18,0.06)]">
          <div className="space-y-4">
            <h2 className="text-lg font-semibold tracking-tight text-neutral-950">
              Управление публикацией
            </h2>
            <p className="text-sm leading-7 text-neutral-600">
              Можно скорректировать описание, цену, игру и категорию без создания новой карточки товара.
            </p>
            <div className="rounded-2xl border border-black/8 bg-white/75 p-4 text-sm leading-7 text-neutral-700">
              Сервер повторно проверит право владения товаром и очистит текст от HTML перед сохранением.
            </div>

            {errorMessage ? (
              <div className="rounded-2xl border border-red-500/15 bg-red-500/8 p-4 text-sm leading-7 text-red-800">
                {errorMessage}
              </div>
            ) : null}

            <Button type="submit" disabled={isSubmitting || games.length === 0} className="w-full bg-sky-700 hover:bg-sky-600">
              {isSubmitting ? "Сохраняем изменения..." : "Сохранить изменения"}
            </Button>
          </div>
        </aside>
      </form>
    </section>
  );
}

function EditFormField({
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