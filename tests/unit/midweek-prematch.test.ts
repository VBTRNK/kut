import { describe, expect, it } from "vitest";
import { squadBalance } from "@/game/midweek/shape";
import { assembleBracket } from "@/lib/midweek/evening";
import { maskInPlay } from "@/lib/midweek/live";
import { nextPairing, preMatchHref, preMatchSide, routeNumber } from "@/lib/midweek/prematch";
import type { DrawRow, EntryCardRow, MatchRow } from "@/lib/midweek/rows";

// Six entrants in eight slots, three rounds (schedule version 2): round 1 is
// A v B, C v D, then byes for E and F.
const LOCK = "2026-10-07T17:55:00.000Z";
const V2 = 2;
const KICKOFF = [
  "2026-10-07T18:00:00.000Z",
  "2026-10-07T18:15:00.000Z",
  "2026-10-07T18:30:00.000Z",
];

function row(
  round: number,
  pairing: number,
  sides: [string, string | null],
  winner: 0 | 1 | null = 0,
): MatchRow {
  const bye = sides[1] === null;
  return {
    match_id: `m-${round}-${pairing}`,
    tournament_id: "t",
    week_start: "2026-10-05",
    round,
    pairing,
    bye,
    side_0_user_id: sides[0],
    side_0_name: `Manager ${sides[0]}`,
    side_1_user_id: sides[1],
    side_1_name: sides[1] && `Manager ${sides[1]}`,
    side_0_goals: bye ? null : 1,
    side_1_goals: bye ? null : 0,
    side_0_penalties: null,
    side_1_penalties: null,
    winner_side: winner,
    winner_user_id: winner === null ? null : (sides[winner] ?? sides[0]),
    win_chance_ppm: bye ? null : 500_000,
    side_0_day_rolls_ppm: null,
    side_1_day_rolls_ppm: null,
    reveal_at: KICKOFF[round - 1],
  };
}

const roundOne: MatchRow[] = [
  row(1, 0, ["A", "B"]),
  row(1, 1, ["C", "D"], 1),
  row(1, 2, ["E", null]),
  row(1, 3, ["F", null]),
];
const draw: DrawRow[] = roundOne.map((match) => ({
  match_id: match.match_id,
  tournament_id: "t",
  week_start: "2026-10-05",
  pairing: match.pairing,
  bye: match.bye,
  side_0_user_id: match.side_0_user_id,
  side_0_name: match.side_0_name,
  side_1_user_id: match.side_1_user_id,
  side_1_name: match.side_1_name,
  kickoff_at: KICKOFF[0],
}));

const bracketOf = (matches: readonly MatchRow[]) =>
  assembleBracket({
    rounds: 3,
    lockAt: LOCK,
    scheduleVersion: V2,
    draw,
    matches,
    autoUserIds: new Set(["D"]),
  });

describe("the next pairing (DR4-7, ADR-149)", () => {
  it("opens once both feeders have ended, with their winners", () => {
    const next = nextPairing(bracketOf(roundOne), 2, 0);
    expect(next).toMatchObject({ round: 2, pairing: 0, kickoffAt: KICKOFF[1] });
    expect(next!.sides.map((side) => side.userId)).toEqual(["A", "D"]);
    expect(next!.sides[1].auto).toBe(true);
  });

  it("is absent while a feeder plays, and opens for the pairing whose feeders have ended", () => {
    const now = new Date("2026-10-07T18:02:00.000Z");
    const ends = new Map(roundOne.map((m) => [m.match_id, "2026-10-07T18:05:00.000Z"]));
    const playing = maskInPlay(roundOne, ends, now);
    const bracket = bracketOf(playing);
    expect(nextPairing(bracket, 2, 0)).toBeNull();
    // Two byes feed pairing 1: settled from round 1's kick-off.
    expect(nextPairing(bracket, 2, 1)?.sides.map((side) => side.userId)).toEqual(["E", "F"]);
  });

  it("waits for round 1's kick-off, when the week's Power is out, even after two byes", () => {
    expect(nextPairing(bracketOf([]), 2, 1)).toBeNull();
  });

  it("has none for round 1, a pairing already kicked off, or one that doesn't exist", () => {
    const bracket = bracketOf([...roundOne, row(2, 0, ["A", "D"]), row(2, 1, ["E", "F"], null)]);
    expect(nextPairing(bracket, 1, 0)).toBeNull();
    expect(nextPairing(bracket, 2, 0)).toBeNull();
    expect(nextPairing(bracket, 2, 1)).toBeNull();
    expect(nextPairing(bracket, 2, 7)).toBeNull();
    expect(nextPairing(bracket, 9, 0)).toBeNull();
    // The final opens when both semi-finals have ended.
    const semis = [...roundOne, row(2, 0, ["A", "D"]), row(2, 1, ["E", "F"], 1)];
    expect(nextPairing(bracketOf(semis), 3, 0)?.sides.map((side) => side.userId)).toEqual([
      "A",
      "F",
    ]);
  });

  it("addresses the pre-match by round and pairing, and reads only small numbers from the URL", () => {
    expect(preMatchHref("2026-10-05", 2, 1)).toBe("/midweek/2026-10-05/next/2/1");
    expect(routeNumber("2")).toBe(2);
    expect(routeNumber("15")).toBe(15);
    for (const bad of ["", "-1", "1.5", "2e1", "123", " 2", "x"]) {
      expect(routeNumber(bad)).toBeNull();
    }
  });
});

describe("a five before kick-off (Q2, DR4-7)", () => {
  const card = (slot: number, extra: Partial<EntryCardRow> = {}): EntryCardRow => ({
    tournament_id: "t",
    week_start: "2026-10-05",
    user_id: "N",
    manager_name: "Niels",
    club_name: "Niels Newcastle",
    auto: false,
    keeper_slot: 0,
    keeperless: false,
    slot,
    trialist: false,
    player_id: `p${slot}`,
    player_name: `Player ${slot}`,
    photo_path: null,
    ovr: 54,
    archetype: "all_rounder",
    injured: false,
    ovr_factor_ppm: 1_050_000,
    form_roll_ppm: 1_000_000,
    pick_factor_ppm: 1_000_000,
    fitness_ppm: 1_000_000,
    handicap_ppm: 1_000_000,
    power_ppm: 1_000_000,
    picks: null,
    owners: null,
    ...extra,
  });
  const trialist = (slot: number, power: number) =>
    card(slot, {
      trialist: true,
      player_id: null,
      player_name: null,
      ovr: 30,
      power_ppm: power,
    });
  const five = [
    card(0, { archetype: "goalkeeper", ovr: 32, power_ppm: 1_380_000 }),
    card(1, { archetype: "finisher", ovr: 60, injured: true, power_ppm: 1_290_000 }),
    card(2, { ovr: 49, power_ppm: 890_000 }),
    trialist(3, 860_000),
    trialist(4, 840_000),
    card(0, { user_id: "other" }),
  ];

  it("lists the cards strongest first with the week's Power, keeper, injury and trialists", () => {
    const side = preMatchSide(five, "N")!;
    expect(side).toMatchObject({ userId: "N", club: "Niels Newcastle", account: "Niels" });
    expect(side.cards.map((c) => [c.name, c.power])).toEqual([
      ["Player 0", 1.38],
      ["Player 1", 1.29],
      ["Player 2", 0.89],
      ["Niels's first trialist", 0.86],
      ["Niels's second trialist", 0.84],
    ]);
    expect(side.cards[0]).toMatchObject({
      inGoal: true,
      archetype: "Goalkeeper",
      tier: "Common",
      rarityTier: "common",
    });
    expect(side.cards[1]).toMatchObject({ injured: true, tier: "Gold", inGoal: false });
    expect(side.cards[3]).toMatchObject({ trialist: true, tier: "Common", ovr: 30 });
  });

  it("counts the plusses per line with the engine's own rule", () => {
    const side = preMatchSide(five, "N")!;
    const engine = squadBalance(
      ["goalkeeper", "finisher", "all_rounder", "all_rounder", "all_rounder"],
      0,
    );
    expect([side.lines, side.short, side.balancePpm]).toEqual([
      engine.lines,
      engine.short,
      engine.balancePpm,
    ]);
  });

  it("names one trialist without a number, and falls back to the account's club", () => {
    const side = preMatchSide(
      [card(0, { club_name: null }), trialist(1, 900_000)].map((row) => ({
        ...row,
        user_id: "S",
        manager_name: "Sanne",
        club_name: undefined,
      })),
      "S",
    )!;
    expect(side.club).toBe("Sanne's Club");
    expect(side.cards.map((c) => c.name)).toContain("Sanne's trialist");
  });

  it("is null before the week's Power is out, or for someone not entered", () => {
    expect(preMatchSide([card(0, { power_ppm: null }), card(1)], "N")).toBeNull();
    expect(preMatchSide(five, "nobody")).toBeNull();
  });
});
