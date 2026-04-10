"use client";

import type { Role } from "@prisma/client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

import { updateUserProfile } from "@/app/actions/profile";
import { updateSellerAutomationSettings } from "@/app/actions/seller-automation";
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
import { Textarea } from "@/components/ui/textarea";

interface ProfileSettingsFormProps {
  initialBadges: string[];
  initialBannerUrl: string | null;
  initialEmail: string;
  initialEmailNotifications: boolean;
  initialName: string;
  initialImage: string | null;
  initialActiveColor: string | null;
  initialActiveDecoration: string | null;
  initialActiveFont: string | null;
  initialAutoGreeting: string | null;
  initialAutoReplyReviewsEnabled: boolean;
  initialPositiveReviewReply: string | null;
  initialNegativeReviewReply: string | null;
  initialKeywordRules: Array<{
    id: string;
    keyword: string;
    response: string;
    isActive: boolean;
  }>;
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

interface SellerAutomationKeywordRuleDraft {
  id: string;
  keyword: string;
  response: string;
  isActive: boolean;
}

type ProfileSettingsTab = "profile" | "automation";

const AUTOMATION_FIELD_CLASS_NAME =
  "w-full rounded-md border border-white/10 bg-[#13171F] p-3 text-white placeholder:text-gray-500 focus:border-[#00C853] focus:ring-1 focus:ring-[#00C853]";

const AUTOMATION_INPUT_CLASS_NAME = `${AUTOMATION_FIELD_CLASS_NAME} h-auto`;

const AUTOMATION_TEXTAREA_CLASS_NAME = `${AUTOMATION_FIELD_CLASS_NAME} min-h-32`;

function createKeywordRuleDraft(
  rule?: Partial<SellerAutomationKeywordRuleDraft>,
): SellerAutomationKeywordRuleDraft {
  const generatedId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `keyword-rule-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  return {
    id: rule?.id ?? generatedId,
    keyword: rule?.keyword ?? "",
    response: rule?.response ?? "",
    isActive: rule?.isActive ?? true,
  };
}

function normalizeKeywordRuleDrafts(
  rules: SellerAutomationKeywordRuleDraft[],
) {
  return rules.map((rule) => ({
    keyword: rule.keyword.trim(),
    response: rule.response.trim(),
    isActive: rule.isActive,
  }));
}

function areKeywordRuleDraftsEqual(
  left: SellerAutomationKeywordRuleDraft[],
  right: SellerAutomationKeywordRuleDraft[],
) {
  const normalizedLeft = normalizeKeywordRuleDrafts(left);
  const normalizedRight = normalizeKeywordRuleDrafts(right);

  if (normalizedLeft.length !== normalizedRight.length) {
    return false;
  }

  return normalizedLeft.every((rule, index) => {
    const comparedRule = normalizedRight[index];

    return (
      rule.keyword === comparedRule.keyword &&
      rule.response === comparedRule.response &&
      rule.isActive === comparedRule.isActive
    );
  });
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
  initialActiveColor,
  initialActiveDecoration,
  initialActiveFont,
  initialAutoGreeting,
  initialAutoReplyReviewsEnabled,
  initialPositiveReviewReply,
  initialNegativeReviewReply,
  initialKeywordRules,
  initialPushNotifications,
  initialTelegramId,
  initialRole,
}: ProfileSettingsFormProps) {
  const router = useRouter();
  const { update } = useSession();
  const bannerInputRef = useRef<HTMLInputElement | null>(null);
  const [activeTab, setActiveTab] = useState<ProfileSettingsTab>("profile");
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
  const [autoGreeting, setAutoGreeting] = useState(initialAutoGreeting ?? "");
  const [autoReplyReviewsEnabled, setAutoReplyReviewsEnabled] = useState(
    initialAutoReplyReviewsEnabled,
  );
  const [positiveReviewReply, setPositiveReviewReply] = useState(
    initialPositiveReviewReply ?? "",
  );
  const [negativeReviewReply, setNegativeReviewReply] = useState(
    initialNegativeReviewReply ?? "",
  );
  const [keywordRules, setKeywordRules] = useState<SellerAutomationKeywordRuleDraft[]>(
    initialKeywordRules.map((rule) => createKeywordRuleDraft(rule)),
  );
  const [savedAutoGreeting, setSavedAutoGreeting] = useState(initialAutoGreeting ?? "");
  const [savedAutoReplyReviewsEnabled, setSavedAutoReplyReviewsEnabled] = useState(
    initialAutoReplyReviewsEnabled,
  );
  const [savedPositiveReviewReply, setSavedPositiveReviewReply] = useState(
    initialPositiveReviewReply ?? "",
  );
  const [savedNegativeReviewReply, setSavedNegativeReviewReply] = useState(
    initialNegativeReviewReply ?? "",
  );
  const [savedKeywordRules, setSavedKeywordRules] = useState<
    SellerAutomationKeywordRuleDraft[]
  >(initialKeywordRules.map((rule) => createKeywordRuleDraft(rule)));
  const [telegramId, setTelegramId] = useState<string | null>(initialTelegramId);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [automationErrorMessage, setAutomationErrorMessage] = useState("");
  const [automationSuccessMessage, setAutomationSuccessMessage] = useState("");
  const [isProcessingAvatar, setIsProcessingAvatar] = useState(false);
  const [isProcessingBanner, setIsProcessingBanner] = useState(false);
  const [isProfilePending, startProfileTransition] = useTransition();
  const [isAutomationPending, startAutomationTransition] = useTransition();
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
  const hasAutomationChanges =
    autoGreeting.trim() !== savedAutoGreeting.trim() ||
    autoReplyReviewsEnabled !== savedAutoReplyReviewsEnabled ||
    positiveReviewReply.trim() !== savedPositiveReviewReply.trim() ||
    negativeReviewReply.trim() !== savedNegativeReviewReply.trim() ||
    !areKeywordRuleDraftsEqual(keywordRules, savedKeywordRules);
  const isProfileSaveDisabled =
    !name.trim() || !hasChanges || isProfilePending || isProcessingImage;
  const isAutomationSaveDisabled = !hasAutomationChanges || isAutomationPending;

  function clearAutomationMessages() {
    setAutomationErrorMessage("");
    setAutomationSuccessMessage("");
  }

  function updateKeywordRuleField(
    ruleId: string,
    field: keyof Omit<SellerAutomationKeywordRuleDraft, "id">,
    value: string | boolean,
  ) {
    clearAutomationMessages();
    setKeywordRules((currentRules) =>
      currentRules.map((rule) =>
        rule.id === ruleId
          ? {
              ...rule,
              [field]: value,
            }
          : rule,
      ),
    );
  }

  function handleAddKeywordRule() {
    clearAutomationMessages();
    setKeywordRules((currentRules) => [...currentRules, createKeywordRuleDraft()]);
  }

  function handleRemoveKeywordRule(ruleId: string) {
    clearAutomationMessages();
    setKeywordRules((currentRules) =>
      currentRules.filter((rule) => rule.id !== ruleId),
    );
  }

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

  async function saveAutomationSettings() {
    clearAutomationMessages();

    try {
      const result = await updateSellerAutomationSettings(
        autoGreeting,
        autoReplyReviewsEnabled,
        positiveReviewReply,
        negativeReviewReply,
        keywordRules.map((rule) => ({
          id: rule.id,
          keyword: rule.keyword,
          response: rule.response,
          isActive: rule.isActive,
        })),
      );

      if (!result.ok) {
        setAutomationErrorMessage(
          result.message || "Не удалось сохранить настройки автоматизации.",
        );
        return;
      }

      const nextAutoGreeting = result.autoGreeting ?? "";
      const nextAutoReplyReviewsEnabled =
        result.isAutoReplyReviewsEnabled ?? autoReplyReviewsEnabled;
      const nextPositiveReviewReply = result.positiveReviewReply ?? "";
      const nextNegativeReviewReply = result.negativeReviewReply ?? "";
      const nextKeywordRules = (result.keywordRules ?? []).map((rule) =>
        createKeywordRuleDraft(rule),
      );

      setAutoGreeting(nextAutoGreeting);
      setAutoReplyReviewsEnabled(nextAutoReplyReviewsEnabled);
      setPositiveReviewReply(nextPositiveReviewReply);
      setNegativeReviewReply(nextNegativeReviewReply);
      setKeywordRules(nextKeywordRules);
      setSavedAutoGreeting(nextAutoGreeting);
      setSavedAutoReplyReviewsEnabled(nextAutoReplyReviewsEnabled);
      setSavedPositiveReviewReply(nextPositiveReviewReply);
      setSavedNegativeReviewReply(nextNegativeReviewReply);
      setSavedKeywordRules(nextKeywordRules);

      router.refresh();
      setAutomationSuccessMessage("Настройки автоматизации сохранены.");
    } catch (error) {
      setAutomationErrorMessage(
        error instanceof Error
          ? error.message
          : "Не удалось сохранить настройки автоматизации.",
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
            appearance={{
              activeColor: initialActiveColor,
              activeFont: initialActiveFont,
              activeDecoration: initialActiveDecoration,
            }}
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
          <div className="flex flex-wrap gap-2 border-b border-white/10 pb-2">
            <button
              type="button"
              onClick={() => setActiveTab("profile")}
              className={[
                "inline-flex items-center justify-center rounded-2xl border px-4 py-2.5 text-sm font-semibold transition",
                activeTab === "profile"
                  ? "border-orange-400/40 bg-orange-500/10 text-orange-200"
                  : "border-white/10 bg-white/5 text-zinc-400 hover:text-zinc-200",
              ].join(" ")}
            >
              Профиль и уведомления
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("automation")}
              className={[
                "inline-flex items-center justify-center rounded-2xl border px-4 py-2.5 text-sm font-semibold transition",
                activeTab === "automation"
                  ? "border-orange-400/40 bg-orange-500/10 text-orange-200"
                  : "border-white/10 bg-white/5 text-zinc-400 hover:text-zinc-200",
              ].join(" ")}
            >
              Автоматизация продавца
            </button>
          </div>

          {activeTab === "profile" ? (
            <>
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
                  ref={bannerInputRef}
                  id="profile-banner"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleBannerFileChange}
                  className="sr-only"
                />
                <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <Button
                      type="button"
                      onClick={() => bannerInputRef.current?.click()}
                      disabled={isProfilePending || isProcessingImage}
                      className="bg-sky-600 text-white shadow-[0_16px_40px_rgba(2,132,199,0.28)] hover:bg-sky-500"
                    >
                      {isProcessingBanner ? "Подготавливаем баннер..." : "Выбрать файл баннера"}
                    </Button>

                    {normalizedBannerUrl ? (
                      <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-sm text-emerald-200">
                        Превью обновлено
                      </span>
                    ) : (
                      <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-sm text-zinc-400">
                        Будет использован стандартный фон
                      </span>
                    )}
                  </div>
                  <p className="mt-3 text-sm leading-7 text-zinc-500">
                    Поддерживаются JPG, PNG и WebP. После выбора файл конвертируется в WebP, а превью слева обновляется сразу, ещё до нажатия кнопки «Сохранить профиль».
                  </p>
                </div>
                <p className="text-sm leading-7 text-zinc-500">
                  Если очистить баннер, в профиле снова появится фирменный градиентный фон.
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
                    startProfileTransition(async () => {
                      await saveProfile();
                    });
                  }}
                  disabled={isProfileSaveDisabled}
                  className="bg-orange-600 shadow-[0_16px_40px_rgba(249,115,22,0.28)] hover:bg-orange-500"
                >
                  {isProfilePending ? "Сохраняем..." : "Сохранить профиль"}
                </Button>

                <Button
                  type="button"
                  onClick={handleRemoveAvatar}
                  disabled={!image || isProfilePending || isProcessingImage}
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
                  disabled={!bannerUrl.trim() || isProfilePending || isProcessingImage}
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
            </>
          ) : (
            <>
              <section className="space-y-4 rounded-[1.75rem] border border-white/10 bg-white/5 p-5">
                <div>
                  <h3 className="text-base font-semibold text-white">Автоприветствие</h3>
                  <p className="mt-1 text-sm leading-7 text-zinc-400">
                    Это сообщение отправится автоматически, когда покупатель впервые откроет с вами новый диалог.
                  </p>
                </div>

                <Textarea
                  id="seller-auto-greeting"
                  value={autoGreeting}
                  onChange={(event) => {
                    setAutoGreeting(event.target.value);
                    clearAutomationMessages();
                  }}
                  maxLength={1200}
                  placeholder="Например: Привет! Я онлайн и обычно отвечаю в течение пары минут. Если нужен конкретный формат товара, напишите сразу детали."
                  className={`${AUTOMATION_TEXTAREA_CLASS_NAME} min-h-36`}
                />
                <p className="text-sm text-zinc-500">
                  До 1200 символов. Оставьте поле пустым, если автоприветствие не нужно.
                </p>
              </section>

              <section className="space-y-4 rounded-[1.75rem] border border-white/10 bg-white/5 p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-base font-semibold text-white">Автоответы по ключевым словам</h3>
                    <p className="mt-1 text-sm leading-7 text-zinc-400">
                      Если покупатель напишет фразу с ключевым словом, система отправит подготовленный ответ от вашего имени.
                    </p>
                  </div>

                  <Button
                    type="button"
                    onClick={handleAddKeywordRule}
                    className="bg-sky-600 text-white shadow-[0_16px_40px_rgba(2,132,199,0.28)] hover:bg-sky-500"
                  >
                    Добавить правило
                  </Button>
                </div>

                {keywordRules.length === 0 ? (
                  <div className="rounded-[1.5rem] border border-dashed border-white/10 bg-black/20 px-4 py-5 text-sm leading-7 text-zinc-400">
                    Правил пока нет. Добавьте ключевые слова вроде «наличие», «скидка», «онлайн», чтобы отвечать мгновенно на частые вопросы.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {keywordRules.map((rule, index) => (
                      <div
                        key={rule.id}
                        className="rounded-[1.5rem] border border-white/10 bg-black/20 p-4"
                      >
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
                          <div className="grid flex-1 gap-4 md:grid-cols-[minmax(0,220px)_minmax(0,1fr)]">
                            <div className="space-y-2">
                              <label className="text-sm font-semibold text-zinc-200">
                                Ключевое слово #{index + 1}
                              </label>
                              <Input
                                value={rule.keyword}
                                maxLength={80}
                                onChange={(event) =>
                                  updateKeywordRuleField(
                                    rule.id,
                                    "keyword",
                                    event.target.value,
                                  )
                                }
                                placeholder="Например: наличие"
                                className={AUTOMATION_INPUT_CLASS_NAME}
                              />
                            </div>

                            <div className="space-y-2">
                              <label className="text-sm font-semibold text-zinc-200">
                                Текст ответа
                              </label>
                              <Textarea
                                value={rule.response}
                                maxLength={1000}
                                onChange={(event) =>
                                  updateKeywordRuleField(
                                    rule.id,
                                    "response",
                                    event.target.value,
                                  )
                                }
                                placeholder="Например: Да, товар в наличии. Могу выдать сразу после оплаты."
                                className={`${AUTOMATION_TEXTAREA_CLASS_NAME} min-h-28`}
                              />
                            </div>
                          </div>

                          <div className="flex w-full shrink-0 flex-col gap-3 lg:w-[220px]">
                            <div className="flex items-center justify-between rounded-[1.25rem] border border-white/10 bg-white/5 px-4 py-3">
                              <div>
                                <div className="text-sm font-semibold text-zinc-100">Правило активно</div>
                                <div className="mt-1 text-xs leading-5 text-zinc-500">
                                  Неактивные правила сохраняются, но не срабатывают.
                                </div>
                              </div>
                              <Switch
                                checked={rule.isActive}
                                onCheckedChange={(checked) =>
                                  updateKeywordRuleField(rule.id, "isActive", checked)
                                }
                              />
                            </div>

                            <Button
                              type="button"
                              onClick={() => handleRemoveKeywordRule(rule.id)}
                              className="border border-red-500/20 bg-red-500/10 text-red-100 shadow-none hover:bg-red-500/20"
                            >
                              Удалить правило
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="space-y-4 rounded-[1.75rem] border border-white/10 bg-white/5 p-5">
                <div className="flex items-start justify-between gap-4 rounded-[1.25rem] border border-white/10 bg-black/20 px-4 py-4">
                  <div className="min-w-0">
                    <h3 className="text-base font-semibold text-white">Автоответы на отзывы</h3>
                    <p className="mt-1 text-sm leading-7 text-zinc-400">
                      После публикации отзыва система автоматически подставит шаблонный ответ от имени продавца в зависимости от оценки.
                    </p>
                  </div>
                  <Switch
                    checked={autoReplyReviewsEnabled}
                    onCheckedChange={(checked) => {
                      setAutoReplyReviewsEnabled(checked);
                      clearAutomationMessages();
                    }}
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="seller-positive-review-reply" className="text-sm font-semibold text-zinc-200">
                    Ответ на положительные отзывы (4-5 звезд)
                  </label>
                  <Textarea
                    id="seller-positive-review-reply"
                    value={positiveReviewReply}
                    onChange={(event) => {
                      setPositiveReviewReply(event.target.value);
                      clearAutomationMessages();
                    }}
                    maxLength={1000}
                    placeholder="Спасибо за покупку! Обращайтесь еще"
                    className={AUTOMATION_TEXTAREA_CLASS_NAME}
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="seller-negative-review-reply" className="text-sm font-semibold text-zinc-200">
                    Ответ на проблемные отзывы (1-3 звезды)
                  </label>
                  <Textarea
                    id="seller-negative-review-reply"
                    value={negativeReviewReply}
                    onChange={(event) => {
                      setNegativeReviewReply(event.target.value);
                      clearAutomationMessages();
                    }}
                    maxLength={1000}
                    placeholder="Сожалеем, что возникли проблемы. Напишите нам в чат, и мы все решим"
                    className={AUTOMATION_TEXTAREA_CLASS_NAME}
                  />
                </div>
              </section>

              {automationErrorMessage ? (
                <div className="rounded-[1.5rem] border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                  {automationErrorMessage}
                </div>
              ) : null}

              {automationSuccessMessage ? (
                <div className="rounded-[1.5rem] border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
                  {automationSuccessMessage}
                </div>
              ) : null}

              <div className="flex flex-wrap gap-3">
                <Button
                  type="button"
                  onClick={() => {
                    startAutomationTransition(async () => {
                      await saveAutomationSettings();
                    });
                  }}
                  disabled={isAutomationSaveDisabled}
                  className="bg-orange-600 shadow-[0_16px_40px_rgba(249,115,22,0.28)] hover:bg-orange-500"
                >
                  {isAutomationPending ? "Сохраняем..." : "Сохранить автоматизацию"}
                </Button>

                <Button
                  type="button"
                  onClick={handleAddKeywordRule}
                  className="border border-white/10 bg-white/5 text-zinc-200 shadow-none hover:bg-white/10"
                >
                  Добавить ещё правило
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}