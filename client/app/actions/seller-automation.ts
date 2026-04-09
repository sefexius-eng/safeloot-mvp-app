"use server";

import { revalidatePath } from "next/cache";

import { getAuthSession } from "@/lib/auth";
import {
  updateSellerAutomationSettingsByUser,
  type SellerAutomationKeywordRuleInput,
} from "@/lib/domain/seller-automation";

export interface UpdateSellerAutomationResult {
  ok: boolean;
  autoGreeting?: string | null;
  isAutoReplyReviewsEnabled?: boolean;
  positiveReviewReply?: string | null;
  negativeReviewReply?: string | null;
  keywordRules?: Array<{
    id: string;
    keyword: string;
    response: string;
    isActive: boolean;
  }>;
  message?: string;
}

export async function updateSellerAutomationSettings(
  autoGreeting: string,
  isAutoReplyReviewsEnabled: boolean,
  positiveReviewReply: string,
  negativeReviewReply: string,
  keywordRules: SellerAutomationKeywordRuleInput[],
): Promise<UpdateSellerAutomationResult> {
  try {
    const session = await getAuthSession();
    const userId = session?.user?.id?.trim() ?? "";

    const result = await updateSellerAutomationSettingsByUser({
      userId,
      autoGreeting,
      isAutoReplyReviewsEnabled,
      positiveReviewReply,
      negativeReviewReply,
      keywordRules,
    });

    revalidatePath("/profile/settings");

    return {
      ok: true,
      autoGreeting: result.autoGreeting,
      isAutoReplyReviewsEnabled: result.isAutoReplyReviewsEnabled,
      positiveReviewReply: result.positiveReviewReply,
      negativeReviewReply: result.negativeReviewReply,
      keywordRules: result.keywordRules,
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Не удалось сохранить настройки автоматизации.",
    };
  }
}