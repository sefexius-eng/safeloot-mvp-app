"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";

import { markMessagesAsRead, sendMessage } from "@/app/actions/chat";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const CHAT_POLL_INTERVAL_MS = 3000;
const TYPING_POLL_INTERVAL_MS = 1500;
const TYPING_IDLE_TIMEOUT_MS = 1800;
const BALANCE_REFRESH_EVENT = "safeloot:balances-refresh";
const MAX_CHAT_IMAGE_WIDTH = 800;
const CHAT_IMAGE_QUALITY = 0.7;
const ACCEPTED_CHAT_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

type OrderStatus =
  | "PENDING"
  | "PAID"
  | "DELIVERED"
  | "COMPLETED"
  | "DISPUTED"
  | "CANCELLED";

interface OrderDetail {
  id: string;
  buyerId: string;
  sellerId: string;
  productId: string;
  price: string;
  platformFee: string;
  status: OrderStatus;
  chatRoomId: string | null;
  product: {
    id: string;
    title: string;
  };
}

interface ChatMessage {
  id: string;
  content: string;
  imageUrl: string | null;
  isRead: boolean;
  senderId: string;
  createdAt: string;
  updatedAt: string;
  sender: {
    id: string;
    email: string;
  };
}

interface ChatResponse {
  orderId: string;
  chatRoomId: string;
  messages: ChatMessage[];
}

interface TypingUser {
  senderId: string;
  role: "BUYER" | "SELLER";
  email: string;
}

interface ChatTypingResponse {
  orderId: string;
  typingUsers: TypingUser[];
}

interface CompleteOrderResponse {
  orderId: string;
  transactionId: string;
  status: OrderStatus;
  platformFee: string;
  sellerHoldAmount: string;
}

interface ActiveOrderViewProps {
  orderId: string;
}

function getStatusLabel(status: OrderStatus) {
  switch (status) {
    case "PENDING":
      return "Ожидает оплаты";
    case "PAID":
      return "Оплачен";
    case "DELIVERED":
      return "Передан";
    case "COMPLETED":
      return "Завершен";
    case "DISPUTED":
      return "Спор";
    case "CANCELLED":
      return "Отменен";
    default:
      return status;
  }
}

function getStatusBadgeClassName(status: OrderStatus) {
  switch (status) {
    case "PAID":
      return "border-sky-500/20 bg-sky-500/10 text-sky-200";
    case "COMPLETED":
      return "border-emerald-500/20 bg-emerald-500/10 text-emerald-200";
    case "DISPUTED":
      return "border-red-500/20 bg-red-500/10 text-red-200";
    case "CANCELLED":
      return "border-zinc-500/20 bg-zinc-500/10 text-zinc-300";
    default:
      return "border-amber-500/20 bg-amber-500/10 text-amber-200";
  }
}

function formatMessageTime(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatAmount(value: string) {
  const parsedValue = Number(value);

  if (!Number.isFinite(parsedValue)) {
    return value;
  }

  return new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(parsedValue);
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

export function ActiveOrderView({ orderId }: ActiveOrderViewProps) {
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [chatRoomId, setChatRoomId] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const [draftMessage, setDraftMessage] = useState("");
  const [draftImageBase64, setDraftImageBase64] = useState<string | null>(null);
  const [isOrderLoading, setIsOrderLoading] = useState(true);
  const [isChatLoading, setIsChatLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isProcessingAttachment, setIsProcessingAttachment] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [chatError, setChatError] = useState("");
  const [actionError, setActionError] = useState("");
  const [completeMessage, setCompleteMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const typingTimeoutRef = useRef<number | null>(null);
  const hasActiveTypingRef = useRef(false);
  const currentUserId = session?.user?.id ?? "";

  useEffect(() => {
    let isMounted = true;

    if (sessionStatus === "loading") {
      return () => {
        isMounted = false;
      };
    }

    if (sessionStatus !== "authenticated") {
      setLoadError("Чтобы открыть сделку, выполните вход в аккаунт.");
      setIsOrderLoading(false);

      return () => {
        isMounted = false;
      };
    }

    async function loadOrder() {
      setLoadError("");

      try {
        const response = await fetch(`/api/orders/${orderId}`, {
          cache: "no-store",
        });

        const payload = (await response.json().catch(() => null)) as
          | { message?: string; error?: string }
          | OrderDetail
          | null;

        if (!response.ok) {
          throw new Error(
            (payload && "message" in payload && payload.message) ||
              (payload && "error" in payload && payload.error) ||
              "Не удалось загрузить заказ.",
          );
        }

        if (isMounted) {
          setOrder(payload as OrderDetail);
        }
      } catch (error) {
        if (isMounted) {
          setLoadError(
            error instanceof Error
              ? error.message
              : "Не удалось загрузить заказ.",
          );
        }
      } finally {
        if (isMounted) {
          setIsOrderLoading(false);
        }
      }
    }

    void loadOrder();

    return () => {
      isMounted = false;
    };
  }, [orderId, sessionStatus]);

  useEffect(() => {
    let isMounted = true;

    if (sessionStatus !== "authenticated") {
      setIsChatLoading(false);

      return () => {
        isMounted = false;
      };
    }

    async function loadChat() {
      try {
        const response = await fetch(`/api/chat/${orderId}`, {
          cache: "no-store",
        });

        const payload = (await response.json().catch(() => null)) as
          | { message?: string; error?: string }
          | ChatResponse
          | null;

        if (!response.ok) {
          throw new Error(
            (payload && "message" in payload && payload.message) ||
              (payload && "error" in payload && payload.error) ||
              "Не удалось загрузить сообщения.",
          );
        }

        if (isMounted) {
          const chatPayload = payload as ChatResponse;
          setChatRoomId(chatPayload.chatRoomId);
          setMessages(chatPayload.messages);
          setChatError("");
        }
      } catch (error) {
        if (isMounted) {
          setChatError(
            error instanceof Error
              ? error.message
              : "Не удалось загрузить сообщения.",
          );
        }
      } finally {
        if (isMounted) {
          setIsChatLoading(false);
        }
      }
    }

    void loadChat();
    const intervalId = window.setInterval(() => {
      void loadChat();
    }, CHAT_POLL_INTERVAL_MS);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, [orderId, sessionStatus]);

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
        const response = await fetch(`/api/chat/${orderId}/typing`, {
          cache: "no-store",
        });

        const payload = (await response.json().catch(() => null)) as
          | { message?: string; error?: string }
          | ChatTypingResponse
          | null;

        if (!response.ok) {
          throw new Error(
            (payload && "message" in payload && payload.message) ||
              (payload && "error" in payload && payload.error) ||
              "Не удалось загрузить typing state.",
          );
        }

        if (isMounted) {
          setTypingUsers((payload as ChatTypingResponse).typingUsers);
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
  }, [orderId, sessionStatus]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  useEffect(() => {
    let isMounted = true;

    if (!currentUserId || !chatRoomId) {
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
        await markMessagesAsRead(chatRoomId);

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
  }, [chatRoomId, currentUserId, messages]);

  useEffect(() => {
    async function updateTypingState(isTyping: boolean) {
      if (!currentUserId) {
        return;
      }

      try {
        await fetch(`/api/chat/${orderId}/typing`, {
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
  }, [draftMessage, orderId]);

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        window.clearTimeout(typingTimeoutRef.current);
      }

      if (!hasActiveTypingRef.current) {
        return;
      }

      hasActiveTypingRef.current = false;

      void fetch(`/api/chat/${orderId}/typing`, {
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
  }, [currentUserId, orderId]);

  async function handleAttachmentSelection(file: File) {
    setChatError("");
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
      setChatError(
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
      setChatError("Чтобы отправлять сообщения, выполните вход.");
      return;
    }

    const content = draftMessage.trim();

    if (!content && !draftImageBase64) {
      return;
    }

    setIsSending(true);
    setChatError("");
    setActionError("");

    try {
      const result = await sendMessage(orderId, content, draftImageBase64);

      setDraftMessage("");
      setDraftImageBase64(null);
      setTypingUsers((currentTypingUsers) =>
        currentTypingUsers.filter((typingUser) => typingUser.senderId !== currentUserId),
      );
      hasActiveTypingRef.current = false;
      setChatRoomId(result.chatRoomId);

      if (typingTimeoutRef.current) {
        window.clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      const nextMessage = result.message
        ? {
            ...result.message,
            createdAt: new Date(result.message.createdAt).toISOString(),
            updatedAt: new Date(result.message.updatedAt).toISOString(),
          }
        : null;

      if (nextMessage) {
        setMessages((currentMessages) => [...currentMessages, nextMessage]);
      }
    } catch (error) {
      setChatError(
        error instanceof Error
          ? error.message
          : "Не удалось отправить сообщение.",
      );
    } finally {
      setIsSending(false);
    }
  }

  async function handleCompleteOrder() {
    if (!currentUserId) {
      setActionError("Чтобы завершить сделку, выполните вход.");
      return;
    }

    setIsCompleting(true);
    setActionError("");
    setCompleteMessage("");

    try {
      const response = await fetch(`/api/orders/${orderId}/complete`, {
        method: "POST",
      });

      const payload = (await response.json().catch(() => null)) as
        | { message?: string; error?: string }
        | CompleteOrderResponse
        | null;

      if (!response.ok) {
        throw new Error(
          (payload && "message" in payload && payload.message) ||
            (payload && "error" in payload && payload.error) ||
            "Не удалось завершить сделку.",
        );
      }

      const completedOrder = payload as CompleteOrderResponse;

      setOrder((currentOrder) =>
        currentOrder
          ? {
              ...currentOrder,
              status: completedOrder.status,
              platformFee: completedOrder.platformFee,
            }
          : currentOrder,
      );
      setCompleteMessage("Сделка завершена. Средства отправлены продавцу в holdBalance.");
      window.dispatchEvent(new Event(BALANCE_REFRESH_EVENT));
      router.refresh();
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "Не удалось завершить сделку.",
      );
    } finally {
      setIsCompleting(false);
    }
  }

  if (isOrderLoading) {
    return (
      <div className="rounded-[2rem] border border-white/10 bg-zinc-900/80 p-8 text-sm text-zinc-400 shadow-[0_24px_80px_rgba(0,0,0,0.28)] backdrop-blur">
        Загружаем активную сделку...
      </div>
    );
  }

  if (!order || loadError) {
    return (
      <div className="rounded-[2rem] border border-red-500/15 bg-red-500/10 p-8 text-sm leading-7 text-red-200 shadow-[0_24px_80px_rgba(0,0,0,0.28)] backdrop-blur">
        {loadError || "Не удалось загрузить страницу сделки."}
        {sessionStatus !== "authenticated" ? (
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/login" className="inline-flex rounded-2xl bg-orange-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-orange-500">
              Войти
            </Link>
            <Link href="/register" className="inline-flex rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-zinc-200 transition hover:bg-white/10">
              Регистрация
            </Link>
          </div>
        ) : null}
      </div>
    );
  }

  const remoteTypingUsers = typingUsers.filter(
    (typingUser) => typingUser.senderId !== currentUserId,
  );
  const sellerIsTyping = remoteTypingUsers.some(
    (typingUser) => typingUser.role === "SELLER",
  );

  return (
    <section className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_360px] lg:items-start">
      <div className="rounded-[2rem] border border-white/10 bg-zinc-900/80 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.28)] backdrop-blur md:p-6">
        <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-4">
          <div>
            <p className="text-sm font-semibold tracking-[0.24em] uppercase text-zinc-500">
              Чат сделки
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">
              Переписка по заказу
            </h2>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="rounded-full border border-orange-500/20 bg-orange-500/10 px-3 py-1 text-[11px] font-semibold tracking-[0.2em] uppercase text-orange-200">
                Покупатель
              </span>
              <span className="rounded-full border border-sky-500/20 bg-sky-500/10 px-3 py-1 text-[11px] font-semibold tracking-[0.2em] uppercase text-sky-200">
                Продавец
              </span>
            </div>
          </div>
          <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold tracking-[0.2em] uppercase text-emerald-200">
            online
          </span>
        </div>

        <div className="mt-5 h-[480px] overflow-y-auto rounded-[1.5rem] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.74),rgba(9,9,11,0.86))] p-4">
          {isChatLoading ? (
            <p className="text-sm text-zinc-500">Загружаем сообщения...</p>
          ) : null}

          {!isChatLoading && messages.length === 0 ? (
            <div className="flex h-full items-center justify-center text-center text-sm leading-7 text-zinc-500">
              Чат активирован. Напишите первое сообщение продавцу, чтобы начать сделку.
            </div>
          ) : null}

          <div className="space-y-3">
            {messages.map((message) => {
              const isOwnMessage = message.senderId === currentUserId;
              const isSellerMessage = message.senderId === order.sellerId;
              const roleLabel = isSellerMessage ? "Продавец" : "Покупатель";
              const authorLabel = isOwnMessage
                ? "Вы"
                : message.sender.email.split("@")[0] || message.sender.email;

              return (
                <div
                  key={message.id}
                  className={`flex ${isOwnMessage ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={[
                      "max-w-[85%] rounded-[1.35rem] border px-4 py-3 shadow-[0_12px_30px_rgba(0,0,0,0.18)]",
                      isOwnMessage
                        ? "border-orange-400/25 bg-orange-600 text-white"
                        : isSellerMessage
                          ? "border-sky-500/20 bg-sky-500/8 text-zinc-100"
                          : "border-white/10 bg-white/6 text-zinc-100",
                    ].join(" ")}
                  >
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span
                        className={[
                          "rounded-full px-2.5 py-1 font-semibold tracking-[0.18em] uppercase",
                          isOwnMessage
                            ? "bg-white/12 text-orange-100"
                            : isSellerMessage
                              ? "bg-sky-500/14 text-sky-200"
                              : "bg-white/8 text-zinc-300",
                        ].join(" ")}
                      >
                        {roleLabel}
                      </span>
                      <span className={isOwnMessage ? "text-orange-100/85" : "text-zinc-300"}>
                        {authorLabel}
                      </span>
                    </div>

                    {message.content ? (
                      <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-7">
                        {message.content}
                      </p>
                    ) : null}

                    {message.imageUrl ? (
                      <a
                        href={message.imageUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-3 block overflow-hidden rounded-[1rem] border border-white/10 bg-black/15"
                      >
                        <img
                          src={message.imageUrl}
                          alt="Скриншот из чата"
                          className="max-h-[360px] w-auto max-w-full object-cover"
                        />
                      </a>
                    ) : null}

                    <div className="mt-3 flex items-center justify-end gap-2 text-xs">
                      <span className={isOwnMessage ? "text-orange-100/70" : isSellerMessage ? "text-sky-200/70" : "text-zinc-500"}>
                        {formatMessageTime(message.createdAt)}
                      </span>
                      {isOwnMessage ? (
                        <span
                          className={message.isRead ? "font-semibold text-sky-300" : "font-semibold text-orange-100/80"}
                        >
                          {message.isRead ? "✓✓" : "✓"}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}

            {sellerIsTyping ? (
              <div className="flex justify-start">
                <div className="inline-flex items-center gap-3 rounded-[1.35rem] border border-sky-500/20 bg-sky-500/8 px-4 py-3 text-sm text-sky-100 shadow-[0_12px_30px_rgba(0,0,0,0.18)]">
                  <span className="rounded-full bg-sky-500/14 px-2.5 py-1 text-[11px] font-semibold tracking-[0.18em] uppercase text-sky-200">
                    Продавец
                  </span>
                  <span>печатает</span>
                  <span className="inline-flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-sky-300 animate-pulse" />
                    <span className="h-2 w-2 rounded-full bg-sky-300 animate-pulse [animation-delay:150ms]" />
                    <span className="h-2 w-2 rounded-full bg-sky-300 animate-pulse [animation-delay:300ms]" />
                  </span>
                </div>
              </div>
            ) : null}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {chatError ? (
          <div className="mt-4 rounded-[1.25rem] border border-red-500/15 bg-red-500/10 p-4 text-sm leading-7 text-red-200">
            {chatError}
          </div>
        ) : null}

        {draftImageBase64 ? (
          <div className="mt-4 flex items-start gap-3 rounded-[1.25rem] border border-white/10 bg-white/5 p-3">
            <img
              src={draftImageBase64}
              alt="Предпросмотр скриншота"
              className="h-20 w-28 rounded-2xl object-cover"
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-white">Скриншот готов к отправке</p>
              <p className="mt-1 text-sm text-zinc-400">
                Можно отправить его вместе с текстом или отдельным сообщением.
              </p>
            </div>
            <button
              type="button"
              onClick={handleRemoveAttachment}
              className="inline-flex h-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 text-sm font-semibold text-zinc-200 transition hover:bg-white/10"
            >
              Убрать
            </button>
          </div>
        ) : null}

        {isProcessingAttachment ? (
          <p className="mt-4 text-sm text-zinc-400">Подготавливаем скриншот для отправки...</p>
        ) : null}

        <form onSubmit={handleSendMessage} className="mt-5 flex gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleAttachmentChange}
            className="hidden"
          />
          <button
            type="button"
            aria-label="Прикрепить скриншот"
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
            placeholder={currentUserId ? "Напишите сообщение или приложите скриншот" : "Войдите, чтобы писать в чат"}
            className="h-14 flex-1 border-white/10 bg-white/5 text-zinc-100 placeholder:text-zinc-500 focus:border-orange-500/45 focus:bg-white/8"
            disabled={isSending || isProcessingAttachment || !currentUserId}
          />
          <Button
            type="submit"
            disabled={
              isSending ||
              isProcessingAttachment ||
              (!draftMessage.trim() && !draftImageBase64) ||
              !currentUserId
            }
            className="h-14 rounded-[1.35rem] bg-orange-600 px-6 text-sm font-semibold text-white shadow-[0_18px_42px_rgba(234,88,12,0.35)] hover:bg-orange-500"
          >
            {isSending ? "Отправляем..." : "Отправить"}
          </Button>
        </form>
      </div>

      <aside className="rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(24,24,27,0.96),rgba(15,23,42,0.96))] p-6 text-white shadow-[0_24px_80px_rgba(0,0,0,0.28)] backdrop-blur lg:sticky lg:top-28">
        <p className="text-sm font-semibold tracking-[0.24em] uppercase text-zinc-500">
          Инфо заказа
        </p>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white">
          Активная сделка
        </h2>

        <div className="mt-6 space-y-4">
          <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
            <p className="text-xs tracking-[0.24em] uppercase text-zinc-500">
              Название
            </p>
            <p className="mt-3 text-lg font-semibold text-white">
              {order.product.title}
            </p>
          </div>

          <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
            <p className="text-xs tracking-[0.24em] uppercase text-zinc-500">
              Сумма
            </p>
            <p className="mt-3 text-lg font-semibold text-white">
              {formatAmount(order.price)}
            </p>
          </div>

          <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
            <p className="text-xs tracking-[0.24em] uppercase text-zinc-500">
              Статус
            </p>
            <div className="mt-3 flex items-center gap-3">
              <span
                className={`inline-flex rounded-full border px-3 py-1.5 text-sm font-semibold ${getStatusBadgeClassName(order.status)}`}
              >
                {getStatusLabel(order.status)}
              </span>
            </div>
          </div>

          <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
            <p className="text-xs tracking-[0.24em] uppercase text-zinc-500">
              Номер заказа
            </p>
            <p className="mt-3 break-all text-sm font-medium text-zinc-300">
              #{order.id}
            </p>
          </div>
        </div>

        {completeMessage ? (
          <div className="mt-6 rounded-[1.5rem] border border-emerald-500/15 bg-emerald-500/10 p-4 text-sm leading-7 text-emerald-200">
            {completeMessage}
          </div>
        ) : null}

        {actionError ? (
          <div className="mt-6 rounded-[1.5rem] border border-red-500/15 bg-red-500/10 p-4 text-sm leading-7 text-red-200">
            {actionError}
          </div>
        ) : null}

        {order.status !== "COMPLETED" ? (
          <Button
            type="button"
            onClick={handleCompleteOrder}
            disabled={isCompleting || !currentUserId}
            className="mt-6 h-14 w-full rounded-[1.35rem] bg-emerald-600 text-base font-semibold shadow-[0_18px_42px_rgba(5,150,105,0.35)] hover:bg-emerald-500"
          >
            {isCompleting ? "Подтверждаем получение..." : "Подтвердить получение товара"}
          </Button>
        ) : null}

        <div className="mt-6 rounded-[1.5rem] border border-white/10 bg-white/5 p-4 text-sm leading-7 text-zinc-300">
          После подтверждения получения товара система завершит сделку и переведет средства продавцу с учетом комиссии платформы.
        </div>
      </aside>
    </section>
  );
}
