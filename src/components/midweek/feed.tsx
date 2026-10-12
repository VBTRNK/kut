import type { ReactNode } from "react";
import { Tag } from "@/components/ui/tag";
import type { Side } from "@/game/midweek/match";
import { formatClock } from "@/lib/midweek/entry";
import { ordinal } from "@/lib/midweek/live";
import type { KickItem } from "@/lib/midweek/report/kicks";
import type { MomentKind, TimelineItem } from "@/lib/midweek/report/types";
import { PlayerName, ReportText, TEAM_TEXT } from "./player-name";

/**
 * The match's lane items and the live feed (DR5-15, amending DR4-1 and
 * DR4-4): a moment or a kick is a row with a 3 px rail on its side. Under
 * 520 px of the list's own width (a container query, not the page): one
 * column, side 0's rail on the left and side 1's on the right. From 520 px:
 * two lanes either side of a minute-and-score spine, which covers the desktop
 * column (about 595 px); a phone's list is about 380 px. Each item says whose
 * it is in words for screen readers. Team colours only here, where one match
 * is open (DR2-1).
 */

/** The club names of a match's two sides, side 0 first. */
type Names = readonly [string, string];

const KIND_WORD: Record<MomentKind, string> = {
  goal: "Goal",
  save: "Save",
  block: "Block",
  woodwork: "Woodwork",
  wide: "Wide",
};
const MISS_WORD = { save: "saved", woodwork: "off the woodwork", wide: "wide" } as const;

const RAIL = ["border-l-[3px] border-team-0-fill pl-3", "border-r-[3px] border-team-1-fill pr-3"];
const LANE = ["@min-[520px]:col-start-1", "@min-[520px]:col-start-3"] as const;

/**
 * One row of a feed or a timeline: its sentence for screen readers, a head
 * line (minute, tag, score), then its text. The newest item of a live page slides in, without an outline (owner,
 * DR5-15: it fought the team rails); screen readers hear it first. The
 * shoot-out's decider keeps its brass ring.
 */
function LaneRow({
  side,
  newest,
  decider = false,
  spine,
  children,
}: {
  side: Side;
  newest: boolean;
  decider?: boolean;
  spine: ReactNode;
  children: ReactNode;
}) {
  const ring = decider
    ? "rounded-xl px-3 py-2 outline-2 outline-brass"
    : newest
      ? "mw-chance-in"
      : "";
  return (
    <li className="min-w-0 border-b border-line/40 py-3 last:border-b-0 @min-[520px]:grid @min-[520px]:grid-cols-[minmax(0,1fr)_4rem_minmax(0,1fr)] @min-[520px]:gap-2">
      <div
        className={`grid min-w-0 grid-cols-[minmax(0,1fr)] gap-1.5 ${RAIL[side]} ${ring} ${LANE[side]} @min-[520px]:row-start-1`}
      >
        {children}
      </div>
      <p
        aria-hidden="true"
        className="hidden justify-items-center gap-0.5 pt-1 text-small tabular-nums @min-[520px]:col-start-2 @min-[520px]:row-start-1 @min-[520px]:grid"
      >
        {spine}
      </p>
    </li>
  );
}

/** The head line of a row: hidden from screen readers, which hear the row's sentence. */
function Head({ children }: { children: ReactNode }) {
  return (
    <div aria-hidden="true" className="flex items-center gap-2 text-small">
      {children}
    </div>
  );
}

/** One of the report's moments in its side's lane; `newest` on a live page. */
export function MidweekMomentRow({
  item,
  clubs,
  newest = false,
}: {
  item: TimelineItem;
  clubs: Names;
  newest?: boolean;
}) {
  const goal = item.kind === "goal";
  const score = `${item.score[0]}–${item.score[1]}`;
  const whose = goal ? `Goal for ${clubs[item.side]}` : `${clubs[item.side]}’s chance`;
  const tone = goal ? "font-semibold text-ink" : "text-ink-dim";
  return (
    <LaneRow
      newest={newest}
      side={item.side}
      spine={
        <>
          <span className="text-ink-faint">{item.minute}&prime;</span>
          <span className={tone}>{score}</span>
        </>
      }
    >
      <p className="sr-only">
        {newest ? "Latest. " : ""}
        {ordinal(item.minute)} minute. {whose}.
      </p>
      <Head>
        <span className="w-8 flex-none text-ink-faint tabular-nums @min-[520px]:hidden">
          {item.minute}&prime;
        </span>
        <Tag tone={goal ? "goal" : "neutral"}>{KIND_WORD[item.kind]}</Tag>
        <span className={`ml-auto tabular-nums @min-[520px]:hidden ${tone}`}>{score}</span>
      </Head>
      <p className="text-body text-pretty">
        <ReportText parts={item.parts} />
      </p>
      <p className="sr-only">
        Score: {clubs[0]} {item.score[0]}, {clubs[1]} {item.score[1]}.
      </p>
    </LaneRow>
  );
}

const KICK_SCORED = [
  "border-team-0-fill bg-team-0-fill text-ink-on-team-0",
  "border-team-1-fill bg-team-1-fill text-ink-on-team-1",
] as const;
const KICK_MISSED = ["border-team-0 text-team-0", "border-team-1 text-team-1"] as const;

/**
 * `MidweekKickRow` (#263, DR4-4): `Pen 3`, the outcome as a tag in the kicking
 * side's colour, filled with the tally after it for a goal (`Goal 3–2`),
 * ringed for a miss (`Miss`); then the taker v the keeper, and for a miss one
 * word on how. Live, nothing more. At full time the renderer's line for the
 * kick follows, and the decider is ringed in brass with a `Decider` tag.
 */
export function MidweekKickRow({ kick, newest = false }: { kick: KickItem; newest?: boolean }) {
  const goal = kick.outcome === "goal";
  const s = kick.side;
  const tally = `${kick.tally[0]}–${kick.tally[1]}`;
  return (
    <LaneRow
      decider={kick.decider}
      newest={newest}
      side={s}
      spine={
        <>
          <span className="text-ink-faint">Pen {kick.round}</span>
          <span className={goal ? "font-semibold text-ink" : "text-ink-dim"}>{tally}</span>
        </>
      }
    >
      <p className="sr-only">
        {newest ? "Latest. " : ""}Penalty {kick.round}: {kick.kicker}{" "}
        {kick.outcome === "goal" ? "scores" : `misses, ${MISS_WORD[kick.outcome]}`}. Penalties{" "}
        {tally}.{kick.decider ? " The decider." : ""}
      </p>
      <Head>
        <span className="flex-none text-ink-faint tabular-nums @min-[520px]:hidden">
          Pen {kick.round}
        </span>
        <span
          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-label font-semibold whitespace-nowrap tabular-nums ${goal ? KICK_SCORED[s] : KICK_MISSED[s]}`}
        >
          {goal ? `Goal ${tally}` : "Miss"}
        </span>
        {kick.decider && <Tag tone="you">Decider</Tag>}
      </Head>
      <p aria-hidden="true" className="text-body [overflow-wrap:anywhere]">
        <PlayerName side={s}>{kick.kicker}</PlayerName> <span className="text-ink-faint">v</span>{" "}
        <span className={TEAM_TEXT[s === 0 ? 1 : 0]}>{kick.keeper}</span>
        {kick.outcome !== "goal" && (
          <span className="text-ink-dim"> &middot; {MISS_WORD[kick.outcome]}</span>
        )}
      </p>
      {kick.line && (
        <p className={`text-body text-pretty ${kick.decider ? "text-ink" : "text-ink-dim"}`}>
          <ReportText parts={kick.line} />
        </p>
      )}
    </LaneRow>
  );
}

const DOT = "grid h-6 w-6 place-items-center rounded-full border-2 text-label font-extrabold";
const DOT_SCORED = [
  "border-team-0-fill bg-team-0-fill text-ink-on-team-0",
  "border-team-1-fill bg-team-1-fill text-ink-on-team-1",
] as const;
const DOT_MISSED = ["border-team-0 text-team-0", "border-team-1 text-team-1"] as const;

/**
 * `MidweekShootoutTally` (DR4-4, DR4-5): per side the club, the kicks scored,
 * then a dot per kick in order, filled ✓ for a goal and ringed ✕ for a miss,
 * both in the side's colour, so dot 3 is `Pen 3`. Live, dashed rings for the
 * first five still to come; a long sudden death wraps. Below 412 px the dots
 * take a line of their own under the club.
 */
export function MidweekShootoutTally({
  kicks,
  clubs,
  live = false,
}: {
  kicks: readonly KickItem[];
  clubs: Names;
  live?: boolean;
}) {
  const tally = kicks.at(-1)?.tally ?? [0, 0];
  return (
    <div className="grid gap-2">
      {([0, 1] as const).map((s) => {
        const taken = kicks.filter((kick) => kick.side === s);
        return (
          <div
            aria-label={`${clubs[s]}: ${tally[s]} scored from ${taken.length}`}
            className="grid grid-cols-[minmax(0,1fr)_1.5rem] items-center gap-x-3 gap-y-1.5 min-[412px]:grid-cols-[minmax(0,8rem)_1.5rem_minmax(0,1fr)]"
            key={s}
            role="group"
          >
            <span aria-hidden="true" className={`truncate text-body ${TEAM_TEXT[s]}`}>
              {clubs[s]}
            </span>
            <span
              aria-hidden="true"
              className="text-right text-heading font-extrabold tabular-nums"
            >
              {tally[s]}
            </span>
            <span
              aria-hidden="true"
              className="col-span-2 flex flex-wrap gap-1.5 min-[412px]:col-span-1"
            >
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
                  <span className={`${DOT} border-dashed border-line`} key={`to-come-${index}`} />
                ))}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** `ReportSectionHead`: a Heading with a Small on the right, outside a block. */
export function ReportSectionHead({
  id,
  title,
  aside,
}: {
  id: string;
  title: string;
  aside?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
      <h2 className="text-heading font-semibold" id={id}>
        {title}
      </h2>
      {aside && <p className="text-small text-ink-dim">{aside}</p>}
    </div>
  );
}

function Divider({ children }: { children: ReactNode }) {
  return (
    <li className="flex items-center gap-3 py-2 text-small whitespace-nowrap text-ink-dim before:h-px before:flex-1 before:bg-line/70 after:h-px after:flex-1 after:bg-line/70">
      {children}
    </li>
  );
}

/**
 * `MidweekLiveFeed` (DR4-1, DR5-15): a match in play, newest on top under
 * `How it's going`. The kicks so far, newest first; once the shoot-out has
 * begun a divider with the score at 90′; the report's moments so far, newest
 * first (Q8); `Kick-off 20:30` at the foot. The newest item slides in and is
 * read as `Latest.` first. Every item has a stable key, so only a new one
 * slides.
 */
export function MidweekLiveFeed({
  timeline,
  kicks,
  clubs,
  kickoffAt,
  shootout,
}: {
  timeline: readonly TimelineItem[];
  kicks: readonly KickItem[];
  clubs: Names;
  kickoffAt: string;
  shootout: boolean;
}) {
  const atNinety = timeline.at(-1)?.score ?? [0, 0];
  return (
    <section aria-labelledby="feed-h" className="grid gap-1">
      <ReportSectionHead aside="Newest first" id="feed-h" title="How it’s going" />
      <div className="@container">
        <ol aria-label="The match so far, newest first">
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
              clubs={clubs}
              newest={!shootout && index === 0}
            />
          ))}
          {timeline.length === 0 && (
            <li className="py-3 text-small text-ink-dim">No chance yet.</li>
          )}
          <Divider>Kick-off {formatClock(kickoffAt)}</Divider>
        </ol>
      </div>
    </section>
  );
}
