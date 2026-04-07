import { randomBytes } from "node:crypto";

const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN?.trim() || "";
const telegramApiBaseUrl = telegramBotToken
  ? `https://api.telegram.org/bot${telegramBotToken}`
  : "";

interface TelegramApiResponse<Result> {
  ok: boolean;
  result?: Result;
  description?: string;
}

async function telegramApiRequest<Result>(
  method: string,
  payload?: Record<string, unknown>,
): Promise<Result> {
  if (!telegramBotToken || !telegramApiBaseUrl) {
    throw new Error("TELEGRAM_BOT_TOKEN is not configured.");
  }

  const response = await fetch(`${telegramApiBaseUrl}/${method}`, {
    method: payload ? "POST" : "GET",
    headers: payload
      ? {
          "Content-Type": "application/json",
        }
      : undefined,
    body: payload ? JSON.stringify(payload) : undefined,
    cache: "no-store",
  });

  const data = (await response.json().catch(() => null)) as TelegramApiResponse<Result> | null;

  if (!response.ok || !data?.ok || data.result === undefined) {
    throw new Error(data?.description || `Telegram API request failed for ${method}.`);
  }

  return data.result;
}

export function createTelegramLinkToken() {
  return randomBytes(24).toString("hex");
}

export async function getTelegramBotUsername() {
  const bot = await telegramApiRequest<{ username?: string }>("getMe");
  const username = bot.username?.trim();

  if (!username) {
    throw new Error("Telegram bot username is not available.");
  }

  return username;
}

export async function sendTelegramTextMessage(chatId: bigint | number | string, text: string) {
  const normalizedText = text.trim();

  if (!normalizedText) {
    throw new Error("Telegram message text is required.");
  }

  return telegramApiRequest("sendMessage", {
    chat_id: chatId.toString(),
    text: normalizedText,
  });
}