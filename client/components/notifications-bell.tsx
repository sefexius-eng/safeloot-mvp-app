"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";

import {
  getUnreadNotifications,
  markNotificationAsRead,
  type NotificationListItem,
} from "@/app/actions/notifications";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const NOTIFICATIONS_POLL_INTERVAL_MS = 20000;
const ANNOUNCED_NOTIFICATIONS_STORAGE_KEY = "safeloot:announced-notifications";

interface NotificationsBellProps {
  mode?: "trigger" | "panel";
  pushNotificationsEnabled?: boolean;
}

function formatNotificationTime(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function loadAnnouncedNotificationIds(userId: string) {
  if (typeof window === "undefined") {
    return new Set<string>();
  }

  try {
    const rawValue = window.sessionStorage.getItem(
      `${ANNOUNCED_NOTIFICATIONS_STORAGE_KEY}:${userId}`,
    );

    if (!rawValue) {
      return new Set<string>();
    }

    const parsedValue = JSON.parse(rawValue) as string[];
    return new Set(parsedValue.filter(Boolean));
  } catch {
    return new Set<string>();
  }
}

function persistAnnouncedNotificationIds(userId: string, notificationIds: Set<string>) {
  if (typeof window === "undefined") {
    return;
  }

  const normalizedIds = Array.from(notificationIds).slice(-150);
  window.sessionStorage.setItem(
    `${ANNOUNCED_NOTIFICATIONS_STORAGE_KEY}:${userId}`,
    JSON.stringify(normalizedIds),
  );
}

export function NotificationsBell({
  mode = "trigger",
  pushNotificationsEnabled = false,
}: NotificationsBellProps) {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [notifications, setNotifications] = useState<NotificationListItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const hasHydratedInitialNotificationsRef = useRef(false);
  const announcedNotificationIdsRef = useRef<Set<string>>(new Set());
  const notificationUserId = session?.user?.id?.trim() ?? "";

  useEffect(() => {
    announcedNotificationIdsRef.current = notificationUserId
      ? loadAnnouncedNotificationIds(notificationUserId)
      : new Set<string>();
    hasHydratedInitialNotificationsRef.current = false;
  }, [notificationUserId]);

  useEffect(() => {
    let isMounted = true;

    if (status !== "authenticated") {
      setNotifications([]);
      setErrorMessage("");
      return () => {
        isMounted = false;
      };
    }

    async function loadNotifications() {
      try {
        setIsLoading(true);
        const nextNotifications = await getUnreadNotifications();

        if (isMounted) {
          const nextNotificationIds = nextNotifications.map((notification) => notification.id);
          const announcedNotificationIds = announcedNotificationIdsRef.current;

          if (!hasHydratedInitialNotificationsRef.current) {
            for (const notificationId of nextNotificationIds) {
              announcedNotificationIds.add(notificationId);
            }

            if (notificationUserId) {
              persistAnnouncedNotificationIds(notificationUserId, announcedNotificationIds);
            }

            hasHydratedInitialNotificationsRef.current = true;
          } else {
            const newNotifications = nextNotifications.filter(
              (notification) => !announcedNotificationIds.has(notification.id),
            );

            for (const notification of newNotifications) {
              announcedNotificationIds.add(notification.id);
            }

            if (notificationUserId) {
              persistAnnouncedNotificationIds(notificationUserId, announcedNotificationIds);
            }

            if (
              pushNotificationsEnabled &&
              newNotifications.length > 0 &&
              typeof window !== "undefined" &&
              "Notification" in window &&
              window.Notification.permission === "granted" &&
              (document.visibilityState !== "visible" || !document.hasFocus())
            ) {
              for (const notification of [...newNotifications].reverse()) {
                const browserNotification = new window.Notification(notification.title, {
                  body: notification.message,
                  tag: notification.id,
                });

                browserNotification.onclick = () => {
                  window.focus();

                  if (notification.link) {
                    router.push(notification.link);
                  }

                  browserNotification.close();
                };
              }
            }

          }

          setNotifications(nextNotifications);
          setErrorMessage("");
        }
      } catch (error) {
        if (isMounted) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Не удалось загрузить уведомления.",
          );
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadNotifications();
    const intervalId = window.setInterval(() => {
      void loadNotifications();
    }, NOTIFICATIONS_POLL_INTERVAL_MS);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, [notificationUserId, pushNotificationsEnabled, router, status]);

  async function handleNotificationClick(notification: NotificationListItem) {
    try {
      await markNotificationAsRead(notification.id);
      setNotifications((currentNotifications) =>
        currentNotifications.filter(
          (currentNotification) => currentNotification.id !== notification.id,
        ),
      );
      setIsOpen(false);

      if (notification.link) {
        router.push(notification.link);
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Не удалось обновить уведомление.",
      );
    }
  }

  if (status !== "authenticated") {
    return null;
  }

  const unreadCount = notifications.length;

  const content = (
    <>
      {isLoading && notifications.length === 0 ? (
        <div className="px-3 py-4 text-sm text-zinc-400">Загружаем уведомления...</div>
      ) : null}

      {!isLoading && !errorMessage && notifications.length === 0 ? (
        <div className="px-3 py-4 text-sm leading-7 text-zinc-400">
          Непрочитанных уведомлений пока нет.
        </div>
      ) : null}

      {errorMessage ? (
        <div className="px-3 py-4 text-sm leading-7 text-rose-300">
          {errorMessage}
        </div>
      ) : null}

      <div className="max-h-[420px] overflow-y-auto">
        {notifications.map((notification) => (
          <button
            key={notification.id}
            type="button"
            onClick={() => {
              void handleNotificationClick(notification);
            }}
            className="flex w-full items-start rounded-2xl px-3 py-3 text-left transition hover:bg-white/5"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-semibold text-white">
                  {notification.title}
                </p>
                <span className="shrink-0 text-[11px] uppercase tracking-[0.16em] text-zinc-500">
                  {formatNotificationTime(notification.createdAt)}
                </span>
              </div>
              <p className="mt-1 text-sm leading-6 text-zinc-300">
                {notification.message}
              </p>
            </div>
          </button>
        ))}
      </div>
    </>
  );

  if (mode === "panel") {
    return (
      <div className="rounded-[1.4rem] border border-white/10 bg-white/5 p-2">
        <div className="flex items-center justify-between gap-3 px-3 py-2">
          <p className="text-sm font-semibold text-white">Уведомления</p>
          <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-400">
            {unreadCount}
          </span>
        </div>
        <div className="mt-1">{content}</div>
      </div>
    );
  }

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Уведомления"
          className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-lg text-zinc-100 shadow-[0_12px_28px_rgba(0,0,0,0.22)] transition hover:bg-white/10"
        >
          <span aria-hidden="true">🔔</span>
          {unreadCount > 0 ? (
            <span className="absolute -right-1 -top-1 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white shadow-[0_10px_24px_rgba(239,68,68,0.35)]">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          ) : null}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent className="w-[360px] max-w-[calc(100vw-2rem)]">
        <DropdownMenuLabel>Уведомления</DropdownMenuLabel>
        <DropdownMenuSeparator className="my-1 h-px bg-white/10" />
        {content}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}