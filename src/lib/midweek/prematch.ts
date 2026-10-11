/**
 * The between-rounds pre-match (MM 3.0 S5, DR4-7, ADR-149): the next pairing
 * once both its feeders have ended, and both fives as members may see them
 * then. Pure and client-safe.
 *
 * Built from member-readable rows only: the pairing from the bracket (the
 * feeders' public results) and each five from `midweek_entries_public`, whose
 * Power is out from round 1's kick-off (ADR-105). Never the report's Why: it
 * carries the win chance and the day rolls, which show only from kick-off
 * (owner decision Q2), so a call stays a judgement.
 */

import { archetypeLabel, isArchetype, type Archetype } from "@/game/archetypes";
import { PPM } from "@/game/midweek/config";
import { squadBalance } from "@/game/midweek/shape";
import { getRarityTier } from "@/game/rating-engine";
import type { LiveCardPlayer } from "@/components/live-card";
import { TIER_LABEL, type BracketRound, type BracketSlot } from "./evening";
import { clubName, type EntryCardRow } from "./rows";

export type NextPairing = {
  round: number;
  pairing: number;
  kickoffAt: string;
  sides: [BracketSlot, BracketSlot];
};

/**
 * A later round's pairing once both its feeders have ended (when calls open,
 * ADR-118), until its kick-off; else null: a feeder still to finish, round 1
 * (no feeders), or a pairing already kicked off, which is the match page's.
 */
export function nextPairing(
  bracket: readonly BracketRound[],
  round: number,
  pairing: number,
): NextPairing | null {
  const pair = bracket[round - 1]?.pairs[pairing];
  if (pair?.kind !== "upcoming" || !pair.preMatch) return null;
  return { round, pairing, kickoffAt: pair.kickoffAt, sides: pair.sides };
}

/** Where a pairing's pre-match lives: by round and pairing, as its match id isn't public yet. */
export const preMatchHref = (weekStart: string, round: number, pairing: number) =>
  `/midweek/${weekStart}/next/${round}/${pairing}`;

/** A route segment as a round or pairing number, checked before it reaches a query (KB-007). */
export function routeNumber(value: string): number | null {
  return /^\d{1,2}$/.test(value) ? Number(value) : null;
}

export type PreCard = {
  name: string;
  trialist: boolean;
  injured: boolean;
  inGoal: boolean;
  ovr: number;
  /** "All-rounder". */
  archetype: string;
  /** "Silver"; a trialist is Common. */
  tier: string;
  rarityTier: LiveCardPlayer["rarityTier"];
  /** The week's Power, fixed at the lock, with no day roll. */
  power: number;
};

export type PreSide = {
  userId: string;
  /** The club, or the account name while the view lacks it (ADR-145, ADR-151). */
  club: string;
  /** The account name: `Sophie's five` (DR4-11). */
  account: string;
  auto: boolean;
  /** Plusses per line from the four cards not in goal, and how many each is short (ADR-116). */
  lines: [number, number, number];
  short: [number, number, number];
  balancePpm: number;
  /** Strongest first. */
  cards: PreCard[];
};

const ORDINALS = ["first", "second", "third", "fourth", "fifth"];

/**
 * One side's five as the pre-match shows it, or null when the member has no
 * entry or the view hasn't released the week's Power yet (before round 1's
 * kick-off). Trialists are named as the report names them: the account's,
 * numbered when there is more than one (DR4-12).
 */
export function preMatchSide(entries: readonly EntryCardRow[], userId: string): PreSide | null {
  const rows = entries.filter((row) => row.user_id === userId).sort((a, b) => a.slot - b.slot);
  if (rows.length === 0 || rows.some((row) => row.power_ppm === null)) return null;
  const first = rows[0];
  const archetypes = rows.map((row): Archetype =>
    isArchetype(row.archetype) ? row.archetype : "all_rounder",
  );
  const { lines, short, balancePpm } = squadBalance(archetypes, first.keeper_slot);
  const trialists = rows.filter((row) => row.trialist || row.player_name === null).length;
  let seen = 0;
  const cards = rows.map((row): PreCard => {
    const trialist = row.trialist || row.player_name === null;
    let name = row.player_name ?? "";
    if (trialist) {
      name = `${first.manager_name}'s ${trialists > 1 ? `${ORDINALS[seen]} ` : ""}trialist`;
      seen += 1;
    }
    const rarityTier = trialist ? "common" : getRarityTier(row.ovr);
    return {
      name,
      trialist,
      injured: row.injured,
      inGoal: row.slot === row.keeper_slot,
      ovr: row.ovr,
      archetype: archetypeLabel(row.archetype),
      tier: TIER_LABEL[rarityTier],
      rarityTier,
      power: (row.power_ppm as number) / PPM,
    };
  });
  return {
    userId,
    club: clubName(first.club_name, first.manager_name),
    account: first.manager_name,
    auto: first.auto,
    lines,
    short,
    balancePpm,
    cards: cards.sort((a, b) => b.power - a.power),
  };
}
