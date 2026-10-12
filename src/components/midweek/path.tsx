import Link from "next/link";
import { FOCUS } from "@/components/ui/page";
import { Tag } from "@/components/ui/tag";
import { formatClock } from "@/lib/midweek/entry";
import { roundName, type PathRow } from "@/lib/midweek/evening";
import { keepScores } from "./player-name";

/** A round's row: what happened (or happens next) and where. */
function rowWords(row: PathRow, rounds: number): { title: string; meta: string } {
  const where = roundName(row.round, rounds);
  switch (row.kind) {
    case "bye":
      return { title: "Bye", meta: where };
    case "won":
      return { title: `Beat ${row.opponent} ${row.score}`, meta: where };
    case "out":
      return { title: `Lost to ${row.opponent} ${row.score}`, meta: where };
    case "live":
      return { title: `Playing ${row.opponent} now`, meta: `${where} · live` };
    case "next":
      return {
        title: row.opponent ? `Next: ${row.opponent}` : "Next: to be decided",
        meta: `${where} · ${formatClock(row.revealAt)}`,
      };
  }
}

const ROW = "grid min-h-14 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-2.5";

/**
 * `MidweekPath`, "Round by round" (DR5-14): one link row per round, the
 * report of a match played or in play, the next match's pre-match once both
 * its feeders have ended (`preMatch`, DR4-7, ADR-149). A bye is a row without
 * a link. The coins on the right: what a round paid, or what a win would pay.
 */
export function MidweekPath({
  rows,
  rounds,
  weekStart,
  preMatch = null,
}: {
  rows: readonly PathRow[];
  rounds: number;
  weekStart: string;
  /** The next match's pre-match, once both its feeders have ended. */
  preMatch?: string | null;
}) {
  return (
    <ol aria-label="Your night" className="grid">
      {rows.map((row) => {
        const { title, meta } = rowWords(row, rounds);
        const coins =
          row.kind === "out"
            ? ""
            : row.kind === "next" || row.kind === "live"
              ? `win +${row.coins}`
              : `+${row.coins}`;
        const href =
          row.kind === "won" || row.kind === "out" || row.kind === "live"
            ? `/midweek/${weekStart}/match/${row.matchId}`
            : row.kind === "next"
              ? preMatch
              : null;
        const body = (
          <>
            <span className="grid min-w-0 gap-0.5">
              <span
                className={`text-body ${row.kind === "out" ? "text-ink-dim" : "font-semibold"}`}
              >
                {keepScores(title)}
              </span>
              <span className="text-small text-ink-dim">{meta}</span>
            </span>
            <span className="flex items-center gap-2 text-small whitespace-nowrap tabular-nums">
              {row.kind === "live" && <Tag tone="live">Live</Tag>}
              <span
                className={
                  row.kind === "won" || row.kind === "bye"
                    ? "font-semibold text-brass"
                    : "text-ink-dim"
                }
              >
                {coins}
              </span>
              {href && (
                <span aria-hidden="true" className="text-body text-ink-faint">
                  ›
                </span>
              )}
            </span>
          </>
        );
        return (
          <li className="border-b border-line/40 last:border-b-0" key={`${row.kind}-${row.round}`}>
            {href ? (
              <Link className={`${ROW} rounded-md hover:text-brass ${FOCUS}`} href={href}>
                {body}
              </Link>
            ) : (
              <div className={ROW}>{body}</div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
