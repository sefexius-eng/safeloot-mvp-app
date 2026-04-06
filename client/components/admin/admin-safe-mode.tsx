"use client";

import type { ReactNode } from "react";
import { createContext, useContext, useEffect, useState } from "react";

import { applyCensorship } from "@/lib/censorship";
import { cn } from "@/lib/utils";

const ADMIN_SAFE_MODE_STORAGE_KEY = "safeloot:admin-safe-mode";

interface AdminSafeModeContextValue {
  isEnabled: boolean;
  isHydrated: boolean;
  setIsEnabled: (value: boolean) => void;
}

const AdminSafeModeContext = createContext<AdminSafeModeContextValue | null>(null);

function useAdminSafeMode() {
  const context = useContext(AdminSafeModeContext);

  if (!context) {
    throw new Error("AdminSafeMode components must be used inside AdminSafeModeProvider.");
  }

  return context;
}

export function AdminSafeModeProvider({ children }: { children: ReactNode }) {
  const [isEnabled, setIsEnabled] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    try {
      const storedValue = window.localStorage.getItem(ADMIN_SAFE_MODE_STORAGE_KEY);

      if (storedValue !== null) {
        setIsEnabled(storedValue === "true");
      }
    } catch {
      return;
    } finally {
      setIsHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    try {
      window.localStorage.setItem(
        ADMIN_SAFE_MODE_STORAGE_KEY,
        String(isEnabled),
      );
    } catch {
      return;
    }
  }, [isEnabled, isHydrated]);

  return (
    <AdminSafeModeContext.Provider
      value={{
        isEnabled,
        isHydrated,
        setIsEnabled,
      }}
    >
      {children}
    </AdminSafeModeContext.Provider>
  );
}

export function AdminSafeModeToggle({ className }: { className?: string }) {
  const { isEnabled, isHydrated, setIsEnabled } = useAdminSafeMode();

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
          onChange={(event) => setIsEnabled(event.target.checked)}
          className="peer sr-only"
          aria-label="Семейный режим"
        />
        <span className="h-7 w-12 rounded-full border border-white/10 bg-zinc-800/90 transition peer-checked:bg-emerald-500/80 peer-disabled:opacity-60" />
        <span className="pointer-events-none absolute left-1 h-5 w-5 rounded-full bg-white shadow-[0_6px_16px_rgba(0,0,0,0.28)] transition peer-checked:translate-x-5" />
      </span>
    </label>
  );
}

export function AdminCensoredText({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const { isEnabled } = useAdminSafeMode();
  const parts = applyCensorship(text, isEnabled);

  if (parts.length === 0) {
    return null;
  }

  return (
    <span className={className}>
      {parts.map((part, index) =>
        part.isCensored ? (
          <span
            key={`${part.value}-${index}`}
            className="blur-sm transition-all hover:blur-none"
          >
            {part.value}
          </span>
        ) : (
          <span key={`${part.value}-${index}`}>{part.value}</span>
        ),
      )}
    </span>
  );
}