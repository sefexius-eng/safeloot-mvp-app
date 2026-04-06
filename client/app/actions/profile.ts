"use server";

import { revalidatePath } from "next/cache";

import { getAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export interface UpdateUserProfileResult {
  ok: boolean;
  name?: string;
  image?: string | null;
  message?: string;
}

const MAX_IMAGE_BASE64_LENGTH = 350_000;

export async function updateUserProfile(
  name: string,
  imageBase64: string | null,
): Promise<UpdateUserProfileResult> {
  const session = await getAuthSession();
  const email = session?.user?.email?.trim().toLowerCase();
  const normalizedName = name.trim();

  if (!email) {
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

  const updatedUser = await prisma.user.update({
    where: {
      email,
    },
    data: {
      name: normalizedName,
      image: imageBase64,
    },
    select: {
      name: true,
      image: true,
    },
  });

  revalidatePath("/");
  revalidatePath("/profile");
  revalidatePath("/profile/settings");

  return {
    ok: true,
    name: updatedUser.name ?? normalizedName,
    image: updatedUser.image,
  };
}