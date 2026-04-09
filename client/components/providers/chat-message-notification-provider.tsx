"use client";

import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useRef } from "react";

import { useTabNotification } from "@/components/chat/use-tab-notification";
import {
  getPusherClient,
  getUserConversationAlertChannelName,
  PUSHER_CONVERSATION_ALERT_EVENT,
  type BrowserPusherChannel,
  type RealtimeConversationAlertPayload,
} from "@/lib/pusher";

const CHAT_ROUTE_PREFIX = "/chats/";
const SOUND_COOLDOWN_MS = 60_000;

function getConversationPath(conversationId: string) {
  return `${CHAT_ROUTE_PREFIX}${conversationId}`;
}

function getConversationIdFromPathname(pathname: string) {
  if (!pathname.startsWith(CHAT_ROUTE_PREFIX)) {
    return null;
  }

  const pathSegments = pathname.split("/").filter(Boolean);

  if (pathSegments.length !== 2 || pathSegments[0] !== "chats") {
    return null;
  }

  return pathSegments[1] ?? null;
}

export function ChatMessageNotificationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const { clearNotification, playNotificationSound, startTitleNotification } =
    useTabNotification();
  const currentUserId = session?.user?.id?.trim() ?? "";
  const pathnameRef = useRef(pathname);
  const pendingConversationIdsRef = useRef<Set<string>>(new Set());
  const lastNotificationTimeRef = useRef<Record<string, number>>({});

  useEffect(() => {
    pathnameRef.current = pathname;

    const openConversationId = getConversationIdFromPathname(pathname);

    if (!openConversationId) {
      return;
    }

    const pendingConversationIds = pendingConversationIdsRef.current;

    if (!pendingConversationIds.delete(openConversationId)) {
      return;
    }

    if (pendingConversationIds.size === 0) {
      clearNotification();
    }
  }, [clearNotification, pathname]);

  useEffect(() => {
    if (status === "authenticated" && currentUserId) {
      return;
    }

    pendingConversationIdsRef.current.clear();
    lastNotificationTimeRef.current = {};
    clearNotification();
  }, [clearNotification, currentUserId, status]);

  useEffect(() => {
    if (typeof document === "undefined" || typeof window === "undefined") {
      return;
    }

    const acknowledgeNotifications = () => {
      if (document.hidden) {
        return;
      }

      pendingConversationIdsRef.current.clear();
      clearNotification();
    };

    window.addEventListener("focus", acknowledgeNotifications);
    document.addEventListener("visibilitychange", acknowledgeNotifications);

    return () => {
      window.removeEventListener("focus", acknowledgeNotifications);
      document.removeEventListener("visibilitychange", acknowledgeNotifications);
    };
  }, [clearNotification]);

  useEffect(() => {
    if (status !== "authenticated" || !currentUserId) {
      return;
    }

    let isCancelled = false;
    let pusherChannel: BrowserPusherChannel | null = null;
    let pusherClient: Awaited<ReturnType<typeof getPusherClient>> = null;

    const handleConversationAlert = (
      message: RealtimeConversationAlertPayload,
    ) => {
      if (message.senderId === currentUserId) {
        return;
      }

      if (pathnameRef.current === getConversationPath(message.conversationId)) {
        return;
      }

      pendingConversationIdsRef.current.add(message.conversationId);
      startTitleNotification();

      const now = Date.now();
      const lastNotificationTime =
        lastNotificationTimeRef.current[message.conversationId] ?? 0;

      if (now - lastNotificationTime <= SOUND_COOLDOWN_MS) {
        return;
      }

      lastNotificationTimeRef.current[message.conversationId] = now;
      playNotificationSound();
    };

    void (async () => {
      pusherClient = await getPusherClient();

      if (!pusherClient || isCancelled) {
        return;
      }

      pusherChannel = pusherClient.subscribe(
        getUserConversationAlertChannelName(currentUserId),
      );
      pusherChannel.bind(
        PUSHER_CONVERSATION_ALERT_EVENT,
        handleConversationAlert,
      );
    })();

    return () => {
      isCancelled = true;

      if (!pusherChannel || !pusherClient) {
        return;
      }

      pusherChannel.unbind(
        PUSHER_CONVERSATION_ALERT_EVENT,
        handleConversationAlert,
      );
      pusherClient.unsubscribe(getUserConversationAlertChannelName(currentUserId));
    };
  }, [currentUserId, playNotificationSound, startTitleNotification, status]);

  return children;
}