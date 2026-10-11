import Link from "next/link";
import type { MatchRated } from "@/lib/midweek/night-ratings";
import { MIDWEEK } from "@/game/midweek/config";
import { MidweekMiniCard } from "./mini-card";
import { MidweekSectionHead } from "./page-head";
import { MidweekRatingDisc } from "./rating-disc";

/**
 * `MidweekMatchRatings` (DR4-8, ADR-150): under `Your night`, the member's five
 * rated for their latest finished match, best first. No ★ and no lines: those
 * wait for the night's end (`MidweekRatingList`), which takes the place of this
 * block once the week is paid.
 */
export function MidweekMatchRatings({ rated }: { rated: MatchRated }) {
  return (
    <section aria-labelledby="match-ratings-h" className="grid content-start gap-3">
      <MidweekSectionHead id="match-ratings-h" title={`Your five against ${rated.opponent}`}>
        <Link className="text-sm font-bold text-brass hover:underline" href={rated.href}>
          Report &rarr;
        </Link>
      </MidweekSectionHead>
      <p className="text-[13px] text-ink-faint">{rated.round} &middot; out of 10 for this match</p>
      <ol className="grid">
        {rated.cards.map((card) => (
          <li
            className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b border-line/35 py-2.5 first:pt-1"
            key={card.slot}
          >
            {card.mini ? (
              <MidweekMiniCard {...card.mini} />
            ) : (
              <MidweekMiniCard ovr={MIDWEEK.trialist.ovr} variant="trialist" />
            )}
            <div className="grid min-w-0 gap-0.5">
              <p className="text-[15px] leading-tight font-black [overflow-wrap:anywhere]">
                {card.name}
              </p>
              <p className="text-xs text-ink-faint">{card.meta}</p>
            </div>
            <MidweekRatingDisc context="for this match" rating={card.rating} size="sm" />
          </li>
        ))}
      </ol>
    </section>
  );
}
