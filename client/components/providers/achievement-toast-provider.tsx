"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";

import {
  getPusherClient,
  getUserNotificationChannelName,
  PUSHER_ACHIEVEMENT_UNLOCKED_EVENT,
  type BrowserPusherChannel,
  type RealtimeAchievementUnlockedPayload,
} from "@/lib/pusher";
import { cn } from "@/lib/utils";

interface AchievementToastItem {
  id: string;
  achievement: RealtimeAchievementUnlockedPayload["achievement"];
}

function getRarityClassName(rarity: AchievementToastItem["achievement"]["rarity"]) {
  switch (rarity) {
    case "COMMON":
      return "border-white/15 bg-zinc-950/92 text-zinc-200";
    case "RARE":
      return "border-sky-400/30 bg-sky-950/92 text-sky-100";
    case "EPIC":
      return "border-fuchsia-400/30 bg-fuchsia-950/92 text-fuchsia-100";
    case "LEGENDARY":
      return "border-amber-300/30 bg-amber-950/92 text-amber-100";
    default:
      return "border-white/15 bg-zinc-950/92 text-zinc-200";
  }
}

export function AchievementToastProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session, status } = useSession();
  const [toasts, setToasts] = useState<AchievementToastItem[]>([]);
  const timeoutsRef = useRef<Map<string, number>>(new Map());
  const userId = session?.user?.id?.trim() ?? "";

  useEffect(() => {
    return () => {
      timeoutsRef.current.forEach((timeoutId) => {
        window.clearTimeout(timeoutId);
      });
      timeoutsRef.current.clear();
    };
  }, []);

  useEffect(() => {
    if (status !== "authenticated" || !userId) {
      setToasts([]);
      return;
    }

    let isCancelled = false;
    let pusherChannel: BrowserPusherChannel | null = null;
    let pusherClient: Awaited<ReturnType<typeof getPusherClient>> = null;

    const dismissToast = (toastId: string) => {
      setToasts((currentToasts) =>
        currentToasts.filter((toast) => toast.id !== toastId),
      );

      const timeoutId = timeoutsRef.current.get(toastId);

      if (typeof timeoutId === "number") {
        window.clearTimeout(timeoutId);
        timeoutsRef.current.delete(toastId);
      }
    };

    const handleAchievementUnlocked = (
      payload: RealtimeAchievementUnlockedPayload,
    ) => {
      const toastId = `${payload.achievement.code}-${Date.now()}`;

      setToasts((currentToasts) => {
        const nextToasts = [
          {
            id: toastId,
            achievement: payload.achievement,
          },
          ...currentToasts,
        ];

        return nextToasts.slice(0, 3);
      });

      const timeoutId = window.setTimeout(() => {
        dismissToast(toastId);
      }, 5200);

      timeoutsRef.current.set(toastId, timeoutId);
    };

    void (async () => {
      pusherClient = await getPusherClient();

      if (!pusherClient || isCancelled) {
        return;
      }

      pusherChannel = pusherClient.subscribe(getUserNotificationChannelName(userId));
      pusherChannel.bind(
        PUSHER_ACHIEVEMENT_UNLOCKED_EVENT,
        handleAchievementUnlocked,
      );
    })();

    return () => {
      isCancelled = true;

      if (!pusherChannel) {
        return;
      }

      pusherChannel.unbind(
        PUSHER_ACHIEVEMENT_UNLOCKED_EVENT,
        handleAchievementUnlocked,
      );
      pusherClient?.unsubscribe(getUserNotificationChannelName(userId));
    };
  }, [status, userId]);

  return (
    <>
      {children}

      {toasts.length > 0 ? (
        <div className="pointer-events-none fixed bottom-6 right-6 z-[95] flex w-[min(430px,calc(100vw-2rem))] flex-col gap-3">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              role="status"
              aria-live="polite"
              className="rounded-[1.6rem] border border-amber-300/20 bg-[linear-gradient(135deg,rgba(245,158,11,0.96),rgba(120,53,15,0.96))] px-5 py-4 text-amber-50 shadow-[0_24px_70px_rgba(0,0,0,0.32)] backdrop-blur-xl"
            >
              <div className="flex items-start gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-[1.1rem] border border-white/20 bg-white/10">
                  <Image
                    src={toast.achievement.iconUrl}
                    alt={toast.achievement.title}
                    width={56}
                    height={56}
                    className="h-10 w-10 object-contain"
                  />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-100/85">
                    Достижение разблокировано
                  </p>
                  <p className="mt-1 text-lg font-semibold tracking-tight text-white">
                    🏆 {toast.achievement.title}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-amber-50/90">
                    {toast.achievement.description}
                  </p>
                  <span
                    className={cn(
                      "mt-3 inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]",
                      getRarityClassName(toast.achievement.rarity),
                    )}
                  >
                    {toast.achievement.rarity}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </>
  );
}