"use server";

import { revalidatePath } from "next/cache";

import {
  getCurrentSessionUser,
  hasActiveAdminAccess,
} from "@/lib/access-control";
import { getAuthSession } from "@/lib/auth";
import {
  grantAchievementToUser,
  type AchievementGrantResult,
} from "@/lib/domain/achievements";

export interface GrantAchievementActionResult {
  ok: boolean;
  message?: string;
  alreadyEarned?: boolean;
  achievement?: AchievementGrantResult["achievement"];
  userAchievement?: AchievementGrantResult["userAchievement"];
}

async function requireAdminAchievementUser() {
  const session = await getAuthSession();
  const currentUser = await getCurrentSessionUser(session);

  if (!currentUser || !hasActiveAdminAccess(currentUser)) {
    throw new Error("Unauthorized");
  }

  return currentUser;
}

function revalidateAchievementPaths(userId: string) {
  revalidatePath("/");
  revalidatePath("/profile");
  revalidatePath(`/profile/${userId}`);
  revalidatePath(`/user/${userId}`);
}

export async function grantAchievement(
  userId: string,
  achievementKey: string,
): Promise<GrantAchievementActionResult> {
  try {
    await requireAdminAchievementUser();

    const result = await grantAchievementToUser({
      userId,
      achievementKey,
    });

    revalidateAchievementPaths(result.userAchievement.userId);

    return {
      ok: true,
      alreadyEarned: result.alreadyEarned,
      achievement: result.achievement,
      userAchievement: result.userAchievement,
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error ? error.message : "Не удалось выдать достижение.",
    };
  }
}