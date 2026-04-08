"use client";

import { useEffect, useRef, useState } from "react";

import { markConversationMessagesAsRead } from "@/app/actions/chat";
import CensoredText from "@/components/censored-text";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const CHAT_POLL_INTERVAL_MS = 2500;
const TYPING_POLL_INTERVAL_MS = 1500;
const TYPING_IDLE_TIMEOUT_MS = 1800;
const MAX_CHAT_IMAGE_WIDTH = 800;
const CHAT_IMAGE_QUALITY = 0.7;
const ACCEPTED_CHAT_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export interface ChatMessageSender {
  id: string;
  name?: string | null;
  image?: string | null;
}

export interface ChatMessage {
  id: string;
  text: string;
  imageUrl: string | null;
  isSystem: boolean;
  isRead: boolean;
  senderId: string;
  createdAt: string;
  updatedAt: string;
  sender: ChatMessageSender;
  optimistic?: boolean;
}

interface TypingUser {
  senderId: string;
  role: "BUYER" | "SELLER";
  name: string | null;
}

interface ChatMessagesResponse {
  conversationId: string;
  messages: ChatMessage[];
  messageCount: number;
  latestMessageCreatedAt: string | null;
}

interface ConversationTypingResponse {
  conversationId: string;
  typingUsers: TypingUser[];
}

interface ChatMessagesProps {
  conversationId: string;
  currentUserId: string;
  initialMessages: ChatMessage[];
}

function formatMessageTime(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function getConversationUserLabel(name?: string | null) {
  return name?.trim() || "Пользователь";
}

function getTypingUserLabel(typingUser: TypingUser) {
  return (
    typingUser.name?.trim() ||
    (typingUser.role === "SELLER" ? "Продавец" : "Покупатель")
  );
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
    image.onerror = () => reject(new Error("Не удалось обработать скриншот."));
    image.src = source;
  });
}

async function compressChatImage(file: File) {
  if (!ACCEPTED_CHAT_IMAGE_TYPES.has(file.type)) {
    throw new Error("Поддерживаются только JPG, PNG и WebP.");
  }

  const source = await readFileAsDataUrl(file);
  const image = await loadImage(source);
  const scale = Math.min(MAX_CHAT_IMAGE_WIDTH / image.width, 1);
  const targetWidth = Math.max(1, Math.round(image.width * scale));
  const targetHeight = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement("canvas");

  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Не удалось подготовить изображение для отправки.");
  }

  context.drawImage(image, 0, 0, targetWidth, targetHeight);

  const webpBlob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/webp", CHAT_IMAGE_QUALITY);
  });

  if (!webpBlob) {
    throw new Error("Не удалось сжать скриншот.");
  }

  return readFileAsDataUrl(webpBlob);
}

function mergeMessages(currentMessages: ChatMessage[], nextMessages: ChatMessage[]) {
  const mergedMessages = new Map<string, ChatMessage>();

  for (const message of currentMessages) {
    mergedMessages.set(message.id, message);
  }

  for (const message of nextMessages) {
    const existingMessage = mergedMessages.get(message.id);
    mergedMessages.set(message.id, {
      ...existingMessage,
      ...message,
      optimistic: false,
    });
  }

  return Array.from(mergedMessages.values()).sort(
    (left, right) =>
      Date.parse(left.createdAt) - Date.parse(right.createdAt),
  );
}

async function parseApiResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => null)) as
    | { message?: string; error?: string }
    | T
    | null;
  const isObjectPayload = typeof payload === "object" && payload !== null;

  if (!response.ok) {
    throw new Error(
      (isObjectPayload && "message" in payload && payload.message) ||
        (isObjectPayload && "error" in payload && payload.error) ||
        "Не удалось выполнить запрос.",
    );
  }

  return payload as T;
}

export function ChatMessages({
  conversationId,
  currentUserId,
  initialMessages,
}: ChatMessagesProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const [draftMessage, setDraftMessage] = useState("");
  const [draftImageBase64, setDraftImageBase64] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isProcessingAttachment, setIsProcessingAttachment] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const previousMessageCountRef = useRef(initialMessages.length);
  const latestMessageCreatedAtRef = useRef<string | null>(
    initialMessages[initialMessages.length - 1]?.createdAt ?? null,
  );
  const chatScrollContainerRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const typingTimeoutRef = useRef<number | null>(null);
  const hasActiveTypingRef = useRef(false);
  const remoteTypingUsers = typingUsers.filter(
    (typingUser) => typingUser.senderId !== currentUserId,
  );

  useEffect(() => {
    setMessages(initialMessages);
    setTypingUsers([]);
    setDraftMessage("");
    setDraftImageBase64(null);
    setErrorMessage("");
    previousMessageCountRef.current = initialMessages.length;
    latestMessageCreatedAtRef.current =
      initialMessages[initialMessages.length - 1]?.createdAt ?? null;
  }, [conversationId, initialMessages]);

  useEffect(() => {
    const latestMessage = messages[messages.length - 1];

    if (latestMessage) {
      latestMessageCreatedAtRef.current = latestMessage.createdAt;
    }
  }, [messages]);

  useEffect(() => {
    let isMounted = true;

    async function loadNewMessages() {
      try {
        const searchParams = new URLSearchParams();

        if (latestMessageCreatedAtRef.current) {
          searchParams.set("after", latestMessageCreatedAtRef.current);
        }

        const queryString = searchParams.toString();
        const response = await fetch(
          `/api/chats/${conversationId}/messages${queryString ? `?${queryString}` : ""}`,
          {
            cache: "no-store",
          },
        );
        const payload = await parseApiResponse<ChatMessagesResponse>(response);

        if (!isMounted) {
          return;
        }

        latestMessageCreatedAtRef.current =
          payload.latestMessageCreatedAt ?? latestMessageCreatedAtRef.current;

        if (payload.messages.length > 0) {
          setMessages((currentMessages) =>
            mergeMessages(currentMessages, payload.messages),
          );
        }

        setErrorMessage("");
      } catch (error) {
        if (isMounted) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Не удалось загрузить сообщения.",
          );
        }
      }
    }

    const intervalId = window.setInterval(() => {
      void loadNewMessages();
    }, CHAT_POLL_INTERVAL_MS);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, [conversationId]);

  useEffect(() => {
    let isMounted = true;

    async function loadTypingState() {
      try {
        const response = await fetch(`/api/conversations/${conversationId}/typing`, {
          cache: "no-store",
        });
        const payload = await parseApiResponse<ConversationTypingResponse>(response);

        if (isMounted) {
          setTypingUsers(payload.typingUsers);
        }
      } catch {
        if (isMounted) {
          setTypingUsers([]);
        }
      }
    }

    void loadTypingState();
    const intervalId = window.setInterval(() => {
      void loadTypingState();
    }, TYPING_POLL_INTERVAL_MS);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, [conversationId]);

  useEffect(() => {
    const chatScrollContainer = chatScrollContainerRef.current;

    if (!chatScrollContainer) {
      previousMessageCountRef.current = messages.length;
      return;
    }

    const nextMessageCount = messages.length;
    const previousMessageCount = previousMessageCountRef.current;

    if (nextMessageCount === 0 || nextMessageCount === previousMessageCount) {
      previousMessageCountRef.current = nextMessageCount;
      return;
    }

    const scrollBehavior = previousMessageCount === 0 ? "auto" : "smooth";
    const animationFrameId = window.requestAnimationFrame(() => {
      chatScrollContainer.scrollTo({
        top: chatScrollContainer.scrollHeight,
        behavior: scrollBehavior,
      });
    });

    previousMessageCountRef.current = nextMessageCount;

    return () => {
      window.cancelAnimationFrame(animationFrameId);
    };
  }, [messages.length]);

  useEffect(() => {
    let isMounted = true;

    const hasUnreadRemoteMessages = messages.some(
      (message) => message.senderId !== currentUserId && !message.isRead,
    );

    if (!hasUnreadRemoteMessages) {
      return () => {
        isMounted = false;
      };
    }

    async function syncReadState() {
      try {
        await markConversationMessagesAsRead(conversationId);

        if (isMounted) {
          setMessages((currentMessages) =>
            currentMessages.map((message) =>
              message.senderId !== currentUserId
                ? {
                    ...message,
                    isRead: true,
                  }
                : message,
            ),
          );
        }
      } catch {
        return;
      }
    }

    void syncReadState();

    return () => {
      isMounted = false;
    };
  }, [conversationId, currentUserId, messages]);

  useEffect(() => {
    async function updateTypingState(isTyping: boolean) {
      try {
        await fetch(`/api/conversations/${conversationId}/typing`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            isTyping,
          }),
        });
      } catch {
        return;
      }
    }

    const hasText = draftMessage.trim().length > 0;

    if (!hasText) {
      if (typingTimeoutRef.current) {
        window.clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }

      if (hasActiveTypingRef.current) {
        hasActiveTypingRef.current = false;
        void updateTypingState(false);
      }

      return;
    }

    if (!hasActiveTypingRef.current) {
      hasActiveTypingRef.current = true;
      void updateTypingState(true);
    }

    if (typingTimeoutRef.current) {
      window.clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = window.setTimeout(() => {
      hasActiveTypingRef.current = false;
      void updateTypingState(false);
    }, TYPING_IDLE_TIMEOUT_MS);

    return () => {
      if (typingTimeoutRef.current) {
        window.clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [conversationId, draftMessage]);

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        window.clearTimeout(typingTimeoutRef.current);
      }

      if (!hasActiveTypingRef.current) {
        return;
      }

      hasActiveTypingRef.current = false;

      void fetch(`/api/conversations/${conversationId}/typing`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          isTyping: false,
        }),
        keepalive: true,
      });
    };
  }, [conversationId]);

  async function handleAttachmentSelection(file: File) {
    setErrorMessage("");
    setIsProcessingAttachment(true);

    try {
      const compressedImage = await compressChatImage(file);
      setDraftImageBase64(compressedImage);
    } finally {
      setIsProcessingAttachment(false);
    }
  }

  function handleAttachmentChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    event.target.value = "";

    if (!file) {
      return;
    }

    void handleAttachmentSelection(file).catch((error) => {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Не удалось подготовить скриншот.",
      );
    });
  }

  function handleRemoveAttachment() {
    setDraftImageBase64(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  async function handleSendMessage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const text = draftMessage.trim();
    const imageBase64 = draftImageBase64;

    if (!text && !imageBase64) {
      return;
    }

    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const optimisticTimestamp = new Date().toISOString();
    const optimisticMessage: ChatMessage = {
      id: tempId,
      text,
      imageUrl: imageBase64,
      isSystem: false,
      isRead: true,
      senderId: currentUserId,
      createdAt: optimisticTimestamp,
      updatedAt: optimisticTimestamp,
      optimistic: true,
      sender: {
        id: currentUserId,
        name: "Вы",
        image: null,
      },
    };

    setIsSending(true);
    setErrorMessage("");
    setDraftMessage("");
    setDraftImageBase64(null);
    setTypingUsers((currentTypingUsers) =>
      currentTypingUsers.filter((typingUser) => typingUser.senderId !== currentUserId),
    );
    setMessages((currentMessages) => [...currentMessages, optimisticMessage]);
    hasActiveTypingRef.current = false;

    if (typingTimeoutRef.current) {
      window.clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    try {
      const response = await fetch(`/api/chats/${conversationId}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text,
          imageBase64,
        }),
      });
      const result = await parseApiResponse<{
        conversationId: string;
        message: ChatMessage;
        systemMessage?: ChatMessage | null;
      }>(response);

      setMessages((currentMessages) =>
        mergeMessages(
          currentMessages.filter((message) => message.id !== tempId),
          result.systemMessage ? [result.message, result.systemMessage] : [result.message],
        ),
      );
      latestMessageCreatedAtRef.current =
        result.systemMessage?.createdAt ?? result.message.createdAt;
    } catch (error) {
      setMessages((currentMessages) =>
        currentMessages.filter((message) => message.id !== tempId),
      );
      setDraftMessage(text);
      setDraftImageBase64(imageBase64);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Не удалось отправить сообщение.",
      );
    } finally {
      setIsSending(false);
    }
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col bg-[#0f1318]">
      <div ref={chatScrollContainerRef} className="flex-1 overflow-y-auto p-4">
        <div className="space-y-4">
          {messages.length === 0 ? (
            <div className="rounded-[1.5rem] border border-dashed border-white/10 bg-white/5 px-5 py-8 text-center text-sm leading-7 text-zinc-400">
              Сообщений пока нет. Начните диалог первым.
            </div>
          ) : (
            messages.map((message) => {
              if (message.isSystem) {
                return (
                  <div key={message.id} className="flex justify-center">
                    <div className="max-w-[92%] rounded-[1.5rem] border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-center text-sm leading-7 text-amber-100 shadow-[0_12px_30px_rgba(0,0,0,0.18)]">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-200/80">
                        Система SafeLoot
                      </p>
                      <p className="mt-2 whitespace-pre-wrap">
                        <CensoredText text={message.text} />
                      </p>
                      <p className="mt-3 text-[11px] uppercase tracking-[0.16em] text-amber-200/70">
                        {formatMessageTime(message.createdAt)}
                      </p>
                    </div>
                  </div>
                );
              }

              const isOwnMessage = message.senderId === currentUserId;
              const authorLabel = isOwnMessage
                ? "Вы"
                : getConversationUserLabel(message.sender.name);

              return (
                <div
                  key={message.id}
                  className={`flex ${isOwnMessage ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={[
                      "max-w-[85%] rounded-[1.5rem] border px-4 py-3 shadow-[0_12px_30px_rgba(0,0,0,0.18)]",
                      isOwnMessage
                        ? "border-orange-500/20 bg-orange-500/12 text-orange-50"
                        : "border-white/10 bg-white/6 text-zinc-100",
                      message.optimistic ? "opacity-80" : "opacity-100",
                    ].join(" ")}
                  >
                    <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">
                      <CensoredText text={authorLabel} />
                    </p>
                    {message.text ? (
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-7">
                        <CensoredText text={message.text} />
                      </p>
                    ) : null}
                    {message.imageUrl ? (
                      <img
                        src={message.imageUrl}
                        alt="Вложение к сообщению"
                        className="mt-3 max-h-[320px] w-full rounded-[1rem] border border-white/10 object-cover"
                      />
                    ) : null}
                    <p className="mt-3 text-right text-[11px] uppercase tracking-[0.16em] text-zinc-500">
                      {formatMessageTime(message.createdAt)}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="shrink-0 border-t border-gray-800 bg-[#11151b] p-4">
        {remoteTypingUsers.length > 0 ? (
          <div className="mb-4 rounded-[1.25rem] border border-sky-500/15 bg-sky-500/8 px-4 py-3 text-sm text-sky-100">
            <CensoredText
              text={`${remoteTypingUsers.map((typingUser) => getTypingUserLabel(typingUser)).join(", ")} печатает...`}
            />
          </div>
        ) : null}

        {draftImageBase64 ? (
          <div className="mb-4 rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">
                  Подготовленное вложение
                </p>
                <img
                  src={draftImageBase64}
                  alt="Подготовленный скриншот"
                  className="mt-3 max-h-56 rounded-[1rem] border border-white/10 object-cover"
                />
              </div>
              <Button
                type="button"
                onClick={handleRemoveAttachment}
                className="h-10 rounded-xl bg-zinc-800 px-4 text-sm text-zinc-200 hover:bg-zinc-700"
              >
                Убрать
              </Button>
            </div>
          </div>
        ) : null}

        {errorMessage ? (
          <div className="mb-4 rounded-[1.25rem] border border-red-500/15 bg-red-500/10 p-4 text-sm leading-7 text-red-200">
            {errorMessage}
          </div>
        ) : null}

        <form onSubmit={handleSendMessage} className="flex items-end gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleAttachmentChange}
            className="hidden"
          />
          <button
            type="button"
            title="Прикрепить скриншот"
            onClick={() => fileInputRef.current?.click()}
            disabled={isSending || isProcessingAttachment}
            className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-[1.35rem] border border-white/10 bg-white/5 text-xl text-zinc-200 shadow-[0_12px_30px_rgba(0,0,0,0.18)] transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
          >
            📎
          </button>
          <Input
            value={draftMessage}
            onChange={(event) => setDraftMessage(event.target.value)}
            placeholder="Напишите сообщение или приложите скриншот"
            className="h-14 flex-1 border-white/10 bg-white/5 text-zinc-100 placeholder:text-zinc-500 focus:border-orange-500/45 focus:bg-white/8"
            disabled={isSending || isProcessingAttachment}
          />
          <Button
            type="submit"
            disabled={isSending || isProcessingAttachment || (!draftMessage.trim() && !draftImageBase64)}
            className="h-14 rounded-[1.35rem] bg-orange-600 px-6 text-sm font-semibold text-white shadow-[0_18px_42px_rgba(234,88,12,0.35)] hover:bg-orange-500"
          >
            {isSending ? "Отправляем..." : "Отправить"}
          </Button>
        </form>
      </div>
    </section>
  );
}