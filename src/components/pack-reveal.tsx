"use client";

import { useEffect, useReducer, useRef, type ReactNode } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { FOCUS, PageHeader } from "@/components/ui/page";
import { Tag } from "@/components/ui/tag";
import { LiveCard, type LiveCardPlayer } from "@/components/live-card";
import { PackArt } from "@/components/pack-art";
import {
  LAST_STEP,
  initialRevealState,
  packRevealReducer,
  type RevealAction,
  type RevealState,
} from "@/components/pack-reveal-state";
import { PACK_GESTURE_MS, REVEAL_TIMING, TIER_NAME, type PackKind } from "@/lib/packs";

type Tier = LiveCardPlayer["rarityTier"];

/**
 * One revealed copy. The copy's own id lives beside the card face, never in
 * it: `player.id` is the Player id the plaster cast hashes (ADR-085).
 */
export type RevealCard = {
  cardId: string;
  player: LiveCardPlayer;
  /** The summary's tag below the card (ADR-158): "New · fills slot 14" or "×3 · discards for 63". */
  chip?: string | null;
  /** "Gold 64 when opened", only when the card's tier has moved since (#223). */
  openedNote?: string | null;
};

/** A paid opening's receipt (#223): its stored identity, title and price paid. */
export type RevealPack = { kind: PackKind; title: string; pricePaid: number };

type PackRevealProps = {
  cards: RevealCard[];
  title?: string;
  /** A paid pack: starts sealed, opens with its own gesture, and can be replayed. */
  pack?: RevealPack;
  /** When set, each summary card links to `${cardHrefBase}${card.cardId}`. */
  cardHrefBase?: string;
  doneHref: string;
  doneLabel: string;
  secondaryHref?: string;
  secondaryLabel?: string;
  /** One line under the summary's heading: "2 new Players. Album 19 / 29." */
  summaryLine?: string;
};

/** Confetti per tier: none for Common, more and richer up the ladder. */
const BITS: Record<Tier, number> = {
  common: 0,
  bronze: 12,
  silver: 24,
  gold: 40,
  holo: 48,
  elite: 60,
};

/** The celebration behind and over a revealed card, by its tier (design/pack-tiers). */
function Celebrate({ tier }: { tier: Tier }) {
  if (tier === "common") return null;
  return (
    <span aria-hidden="true" className="celebrate" data-tier={tier}>
      {tier === "elite" && (
        <>
          <span className="celebrate__dim" />
          <span className="celebrate__rays" />
        </>
      )}
      <span className="celebrate__glow" />
      {tier === "holo" && (
        <>
          <span className="celebrate__ring" />
          <span className="celebrate__ring" />
        </>
      )}
      <span className="celebrate__bits">
        {Array.from({ length: BITS[tier] }, (_, i) => (
          <i key={i} />
        ))}
      </span>
    </span>
  );
}

const SMALL_BUTTON = `rounded-lg border border-line min-h-11 px-3 py-1 font-semibold text-ink-dim hover:text-ink ${FOCUS}`;

/** What the wrapper does after `ms` in this phase, or null to wait for a tap. */
function nextTimer(state: RevealState, kind: PackKind): [RevealAction, number] | null {
  if (state.phase === "opening") return [{ type: "fan" }, PACK_GESTURE_MS[kind]];
  if (state.phase === "fanned") return [{ type: "reveal" }, REVEAL_TIMING.hold];
  if (state.phase === "revealing" && state.step === 0)
    return [{ type: "advance" }, REVEAL_TIMING.tier];
  if (state.phase === "revealing" && state.step === 1)
    return [{ type: "advance" }, REVEAL_TIMING.rating];
  return null;
}

export function PackReveal({
  cards,
  title,
  pack,
  cardHrefBase,
  doneHref,
  doneLabel,
  secondaryHref,
  secondaryLabel,
  summaryLine,
}: PackRevealProps) {
  // Server + first client paint start sealed (a paid pack) or mid-reveal (the
  // starter); a reduced-motion client jumps straight to the summary once
  // mounted. The cards are the persisted result: nothing here draws or pays.
  const [state, dispatch] = useReducer(
    (s: RevealState, a: RevealAction) => packRevealReducer(s, a, cards.length),
    cards.length,
    (n) => initialRevealState(n, false, Boolean(pack)),
  );
  const stageRef = useRef<HTMLButtonElement>(null);
  const summaryRef = useRef<HTMLDivElement>(null);
  const reduced = useRef(false);
  const kind = pack?.kind;

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => {
      reduced.current = query.matches;
      // Also mid-gesture: a changed preference skips to the summary.
      if (query.matches) dispatch({ type: "skipAll" });
    };
    apply();
    query.addEventListener?.("change", apply);
    return () => query.removeEventListener?.("change", apply);
  }, []);

  // A paid pack's gesture, the backs' hold, the tier and the rating advance by
  // themselves; the revealed card waits for a tap. The starter waits for taps.
  useEffect(() => {
    if (!kind) return;
    const next = nextTimer(state, kind);
    if (!next) return;
    const timer = window.setTimeout(() => dispatch(next[0]), next[1]);
    return () => window.clearTimeout(timer);
  }, [state, kind]);

  // Keyboard and screen-reader users stay on the stage, then the summary.
  useEffect(() => {
    if (state.phase === "summary") summaryRef.current?.focus();
    else stageRef.current?.focus();
  }, [state]);

  if (state.phase === "summary") {
    const sub = [
      pack?.title ?? title,
      pack ? `Paid ${pack.pricePaid.toLocaleString("en-GB")} coins` : null,
      summaryLine,
    ];
    return (
      <div className="pack-reveal outline-none" ref={summaryRef} tabIndex={-1}>
        <PageHeader title="Your new Live Cards" sub={sub.filter(Boolean).join(" · ")} />
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
                {card.openedNote && (
                  <p className="mt-2 text-center text-small text-ink-dim">{card.openedNote}</p>
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
        {pack && (
          <div className="mt-4 flex justify-center">
            <button
              className={`${SMALL_BUTTON} text-small`}
              // Presentation only: the same stored cards, no request, no charge.
              // Reduced motion keeps the summary.
              onClick={() => {
                if (!reduced.current) dispatch({ type: "restart", sealed: true });
              }}
              type="button"
            >
              Replay opening
            </button>
          </div>
        )}
      </div>
    );
  }

  const total = cards.length;
  const wrapped = state.phase === "sealed" || state.phase === "opening" || state.phase === "fanned";
  const packTitle = pack?.title ?? "pack";
  let status: ReactNode;
  let stageLabel: string;
  if (wrapped) {
    status =
      state.phase === "sealed"
        ? packTitle
        : state.phase === "opening"
          ? `Opening the ${packTitle}`
          : `${total} Live Cards`;
    stageLabel = state.phase === "sealed" ? `Open the ${packTitle}` : "Show card 1 now";
  } else {
    const card = cards[state.index].player;
    const detail = [TIER_NAME[card.rarityTier], `OVR ${card.liveOvr}`, card.displayName][
      state.step
    ];
    status = (
      <>
        Card {state.index + 1} of {total}
        <span className="sr-only"> · {detail}</span>
      </>
    );
    stageLabel =
      state.step < LAST_STEP
        ? pack
          ? "Show the card now"
          : "Reveal the next detail"
        : state.index + 1 < total
          ? "Next card"
          : "See all the cards";
  }

  const card = state.phase === "revealing" ? cards[state.index].player : null;
  return (
    <div className="pack-reveal">
      <div className="flex items-center justify-between gap-3 text-small font-semibold text-ink-faint">
        <span aria-live="polite" role="status">
          {status}
        </span>
        <button
          className={SMALL_BUTTON}
          onClick={() => dispatch({ type: "skipAll" })}
          type="button"
        >
          Skip all
        </button>
      </div>

      <button
        aria-label={stageLabel}
        className={`pack-reveal__stage pack-stage mt-2 w-full cursor-pointer rounded-3xl border ${FOCUS}`}
        data-pack={kind}
        onClick={() => dispatch({ type: pack ? "tap" : "advance" })}
        ref={stageRef}
        type="button"
      >
        {wrapped && kind && (
          <span className="pack-stage__sealed grid justify-items-center">
            <PackArt
              cards={total}
              className={
                state.phase === "opening"
                  ? "is-opening"
                  : state.phase === "fanned"
                    ? "is-opening is-fanned"
                    : ""
              }
              kind={kind}
            />
            <span className="pack-stage__hint mt-6 text-small text-ink-dim">Tap to open</span>
          </span>
        )}

        {card && state.phase === "revealing" && state.step === 0 && (
          <div className="pack-reveal__focus text-center">
            <p className="pack-reveal__rarity inline-flex items-center gap-2 rounded-full bg-brass/15 px-4 py-2 text-heading font-semibold text-brass">
              {TIER_NAME[card.rarityTier]}
            </p>
            {!pack && <p className="mt-3 text-small text-ink-dim">Tap to reveal the rating</p>}
          </div>
        )}

        {card && state.phase === "revealing" && state.step === 1 && (
          <div className="pack-reveal__focus text-center">
            <p className="text-label font-semibold text-brass">{TIER_NAME[card.rarityTier]}</p>
            <p className="pack-reveal__ovr mt-2 text-figure font-extrabold text-ink">
              {card.liveOvr}
            </p>
            <p className="text-label font-semibold text-ink-faint">OVR</p>
            {!pack && <p className="mt-3 text-small text-ink-dim">Tap to reveal the player</p>}
          </div>
        )}

        {card && state.phase === "revealing" && state.step === LAST_STEP && (
          <div
            className="pack-reveal__focus relative w-full max-w-[240px]"
            data-celebrate={pack ? card.rarityTier : undefined}
          >
            {pack && <Celebrate tier={card.rarityTier} />}
            <div className="relative z-[1]">
              <LiveCard player={card} />
            </div>
            <p className="relative z-[1] mt-3 text-center text-small text-ink-dim">
              {state.index + 1 < total ? "Tap for the next card" : "Tap to see all three"}
            </p>
          </div>
        )}
      </button>
    </div>
  );
}
