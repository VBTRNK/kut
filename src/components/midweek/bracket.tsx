import { Block } from "@/components/ui/block";
import { Tag } from "@/components/ui/tag";
import { formatClock } from "@/lib/midweek/entry";
import { treeGroupRows, type BracketPair, type BracketRound } from "@/lib/midweek/evening";
import { MidweekMatchRow, type RowCall } from "./match-row";

/** Pairs 2k and 2k + 1, whose winners meet next (§44.6). */
function groups(pairs: readonly BracketPair[]): BracketPair[][] {
  const out: BracketPair[][] = [];
  for (let index = 0; index < pairs.length; index += 2) out.push(pairs.slice(index, index + 2));
  return out;
}

const hasYou = (pair: BracketPair, you: string | null) =>
  you !== null && pair.sides.some((side) => !side.placeholder && side.userId === you);

const TREE_COLS: Record<number, string> = {
  1: "lg:grid-cols-1",
  2: "lg:grid-cols-2",
  3: "lg:grid-cols-3",
  4: "lg:grid-cols-4",
  5: "lg:grid-cols-5",
  6: "lg:grid-cols-6",
};

/**
 * The tree's rows (KB-031): a header, then one equal row per round-1 pairing.
 * An auto-height grid sizes every `1fr` row to the tallest, so a bye's row is
 * as tall as a match's. Literal class names, because the CSP forbids inline
 * styles and Tailwind only generates classes it finds in the source.
 */
const TREE_ROWS: Record<number, string> = {
  1: "lg:grid-rows-[auto_repeat(1,1fr)]",
  2: "lg:grid-rows-[auto_repeat(2,1fr)]",
  4: "lg:grid-rows-[auto_repeat(4,1fr)]",
  8: "lg:grid-rows-[auto_repeat(8,1fr)]",
  16: "lg:grid-rows-[auto_repeat(16,1fr)]",
  32: "lg:grid-rows-[auto_repeat(32,1fr)]",
};

const ROW_START: Record<number, string> = {
  2: "row-start-2",
  4: "row-start-4",
  6: "row-start-6",
  8: "row-start-8",
  10: "row-start-10",
  12: "row-start-12",
  14: "row-start-14",
  16: "row-start-16",
  18: "row-start-18",
  20: "row-start-20",
  22: "row-start-22",
  24: "row-start-24",
  26: "row-start-26",
  28: "row-start-28",
  30: "row-start-30",
  32: "row-start-32",
};

const ROW_SPAN: Record<number, string> = {
  1: "row-span-1",
  2: "row-span-2",
  4: "row-span-4",
  8: "row-span-8",
  16: "row-span-16",
  32: "row-span-32",
};

/** A round is listed on a phone from 15 minutes before its kick-off (DR5-14). */
const SOON_MS = 15 * 60_000;

/**
 * `MidweekBracket` (DR5-14). Below `lg`, a block per round, the latest round
 * first, each saying `Live`, `Played` or its kick-off; a round more than 15
 * minutes from its kick-off is left out until then. From `lg`, every round as
 * a tree, one column per round (DR2-4, DR4-10), on the type scale. Every
 * pairing shows its state: kick-off, live with the score so far (ADR-148),
 * full time, or a bye (ADR-113). Your path is brass in both; names are
 * neutral.
 *
 * The tree keeps round headings and the same labelled match rows, so a
 * screen reader has the bracket at every width (ADR-098). `calls` puts a
 * member's calls on their rows, keyed `round/pairing` (ADR-118).
 */
export function MidweekBracket({
  rounds,
  you,
  weekStart,
  now,
  calls,
}: {
  rounds: readonly BracketRound[];
  you: string | null;
  weekStart: string;
  now: Date;
  calls?: ReadonlyMap<string, RowCall>;
}) {
  const total = rounds.length;
  const callOf = (pair: BracketPair) => calls?.get(`${pair.round}/${pair.pairing}`) ?? null;
  const listed = [...rounds]
    .reverse()
    .filter((round) => Date.parse(round.kickoffAt) <= now.getTime() + SOON_MS);
  return (
    <>
      <div className="grid gap-4 lg:hidden">
        {listed.map((round) => {
          const live = round.pairs.some((pair) => pair.kind === "inplay");
          const started = Date.parse(round.kickoffAt) <= now.getTime();
          return (
            <div className="scroll-mt-6" id={`round-${round.round}`} key={round.round}>
              <Block
                aside={
                  live ? (
                    <Tag tone="live">Live</Tag>
                  ) : (
                    <p className="text-small text-ink-dim tabular-nums">
                      {started ? "Played" : `Kick-off ${formatClock(round.kickoffAt)}`}
                    </p>
                  )
                }
                id={`round-${round.round}-h`}
                title={round.name}
              >
                <ol className="grid gap-2 sm:grid-cols-2">
                  {round.pairs.map((pair) => (
                    <li key={pair.pairing}>
                      <MidweekMatchRow
                        call={callOf(pair)}
                        pair={pair}
                        weekStart={weekStart}
                        you={you}
                      />
                    </li>
                  ))}
                </ol>
              </Block>
            </div>
          );
        })}
      </div>

      <div
        className={`hidden gap-x-7 lg:grid ${TREE_COLS[total] ?? "lg:grid-cols-6"} ${TREE_ROWS[2 ** (total - 1)] ?? ""}`}
        data-testid="bracket-tree"
      >
        {rounds.map((round, column) => (
          <section
            aria-labelledby={`tree-round-${round.round}-h`}
            className="row-span-full grid min-w-0 grid-rows-subgrid"
            key={round.round}
          >
            <div className="row-start-1 mb-3 grid gap-0.5 border-b border-line/50 pb-2">
              <h2 className="text-heading font-semibold" id={`tree-round-${round.round}-h`}>
                {round.name}
              </h2>
              <p className="text-small text-ink-dim tabular-nums">
                Kick-off {formatClock(round.kickoffAt)}
              </p>
            </div>
            {groups(round.pairs).map((group, index) => {
              const mine = group.some((pair) => hasYou(pair, you));
              const last = column === total - 1;
              const { rowStart, rowSpan } = treeGroupRows(round.round, index, group.length);
              return (
                // Two equal rows (DR4-10, #216): a two-line match beside a
                // one-line bye stays as tall, so the line meets both middles.
                <div
                  className={`relative grid ${group.length === 2 ? "grid-rows-2" : "grid-rows-1"} ${ROW_START[rowStart] ?? ""} ${ROW_SPAN[rowSpan] ?? ""} ${
                    last
                      ? ""
                      : `after:absolute after:top-1/4 after:-right-[15px] after:bottom-1/4 after:w-3.5 after:rounded-r-md after:border-2 after:border-l-0 after:content-[''] ${mine ? "after:border-brass" : "after:border-line"}`
                  }`}
                  data-tree-group={`${round.round}/${index}`}
                  key={index}
                >
                  {group.map((pair) => (
                    <div
                      className={`relative flex items-center py-[5px] ${
                        column > 0
                          ? `before:absolute before:top-1/2 before:-left-3.5 before:w-[13px] before:border-t-2 before:content-[''] ${hasYou(pair, you) ? "before:border-brass" : "before:border-line"}`
                          : ""
                      }`}
                      data-tree-pair={`${round.round}/${pair.pairing}`}
                      key={pair.pairing}
                    >
                      <div className="w-full">
                        <MidweekMatchRow
                          call={callOf(pair)}
                          dense
                          pair={pair}
                          weekStart={weekStart}
                          you={you}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </section>
        ))}
      </div>
    </>
  );
}
