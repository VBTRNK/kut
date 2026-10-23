import { shuffle, type Rng } from "./rng";

/**
 * The seeded knockout draw (BUILD_SPEC §44.6, byes ADR-166).
 *
 * `P` is the smallest power of two ≥ N and round 1 has P/2 pairings. A seeded
 * shuffle picks the P − N pairings that hold a single entrant (a bye), and a
 * second shuffle sets the seat order. The byes go to saved squads first, in
 * seat order, and to auto squads only once every saved squad has one; a squad
 * with at least one saved card counts as saved. Visiting the pairings in
 * order, a bye pairing takes the next bye holder and a match pairing the next
 * two of the others, in seat order. Because N > P/2, every pairing holds at
 * least one entrant. The winners of pairings 2k and 2k + 1 (0-based) meet in
 * the next round.
 */

export type Bracket = {
  size: number;
  rounds: number;
  /** Round-1 pairings in order; the second seat is null for a bye. */
  pairings: Array<[string, string | null]>;
};

/** An entrant as the draw sees it, in canonical ID order. */
export type DrawEntrant = { userId: string; auto: boolean };

export function bracketShape(entrants: number): { size: number; rounds: number } {
  if (!Number.isInteger(entrants) || entrants < 2) {
    throw new Error("A bracket needs at least two entrants");
  }
  let size = 1;
  let rounds = 0;
  while (size < entrants) {
    size *= 2;
    rounds += 1;
  }
  return { size, rounds };
}

export function drawBracket(rng: Rng, entrants: readonly DrawEntrant[]): Bracket {
  const { size, rounds } = bracketShape(entrants.length);
  const pairingCount = size / 2;
  const byeCount = size - entrants.length;

  const pairingOrder = shuffle(
    rng,
    "bracket:bye",
    Array.from({ length: pairingCount }, (_, index) => index),
  );
  const byePairings = new Set(pairingOrder.slice(0, byeCount));
  const seated = shuffle(rng, "bracket:seat", entrants);

  const byeHolders = [
    ...seated.filter((entrant) => !entrant.auto),
    ...seated.filter((entrant) => entrant.auto),
  ].slice(0, byeCount);
  const holders = new Set(byeHolders);
  const playing = seated.filter((entrant) => !holders.has(entrant));

  const pairings: Array<[string, string | null]> = [];
  let nextBye = 0;
  let next = 0;
  for (let pairing = 0; pairing < pairingCount; pairing += 1) {
    if (byePairings.has(pairing)) {
      pairings.push([byeHolders[nextBye].userId, null]);
      nextBye += 1;
    } else {
      pairings.push([playing[next].userId, playing[next + 1].userId]);
      next += 2;
    }
  }
  return { size, rounds, pairings };
}
