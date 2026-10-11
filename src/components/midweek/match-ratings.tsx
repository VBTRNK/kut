import Link from "next/link";
import type { MatchRated } from "@/lib/midweek/night-ratings";
import { MIDWEEK } from "@/game/midweek/config";
import { MidweekMiniCard } from "./mini-card";
import { MidweekRatingDisc } from "./rating-disc";

/**
 * `MidweekMatchRatings` (DR4-8, ADR-150, artboard E2): under `Your night`, in a
 * card, the member's five rated for their latest finished match, best first.
 * No ★ and no lines: those wait for the night's end (`MidweekRatingList`),
 * which takes the place of this block once the week is complete.
 */
export function MidweekMatchRatings({ rated }: { rated: MatchRated }) {
  return (
    <section
      aria-labelledby="match-ratings-h"
      className="grid content-start gap-2.5 rounded-2xl border border-line bg-panel/70 p-4 sm:px-6 sm:py-5"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-[17px] leading-tight font-black" id="match-ratings-h">
          Your five against {rated.opponent}
        </h2>
        <Link className="text-sm font-bold text-brass hover:underline" href={rated.href}>
          Report &rarr;
        </Link>
      </div>
      <p className="text-[13px] text-ink-faint">{rated.round} &middot; out of 10 for this match</p>
      <ol className="grid">
        {rated.cards.map((card) => (
          <li
            className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b border-line/35 py-2.5 last:border-b-0"
            key={card.slot}
          >
            {card.mini ? (
              <MidweekMiniCard {...card.mini} small />
            ) : (
              <MidweekMiniCard ovr={MIDWEEK.trialist.ovr} small variant="trialist" />
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
      <p className="text-[12.5px] leading-normal text-ink-faint">
        Out of 10, for this match only. Your five&rsquo;s night ratings, the best of your five and
        what each card did come after the final.
      </p>
    </section>
  );
}
