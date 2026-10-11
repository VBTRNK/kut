import { describe, expect, it } from "vitest";
import type { Side } from "@/game/midweek/match";
import type { SimulatedTournament } from "@/game/midweek/tournament";
import { roundShort } from "@/lib/midweek/evening";
import { latestMatchRatings, nightRatings, playedMatches } from "@/lib/midweek/night-ratings";
import { reportInput } from "@/lib/midweek/report/from-engine";
import { matchRatings, rateNight } from "@/lib/midweek/report/ratings";
import type { MatchRow } from "@/lib/midweek/rows";
import {
  directory,
  entryRows,
  eventRows,
  matchRow,
  simulated,
} from "../support/midweek-stored-rows";

/**
 * The ratings block's data (DR3 HANDOFF §1, ADR-117): a member's five from the
 * stored rows, rated as `rateNight` rates the engine's own run, best first,
 * with a chip per match and nothing for a bye.
 */

function stored(result: SimulatedTournament): MatchRow[] {
  const byes = result.byes.map((bye): MatchRow => ({
    ...matchRow(result.matches[0]),
    match_id: `bye-${bye.pairing}`,
    round: 1,
    pairing: bye.pairing,
    bye: true,
    side_0_user_id: bye.userId,
    side_0_name: directory.manager(bye.userId),
    side_1_user_id: null,
    side_1_name: null,
    side_0_goals: null,
    side_1_goals: null,
    winner_side: 0,
    winner_user_id: bye.userId,
  }));
  return [...byes, ...result.matches.map(matchRow)];
}

const withBye = simulated.find((t) => t.result.byes.length > 0)!;

function rate(t: (typeof simulated)[number], userId: string) {
  const { seedHash, result } = t;
  return nightRatings({
    seedHash,
    userId,
    rounds: result.rounds,
    weekStart: "2026-10-05",
    matches: stored(result),
    events: result.matches.flatMap(eventRows),
    entries: entryRows(result, true),
    photoUrls: new Map(),
  });
}

describe("a member's night ratings from stored rows", () => {
  it("rates every entrant's five as rateNight rates the engine's run", () => {
    for (const t of simulated) {
      const { seedHash, result } = t;
      for (const entry of result.entries) {
        const view = rate(t, entry.userId);
        const played = result.matches
          .filter((m) => m.userIds.includes(entry.userId))
          .sort((a, b) => a.round - b.round);
        if (played.length === 0) {
          expect(view, t.name).toBeNull();
          continue;
        }
        const expected = rateNight({
          seedHash,
          userId: entry.userId,
          matches: played.map((m) => ({
            input: reportInput(result, m, seedHash, directory),
            side: m.userIds.indexOf(entry.userId) as Side,
          })),
        });
        expect(view!.matchCount).toBe(played.length);
        expect(view!.manager).toBe(directory.manager(entry.userId));
        for (const card of expected) {
          const shown = view!.cards.find((c) => c.slot === card.slot)!;
          expect(shown.rating).toBe(card.rating);
          expect(shown.line).toBe(card.line);
          expect(shown.matches.map((m) => m.rating)).toEqual(card.matchRatings);
        }
      }
    }
  });

  it("lists the five best first, ties in slot order, with one best chip and none for the lowest", () => {
    for (const t of simulated) {
      for (const entry of t.result.entries) {
        const view = rate(t, entry.userId);
        if (!view) continue;
        const ratings = view.cards.map((card) => card.rating);
        expect(ratings).toEqual([...ratings].sort((a, b) => b - a));
        for (let i = 1; i < view.cards.length; i += 1) {
          if (view.cards[i].rating === view.cards[i - 1].rating) {
            expect(view.cards[i].slot).toBeGreaterThan(view.cards[i - 1].slot);
          }
        }
        expect(view.cards.filter((card) => card.best).map((card) => card.slot)).toEqual([
          view.cards[0].slot,
        ]);
      }
    }
  });

  it("gives a chip per match, never one for a bye, each linking to its report", () => {
    const { result } = withBye;
    const byeUser = result.byes[0].userId;
    const view = rate(withBye, byeUser)!;
    const played = playedMatches(stored(result), byeUser);
    expect(played.every(({ match }) => !match.bye)).toBe(true);
    expect(view.matchCount).toBe(played.length);
    for (const card of view.cards) {
      expect(card.matches).toHaveLength(played.length);
      card.matches.forEach((chip, index) => {
        const { match, side } = played[index];
        const opponent = side === 0 ? match.side_1_name : match.side_0_name;
        expect(chip.label).toBe(`${roundShort(match.round, result.rounds)} v ${opponent}`);
        expect(chip.href).toBe(`/midweek/2026-10-05/match/${match.match_id}`);
      });
    }
  });

  it("puts the same per-match number on the chip as the report's Why list", () => {
    const { result } = withBye;
    const match = result.matches[0];
    const userId = match.userIds[1];
    const view = rate(withBye, userId)!;
    const inReport = matchRatings(reportInput(result, match, withBye.seedHash, directory))[1];
    for (const card of view.cards) {
      const chip = card.matches.find((m) => m.href.endsWith(`m${match.round}-${match.pairing}`))!;
      expect(chip.rating).toBe(inReport[card.slot].rating);
    }
  });

  it("names a trialist as the manager's and gives it no card face", () => {
    const t = simulated.find((s) => s.result.entries.some((e) => e.cards.some((c) => c.trialist)))!;
    const entry = t.result.entries.find((e) => e.cards.some((c) => c.trialist))!;
    const view = rate(t, entry.userId);
    if (!view) return;
    const trialist = view.cards.find((card) => card.name.endsWith("trialist"))!;
    expect(trialist.face).toBeNull();
    expect(trialist.mini).toBeNull();
    expect(trialist.meta).toMatch(/· Common/);
  });

  it("is null for a member who wasn't entered", () => {
    expect(rate(simulated[0], "not-entered")).toBeNull();
  });
});

/**
 * One match's ratings from its full time (DR4-8, ADR-150): the member's latest
 * finished match, from that match's rows alone, best first, no night lines.
 */
describe("a member's ratings for their latest finished match", () => {
  const latest = (t: (typeof simulated)[number], userId: string, rows = stored(t.result)) =>
    latestMatchRatings({
      seedHash: t.seedHash,
      userId,
      rounds: t.result.rounds,
      weekStart: "2026-10-05",
      matches: rows,
      events: t.result.matches.flatMap(eventRows),
      entries: entryRows(t.result, true),
    });

  it("rates the last match played, as matchRatings rates it, best first", () => {
    for (const t of simulated) {
      for (const entry of t.result.entries) {
        const view = latest(t, entry.userId);
        const played = t.result.matches
          .filter((m) => m.userIds.includes(entry.userId))
          .sort((a, b) => a.round - b.round);
        if (played.length === 0) {
          expect(view, t.name).toBeNull();
          continue;
        }
        const match = played.at(-1)!;
        const side = match.userIds.indexOf(entry.userId) as Side;
        const expected = matchRatings(reportInput(t.result, match, t.seedHash, directory))[side];
        expect(view!.cards).toHaveLength(expected.length);
        for (const card of view!.cards) expect(card.rating).toBe(expected[card.slot].rating);
        const ratings = view!.cards.map((card) => card.rating);
        expect(ratings).toEqual([...ratings].sort((a, b) => b - a));
        expect(view!.href).toBe(`/midweek/2026-10-05/match/${matchRow(match).match_id}`);
        expect(view!.opponent).toBe(directory.manager(match.userIds[side === 0 ? 1 : 0]));
        expect(view!.round).not.toMatch(/finals$/);
      }
    }
  });

  it("shows the match just ended, and not the next one while it plays", () => {
    const t = simulated.find(
      (x) => x.result.rounds > 1 && x.result.matches.some((m) => m.round === 2),
    )!;
    const next = t.result.matches.find((m) => m.round === 2)!;
    const [first] = next.userIds;
    // Round 2 still in play: masked rows carry no winner, so round 1 is the latest.
    const rows = stored(t.result).map((row) =>
      row.round === 2 ? { ...row, winner_side: null, winner_user_id: null } : row,
    );
    const view = latest(t, first, rows);
    const round1 = t.result.matches.find((m) => m.round === 1 && m.userIds.includes(first));
    if (round1) {
      expect(view!.href).toContain(matchRow(round1).match_id);
    } else {
      expect(view).toBeNull();
    }
    // Once round 2 has ended, it takes over.
    expect(latest(t, first)!.href).toContain(matchRow(next).match_id);
  });

  it("has no night lines or best chip, only what one match gives", () => {
    const t = simulated[0];
    const view = latest(t, t.result.entries[0].userId);
    for (const card of view?.cards ?? []) {
      expect(Object.keys(card).sort()).toEqual(["mini", "meta", "name", "rating", "slot"].sort());
    }
  });
});
