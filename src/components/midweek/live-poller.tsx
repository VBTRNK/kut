"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { POLL_MS, startLivePoll } from "@/lib/midweek/live-clock";

const clockFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Amsterdam",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

/**
 * Keeps a live page current (HANDOFF "Polling", ADR-115, ADR-147): while a
 * match is in play it asks the server for the page again every `intervalMs`
 * (the match page 10 or 5 seconds, the evening and the bracket 20), and
 * otherwise from the next kick-off (`nextAt`, on the corrected clock) until
 * the page has moved on (`startLivePoll`). No Realtime: the server renders
 * what is due, and only that reaches the page. Shows `Updated 20:18:20`
 * quietly, from the server's render time.
 */
export function MidweekLivePoller({
  at,
  poll,
  nextAt = null,
  intervalMs = POLL_MS.evening,
  foot = false,
}: {
  /** When the server rendered the page. */
  at: string;
  poll: boolean;
  nextAt?: string | null;
  intervalMs?: number;
  /** The match page's foot line, which says how often it checks. */
  foot?: boolean;
}) {
  const router = useRouter();
  useEffect(() => {
    const poller = startLivePoll(
      { at, poll, nextAt, intervalMs },
      {
        now: () => Date.now(),
        visible: () => document.visibilityState === "visible",
        refresh: () => router.refresh(),
        every: (run, ms) => {
          const timer = window.setInterval(run, ms);
          return () => window.clearInterval(timer);
        },
        after: (run, ms) => {
          const timer = window.setTimeout(run, ms);
          return () => window.clearTimeout(timer);
        },
      },
    );
    document.addEventListener("visibilitychange", poller.onShow);
    return () => {
      poller.stop();
      document.removeEventListener("visibilitychange", poller.onShow);
    };
  }, [router, poll, nextAt, at, intervalMs]);

  if (!poll && !foot) return null;
  return (
    <p className="text-[11px] font-bold text-ink-faint tabular-nums">
      Updated {clockFormat.format(new Date(at))}
      {foot && poll && ` · checks every ${intervalMs / 1000} seconds`}
    </p>
  );
}
