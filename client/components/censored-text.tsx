"use client";

import type { CSSProperties } from "react";
import { useEffect, useState } from "react";

import { containsProfanity } from "@/lib/censorship";
import { cn } from "@/lib/utils";

const SAFE_MODE_STORAGE_KEY = "safeMode";

interface CensoredTextProps {
  text: string | null;
  className?: string;
  style?: CSSProperties;
}

export default function CensoredText({
  text,
  className,
  style,
}: CensoredTextProps) {
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

  const renderPlainText = () => {
    if (!className && !style) {
      return <>{text}</>;
    }

    return (
      <span className={className} style={style}>
        {text}
      </span>
    );
  };

  if (!isSafeMode) {
    return renderPlainText();
  }

  const hasBadWords = containsProfanity(text);

  if (!hasBadWords) {
    return renderPlainText();
  }

  return (
    <span
      className={cn(
        className,
        "cursor-pointer select-none blur-md transition-all hover:blur-none",
      )}
      style={style}
      title="Контент скрыт"
    >
      {text}
    </span>
  );
}