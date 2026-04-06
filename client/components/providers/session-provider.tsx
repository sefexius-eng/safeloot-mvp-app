"use client";

import type { Session } from "next-auth";
import { SessionProvider } from "next-auth/react";

import { CurrencyProvider } from "@/components/providers/currency-provider";

export function AuthSessionProvider({
  children,
  session,
}: {
  children: React.ReactNode;
  session?: Session | null;
}) {
  return (
    <SessionProvider session={session}>
      <CurrencyProvider>{children}</CurrencyProvider>
    </SessionProvider>
  );
}
