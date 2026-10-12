import type { Side } from "@/game/midweek/match";
import type { Segment } from "@/lib/midweek/report/types";

/** A side's team colour as text (DR3 HANDOFF §5): side 0 violet, side 1 teal. */
export const TEAM_TEXT = ["text-team-0", "text-team-1"] as const;

/**
 * `PlayerName` (HANDOFF "Matches", DR5-4): a Player or manager in their side's
 * colour, on a match page only (DR2-1), at the weight of the line it sits in.
 * A Player both sides fielded shows its base name; screen readers still hear
 * whose copy it is.
 */
export function PlayerName({
  side,
  owner,
  children,
}: {
  side: Side;
  owner?: string;
  children: string;
}) {
  return (
    <span className={TEAM_TEXT[side]}>
      {children}
      {owner !== undefined && <span className="sr-only"> ({owner}&rsquo;s)</span>}
    </span>
  );
}

/** A score such as "3–0" never breaks at its dash: word joiners hold it together. */
export const keepScores = (text: string) => text.replace(/(\d)–(\d)/g, "$1\u2060–\u2060$2");

/**
 * A line of report text from the renderer's segments, every name in its side's
 * colour. `plain` (a report's headline, DR5-15): ink throughout, names too.
 */
export function ReportText({
  parts,
  plain = false,
}: {
  parts: readonly Segment[];
  plain?: boolean;
}) {
  return parts.map((part, index) =>
    part.side === undefined ? (
      keepScores(part.text)
    ) : plain ? (
      <span key={index}>
        {part.text}
        {part.owner !== undefined && <span className="sr-only"> ({part.owner}&rsquo;s)</span>}
      </span>
    ) : (
      <PlayerName key={index} owner={part.owner} side={part.side}>
        {part.text}
      </PlayerName>
    ),
  );
}
