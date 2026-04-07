import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { Analytics } from "@/components/analytics";
import { BannedModal } from "@/components/banned-modal";
import { SiteHeader } from "@/components/layout/site-header";
import { AuthSessionProvider } from "@/components/providers/session-provider";
import { SiteFooter } from "@/components/site-footer";
import { getAuthSession } from "@/lib/auth";
import { getSiteUrl } from "@/lib/site-url";
import "./globals.css";

const baseUrl = getSiteUrl();
const globalOgImageUrl =
  "https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=1200&auto=format&fit=crop";
const googleSiteVerification =
  process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION?.trim() || undefined;
const yandexSiteVerification =
  process.env.NEXT_PUBLIC_YANDEX_VERIFICATION?.trim() || undefined;

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: "SafeLoot Market | Безопасная покупка игровых товаров",
  description:
    "Маркетплейс цифровых товаров. Безопасные сделки, Escrow система, защита покупателей и продавцов 24/7.",
  verification:
    googleSiteVerification || yandexSiteVerification
      ? {
          ...(googleSiteVerification
            ? { google: googleSiteVerification }
            : {}),
          ...(yandexSiteVerification
            ? { yandex: yandexSiteVerification }
            : {}),
        }
      : undefined,
  openGraph: {
    type: "website",
    locale: "ru_RU",
    url: `${baseUrl}/`,
    title: "SafeLoot Market - Элитный игровой маркетплейс",
    description:
      "Покупай и продавай аккаунты, валюту и предметы безопасно через Escrow.",
    siteName: "SafeLoot",
    images: [
      {
        url: globalOgImageUrl,
        width: 1200,
        height: 630,
        alt: "SafeLoot Market",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "SafeLoot Market - Элитный игровой маркетплейс",
    description:
      "Покупай и продавай аккаунты, валюту и предметы безопасно через Escrow.",
    images: [globalOgImageUrl],
  },
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
      <body className="min-h-screen flex flex-col">
        <AuthSessionProvider session={session}>
          <SiteHeader />
          <BannedModal />

          <main className="flex-1">{children}</main>
          <SiteFooter />
        </AuthSessionProvider>
        <Analytics />
      </body>
    </html>
  );
}

