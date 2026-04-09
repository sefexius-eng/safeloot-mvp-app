"use client";

import type { Session } from "next-auth";
import { SessionProvider } from "next-auth/react";

import { ChatMessageNotificationProvider } from "@/components/providers/chat-message-notification-provider";
import { CurrencyProvider } from "@/components/providers/currency-provider";
import { RealtimePresenceProvider } from "@/components/providers/realtime-presence-provider";

export function AuthSessionProvider({
  children,
  session,
}: {
  children: React.ReactNode;
  session?: Session | null;
}) {
  return (
    <SessionProvider session={session}>
      <CurrencyProvider>
        <RealtimePresenceProvider>
          <ChatMessageNotificationProvider>{children}</ChatMessageNotificationProvider>
        </RealtimePresenceProvider>
      </CurrencyProvider>
    </SessionProvider>
  );
}
