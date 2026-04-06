"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

import { containsProfanity } from "@/lib/censorship";
import { isTeamRole } from "@/lib/roles";

const SAFE_MODE_STORAGE_KEY = "safeMode";

export default function CensoredText({ text }: { text: string | null }) {
  const { data: session } = useSession();
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

  if (isTeamRole(session?.user?.role)) {
    return <>{text}</>;
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