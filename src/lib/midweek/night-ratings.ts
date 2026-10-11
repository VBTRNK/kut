import type { LiveCardPlayer } from "@/components/live-card";
import { archetypeLabel } from "@/game/archetypes";
import type { Side } from "@/game/midweek/match";
import { getRarityTier } from "@/game/rating-engine";
import { entryCardFace, roundName, roundShort, TIER_LABEL } from "./evening";
import { reportInputFromRows } from "./report/from-db";
import { cardNames, matchRatings, rateNight, type NightMatch } from "./report/ratings";
import type { EntryCardRow, EventRow, MatchRow } from "./rows";

/**
 * The ratings block (`MidweekRatingList`, DR3 HANDOFF §1, ADR-117): a member's
 * five once the week is complete, best first, each with its night rating, its
 * line and a chip per match. A pure function of rows the page already has plus
 * the events of the member's own matches, so the champion view and the bracket
 * read one events query, not one per match.
 *
 * Server only: `rateNight` keys its lines with `rng.ts`, which needs
 * `node:crypto`.
 */

export type RatedMatch = {
  /** `Round 2 v Eline`. */
  label: string;
  opponent: string;
  href: string;
  rating: number;
};

export type RatedCard = {
  slot: number;
  name: string;
  /** `All-rounder · Bronze · in goal`. */
  meta: string;
  /** The LiveCard face; null for a trialist. */
  face: LiveCardPlayer | null;
  /** The mini card below `lg`; null for a trialist. */
  mini: { rarityTier: LiveCardPlayer["rarityTier"]; ovr: number; injured: boolean } | null;
  ovr: number;
  rating: number;
  line: string;
  best: boolean;
  matches: RatedMatch[];
};

export type NightRatings = {
  userId: string;
  manager: string;
  matchCount: number;
  cards: RatedCard[];
};

/** The matches a member played (byes are not matches), in round order, with their side. */
export function playedMatches(matches: readonly MatchRow[], userId: string) {
  return matches
    .filter(
      (match) =>
        !match.bye &&
        match.side_1_user_id !== null &&
        match.winner_side !== null &&
        (match.side_0_user_id === userId || match.side_1_user_id === userId),
    )
    .sort((a, b) => a.round - b.round)
    .map((match) => ({ match, side: (match.side_0_user_id === userId ? 0 : 1) as Side }));
}

/** The card's own row: its meta line and its mini card (null for a trialist). */
function cardDetails(row: EntryCardRow) {
  const inGoal = row.slot === row.keeper_slot ? " · in goal" : "";
  const tier = getRarityTier(row.ovr);
  const trialist = row.trialist || row.player_name === null;
  return {
    trialist,
    meta: `${archetypeLabel(row.archetype)} · ${trialist ? "Common" : TIER_LABEL[tier]}${inGoal}`,
    mini: trialist ? null : { rarityTier: tier, ovr: row.ovr, injured: row.injured },
  };
}

export function nightRatings(input: {
  seedHash: string;
  userId: string;
  rounds: number;
  weekStart: string;
  matches: readonly MatchRow[];
  /** At least the events of the member's own matches. */
  events: readonly EventRow[];
  entries: readonly EntryCardRow[];
  photoUrls: ReadonlyMap<string, string>;
}): NightRatings | null {
  const own = input.entries
    .filter((row) => row.user_id === input.userId)
    .sort((a, b) => a.slot - b.slot);
  if (own.length === 0) return null;
  const played = playedMatches(input.matches, input.userId);
  const night: (NightMatch & { match: MatchRow })[] = [];
  for (const { match, side } of played) {
    const reportInput = reportInputFromRows({
      seedHash: input.seedHash,
      rounds: input.rounds,
      match,
      events: input.events.filter((event) => event.match_id === match.match_id),
      entries: input.entries,
      ownersPublished: true,
    });
    if (reportInput) night.push({ input: reportInput, side, match });
  }
  if (night.length === 0) return null;

  const rated = rateNight({ seedHash: input.seedHash, userId: input.userId, matches: night });
  const top = Math.max(...rated.map((card) => card.rating));
  const cards = rated
    .map((card): RatedCard => {
      const row = own[card.slot];
      const { trialist, meta, mini } = cardDetails(row);
      return {
        slot: card.slot,
        name: card.label.text,
        meta,
        face: trialist ? null : entryCardFace(row, input.photoUrls),
        mini,
        ovr: row.ovr,
        rating: card.rating,
        line: card.line,
        best: false,
        matches: night.map(({ match, side }, index) => {
          const opponent = (side === 0 ? match.side_1_name : match.side_0_name) ?? "";
          return {
            label: `${roundShort(match.round, input.rounds)} v ${opponent}`,
            opponent,
            href: `/midweek/${input.weekStart}/match/${match.match_id}`,
            rating: card.matchRatings[index],
          };
        }),
      };
    })
    // Best first; a tie keeps slot order (Array.sort is stable).
    .sort((a, b) => b.rating - a.rating);
  const best = cards.find((card) => card.rating === top);
  if (best) best.best = true;
  return {
    userId: input.userId,
    manager: own[0].manager_name,
    matchCount: night.length,
    cards,
  };
}

export type MatchRatedCard = {
  slot: number;
  name: string;
  meta: string;
  mini: RatedCard["mini"];
  rating: number;
};

/** One match's ratings for a member's five (`MidweekMatchRatings`, DR4-8, ADR-150). */
export type MatchRated = {
  opponent: string;
  /** `Quarter-final`, singular. */
  round: string;
  href: string;
  cards: MatchRatedCard[];
};

/**
 * A member's five rated for their latest finished match (DR4-8, ADR-150): a
 * pure function of that one match's events and result, so it needs no seed and
 * no other match, and it can show from the match's full time. No lines and no
 * ★: those need the whole night. Null when the member has no finished match.
 * `matches` is masked by real time, so a match in play has no winner here.
 */
export function latestMatchRatings(input: {
  seedHash: string;
  userId: string;
  rounds: number;
  weekStart: string;
  matches: readonly MatchRow[];
  /** At least the events of that match. */
  events: readonly EventRow[];
  entries: readonly EntryCardRow[];
}): MatchRated | null {
  const last = playedMatches(input.matches, input.userId).at(-1);
  if (!last) return null;
  const { match, side } = last;
  const reportInput = reportInputFromRows({
    seedHash: input.seedHash,
    rounds: input.rounds,
    match,
    events: input.events.filter((event) => event.match_id === match.match_id),
    entries: input.entries,
    ownersPublished: false,
  });
  if (!reportInput) return null;
  const own = input.entries
    .filter((row) => row.user_id === input.userId)
    .sort((a, b) => a.slot - b.slot);
  const names = cardNames(reportInput, side);
  const cards = matchRatings(reportInput)
    [side].map((card, slot): MatchRatedCard | null => {
      const row = own[slot];
      if (!row) return null;
      const { meta, mini } = cardDetails(row);
      return { slot, name: names[slot], meta, mini, rating: card.rating };
    })
    .filter((card): card is MatchRatedCard => card !== null)
    // Best first; a tie keeps slot order (Array.sort is stable).
    .sort((a, b) => b.rating - a.rating);
  if (cards.length === 0) return null;
  const name = roundName(match.round, input.rounds);
  return {
    opponent: (side === 0 ? match.side_1_name : match.side_0_name) ?? "",
    round: name.endsWith("finals") ? name.slice(0, -1) : name,
    href: `/midweek/${input.weekStart}/match/${match.match_id}`,
    cards,
  };
}
