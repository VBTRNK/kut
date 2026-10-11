import type { ReactNode } from "react";
import type { Side } from "@/game/midweek/match";
import { formatClock } from "@/lib/midweek/entry";
import { ordinal } from "@/lib/midweek/live";
import type { KickItem } from "@/lib/midweek/report/kicks";
import type { MomentKind, TimelineItem } from "@/lib/midweek/report/types";
import { PlayerName, ReportText, TEAM_TEXT } from "./player-name";

/**
 * The match's lane items and the live feed (HANDOFF "Matches", DR4-1, DR4-4):
 * a moment or a kick leans to its side. Under 600 px of the list's own width
 * (a container query, not the page): one lane, a side-0 item with a violet
 * rail on the left and room on the right, a side-1 item mirrored. From 600 px:
 * two lanes either side of a minute-and-score spine. Each item says whose it
 * is in words for screen readers. Team colours only here, where one match is
 * open (DR2-1).
 */

/** The account (S7: club) names of a match's two sides, side 0 first. */
type Names = readonly [string, string];

const KIND_WORD: Record<MomentKind, string> = {
  goal: "Goal",
  save: "Save",
  block: "Block",
  woodwork: "Woodwork",
  wide: "Wide",
};
const MISS_WORD = { save: "saved", woodwork: "off the woodwork", wide: "wide" } as const;

// Rows and items may shrink below a truncated name's width, or one long name
// (a trialist's label) widens the whole list past a 320 px screen.
const ROW =
  "min-w-0 @min-[600px]:grid @min-[600px]:grid-cols-[minmax(0,1fr)_64px_minmax(0,1fr)] @min-[600px]:items-start";
const ITEM =
  "grid min-w-0 grid-cols-[minmax(0,1fr)] gap-1 rounded-xl px-3 py-2.5 text-sm leading-normal @min-[600px]:row-start-1 @min-[600px]:m-0";
const LANE = [
  "mr-8 border-l-[3px] border-team-0-fill bg-team-0-bg/55 @min-[600px]:col-start-1",
  "ml-8 border-r-[3px] border-team-1-fill bg-team-1-bg/55 @min-[600px]:col-start-3",
] as const;
/** The newest item on a live page: a brass outline, sliding in unless reduced motion is asked for. */
const NEWEST = "mw-chance-in outline-1 outline-brass";
const SPINE =
  "hidden justify-items-center gap-0.5 pt-2.5 text-xs font-extrabold text-ink-faint tabular-nums @min-[600px]:col-start-2 @min-[600px]:row-start-1 @min-[600px]:grid";

/** A score, the scoring side's digit emphasised. */
function Score({
  score,
  side,
  goal,
}: {
  score: readonly [number, number];
  side: Side;
  goal: boolean;
}) {
  return (
    <>
      {goal && side === 0 ? <b className="font-black text-ink">{score[0]}</b> : score[0]}–
      {goal && side === 1 ? <b className="font-black text-ink">{score[1]}</b> : score[1]}
    </>
  );
}

/** One of the report's moments in its side's lane; `newest` on a live page. */
export function MidweekMomentRow({
  item,
  managers,
  newest = false,
}: {
  item: TimelineItem;
  managers: Names;
  newest?: boolean;
}) {
  const goal = item.kind === "goal";
  const left = item.side === 0;
  const whose = goal ? `Goal for ${managers[item.side]}` : `${managers[item.side]}’s chance`;
  return (
    <li className={ROW}>
      <div className={`${ITEM} ${newest ? NEWEST : ""} ${LANE[item.side]}`}>
        <p
          aria-hidden="true"
          className={`flex items-center gap-2 text-xs font-extrabold ${left ? "" : "flex-row-reverse"}`}
        >
          <span className="text-ink-faint tabular-nums @min-[600px]:hidden">
            {item.minute}&prime;
          </span>
          <span
            className={`inline-flex items-center rounded-md border px-[7px] py-px text-[9.5px] font-black tracking-[0.1em] uppercase ${goal ? "border-brass bg-brass text-ink-on-accent" : "border-transparent bg-report-tag text-report-ink"}`}
          >
            {KIND_WORD[item.kind]}
          </span>
          <span className="min-w-0 truncate">
            <PlayerName side={item.side}>{managers[item.side]}</PlayerName>
          </span>
          <span
            className={`flex-none text-ink-dim tabular-nums @min-[600px]:hidden ${left ? "ml-auto" : "mr-auto"}`}
          >
            <Score goal={goal} score={item.score} side={item.side} />
          </span>
        </p>
        <p className="sr-only">
          {newest ? "Latest. " : ""}
          {ordinal(item.minute)} minute. {whose}.
        </p>
        <p className={`text-pretty ${goal ? "text-ink" : "text-ink-dim"}`}>
          <ReportText parts={item.parts} />
        </p>
        <p className="sr-only">
          Score: {managers[0]} {item.score[0]}, {managers[1]} {item.score[1]}.
        </p>
      </div>
      <p aria-hidden="true" className={SPINE}>
        <span>{item.minute}&prime;</span>
        <span className="text-[13px] text-ink">
          <Score goal={goal} score={item.score} side={item.side} />
        </span>
      </p>
    </li>
  );
}

const TAG_SCORED = [
  "border-team-0-fill bg-team-0-fill text-ink-on-team-0",
  "border-team-1-fill bg-team-1-fill text-ink-on-team-1",
] as const;
const TAG_MISSED = ["border-team-0 text-team-0", "border-team-1 text-team-1"] as const;

/**
 * `MidweekKickRow` (#263, DR4-4): `Pen 3`, the outcome as a tag in the kicking
 * side's colour, filled with the tally after it for a goal (`Goal 3–2`),
 * outlined for a miss (`Miss`); then the taker v the keeper, and for a miss
 * one word on how. Live, nothing more. At full time the renderer's line for
 * the kick follows, and the decider is outlined in brass with a chip.
 */
export function MidweekKickRow({ kick, newest = false }: { kick: KickItem; newest?: boolean }) {
  const goal = kick.outcome === "goal";
  const s = kick.side;
  const outline = kick.decider ? "outline-2 outline-brass" : newest ? NEWEST : "";
  return (
    <li className={ROW}>
      <div className={`${ITEM} ${outline} ${LANE[s]}`}>
        <p
          aria-hidden="true"
          className={`flex items-center gap-2 text-xs font-extrabold ${s === 0 ? "" : "flex-row-reverse"}`}
        >
          <span className="text-ink-faint tabular-nums @min-[600px]:hidden">Pen {kick.round}</span>
          <span
            className={`inline-flex items-center rounded-md border-[1.5px] px-[7px] py-px text-[10.5px] font-black tracking-[0.1em] whitespace-nowrap uppercase tabular-nums ${goal ? TAG_SCORED[s] : TAG_MISSED[s]}`}
          >
            {goal ? `Goal ${kick.tally[0]}–${kick.tally[1]}` : "Miss"}
          </span>
          {kick.decider && (
            <span className="inline-flex items-center rounded-full border border-brass-line bg-brass-bg px-2 py-px text-[9.5px] font-black tracking-[0.1em] text-brass uppercase">
              Decider
            </span>
          )}
        </p>
        <p className="sr-only">
          {newest ? "Latest. " : ""}Penalty {kick.round}: {kick.kicker}{" "}
          {kick.outcome === "goal" ? "scores" : `misses, ${MISS_WORD[kick.outcome]}`}. Penalties{" "}
          {kick.tally[0]}–{kick.tally[1]}.{kick.decider ? " The decider." : ""}
        </p>
        <p aria-hidden="true" className={`text-[14.5px] ${s === 1 ? "text-right" : ""}`}>
          <PlayerName side={s}>{kick.kicker}</PlayerName> <span className="text-ink-faint">v</span>{" "}
          <span className={`font-semibold ${TEAM_TEXT[s === 0 ? 1 : 0]}`}>{kick.keeper}</span>
          {kick.outcome !== "goal" && (
            <span className="text-ink-dim"> &middot; {MISS_WORD[kick.outcome]}</span>
          )}
        </p>
        {kick.line && (
          <p className={`text-pretty ${kick.decider ? "font-bold text-ink" : "text-ink-dim"}`}>
            <ReportText parts={kick.line} />
          </p>
        )}
      </div>
      <p aria-hidden="true" className={SPINE}>
        <span>Pen {kick.round}</span>
        <span className="text-[13px] text-ink">
          <Score goal={goal} score={kick.tally} side={s} />
        </span>
      </p>
    </li>
  );
}

const DOT = "grid h-5 w-5 place-items-center rounded-full text-[11px] font-black";
const DOT_SCORED = [
  "bg-team-0-fill text-ink-on-team-0",
  "bg-team-1-fill text-ink-on-team-1",
] as const;
const DOT_MISSED = [
  "border-[1.5px] border-team-0 text-team-0",
  "border-[1.5px] border-team-1 text-team-1",
] as const;

/**
 * `MidweekShootoutTally` (DR4-4, DR4-5): per side the name, the kicks scored,
 * then a dot per kick in order, filled ✓ for a goal and ringed ✕ for a miss,
 * both in the side's colour, so dot 3 is `Pen 3`. Live, dashed rings for the
 * first five still to come; a long sudden death wraps.
 */
export function MidweekShootoutTally({
  kicks,
  managers,
  live = false,
}: {
  kicks: readonly KickItem[];
  managers: Names;
  live?: boolean;
}) {
  const tally = kicks.at(-1)?.tally ?? [0, 0];
  return (
    <div className="grid gap-2 rounded-2xl border border-line/60 bg-panel/45 p-3.5">
      {([0, 1] as const).map((s) => {
        const taken = kicks.filter((kick) => kick.side === s);
        return (
          <div
            aria-label={`${managers[s]}: ${tally[s]} scored from ${taken.length}`}
            className="grid grid-cols-[minmax(0,1fr)_1.75rem_auto] items-center gap-2.5 min-[412px]:grid-cols-[minmax(0,7.5rem)_1.75rem_minmax(0,1fr)]"
            key={s}
            role="group"
          >
            <span aria-hidden="true" className="truncate text-sm">
              <PlayerName side={s}>{managers[s]}</PlayerName>
            </span>
            <span
              aria-hidden="true"
              className={`text-center text-xl font-black tabular-nums ${TEAM_TEXT[s]}`}
            >
              {tally[s]}
            </span>
            <span aria-hidden="true" className="flex flex-wrap gap-1">
              {taken.map((kick) => (
                <span
                  className={`${DOT} ${kick.outcome === "goal" ? DOT_SCORED[s] : DOT_MISSED[s]}`}
                  key={kick.round}
                >
                  {kick.outcome === "goal" ? "✓" : "✕"}
                </span>
              ))}
              {live &&
                Array.from({ length: Math.max(0, 5 - taken.length) }, (_, index) => (
                  <span
                    className={`${DOT} border-[1.5px] border-dashed border-line`}
                    key={`to-come-${index}`}
                  />
                ))}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function Divider({ children }: { children: ReactNode }) {
  return (
    <li className="flex items-center gap-3 py-1 text-[10.5px] font-black tracking-[0.14em] whitespace-nowrap text-ink-faint uppercase before:h-px before:flex-1 before:bg-line/70 after:h-px after:flex-1 after:bg-line/70">
      {children}
    </li>
  );
}

/**
 * `MidweekLiveFeed` (DR4-1): a match in play, newest on top. The kicks so far,
 * newest first; once the shoot-out has begun a divider with the score at 90′;
 * the report's moments so far, newest first (Q8); `Kick-off 20:30` at the
 * foot. The newest item is outlined in brass, slides in, and is read as
 * `Latest.` first. Every item has a stable key, so only a new one slides.
 */
export function MidweekLiveFeed({
  timeline,
  kicks,
  managers,
  kickoffAt,
  shootout,
}: {
  timeline: readonly TimelineItem[];
  kicks: readonly KickItem[];
  managers: Names;
  kickoffAt: string;
  shootout: boolean;
}) {
  const atNinety = timeline.at(-1)?.score ?? [0, 0];
  return (
    <div className="@container">
      <ol aria-label="The match so far, newest first" className="grid gap-2 @min-[600px]:gap-1.5">
        {[...kicks].reverse().map((kick, index) => (
          <MidweekKickRow key={`k${kick.side}-${kick.round}`} kick={kick} newest={index === 0} />
        ))}
        {shootout && (
          <Divider>
            Penalties &middot; {atNinety[0]}–{atNinety[1]} at 90&prime;
          </Divider>
        )}
        {[...timeline].reverse().map((item, index) => (
          <MidweekMomentRow
            item={item}
            key={`m${item.minute}-${item.side}`}
            managers={managers}
            newest={!shootout && index === 0}
          />
        ))}
        {timeline.length === 0 && <li className="text-sm text-ink-faint">No chance yet.</li>}
        <Divider>Kick-off {formatClock(kickoffAt)}</Divider>
      </ol>
    </div>
  );
}
