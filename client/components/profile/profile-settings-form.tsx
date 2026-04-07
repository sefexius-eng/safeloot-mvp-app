"use client";

import type { Role } from "@prisma/client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

import { updateUserProfile } from "@/app/actions/profile";
import {
  createTelegramLinkAction,
  disconnectTelegramAction,
} from "@/app/actions/telegram";
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
import { Switch } from "@/components/ui/switch";

interface ProfileSettingsFormProps {
  initialBadges: string[];
  initialBannerUrl: string | null;
  initialEmail: string;
  initialEmailNotifications: boolean;
  initialName: string;
  initialImage: string | null;
  initialPushNotifications: boolean;
  initialTelegramId: string | null;
  initialRole: Role;
}

const ACCEPTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_AVATAR_DIMENSION = 200;
const MAX_BANNER_WIDTH = 1600;
const MAX_BANNER_HEIGHT = 640;
const AVATAR_WEBP_QUALITY = 0.82;
const BANNER_WEBP_QUALITY = 0.84;

interface ImageCompressionOptions {
  maxWidth: number;
  maxHeight: number;
  quality: number;
  subjectLabel: string;
}

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

async function compressImageToWebpBase64(
  file: File,
  { maxWidth, maxHeight, quality, subjectLabel }: ImageCompressionOptions,
) {
  if (!ACCEPTED_IMAGE_TYPES.has(file.type)) {
    throw new Error("Поддерживаются только JPG, PNG и WebP.");
  }

  const source = await readFileAsDataUrl(file);
  const image = await loadImage(source);
  const scale = Math.min(
    maxWidth / image.width,
    maxHeight / image.height,
    1,
  );
  const targetWidth = Math.max(1, Math.round(image.width * scale));
  const targetHeight = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement("canvas");

  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error(`Не удалось подготовить холст для ${subjectLabel}.`);
  }

  context.drawImage(image, 0, 0, targetWidth, targetHeight);

  const webpBlob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/webp", quality);
  });

  if (!webpBlob) {
    throw new Error("Не удалось сжать изображение.");
  }

  return readFileAsDataUrl(webpBlob);
}

function compressAvatarToWebpBase64(file: File) {
  return compressImageToWebpBase64(file, {
    maxWidth: MAX_AVATAR_DIMENSION,
    maxHeight: MAX_AVATAR_DIMENSION,
    quality: AVATAR_WEBP_QUALITY,
    subjectLabel: "аватара",
  });
}

function compressBannerToWebpBase64(file: File) {
  return compressImageToWebpBase64(file, {
    maxWidth: MAX_BANNER_WIDTH,
    maxHeight: MAX_BANNER_HEIGHT,
    quality: BANNER_WEBP_QUALITY,
    subjectLabel: "баннера",
  });
}

async function requestBrowserPushPermissionIfNeeded() {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return {
      ok: false as const,
      message: "Ваш браузер не поддерживает системные уведомления.",
    };
  }

  if (window.Notification.permission === "granted") {
    return {
      ok: true as const,
      permission: "granted" as NotificationPermission,
    };
  }

  if (window.Notification.permission === "denied") {
    return {
      ok: false as const,
      message: "Системные уведомления заблокированы в браузере. Разрешите их в настройках браузера.",
    };
  }

  const permission = await window.Notification.requestPermission();

  if (permission !== "granted") {
    return {
      ok: false as const,
      message: "Чтобы получать push-уведомления, разрешите показ уведомлений в браузере.",
    };
  }

  return {
    ok: true as const,
    permission,
  };
}

export function ProfileSettingsForm({
  initialBadges,
  initialBannerUrl,
  initialEmail,
  initialEmailNotifications,
  initialImage,
  initialName,
  initialPushNotifications,
  initialTelegramId,
  initialRole,
}: ProfileSettingsFormProps) {
  const router = useRouter();
  const { update } = useSession();
  const [name, setName] = useState(initialName);
  const [image, setImage] = useState<string | null>(initialImage);
  const [bannerUrl, setBannerUrl] = useState(initialBannerUrl ?? "");
  const [emailNotifications, setEmailNotifications] = useState(initialEmailNotifications);
  const [pushNotifications, setPushNotifications] = useState(initialPushNotifications);
  const [savedName, setSavedName] = useState(initialName);
  const [savedImage, setSavedImage] = useState<string | null>(initialImage);
  const [savedBannerUrl, setSavedBannerUrl] = useState(initialBannerUrl ?? "");
  const [savedEmailNotifications, setSavedEmailNotifications] = useState(initialEmailNotifications);
  const [savedPushNotifications, setSavedPushNotifications] = useState(initialPushNotifications);
  const [telegramId, setTelegramId] = useState<string | null>(initialTelegramId);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isProcessingAvatar, setIsProcessingAvatar] = useState(false);
  const [isProcessingBanner, setIsProcessingBanner] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [isTelegramPending, startTelegramTransition] = useTransition();

  const displayName = name.trim() || initialEmail.split("@")[0] || "Профиль";
  const normalizedBannerUrl = bannerUrl.trim();
  const isProcessingImage = isProcessingAvatar || isProcessingBanner;
  const hasChanges =
    name.trim() !== savedName ||
    image !== savedImage ||
    normalizedBannerUrl !== savedBannerUrl ||
    emailNotifications !== savedEmailNotifications ||
    pushNotifications !== savedPushNotifications;
  const isSaveDisabled = !name.trim() || !hasChanges || isPending || isProcessingImage;

  async function handleAvatarSelection(file: File) {
    setErrorMessage("");
    setSuccessMessage("");
    setIsProcessingAvatar(true);

    try {
      const compressedImage = await compressAvatarToWebpBase64(file);
      setImage(compressedImage);
    } finally {
      setIsProcessingAvatar(false);
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

  async function handleBannerSelection(file: File) {
    setErrorMessage("");
    setSuccessMessage("");
    setIsProcessingBanner(true);

    try {
      const compressedBanner = await compressBannerToWebpBase64(file);
      setBannerUrl(compressedBanner);
    } finally {
      setIsProcessingBanner(false);
    }
  }

  function handleBannerFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    event.target.value = "";

    if (!file) {
      return;
    }

    void handleBannerSelection(file).catch((error) => {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Не удалось подготовить баннер.",
      );
    });
  }

  async function saveProfile() {
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const result = await updateUserProfile(
        name,
        image,
        bannerUrl,
        emailNotifications,
        pushNotifications,
      );

      if (!result.ok) {
        setErrorMessage(result.message || "Не удалось сохранить профиль.");
        return;
      }

      const nextName = result.name ?? name.trim();
      const nextImage = result.image ?? null;
      const nextBannerUrl = result.bannerUrl ?? null;
      const nextEmailNotifications = result.emailNotifications ?? emailNotifications;
      const nextPushNotifications = result.pushNotifications ?? pushNotifications;

      setName(nextName);
      setImage(nextImage);
      setBannerUrl(nextBannerUrl ?? "");
      setEmailNotifications(nextEmailNotifications);
      setPushNotifications(nextPushNotifications);
      setSavedName(nextName);
      setSavedImage(nextImage);
      setSavedBannerUrl(nextBannerUrl ?? "");
      setSavedEmailNotifications(nextEmailNotifications);
      setSavedPushNotifications(nextPushNotifications);

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

  function handleConnectTelegram() {
    setErrorMessage("");
    setSuccessMessage("");

    startTelegramTransition(() => {
      void createTelegramLinkAction()
        .then((result) => {
          if (!result.ok) {
            setErrorMessage(
              result.error || result.message || "Не удалось подготовить подключение Telegram.",
            );
            return;
          }

          if (result.telegramId) {
            setTelegramId(result.telegramId);
          }

          if (result.url && typeof window !== "undefined") {
            const popup = window.open(result.url, "_blank", "noopener,noreferrer");

            if (!popup) {
              window.location.href = result.url;
            }
          }

          setSuccessMessage(
            result.message || "Откройте Telegram и подтвердите привязку через бота.",
          );
          router.refresh();
        })
        .catch(() => {
          setErrorMessage("Не удалось подготовить подключение Telegram.");
        });
    });
  }

  function handleDisconnectTelegram() {
    setErrorMessage("");
    setSuccessMessage("");

    startTelegramTransition(() => {
      void disconnectTelegramAction()
        .then((result) => {
          if (!result.ok) {
            setErrorMessage(
              result.error || result.message || "Не удалось отключить Telegram.",
            );
            return;
          }

          setTelegramId(null);
          setSuccessMessage(result.message || "Telegram отключен.");
          router.refresh();
        })
        .catch(() => {
          setErrorMessage("Не удалось отключить Telegram.");
        });
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(400px,440px)_minmax(0,1fr)]">
      <Card className="w-full min-w-[320px] overflow-visible border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(251,146,60,0.22),transparent_35%),rgba(9,9,11,0.9)]">
        <CardHeader>
          <p className="text-xs font-semibold tracking-[0.24em] uppercase text-orange-200/80">
            Preview
          </p>
          <CardTitle>Как профиль выглядит сейчас</CardTitle>
          <CardDescription>
            В предпросмотре видно новую Steam-подобную шапку. Аватар автоматически сжимается до {MAX_AVATAR_DIMENSION}x{MAX_AVATAR_DIMENSION}, а баннер загружается файлом и сразу появляется слева.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6 px-5 pb-6 sm:px-6">
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

          <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4 text-sm leading-7 break-words text-zinc-300">
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
            Укажите удобный никнейм, загрузите новый аватар и добавьте баннер файлом. Достижения теперь приходят как из админки, так и автоматически по статистике продавца.
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
            <label htmlFor="profile-banner" className="text-sm font-semibold text-zinc-200">
              Баннер профиля
            </label>
            <input
              id="profile-banner"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleBannerFileChange}
              className="block w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-zinc-200 file:mr-4 file:rounded-xl file:border-0 file:bg-sky-600 file:px-4 file:py-2 file:font-semibold file:text-white file:transition hover:file:bg-sky-500"
            />
            <p className="text-sm leading-7 text-zinc-500">
              Поддерживаются JPG, PNG и WebP. Баннер автоматически конвертируется в WebP и сразу показывается в превью. Если очистить поле, в профиле останется фирменный градиентный фон.
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

          <section className="space-y-4 rounded-[1.75rem] border border-white/10 bg-white/5 p-5">
            <div>
              <h3 className="text-base font-semibold text-white">Настройки уведомлений</h3>
              <p className="mt-1 text-sm leading-7 text-zinc-400">
                Выберите, как получать уведомления о новых заказах, сообщениях и событиях аккаунта.
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-start justify-between gap-4 rounded-[1.25rem] border border-white/10 bg-black/20 px-4 py-3">
                <div className="min-w-0">
                  <label htmlFor="profile-email-notifications" className="text-sm font-semibold text-zinc-100">
                    Email-уведомления
                  </label>
                  <p className="mt-1 text-sm leading-6 text-zinc-400">
                    Получать письма о новых заказах и сообщениях
                  </p>
                </div>
                <Switch
                  id="profile-email-notifications"
                  checked={emailNotifications}
                  onCheckedChange={(checked) => {
                    setEmailNotifications(checked);
                    setErrorMessage("");
                    setSuccessMessage("");
                  }}
                />
              </div>

              <div className="flex items-start justify-between gap-4 rounded-[1.25rem] border border-white/10 bg-black/20 px-4 py-3">
                <div className="min-w-0">
                  <label htmlFor="profile-push-notifications" className="text-sm font-semibold text-zinc-100">
                    Браузерные push-уведомления
                  </label>
                  <p className="mt-1 text-sm leading-6 text-zinc-400">
                    Мгновенные всплывающие уведомления на экране
                  </p>
                </div>
                <Switch
                  id="profile-push-notifications"
                  checked={pushNotifications}
                  onCheckedChange={(checked) => {
                    setPushNotifications(checked);
                    setErrorMessage("");
                    setSuccessMessage("");

                    if (!checked) {
                      return;
                    }

                    void requestBrowserPushPermissionIfNeeded().then((result) => {
                      if (!result.ok) {
                        setErrorMessage(result.message);
                      }
                    });
                  }}
                />
              </div>

              <div className="flex flex-col gap-4 rounded-[1.25rem] border border-white/10 bg-black/20 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-zinc-100">
                    Telegram-бот
                  </div>
                  {telegramId ? (
                    <p className="mt-1 break-words text-sm leading-6 text-emerald-300">
                      ✅ Подключено (ID: {telegramId})
                    </p>
                  ) : (
                    <p className="mt-1 text-sm leading-6 text-zinc-400">
                      Подключите Telegram, чтобы получать уведомления о сделках напрямую в боте SafeLoot.
                    </p>
                  )}
                </div>

                {telegramId ? (
                  <Button
                    type="button"
                    onClick={handleDisconnectTelegram}
                    disabled={isTelegramPending}
                    className="border border-white/10 bg-white/5 text-zinc-200 shadow-none hover:bg-white/10"
                  >
                    {isTelegramPending ? "Отключаем..." : "Отключить"}
                  </Button>
                ) : (
                  <Button
                    type="button"
                    onClick={handleConnectTelegram}
                    disabled={isTelegramPending}
                    className="bg-sky-600 text-white shadow-[0_16px_40px_rgba(2,132,199,0.28)] hover:bg-sky-500"
                  >
                    {isTelegramPending ? "Готовим ссылку..." : "Подключить Telegram"}
                  </Button>
                )}
              </div>
            </div>
          </section>

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

          {isProcessingAvatar ? (
            <p className="text-sm text-zinc-400">Подготавливаем аватар для загрузки...</p>
          ) : null}
          {isProcessingBanner ? (
            <p className="text-sm text-zinc-400">Подготавливаем баннер для загрузки...</p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}