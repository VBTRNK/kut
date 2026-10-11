import type { Side } from "@/game/midweek/match";
import type { LiveScore } from "@/lib/midweek/live";
import { shootoutStory } from "@/lib/midweek/report/kicks";
import type { ShootoutReport, TimelineItem } from "@/lib/midweek/report/types";
import { Chip } from "./chip";
import { MidweekKickRow, MidweekMomentRow, MidweekShootoutTally, ordinal } from "./feed";
import { MidweekMatchClock } from "./match-clock";
import { PlayerName, ReportText } from "./player-name";

export { ordinal };

/**
 * The match report's parts (BUILD_SPEC §44.10, design/ux-review/HANDOFF.md
 * "Matches"): the scoreboard, the lane timeline and the shoot-out; the "why"
 * is `MidweekWhyList`. Presentational: the page renders the report on the
 * server and hands these its pieces. Team colours only here, where one match
 * is open (DR2-1): side 0 violet on the left, side 1 teal on the right (DR3-10).
 */

export type Managers = readonly [string, string];

/**
 * `MidweekScoreboard`: always side 0 on the left and side 1 on the right, from
 * the per-side goals, never the renderer's winner-first `score`; names and
 * digits in team colour, no chance counter (DR1-5), and both sides' fills as
 * a strip across the top (DR3-2). At full time Through and Out chips. Live
 * (ADR-115, DR4-2) the score so far, no chips until it ends, and on its own
 * row under the score, so long names keep their width, the running clock
 * `Live · 64′` or `Live · pens 3–3` with its progress line
 * (`MidweekMatchClock`); Home's compact card keeps the minute under the score.
 */
export function MidweekScoreboard({
  managers,
  goals,
  penalties,
  winnerSide,
  youSide,
  auto,
  compact = false,
  live = null,
}: {
  managers: Managers;
  goals: readonly [number, number];
  penalties: readonly [number, number] | null;
  /** Ignored while `live`. */
  winnerSide: Side | null;
  youSide: Side | null;
  auto: readonly [boolean, boolean];
  /** Home's card (Home-Now-Live): smaller type, no panel, no auto-squad chip. */
  compact?: boolean;
  live?: LiveScore | null;
}) {
  const label = live
    ? `Live, ${live.penalties ? "penalties" : `${ordinal(live.minute)} minute`}: ${managers[0]} ${goals[0]}, ${managers[1]} ${goals[1]}` +
      (live.penalties ? `, penalties ${live.penalties[0]}–${live.penalties[1]}.` : ".")
    : `Final score: ${managers[0]} ${goals[0]}, ${managers[1]} ${goals[1]}` +
      (penalties && winnerSide !== null
        ? `; ${managers[winnerSide]} won ${Math.max(...penalties)}–${Math.min(...penalties)} on penalties.`
        : ".");
  const side = (s: Side) => (
    <div className={`grid min-w-0 gap-1.5 ${s === 1 ? "justify-items-end text-right" : ""}`}>
      <p
        className={`leading-[1.2] font-black [overflow-wrap:anywhere] ${compact ? "text-[15px] sm:text-[17px]" : "text-[17px] sm:text-[22px]"}`}
      >
        <PlayerName side={s}>{managers[s]}</PlayerName>
      </p>
      <p className={`flex flex-wrap gap-1 ${s === 1 ? "justify-end" : ""}`}>
        {!live &&
          (s === winnerSide ? <Chip tone="won">✓ Through</Chip> : <Chip tone="out">Out</Chip>)}
        {youSide === s && <Chip tone="you">You</Chip>}
        {/* Home's card leaves the auto squad to the match page: two long names
            and their chips would not fit a 320 px card. */}
        {auto[s] && !compact && <Chip tone="auto">Auto squad</Chip>}
      </p>
    </div>
  );
  return (
    <div
      aria-label={label}
      className={`relative grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2.5 overflow-hidden border border-line/60 ${
        compact
          ? "rounded-xl bg-board/50 px-3 py-2.5 sm:px-4"
          : "rounded-2xl bg-panel/60 p-3.5 sm:px-6 sm:py-5"
      }`}
      role="group"
    >
      {/* The two club colours as a 3 px strip across the top (DR3-2);
          decorative, the names and sides carry it. */}
      <div aria-hidden="true" className="absolute inset-x-0 top-0 grid h-[3px] grid-cols-2">
        <span className="bg-team-0-fill" />
        <span className="bg-team-1-fill" />
      </div>
      {side(0)}
      <div aria-hidden="true" className="grid justify-items-center gap-1.5">
        <p
          className={`leading-none font-black tracking-[0.02em] whitespace-nowrap tabular-nums ${compact ? "text-[28px] sm:text-[32px]" : "text-[38px] sm:text-[54px]"}`}
        >
          <span className="text-team-0">{goals[0]}</span>–
          <span className="text-team-1">{goals[1]}</span>
        </p>
        {live && compact ? (
          // The card's kicker already carries the Live marker.
          <p className="text-[11.5px] font-bold whitespace-nowrap text-live tabular-nums">
            {live.penalties ? `pens ${live.penalties[0]}–${live.penalties[1]}` : `${live.minute}′`}
          </p>
        ) : live ? null : (
          <p className="text-[11.5px] font-bold whitespace-nowrap text-ink-faint tabular-nums">
            {penalties ? `${penalties[0]}–${penalties[1]} on pens` : "full time"}
          </p>
        )}
      </div>
      {side(1)}
      {live && !compact && (
        <MidweekMatchClock clock={live.clock} minute={live.minute} penalties={live.penalties} />
      )}
    </div>
  );
}

/**
 * `MidweekLaneTimeline` (HANDOFF "Matches"): the full-time report's key
 * moments, oldest first, as a story under its headline (Q4), each leaning to
 * its side (`MidweekMomentRow`). A live page shows `MidweekLiveFeed` instead,
 * newest first.
 */
export function MidweekLaneTimeline({
  timeline,
  managers,
}: {
  timeline: readonly TimelineItem[];
  managers: Managers;
}) {
  return (
    <div className="@container">
      <ol aria-label="Key moments" className="grid gap-2 @min-[600px]:gap-1.5">
        {timeline.map((item) => (
          <MidweekMomentRow item={item} key={`m${item.minute}-${item.side}`} managers={managers} />
        ))}
      </ol>
    </div>
  );
}

/**
 * `MidweekShootout` at full time (#263, DR4-5): the tally, the intro line,
 * then every kick in order as the live feed showed it, each with its own line
 * of commentary under it (`shootoutStory`), the decider outlined in brass, and
 * a draw's line last when a draw settled it.
 */
export function MidweekShootout({
  shootout,
  managers,
}: {
  shootout: ShootoutReport;
  managers: Managers;
}) {
  const story = shootoutStory(shootout);
  return (
    <section aria-labelledby="shootout-h" className="grid gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
        <h2 className="display text-3xl" id="shootout-h">
          Penalties
        </h2>
        <p className="text-[13px] text-ink-faint">{shootout.kicks.length} kicks</p>
      </div>
      <MidweekShootoutTally kicks={story.kicks} managers={managers} />
      <p className="border-l-2 border-line/70 pl-3.5 text-[14.5px] leading-[1.55] text-pretty text-ink-dim">
        <ReportText parts={story.intro} />
      </p>
      <div className="@container">
        <ol aria-label="Every kick in order" className="grid gap-2 @min-[600px]:gap-1.5">
          {story.kicks.map((kick) => (
            <MidweekKickRow key={`k${kick.side}-${kick.round}`} kick={kick} />
          ))}
        </ol>
      </div>
      {story.toss && (
        <p className="border-l-2 border-brass pl-3.5 text-[14.5px] leading-[1.55] font-bold text-pretty text-ink">
          <ReportText parts={story.toss} />
        </p>
      )}
    </section>
  );
}
