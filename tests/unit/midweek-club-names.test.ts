import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MidweekMatchRow } from "@/components/midweek/match-row";
import { callCards } from "@/lib/midweek/calls";
import { championClub, type MidweekTournament } from "@/lib/midweek/entry";
import {
  assembleBracket,
  finalLine,
  matchSentence,
  myNight,
  pairSentence,
  pastWeeks,
  winnerName,
} from "@/lib/midweek/evening";
import { posterTiles, nightTiles } from "@/lib/midweek/share";
import { reportInputFromRows, renderStoredReport } from "@/lib/midweek/report/from-db";
import { clubName, sideClub, type DrawRow, type MatchRow } from "@/lib/midweek/rows";
import { entryRows, eventRows, matchRow, simulated } from "../support/midweek-stored-rows";

/**
 * Club names on the pages (#262, ADR-151): the club where the team plays, wins
 * or goes through, the account where the member acts (Q7), and the account
 * everywhere while the view lacks the club columns (ADR-145).
 */

const LOCK = "2026-10-14T17:55:00.000Z";

const match = (pairing: number, extra: Partial<MatchRow> = {}): MatchRow => ({
  match_id: `m${pairing}`,
  tournament_id: "t",
  week_start: "2026-10-12",
  round: 1,
  pairing,
  bye: false,
  side_0_user_id: `a${pairing}`,
  side_0_name: `Sanne${pairing}`,
  side_0_club: `Saints ${pairing}`,
  side_1_user_id: `b${pairing}`,
  side_1_name: `Eline${pairing}`,
  side_1_club: `Elinewijk ${pairing}`,
  side_0_goals: 2,
  side_1_goals: 1,
  side_0_penalties: null,
  side_1_penalties: null,
  winner_side: 0,
  winner_user_id: `a${pairing}`,
  win_chance_ppm: 500_000,
  side_0_day_rolls_ppm: [],
  side_1_day_rolls_ppm: [],
  reveal_at: "2026-10-14T18:00:00.000Z",
  ...extra,
});

describe("clubName and sideClub", () => {
  it("take the club when there is one, else the account", () => {
    expect(clubName("Saints", "Sanne")).toBe("Saints");
    expect(clubName("  Saints ", "Sanne")).toBe("Saints");
    expect(clubName(null, "Sanne")).toBe("Sanne");
    expect(clubName(undefined, "Sanne")).toBe("Sanne");
    expect(clubName("   ", "Sanne")).toBe("Sanne");
  });

  it("reads a side of a row with and without the columns", () => {
    const withClubs = match(0);
    const { side_0_club, side_1_club, ...without } = withClubs;
    expect([side_0_club, side_1_club]).toEqual(["Saints 0", "Elinewijk 0"]);
    expect([sideClub(withClubs, 0), sideClub(withClubs, 1)]).toEqual(["Saints 0", "Elinewijk 0"]);
    expect([sideClub(without, 0), sideClub(without, 1)]).toEqual(["Sanne0", "Eline0"]);
    // A bye has no second side.
    expect(sideClub({ ...without, side_1_name: null }, 1)).toBe("");
  });
});

describe("the bracket names clubs, the calls name accounts", () => {
  const bracket = (matches: MatchRow[]) =>
    assembleBracket({
      rounds: 2,
      lockAt: LOCK,
      scheduleVersion: 2,
      matches,
      autoUserIds: new Set(),
    });

  it("names each slot by club, with the account kept for the calls, and the sentences by club", () => {
    const [round1, round2] = bracket([match(0), match(1, { winner_side: 1 })]);
    expect(round1.pairs[0].sides.map((side) => side.name)).toEqual(["Saints 0", "Elinewijk 0"]);
    expect(round1.pairs[0].sides.map((side) => side.account)).toEqual(["Sanne0", "Eline0"]);
    // The winners go through under their club.
    const final = round2.pairs[0];
    expect(final.kind).toBe("upcoming");
    expect(final.sides.map((side) => side.name)).toEqual(["Saints 0", "Elinewijk 1"]);
    expect(final.sides.map((side) => side.account)).toEqual(["Sanne0", "Eline1"]);
    expect(pairSentence(round1.pairs[0])).toBe("Saints 0 2, Elinewijk 0 1. Saints 0 won.");
    expect(matchSentence(match(1, { winner_side: 1 }))).toBe(
      "Saints 1 2, Elinewijk 1 1. Elinewijk 1 won.",
    );
    expect(winnerName(match(1, { winner_side: 1 }))).toBe("Eline1");
  });

  it("falls back to the account name on a row without the columns", () => {
    const bare = (extra: Partial<MatchRow> = {}) => {
      const { side_0_club, side_1_club, ...row } = match(0, extra);
      return {
        ...row,
        side_0_club: undefined,
        side_1_club: undefined,
        _: [side_0_club, side_1_club],
      };
    };
    const [{ pairs }] = bracket([bare()]);
    expect(pairs[0].sides.map((side) => side.name)).toEqual(["Sanne0", "Eline0"]);
    expect(pairSentence(pairs[0])).toBe("Sanne0 2, Eline0 1. Sanne0 won.");
  });

  it("names a placeholder by club in the bracket and by account for a call", () => {
    const draw = [0, 1].map((pairing): DrawRow => {
      const {
        match_id,
        tournament_id,
        week_start,
        bye,
        side_0_user_id,
        side_0_name,
        side_0_club,
        side_1_user_id,
        side_1_name,
        side_1_club,
      } = match(pairing);
      return {
        match_id,
        tournament_id,
        week_start,
        pairing,
        bye,
        side_0_user_id,
        side_0_name,
        side_0_club,
        side_1_user_id,
        side_1_name,
        side_1_club,
        kickoff_at: LOCK,
      };
    });
    const rounds = assembleBracket({
      rounds: 2,
      lockAt: LOCK,
      scheduleVersion: 2,
      draw,
      matches: [],
      autoUserIds: new Set(),
    });
    const [first] = rounds[1].pairs[0].sides;
    expect(first).toMatchObject({
      placeholder: true,
      name: "Winner of Saints 0 v Elinewijk 0",
      account: "Winner of Sanne0 v Eline0",
    });
  });

  it("puts the account in a call card, never the club", () => {
    const matches = [match(0), match(1)];
    const bracketRounds = assembleBracket({
      rounds: 2,
      lockAt: LOCK,
      scheduleVersion: 2,
      matches,
      autoUserIds: new Set(),
    });
    const night = myNight({
      userId: "b0",
      rounds: 2,
      lockAt: LOCK,
      scheduleVersion: 2,
      matches,
    });
    const cards = callCards({
      bracket: bracketRounds,
      night,
      predictions: [],
      splits: [],
      now: new Date("2026-10-14T18:30:00.000Z"),
    });
    expect(cards?.[0].sides.map((side) => side.name)).toEqual(["Sanne0", "Sanne1"]);
  });

  it("keeps the account in the path and the club in the champion's results", () => {
    const row = match(0, { round: 2, pairing: 0 });
    const night = nightTiles([row], "a0", 2);
    expect(night[0].text).toBe("Beat Eline0 2–1");
    expect(posterTiles([row], "a0", 2)[0].text).toBe("2–1 Elinewijk 0");
    expect(finalLine(row)).toBe("Beat Elinewijk 0 in the final, 2–1.");
  });
});

describe("the champion", () => {
  it("is named by club, else by account, else not at all", () => {
    expect(championClub({ champion_name: "Wout H.", champion_club: "Joristown Rovers" })).toBe(
      "Joristown Rovers",
    );
    expect(championClub({ champion_name: "Wout H." })).toBe("Wout H.");
    expect(championClub({ champion_name: "Wout H.", champion_club: null })).toBe("Wout H.");
    expect(championClub({ champion_name: null, champion_club: "Joristown Rovers" })).toBeNull();
    expect(championClub({})).toBeNull();
  });

  it("leads the past weeks by club", () => {
    const week: MidweekTournament = {
      tournament_id: "w",
      week_start: "2026-09-21",
      lock_at: "2026-09-23T17:55:00.000Z",
      status: "complete",
      status_reason: null,
      void_note: null,
      rounds: 3,
      champion_user_id: "w",
      champion_name: "Wout H.",
      champion_club: "Joristown Rovers",
    };
    const text = (extra: Partial<MidweekTournament> = {}) =>
      pastWeeks({
        tournaments: [{ ...week, ...extra }],
        entrants: [{ tournament_id: "w", user_id: "w" }],
        rewards: [],
        userId: "me",
        minEntrants: 4,
      })[0].text;
    expect(text()).toMatch(/^Joristown Rovers won it/);
    expect(text({ champion_club: undefined })).toMatch(/^Wout H\. won it/);
  });
});

describe("the report names the team by club and the trialist by account (DR4-12)", () => {
  const t = simulated.find((s) => s.result.matches.length > 0) ?? simulated[0];
  const played = t.result.matches.find((m) =>
    t.result.entries
      .filter((e) => m.userIds.includes(e.userId))
      .some((e) => e.cards.some((card) => card.trialist)),
  );

  it("reads the club from the entry rows, with the account as the fallback", () => {
    const m = played ?? t.result.matches[0];
    const entries = entryRows(t.result, true);
    const [a, b] = m.userIds;
    const withClubs = entries.map((row) => ({
      ...row,
      club_name: `Club of ${row.manager_name}`,
    }));
    const without = entries.map((row) => ({ ...row, club_name: undefined }));
    const input = (rows: typeof entries) =>
      reportInputFromRows({
        seedHash: t.seedHash,
        rounds: t.result.rounds,
        match: matchRow(m),
        events: eventRows(m),
        entries: rows,
        ownersPublished: true,
      })!;
    const clubbed = input(withClubs);
    expect(clubbed.sides.map((side) => side.club)).toEqual(
      [a, b].map((id) => `Club of ${entries.find((row) => row.user_id === id)!.manager_name}`),
    );
    const plain = input(without);
    expect(plain.sides.map((side) => side.club)).toEqual(plain.sides.map((side) => side.manager));

    const report = renderStoredReport(clubbed);
    expect(report.why.map((side) => side.club)).toEqual(clubbed.sides.map((side) => side.club));
    const text = [report.headline, ...report.facts.map((f) => f.text)].join(" ");
    expect(text).toContain("Club of ");
    // Nothing says a club's trialist: that label is the account's.
    expect(played).toBeDefined();
    const trialists = report.why.flatMap((side) =>
      side.cards.filter((card) => card.trialist).map((card) => [side.manager, card.name]),
    );
    expect(trialists.length).toBeGreaterThan(0);
    for (const [manager, name] of trialists) expect(name).toMatch(new RegExp(`^${manager}'s `));
    const all = JSON.stringify(report);
    expect(all).not.toMatch(/Club of [^"]*'s (first |second |third )?trialist/);
    // The renderer never changes a phrase for a name: the same lines on both.
    expect(renderStoredReport(plain).timeline.map((item) => item.kind)).toEqual(
      report.timeline.map((item) => item.kind),
    );
  });
});

describe("the bracket row", () => {
  const rounds = assembleBracket({
    rounds: 2,
    lockAt: LOCK,
    scheduleVersion: 2,
    matches: [match(0), match(1)],
    autoUserIds: new Set(),
  });
  const html = (pair: (typeof rounds)[number]["pairs"][number]) =>
    renderToStaticMarkup(
      createElement(MidweekMatchRow, {
        pair,
        you: null,
        weekStart: "2026-10-12",
        call: { kind: "open" },
      }),
    );

  it("shows the clubs, and `Call it` leads to the pairing's pre-match, where a call is made", () => {
    const upcoming = html(rounds[1].pairs[0]);
    expect(upcoming).toContain("Saints 0");
    expect(upcoming).not.toContain("Sanne0");
    expect(upcoming).toMatch(/href="\/midweek\/2026-10-12\/next\/2\/0"[^>]*>Call it/);
  });

  it("keeps `Call it` on the evening for a pairing without a pre-match", () => {
    expect(html(rounds[0].pairs[0])).toMatch(/href="\/midweek#calls"[^>]*>Call it/);
  });
});
