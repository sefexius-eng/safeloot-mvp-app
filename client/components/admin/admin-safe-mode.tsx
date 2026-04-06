"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

const SAFE_MODE_STORAGE_KEY = "safeMode";

export function AdminSafeModeToggle({ className }: { className?: string }) {
  const [isEnabled, setIsEnabled] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    const syncSafeMode = () => {
      try {
        setIsEnabled(window.localStorage.getItem(SAFE_MODE_STORAGE_KEY) === "true");
      } catch {
        setIsEnabled(false);
      } finally {
        setIsHydrated(true);
      }
    };

    syncSafeMode();
    window.addEventListener("safeModeChanged", syncSafeMode);

    return () => {
      window.removeEventListener("safeModeChanged", syncSafeMode);
    };
  }, []);

  const toggleSafeMode = (checked: boolean) => {
    try {
      window.localStorage.setItem(SAFE_MODE_STORAGE_KEY, String(checked));
    } catch {
      return;
    }

    setIsEnabled(checked);
    window.dispatchEvent(new Event("safeModeChanged"));
  };

  return (
    <label
      className={cn(
        "flex cursor-pointer items-center justify-between gap-4 rounded-[1.25rem] border border-white/10 bg-white/5 px-4 py-3 text-left transition hover:bg-white/10",
        className,
      )}
    >
      <div>
        <p className="text-sm font-semibold text-white">Семейный режим (скрыть мат)</p>
        <p className="mt-1 text-xs leading-6 text-zinc-400">
          Нецензурные слова будут размыты до наведения курсора.
        </p>
      </div>

      <span className="relative inline-flex shrink-0 items-center">
        <input
          type="checkbox"
          checked={isEnabled}
          disabled={!isHydrated}
          onChange={(event) => toggleSafeMode(event.target.checked)}
          className="peer sr-only"
          aria-label="Семейный режим"
        />
        <span className="h-7 w-12 rounded-full border border-white/10 bg-zinc-800/90 transition peer-checked:bg-emerald-500/80 peer-disabled:opacity-60" />
        <span className="pointer-events-none absolute left-1 h-5 w-5 rounded-full bg-white shadow-[0_6px_16px_rgba(0,0,0,0.28)] transition peer-checked:translate-x-5" />
      </span>
    </label>
  );
}
