"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";

import { markMessagesAsRead, sendMessage } from "@/app/actions/chat";
import {
  openDispute,
  resolveDisputeToBuyer,
  resolveDisputeToSeller,
} from "@/app/actions/orders";
import { createReview } from "@/app/actions/reviews";
import { RatingStars } from "@/components/reviews/rating-stars";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { UserAvatar } from "@/components/ui/user-avatar";

const CHAT_POLL_INTERVAL_MS = 3000;
const ORDER_REFRESH_INTERVAL_MS = 30000;
const TYPING_POLL_INTERVAL_MS = 1500;
const TYPING_IDLE_TIMEOUT_MS = 1800;
const INTERLOCUTOR_ONLINE_WINDOW_MS = 5 * 60 * 1000;
const BALANCE_REFRESH_EVENT = "safeloot:balances-refresh";
const MAX_CHAT_IMAGE_WIDTH = 800;
const CHAT_IMAGE_QUALITY = 0.7;
const ACCEPTED_CHAT_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

interface ChatUserIdentity {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
}

interface OrderParticipant extends ChatUserIdentity {
  lastSeen: string;
}

type OrderStatus =
  | "PENDING"
  | "PAID"
  | "DELIVERED"
  | "COMPLETED"
  | "DISPUTED"
  | "REFUNDED"
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
  review: {
    id: string;
    rating: number;
    comment: string | null;
    createdAt: string;
  } | null;
  buyer: OrderParticipant;
  seller: OrderParticipant;
}

interface ChatMessage {
  id: string;
  content: string;
  imageUrl: string | null;
  isRead: boolean;
  senderId: string;
  createdAt: string;
  updatedAt: string;
  sender: ChatUserIdentity;
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
  sellerNetAmount?: string;
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
    case "REFUNDED":
      return "Возврат покупателю";
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
    case "REFUNDED":
      return "border-amber-500/20 bg-amber-500/10 text-amber-200";
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

function formatReviewTime(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function getUserDisplayName(user: { name?: string | null; email: string }) {
  return user.name?.trim() || user.email.split("@")[0] || "Пользователь";
}

function isUserOnline(lastSeen?: string | null) {
  if (!lastSeen) {
    return false;
  }

  const lastSeenTime = new Date(lastSeen).getTime();

  return (
    Number.isFinite(lastSeenTime) &&
    lastSeenTime > Date.now() - INTERLOCUTOR_ONLINE_WINDOW_MS
  );
}

function getOrderParticipantById(order: OrderDetail, userId: string) {
  if (userId === order.buyerId) {
    return order.buyer;
  }

  if (userId === order.sellerId) {
    return order.seller;
  }

  return null;
}

function resolveMessageAuthor(order: OrderDetail, message: ChatMessage) {
  return getOrderParticipantById(order, message.senderId) ?? message.sender;
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
  const [isReviewPending, startReviewTransition] = useTransition();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [chatRoomId, setChatRoomId] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const [draftMessage, setDraftMessage] = useState("");
  const [draftImageBase64, setDraftImageBase64] = useState<string | null>(null);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState("");
  const [isOrderLoading, setIsOrderLoading] = useState(true);
  const [isChatLoading, setIsChatLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isProcessingAttachment, setIsProcessingAttachment] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [isOpeningDispute, setIsOpeningDispute] = useState(false);
  const [isResolvingToBuyer, setIsResolvingToBuyer] = useState(false);
  const [isResolvingToSeller, setIsResolvingToSeller] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [chatError, setChatError] = useState("");
  const [actionError, setActionError] = useState("");
  const [completeMessage, setCompleteMessage] = useState("");
  const [reviewError, setReviewError] = useState("");
  const [reviewSuccess, setReviewSuccess] = useState("");
  const chatScrollContainerRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const typingTimeoutRef = useRef<number | null>(null);
  const hasActiveTypingRef = useRef(false);
  const previousMessageCountRef = useRef(0);
  const currentUserId = session?.user?.id ?? "";
  const currentUserAccountRole = session?.user?.role ?? "USER";
  const isCurrentUserSeller = order?.sellerId === currentUserId;

  useEffect(() => {
    previousMessageCountRef.current = 0;
  }, [orderId]);

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
    const intervalId = window.setInterval(() => {
      void loadOrder();
    }, ORDER_REFRESH_INTERVAL_MS);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
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

    const isSpectator =
      (currentUserAccountRole === "ADMIN" ||
        currentUserAccountRole === "SUPER_ADMIN") &&
      currentUserId !== order?.buyerId &&
      currentUserId !== order?.sellerId;

    if (!currentUserId || !chatRoomId || isSpectator) {
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
  }, [
    chatRoomId,
    currentUserId,
    currentUserAccountRole,
    messages,
    order,
  ]);

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
      setCompleteMessage("Сделка завершена. Средства зачислены продавцу на доступный баланс.");
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

  async function handleOpenDispute() {
    setIsOpeningDispute(true);
    setActionError("");
    setCompleteMessage("");

    try {
      const result = await openDispute(orderId);

      if (!result.ok || !result.status) {
        throw new Error(result.message ?? "Не удалось открыть спор.");
      }

      setOrder((currentOrder) =>
        currentOrder
          ? {
              ...currentOrder,
              status: result.status as OrderStatus,
            }
          : currentOrder,
      );
      setCompleteMessage("Спор открыт. Сделка заморожена до решения арбитра.");
      router.refresh();
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Не удалось открыть спор.",
      );
    } finally {
      setIsOpeningDispute(false);
    }
  }

  async function handleResolveDisputeToBuyer() {
    setIsResolvingToBuyer(true);
    setActionError("");
    setCompleteMessage("");

    try {
      const result = await resolveDisputeToBuyer(orderId);

      if (!result.ok || !result.status) {
        throw new Error(
          result.message ?? "Не удалось вернуть средства покупателю.",
        );
      }

      setOrder((currentOrder) =>
        currentOrder
          ? {
              ...currentOrder,
              status: result.status as OrderStatus,
              platformFee: "0.00000000",
            }
          : currentOrder,
      );
      setCompleteMessage(
        result.refundAmount
          ? `Арбитраж завершен: покупателю возвращено ${formatAmount(result.refundAmount)} USDT.`
          : "Арбитраж завершен в пользу покупателя.",
      );
      window.dispatchEvent(new Event(BALANCE_REFRESH_EVENT));
      router.refresh();
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "Не удалось вернуть средства покупателю.",
      );
    } finally {
      setIsResolvingToBuyer(false);
    }
  }

  async function handleResolveDisputeToSeller() {
    setIsResolvingToSeller(true);
    setActionError("");
    setCompleteMessage("");

    try {
      const result = await resolveDisputeToSeller(orderId);

      if (!result.ok || !result.status) {
        throw new Error(result.message ?? "Не удалось завершить спор в пользу продавца.");
      }

      setOrder((currentOrder) =>
        currentOrder
          ? {
              ...currentOrder,
              status: result.status as OrderStatus,
              platformFee: result.platformFee ?? currentOrder.platformFee,
            }
          : currentOrder,
      );
      setCompleteMessage(
        result.sellerNetAmount
          ? `Арбитраж завершен: продавцу начислено ${formatAmount(result.sellerNetAmount)} USDT.`
          : "Арбитраж завершен в пользу продавца.",
      );
      window.dispatchEvent(new Event(BALANCE_REFRESH_EVENT));
      router.refresh();
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "Не удалось завершить спор в пользу продавца.",
      );
    } finally {
      setIsResolvingToSeller(false);
    }
  }

  function handleSubmitReview(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!currentUserId) {
      setReviewError("Чтобы оставить отзыв, выполните вход.");
      return;
    }

    if (reviewRating < 1 || reviewRating > 5) {
      setReviewError("Поставьте оценку от 1 до 5.");
      return;
    }

    setReviewError("");
    setReviewSuccess("");

    startReviewTransition(() => {
      void createReview(orderId, reviewRating, reviewComment)
        .then((result) => {
          if (!result.ok || !result.review) {
            setReviewError(result.message ?? "Не удалось сохранить отзыв.");
            return;
          }

          setOrder((currentOrder) =>
            currentOrder
              ? {
                  ...currentOrder,
                  review: result.review,
                }
              : currentOrder,
          );
          setReviewComment("");
          setReviewRating(0);
          setReviewSuccess("Отзыв опубликован. Спасибо за обратную связь.");
          router.refresh();
        })
        .catch((error) => {
          setReviewError(
            error instanceof Error
              ? error.message
              : "Не удалось сохранить отзыв.",
          );
        });
    });
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
  const isBuyer = currentUserId === order.buyerId;
  const isSeller = currentUserId === order.sellerId;
  const isParticipant = isBuyer || isSeller;
  const currentParticipant = isBuyer
    ? order.buyer
    : isSeller
      ? order.seller
      : null;
  const interlocutor = isBuyer ? order.seller : isSeller ? order.buyer : null;
  const currentUserDealRole = isBuyer
    ? "Покупатель"
    : isSeller
      ? "Продавец"
      : "Арбитр";
  const interlocutorRole = isBuyer
    ? "Продавец"
    : isSeller
      ? "Покупатель"
      : null;
  const interlocutorDisplayName = interlocutor
    ? getUserDisplayName(interlocutor)
    : "";
  const interlocutorIsOnline = interlocutor
    ? isUserOnline(interlocutor.lastSeen)
    : false;
  const emptyStateTargetLabel = interlocutorRole?.toLowerCase() ?? "участнику сделки";
  const currentUserDisplayName = currentParticipant
    ? getUserDisplayName(currentParticipant)
    : session?.user?.name?.trim() || "Вы";
  const remoteTypingUser = remoteTypingUsers[0] ?? null;
  const typingParticipant = remoteTypingUser
    ? getOrderParticipantById(order, remoteTypingUser.senderId)
    : null;
  const typingDisplayName = typingParticipant
    ? getUserDisplayName(typingParticipant)
    : "Собеседник";
  const isRemoteTyping = remoteTypingUsers.length > 0;
  const isSpectator =
    (currentUserAccountRole === "ADMIN" ||
      currentUserAccountRole === "SUPER_ADMIN") &&
    !isParticipant;
  const canOpenDispute =
    isParticipant && (order.status === "PAID" || order.status === "DELIVERED");
  const canCompleteOrder =
    currentUserId === order.buyerId &&
    (order.status === "PAID" || order.status === "DELIVERED");
  const showArbiterPanel = isSpectator && order.status === "DISPUTED";
  const isChatReadOnly = isSpectator;
  const canLeaveReview =
    order.status === "COMPLETED" &&
    currentUserId === order.buyerId &&
    !order.review;
  const reviewTitle = currentUserId === order.buyerId ? "Ваш отзыв" : "Отзыв покупателя";

  return (
    <section className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_360px] lg:items-start">
      <div className="rounded-[2rem] border border-white/10 bg-zinc-900/80 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.28)] backdrop-blur md:p-6">
        <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-4">
          {interlocutor ? (
            <div className="flex min-w-0 items-center gap-3">
              <div className="relative shrink-0">
                <UserAvatar
                  src={interlocutor.image}
                  name={interlocutorDisplayName}
                  email={interlocutor.email}
                  className="h-10 w-10 shrink-0 border-white/10 bg-zinc-800/80"
                  imageClassName="rounded-full object-cover"
                />
                <span
                  aria-label={interlocutorIsOnline ? "Собеседник онлайн" : "Собеседник не в сети"}
                  title={interlocutorIsOnline ? "Собеседник онлайн" : "Собеседник не в сети"}
                  className={[
                    "absolute -bottom-0.5 -right-0.5 inline-flex h-3.5 w-3.5 items-center justify-center rounded-full border border-zinc-950 text-[8px]",
                    interlocutorIsOnline
                      ? "bg-emerald-500 text-emerald-950"
                      : "bg-zinc-600 text-zinc-200",
                  ].join(" ")}
                >
                  ●
                </span>
              </div>

              <div className="min-w-0">
                <p className="text-sm font-semibold tracking-[0.24em] uppercase text-zinc-500">
                  Чат сделки
                </p>
                <Link
                  href={`/user/${interlocutor.id}`}
                  className="mt-1 block truncate text-xl font-semibold tracking-tight text-white transition hover:text-orange-300 hover:underline"
                >
                  {interlocutorDisplayName}
                </Link>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-zinc-400">
                  <span>{interlocutorRole}</span>
                  <span className="h-1 w-1 rounded-full bg-zinc-600" />
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      className={[
                        "h-2 w-2 rounded-full",
                        interlocutorIsOnline ? "bg-emerald-400" : "bg-zinc-500",
                      ].join(" ")}
                    />
                    {interlocutorIsOnline ? "Онлайн" : "Не в сети"}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="min-w-0">
              <p className="text-sm font-semibold tracking-[0.24em] uppercase text-zinc-500">
                Чат сделки
              </p>
              <div className="mt-3 flex flex-wrap gap-4">
                {[
                  { participant: order.buyer, role: "Покупатель" },
                  { participant: order.seller, role: "Продавец" },
                ].map(({ participant, role }) => (
                  <Link
                    key={participant.id}
                    href={`/user/${participant.id}`}
                    className="flex min-w-0 items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 transition hover:bg-white/10"
                  >
                    <UserAvatar
                      src={participant.image}
                      name={getUserDisplayName(participant)}
                      email={participant.email}
                      className="h-10 w-10 shrink-0 border-white/10 bg-zinc-800/80"
                      imageClassName="rounded-full object-cover"
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold tracking-[0.18em] uppercase text-zinc-500">
                        {role}
                      </p>
                      <p className="truncate text-sm font-semibold text-white">
                        {getUserDisplayName(participant)}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold tracking-[0.18em] uppercase text-zinc-200">
            {isParticipant ? `Вы • ${currentUserDealRole}` : "Наблюдатель"}
          </span>
        </div>

        {order.status === "DISPUTED" ? (
          <div className="mt-5 rounded-[1.5rem] border border-amber-500/25 bg-amber-500/10 p-4 text-sm leading-7 text-amber-100">
            Сделка находится в споре. Выдача средств и финальное закрытие заморожены до решения арбитра.
          </div>
        ) : null}

        <div
          ref={chatScrollContainerRef}
          className="mt-5 h-[480px] overflow-y-auto rounded-[1.5rem] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.74),rgba(9,9,11,0.86))] p-4"
        >
          {isChatLoading ? (
            <p className="text-sm text-zinc-500">Загружаем сообщения...</p>
          ) : null}

          {!isChatLoading && messages.length === 0 ? (
            <div className="flex h-full items-center justify-center text-center text-sm leading-7 text-zinc-500">
              Чат активирован. Напишите первое сообщение {emptyStateTargetLabel}, чтобы начать общение.
            </div>
          ) : null}

          <div className="space-y-3">
            {messages.map((message) => {
              const isOwnMessage = message.senderId === currentUserId;
              const isSellerMessage = message.senderId === order.sellerId;
              const author = resolveMessageAuthor(order, message);
              const authorLabel = isOwnMessage ? "Вы" : getUserDisplayName(author);
              const authorAvatar = isOwnMessage
                ? currentParticipant?.image ?? session?.user?.image ?? author.image
                : author.image;
              const authorName = isOwnMessage
                ? currentUserDisplayName
                : getUserDisplayName(author);
              const authorEmail = isOwnMessage
                ? currentParticipant?.email ?? session?.user?.email ?? author.email
                : author.email;

              return (
                <div
                  key={message.id}
                  className={`flex ${isOwnMessage ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`flex max-w-[92%] items-end gap-3 ${isOwnMessage ? "flex-row-reverse" : ""}`}
                  >
                    <UserAvatar
                      src={authorAvatar}
                      name={authorName}
                      email={authorEmail}
                      className={[
                        "h-8 w-8 shrink-0 border-white/10",
                        isOwnMessage
                          ? "bg-orange-500/10 text-orange-100"
                          : isSellerMessage
                            ? "bg-sky-500/10 text-sky-200"
                            : "bg-zinc-800/80 text-zinc-300",
                      ].join(" ")}
                      imageClassName="rounded-full object-cover"
                    />

                    <div className={`flex min-w-0 flex-col ${isOwnMessage ? "items-end" : "items-start"}`}>
                      <span
                        className={[
                          "mb-1 px-1 text-xs font-semibold",
                          isOwnMessage
                            ? "text-orange-100/85"
                            : isSellerMessage
                              ? "text-sky-200"
                              : "text-zinc-400",
                        ].join(" ")}
                      >
                        {authorLabel}
                      </span>

                      <div
                        className={[
                          "max-w-full rounded-[1.35rem] border px-4 py-3 shadow-[0_12px_30px_rgba(0,0,0,0.18)]",
                          isOwnMessage
                            ? "border-orange-400/25 bg-orange-600 text-white"
                            : isSellerMessage
                              ? "border-sky-500/20 bg-sky-500/8 text-zinc-100"
                              : "border-white/10 bg-white/6 text-zinc-100",
                        ].join(" ")}
                      >
                        {message.content ? (
                          <p className="whitespace-pre-wrap break-words text-sm leading-7">
                            {message.content}
                          </p>
                        ) : null}

                        {message.imageUrl ? (
                          <a
                            href={message.imageUrl}
                            target="_blank"
                            rel="noreferrer"
                            className={message.content ? "mt-3 block overflow-hidden rounded-[1rem] border border-white/10 bg-black/15" : "block overflow-hidden rounded-[1rem] border border-white/10 bg-black/15"}
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
                  </div>
                </div>
              );
            })}

            {isRemoteTyping ? (
              <div className="flex justify-start">
                <div className="inline-flex items-center gap-3 rounded-[1.35rem] border border-sky-500/20 bg-sky-500/8 px-4 py-3 text-sm text-sky-100 shadow-[0_12px_30px_rgba(0,0,0,0.18)]">
                  {typingParticipant ? (
                    <UserAvatar
                      src={typingParticipant.image}
                      name={typingDisplayName}
                      email={typingParticipant.email}
                      className="h-8 w-8 shrink-0 border-sky-500/20 bg-sky-500/10 text-sky-200"
                      imageClassName="rounded-full object-cover"
                    />
                  ) : null}
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-sky-100">{typingDisplayName}</span>
                    <span>печатает</span>
                  </div>
                  <span className="inline-flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-sky-300 animate-pulse" />
                    <span className="h-2 w-2 rounded-full bg-sky-300 animate-pulse [animation-delay:150ms]" />
                    <span className="h-2 w-2 rounded-full bg-sky-300 animate-pulse [animation-delay:300ms]" />
                  </span>
                </div>
              </div>
            ) : null}
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

        {isChatReadOnly ? (
          <div className="mt-5 rounded-[1.25rem] border border-sky-500/20 bg-sky-500/10 p-4 text-sm leading-7 text-sky-100">
            Арбитр может просматривать переписку, но не участвует в чате сделки.
          </div>
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
            disabled={
              isSending ||
              isProcessingAttachment ||
              !currentUserId ||
              isChatReadOnly
            }
            className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-[1.35rem] border border-white/10 bg-white/5 text-xl text-zinc-200 shadow-[0_12px_30px_rgba(0,0,0,0.18)] transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
          >
            📎
          </button>
          <Input
            value={draftMessage}
            onChange={(event) => setDraftMessage(event.target.value)}
            placeholder={
              !currentUserId
                ? "Войдите, чтобы писать в чат"
                : isChatReadOnly
                  ? "Чат доступен арбитру только для чтения"
                  : "Напишите сообщение или приложите скриншот"
            }
            className="h-14 flex-1 border-white/10 bg-white/5 text-zinc-100 placeholder:text-zinc-500 focus:border-orange-500/45 focus:bg-white/8"
            disabled={
              isSending ||
              isProcessingAttachment ||
              !currentUserId ||
              isChatReadOnly
            }
          />
          <Button
            type="submit"
            disabled={
              isSending ||
              isProcessingAttachment ||
              (!draftMessage.trim() && !draftImageBase64) ||
              !currentUserId ||
              isChatReadOnly
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
            {isCurrentUserSeller ? (
              <p className="mt-3 text-sm text-emerald-300">
                К зачислению: {(Number(order.price) * 0.95).toFixed(2)} (Комиссия 5%)
              </p>
            ) : null}
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

        {canOpenDispute ? (
          <Button
            type="button"
            onClick={handleOpenDispute}
            disabled={isOpeningDispute}
            className="mt-6 h-14 w-full rounded-[1.35rem] bg-red-600 text-base font-semibold shadow-[0_18px_42px_rgba(220,38,38,0.32)] hover:bg-red-500"
          >
            {isOpeningDispute ? "Открываем спор..." : "Открыть спор"}
          </Button>
        ) : null}

        {showArbiterPanel ? (
          <div className="mt-6 rounded-[1.5rem] border border-amber-500/20 bg-amber-500/10 p-5">
            <p className="text-xs font-semibold tracking-[0.24em] uppercase text-amber-200/80">
              Панель арбитра
            </p>
            <h3 className="mt-2 text-lg font-semibold text-white">
              Разрешение спора по сделке
            </h3>
            <p className="mt-2 text-sm leading-7 text-amber-50/80">
              Проверьте переписку и примите решение о возврате покупателю или о передаче средств продавцу.
            </p>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={handleResolveDisputeToBuyer}
                disabled={isResolvingToBuyer || isResolvingToSeller}
                className="rounded-md bg-red-500 px-4 py-2 font-medium text-white transition-colors hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isResolvingToBuyer
                  ? "Возвращаем средства..."
                  : "Вернуть средства покупателю"}
              </button>
              <button
                type="button"
                onClick={handleResolveDisputeToSeller}
                disabled={isResolvingToBuyer || isResolvingToSeller}
                className="rounded-md bg-green-600 px-4 py-2 font-medium text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isResolvingToSeller
                  ? "Передаем средства..."
                  : "Передать средства продавцу"}
              </button>
            </div>
          </div>
        ) : null}

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

        {canCompleteOrder ? (
          <Button
            type="button"
            onClick={handleCompleteOrder}
            disabled={isCompleting || !currentUserId}
            className="mt-6 h-14 w-full rounded-[1.35rem] bg-emerald-600 text-base font-semibold shadow-[0_18px_42px_rgba(5,150,105,0.35)] hover:bg-emerald-500"
          >
            {isCompleting ? "Подтверждаем получение..." : "Подтвердить получение товара"}
          </Button>
        ) : null}

        {reviewSuccess ? (
          <div className="mt-6 rounded-[1.5rem] border border-emerald-500/15 bg-emerald-500/10 p-4 text-sm leading-7 text-emerald-200">
            {reviewSuccess}
          </div>
        ) : null}

        {reviewError ? (
          <div className="mt-6 rounded-[1.5rem] border border-red-500/15 bg-red-500/10 p-4 text-sm leading-7 text-red-200">
            {reviewError}
          </div>
        ) : null}

        {order.review ? (
          <div className="mt-6 rounded-[1.5rem] border border-amber-500/15 bg-amber-500/10 p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold tracking-[0.24em] uppercase text-amber-200/80">
                  {reviewTitle}
                </p>
                <p className="mt-2 text-lg font-semibold text-white">
                  Сделка оценена на {order.review.rating} из 5
                </p>
              </div>
              <RatingStars value={order.review.rating} size="md" />
            </div>

            <p className="mt-3 text-sm text-zinc-400">
              {formatReviewTime(order.review.createdAt)}
            </p>

            {order.review.comment ? (
              <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-zinc-200">
                {order.review.comment}
              </p>
            ) : (
              <p className="mt-4 text-sm text-zinc-500">Комментарий не добавлен.</p>
            )}
          </div>
        ) : canLeaveReview ? (
          <form
            onSubmit={handleSubmitReview}
            className="mt-6 rounded-[1.5rem] border border-white/10 bg-white/5 p-5"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold tracking-[0.24em] uppercase text-zinc-500">
                  Ваш отзыв
                </p>
                <h3 className="mt-2 text-lg font-semibold text-white">
                  Оцените завершенную сделку
                </h3>
                <p className="mt-2 text-sm leading-7 text-zinc-400">
                  Отзыв увидят другие покупатели на карточке товара и в профиле продавца.
                </p>
              </div>

              <RatingStars
                value={reviewRating}
                onChange={(value) => {
                  setReviewRating(value);
                  setReviewError("");
                }}
                size="lg"
                disabled={isReviewPending}
              />
            </div>

            <p className="mt-3 text-sm text-zinc-400">
              {reviewRating > 0
                ? `Оценка: ${reviewRating} из 5`
                : "Выберите оценку от 1 до 5."}
            </p>

            <div className="mt-4">
              <p className="text-xs font-semibold tracking-[0.24em] uppercase text-zinc-500">
                Комментарий
              </p>
              <Textarea
                value={reviewComment}
                onChange={(event) => setReviewComment(event.target.value)}
                maxLength={1000}
                rows={4}
                placeholder="Что понравилось в сделке? Комментарий необязателен."
                disabled={isReviewPending}
                className="mt-3 border-white/10 bg-white/5 text-zinc-100 placeholder:text-zinc-500 focus:border-orange-500/45 focus:bg-white/8"
              />
              <div className="mt-2 flex items-center justify-between gap-4 text-xs text-zinc-500">
                <span>Комментарий необязателен, но помогает другим покупателям.</span>
                <span>{reviewComment.length}/1000</span>
              </div>
            </div>

            <Button
              type="submit"
              disabled={isReviewPending || reviewRating < 1}
              className="mt-5 h-12 w-full rounded-[1.2rem] bg-orange-600 text-sm font-semibold text-white shadow-[0_18px_42px_rgba(234,88,12,0.35)] hover:bg-orange-500"
            >
              {isReviewPending ? "Публикуем отзыв..." : "Опубликовать отзыв"}
            </Button>
          </form>
        ) : order.status === "COMPLETED" && currentUserId === order.sellerId ? (
          <div className="mt-6 rounded-[1.5rem] border border-white/10 bg-white/5 p-4 text-sm leading-7 text-zinc-400">
            Покупатель еще не оставил отзыв по этой сделке.
          </div>
        ) : null}

        <div className="mt-6 rounded-[1.5rem] border border-white/10 bg-white/5 p-4 text-sm leading-7 text-zinc-300">
          {order.status === "DISPUTED"
            ? "Во время спора сделка заморожена: финальный исход определяет арбитр после проверки чата и материалов по заказу."
            : order.status === "REFUNDED"
              ? "Спор завершен возвратом. Средства возвращены покупателю, а заказ закрыт без выплаты продавцу."
              : "После подтверждения получения товара система завершит сделку и переведет средства продавцу с учетом комиссии платформы."}
        </div>
      </aside>
    </section>
  );
}
