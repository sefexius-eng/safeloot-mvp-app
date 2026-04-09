"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";

import { updateLastSeen } from "@/app/actions/activity";

const LAST_SEEN_UPDATE_INTERVAL_MS = 3 * 60 * 1000;

export function ActivityTracker() {
  const { data: session, status } = useSession();
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    function stopHeartbeat() {
      if (intervalRef.current === null) {
        return;
      }

      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (status !== "authenticated" || !session?.user?.id) {
      stopHeartbeat();
      return undefined;
    }

    async function pingLastSeen() {
      if (document.visibilityState !== "visible") {
        return;
      }

      try {
        await updateLastSeen();
      } catch {
        // Silent heartbeat; transient failures should not affect UI.
      }
    }

    function startHeartbeat() {
      if (intervalRef.current !== null) {
        return;
      }

      void pingLastSeen();
      intervalRef.current = window.setInterval(() => {
        void pingLastSeen();
      }, LAST_SEEN_UPDATE_INTERVAL_MS);
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        startHeartbeat();
        return;
      }

      stopHeartbeat();
    }

    handleVisibilityChange();
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      stopHeartbeat();
    };
  }, [session?.user?.id, status]);

  return null;
}