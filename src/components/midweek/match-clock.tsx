"use client";

import { matchMinute, type LiveClock } from "@/lib/midweek/live";
import { LiveMarker } from "./chip";
import { useServerTime } from "./use-server-time";

/**
 * `MidweekMatchClock` (DR4-2, ADR-147): the live scoreboard's marker row and
 * its progress line. The minute ticks every second on the corrected clock from
 * public timing only (the kick-off, the schedule, the server's render time),
 * never behind the server's own minute, and holds at 90′ until a poll brings
 * what follows: `pens 2–2` comes only from the server, and full time is a new
 * page. Without `clock` (an old render) it shows the server's minute as it
 * stood. A 3 px line in Live pink runs along the board's bottom edge from 0′
 * to 90′, with a notch at half time; full during a shoot-out. An SVG width,
 * because the CSP forbids inline styles.
 */
export function MidweekMatchClock({
  minute,
  penalties,
  clock = null,
}: {
  minute: number;
  penalties: readonly [number, number] | null;
  clock?: LiveClock | null;
}) {
  const now = useServerTime(clock?.at ?? new Date(0).toISOString(), 1_000);
  const shown = clock
    ? Math.max(minute, matchMinute(clock.kickoffAt, clock.scheduleVersion, now))
    : minute;
  const fill = penalties ? 90 : shown;
  return (
    <>
      <p className="col-span-3 -mt-1 flex justify-center" role="timer">
        <LiveMarker>
          Live &middot; {penalties ? `pens ${penalties[0]}–${penalties[1]}` : `${shown}′`}
        </LiveMarker>
      </p>
      <svg
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 block h-[3px] w-full"
        preserveAspectRatio="none"
        viewBox="0 0 90 3"
      >
        <rect className="fill-line/45" height="3" width="90" />
        <rect className="fill-live" height="3" width={fill} />
        <rect className="fill-board-deep" height="3" width="0.5" x="44.75" />
      </svg>
    </>
  );
}
