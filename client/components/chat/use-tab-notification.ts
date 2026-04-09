"use client";

import { useCallback, useEffect, useRef } from "react";

const TAB_NOTIFICATION_TITLE = "💬 Новое сообщение!";
const TAB_NOTIFICATION_INTERVAL_MS = 1000;

export function useTabNotification() {
  const originalTitleRef = useRef("");
  const intervalIdRef = useRef<number | null>(null);

  const captureOriginalTitle = useCallback(() => {
    if (typeof document === "undefined") {
      return;
    }

    if (!originalTitleRef.current) {
      originalTitleRef.current = document.title;
    }
  }, []);

  const clearNotification = useCallback(() => {
    if (typeof window !== "undefined" && intervalIdRef.current !== null) {
      window.clearInterval(intervalIdRef.current);
      intervalIdRef.current = null;
    }

    if (typeof document !== "undefined") {
      document.title = originalTitleRef.current || document.title;
    }
  }, []);

  const playNotificationSound = useCallback(() => {
    if (typeof document === "undefined") {
      return;
    }

    const audioEl = document.getElementById("notification-sound") as HTMLAudioElement | null;

    if (!audioEl) {
      return;
    }

    audioEl.currentTime = 0;
    void audioEl.play().catch((err) => {
      console.warn("Audio blocked by browser:", err);
    });
  }, []);

  const startTitleNotification = useCallback(() => {
    if (typeof document === "undefined" || typeof window === "undefined") {
      return;
    }

    captureOriginalTitle();

    if (intervalIdRef.current !== null) {
      return;
    }

    let showNotificationTitle = true;

    intervalIdRef.current = window.setInterval(() => {
      document.title = showNotificationTitle
        ? TAB_NOTIFICATION_TITLE
        : originalTitleRef.current;
      showNotificationTitle = !showNotificationTitle;
    }, TAB_NOTIFICATION_INTERVAL_MS);
  }, [captureOriginalTitle]);

  const triggerNotification = useCallback(() => {
    if (typeof document === "undefined" || typeof window === "undefined") {
      return;
    }

    captureOriginalTitle();

    if (!document.hidden) {
      return;
    }

    playNotificationSound();

    startTitleNotification();
  }, [captureOriginalTitle, playNotificationSound, startTitleNotification]);

  useEffect(() => {
    if (typeof document === "undefined" || typeof window === "undefined") {
      return;
    }

    originalTitleRef.current = document.title;

    const handleWindowReturn = () => {
      if (document.hidden) {
        return;
      }

      clearNotification();
      originalTitleRef.current = document.title;
    };

    window.addEventListener("focus", handleWindowReturn);
    document.addEventListener("visibilitychange", handleWindowReturn);

    return () => {
      window.removeEventListener("focus", handleWindowReturn);
      document.removeEventListener("visibilitychange", handleWindowReturn);
      clearNotification();
    };
  }, [clearNotification]);

  return {
    triggerNotification,
    clearNotification,
    playNotificationSound,
    startTitleNotification,
  };
}