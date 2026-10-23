import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { Archetype } from "@/game/archetypes";
import { MIDWEEK } from "@/game/midweek/config";
import { bracketShape, drawBracket, type Bracket, type DrawEntrant } from "@/game/midweek/bracket";
import { roundPayouts } from "@/game/midweek/rewards";
import { shaRng, shuffle } from "@/game/midweek/rng";
import {
  autoSquad,
  buildField,
  simulateTournament,
  type EngineCard,
  type EntrantInput,
  type SimulatedTournament,
} from "@/game/midweek/tournament";

const seed = (n: number) => n.toString(16).padStart(64, "0");

let nextCard = 0;
function card(player: number, ovr = 50, archetype: Archetype = "all_rounder"): EngineCard {
  nextCard += 1;
  return { cardId: `c${nextCard}`, playerId: `p${player}`, ovr, archetype, injured: false };
}

/** Draw entrants u00, u01, ... in ID order; the listed indexes are saved. */
function mixed(size: number, saved: readonly number[]): DrawEntrant[] {
  return Array.from({ length: size }, (_, i) => ({
    userId: `u${String(i).padStart(2, "0")}`,
    auto: !saved.includes(i),
  }));
}

/** Which pairings are byes, who holds them and who plays, in pairing order. */
function layout(bracket: Bracket) {
  return {
    byePairings: bracket.pairings.flatMap(([, second], i) => (second === null ? [i] : [])),
    holders: bracket.pairings.flatMap(([first, second]) => (second === null ? [first] : [])),
    players: bracket.pairings.flatMap(([first, second]) =>
      second === null ? [] : [first, second],
    ),
  };
}

/** The ADR-166 procedure spelled out from the two tagged shuffles. */
function procedure(n: number, entrants: DrawEntrant[]) {
  const { size } = bracketShape(entrants.length);
  const byeCount = size - entrants.length;
  const pairings = Array.from({ length: size / 2 }, (_, i) => i);
  const pairingOrder = shuffle(shaRng(seed(n)), "bracket:bye", pairings);
  const seat = shuffle(shaRng(seed(n)), "bracket:seat", entrants);
  const holders = [...seat.filter((e) => !e.auto), ...seat.filter((e) => e.auto)]
    .slice(0, byeCount)
    .map((e) => e.userId);
  return {
    byePairings: pairingOrder.slice(0, byeCount).sort((a, b) => a - b),
    holders,
    players: seat.map((e) => e.userId).filter((id) => !holders.includes(id)),
  };
}

function field(size: number, picked = true): EntrantInput[] {
  return Array.from({ length: size }, (_, i) => {
    const owned = [card(i), card(i + 1, 60), card(i + 2, 40, "goalkeeper")];
    return { userId: `u${String(i).padStart(2, "0")}`, owned, saved: picked ? owned : [] };
  });
}

describe("midweek bracket", () => {
  it("sizes the bracket to the next power of two", () => {
    expect(bracketShape(4)).toEqual({ size: 4, rounds: 2 });
    expect(bracketShape(5)).toEqual({ size: 8, rounds: 3 });
    expect(bracketShape(22)).toEqual({ size: 32, rounds: 5 });
    expect(() => bracketShape(1)).toThrow();
  });

  it("seats every entrant once and draws the bye pairings at random", () => {
    const entrants = mixed(11, [1, 4, 6]);
    const placements = new Set<string>();
    for (let n = 0; n < 50; n += 1) {
      const bracket = drawBracket(shaRng(seed(n)), entrants);
      const seated = bracket.pairings.flat().filter((id): id is string => id !== null);
      expect([...seated].sort()).toEqual(entrants.map((e) => e.userId));
      const byes = bracket.pairings.flatMap(([, second], i) => (second === null ? [i] : []));
      expect(byes).toHaveLength(16 - 11);
      placements.add(byes.join(","));
    }
    expect(placements.size).toBeGreaterThan(10);
  });

  // ADR-166, checked by hand from the two literal shuffles. The same field is
  // the golden tournament "saved squads get the byes first", so the SQL parity
  // test pins this layout too.
  it("gives saved squads the byes first: a hand-checked draw", () => {
    const [u901, u905, u904, u903, u902] = [
      "26d30fc6-afd8-4138-8be7-19a7e9fcec3b",
      "55043d58-c392-4ed1-853a-5a8502357377",
      "77649d8e-57ce-46d6-8b65-dffa9ae333ed",
      "7b5653eb-7951-4dcb-8d47-f7e1b0f501c7",
      "bf8397d2-965a-432b-82ff-369fbd0478e2",
    ];
    const golden = JSON.parse(
      readFileSync(path.resolve(import.meta.dirname, "../fixtures/midweek-golden.json"), "utf8"),
    ) as {
      tournaments: Array<{
        name: string;
        seed: string;
        entrants: EntrantInput[];
        result: SimulatedTournament;
      }>;
    };
    const hand = golden.tournaments.find((t) => t.name === "saved squads get the byes first")!;
    expect(hand.seed).toBe("6d9a21927ae2b37ee2929d6e4d03086ff86231c0db572c6675d8020b17e78450");
    // Canonical ID order is 901, 905, 904, 903, 902. Only 903 and 905 saved,
    // 905 a single card.
    expect(hand.entrants.map((e) => [e.userId, e.saved.length])).toEqual([
      [u901, 0],
      [u902, 0],
      [u903, 5],
      [u904, 0],
      [u905, 1],
    ]);

    // Pairings 0, 2 and 1 hold the byes; the seat order is 902, 904, 901, 903, 905.
    expect(shuffle(shaRng(hand.seed), "bracket:bye", [0, 1, 2, 3])).toEqual([0, 2, 1, 3]);
    expect(shuffle(shaRng(hand.seed), "bracket:seat", [0, 1, 2, 3, 4])).toEqual([4, 2, 0, 3, 1]);

    // Bye queue: saved 903, 905 in seat order, then the first auto, 902.
    // Match queue: 904, 901. The old draw gave 902, 904 and 901 the byes and
    // made 903 play 905.
    const ordered: DrawEntrant[] = [u901, u905, u904, u903, u902].map((userId) => ({
      userId,
      auto: userId !== u903 && userId !== u905,
    }));
    expect(drawBracket(shaRng(hand.seed), ordered).pairings).toEqual([
      [u903, null],
      [u905, null],
      [u902, null],
      [u904, u901],
    ]);

    for (const result of [
      simulateTournament(shaRng(hand.seed), hand.entrants) as SimulatedTournament,
      hand.result,
    ]) {
      expect(result.byes).toEqual([
        { pairing: 0, userId: u903 },
        { pairing: 1, userId: u905 },
        { pairing: 2, userId: u902 },
      ]);
      expect(result.matches.filter((m) => m.round === 1)).toMatchObject([
        { pairing: 3, userIds: [u904, u901] },
      ]);
    }
  });

  it("follows the draw procedure at every edge", () => {
    const cases: Array<[string, DrawEntrant[], number]> = [
      ["no byes", mixed(8, [0, 3, 5]), 0],
      ["no saved squad", mixed(6, []), 2],
      ["every squad saved", mixed(6, [0, 1, 2, 3, 4, 5]), 2],
      ["as many byes as saved squads", mixed(6, [1, 4]), 2],
      ["more byes than saved squads", mixed(5, [3]), 3],
      ["fewer byes than saved squads", mixed(6, [0, 2, 3, 5]), 2],
      ["a lone saved squad among 22", mixed(22, [21]), 10],
    ];
    for (const [name, entrants, byeCount] of cases) {
      for (let n = 0; n < 20; n += 1) {
        const expected = procedure(n, entrants);
        expect(layout(drawBracket(shaRng(seed(n)), entrants)), `${name}, seed ${n}`).toEqual(
          expected,
        );
        expect(expected.holders).toHaveLength(byeCount);
      }
    }
  });

  it("never gives an auto squad a bye while a saved squad plays", () => {
    for (let n = 0; n < 300; n += 1) {
      const rng = shaRng(seed(10_000 + n));
      const size = 4 + (rng("size") % 19);
      const entrants = mixed(
        size,
        Array.from({ length: size }, (_, i) => i).filter((i) => rng(`saved:${i}`) % 3 !== 0),
      );
      const { holders } = layout(drawBracket(rng, entrants));
      const saved = entrants.filter((e) => !e.auto).map((e) => e.userId);
      const autoBye = entrants.some((e) => e.auto && holders.includes(e.userId));
      if (autoBye) expect(saved.every((id) => holders.includes(id))).toBe(true);
      expect(holders).toHaveLength(bracketShape(size).size - size);
    }
  });
});

describe("midweek tournament", () => {
  it("skips a field below the minimum", () => {
    expect(simulateTournament(shaRng(seed(1)), field(MIDWEEK.minEntrants - 1))).toEqual({
      status: "skipped",
      reason: "too_few_entrants",
    });
  });

  it("is a pure function of the entrants and the seed, whatever their order", () => {
    const entrants = field(7).map((e, i) => (i % 2 === 0 ? { ...e, saved: [] } : e));
    const a = simulateTournament(shaRng(seed(2)), entrants);
    expect(simulateTournament(shaRng(seed(2)), [...entrants].reverse())).toEqual(a);
    expect(simulateTournament(shaRng(seed(3)), entrants)).not.toEqual(a);
  });

  it("pays each win once, a bye like a win, and the champion exactly the total", () => {
    for (const size of [4, 5, 6, 9, 13]) {
      const result = simulateTournament(shaRng(seed(size)), field(size)) as SimulatedTournament;
      const pays = roundPayouts(result.rounds);
      const champion = result.payouts.filter((p) => p.userId === result.championUserId);
      expect(champion.reduce((sum, p) => sum + p.amount, 0)).toBe(MIDWEEK.championTotal);
      expect(result.byes).toHaveLength(result.size - size);
      for (const bye of result.byes) {
        expect(result.payouts).toContainEqual({
          userId: bye.userId,
          round: 1,
          amount: pays[0],
          bye: true,
        });
      }
      const perRound = new Map<string, number>();
      for (const payout of result.payouts) {
        const key = `${payout.round}:${payout.userId}`;
        perRound.set(key, (perRound.get(key) ?? 0) + 1);
      }
      expect(Math.max(...perRound.values())).toBe(1);
      expect(result.matches).toHaveLength(size - 1);
    }
  });

  it("counts a squad with one surviving saved card as saved for the byes", () => {
    const entrants = field(5, false);
    entrants[3] = { ...entrants[3], saved: entrants[3].owned.slice(0, 1) };
    for (let n = 0; n < 20; n += 1) {
      const result = simulateTournament(shaRng(seed(n)), entrants) as SimulatedTournament;
      expect(result.entries.find((e) => e.userId === "u03")!.auto).toBe(false);
      expect(result.byes.map((b) => b.userId)).toContain("u03");
    }
  });

  it("fills empty slots with trialists", () => {
    const entrants = field(4).map((e) => ({ ...e, saved: e.saved.slice(0, 2) }));
    const { entries } = buildField(shaRng(seed(4)), entrants);
    for (const entry of entries) {
      expect(entry.cards.filter((c) => c.trialist)).toHaveLength(3);
      for (const trialist of entry.cards.filter((c) => c.trialist)) {
        expect(trialist.cardId).toBeNull();
        expect(trialist.archetype).toBe("all_rounder");
        expect(trialist.pickFactorPpm).toBe(MIDWEEK.pick.neutralPpm);
      }
    }
  });

  it("builds auto squads deterministically from distinct owned Players", () => {
    const owned = [card(1), card(1), card(2), card(3), card(4), card(5), card(6), card(7)];
    const entrant = { userId: "u1", owned, saved: [] };
    const squad = autoSquad(shaRng(seed(5)), entrant);
    expect(squad).toEqual(autoSquad(shaRng(seed(5)), entrant));
    expect(squad).toHaveLength(5);
    expect(new Set(squad.map((c) => c.playerId)).size).toBe(5);
    for (const c of squad) expect(owned).toContainEqual(c);
    expect(autoSquad(shaRng(seed(5)), { ...entrant, owned: owned.slice(0, 3) })).toHaveLength(2);
  });

  it("penalises auto squads and leaves them out of pick shares", () => {
    const entrants = field(5);
    entrants[0] = { ...entrants[0], saved: [] };
    const { entries, pickShares } = buildField(shaRng(seed(6)), entrants);
    const auto = entries.find((e) => e.userId === "u00")!;
    expect(auto.auto).toBe(true);
    for (const c of auto.cards) {
      expect(c.pickFactorPpm).toBe(MIDWEEK.pick.neutralPpm);
      expect(c.handicapPpm).toBeLessThanOrEqual(MIDWEEK.autoFactorPpm);
    }
    // Player p0 is owned by u00 only, which did not pick: an owner, never a pick.
    expect(pickShares.find((s) => s.playerId === "p0")).toMatchObject({ owners: 1, picks: 0 });
  });

  it("shares one form roll per Player across every squad", () => {
    const shared = [card(90, 55), card(91, 45)];
    const entrants = field(4).map((e) => ({ ...e, owned: [...e.owned, ...shared], saved: shared }));
    const { entries } = buildField(shaRng(seed(7)), entrants);
    const forms = new Set(
      entries.map((e) => e.cards.find((c) => c.playerId === "p90")!.formRollPpm),
    );
    expect(forms.size).toBe(1);
  });

  it("refuses squads the lock checks should have caught", () => {
    const [first, ...rest] = field(4);
    const duplicate = { ...first, saved: [first.owned[0], { ...first.owned[0], cardId: "other" }] };
    expect(() => buildField(shaRng(seed(8)), [duplicate, ...rest])).toThrow();
    const stranger = { ...first, saved: [card(99)] };
    expect(() => buildField(shaRng(seed(8)), [stranger, ...rest])).toThrow();
    expect(() => buildField(shaRng(seed(8)), [first, first, ...rest])).toThrow();
  });
});
