"use client";

import { SessionProvider } from "next-auth/react";

import { CurrencyProvider } from "@/components/providers/currency-provider";

export function AuthSessionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SessionProvider>
      <CurrencyProvider>{children}</CurrencyProvider>
    </SessionProvider>
  );
}
