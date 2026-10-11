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
