import { Block } from "@/components/ui/block";
import type { RarityTier } from "@/game/rating-engine";
import { factorText } from "@/lib/midweek/evening";
import { FEW_OWNERS_LABEL } from "@/lib/midweek/report/render";

export type PickShareView = {
  playerId: string;
  name: string;
  /** From the locked OVR where the Player was entered; null when no entered card carries it. */
  rarity: RarityTier | null;
  picks: number;
  owners: number | null;
  pickFactorPpm: number;
};

function Table({ rows }: { rows: readonly PickShareView[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-small">
        <thead>
          <tr className="border-b border-line/60 text-left text-label font-semibold text-ink-faint">
            <th className="px-1.5 py-2" scope="col">
              Player
            </th>
            <th className="px-1.5 py-2 text-right" scope="col">
              Picked
            </th>
            <th className="px-1.5 py-2" scope="col">
              Owners
            </th>
            <th className="px-1.5 py-2 text-right" scope="col">
              Pick factor
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const factor = factorText(row.pickFactorPpm);
            return (
              <tr className="border-b border-line/30" key={row.playerId}>
                <td className="px-1.5 py-2">
                  <span className="flex items-center gap-2.5 font-semibold">
                    {row.rarity ? (
                      <span
                        aria-hidden="true"
                        className="tier-chip h-6 w-5 [&>span]:h-[0.55rem] [&>span]:w-[0.55rem]"
                        data-rarity={row.rarity}
                      >
                        <span />
                      </span>
                    ) : (
                      <span
                        aria-hidden="true"
                        className="h-6 w-5 flex-none rounded-[0.3rem] border-[1.5px] border-dashed border-line"
                      />
                    )}
                    {row.name}
                  </span>
                </td>
                <td className="px-1.5 py-2 text-right tabular-nums">{row.picks}</td>
                <td className="px-1.5 py-2 text-ink-dim">
                  {row.owners === null ? (
                    <span className="text-steel italic">{FEW_OWNERS_LABEL}</span>
                  ) : (
                    `of ${row.owners} owners`
                  )}
                </td>
                <td
                  className={`px-1.5 py-2 text-right font-semibold tabular-nums ${factor.trend === "up" ? "text-moss" : factor.trend === "down" ? "text-brick" : ""}`}
                >
                  {factor.trend !== "flat" && (
                    <i aria-hidden="true" className="mr-[3px] not-italic">
                      {factor.trend === "up" ? "▲" : "▼"}
                    </i>
                  )}
                  {factor.text}
                  {factor.trend !== "flat" && (
                    <span className="sr-only">
                      {factor.trend === "up" ? ", a boost" : ", a penalty"}
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/**
 * `MidweekPickShares`, "Who picked whom", once the week is complete (§44.9):
 * sorted by pick factor, biggest boost first; an owner count only at three
 * owners or more (ADR-091). One table in a block, Label heads (DR5-14).
 */
export function MidweekPickShares({
  rows,
  ownerCountMin,
}: {
  rows: readonly PickShareView[];
  ownerCountMin: number;
}) {
  const sorted = [...rows].sort(
    (a, b) => b.pickFactorPpm - a.pickFactorPpm || a.name.localeCompare(b.name),
  );
  return (
    <Block>
      <p className="text-small text-pretty text-ink-dim">
        How many managers picked each Player, out of the entrants who own one. The fewer who picked
        a Player, the bigger the boost. Auto squads don&rsquo;t count. Owners show from{" "}
        {ownerCountMin}.
      </p>
      <Table rows={sorted} />
    </Block>
  );
}
