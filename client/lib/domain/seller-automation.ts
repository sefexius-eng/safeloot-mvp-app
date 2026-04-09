import { prisma } from "@/lib/prisma";

import { normalizeText } from "@/lib/domain/shared";

const MAX_AUTO_GREETING_LENGTH = 1200;
const MAX_REVIEW_REPLY_TEMPLATE_LENGTH = 1000;
const MAX_KEYWORD_LENGTH = 80;
const MAX_KEYWORD_RESPONSE_LENGTH = 1000;

export interface SellerAutomationKeywordRuleInput {
  id?: string;
  keyword: string;
  response: string;
  isActive: boolean;
}

function stripHtmlTags(value: string) {
  return value.replace(/<[^>]*>?/gm, "");
}

function sanitizeAutomationText(value?: string | null) {
  return normalizeText(stripHtmlTags(normalizeText(value ?? undefined)));
}

function normalizeOptionalAutomationText(
  value: string | null | undefined,
  options: {
    fieldName: string;
    maxLength: number;
  },
) {
  const normalizedValue = sanitizeAutomationText(value);

  if (!normalizedValue) {
    return null;
  }

  if (normalizedValue.length > options.maxLength) {
    throw new Error(
      `${options.fieldName} должен содержать не более ${options.maxLength} символов.`,
    );
  }

  return normalizedValue;
}

function normalizeKeywordRules(keywordRules: SellerAutomationKeywordRuleInput[]) {
  const normalizedRules: Array<{
    keyword: string;
    response: string;
    isActive: boolean;
  }> = [];
  const seenKeywords = new Set<string>();

  for (const rule of keywordRules) {
    const keyword = normalizeOptionalAutomationText(rule.keyword, {
      fieldName: "Ключевое слово",
      maxLength: MAX_KEYWORD_LENGTH,
    });
    const response = normalizeOptionalAutomationText(rule.response, {
      fieldName: "Автоответ",
      maxLength: MAX_KEYWORD_RESPONSE_LENGTH,
    });

    if (!keyword && !response) {
      continue;
    }

    if (!keyword || !response) {
      throw new Error(
        "У каждого правила должны быть заполнены и ключевое слово, и текст ответа.",
      );
    }

    const normalizedKeywordKey = keyword.toLowerCase();

    if (seenKeywords.has(normalizedKeywordKey)) {
      throw new Error(`Ключевое слово \"${keyword}\" повторяется.`);
    }

    seenKeywords.add(normalizedKeywordKey);
    normalizedRules.push({
      keyword,
      response,
      isActive: Boolean(rule.isActive),
    });
  }

  return normalizedRules;
}

export async function updateSellerAutomationSettingsByUser(input: {
  userId: string;
  autoGreeting?: string | null;
  isAutoReplyReviewsEnabled: boolean;
  positiveReviewReply?: string | null;
  negativeReviewReply?: string | null;
  keywordRules: SellerAutomationKeywordRuleInput[];
}) {
  const userId = normalizeText(input.userId);

  if (!userId) {
    throw new Error("Нужно войти в аккаунт, чтобы обновить автоматизацию.");
  }

  const autoGreeting = normalizeOptionalAutomationText(input.autoGreeting, {
    fieldName: "Автоприветствие",
    maxLength: MAX_AUTO_GREETING_LENGTH,
  });
  const positiveReviewReply = normalizeOptionalAutomationText(
    input.positiveReviewReply,
    {
      fieldName: "Ответ на положительные отзывы",
      maxLength: MAX_REVIEW_REPLY_TEMPLATE_LENGTH,
    },
  );
  const negativeReviewReply = normalizeOptionalAutomationText(
    input.negativeReviewReply,
    {
      fieldName: "Ответ на проблемные отзывы",
      maxLength: MAX_REVIEW_REPLY_TEMPLATE_LENGTH,
    },
  );
  const normalizedKeywordRules = normalizeKeywordRules(input.keywordRules);

  const result = await prisma.$transaction(async (transactionClient) => {
    const sellerSettings = await transactionClient.sellerSettings.upsert({
      where: {
        userId,
      },
      update: {
        autoGreeting,
        isAutoReplyReviewsEnabled: input.isAutoReplyReviewsEnabled,
        positiveReviewReply,
        negativeReviewReply,
      },
      create: {
        userId,
        autoGreeting,
        isAutoReplyReviewsEnabled: input.isAutoReplyReviewsEnabled,
        positiveReviewReply,
        negativeReviewReply,
      },
      select: {
        autoGreeting: true,
        isAutoReplyReviewsEnabled: true,
        positiveReviewReply: true,
        negativeReviewReply: true,
      },
    });

    await transactionClient.keywordRule.deleteMany({
      where: {
        sellerId: userId,
      },
    });

    const savedKeywordRules = [] as Array<{
      id: string;
      keyword: string;
      response: string;
      isActive: boolean;
    }>;

    for (const rule of normalizedKeywordRules) {
      const savedRule = await transactionClient.keywordRule.create({
        data: {
          sellerId: userId,
          keyword: rule.keyword,
          response: rule.response,
          isActive: rule.isActive,
        },
        select: {
          id: true,
          keyword: true,
          response: true,
          isActive: true,
        },
      });

      savedKeywordRules.push(savedRule);
    }

    return {
      sellerSettings,
      keywordRules: savedKeywordRules,
    };
  });

  return {
    autoGreeting: result.sellerSettings.autoGreeting,
    isAutoReplyReviewsEnabled: result.sellerSettings.isAutoReplyReviewsEnabled,
    positiveReviewReply: result.sellerSettings.positiveReviewReply,
    negativeReviewReply: result.sellerSettings.negativeReviewReply,
    keywordRules: result.keywordRules,
  };
}