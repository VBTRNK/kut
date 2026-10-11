/**
 * The live evening (MM 2.0 F6, ADR-115; data in ADR-106): which matches are in
 * play, and what a match in play shows at a given moment. Pure and client-safe.
 *
 * Every match unfolds at the same pace (owner decision Q7), and a member can
 * watch any match in play chance by chance (MM 3.0, ADR-147). Nothing here
 * decides a result: the moments, kicks and score come from the stored match's
 * rendered report, revealed by time.
 */

import { MIDWEEK } from "@/game/midweek/config";
import { scheduleFor } from "@/game/midweek/schedule";
import type { ShootoutKick, TimelineItem } from "./report/types";
import type { MatchRow } from "./rows";

/**
 * Withholds the result of every match still in play: goals, penalties and the
 * winner, as ADR-106's view does from its push. Before that push the member
 * view shows whole matches from kick-off, so the page masks them itself from
 * each match's stored end (`ends`, read on the server). A match the view
 * already withholds (no winner) stays in play; a bye never is. With no stored
 * end (a week from before ADR-104) a match shows whole, as it always has.
 */
export function maskInPlay(
  rows: readonly MatchRow[],
  ends: ReadonlyMap<string, string | null>,
  now: Date,
): MatchRow[] {
  return rows.map((row) => {
    if (row.bye) return { ...row, in_play: false };
    const endsAt = row.ends_at ?? ends.get(row.match_id) ?? null;
    const inPlay =
      row.winner_side === null || (endsAt !== null && Date.parse(endsAt) > now.getTime());
    if (!inPlay) return { ...row, in_play: false };
    return {
      ...row,
      side_0_goals: null,
      side_1_goals: null,
      side_0_penalties: null,
      side_1_penalties: null,
      winner_side: null,
      winner_user_id: null,
      in_play: true,
    };
  });
}

/**
 * A match in play on a scoreboard: its minute, or the shoot-out's tally once it
 * has begun. With `clock`, the scoreboard's minute ticks on the client from
 * public timing only (`MidweekMatchClock`, ADR-147).
 */
export type LiveScore = {
  minute: number;
  penalties: readonly [number, number] | null;
  clock?: LiveClock;
};

/** What the running clock may know: the kick-off, the schedule and when the server rendered. */
export type LiveClock = { kickoffAt: string; scheduleVersion: number | null; at: string };

/**
 * The match clock at `nowMs`, 0′ to 90′: kick-off plus the minute's share of
 * the 14 chance slots (ADR-104), held at 90′. It never says what follows 90′:
 * full time and penalties come only from the server (a late end would give a
 * shoot-out away, ADR-106).
 */
export function matchMinute(
  kickoffAt: string,
  scheduleVersion: number | null,
  nowMs: number,
): number {
  const schedule = scheduleFor(scheduleVersion);
  const regulationMs = MIDWEEK.match.chanceSlots * schedule.slotSeconds * 1000;
  if (regulationMs <= 0) return MIDWEEK.match.minutes;
  const elapsed = nowMs - Date.parse(kickoffAt);
  return Math.max(
    0,
    Math.min(MIDWEEK.match.minutes, Math.floor((elapsed * MIDWEEK.match.minutes) / regulationMs)),
  );
}

/** A match in play, as it stands at `now`. */
export type LiveView = {
  /** The running match clock, 0′ to 90′ (HANDOFF "Matches", Q10). */
  minute: number;
  /** Goals so far, side 0 first. */
  score: [number, number];
  /** The moments revealed so far, oldest first (the live feed shows them newest first). */
  timeline: TimelineItem[];
  /** The kicks taken so far, in order; empty before full time. */
  kicks: ShootoutKick[];
  /** Kicks scored so far per side, once the shoot-out has begun. */
  penalties: [number, number] | null;
  /** Past full time and into a shoot-out. */
  shootout: boolean;
};

/**
 * What a member may see of a match in play: the report's moments and kicks up
 * to `now`, each at its stored moment (ADR-104: a chance at kick-off + minute ×
 * 280 s / 90, then a kick every 5 seconds), and the score they add up to. The
 * report is the whole match's, rendered on the server, so a moment reads the
 * same live and at full time; only its time decides whether it shows.
 */
export function liveView(input: {
  timeline: readonly TimelineItem[];
  kicks: readonly ShootoutKick[];
  kickoffAt: string;
  scheduleVersion: number | null;
  now: Date;
}): LiveView {
  const schedule = scheduleFor(input.scheduleVersion);
  const regulationMs = MIDWEEK.match.chanceSlots * schedule.slotSeconds * 1000;
  const kickMs = schedule.kickSeconds * 1000;
  const elapsed = input.now.getTime() - Date.parse(input.kickoffAt);
  const timeline = input.timeline.filter(
    (item) => Math.floor((item.minute * regulationMs) / MIDWEEK.match.minutes) <= elapsed,
  );
  const kicks = input.kicks.filter((_, index) => regulationMs + (index + 1) * kickMs <= elapsed);
  const tally = (side: 0 | 1) =>
    kicks.filter((kick) => kick.side === side && kick.outcome === "goal").length;
  const shootout = input.kicks.length > 0 && elapsed >= regulationMs;
  return {
    minute: matchMinute(input.kickoffAt, input.scheduleVersion, input.now.getTime()),
    score: timeline.at(-1)?.score ?? [0, 0],
    timeline,
    kicks,
    penalties: shootout ? [tally(0), tally(1)] : null,
    shootout,
  };
}
