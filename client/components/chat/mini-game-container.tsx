"use client";

import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { ConversationGameType } from "@/lib/pusher";

interface MiniGameContainerProps {
  game: ConversationGameType;
  sessionId: string;
  hostName: string;
  onClose: () => void;
}

function getMiniGameTitle(game: ConversationGameType) {
  switch (game) {
    case "crocodile":
      return "Крокодил";
  }
}

export function MiniGameContainer({
  game,
  sessionId,
  hostName,
  onClose,
}: MiniGameContainerProps) {
  const title = getMiniGameTitle(game);

  return (
    <div className="absolute inset-4 z-50 flex flex-col overflow-hidden rounded-xl border border-white/10 bg-gray-900/95 shadow-2xl backdrop-blur-xl">
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-500">
            Мини-игра в чате
          </p>
          <h2 className="mt-1 text-xl font-semibold text-white">{title}</h2>
        </div>

        <Button
          variant="ghost"
          onClick={onClose}
          className="gap-2 rounded-xl border border-white/10 bg-white/5 px-4 text-zinc-100 hover:bg-white/10"
        >
          <X className="h-4 w-4" />
          <span>Закрыть</span>
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
          <div className="rounded-[1.5rem] border border-emerald-400/20 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.22),transparent_55%),linear-gradient(180deg,rgba(17,24,39,0.98),rgba(3,7,18,0.98))] p-6 shadow-[0_24px_70px_rgba(0,0,0,0.38)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-200/80">
                  Раунд активен
                </p>
                <h3 className="mt-2 text-3xl font-semibold text-white">Показывайте, а не называйте</h3>
              </div>
              <div className="rounded-2xl border border-emerald-300/20 bg-emerald-400/10 px-4 py-2 text-right">
                <p className="text-[11px] uppercase tracking-[0.18em] text-emerald-100/70">
                  Сессия
                </p>
                <p className="mt-1 font-mono text-sm text-emerald-50">{sessionId.slice(0, 8).toUpperCase()}</p>
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div className="rounded-[1.25rem] border border-white/10 bg-black/20 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                  Ведущий
                </p>
                <p className="mt-2 text-lg font-semibold text-white">{hostName}</p>
                <p className="mt-3 text-sm leading-6 text-zinc-300">
                  Объясняйте слово жестами, намёками и эмоциями. Прямое произношение слова или однокоренных слов запрещено.
                </p>
              </div>

              <div className="rounded-[1.25rem] border border-white/10 bg-black/20 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                  Как играть
                </p>
                <div className="mt-3 space-y-3 text-sm leading-6 text-zinc-300">
                  <p>1. Один участник показывает слово без произнесения.</p>
                  <p>2. Второй отгадывает прямо в этом чате.</p>
                  <p>3. Когда захотите вернуться к переписке, просто сверните окно.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-[1.35rem] border border-white/10 bg-white/5 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                Подсказка
              </p>
              <p className="mt-3 text-sm leading-7 text-zinc-200">
                Используйте чат для догадок и коротких реакций, а само окно игры держите как быстрый режим поверх диалога.
              </p>
            </div>

            <div className="rounded-[1.35rem] border border-sky-400/15 bg-sky-500/10 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-100/70">
                Синхронизация
              </p>
              <p className="mt-3 text-sm leading-7 text-sky-50/90">
                Окно открывается у обоих участников автоматически, как только приглашение принято.
              </p>
            </div>

            <div className="rounded-[1.35rem] border border-orange-400/15 bg-orange-500/10 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-orange-100/70">
                Быстрый совет
              </p>
              <p className="mt-3 text-sm leading-7 text-orange-50/90">
                Начните с простых предметов или эмоций, чтобы быстро разогреть раунд и не зависнуть на первом слове.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}