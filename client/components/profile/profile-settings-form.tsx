"use client";

import type { Role } from "@prisma/client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

import { updateUserProfile } from "@/app/actions/profile";
import { ProfileHero } from "@/components/profile/profile-hero";
import { ProfileRoleBadge } from "@/components/profile/profile-role-badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";

interface ProfileSettingsFormProps {
  initialBadges: string[];
  initialBannerUrl: string | null;
  initialEmail: string;
  initialName: string;
  initialImage: string | null;
  initialRole: Role;
}

const ACCEPTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_IMAGE_DIMENSION = 200;
const WEBP_QUALITY = 0.82;

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

async function compressImageToWebpBase64(file: File) {
  if (!ACCEPTED_IMAGE_TYPES.has(file.type)) {
    throw new Error("Поддерживаются только JPG, PNG и WebP.");
  }

  const source = await readFileAsDataUrl(file);
  const image = await loadImage(source);
  const scale = Math.min(
    MAX_IMAGE_DIMENSION / image.width,
    MAX_IMAGE_DIMENSION / image.height,
    1,
  );
  const targetWidth = Math.max(1, Math.round(image.width * scale));
  const targetHeight = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement("canvas");

  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Не удалось подготовить холст для аватара.");
  }

  context.drawImage(image, 0, 0, targetWidth, targetHeight);

  const webpBlob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/webp", WEBP_QUALITY);
  });

  if (!webpBlob) {
    throw new Error("Не удалось сжать изображение.");
  }

  return readFileAsDataUrl(webpBlob);
}

export function ProfileSettingsForm({
  initialBadges,
  initialBannerUrl,
  initialEmail,
  initialImage,
  initialName,
  initialRole,
}: ProfileSettingsFormProps) {
  const router = useRouter();
  const { update } = useSession();
  const [name, setName] = useState(initialName);
  const [image, setImage] = useState<string | null>(initialImage);
  const [bannerUrl, setBannerUrl] = useState(initialBannerUrl ?? "");
  const [savedName, setSavedName] = useState(initialName);
  const [savedImage, setSavedImage] = useState<string | null>(initialImage);
  const [savedBannerUrl, setSavedBannerUrl] = useState(initialBannerUrl ?? "");
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [isPending, startTransition] = useTransition();

  const displayName = name.trim() || initialEmail.split("@")[0] || "Профиль";
  const normalizedBannerUrl = bannerUrl.trim();
  const hasChanges =
    name.trim() !== savedName ||
    image !== savedImage ||
    normalizedBannerUrl !== savedBannerUrl;
  const isSaveDisabled = !name.trim() || !hasChanges || isPending || isProcessingImage;

  async function handleAvatarSelection(file: File) {
    setErrorMessage("");
    setSuccessMessage("");
    setIsProcessingImage(true);

    try {
      const compressedImage = await compressImageToWebpBase64(file);
      setImage(compressedImage);
    } finally {
      setIsProcessingImage(false);
    }
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    event.target.value = "";

    if (!file) {
      return;
    }

    void handleAvatarSelection(file).catch((error) => {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Не удалось подготовить аватар.",
      );
    });
  }

  function handleRemoveAvatar() {
    setErrorMessage("");
    setSuccessMessage("");
    setImage(null);
  }

  async function saveProfile() {
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const result = await updateUserProfile(name, image, bannerUrl);

      if (!result.ok) {
        setErrorMessage(result.message || "Не удалось сохранить профиль.");
        return;
      }

      const nextName = result.name ?? name.trim();
      const nextImage = result.image ?? null;
      const nextBannerUrl = result.bannerUrl ?? null;

      setName(nextName);
      setImage(nextImage);
      setBannerUrl(nextBannerUrl ?? "");
      setSavedName(nextName);
      setSavedImage(nextImage);
      setSavedBannerUrl(nextBannerUrl ?? "");

      await update();
      router.refresh();
      setSuccessMessage("Профиль обновлен.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Не удалось сохранить профиль.",
      );
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
      <Card className="overflow-hidden border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(251,146,60,0.22),transparent_35%),rgba(9,9,11,0.9)]">
        <CardHeader>
          <p className="text-xs font-semibold tracking-[0.24em] uppercase text-orange-200/80">
            Preview
          </p>
          <CardTitle>Как профиль выглядит сейчас</CardTitle>
          <CardDescription>
            В предпросмотре видно новую Steam-подобную шапку. Аватар автоматически сжимается до {MAX_IMAGE_DIMENSION}x{MAX_IMAGE_DIMENSION}, а баннер тянется по внешней ссылке.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <ProfileHero
            eyebrow="Preview"
            displayName={displayName}
            avatarName={displayName}
            avatarSrc={image}
            bannerUrl={normalizedBannerUrl || null}
            roleBadge={<ProfileRoleBadge role={initialRole} />}
            badges={initialBadges}
            details={
              <>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-zinc-300">
                  {initialEmail}
                </span>
                <span className="rounded-full border border-orange-500/20 bg-orange-500/10 px-3 py-1.5 text-orange-100">
                  Баннер и аватар обновятся после сохранения
                </span>
              </>
            }
            className="border-white/10 bg-black/20 p-3 shadow-none"
          />

          {initialBadges.length === 0 ? (
            <div className="rounded-[1.5rem] border border-dashed border-white/10 bg-white/5 px-4 py-4 text-sm leading-7 text-zinc-400">
              У профиля пока нет достижений. Автобейджи подтянутся сами после нужных метрик продавца, а ручные можно выдать из админки.
            </div>
          ) : null}

          <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4 text-sm leading-7 text-zinc-300">
            Такой же баннер, аватар и никнейм будут использоваться в личном кабинете и на публичной странице продавца после сохранения.
          </div>
        </CardContent>
      </Card>

      <Card className="border-white/10 bg-zinc-900/80">
        <CardHeader>
          <p className="text-xs font-semibold tracking-[0.24em] uppercase text-zinc-500">
            Profile Studio
          </p>
          <CardTitle>Настройки профиля</CardTitle>
          <CardDescription>
            Укажите удобный никнейм, загрузите новый аватар и добавьте ссылку на баннер. Достижения теперь приходят как из админки, так и автоматически по статистике продавца.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="space-y-3">
            <label htmlFor="profile-name" className="text-sm font-semibold text-zinc-200">
              Никнейм
            </label>
            <Input
              id="profile-name"
              name="name"
              maxLength={40}
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                setErrorMessage("");
                setSuccessMessage("");
              }}
              placeholder="Введите ваш никнейм"
            />
            <p className="text-sm text-zinc-500">
              До 40 символов. Если ник пустой, сохранить изменения нельзя.
            </p>
          </div>

          <div className="space-y-3">
            <label htmlFor="profile-banner-url" className="text-sm font-semibold text-zinc-200">
              Баннер профиля
            </label>
            <Input
              id="profile-banner-url"
              name="bannerUrl"
              type="url"
              inputMode="url"
              value={bannerUrl}
              onChange={(event) => {
                setBannerUrl(event.target.value);
                setErrorMessage("");
                setSuccessMessage("");
              }}
              placeholder="https://cdn.example.com/profile-banner.webp"
            />
            <p className="text-sm leading-7 text-zinc-500">
              Подойдет прямая ссылка на изображение из внешнего стораджа или CDN. Если оставить поле пустым, в профиле останется фирменный градиентный фон.
            </p>
          </div>

          <div className="space-y-3">
            <label htmlFor="profile-avatar" className="text-sm font-semibold text-zinc-200">
              Аватар
            </label>
            <input
              id="profile-avatar"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileChange}
              className="block w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-zinc-200 file:mr-4 file:rounded-xl file:border-0 file:bg-orange-600 file:px-4 file:py-2 file:font-semibold file:text-white file:transition hover:file:bg-orange-500"
            />
            <p className="text-sm leading-7 text-zinc-500">
              Поддерживаются JPG, PNG и WebP. Перед сохранением изображение сжимается до компактного формата для Vercel-friendly MVP.
            </p>
          </div>

          {errorMessage ? (
            <div className="rounded-[1.5rem] border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {errorMessage}
            </div>
          ) : null}

          {successMessage ? (
            <div className="rounded-[1.5rem] border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
              {successMessage}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              onClick={() => {
                startTransition(async () => {
                  await saveProfile();
                });
              }}
              disabled={isSaveDisabled}
              className="bg-orange-600 shadow-[0_16px_40px_rgba(249,115,22,0.28)] hover:bg-orange-500"
            >
              {isPending ? "Сохраняем..." : "Сохранить профиль"}
            </Button>

            <Button
              type="button"
              onClick={handleRemoveAvatar}
              disabled={!image || isPending || isProcessingImage}
              className="border border-white/10 bg-white/5 text-zinc-200 shadow-none hover:bg-white/10"
            >
              Удалить аватар
            </Button>

            <Button
              type="button"
              onClick={() => {
                setBannerUrl("");
                setErrorMessage("");
                setSuccessMessage("");
              }}
              disabled={!bannerUrl.trim() || isPending || isProcessingImage}
              className="border border-white/10 bg-white/5 text-zinc-200 shadow-none hover:bg-white/10"
            >
              Очистить баннер
            </Button>
          </div>

          {isProcessingImage ? (
            <p className="text-sm text-zinc-400">Подготавливаем изображение для загрузки...</p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}