"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

const absurdReasons = [
  "Распространение запрещенных зелий и наркотиков",
  "Главный наркодиллер сервера",
  "Попытка продать душу дьяволу вне эскроу",
  "Организация восстания NPC",
  "Слишком красивый для этого маркетплейса",
  "Контрабанда виртуального оружия",
  "Попытка взломать Пентагон через микроволновку",
];

function getRandomReason() {
  return absurdReasons[Math.floor(Math.random() * absurdReasons.length)] ?? absurdReasons[0];
}

export function BannedModal() {
  const { data: session, status } = useSession();
  const isBanned = Boolean(session?.user?.isBanned);
  const [reason, setReason] = useState(() => absurdReasons[0]);

  useEffect(() => {
    if (!isBanned) {
      return undefined;
    }

    setReason(getRandomReason());

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isBanned]);

  if (status === "loading" || !isBanned) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/90 backdrop-blur-sm">
      <div className="relative flex min-h-full items-center justify-center px-4 py-10 sm:px-6 lg:px-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(239,68,68,0.24),transparent_32%),radial-gradient(circle_at_bottom,rgba(249,115,22,0.18),transparent_28%)]" />

        <div className="relative w-full max-w-3xl overflow-hidden rounded-[2.5rem] border border-red-500/30 bg-[linear-gradient(180deg,rgba(18,18,21,0.98),rgba(36,10,10,0.98))] p-8 text-white shadow-[0_28px_120px_rgba(0,0,0,0.55)] sm:p-10">
          <div className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,rgba(239,68,68,0.2),rgba(248,113,113,0.95),rgba(249,115,22,0.4))]" />

          <div className="flex flex-wrap items-center justify-center gap-3 text-center">
            <span className="rounded-full border border-red-500/25 bg-red-500/12 px-4 py-2 text-xs font-semibold tracking-[0.32em] uppercase text-red-200">
              Системная блокировка
            </span>
            <span className="rounded-full border border-orange-400/20 bg-orange-400/10 px-4 py-2 text-xs font-semibold tracking-[0.24em] uppercase text-orange-100/90">
              Доступ к торговле приостановлен
            </span>
          </div>

          <div className="mt-8 text-center">
            <div className="mx-auto flex h-28 w-28 items-center justify-center rounded-full border border-red-400/25 bg-red-500/12 text-6xl shadow-[0_0_60px_rgba(239,68,68,0.3)]">
              ⛔
            </div>

            <h2 className="mt-6 text-3xl font-black tracking-[0.18em] text-red-100 sm:text-5xl">
              ВЫ ЗАБЛОКИРОВАНЫ
            </h2>

            <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-zinc-300 sm:text-base">
              Маркетплейс временно закрыл для вас публикацию товаров, оплату и любые торговые действия. Апелляционный совет гоблинов уже изучает материалы дела.
            </p>
          </div>

          <div className="mt-8 rounded-[2rem] border border-red-500/20 bg-red-500/10 p-6 text-center">
            <p className="text-xs font-semibold tracking-[0.28em] uppercase text-red-200/80">
              Абсурдная причина блокировки
            </p>
            <p className="mt-4 text-xl font-semibold leading-9 text-white sm:text-2xl">
              {reason}
            </p>
          </div>

          <div className="mt-6 grid gap-3 text-center sm:grid-cols-3">
            <div className="rounded-[1.5rem] border border-white/10 bg-white/5 px-4 py-4">
              <p className="text-xs tracking-[0.2em] uppercase text-zinc-500">Статус</p>
              <p className="mt-2 text-sm font-semibold text-red-200">Доступ запрещен</p>
            </div>
            <div className="rounded-[1.5rem] border border-white/10 bg-white/5 px-4 py-4">
              <p className="text-xs tracking-[0.2em] uppercase text-zinc-500">Эскроу</p>
              <p className="mt-2 text-sm font-semibold text-orange-100">Под наблюдением</p>
            </div>
            <div className="rounded-[1.5rem] border border-white/10 bg-white/5 px-4 py-4">
              <p className="text-xs tracking-[0.2em] uppercase text-zinc-500">Вердикт</p>
              <p className="mt-2 text-sm font-semibold text-zinc-100">Без права закрытия окна</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}