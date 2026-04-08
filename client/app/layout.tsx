import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";

import { Analytics as ExternalAnalytics } from "@/components/analytics";
import { BannedModal } from "@/components/banned-modal";
import { EmailVerificationBanner } from "@/components/layout/email-verification-banner";
import { SiteHeader } from "@/components/layout/site-header";
import { AuthSessionProvider } from "@/components/providers/session-provider";
import { SiteFooter } from "@/components/site-footer";
import { getAuthSession } from "@/lib/auth";
import { getSiteUrl } from "@/lib/site-url";
import "./globals.css";

const baseUrl = getSiteUrl();
const globalOgImageUrl = "/og-image.png";
const googleSiteVerification =
  process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION?.trim() || undefined;
const yandexSiteVerification =
  process.env.NEXT_PUBLIC_YANDEX_VERIFICATION?.trim() || undefined;
const EMAIL_VERIFICATION_ADMIN_EMAIL = "sefexius@gmail.com";
const APP_NAME = "SafeLoot Market";
const APP_SHORT_NAME = "SafeLoot";
const PWA_BACKGROUND_COLOR = "#09090b";
const PWA_THEME_COLOR = "#00B85C";

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
  applicationName: APP_NAME,
  manifest: "/manifest.json",
  title: "SafeLoot Market | Безопасная покупка игровых товаров",
  description:
    "Маркетплейс цифровых товаров. Безопасные сделки, Escrow система, защита покупателей и продавцов 24/7.",
  icons: {
    icon: [
      {
        url: "/icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        url: "/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
    apple: [
      {
        url: "/icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: APP_SHORT_NAME,
  },
  formatDetection: {
    telephone: false,
  },
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
        alt: "SafeLoot Market Preview",
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

export const viewport: Viewport = {
  themeColor: PWA_THEME_COLOR,
  colorScheme: "dark",
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
          {session?.user &&
          !session.user.emailVerified &&
          session.user.email === EMAIL_VERIFICATION_ADMIN_EMAIL ? (
            <EmailVerificationBanner email={session.user.email ?? ""} />
          ) : null}
          <BannedModal />

          <main className="flex-1">{children}</main>
          <SiteFooter />
        </AuthSessionProvider>
        <ExternalAnalytics />
        <Analytics />
      </body>
    </html>
  );
}

