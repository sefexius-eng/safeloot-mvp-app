import {
  OrderStatus,
  Prisma,
  Role,
  TransactionStatus,
  TransactionType,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { canManageForeignProducts, isAdminRole } from "@/lib/roles";

export const MONEY_SCALE = 2;
const COMMISSION_RATE = 0.05;
const COMMISSION_RATE_DECIMAL = new Prisma.Decimal(COMMISSION_RATE.toString());
const TYPING_TTL_MS = 5000;
export const MAX_MESSAGE_IMAGE_BASE64_LENGTH = 2_000_000;
const MAX_PRODUCT_TITLE_LENGTH = 60;
const MAX_PRODUCT_DESCRIPTION_LENGTH = 1000;
const MAX_PRODUCT_AUTO_DELIVERY_CONTENT_LENGTH = 2000;
const MAX_PRODUCT_IMAGE_COUNT = 3;
const MAX_PRODUCT_IMAGE_BASE64_LENGTH = 2_000_000;
const PRODUCT_IMAGE_BASE64_PATTERN =
  /^data:image\/webp;base64,[A-Za-z0-9+/=]+$/;
export const ZERO_MONEY = new Prisma.Decimal(0);
const ANTI_LEAKAGE_REDACTED_PLACEHOLDER = "[СКРЫТО]";
export const DEAL_ROOM_SECURITY_WARNING =
  "⚠️ Внимание! Переход в сторонние мессенджеры и передача личных контактов запрещены. Это лишает вас защиты SafeLoot и может привести к блокировке.";
const TERMINAL_ORDER_STATUSES = [
  OrderStatus.COMPLETED,
  OrderStatus.REFUNDED,
  OrderStatus.CANCELLED,
] as const;

const MESSAGE_LINK_REGEX =
  /(?:https?:\/\/|www\.)\S+|(?<![\p{L}\p{N}_])(?:[a-z0-9-]+\.)+(?:com|ru|net|org|gg|me|io|app|dev|xyz|info|biz|link|shop|su|ua|tv|cc|to)(?:\/\S*)?/giu;
const MESSAGE_PROTOCOL_LINK_REGEX =
  /(?<![\p{L}\p{N}])(?:h[\s\W_]*t[\s\W_]*t[\s\W_]*p(?:[\s\W_]*s)?|w[\s\W_]*w[\s\W_]*w)(?:[\s\W_]*[:/.\\])+[^\s]{2,}/giu;
const MESSAGE_OBFUSCATED_LINK_REGEX =
  /(?<![\p{L}\p{N}])(?:[a-zа-яё0-9-]+[\s\W_]*(?:\.|dot|точка)[\s\W_]*)+(?:ru|com|net|org|gg|me|io|app|dev|xyz|info|biz|link|shop|su|ua|tv|cc|to)(?:[\s\W_/\\-]*[a-zа-яё0-9/?#=&%._-]+)?(?![\p{L}\p{N}])/giu;
const MESSAGE_USERNAME_REGEX = /@[a-z0-9_]{2,}/giu;
const MESSAGE_EMAIL_REGEX =
  /\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/giu;
const MESSAGE_CARD_CANDIDATE_REGEX =
  /(?<![\p{L}\p{N}])(?:\d[\s-]?){13,19}(?![\p{L}\p{N}])/gu;
const MESSAGE_PHONE_CANDIDATE_REGEX =
  /(?<![\p{L}\p{N}])(?:\+?\d[\d\s().-]{8,}\d)(?![\p{L}\p{N}])/gu;
const MESSAGE_CRYPTO_WALLET_REGEX =
  /(?<![\p{L}\p{N}])(?:0x[a-f0-9]{40}|bc1[a-z0-9]{25,62}|[13][a-km-zA-HJ-NP-Z1-9]{25,34}|T[a-zA-HJ-NP-Z1-9]{33})(?![\p{L}\p{N}])/giu;
const FUZZY_TOKEN_SEPARATOR_PATTERN = String.raw`[\s\W_]*`;
const FUZZY_TOKEN_BOUNDARY_START_PATTERN = String.raw`(?<![\p{L}\p{N}])`;
const FUZZY_TOKEN_BOUNDARY_END_PATTERN = String.raw`(?![\p{L}\p{N}])`;

interface AntiLeakageRule {
  pattern: RegExp;
  replacement: string;
  predicate?: (match: string) => boolean;
}

function createFuzzyTokenRegex(parts: string[]) {
  return new RegExp(
    `${FUZZY_TOKEN_BOUNDARY_START_PATTERN}${parts.join(FUZZY_TOKEN_SEPARATOR_PATTERN)}${FUZZY_TOKEN_BOUNDARY_END_PATTERN}`,
    "giu",
  );
}

const MESSAGE_FUZZY_BLACKLIST_PATTERNS = [
  createFuzzyTokenRegex(["[tт]", "[gг]"]),
  createFuzzyTokenRegex([
    "[dд]",
    "[iи1|l]",
    "[sс$]",
    "[cсkк]",
    "[oо0]",
    "[rр]",
    "[dд]",
  ]),
  createFuzzyTokenRegex(["[vвw]", "[kкcс]"]),
  createFuzzyTokenRegex([
    "[sс$]",
    "[kкcс]",
    "[yуийi1]",
    "[pп]",
    "[eе3]",
  ]),
  createFuzzyTokenRegex([
    "[tт]",
    "[eе3]",
    "[lл1|iи]",
    "[eе3]",
    "[gг6]",
    "[rр]",
    "[aа4]",
    "[mм]",
  ]),
  createFuzzyTokenRegex([
    "[wшщvv]",
    "[hнxх]",
    "[aа4]",
    "[tт]",
    "[sс$]",
    "[aа4]",
    "[pп]",
    "[pп]",
  ]),
  createFuzzyTokenRegex([
    "[fф]",
    "[uуaа]",
    "[nн]",
    "[pп]",
    "[aаeе]",
    "[yуйiи]",
  ]),
  createFuzzyTokenRegex([
    "[pп]",
    "[lл]",
    "[aаeе]",
    "[yуй]",
    "[eе]",
    "[rр]",
    "[oо0]",
    "[kкcс]",
  ]),
  createFuzzyTokenRegex([
    "[пpп]",
    "[лlл]",
    "[eе3]",
    "[eе3]",
    "[rр]",
    "[oо0]",
    "[kкcс]",
  ]),
  createFuzzyTokenRegex(["[gг6]", "[2zз]", "[gг6]"]),
  createFuzzyTokenRegex([
    "[pпrр]",
    "[lл1|iи]",
    "[aа4]",
    "[tт]",
    "[iи1|]",
  ]),
  createFuzzyTokenRegex([
    "[gг6]",
    "[gг6]",
    "[sс$]",
    "[eе3]",
    "[lл1|iи]",
  ]),
  createFuzzyTokenRegex([
    "[eе3]",
    "[lл1|iи]",
    "[dд]",
    "[oо0]",
    "[rр]",
    "[aа4]",
    "[dд]",
    "[oо0]",
  ]),
  new RegExp(
    `${FUZZY_TOKEN_BOUNDARY_START_PATTERN}[эeе3]${FUZZY_TOKEN_SEPARATOR_PATTERN}[лlл]${FUZZY_TOKEN_SEPARATOR_PATTERN}[ьъb6]?${FUZZY_TOKEN_SEPARATOR_PATTERN}[дdд]${FUZZY_TOKEN_SEPARATOR_PATTERN}[oо0]${FUZZY_TOKEN_SEPARATOR_PATTERN}[рpр]${FUZZY_TOKEN_SEPARATOR_PATTERN}[aа4]${FUZZY_TOKEN_SEPARATOR_PATTERN}[дdд]${FUZZY_TOKEN_SEPARATOR_PATTERN}[oо0]${FUZZY_TOKEN_BOUNDARY_END_PATTERN}`,
    "giu",
  ),
  createFuzzyTokenRegex([
    "[zз2]",
    "[aа4]",
    "[kкcс]",
    "[aа4]",
    "[zз2]",
    "[aа4]",
    "[kкcс]",
    "[aа4]",
  ]),
  createFuzzyTokenRegex([
    "[lл1|iи]",
    "[oо0]",
    "[lл1|iи]",
    "[zз2]",
  ]),
  createFuzzyTokenRegex([
    "[zз2]",
    "[eе3]",
    "[lл1|iи]",
    "[eе3]",
    "[nнh]",
    "[kкcс]",
    "[aа4]",
  ]),
  /(?<![\p{L}\p{N}])(?:номер|кидай[\s\W_]*на|на[\s\W_]*карту)(?![\p{L}\p{N}])/giu,
] as const;

const ANTI_LEAKAGE_RULES: AntiLeakageRule[] = [
  {
    pattern: MESSAGE_EMAIL_REGEX,
    replacement: ANTI_LEAKAGE_REDACTED_PLACEHOLDER,
  },
  {
    pattern: MESSAGE_LINK_REGEX,
    replacement: ANTI_LEAKAGE_REDACTED_PLACEHOLDER,
  },
  {
    pattern: MESSAGE_PROTOCOL_LINK_REGEX,
    replacement: ANTI_LEAKAGE_REDACTED_PLACEHOLDER,
  },
  {
    pattern: MESSAGE_OBFUSCATED_LINK_REGEX,
    replacement: ANTI_LEAKAGE_REDACTED_PLACEHOLDER,
  },
  {
    pattern: MESSAGE_USERNAME_REGEX,
    replacement: ANTI_LEAKAGE_REDACTED_PLACEHOLDER,
  },
  ...MESSAGE_FUZZY_BLACKLIST_PATTERNS.map((pattern) => ({
    pattern,
    replacement: ANTI_LEAKAGE_REDACTED_PLACEHOLDER,
  })),
  {
    pattern: MESSAGE_CARD_CANDIDATE_REGEX,
    replacement: ANTI_LEAKAGE_REDACTED_PLACEHOLDER,
    predicate: isLikelyCardNumber,
  },
  {
    pattern: MESSAGE_PHONE_CANDIDATE_REGEX,
    replacement: ANTI_LEAKAGE_REDACTED_PLACEHOLDER,
    predicate: isLikelyPhoneNumber,
  },
  {
    pattern: MESSAGE_CRYPTO_WALLET_REGEX,
    replacement: ANTI_LEAKAGE_REDACTED_PLACEHOLDER,
  },
];

const chatTypingState = new Map<string, Map<string, number>>();

export function normalizeText(value?: string) {
  return value?.trim() ?? "";
}

function stripHtmlTags(value: string) {
  return value.replace(/<[^>]*>?/gm, "");
}

function sanitizeProductText(value?: string) {
  return normalizeText(stripHtmlTags(normalizeText(value)));
}

export function roundMoney(value: Prisma.Decimal.Value) {
  return new Prisma.Decimal(value).toDecimalPlaces(
    MONEY_SCALE,
    Prisma.Decimal.ROUND_HALF_UP,
  );
}

function roundMoneyNumber(value: Prisma.Decimal.Value) {
  return Number(roundMoney(value).toFixed(MONEY_SCALE));
}

export function formatMoney(value: Prisma.Decimal) {
  return roundMoney(value).toFixed(MONEY_SCALE);
}

export function ensureOrderIsNotTerminal(
  orderId: string,
  status: OrderStatus,
  action: string,
) {
  if (
    TERMINAL_ORDER_STATUSES.includes(
      status as (typeof TERMINAL_ORDER_STATUSES)[number],
    )
  ) {
    throw new Error(`Order ${orderId} cannot be ${action} from status ${status}.`);
  }
}

export async function ensureSufficientUserBalance(
  transactionClient: Prisma.TransactionClient,
  input: {
    userId: string;
    balanceField: "holdBalance" | "availableBalance";
    requiredAmount: Prisma.Decimal;
    errorMessage: string;
  },
) {
  const user = await transactionClient.user.findUnique({
    where: {
      id: input.userId,
    },
    select: {
      id: true,
      holdBalance: true,
      availableBalance: true,
    },
  });

  if (!user) {
    throw new Error(`User with id ${input.userId} was not found.`);
  }

  if (user[input.balanceField].comparedTo(input.requiredAmount) < 0) {
    throw new Error(input.errorMessage);
  }
}

export function calculateCommissionBreakdown(amount: Prisma.Decimal) {
  const normalizedAmount = roundMoney(amount);
  const fee = normalizedAmount
    .mul(COMMISSION_RATE_DECIMAL)
    .toDecimalPlaces(MONEY_SCALE, Prisma.Decimal.ROUND_HALF_UP);
  const sellerPayout = normalizedAmount
    .sub(fee)
    .toDecimalPlaces(MONEY_SCALE, Prisma.Decimal.ROUND_HALF_UP);

  return {
    fee,
    sellerPayout,
    feeAsNumber: roundMoneyNumber(fee),
  };
}

export async function getPlatformAdminAccount(
  transactionClient: Prisma.TransactionClient,
) {
  const superAdminUser = await transactionClient.user.findFirst({
    where: {
      role: Role.SUPER_ADMIN,
    },
    select: {
      id: true,
      holdBalance: true,
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  if (superAdminUser) {
    return superAdminUser;
  }

  const fallbackAdmin = await transactionClient.user.findFirst({
    where: {
      role: Role.ADMIN,
    },
    select: {
      id: true,
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  if (!fallbackAdmin) {
    throw new Error("Не найден SUPER_ADMIN для учёта комиссии платформы.");
  }

  return transactionClient.user.update({
    where: {
      id: fallbackAdmin.id,
    },
    data: {
      role: Role.SUPER_ADMIN,
    },
    select: {
      id: true,
      holdBalance: true,
    },
  });
}

export async function findCompletedEscrowHoldTransaction(
  transactionClient: Prisma.TransactionClient,
  input: { orderId: string; adminUserId: string },
) {
  return transactionClient.transaction.findFirst({
    where: {
      orderId: input.orderId,
      userId: input.adminUserId,
      type: TransactionType.ESCROW_HOLD,
      status: TransactionStatus.COMPLETED,
    },
    select: {
      id: true,
    },
  });
}

export function validateProductTextFields(input: {
  title?: string;
  description?: string;
}) {
  const title = sanitizeProductText(input.title);
  const description = sanitizeProductText(input.description);

  if (!title) {
    throw new Error("title is required.");
  }

  if (!description) {
    throw new Error("description is required.");
  }

  if (title.length > MAX_PRODUCT_TITLE_LENGTH) {
    throw new Error(
      `title must be at most ${MAX_PRODUCT_TITLE_LENGTH} characters.`,
    );
  }

  if (description.length > MAX_PRODUCT_DESCRIPTION_LENGTH) {
    throw new Error(
      `description must be at most ${MAX_PRODUCT_DESCRIPTION_LENGTH} characters.`,
    );
  }

  return {
    title,
    description,
  };
}

export function validateOptionalProductAutoDeliveryContent(value?: string | null) {
  const autoDeliveryContent = sanitizeProductText(value ?? undefined);

  if (!autoDeliveryContent) {
    return null;
  }

  if (autoDeliveryContent.length > MAX_PRODUCT_AUTO_DELIVERY_CONTENT_LENGTH) {
    throw new Error(
      `autoDeliveryContent must be at most ${MAX_PRODUCT_AUTO_DELIVERY_CONTENT_LENGTH} characters.`,
    );
  }

  return autoDeliveryContent;
}

export function validateProductImages(images?: string[]) {
  const normalizedImages = Array.isArray(images)
    ? images
        .map((image) => normalizeText(image))
        .filter(Boolean)
    : [];

  if (normalizedImages.length > MAX_PRODUCT_IMAGE_COUNT) {
    throw new Error(`images must contain at most ${MAX_PRODUCT_IMAGE_COUNT} items.`);
  }

  for (const image of normalizedImages) {
    if (image.length > MAX_PRODUCT_IMAGE_BASE64_LENGTH) {
      throw new Error("images must be compressed before upload.");
    }

    if (!PRODUCT_IMAGE_BASE64_PATTERN.test(image)) {
      throw new Error("images must be valid webp base64 data.");
    }
  }

  return normalizedImages;
}

export async function validateCatalogSelection(gameId: string, categoryId: string) {
  const [game, category] = await Promise.all([
    prisma.game.findUnique({
      where: {
        id: gameId,
      },
      select: {
        id: true,
        slug: true,
      },
    }),
    prisma.category.findUnique({
      where: {
        id: categoryId,
      },
      select: {
        id: true,
        gameId: true,
      },
    }),
  ]);

  if (!game) {
    throw new Error(`Game with id ${gameId} was not found.`);
  }

  if (!category) {
    throw new Error(`Category with id ${categoryId} was not found.`);
  }

  if (category.gameId !== gameId) {
    throw new Error("categoryId does not belong to selected gameId.");
  }

  return {
    game,
    category,
  };
}

export function ensureProductManagementAccess(
  userId: string,
  role: Role | string | undefined,
  product: { sellerId: string },
) {
  if (
    userId === product.sellerId ||
    canManageForeignProducts((role as Role | null | undefined) ?? undefined)
  ) {
    return;
  }

  throw new Error(
    "Только продавец, администратор или супер-админ могут управлять этим товаром.",
  );
}

export function normalizeOptionalText(value?: string | null) {
  const normalizedValue = value?.trim() ?? "";

  return normalizedValue || null;
}

function countDigits(value: string) {
  return value.replace(/\D/g, "").length;
}

function replaceSensitiveMessageMatches(
  value: string,
  pattern: RegExp,
  replacement: string,
  predicate?: (match: string) => boolean,
) {
  return value.replace(pattern, (match) => {
    if (predicate && !predicate(match)) {
      return match;
    }

    return replacement;
  });
}

function isLikelyCardNumber(value: string) {
  const digitsCount = countDigits(value);

  return digitsCount >= 13 && digitsCount <= 19;
}

function isLikelyPhoneNumber(value: string) {
  const digitsCount = countDigits(value);

  if (digitsCount < 10 || digitsCount > 15) {
    return false;
  }

  if (digitsCount === 10) {
    return value.trim().startsWith("0") || /[\s().-]/.test(value);
  }

  return true;
}

export function moderateAntiLeakageMessageText(value?: string) {
  const normalizedValue = normalizeText(value);

  if (!normalizedValue) {
    return {
      text: normalizedValue,
      wasBlocked: false,
    };
  }

  let sanitizedValue = normalizedValue;

  for (const rule of ANTI_LEAKAGE_RULES) {
    sanitizedValue = replaceSensitiveMessageMatches(
      sanitizedValue,
      rule.pattern,
      rule.replacement,
      rule.predicate,
    );
  }

  sanitizedValue = sanitizedValue
    .replace(
      /(?:\[СКРЫТО\](?:\s*[,:;.-]?\s*)?){2,}/g,
      `${ANTI_LEAKAGE_REDACTED_PLACEHOLDER} `,
    )
    .replace(/\s{2,}/g, " ")
    .trim();

  if (!sanitizedValue) {
    sanitizedValue = ANTI_LEAKAGE_REDACTED_PLACEHOLDER;
  }

  return {
    text: sanitizedValue,
    wasBlocked: sanitizedValue !== normalizedValue,
  };
}

export function moderateDealRoomMessageText(value?: string) {
  return moderateAntiLeakageMessageText(value);
}

export function ensureOrderParticipant(
  userId: string,
  order: { buyerId: string; sellerId: string },
) {
  if (userId !== order.buyerId && userId !== order.sellerId) {
    throw new Error("Only order participants can access this order.");
  }
}

function canAdminAccessDisputedOrder(
  role: string | null | undefined,
  status: OrderStatus,
) {
  return (
    isAdminRole((role as Role | null | undefined) ?? undefined) &&
    status === OrderStatus.DISPUTED
  );
}

export function ensureOrderAccess(
  userId: string,
  order: { buyerId: string; sellerId: string; status: OrderStatus },
  role?: string,
) {
  if (
    userId === order.buyerId ||
    userId === order.sellerId ||
    canAdminAccessDisputedOrder(role, order.status)
  ) {
    return;
  }

  throw new Error("Only order participants can access this order.");
}

export function ensurePendingCheckoutAccess<
  T extends {
    buyerId: string;
    status: OrderStatus;
  },
>(
  buyerId: string,
  orderId: string,
  order: T | null,
) {
  if (!order) {
    throw new Error(`Order with id ${orderId} was not found.`);
  }

  if (order.buyerId !== buyerId) {
    throw new Error("Only the buyer can access checkout for this order.");
  }

  if (order.status !== OrderStatus.PENDING) {
    throw new Error(
      `Checkout is not available for order ${orderId} in status ${order.status}.`,
    );
  }

  return order;
}

export function ensureConversationParticipant(
  userId: string,
  conversation: { buyerId: string; sellerId: string },
) {
  if (userId !== conversation.buyerId && userId !== conversation.sellerId) {
    throw new Error("Only order participants can access this chat.");
  }
}

export function ensureConversationAccess(
  userId: string,
  conversation: {
    buyerId: string;
    sellerId: string;
    latestOrder?: { status: OrderStatus } | null;
  },
  role?: string,
  statusOverride?: OrderStatus,
) {
  const accessStatus = statusOverride ?? conversation.latestOrder?.status;

  if (
    userId === conversation.buyerId ||
    userId === conversation.sellerId ||
    (accessStatus ? canAdminAccessDisputedOrder(role, accessStatus) : false)
  ) {
    return;
  }

  throw new Error("Only order participants can access this chat.");
}

export function setTypingState(
  conversationId: string,
  senderId: string,
  isTyping: boolean,
) {
  const currentConversationTyping =
    chatTypingState.get(conversationId) ?? new Map<string, number>();

  if (isTyping) {
    currentConversationTyping.set(senderId, Date.now());
    chatTypingState.set(conversationId, currentConversationTyping);
    return;
  }

  currentConversationTyping.delete(senderId);

  if (currentConversationTyping.size === 0) {
    chatTypingState.delete(conversationId);
    return;
  }

  chatTypingState.set(conversationId, currentConversationTyping);
}

export function getTypingUsers(conversation: {
  id: string;
  buyerId: string;
  sellerId: string;
  buyer: { name: string | null };
  seller: { name: string | null };
}) {
  const now = Date.now();
  const currentConversationTyping =
    chatTypingState.get(conversation.id) ?? new Map<string, number>();

  for (const [senderId, lastTypedAt] of currentConversationTyping.entries()) {
    if (now - lastTypedAt > TYPING_TTL_MS) {
      currentConversationTyping.delete(senderId);
    }
  }

  if (currentConversationTyping.size === 0) {
    chatTypingState.delete(conversation.id);
    return [];
  }

  chatTypingState.set(conversation.id, currentConversationTyping);

  const typingUsers: Array<{
    senderId: string;
    role: "BUYER" | "SELLER";
    name: string | null;
  }> = [];

  if (currentConversationTyping.has(conversation.buyerId)) {
    typingUsers.push({
      senderId: conversation.buyerId,
      role: "BUYER",
      name: conversation.buyer.name,
    });
  }

  if (currentConversationTyping.has(conversation.sellerId)) {
    typingUsers.push({
      senderId: conversation.sellerId,
      role: "SELLER",
      name: conversation.seller.name,
    });
  }

  return typingUsers;
}

export function mapMarketplaceErrorToStatusCode(message: string) {
  if (
    message.includes("required") ||
    message.includes("must") ||
    message.includes("свой собственный товар")
  ) {
    return 400;
  }

  if (message.includes("Only ") || message.includes("participants")) {
    return 403;
  }

  if (message.includes("was not found") || message.includes("not found")) {
    return 404;
  }

  if (
    message.includes("cannot be confirmed") ||
    message.includes("cannot be completed") ||
    message.includes("cannot be refunded") ||
    message.includes("cannot be disputed") ||
    message.includes("cannot be resolved") ||
    message.includes("Недостаточно средств") ||
    message.includes("Checkout is not available") ||
    message.includes("could not be")
  ) {
    return 409;
  }

  return 400;
}