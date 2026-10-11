import Link from "next/link";
import { formatClock } from "@/lib/midweek/entry";
import { pairSentence, sideScore, type BracketPair, type BracketSlot } from "@/lib/midweek/evening";
import { preMatchHref } from "@/lib/midweek/prematch";
import { Chip, LiveMarker } from "./chip";
import { MidweekRowMinute } from "./match-clock";

/** A call on a bracket row (DR3 HANDOFF §2): the bracket shows calls, it never takes them. */
export type RowCall = { kind: "picked"; name: string } | { kind: "open" };

function CallChip({ call, dense, href }: { call: RowCall; dense: boolean; href: string }) {
  return (
    <p
      className={`flex flex-wrap items-center gap-x-2 gap-y-1 ${dense ? "pb-1 pl-2" : "pb-2.5 pl-3"}`}
    >
      <span
        className={`inline-flex items-center rounded-full border px-2 py-px text-[10.5px] font-black tracking-[0.06em] whitespace-nowrap uppercase ${
          call.kind === "picked"
            ? "border-brass-line bg-brass-bg text-brass"
            : "border-dashed border-line text-ink-dim"
        }`}
      >
        {call.kind === "picked" ? `✓ Your call: ${call.name}` : "Open to call"}
      </span>
      {call.kind === "open" && (
        <Link
          className="text-xs font-bold whitespace-nowrap text-brass hover:underline"
          href={href}
        >
          Call it &rarr;
        </Link>
      )}
    </p>
  );
}

function Side({
  slot,
  you,
  won,
  lost,
  bye,
  score,
  dense,
}: {
  slot: BracketSlot;
  you: boolean;
  won: boolean;
  lost: boolean;
  bye: boolean;
  score: { goals: number; penalties: number | null } | null;
  dense: boolean;
}) {
  const tone = slot.placeholder
    ? "text-ink-faint"
    : won
      ? "font-extrabold text-ink"
      : lost
        ? "text-ink-faint"
        : "text-ink";
  return (
    <p className="flex min-w-0 items-center gap-1.5">
      <span className={`min-w-[5ch] truncate ${tone}`}>{slot.name}</span>
      {won && <span className="font-black text-moss">✓</span>}
      {you && <Chip tone="you">You</Chip>}
      {/* The tree's box has no room for both chips and a score; `You` wins. */}
      {slot.auto && !(dense && you) && <Chip tone="auto">Auto</Chip>}
      {bye && <Chip>Bye</Chip>}
      {score && (
        <span className={`ml-auto pl-2 tabular-nums ${won ? "font-black" : "font-bold"}`}>
          {score.goals}
          {score.penalties !== null && (
            <small className="ml-[3px] text-[11px] font-bold text-ink-faint">
              ({score.penalties})
            </small>
          )}
        </span>
      )}
    </p>
  );
}

/**
 * `MidweekMatchRow` (HANDOFF "Bracket"), neutral, never in team colours
 * (DR2-1). Four states: `Kick-off 20:15` before a pairing starts, naming who
 * meet or where they come from (`Winner of Mila v Eline`), and once both are
 * settled `Pre-match` with a link to it (ADR-149); every match in
 * play as `Live` with the score so far beside each side, the minute (`64′`)
 * or `pens` with the kicks scored in brackets, and a link to watch it (DR4-6,
 * ADR-148); `Full time` with both scores, the winner ticked and a link to the
 * report; a bye as one dashed row that counts as a win. Each row is a group
 * with one full sentence as its name; `dense` is the desktop tree's box. For a
 * member who is out, a later match carries their call, read-only (ADR-118).
 */
export function MidweekMatchRow({
  pair,
  you,
  weekStart,
  dense = false,
  call = null,
}: {
  pair: BracketPair;
  you: string | null;
  weekStart: string;
  dense?: boolean;
  call?: RowCall | null;
}) {
  const mine = (slot: BracketSlot) => !slot.placeholder && you !== null && slot.userId === you;
  const isYou = pair.sides.some(mine);
  const sentence = pairSentence(pair);
  const frame =
    pair.kind === "bye"
      ? `border-dashed bg-transparent ${isYou ? "border-brass" : "border-line/70"}`
      : `bg-panel/55 ${isYou ? "border-brass shadow-[0_0_0_1px_rgb(224_172_74/25%)]" : "border-line/60"}`;
  const live = pair.kind === "inplay" ? pair.live : null;
  const sides = pair.sides.map((slot, index) => {
    const played = pair.kind === "played";
    const won = played && pair.match.winner_side === index;
    return (
      <Side
        bye={pair.kind === "bye"}
        dense={dense}
        key={index}
        lost={played && !won}
        score={
          played
            ? sideScore(pair.match, index as 0 | 1)
            : live
              ? { goals: live.goals[index], penalties: live.penalties?.[index] ?? null }
              : null
        }
        slot={slot}
        won={won}
        you={mine(slot)}
      />
    );
  });

  let state;
  if (pair.kind === "played") {
    state = (
      <Link
        aria-label={`Match report: ${sentence}`}
        className={`grid content-center gap-0.5 border-l border-line/40 font-bold text-ink-faint hover:bg-brass/10 ${dense ? "w-8 justify-items-center" : "min-w-11 justify-items-end px-3 text-xs"}`}
        href={`/midweek/${weekStart}/match/${pair.match.match_id}`}
      >
        {!dense && <span>Full time</span>}
        <b aria-hidden="true" className="text-lg leading-none font-black text-brass">
          ›
        </b>
      </Link>
    );
  } else if (pair.kind === "inplay") {
    state = (
      <Link
        aria-label={`Watch it: ${pair.sides[0].name} v ${pair.sides[1].name}`}
        className={`grid content-center gap-1 border-l border-line/40 hover:bg-brass/10 ${dense ? "justify-items-center px-1.5" : "grid-cols-[auto_auto] items-center gap-x-2 px-3"}`}
        href={`/midweek/${weekStart}/match/${pair.match.match_id}`}
      >
        <span className="grid justify-items-center gap-1">
          {dense ? (
            // The tree's column is narrow: the word alone, no dot or padding, so
            // a penalty tally beside the score is never covered (S8).
            <span className="rounded-full border border-live-line bg-live-bg px-1.5 py-px text-[10px] font-black tracking-[0.06em] text-live uppercase">
              Live
            </span>
          ) : (
            <LiveMarker />
          )}
          {live && (
            <span className="text-[11.5px] font-bold whitespace-nowrap text-live tabular-nums">
              {live.penalties ? (
                "pens"
              ) : (
                <MidweekRowMinute clock={live.clock} minute={live.minute} />
              )}
            </span>
          )}
        </span>
        {!dense && (
          <b aria-hidden="true" className="text-lg leading-none font-black text-brass">
            ›
          </b>
        )}
      </Link>
    );
  } else if (pair.kind === "upcoming" && pair.preMatch) {
    // Both clubs settled: the row opens the pre-match (DR4-6, DR4-7, ADR-149).
    const time = formatClock(pair.kickoffAt);
    state = (
      <Link
        aria-label={`Pre-match: ${pair.sides[0].name} v ${pair.sides[1].name}, kick-off ${time}`}
        className={`flex items-center gap-2 border-l border-line/40 hover:bg-brass/10 ${dense ? "" : "px-3"}`}
        href={preMatchHref(weekStart, pair.round, pair.pairing)}
      >
        {dense ? (
          <span className="grid content-center justify-items-center gap-0.5 px-1.5">
            <b className="text-[12.5px] font-black text-ink tabular-nums">{time}</b>
            <span className="text-[10px] font-extrabold text-brass">Pre &rsaquo;</span>
          </span>
        ) : (
          <>
            <span className="grid content-center justify-items-end gap-0.5 text-xs font-bold text-ink-faint">
              <span>Pre-match</span>
              <b className="text-[15px] font-black text-ink tabular-nums">{time}</b>
            </span>
            <b aria-hidden="true" className="text-lg leading-none font-black text-brass">
              ›
            </b>
          </>
        )}
      </Link>
    );
  } else if (pair.kind === "upcoming") {
    const time = formatClock(pair.kickoffAt);
    state = dense ? (
      <b className="self-center pr-2 text-[12.5px] font-black text-ink tabular-nums">{time}</b>
    ) : (
      <span className="grid content-center justify-items-end gap-0.5 pr-3 text-xs font-bold text-ink-faint">
        <span>Kick-off</span>
        <b className="text-[15px] font-black text-ink tabular-nums">{time}</b>
      </span>
    );
  } else {
    state = dense ? (
      <span />
    ) : (
      <span className="self-center pr-3 text-xs font-bold whitespace-nowrap text-ink-faint max-[359px]:hidden">
        counts as a win
      </span>
    );
  }

  return (
    <div
      aria-label={sentence}
      className={`grid grid-cols-[minmax(0,1fr)_auto] items-stretch gap-x-2 overflow-hidden rounded-xl border ${frame}`}
      role="group"
    >
      <div className="grid min-w-0 content-center">
        <div
          aria-hidden="true"
          className={`grid min-w-0 grid-cols-[minmax(0,1fr)] content-center gap-1 ${dense ? "py-1 pl-2 text-[12.5px] leading-[1.45]" : "py-2.5 pl-3 text-sm"}`}
        >
          {sides}
        </div>
        {call && (
          <CallChip
            call={call}
            dense={dense}
            // An open call is on the pairing's pre-match (DR4-7), where it can be made.
            href={
              pair.kind === "upcoming" && pair.preMatch
                ? preMatchHref(weekStart, pair.round, pair.pairing)
                : "/midweek#calls"
            }
          />
        )}
      </div>
      {state}
    </div>
  );
}
