"use client";

import { ChangeEvent, useId, useState } from "react";

const MAX_PRODUCT_IMAGE_COUNT = 3;
const MAX_PRODUCT_IMAGE_WIDTH = 800;
const PRODUCT_IMAGE_QUALITY = 0.7;

function readFileAsDataUrl(file: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }

      reject(new Error("Не удалось прочитать изображение."));
    };

    reader.onerror = () => {
      reject(new Error("Не удалось прочитать изображение."));
    };

    reader.readAsDataURL(file);
  });
}

function loadImage(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new window.Image();

    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Не удалось обработать изображение."));
    image.src = source;
  });
}

async function compressProductImage(file: File) {
  if (!file.type.startsWith("image/")) {
    throw new Error("Можно загружать только изображения.");
  }

  const source = await readFileAsDataUrl(file);
  const image = await loadImage(source);
  const scale = Math.min(MAX_PRODUCT_IMAGE_WIDTH / image.width, 1);
  const targetWidth = Math.max(1, Math.round(image.width * scale));
  const targetHeight = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement("canvas");

  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Не удалось подготовить изображение для загрузки.");
  }

  context.drawImage(image, 0, 0, targetWidth, targetHeight);

  return canvas.toDataURL("image/webp", PRODUCT_IMAGE_QUALITY);
}

interface ProductImageUploaderProps {
  images: string[];
  onChange: (images: string[]) => void;
  disabled?: boolean;
}

export function ProductImageUploader({
  images,
  onChange,
  disabled = false,
}: ProductImageUploaderProps) {
  const inputId = useId();
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleFileSelection(event: ChangeEvent<HTMLInputElement>) {
    const selectedFiles = Array.from(event.target.files ?? []);
    event.target.value = "";

    if (selectedFiles.length === 0) {
      return;
    }

    const remainingSlots = MAX_PRODUCT_IMAGE_COUNT - images.length;

    if (remainingSlots <= 0) {
      setErrorMessage("Можно загрузить не более 3 скриншотов.");
      return;
    }

    if (selectedFiles.length > remainingSlots) {
      setErrorMessage(`Будут загружены только первые ${remainingSlots} изображения.`);
    } else {
      setErrorMessage("");
    }

    setIsProcessing(true);

    try {
      const processedImages = await Promise.all(
        selectedFiles
          .slice(0, remainingSlots)
          .map((file) => compressProductImage(file)),
      );

      onChange([...images, ...processedImages]);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Не удалось загрузить изображения.",
      );
    } finally {
      setIsProcessing(false);
    }
  }

  function handleRemove(indexToRemove: number) {
    setErrorMessage("");
    onChange(images.filter((_, index) => index !== indexToRemove));
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={inputId} className="text-sm font-semibold text-neutral-800">
          Скриншоты товара
        </label>
        <span className="text-xs font-medium text-neutral-500">
          {images.length}/{MAX_PRODUCT_IMAGE_COUNT}
        </span>
      </div>

      <label
        htmlFor={inputId}
        className="flex cursor-pointer flex-col items-center justify-center rounded-[1.5rem] border border-dashed border-black/10 bg-white/70 px-5 py-8 text-center transition hover:border-orange-400/40 hover:bg-white disabled:cursor-not-allowed"
      >
        <span className="text-sm font-semibold text-neutral-900">
          {isProcessing ? "Сжимаем и загружаем изображения..." : "Добавить до 3 скриншотов"}
        </span>
        <span className="mt-2 text-sm leading-6 text-neutral-500">
          JPG, PNG и другие изображения будут автоматически сжаты до WebP, ширина до 800px.
        </span>
        <input
          id={inputId}
          type="file"
          multiple
          accept="image/*"
          onChange={handleFileSelection}
          disabled={disabled || isProcessing || images.length >= MAX_PRODUCT_IMAGE_COUNT}
          className="sr-only"
        />
      </label>

      {images.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {images.map((image, index) => (
            <div
              key={`product-upload-${index + 1}`}
              className="relative overflow-hidden rounded-2xl border border-black/8 bg-white shadow-[0_10px_24px_rgba(48,32,18,0.08)]"
            >
              <img
                src={image}
                alt={`Скриншот товара ${index + 1}`}
                className="aspect-square h-full w-full object-cover"
              />
              <button
                type="button"
                onClick={() => handleRemove(index)}
                disabled={disabled || isProcessing}
                className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-black/75 text-sm font-semibold text-white transition hover:bg-black"
                aria-label={`Удалить скриншот ${index + 1}`}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      ) : null}

      {errorMessage ? (
        <div className="rounded-2xl border border-red-500/15 bg-red-500/8 p-4 text-sm leading-7 text-red-800">
          {errorMessage}
        </div>
      ) : null}
    </div>
  );
}