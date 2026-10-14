"use client";

import { useEffect, useReducer } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page";
import { Tag } from "@/components/ui/tag";
import { LiveCard, type LiveCardPlayer } from "@/components/live-card";
import {
  initialRevealState,
  packRevealReducer,
  type RevealAction,
  type RevealState,
} from "@/components/pack-reveal-state";

const RARITY_LABEL: Record<LiveCardPlayer["rarityTier"], string> = {
  common: "Common",
  bronze: "Bronze",
  silver: "Silver",
  gold: "Gold",
  holo: "Holo",
  elite: "Elite",
};

/**
 * One revealed copy. The copy's own id lives beside the card face, never in
 * it: `player.id` is the Player id the plaster cast hashes (ADR-085).
 */
export type RevealCard = {
  cardId: string;
  player: LiveCardPlayer;
  /** The summary's tag below the card (ADR-158): "New · fills slot 14" or "×3 · discards for 63". */
  chip?: string | null;
};

type PackRevealProps = {
  cards: RevealCard[];
  title?: string;
  /** When set, each summary card links to `${cardHrefBase}${card.cardId}`. */
  cardHrefBase?: string;
  doneHref: string;
  doneLabel: string;
  secondaryHref?: string;
  secondaryLabel?: string;
  /** One line under the summary's heading: "2 new Players. Album 19 / 29." */
  summaryLine?: string;
};

export function PackReveal({
  cards,
  title,
  cardHrefBase,
  doneHref,
  doneLabel,
  secondaryHref,
  secondaryLabel,
  summaryLine,
}: PackRevealProps) {
  // Server + first client paint start mid-reveal; a reduced-motion client jumps
  // straight to the summary once mounted.
  const [state, dispatch] = useReducer(
    (s: RevealState, a: RevealAction) => packRevealReducer(s, a, cards.length),
    cards.length,
    (n) => initialRevealState(n, false),
  );

  useEffect(() => {
    const reduced =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) dispatch({ type: "skipAll" });
  }, []);

  if (state.phase === "summary") {
    return (
      <div className="pack-reveal">
        <PageHeader
          title="Your new Live Cards"
          sub={[title, summaryLine].filter(Boolean).join(" · ")}
        />
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
          {cards.map((card, i) => {
            const href = cardHrefBase ? `${cardHrefBase}${card.cardId}` : null;
            const cardEl = <LiveCard player={card.player} />;
            return (
              <div className="pack-reveal__summary-card" key={`${card.cardId}-${i}`}>
                {href ? (
                  <Link
                    prefetch={false}
                    className="block rounded-[1.25rem] outline-offset-4 outline-brass focus-visible:outline-2"
                    href={href}
                  >
                    {cardEl}
                  </Link>
                ) : (
                  cardEl
                )}
                {card.chip && (
                  <div className="mt-2 flex justify-center">
                    <Tag tone={card.chip.startsWith("New") ? "won" : "neutral"}>{card.chip}</Tag>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className="mt-8 grid gap-3 sm:flex sm:justify-center">
          <Button href={doneHref}>{doneLabel}</Button>
          {secondaryHref && secondaryLabel && (
            <Button href={secondaryHref} kind="secondary">
              {secondaryLabel}
            </Button>
          )}
        </div>
      </div>
    );
  }

  const card = cards[state.index].player;
  const total = cards.length;

  return (
    <div className="pack-reveal">
      <div className="flex items-center justify-between text-small font-semibold text-ink-faint">
        <span>
          Card {state.index + 1} of {total}
        </span>
        <button
          className="rounded-lg border border-line min-h-11 px-3 py-1 font-semibold text-ink-dim hover:text-ink"
          onClick={() => dispatch({ type: "skipAll" })}
          type="button"
        >
          Skip all
        </button>
      </div>

      <button
        aria-label="Reveal the next detail"
        className="pack-reveal__stage mt-2 w-full cursor-pointer rounded-3xl border border-brass/40 bg-[radial-gradient(circle_at_top,_#4a2f08,_#15130f_62%)]"
        onClick={() => dispatch({ type: "advance" })}
        type="button"
      >
        {state.step === 0 && (
          <div className="pack-reveal__focus text-center">
            <p className="pack-reveal__rarity inline-flex items-center gap-2 rounded-full bg-brass/15 px-4 py-2 text-heading font-semibold text-brass">
              {RARITY_LABEL[card.rarityTier]}
            </p>
            <p className="mt-3 text-small text-ink-dim">Tap to reveal the rating</p>
          </div>
        )}

        {state.step === 1 && (
          <div className="pack-reveal__focus text-center">
            <p className="text-label font-semibold text-brass">{RARITY_LABEL[card.rarityTier]}</p>
            <p className="pack-reveal__ovr mt-2 text-figure font-extrabold text-ink">
              {card.liveOvr}
            </p>
            <p className="text-label font-semibold text-ink-faint">OVR</p>
            <p className="mt-3 text-small text-ink-dim">Tap to reveal the player</p>
          </div>
        )}

        {state.step === 2 && (
          <div className="pack-reveal__focus w-full max-w-[240px]">
            <LiveCard player={card} />
            <p className="mt-3 text-center text-small text-ink-dim">
              {state.index + 1 < total ? "Tap for the next card" : "Tap to see all three"}
            </p>
          </div>
        )}
      </button>
    </div>
  );
}
