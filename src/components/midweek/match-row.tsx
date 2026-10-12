import Link from "next/link";
import { FOCUS } from "@/components/ui/page";
import { Tag } from "@/components/ui/tag";
import { formatClock } from "@/lib/midweek/entry";
import { pairSentence, sideScore, type BracketPair, type BracketSlot } from "@/lib/midweek/evening";
import { preMatchHref } from "@/lib/midweek/prematch";
import { MidweekRowMinute } from "./match-clock";

/** A call on a bracket row (DR3 HANDOFF §2): the bracket shows calls, it never takes them. */
export type RowCall = { kind: "picked"; name: string } | { kind: "open" };

const callText = (call: RowCall) =>
  call.kind === "picked" ? `Your call: ${call.name}` : "Call open";

function Side({
  slot,
  tone,
  score,
  dense,
}: {
  slot: BracketSlot;
  tone: string;
  score: string | null;
  dense: boolean;
}) {
  return (
    <span className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
      {/* One line, cut with an ellipsis; the group's label names it whole (DR4-9). */}
      <span className={`truncate ${dense ? "text-small" : "text-body"} ${tone}`}>{slot.name}</span>
      {score !== null && (
        <span className={`tabular-nums ${dense ? "text-small" : "text-body"} ${tone}`}>
          {score}
        </span>
      )}
    </span>
  );
}

/**
 * `MidweekMatchRow` (DR5-14, DR4-6), neutral, never in team colours (DR2-1):
 * two club lines with their scores (pens in brackets), the state on the right
 * (the minute or `Pens` while it plays, the kick-off, `Pre-match` once both
 * clubs are settled, ADR-149), your pairing in brass with a `You` tag under
 * the names. The whole row is one link: its report, the match live
 * (ADR-148), or its pre-match. Each row is a group with one full sentence as its name; `dense`
 * is the desktop tree's box. For a member who is out, a later match carries
 * their call or `Call open`, read-only (ADR-118); the call is made on its
 * pre-match (DR4-7).
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
  const live = pair.kind === "inplay" ? pair.live : null;
  const [a, b] = pair.sides.map((side) => side.name);

  const score = (index: 0 | 1): string | null => {
    if (pair.kind === "played") {
      const side = sideScore(pair.match, index);
      return `${side.goals}${side.penalties !== null ? ` (${side.penalties})` : ""}`;
    }
    if (pair.kind === "inplay") {
      if (!live) return "–";
      return `${live.goals[index]}${live.penalties ? ` (${live.penalties[index]})` : ""}`;
    }
    return null;
  };
  const tone = (index: 0 | 1): string => {
    if (pair.kind === "bye") return "text-ink-dim";
    if (pair.kind === "played") {
      return pair.match.winner_side === index ? "font-semibold text-ink" : "text-ink-faint";
    }
    return pair.sides[index].placeholder ? "text-ink-faint" : "text-ink";
  };

  let link: { href: string; label: string } | null = null;
  let state = null;
  if (pair.kind === "played") {
    link = {
      href: `/midweek/${weekStart}/match/${pair.match.match_id}`,
      label: `Match report: ${sentence}`,
    };
  } else if (pair.kind === "inplay") {
    link = {
      href: `/midweek/${weekStart}/match/${pair.match.match_id}`,
      label: `Watch it: ${a} v ${b}`,
    };
    state = (
      <Tag tone="live">
        {live?.penalties ? (
          "Pens"
        ) : live ? (
          <MidweekRowMinute clock={live.clock} minute={live.minute} />
        ) : (
          "Live"
        )}
      </Tag>
    );
  } else if (pair.kind === "upcoming") {
    const time = formatClock(pair.kickoffAt);
    if (pair.preMatch) {
      // Both clubs settled: the row opens the pre-match (DR4-6, DR4-7, ADR-149).
      link = {
        href: preMatchHref(weekStart, pair.round, pair.pairing),
        label: `Pre-match: ${a} v ${b}, kick-off ${time}`,
      };
    }
    state = (
      <span className="grid justify-items-end text-small whitespace-nowrap">
        <span className="text-ink-dim tabular-nums">{time}</span>
        {pair.preMatch && <span className="font-semibold text-brass">Pre-match</span>}
      </span>
    );
  } else {
    state = <span className="text-small text-ink-faint">Bye</span>;
  }

  const frame = `grid grid-cols-[minmax(0,1fr)_auto] items-center rounded-xl border ${
    dense ? "gap-2 px-2 py-1.5" : "min-h-14 gap-2 px-2.5 py-2"
  } ${pair.kind === "bye" ? "border-dashed" : ""} ${
    isYou ? "border-brass-line bg-brass-bg/30" : "border-line/50 bg-panel/50"
  }`;
  const inner = (
    <>
      <span className="grid min-w-0 gap-0.5">
        <span aria-hidden="true" className="grid min-w-0 gap-0.5">
          <Side dense={dense} score={score(0)} slot={pair.sides[0]} tone={tone(0)} />
          {pair.kind !== "bye" && (
            <Side dense={dense} score={score(1)} slot={pair.sides[1]} tone={tone(1)} />
          )}
        </span>
        {(isYou || call) && (
          // Under the names, so a long club keeps its width: `You` (never colour
          // alone) and, once you're out, your call.
          <span className="flex flex-wrap gap-1.5 pt-1">
            {isYou && <Tag tone="you">You</Tag>}
            {call && <Tag tone="you">{callText(call)}</Tag>}
          </span>
        )}
      </span>
      {(state || link) && (
        <span className="flex items-center gap-2">
          {state}
          {link && (
            <span aria-hidden="true" className="text-body text-ink-faint">
              ›
            </span>
          )}
        </span>
      )}
    </>
  );

  return (
    <div aria-label={sentence} role="group">
      {link ? (
        <Link
          aria-label={call ? `${link.label}. ${callText(call)}` : link.label}
          className={`${frame} hover:border-brass-line ${FOCUS}`}
          href={link.href}
        >
          {inner}
        </Link>
      ) : (
        <div className={frame}>{inner}</div>
      )}
    </div>
  );
}
