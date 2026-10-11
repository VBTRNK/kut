"use client";

import { useEffect, useState } from "react";
import { clockOffsetMs, correctedNowMs } from "@/lib/midweek/live-clock";

/**
 * The server's clock on the device, ticking every `everyMs` (ADR-147): the
 * first render uses the server's render time `at`, so the server and the
 * hydrating client print the same; after that the device clock, corrected by
 * its offset from `at` when the render arrived.
 */
export function useServerTime(at: string, everyMs: number): number {
  const [now, setNow] = useState(() => Date.parse(at));
  useEffect(() => {
    const offset = clockOffsetMs(at, Date.now());
    const tick = () => setNow(correctedNowMs(offset, Date.now()));
    const first = window.setTimeout(tick, 0);
    const timer = window.setInterval(tick, everyMs);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
    };
  }, [at, everyMs]);
  return now;
}

/**
 * Whether `target` has passed on the corrected clock (ADR-149): a timer from
 * the server's render time `at`, which is where the corrected clock stands
 * when the render arrives. False on the first render, as on the server; null
 * `at` never fires.
 */
export function useReached(target: string, at: string | null): boolean {
  const [reached, setReached] = useState(false);
  useEffect(() => {
    if (at === null) return;
    const wait = Date.parse(target) - Date.parse(at);
    // setTimeout overflows past 2^31 − 1 ms (about 24 days) and fires at once.
    if (wait >= 2 ** 31 - 1) return;
    const timer = window.setTimeout(() => setReached(true), Math.max(0, wait));
    return () => window.clearTimeout(timer);
  }, [target, at]);
  return reached;
}
