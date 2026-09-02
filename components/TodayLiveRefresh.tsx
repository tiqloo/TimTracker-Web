"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { subscribeToTimeEntryChanges } from "@/lib/application/client";

const REFRESH_INTERVAL_MS = 30_000;
const REALTIME_DEBOUNCE_MS = 250;

export function TodayLiveRefresh() {
  const router = useRouter();

  useEffect(() => {
    let debounceTimer: ReturnType<typeof setTimeout> | undefined;

    const refresh = () => router.refresh();
    const refreshDebounced = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(refresh, REALTIME_DEBOUNCE_MS);
    };
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };

    const unsubscribe = subscribeToTimeEntryChanges(refreshDebounced);
    const interval = window.setInterval(refresh, REFRESH_INTERVAL_MS);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    window.addEventListener("focus", refresh);

    return () => {
      unsubscribe();
      window.clearInterval(interval);
      if (debounceTimer) clearTimeout(debounceTimer);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
      window.removeEventListener("focus", refresh);
    };
  }, [router]);

  return null;
}

