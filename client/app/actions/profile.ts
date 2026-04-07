"use server";

import { revalidatePath } from "next/cache";

import { getAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export interface UpdateUserProfileResult {
  ok: boolean;
  name?: string;
  image?: string | null;
  bannerUrl?: string | null;
  message?: string;
}

const MAX_IMAGE_BASE64_LENGTH = 350_000;
const MAX_BANNER_BASE64_LENGTH = 1_600_000;
const MAX_BANNER_URL_LENGTH = 2_048;

function normalizeBannerUrl(rawBannerUrl: string) {
  const normalizedBannerUrl = rawBannerUrl.trim();

  if (!normalizedBannerUrl) {
    return {
      ok: true as const,
      value: null,
    };
  }

  if (normalizedBannerUrl.startsWith("data:image/")) {
    if (!normalizedBannerUrl.startsWith("data:image/webp;base64,")) {
      return {
        ok: false as const,
        message: "Баннер должен быть в формате WebP.",
      };
    }

    if (normalizedBannerUrl.length > MAX_BANNER_BASE64_LENGTH) {
      return {
        ok: false as const,
        message: "Баннер получился слишком большим. Попробуйте другое изображение.",
      };
    }

    return {
      ok: true as const,
      value: normalizedBannerUrl,
    };
  }

  if (normalizedBannerUrl.length > MAX_BANNER_URL_LENGTH) {
    return {
      ok: false as const,
      message: "Ссылка на баннер слишком длинная.",
    };
  }

  try {
    const parsedBannerUrl = new URL(normalizedBannerUrl);

    if (
      parsedBannerUrl.protocol !== "https:" &&
      parsedBannerUrl.protocol !== "http:"
    ) {
      return {
        ok: false as const,
        message: "Ссылка на баннер должна начинаться с http:// или https://.",
      };
    }

    return {
      ok: true as const,
      value: parsedBannerUrl.toString(),
    };
  } catch {
    return {
      ok: false as const,
      message: "Выберите корректное изображение для баннера.",
    };
  }
}

export async function updateUserProfile(
  name: string,
  imageBase64: string | null,
  bannerUrl: string,
): Promise<UpdateUserProfileResult> {
  const session = await getAuthSession();
  const userId = session?.user?.id?.trim();
  const normalizedName = name.trim();
  const normalizedBannerUrl = normalizeBannerUrl(bannerUrl);

  if (!userId) {
    return {
      ok: false,
      message: "Нужно войти в аккаунт, чтобы обновить профиль.",
    };
  }

  if (!normalizedName) {
    return {
      ok: false,
      message: "Никнейм не может быть пустым.",
    };
  }

  if (normalizedName.length > 40) {
    return {
      ok: false,
      message: "Никнейм должен содержать не более 40 символов.",
    };
  }

  if (imageBase64 && !imageBase64.startsWith("data:image/webp;base64,")) {
    return {
      ok: false,
      message: "Аватар должен быть в формате WebP.",
    };
  }

  if (imageBase64 && imageBase64.length > MAX_IMAGE_BASE64_LENGTH) {
    return {
      ok: false,
      message: "Аватар получился слишком большим. Попробуйте другое изображение.",
    };
  }

  if (!normalizedBannerUrl.ok) {
    return {
      ok: false,
      message: normalizedBannerUrl.message,
    };
  }

  const updatedUser = await prisma.user.update({
    where: {
      id: userId,
    },
    data: {
      name: normalizedName,
      image: imageBase64,
      bannerUrl: normalizedBannerUrl.value,
    },
    select: {
      id: true,
      name: true,
      image: true,
      bannerUrl: true,
    },
  });

  revalidatePath("/");
  revalidatePath("/profile");
  revalidatePath("/profile/settings");
  revalidatePath(`/user/${updatedUser.id}`);

  return {
    ok: true,
    name: updatedUser.name ?? normalizedName,
    image: updatedUser.image,
    bannerUrl: updatedUser.bannerUrl,
  };
}