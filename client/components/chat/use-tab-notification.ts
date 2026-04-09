"use client";

import { useCallback, useEffect, useRef } from "react";

const TAB_NOTIFICATION_TITLE = "💬 Новое сообщение!";
const TAB_NOTIFICATION_INTERVAL_MS = 1000;
const NOTIFICATION_SOUND_PATH = "/sounds/notification.mp3";
const FALLBACK_TONE_DURATION_SECONDS = 0.18;
const FALLBACK_TONE_FREQUENCY = 880;

type AudioContextConstructor = typeof AudioContext;

function resolveAudioContextConstructor() {
  if (typeof window === "undefined") {
    return null;
  }

  return (
    window.AudioContext ??
    (
      window as Window &
        typeof globalThis & {
          webkitAudioContext?: AudioContextConstructor;
        }
    ).webkitAudioContext ??
    null
  );
}

export function useTabNotification() {
  const originalTitleRef = useRef("");
  const intervalIdRef = useRef<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUnavailableRef = useRef(false);
  const audioContextRef = useRef<AudioContext | null>(null);

  const clearNotification = useCallback(() => {
    if (typeof window !== "undefined" && intervalIdRef.current !== null) {
      window.clearInterval(intervalIdRef.current);
      intervalIdRef.current = null;
    }

    if (typeof document !== "undefined") {
      document.title = originalTitleRef.current || document.title;
    }
  }, []);

  const playFallbackTone = useCallback(() => {
    const AudioContextClass = resolveAudioContextConstructor();

    if (!AudioContextClass) {
      return;
    }

    try {
      const audioContext =
        audioContextRef.current ?? new AudioContextClass();

      audioContextRef.current = audioContext;

      if (audioContext.state === "suspended") {
        void audioContext.resume().catch(() => {});
      }

      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      const startTime = audioContext.currentTime;

      oscillator.type = "sine";
      oscillator.frequency.value = FALLBACK_TONE_FREQUENCY;

      gainNode.gain.setValueAtTime(0.0001, startTime);
      gainNode.gain.exponentialRampToValueAtTime(0.06, startTime + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(
        0.0001,
        startTime + FALLBACK_TONE_DURATION_SECONDS,
      );

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.start(startTime);
      oscillator.stop(startTime + FALLBACK_TONE_DURATION_SECONDS);
    } catch {
      return;
    }
  }, []);

  const playNotificationSound = useCallback(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (audioUnavailableRef.current) {
      playFallbackTone();
      return;
    }

    if (!audioRef.current) {
      const audio = new Audio(NOTIFICATION_SOUND_PATH);
      audio.preload = "auto";
      audio.addEventListener("error", () => {
        audioUnavailableRef.current = true;
      });
      audioRef.current = audio;
    }

    try {
      audioRef.current.currentTime = 0;
    } catch {
      playFallbackTone();
      return;
    }

    void audioRef.current.play().catch(() => {
      playFallbackTone();
    });
  }, [playFallbackTone]);

  const triggerNotification = useCallback(() => {
    if (typeof document === "undefined" || typeof window === "undefined") {
      return;
    }

    if (!originalTitleRef.current) {
      originalTitleRef.current = document.title;
    }

    if (!document.hidden) {
      return;
    }

    playNotificationSound();

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
  }, [playNotificationSound]);

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

      if (audioContextRef.current) {
        void audioContextRef.current.close().catch(() => {});
        audioContextRef.current = null;
      }
    };
  }, [clearNotification]);

  return {
    triggerNotification,
    clearNotification,
  };
}