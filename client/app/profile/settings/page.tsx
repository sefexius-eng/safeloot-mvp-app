import Link from "next/link";
import { redirect } from "next/navigation";

import { ProfileSettingsForm } from "@/components/profile/profile-settings-form";
import { getAuthSession } from "@/lib/auth";
import { USER_APPEARANCE_SELECT } from "@/lib/cosmetics";
import { mergeProfileBadgeIds } from "@/lib/profile-badges";
import { prisma } from "@/lib/prisma";
import { getSellerAutomaticBadgeDataBySellerId } from "@/lib/seller-achievements";

export const dynamic = "force-dynamic";

export default async function ProfileSettingsPage() {
  const session = await getAuthSession();
  const currentUser = session?.user;
  const userId = currentUser?.id?.trim();

  if (!userId || !currentUser) {
    redirect("/login?callbackUrl=/profile/settings");
  }

  const userProfile = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      email: true,
      name: true,
      image: true,
      bannerUrl: true,
      badges: true,
      ...USER_APPEARANCE_SELECT,
      emailNotifications: true,
      pushNotifications: true,
      telegramId: true,
      role: true,
    },
  });

  if (!userProfile) {
    redirect("/login?callbackUrl=/profile/settings");
  }

  const automaticBadgeData = await getSellerAutomaticBadgeDataBySellerId(
    userId,
    userProfile.badges,
  );

  const initialEmail = userProfile.email.trim();
  const initialName = userProfile.name?.trim() || initialEmail.split("@")[0];
  const initialImage = userProfile.image ?? null;
  const initialBannerUrl = userProfile.bannerUrl ?? null;
  const initialBadges = mergeProfileBadgeIds(
    userProfile.badges,
    automaticBadgeData.automaticBadgeIds,
  );
  const initialEmailNotifications = userProfile.emailNotifications;
  const initialPushNotifications = userProfile.pushNotifications;
  const initialTelegramId = userProfile.telegramId?.toString() ?? null;
  const initialRole = userProfile.role;

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
      <section className="relative overflow-hidden rounded-[2.25rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(251,146,60,0.24),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(14,165,233,0.18),transparent_38%),rgba(9,9,11,0.92)] p-7 shadow-[0_24px_80px_rgba(0,0,0,0.28)] md:p-10">
        <p className="text-sm font-semibold tracking-[0.24em] uppercase text-orange-200/80">
          Profile Studio
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white md:text-5xl md:leading-[1.05]">
          Настройки профиля
        </h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-zinc-300 md:text-base">
          Обновите никнейм, аватар и баннер для Steam-подобной шапки профиля. Медиа сжимаются на клиенте и сохраняются в базе как Base64 WebP, а превью обновляется сразу после выбора файла.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/profile"
            className="inline-flex h-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-5 text-sm font-semibold text-zinc-100 transition hover:bg-white/10"
          >
            Вернуться в кабинет
          </Link>
          <div className="inline-flex h-11 items-center rounded-2xl border border-white/10 bg-white/5 px-4 text-sm text-zinc-300">
            Аккаунт: <span className="ml-2 font-semibold text-white">{initialEmail}</span>
          </div>
        </div>
      </section>

      <ProfileSettingsForm
        initialBadges={initialBadges}
        initialBannerUrl={initialBannerUrl}
        initialEmail={initialEmail}
        initialEmailNotifications={initialEmailNotifications}
        initialImage={initialImage}
        initialName={initialName}
        initialActiveColor={userProfile.activeColor ?? null}
        initialActiveDecoration={userProfile.activeDecoration ?? null}
        initialActiveFont={userProfile.activeFont ?? null}
        initialPushNotifications={initialPushNotifications}
        initialTelegramId={initialTelegramId}
        initialRole={initialRole}
      />
    </main>
  );
}