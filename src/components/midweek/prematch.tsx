import { Inset } from "@/components/ui/block";
import { Tag } from "@/components/ui/tag";
import { LINE_NAMES } from "@/lib/midweek/plusses";
import { powerBand } from "@/lib/midweek/power";
import type { PreSide } from "@/lib/midweek/prematch";
import { MidweekMiniCard } from "./mini-card";
import { TEAM_TEXT } from "./player-name";

const RAIL = ["border-t-team-0-fill", "border-t-team-1-fill"] as const;

/**
 * `MidweekPreMatchFive` (Q2, DR4-7, DR5-14): one side's five before kick-off,
 * a block with its colour as a 3 px top rail. The club in its colour over
 * `{account}'s five` (DR4-11), the plusses per line (a short line in the
 * warning colour, with its count), then the cards strongest first, each with
 * the week's Power as the Why's pill, without the day roll. What Power is
 * sits behind `How Power works ›`.
 */
export function MidweekPreMatchFive({ side, s, you }: { side: PreSide; s: 0 | 1; you: boolean }) {
  return (
    <section
      aria-label={`${side.club}: the five`}
      className={`grid min-w-0 grid-cols-[minmax(0,1fr)] content-start gap-3 rounded-2xl border border-t-[3px] border-line/60 bg-panel/60 p-4 ${RAIL[s]}`}
    >
      <div className="grid gap-0.5">
        <h2 className={`text-body font-semibold [overflow-wrap:anywhere] ${TEAM_TEXT[s]}`}>
          {side.club}
        </h2>
        <p className="flex flex-wrap items-center gap-1.5 text-small text-ink-dim">
          {side.account}&rsquo;s five
          {you && <Tag tone="you">You</Tag>}
          {side.auto && <Tag tone="auto">Auto</Tag>}
        </p>
      </div>
      <dl aria-label="Plusses per line" className="grid grid-cols-3 gap-2">
        {side.lines.map((count, line) => {
          const short = side.short[line];
          return (
            <Inset className="grid gap-0.5" key={line}>
              <dt className="text-label font-semibold text-ink-faint">{LINE_NAMES[line]}</dt>
              <dd
                className={`text-body font-semibold tabular-nums ${short > 0 ? "text-warning" : "text-moss"}`}
              >
                {count} {short > 0 ? `· ${short} short` : "✓"}
                {short === 0 && <span className="sr-only"> enough</span>}
              </dd>
            </Inset>
          );
        })}
      </dl>
      <ul className="grid gap-1.5">
        {side.cards.map((card, index) => {
          const band = powerBand(card.power);
          const meta = [
            card.archetype,
            card.tier,
            `OVR ${card.ovr}`,
            card.inGoal && "in goal",
            card.trialist && "trialist",
            card.injured && "injured",
          ].filter(Boolean);
          return (
            <li
              className="grid grid-cols-[3.25rem_auto_minmax(0,1fr)] items-center gap-3 rounded-xl bg-panel-2/80 p-2"
              key={index}
            >
              <p
                className={`grid min-h-10 place-items-center rounded-lg border text-body font-semibold tabular-nums ${band.pill}`}
              >
                {card.power.toFixed(2)}
                <span className="sr-only"> power, {band.word}</span>
              </p>
              {card.trialist ? (
                <MidweekMiniCard ovr={card.ovr} small variant="trialist" />
              ) : (
                <MidweekMiniCard
                  injured={card.injured}
                  ovr={card.ovr}
                  rarityTier={card.rarityTier}
                  small
                />
              )}
              <span className="grid min-w-0">
                <span className="text-body font-semibold [overflow-wrap:anywhere]">
                  {card.name}
                </span>
                <span className="text-small text-ink-dim">{meta.join(" · ")}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
