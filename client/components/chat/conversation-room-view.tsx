"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";

import {
  markConversationMessagesAsRead,
  sendConversationMessage,
} from "@/app/actions/chat";
import CensoredText from "@/components/censored-text";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const CHAT_POLL_INTERVAL_MS = 3000;
const TYPING_POLL_INTERVAL_MS = 1500;
const TYPING_IDLE_TIMEOUT_MS = 1800;
const MAX_CHAT_IMAGE_WIDTH = 800;
const CHAT_IMAGE_QUALITY = 0.7;
const ACCEPTED_CHAT_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

interface ConversationMessage {
  id: string;
  text: string;
  imageUrl: string | null;
  isRead: boolean;
  senderId: string;
  createdAt: string;
  updatedAt: string;
  sender: {
    id: string;
    email: string;
    name?: string | null;
    image?: string | null;
  };
}

interface TypingUser {
  senderId: string;
  role: "BUYER" | "SELLER";
  email: string;
}

interface ConversationResponse {
  conversationId: string;
  messages: ConversationMessage[];
}

interface ConversationTypingResponse {
  conversationId: string;
  typingUsers: TypingUser[];
}

interface ConversationRoomViewProps {
  conversationId: string;
}

function formatMessageTime(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
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

export function ConversationRoomView({ conversationId }: ConversationRoomViewProps) {
  const { data: session, status: sessionStatus } = useSession();
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const [draftMessage, setDraftMessage] = useState("");
  const [draftImageBase64, setDraftImageBase64] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isProcessingAttachment, setIsProcessingAttachment] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const previousMessageCountRef = useRef(0);
  const chatScrollContainerRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const typingTimeoutRef = useRef<number | null>(null);
  const hasActiveTypingRef = useRef(false);
  const currentUserId = session?.user?.id ?? "";
  const remoteTypingUsers = typingUsers.filter(
    (typingUser) => typingUser.senderId !== currentUserId,
  );

  useEffect(() => {
    previousMessageCountRef.current = 0;
  }, [conversationId]);

  useEffect(() => {
    let isMounted = true;

    if (sessionStatus === "loading") {
      return () => {
        isMounted = false;
      };
    }

    if (sessionStatus !== "authenticated") {
      setErrorMessage("Чтобы открыть диалог, выполните вход.");
      setIsLoading(false);

      return () => {
        isMounted = false;
      };
    }

    async function loadMessages() {
      try {
        const response = await fetch(`/api/conversations/${conversationId}`, {
          cache: "no-store",
        });

        const payload = (await response.json().catch(() => null)) as
          | { message?: string; error?: string }
          | ConversationResponse
          | null;

        if (!response.ok) {
          throw new Error(
            (payload && "message" in payload && payload.message) ||
              (payload && "error" in payload && payload.error) ||
              "Не удалось загрузить сообщения.",
          );
        }

        if (isMounted) {
          setMessages((payload as ConversationResponse).messages);
          setErrorMessage("");
        }
      } catch (error) {
        if (isMounted) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Не удалось загрузить сообщения.",
          );
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadMessages();
    const intervalId = window.setInterval(() => {
      void loadMessages();
    }, CHAT_POLL_INTERVAL_MS);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, [conversationId, sessionStatus]);

  useEffect(() => {
    let isMounted = true;

    if (sessionStatus !== "authenticated") {
      setTypingUsers([]);

      return () => {
        isMounted = false;
      };
    }

    async function loadTypingState() {
      try {
        const response = await fetch(`/api/conversations/${conversationId}/typing`, {
          cache: "no-store",
        });

        const payload = (await response.json().catch(() => null)) as
          | { message?: string; error?: string }
          | ConversationTypingResponse
          | null;

        if (!response.ok) {
          throw new Error(
            (payload && "message" in payload && payload.message) ||
              (payload && "error" in payload && payload.error) ||
              "Не удалось загрузить typing state.",
          );
        }

        if (isMounted) {
          setTypingUsers((payload as ConversationTypingResponse).typingUsers);
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
  }, [conversationId, sessionStatus]);

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

    if (!currentUserId) {
      return () => {
        isMounted = false;
      };
    }

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
      if (!currentUserId) {
        return;
      }

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

    if (!hasText || !currentUserId) {
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
  }, [conversationId, currentUserId, draftMessage]);

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

    if (!currentUserId) {
      setErrorMessage("Чтобы отправлять сообщения, выполните вход.");
      return;
    }

    const text = draftMessage.trim();

    if (!text && !draftImageBase64) {
      return;
    }

    setIsSending(true);
    setErrorMessage("");

    try {
      const result = await sendConversationMessage(conversationId, text, draftImageBase64);

      setDraftMessage("");
      setDraftImageBase64(null);
      setTypingUsers((currentTypingUsers) =>
        currentTypingUsers.filter((typingUser) => typingUser.senderId !== currentUserId),
      );
      hasActiveTypingRef.current = false;

      if (typingTimeoutRef.current) {
        window.clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      if (result.message) {
        setMessages((currentMessages) => [...currentMessages, result.message]);
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Не удалось отправить сообщение.",
      );
    } finally {
      setIsSending(false);
    }
  }

  if (isLoading) {
    return (
      <section className="flex min-h-0 flex-1 items-center justify-center bg-[#0f1318] p-6 text-zinc-300">
        Загружаем историю диалога...
      </section>
    );
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col bg-[#0f1318]">
      <div
        ref={chatScrollContainerRef}
        className="flex-1 overflow-y-auto p-4"
      >
        <div className="space-y-4">
          {messages.length === 0 ? (
            <div className="rounded-[1.5rem] border border-dashed border-white/10 bg-white/5 px-5 py-8 text-center text-sm leading-7 text-zinc-400">
              Сообщений пока нет. Начните диалог первым.
            </div>
          ) : (
            messages.map((message) => {
              const isOwnMessage = message.senderId === currentUserId;
              const authorLabel = isOwnMessage
                ? "Вы"
                : message.sender.name?.trim() || message.sender.email;

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
              text={`${remoteTypingUsers.map((typingUser) => typingUser.email).join(", ")} печатает...`}
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
            disabled={isSending || isProcessingAttachment || !currentUserId}
            className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-[1.35rem] border border-white/10 bg-white/5 text-xl text-zinc-200 shadow-[0_12px_30px_rgba(0,0,0,0.18)] transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
          >
            📎
          </button>
          <Input
            value={draftMessage}
            onChange={(event) => setDraftMessage(event.target.value)}
            placeholder={!currentUserId ? "Войдите, чтобы писать в чат" : "Напишите сообщение или приложите скриншот"}
            className="h-14 flex-1 border-white/10 bg-white/5 text-zinc-100 placeholder:text-zinc-500 focus:border-orange-500/45 focus:bg-white/8"
            disabled={isSending || isProcessingAttachment || !currentUserId}
          />
          <Button
            type="submit"
            disabled={isSending || isProcessingAttachment || (!draftMessage.trim() && !draftImageBase64) || !currentUserId}
            className="h-14 rounded-[1.35rem] bg-orange-600 px-6 text-sm font-semibold text-white shadow-[0_18px_42px_rgba(234,88,12,0.35)] hover:bg-orange-500"
          >
            {isSending ? "Отправляем..." : "Отправить"}
          </Button>
        </form>
      </div>
    </section>
  );
}