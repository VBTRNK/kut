import { formatClock } from "@/lib/midweek/entry";
import { factorText, LINE_NAMES } from "@/lib/midweek/plusses";
import { powerBand, powerBarWidth } from "@/lib/midweek/power";
import type { PreSide } from "@/lib/midweek/prematch";
import { Chip } from "./chip";
import { MidweekCountdown } from "./countdown";
import { MidweekMiniCard } from "./mini-card";
import { PlayerName } from "./player-name";

/**
 * `MidweekPreMatchBoard` (DR4-7): the pre-match head, both clubs in their
 * colours, `v`, the kick-off and its countdown on the corrected clock. No
 * score, no win chance: those come at kick-off.
 */
export function MidweekPreMatchBoard({
  clubs,
  kickoffAt,
  now,
  youSide,
}: {
  clubs: readonly [string, string];
  kickoffAt: string;
  now: string;
  youSide: 0 | 1 | null;
}) {
  return (
    <div
      aria-label={`${clubs[0]} v ${clubs[1]}, kick-off ${formatClock(kickoffAt)}.`}
      className="relative grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2.5 overflow-hidden rounded-2xl border border-line/60 bg-panel/60 p-3.5 sm:px-6 sm:py-5"
      role="group"
    >
      <div aria-hidden="true" className="absolute inset-x-0 top-0 grid h-[3px] grid-cols-2">
        <span className="bg-team-0-fill" />
        <span className="bg-team-1-fill" />
      </div>
      {([0, 1] as const).map((s) => (
        <div
          className={`grid min-w-0 gap-1.5 ${s === 1 ? "col-start-3 row-start-1 justify-items-end text-right" : ""}`}
          key={s}
        >
          <p className="line-clamp-2 text-[17px] leading-[1.2] font-black hyphens-auto [overflow-wrap:anywhere] sm:text-[22px]">
            <PlayerName side={s}>{clubs[s]}</PlayerName>
          </p>
          {youSide === s && (
            <p className={`flex ${s === 1 ? "justify-end" : ""}`}>
              <Chip tone="you">You</Chip>
            </p>
          )}
        </div>
      ))}
      <div className="col-start-2 row-start-1 grid justify-items-center gap-1">
        <p
          aria-hidden="true"
          className="font-serif text-[30px] leading-none text-ink-dim sm:text-[40px]"
        >
          v
        </p>
        <p aria-hidden="true" className="text-[11.5px] font-bold whitespace-nowrap text-ink-faint">
          kick-off
        </p>
        <p aria-hidden="true" className="text-[19px] leading-none font-black text-ink tabular-nums">
          {formatClock(kickoffAt)}
        </p>
        <MidweekCountdown
          className="text-[11.5px] font-bold whitespace-nowrap text-brass"
          now={now}
          target={kickoffAt}
        />
      </div>
    </div>
  );
}

/**
 * `MidweekPreMatchFive` (Q2, DR4-7): one side's five before kick-off. The
 * club in its colour over `{account}'s five` (DR4-11), the plusses per line
 * and what a short line costs, then the cards strongest first, each with the
 * week's Power as the Why's pill and bar, without the day roll.
 */
export function MidweekPreMatchFive({ side, s, you }: { side: PreSide; s: 0 | 1; you: boolean }) {
  const shortAny = side.short.some((n) => n > 0);
  return (
    <section aria-label={`${side.club}: the five`} className="grid min-w-0 content-start gap-2">
      <h3 className="grid gap-0.5 border-b border-line pb-1.5">
        <span className="text-base leading-tight font-black [overflow-wrap:anywhere]">
          <PlayerName side={s}>{side.club}</PlayerName>
        </span>
        <span className="flex flex-wrap items-center gap-1.5 text-[12.5px] font-bold text-ink-faint">
          {side.account}&rsquo;s five
          {you && <Chip tone="you">You</Chip>}
          {side.auto && <Chip tone="auto">Auto squad</Chip>}
        </span>
      </h3>
      <dl aria-label="Plusses per line" className="grid grid-cols-3 gap-1.5">
        {side.lines.map((count, line) => (
          <div
            className={`grid gap-px rounded-lg border px-2 py-1 ${side.short[line] > 0 ? "border-warning-line bg-warning-bg" : "border-line/60 bg-board-deep/55"}`}
            key={line}
          >
            <dt className="text-[9px] font-black tracking-[0.08em] text-ink-faint uppercase">
              {LINE_NAMES[line]}
            </dt>
            <dd
              className={`text-[13px] font-extrabold tabular-nums ${side.short[line] > 0 ? "text-warning" : "text-ink"}`}
            >
              {count}
              <span className="ml-1 text-[11px] font-bold">
                {side.short[line] > 0 ? `! ${side.short[line]} short` : "✓ enough"}
              </span>
            </dd>
          </div>
        ))}
      </dl>
      {shortAny && (
        <p className="text-[12.5px] text-warning">
          {LINE_NAMES.flatMap((name, line) =>
            side.short[line] > 0 ? [`${name} ${side.short[line]} short`] : [],
          ).join(", ")}
          : the five plays at {factorText(side.balancePpm)}.
        </p>
      )}
      <ul className="grid">
        {side.cards.map((card, index) => {
          const band = powerBand(card.power);
          const notes = [
            card.inGoal && "in goal",
            card.trialist && "trialist",
            card.injured && "injured",
          ].filter(Boolean);
          return (
            <li
              className="grid grid-cols-[3.4rem_auto_minmax(0,1fr)] items-center gap-x-2.5 gap-y-[5px] border-b border-line/35 py-[7px]"
              key={index}
            >
              <p
                className={`row-span-2 grid h-full min-h-[34px] place-items-center rounded-[9px] border text-[17px] font-black tabular-nums ${band.pill}`}
              >
                {card.power.toFixed(2)}
                <span className="sr-only"> power, {band.word}</span>
              </p>
              <span className="row-span-2">
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
              </span>
              <p className="min-w-0 text-[14px] leading-tight font-bold [overflow-wrap:anywhere]">
                <span className="font-extrabold text-report-ink">{card.name}</span>{" "}
                <small className="text-xs font-semibold text-ink-faint">
                  {card.archetype} &middot; {card.tier} &middot; {card.ovr}
                  {notes.length > 0 && (
                    <>
                      {" "}
                      &middot; <b className="font-bold text-ink-dim">{notes.join(", ")}</b>
                    </>
                  )}
                </small>
              </p>
              <svg
                aria-hidden="true"
                className="block h-[5px] w-full"
                preserveAspectRatio="none"
                viewBox="0 0 100 6"
              >
                <rect className="fill-panel-2" height="6" rx="3" width="100" />
                <rect
                  className="fill-report-bar"
                  height="6"
                  rx="3"
                  width={powerBarWidth(card.power)}
                />
                <rect className="fill-ink-dim" height="6" width="0.8" x="49.6" />
              </svg>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
