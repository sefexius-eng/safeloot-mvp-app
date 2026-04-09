"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";

import {
  getGlobalPresenceChannelName,
  getPusherClient,
  type BrowserPusherMembers,
  type BrowserPusherPresenceChannel,
} from "@/lib/pusher";

interface RealtimePresenceContextValue {
  onlineUserIds: ReadonlySet<string>;
}

const EMPTY_ONLINE_USERS = new Set<string>();

const RealtimePresenceContext = createContext<RealtimePresenceContextValue>({
  onlineUserIds: EMPTY_ONLINE_USERS,
});

function collectOnlineUserIds(members: BrowserPusherMembers) {
  const onlineUserIds = new Set<string>();

  members.each((member: { id?: string | number | null }) => {
    const memberId = typeof member?.id === "string" ? member.id.trim() : "";

    if (memberId) {
      onlineUserIds.add(memberId);
    }
  });

  return onlineUserIds;
}

export function RealtimePresenceProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session, status } = useSession();
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(EMPTY_ONLINE_USERS);
  const currentUserId = session?.user?.id?.trim() ?? "";

  useEffect(() => {
    if (status !== "authenticated" || !currentUserId) {
      return;
    }

    let isCancelled = false;
    let pusherChannel: BrowserPusherPresenceChannel | null = null;
    let pusherClient: Awaited<ReturnType<typeof getPusherClient>> = null;

    const handleSubscriptionSucceeded = (members: BrowserPusherMembers) => {
      setOnlineUserIds(collectOnlineUserIds(members));
    };

    const handleMemberAdded = (member: { id?: string | number | null }) => {
      const memberId = typeof member?.id === "string" ? member.id.trim() : "";

      if (!memberId) {
        return;
      }

      setOnlineUserIds((currentOnlineUserIds) => {
        if (currentOnlineUserIds.has(memberId)) {
          return currentOnlineUserIds;
        }

        const nextOnlineUserIds = new Set(currentOnlineUserIds);
        nextOnlineUserIds.add(memberId);
        return nextOnlineUserIds;
      });
    };

    const handleMemberRemoved = (member: { id?: string | number | null }) => {
      const memberId = typeof member?.id === "string" ? member.id.trim() : "";

      if (!memberId) {
        return;
      }

      setOnlineUserIds((currentOnlineUserIds) => {
        if (!currentOnlineUserIds.has(memberId)) {
          return currentOnlineUserIds;
        }

        const nextOnlineUserIds = new Set(currentOnlineUserIds);
        nextOnlineUserIds.delete(memberId);
        return nextOnlineUserIds;
      });
    };

    void (async () => {
      pusherClient = await getPusherClient();

      if (!pusherClient || isCancelled) {
        return;
      }

      pusherChannel = pusherClient.subscribe(
        getGlobalPresenceChannelName(),
      ) as BrowserPusherPresenceChannel;
      pusherChannel.bind(
        "pusher:subscription_succeeded",
        handleSubscriptionSucceeded,
      );
      pusherChannel.bind("pusher:member_added", handleMemberAdded);
      pusherChannel.bind("pusher:member_removed", handleMemberRemoved);
    })();

    return () => {
      isCancelled = true;

      if (!pusherChannel || !pusherClient) {
        return;
      }

      pusherChannel.unbind(
        "pusher:subscription_succeeded",
        handleSubscriptionSucceeded,
      );
      pusherChannel.unbind("pusher:member_added", handleMemberAdded);
      pusherChannel.unbind("pusher:member_removed", handleMemberRemoved);
      pusherClient.unsubscribe(getGlobalPresenceChannelName());
    };
  }, [currentUserId, status]);

  const value = useMemo<RealtimePresenceContextValue>(
    () => ({
      onlineUserIds:
        status === "authenticated" && currentUserId
          ? onlineUserIds
          : EMPTY_ONLINE_USERS,
    }),
    [currentUserId, onlineUserIds, status],
  );

  return (
    <RealtimePresenceContext.Provider value={value}>
      {children}
    </RealtimePresenceContext.Provider>
  );
}

export function useRealtimePresence() {
  return useContext(RealtimePresenceContext);
}