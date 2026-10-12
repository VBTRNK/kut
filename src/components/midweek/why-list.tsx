"use client";

import { useEffect, useId, useState } from "react";
import { InfoLink } from "@/components/ui/links";
import { FOCUS } from "@/components/ui/page";
import { archetypeLabel } from "@/game/archetypes";
import { MIDWEEK, PPM } from "@/game/midweek/config";
import { handicapText } from "@/lib/midweek/evening";
import { powerBand, powerBarWidth } from "@/lib/midweek/power";
import type { WhyCard, WhySide } from "@/lib/midweek/report/types";
import { TEAM_TEXT } from "./player-name";
import { MidweekRatingDisc } from "./rating-disc";

/**
 * `MidweekWhyList`, the report's Teams tab (DR5-15; DR2-3, DR2-6..8 kept): the
 * chances before kick-off, the key once there are ratings, then per side a
 * block with its colour as a 3 px top rail and its five cards strongest
 * first, one row each with the card's Power in this match. `Show every
 * factor` opens the five factor boxes under every card, and each box's label
 * explains itself on hover, tap or focus (DR2-7). How Power works has the
 * rest. No tables, so nothing scrolls sideways at any width; bars are SVG
 * with `width` attributes because the CSP blocks inline styles. From full
 * time each card also shows its rating for this match (ADR-117, ADR-150): an
 * untinted disc on the right, apart from the Power pill on the left in shape,
 * side, range and colour.
 */

/** A card's power in this match: the week's power, fixed at the lock, times this match's Day roll. */
export function matchPower(card: Pick<WhyCard, "powerPpm" | "dayRollPpm">): number {
  return (card.powerPpm / PPM) * (card.dayRollPpm / PPM);
}

/** A factor's effect as `+19%`, `−7%` or a dash. */
export function factorEffect(ppm: number): { text: string; trend: "up" | "down" | "flat" } {
  const percent = Math.round((ppm / PPM - 1) * 100);
  if (percent === 0) return { text: "–", trend: "flat" };
  return percent > 0
    ? { text: `+${percent}%`, trend: "up" }
    : { text: `−${Math.abs(percent)}%`, trend: "down" };
}

/** A ppm factor's distance from 1.00 in percent, as written in copy: `25`, `12.5`. */
const percentOff = (ppm: number) => String(Math.round(Math.abs(ppm - PPM) / 1_000) / 10);

const FACTORS = ["Rating", "Form", "Pick", "Fitness", "Day"] as const;
type Factor = (typeof FACTORS)[number];

/** What each factor means (HANDOFF copy, DR2-7), every figure from `MIDWEEK`. */
export const FACTOR_EXPLANATIONS: Record<Factor, string> = {
  Rating: `From the card's OVR: no boost at OVR ${MIDWEEK.ovr.min}, up to +${percentOff(MIDWEEK.ovr.factorMaxPpm)}% at OVR ${MIDWEEK.ovr.max}.`,
  Form: `The Player's form this week, rolled once at the lock: from −${percentOff(MIDWEEK.form.minPpm)}% to +${percentOff(MIDWEEK.form.maxPpm)}%, usually close to zero. Every copy of the Player shares it.`,
  Pick: `Picking against the crowd pays: up to +${percentOff(MIDWEEK.pick.points[0][1])}% when few owners picked this Player, down to −${percentOff(MIDWEEK.pick.points[MIDWEEK.pick.points.length - 1][1])}% when nearly all of them did.`,
  Fitness: `−${percentOff(MIDWEEK.injuredFitnessPpm)}% when the Player is injured; otherwise no change.`,
  Day: `A fresh roll for this match only, between −${percentOff(PPM - MIDWEEK.dayRollSpreadPpm)}% and +${percentOff(PPM + MIDWEEK.dayRollSpreadPpm)}%.`,
};

const factorPpm = (card: WhyCard): Record<Factor, number> => ({
  Rating: card.ovrFactorPpm,
  Form: card.formRollPpm,
  Pick: card.pickFactorPpm,
  Fitness: card.fitnessPpm,
  Day: card.dayRollPpm,
});

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

/**
 * Which factor explanation shows (#279): the one focused or tapped, else the
 * one hovered. Focus stays in charge while it lasts: a pointer resting where
 * another factor scrolls under it (Chromium then fires a hover) no longer
 * takes the focused explanation away. Escape hides every explanation until
 * the next focus, tap or hover.
 */
export type Tips = { focus: string | null; hover: string | null; hidden: boolean };
export type TipEvent =
  { type: "focus" | "blur" | "enter" | "leave"; key: string } | { type: "escape" | "reset" };

export const NO_TIPS: Tips = { focus: null, hover: null, hidden: false };

/** The factor whose explanation shows, if any. */
export const shownTip = (tips: Tips): string | null =>
  tips.hidden ? null : (tips.focus ?? tips.hover);

/** The next state after a focus or tap, a blur, a pointer entering or leaving, or Escape. */
export function nextTips(tips: Tips, event: TipEvent): Tips {
  switch (event.type) {
    case "focus":
      return { ...tips, focus: event.key, hidden: false };
    case "blur":
      return { ...tips, focus: tips.focus === event.key ? null : tips.focus };
    case "enter":
      return { ...tips, hover: event.key, hidden: false };
    case "leave":
      return { ...tips, hover: tips.hover === event.key ? null : tips.hover };
    case "escape":
      return { ...tips, hidden: true };
    case "reset":
      return NO_TIPS;
  }
}

function FactorStrip({
  card,
  tipKey,
  shown,
  send,
}: {
  card: WhyCard;
  tipKey: string;
  shown: string | null;
  send: (event: TipEvent) => void;
}) {
  const baseId = useId();
  const values = factorPpm(card);
  return (
    <dl className="relative col-span-full grid grid-cols-5 gap-1 min-[412px]:col-start-2">
      {FACTORS.map((factor) => {
        const key = `${tipKey}:${factor}`;
        const id = `${baseId}-${factor}`;
        const open = shown === key;
        const effect = factorEffect(values[factor]);
        return (
          <div
            className={`grid min-w-0 gap-0.5 rounded-lg px-1.5 py-1 ${open ? "bg-board-deep/85 outline outline-1 outline-brass" : "bg-board-deep/55"}`}
            key={factor}
            onMouseEnter={() => send({ type: "enter", key })}
            onMouseLeave={() => send({ type: "leave", key })}
          >
            <dt className="min-w-0 truncate text-label font-semibold text-ink-dim">
              <button
                aria-describedby={id}
                className="cursor-help underline decoration-dotted underline-offset-[3px] focus-visible:rounded-[3px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass"
                onBlur={() => send({ type: "blur", key })}
                onClick={() => send({ type: "focus", key })}
                onFocus={() => send({ type: "focus", key })}
                type="button"
              >
                {factor}
              </button>
            </dt>
            <dd
              className={`text-small font-extrabold tabular-nums ${effect.trend === "up" ? "text-moss" : effect.trend === "down" ? "text-brick" : "text-ink-faint"}`}
            >
              {effect.text}
            </dd>
            {/* Spans the whole strip, just below it, so it never runs off a narrow screen. */}
            <span
              className={`absolute inset-x-0 top-[calc(100%+6px)] z-10 rounded-xl border border-line bg-panel-2 px-3 py-2 text-small text-ink shadow-[0_8px_20px_rgb(0_0_0/45%)] ${open ? "block" : "hidden"}`}
              id={id}
              role="tooltip"
            >
              {FACTOR_EXPLANATIONS[factor]}
            </span>
          </div>
        );
      })}
    </dl>
  );
}

function CardRow({
  card,
  rating,
  open,
  tipKey,
  shown,
  send,
}: {
  card: WhyCard;
  /** This match's rating, from its full time. */
  rating: number | null;
  open: boolean;
  tipKey: string;
  shown: string | null;
  send: (event: TipEvent) => void;
}) {
  const power = matchPower(card);
  const band = powerBand(power);
  const notes = [
    card.inGoal && "in goal",
    card.trialist && "trialist",
    card.injured && "injured",
    card.handicapPpm !== PPM && `handicap ×${handicapText(card.handicapPpm)}`,
    card.goals > 0 && plural(card.goals, "goal"),
    card.assists > 0 && plural(card.assists, "assist"),
  ].filter(Boolean);
  return (
    <li
      className={`grid items-center gap-x-3 gap-y-2 rounded-xl bg-panel-2/80 p-2 ${rating === null ? "grid-cols-[3.25rem_minmax(0,1fr)]" : "grid-cols-[3.25rem_minmax(0,1fr)_auto]"}`}
    >
      <p
        className={`grid min-h-10 place-items-center rounded-lg border text-body font-semibold tabular-nums ${band.pill}`}
      >
        {power.toFixed(2)}
        <span className="sr-only"> power, {band.word}</span>
      </p>
      <div className="grid min-w-0 gap-1">
        <p className="text-body font-semibold [overflow-wrap:anywhere]">
          {card.label.text}
          {card.label.owner !== undefined && (
            <span className="sr-only"> ({card.label.owner}&rsquo;s)</span>
          )}
        </p>
        <p className="text-small text-ink-dim">
          {archetypeLabel(card.archetype)} &middot; {card.ovr}
          {notes.length > 0 && ` · ${notes.join(", ")}`}
        </p>
        <svg
          aria-hidden="true"
          className="block h-1 w-full"
          preserveAspectRatio="none"
          viewBox="0 0 100 4"
        >
          <rect className="fill-board" height="4" rx="2" width="100" />
          <rect className="fill-report-bar" height="4" rx="2" width={powerBarWidth(power)} />
          <rect className="fill-ink-dim" height="4" width="0.8" x="49.6" />
        </svg>
      </div>
      {rating !== null && <MidweekRatingDisc context="for this match" rating={rating} />}
      {open && <FactorStrip card={card} send={send} shown={shown} tipKey={tipKey} />}
    </li>
  );
}

const RAIL = ["border-t-team-0-fill", "border-t-team-1-fill"] as const;

export function MidweekWhyList({
  why,
  ratings = null,
}: {
  why: readonly [WhySide, WhySide];
  /** Each card's rating for this match by side and slot, from its full time (ADR-117, ADR-150). */
  ratings?: readonly [readonly number[], readonly number[]] | null;
}) {
  const [open, setOpen] = useState(false);
  const [tips, setTips] = useState<Tips>(NO_TIPS);
  const send = (event: TipEvent) => setTips((current) => nextTips(current, event));
  const shown = shownTip(tips);

  // Escape closes an explanation wherever the pointer or focus is (WCAG 1.4.13).
  useEffect(() => {
    if (!shown) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setTips((current) => nextTips(current, { type: "escape" }));
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [shown]);

  const left = Math.round(why[0].winChancePpm / 10_000);
  const chances = [left, 100 - left] as const;
  return (
    <section aria-labelledby="teams-h" className="grid min-w-0 content-start gap-4">
      {/* On a phone the Teams tab names it; from `lg`, beside Match, the heading shows. */}
      <h2 className="sr-only text-heading font-semibold lg:not-sr-only" id="teams-h">
        Teams
      </h2>
      <div className="grid gap-1.5">
        <p className="text-small text-ink-dim">Chances before kick-off</p>
        <svg
          aria-label={`Before kick-off: ${why[0].club} ${chances[0]}%, ${why[1].club} ${chances[1]}%`}
          className="block h-2 w-full overflow-hidden rounded"
          preserveAspectRatio="none"
          role="img"
          viewBox="0 0 100 8"
        >
          <rect className="fill-team-0-fill" height="8" width={chances[0]} />
          <rect className="fill-team-1-fill" height="8" width={chances[1]} x={chances[0]} />
        </svg>
        <p
          aria-hidden="true"
          className="flex justify-between text-small font-semibold tabular-nums"
        >
          <span className={TEAM_TEXT[0]}>{chances[0]}%</span>
          <span className={TEAM_TEXT[1]}>{chances[1]}%</span>
        </p>
      </div>
      {ratings && (
        <p className="flex flex-wrap items-center gap-x-3 gap-y-2 text-small text-ink-dim">
          <span
            aria-hidden="true"
            className={`rounded-md border px-1.5 font-semibold tabular-nums ${powerBand(1.19).pill}`}
          >
            1.19
          </span>
          Power going in
          <span
            aria-hidden="true"
            className="grid h-7 w-7 place-items-center rounded-full border-[1.5px] border-ink-dim text-label font-semibold text-ink tabular-nums"
          >
            7.2
          </span>
          Rating, out of 10
        </p>
      )}
      {why.map((side, s) => (
        <section
          aria-label={`${side.manager}’s five`}
          className={`grid min-w-0 gap-2 rounded-2xl border border-t-[3px] border-line/60 bg-panel/60 p-4 ${RAIL[s]}`}
          key={s}
        >
          <h3 className={`text-body font-semibold [overflow-wrap:anywhere] ${TEAM_TEXT[s]}`}>
            {side.club}
          </h3>
          <p className="text-small text-ink-dim">
            {[
              `${chances[s]}% before kick-off`,
              side.auto && "auto squad",
              side.keeperless && "no keeper",
              ...side.shortLines.map(({ line, short }) => `${line} ${short} short`),
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
          <ul className="grid gap-1.5">
            {side.cards
              .map((card, slot) => ({ card, slot }))
              .sort((a, b) => matchPower(b.card) - matchPower(a.card) || a.slot - b.slot)
              .map(({ card, slot }) => (
                <CardRow
                  card={card}
                  key={slot}
                  open={open}
                  rating={ratings?.[s]?.[slot] ?? null}
                  send={send}
                  shown={shown}
                  tipKey={`${s}:${slot}`}
                />
              ))}
          </ul>
        </section>
      ))}
      <div className="flex flex-wrap items-center justify-between gap-x-4">
        <button
          aria-expanded={open}
          className={`inline-flex min-h-11 items-center rounded-md text-small font-semibold text-brass hover:underline ${FOCUS}`}
          onClick={() => {
            setOpen((value) => !value);
            send({ type: "reset" });
          }}
          type="button"
        >
          {open ? "Hide the factors" : "Show every factor"}
        </button>
        <InfoLink href="/how-it-works#power">How Power works</InfoLink>
      </div>
    </section>
  );
}
