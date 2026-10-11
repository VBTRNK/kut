"use client";

import { countdownText } from "@/lib/midweek/entry";
import { useServerTime } from "./use-server-time";

/**
 * "in 1 day, 4 h", ticking every 20 seconds on the corrected clock
 * (`useServerTime`): the first render uses the server's `now`, so the server
 * and the hydrating client print the same text.
 */
export function MidweekCountdown({
  target,
  now,
  className,
}: {
  target: string;
  now: string;
  className?: string;
}) {
  const current = useServerTime(now, 20_000);
  return (
    <span className={className} role="timer">
      {countdownText(new Date(target), new Date(current))}
    </span>
  );
}
