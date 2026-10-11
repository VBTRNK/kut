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
import type { EventRow, MatchRow } from "./rows";

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

/** "39th", "1st", "22nd": the minute as screen readers hear it. */
export function ordinal(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
}

/** What a row needs of a match's events: a member read, each row from its own moment. */
export type RowEvent = Pick<EventRow, "match_id" | "kind" | "side" | "outcome">;

/**
 * A match in play as its row shows it (DR4-6, ADR-148): the goals so far, the
 * kicks scored once its shoot-out has a kick to show, and the minute from the
 * kick-off. Counted from `midweek_events_public`, which shows each event only
 * from its own moment (ADR-106), so no report is rendered and nothing is read
 * with the service role. A goal is a chance scored: a penalty kick shares the
 * outcome but counts only in the shoot-out, and the settling draw is a `toss`.
 */
export type RowLive = {
  goals: [number, number];
  /** Kicks scored per side, from the shoot-out's first kick; null before it. */
  penalties: [number, number] | null;
  minute: number;
  clock: LiveClock;
};

export function rowLive(input: {
  match: Pick<MatchRow, "match_id" | "reveal_at">;
  events: readonly RowEvent[];
  scheduleVersion: number | null;
  now: Date;
}): RowLive {
  const goals: [number, number] = [0, 0];
  const kicks: [number, number] = [0, 0];
  let shootout = false;
  for (const event of input.events) {
    if (event.match_id !== input.match.match_id) continue;
    if (event.kind === "chance" && event.outcome === "goal") goals[event.side] += 1;
    if (event.kind === "penalty") {
      shootout = true;
      if (event.outcome === "goal") kicks[event.side] += 1;
    }
  }
  const at = input.now.toISOString();
  return {
    goals,
    penalties: shootout ? kicks : null,
    minute: matchMinute(input.match.reveal_at, input.scheduleVersion, input.now.getTime()),
    clock: { kickoffAt: input.match.reveal_at, scheduleVersion: input.scheduleVersion, at },
  };
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
