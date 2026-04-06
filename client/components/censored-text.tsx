"use client";

import { useEffect, useState } from "react";

import { containsProfanity } from "@/lib/censorship";

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

  const hasBadWords = containsProfanity(text);

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