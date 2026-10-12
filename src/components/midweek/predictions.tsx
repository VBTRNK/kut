"use client";

import { useState, type ReactNode } from "react";
import { saveMidweekCall } from "@/app/(app)/midweek/actions";
import { Block } from "@/components/ui/block";
import { InfoLink } from "@/components/ui/links";
import { FOCUS } from "@/components/ui/page";
import { Tag } from "@/components/ui/tag";
import { BRAND } from "@/lib/brand";
import { callError, settledStatus, type CallCard, type CallSide } from "@/lib/midweek/calls";
import { formatClock } from "@/lib/midweek/entry";
import { useReached } from "./use-server-time";

/** Where a call leads (DR5-14): `Pre-match ›` while open, `Watch it ›` in play, `Report ›` once ended. */
export type CallLink = { label: string; href: string };

/**
 * `MidweekPredictSplit`: how the club called a match, from its kick-off.
 * Counts only, in neutral steel and the line colour; with no picks at all, a
 * line instead of a bar.
 */
export function MidweekPredictSplit({
  split,
  sides,
}: {
  split: readonly [number, number];
  sides: readonly [CallSide, CallSide];
}) {
  const [a, b] = split;
  if (a + b === 0) return <p className="text-small text-ink-faint">Nobody called this one.</p>;
  const left = Math.round((a / (a + b)) * 100);
  return (
    <div className="grid gap-1">
      <svg
        aria-label={`${a} picked ${sides[0].name}, ${b} picked ${sides[1].name}`}
        className="block h-1.5 w-full overflow-hidden rounded"
        preserveAspectRatio="none"
        role="img"
        viewBox="0 0 100 6"
      >
        {a > 0 && (
          <rect className="fill-steel" height="6" width={Math.max(0, left - (b > 0 ? 0.6 : 0))} />
        )}
        {b > 0 && (
          <rect
            className="fill-line"
            height="6"
            width={Math.max(0, 100 - left - (a > 0 ? 0.6 : 0))}
            x={Math.min(100, left + (a > 0 ? 0.6 : 0))}
          />
        )}
      </svg>
      <p
        aria-hidden="true"
        className="flex justify-between gap-2 text-small text-ink-dim tabular-nums"
      >
        <span>{a} picked</span>
        <span>{b} picked</span>
      </p>
    </div>
  );
}

/** What the card says after the member's own tap; null shows the state the page rendered. */
type Tap =
  | { kind: "saving"; side: 0 | 1 }
  | { kind: "saved"; at: string }
  | { kind: "changed"; at: string }
  | { kind: "cleared" }
  | null;

const OK = "text-moss";

/**
 * `MidweekPredictCard` (DR3 HANDOFF §2, DR5-14): one later match the member
 * is not in, as a block of its own; an open one not called yet is the brass
 * block. Two toggle buttons, not radios, so a pick can be cleared (DR3-5): a
 * tap saves at once, tapping the other name changes it, tapping your pick
 * again clears it. No submit. Neutral, because a list of matches gets no team
 * colours (DR2-1). An open card closes itself at kick-off on the corrected
 * clock, from the server's render time `at` (ADR-149); the trigger still
 * refuses a late call. `link` leads to the match (DR5-14).
 */
function MidweekPredictCard({
  card: rendered,
  tournamentId,
  coins,
  paid,
  at,
  link,
}: {
  card: CallCard;
  tournamentId: string;
  coins: number;
  paid: boolean;
  at: string | null;
  link: CallLink | null;
}) {
  const kickedOff = useReached(rendered.kickoffAt, rendered.state === "open" ? at : null);
  const card: CallCard = kickedOff ? { ...rendered, state: "closed" } : rendered;
  const [pick, setPick] = useState(card.pick);
  const [serverPick, setServerPick] = useState(card.pick);
  const [tap, setTap] = useState<Tap>(null);
  const [error, setError] = useState<string | null>(null);
  // A newer render from the server (the page polls while a match is in play)
  // wins over a stale local pick, unless a save is on its way.
  if (card.pick !== serverPick) {
    setServerPick(card.pick);
    if (tap?.kind !== "saving") {
      setPick(card.pick);
      setTap(null);
    }
  }

  const kickoff = formatClock(card.kickoffAt);
  const name = (side: 0 | 1) => card.sides[side].name;
  const notyet = card.state === "notyet";
  const closed = card.state === "closed" || card.state === "ended";
  const saving = tap?.kind === "saving";
  const shownPick = saving ? tap.side : pick;

  async function choose(side: 0 | 1) {
    if (notyet || closed || saving) return;
    const target = pick === side ? null : side;
    const previous = pick;
    setTap({ kind: "saving", side });
    setError(null);
    let result: Awaited<ReturnType<typeof saveMidweekCall>>;
    try {
      result = await saveMidweekCall(
        tournamentId,
        card.round,
        card.pairing,
        target === null ? null : card.sides[target].userId,
      );
    } catch {
      result = { ok: false, message: null };
    }
    if (result.ok) {
      setPick(target);
      setTap(
        target === null
          ? { kind: "cleared" }
          : previous === null
            ? { kind: "saved", at: result.savedAt }
            : { kind: "changed", at: result.savedAt },
      );
    } else {
      setTap(null);
      setError(
        callError(result.message, card.kickoffAt, previous === null ? null : name(previous)),
      );
    }
  }

  let status: ReactNode;
  if (tap?.kind === "saving") status = "Saving your pick…";
  else if (kickedOff) status = settledStatus({ ...card, pick }, paid, coins);
  else if (tap?.kind === "cleared")
    status = `Pick cleared. Tap a name to call it. Closes at kick-off, ${kickoff}.`;
  else if ((tap?.kind === "saved" || tap?.kind === "changed") && pick !== null)
    status = (
      <>
        <span className={OK}>
          ✓ {tap.kind === "saved" ? "Saved" : `Changed to ${name(pick)},`} {formatClock(tap.at)}.
        </span>{" "}
        Change it until kick-off, {kickoff}; tap {name(pick)} again to clear it.
      </>
    );
  else if (card.state === "ended" && card.pick !== null)
    // The tag on the right says right or wrong; the line says who won and what it pays.
    status =
      card.pick === card.winner
        ? `${name(card.winner)} won. +${coins} ${BRAND.currency}${paid ? "" : " after the final"}.`
        : `${name(card.winner ?? 0)} won.`;
  else status = settledStatus({ ...card, pick }, paid, coins);

  let aside: ReactNode;
  if (card.live) aside = <Tag tone="live">Live</Tag>;
  else if (card.state === "ended") {
    aside =
      card.pick === null ? null : card.pick === card.winner ? (
        <Tag tone="won">✓ Right</Tag>
      ) : (
        <Tag tone="out">Wrong</Tag>
      );
  } else {
    aside = (
      <p className="text-small text-ink-dim tabular-nums">
        {closed ? "Closed" : `Kick-off ${kickoff}`}
      </p>
    );
  }

  return (
    <li>
      <Block
        aside={aside}
        className={notyet ? "border-dashed" : ""}
        id={`call-${card.round}-${card.pairing}`}
        title={card.label}
        tone={card.state === "open" && pick === null && !saving ? "now" : "plain"}
      >
        <div
          aria-busy={saving || undefined}
          aria-label={`${card.label}, kick-off ${kickoff}. Who wins?`}
          className="grid min-w-0 gap-3"
          role="group"
        >
          <div className="grid grid-cols-2 gap-2">
            {([0, 1] as const).map((side) => {
              const mine = shownPick === side;
              const busy = saving && tap.side === side;
              const won = card.state === "ended" && card.winner === side;
              const unsettled = card.sides[side].userId === null;
              return (
                <button
                  aria-pressed={mine}
                  className={`grid min-h-12 min-w-0 content-center rounded-xl border px-3 py-2 text-left disabled:cursor-default ${FOCUS} ${
                    mine ? "border-brass bg-brass-bg" : "border-line"
                  } ${notyet ? "border-dashed" : ""} ${saving && !busy ? "opacity-55" : ""}`}
                  disabled={notyet || closed || saving}
                  key={side}
                  onClick={() => choose(side)}
                  type="button"
                >
                  <span
                    className={`text-body [overflow-wrap:anywhere] ${
                      mine
                        ? "font-semibold text-brass"
                        : unsettled || closed
                          ? "text-ink-dim"
                          : "text-ink"
                    }`}
                  >
                    {name(side)}
                  </span>
                  {busy ? (
                    <span className="text-label font-semibold text-brass">Saving…</span>
                  ) : mine ? (
                    <span className="text-label font-semibold text-brass">Your pick</span>
                  ) : null}
                  {won && <span className="text-label font-semibold text-moss">✓ Won</span>}
                </button>
              );
            })}
          </div>
          {card.split && <MidweekPredictSplit sides={card.sides} split={card.split} />}
          <p aria-live="polite" className="text-small text-pretty text-ink-dim">
            {status}
          </p>
          {error && (
            <p className="text-small text-brick" role="alert">
              {error}
            </p>
          )}
          {link && <InfoLink href={link.href}>{link.label}</InfoLink>}
        </div>
      </Block>
    </li>
  );
}

/**
 * `MidweekPredictions` (DR3 HANDOFF §2, ADR-118, DR5-14): on the Calls page
 * from the moment the member is out, and on a match's pre-match for that
 * match (DR4-7, ADR-149). One block per later match. `at` is the server's
 * render time, for the cards' kick-off timers; `links` (keyed
 * `round/pairing`) lead each call to its match.
 */
export function MidweekPredictions({
  cards,
  tournamentId,
  coins,
  paid = false,
  at = null,
  links,
}: {
  cards: readonly CallCard[];
  tournamentId: string;
  coins: number;
  paid?: boolean;
  at?: string | null;
  links?: ReadonlyMap<string, CallLink>;
}) {
  return (
    <ol aria-label="Calls" className="grid gap-4">
      {cards.map((card) => {
        const key = `${card.round}/${card.pairing}`;
        return (
          <MidweekPredictCard
            at={at}
            card={card}
            coins={coins}
            key={key}
            link={links?.get(key) ?? null}
            paid={paid}
            tournamentId={tournamentId}
          />
        );
      })}
    </ol>
  );
}
