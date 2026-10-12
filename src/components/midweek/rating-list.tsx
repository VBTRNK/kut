import { Block } from "@/components/ui/block";
import { InfoLink } from "@/components/ui/links";
import { Tag } from "@/components/ui/tag";
import { MIDWEEK } from "@/game/midweek/config";
import type { MatchRated, NightRatings, RatedCard } from "@/lib/midweek/night-ratings";
import { MidweekMiniCard } from "./mini-card";
import { MidweekRatingDisc } from "./rating-disc";

/** `Mean of 2 matches`, the night block's aside. */
export const ratingsSubline = (matchCount: number) =>
  `Mean of ${matchCount} ${matchCount === 1 ? "match" : "matches"}`;

type RatedRow = {
  slot: number;
  name: string;
  /** The card's line for the night; null for one match, which has none. */
  line: string | null;
  meta: string;
  mini: RatedCard["mini"];
  rating: number;
  best: boolean;
};

/**
 * The rating rows (DR5-6): mini card, name, the card's line (or its meta) in
 * Small, the disc, and `★ Best` on the top card of the night, never a mark
 * for the lowest. Each report's Teams tab has a card's per-match rating.
 */
function RatingRows({ rows, context }: { rows: readonly RatedRow[]; context: string }) {
  return (
    <ol className="grid gap-1.5">
      {rows.map((row) => (
        <li
          className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-xl bg-panel-2/80 p-2"
          key={row.slot}
        >
          {row.mini ? (
            <MidweekMiniCard {...row.mini} small />
          ) : (
            <MidweekMiniCard ovr={MIDWEEK.trialist.ovr} small variant="trialist" />
          )}
          <span className="grid min-w-0 gap-0.5">
            <span className="flex flex-wrap items-center gap-1.5 text-body font-semibold">
              <span className="min-w-0 [overflow-wrap:anywhere]">{row.name}</span>
              {row.best && <Tag>★ Best</Tag>}
            </span>
            <span className="text-small text-pretty text-ink-dim">{row.line ?? row.meta}</span>
          </span>
          <MidweekRatingDisc context={context} rating={row.rating} />
        </li>
      ))}
    </ol>
  );
}

/**
 * `MidweekRatingList` (DR3, ADR-117, DR5-6): a member's five once the week is
 * complete, best first, each with its line for the night. The rule is behind
 * `How ratings work ›` (pre-decided cut).
 */
export function MidweekRatingList({ ratings }: { ratings: NightRatings }) {
  return (
    <Block
      aside={<p className="text-small text-ink-dim">{ratingsSubline(ratings.matchCount)}</p>}
      id="ratings-h"
      title="Your five’s ratings"
    >
      <RatingRows context="for the night" rows={ratings.cards} />
      <InfoLink href="/how-it-works#midweek-ratings">How ratings work</InfoLink>
    </Block>
  );
}

/**
 * `MidweekMatchRatings` (DR4-8, ADR-150, DR5-6): during the evening, the
 * member's five rated for their latest finished match, best first, with the
 * way to its report. No ★ and no lines: those wait for the night's end, when
 * `MidweekRatingList` takes this block's place.
 */
export function MidweekMatchRatings({ rated }: { rated: MatchRated }) {
  return (
    <Block
      aside={<p className="text-small text-ink-dim">{rated.round} · out of 10</p>}
      id="match-ratings-h"
      title={`Against ${rated.opponent}`}
    >
      <RatingRows
        context="for this match"
        rows={rated.cards.map((card) => ({ ...card, line: null, best: false }))}
      />
      <div className="flex flex-wrap justify-between gap-x-4">
        <InfoLink href="/how-it-works#midweek-ratings">How ratings work</InfoLink>
        <InfoLink href={rated.href}>Report</InfoLink>
      </div>
    </Block>
  );
}
