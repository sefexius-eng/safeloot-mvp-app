"use client";

import { useEffect, useState } from "react";

import { BANNED_WORDS } from "@/lib/censorship";

const SAFE_MODE_STORAGE_KEY = "safeMode";

export default function CensoredText({ text }: { text: string | null }) {
  const [isSafeMode, setIsSafeMode] = useState(false);

  useEffect(() => {
    const checkMode = () => {
      try {
        setIsSafeMode(window.localStorage.getItem(SAFE_MODE_STORAGE_KEY) === "true");
      } catch {
        setIsSafeMode(false);
      }
    };

    checkMode();
    window.addEventListener("safeModeChanged", checkMode);

    return () => {
      window.removeEventListener("safeModeChanged", checkMode);
    };
  }, []);

  if (!text) {
    return null;
  }

  if (!isSafeMode) {
    return <>{text}</>;
  }

  const normalizedText = text.toLowerCase();
  const hasBadWords = BANNED_WORDS.some((word) =>
    normalizedText.includes(word.toLowerCase()),
  );

  if (!hasBadWords) {
    return <>{text}</>;
  }

  return (
    <span
      className="cursor-pointer select-none blur-md transition-all hover:blur-none"
      title="Контент скрыт"
    >
      {text}
    </span>
  );
}