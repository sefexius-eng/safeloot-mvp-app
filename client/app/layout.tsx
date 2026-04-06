import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { BannedModal } from "@/components/banned-modal";
import { SiteHeader } from "@/components/layout/site-header";
import { AuthSessionProvider } from "@/components/providers/session-provider";
import { getAuthSession } from "@/lib/auth";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SafeLoot Market",
  description: "Маркетплейс игровых товаров с безопасной сделкой и escrow.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getAuthSession();

  return (
    <html
      lang="ru"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <AuthSessionProvider session={session}>
          <SiteHeader />
          <BannedModal />

          <div className="flex-1">{children}</div>
        </AuthSessionProvider>
      </body>
    </html>
  );
}

