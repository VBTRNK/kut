// DR5 match report (design only): E2 with DR5-2 to DR5-5. The page's two
// tabs, Match and Teams, side by side from `lg`; the scoreboard; the facts and
// moments as Body rows with a side rail; the shoot-out; the Why as the Teams
// tab. Names keep their team colour at regular weight (DR5-4); the headline and
// a live match's title are plain ink. Every line is the renderer's own
// (ADR-093): nothing here rewrites phrasebook copy.
import type { ReactNode } from "react";
import { archetypeLabel } from "@/game/archetypes";
import { PPM } from "@/game/midweek/config";
import { formatClock } from "@/lib/midweek/entry";
import { handicapText } from "@/lib/midweek/evening";
import { ordinal } from "@/lib/midweek/live";
import { powerBand, powerBarWidth } from "@/lib/midweek/power";
import { keepScores } from "@/components/midweek/player-name";
import type { KickItem } from "@/lib/midweek/report/kicks";
import type { Segment, TimelineItem, WhyCard, WhySide } from "@/lib/midweek/report/types";
import { Block, InfoLink, SectionNav, Tag } from "./ui";

type Side = 0 | 1;
export type Clubs = readonly [string, string];

/** A side's team colour as text (DR3-10); the weight stays the text's own (DR5-4). */
export const TEAM_TEXT = ["text-team-0", "text-team-1"] as const;
const RAIL = ["border-team-0-fill", "border-team-1-fill"] as const;

/**
 * `ReportText`, revised (DR5-4): a renderer line with every name in its side's
 * colour, at the line's own weight. `plain` (the headline, a live title):
 * ink throughout, names included.
 */
export function ReportText({ parts, plain = false }: { parts: readonly Segment[]; plain?: boolean }) {
  return parts.map((part, index) =>
    part.side === undefined || plain ? (
      keepScores(part.text)
    ) : (
      <span className={TEAM_TEXT[part.side]} key={index}>
        {part.text}
        {part.owner !== undefined && <span className="sr-only"> ({part.owner}&rsquo;s)</span>}
      </span>
    ),
  );
}

// ------------------------------------------------------------- scoreboard ----

export type LiveState = { minute: number; penalties: readonly [number, number] | null };

/**
 * `MatchScoreboard` (revises `MidweekScoreboard`): a block with the two
 * colours as a 3 px strip, each club in its colour (Body 600, two lines at
 * most), the score as a Figure in ink, and its tags under each club: Through
 * or Out at full time, You, Auto. Live, a `Live · 64′` tag under the score and
 * the pink progress line along the foot (an SVG width: the CSP strips styles).
 */
export function MatchScoreboard({
  clubs,
  goals,
  penalties = null,
  winnerSide = null,
  youSide,
  auto,
  live = null,
  compact = false,
}: {
  clubs: Clubs;
  goals: readonly [number, number];
  penalties?: readonly [number, number] | null;
  winnerSide?: Side | null;
  youSide: Side | null;
  auto: readonly [boolean, boolean];
  live?: LiveState | null;
  /** In a Now block: no frame of its own, no tags. */
  compact?: boolean;
}) {
  const label = live
    ? `Live, ${live.penalties ? "penalties" : `${ordinal(live.minute)} minute`}: ${clubs[0]} ${goals[0]}, ${clubs[1]} ${goals[1]}.`
    : `Final score: ${clubs[0]} ${goals[0]}, ${clubs[1]} ${goals[1]}.`;
  const side = (s: Side) => (
    <div className={`grid min-w-0 content-start gap-1.5 ${s === 1 ? "justify-items-end text-right" : ""}`}>
      <p
        className={`line-clamp-2 text-body font-semibold hyphens-auto [overflow-wrap:anywhere] sm:text-heading ${TEAM_TEXT[s]}`}
      >
        {clubs[s]}
      </p>
      {!compact && (
        <p className={`flex flex-wrap gap-1 ${s === 1 ? "justify-end" : ""}`}>
          {!live && winnerSide !== null && (s === winnerSide ? <Tag tone="won">✓ Through</Tag> : <Tag tone="out">Out</Tag>)}
          {youSide === s && <Tag tone="you">You</Tag>}
          {auto[s] && <Tag tone="auto">Auto</Tag>}
        </p>
      )}
    </div>
  );
  const fill = live ? (live.penalties ? 100 : Math.round((live.minute / 90) * 1000) / 10) : 0;
  return (
    <div
      aria-label={label}
      className={`relative grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start gap-3 overflow-hidden ${
        compact ? "" : "rounded-2xl border border-line/60 bg-panel/60 p-4 pt-5"
      }`}
      role="group"
    >
      {!compact && (
        <div aria-hidden="true" className="absolute inset-x-0 top-0 grid h-[3px] grid-cols-2">
          <span className="bg-team-0-fill" />
          <span className="bg-team-1-fill" />
        </div>
      )}
      {side(0)}
      <div aria-hidden="true" className="grid justify-items-center gap-1">
        <p className="text-figure font-extrabold whitespace-nowrap tabular-nums">
          {goals[0]}–{goals[1]}
        </p>
        {!live && (
          <p className="text-small whitespace-nowrap text-ink-dim tabular-nums">
            {penalties ? `${penalties[0]}–${penalties[1]} on pens` : "full time"}
          </p>
        )}
      </div>
      {side(1)}
      {live && (
        <p className="col-span-3 flex justify-center" role="timer">
          <Tag tone="live">
            Live · {live.penalties ? `pens ${live.penalties[0]}–${live.penalties[1]}` : `${live.minute}′`}
          </Tag>
        </p>
      )}
      {live && !compact && (
        <svg aria-hidden="true" className="absolute inset-x-0 bottom-0 block h-[3px] w-full" preserveAspectRatio="none" viewBox="0 0 100 3">
          <rect className="fill-line/50" height="3" width="100" />
          <rect className="fill-live" height="3" width={fill} />
          <rect className="fill-board" height="3" width="0.5" x="49.75" />
        </svg>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- moments ----

const KIND_WORD = { goal: "Goal", save: "Save", block: "Block", woodwork: "Woodwork", wide: "Wide" } as const;
const MISS_WORD = { save: "saved", woodwork: "off the woodwork", wide: "wide" } as const;

/**
 * One feed or timeline row. Under 520 px of the list's own width: one column,
 * a 3 px rail on the moment's side (left for side 0, right for side 1). From
 * 520 px (the desktop's two lanes, DR5-2): side 0 left of a minute-and-score
 * spine, side 1 right of it. A row, never a box (DR5-5); the newest item of a
 * live page slides in, without an outline.
 */
function LaneRow({
  side,
  newest = false,
  decider = false,
  head,
  spine,
  sr,
  children,
}: {
  side: Side;
  newest?: boolean;
  decider?: boolean;
  head: ReactNode;
  spine: ReactNode;
  sr: string;
  children: ReactNode;
}) {
  // No outline on the newest item (owner, 12 Oct: it fought the team rails); it
  // still slides in and screen readers hear it first. The decider keeps its ring.
  const ring = decider ? "rounded-xl px-3 outline-2 outline-brass" : newest ? "mw-chance-in" : "";
  return (
    <li className="min-w-0 border-b border-line/40 py-3 last:border-b-0 @min-[520px]:grid @min-[520px]:grid-cols-[minmax(0,1fr)_4rem_minmax(0,1fr)] @min-[520px]:gap-2">
      <div
        className={`grid min-w-0 gap-1.5 ${side === 0 ? `border-l-[3px] pl-3 ${RAIL[0]}` : `border-r-[3px] pr-3 ${RAIL[1]}`} ${ring} @min-[520px]:row-start-1 ${
          side === 0 ? "@min-[520px]:col-start-1" : "@min-[520px]:col-start-3"
        }`}
      >
        <p className="sr-only">{sr}</p>
        <div aria-hidden="true" className="flex items-center gap-2 text-small">
          {head}
        </div>
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

export function MomentRow({ item, clubs, newest = false }: { item: TimelineItem; clubs: Clubs; newest?: boolean }) {
  const goal = item.kind === "goal";
  const score = `${item.score[0]}–${item.score[1]}`;
  return (
    <LaneRow
      head={
        <>
          <span className="w-8 text-ink-faint tabular-nums @min-[520px]:hidden">{item.minute}′</span>
          <Tag tone={goal ? "goal" : "neutral"}>{KIND_WORD[item.kind]}</Tag>
          <span className={`ml-auto tabular-nums @min-[520px]:hidden ${goal ? "font-semibold text-ink" : "text-ink-dim"}`}>{score}</span>
        </>
      }
      newest={newest}
      side={item.side}
      spine={
        <>
          <span className="text-ink-faint">{item.minute}′</span>
          <span className={goal ? "font-semibold text-ink" : "text-ink-dim"}>{score}</span>
        </>
      }
      sr={`${newest ? "Latest. " : ""}${ordinal(item.minute)} minute. ${goal ? `Goal for ${clubs[item.side]}` : `${clubs[item.side]}’s chance`}. Score ${clubs[0]} ${item.score[0]}, ${clubs[1]} ${item.score[1]}.`}
    >
      <p className="text-body text-pretty">
        <ReportText parts={item.parts} />
      </p>
    </LaneRow>
  );
}

const KICK_FILL = ["border-team-0-fill bg-team-0-fill text-ink-on-team-0", "border-team-1-fill bg-team-1-fill text-ink-on-team-1"] as const;
const KICK_RING = ["border-team-0 text-team-0", "border-team-1 text-team-1"] as const;

/** A kick (DR4-4): `Pen 3`, the outcome tag in the kicker's colour, taker v keeper; at full time its line. */
export function KickRow({ kick, newest = false }: { kick: KickItem; newest?: boolean }) {
  const goal = kick.outcome === "goal";
  const s = kick.side;
  const tally = `${kick.tally[0]}–${kick.tally[1]}`;
  return (
    <LaneRow
      decider={kick.decider}
      head={
        <>
          <span className="w-12 text-ink-faint tabular-nums @min-[520px]:hidden">Pen {kick.round}</span>
          <span
            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-label font-semibold whitespace-nowrap tabular-nums ${goal ? KICK_FILL[s] : KICK_RING[s]}`}
          >
            {goal ? `Goal ${tally}` : "Miss"}
          </span>
          {kick.decider && <Tag tone="you">Decider</Tag>}
        </>
      }
      newest={newest}
      side={s}
      spine={
        <>
          <span className="text-ink-faint">Pen {kick.round}</span>
          <span className={goal ? "font-semibold text-ink" : "text-ink-dim"}>{tally}</span>
        </>
      }
      sr={`${newest ? "Latest. " : ""}Penalty ${kick.round}: ${kick.kicker} ${goal ? "scores" : `misses, ${MISS_WORD[kick.outcome as keyof typeof MISS_WORD]}`}. Penalties ${tally}.${kick.decider ? " The decider." : ""}`}
    >
      <p aria-hidden="true" className="text-body">
        <span className={TEAM_TEXT[s]}>{kick.kicker}</span> <span className="text-ink-faint">v</span>{" "}
        <span className={TEAM_TEXT[s === 0 ? 1 : 0]}>{kick.keeper}</span>
        {!goal && <span className="text-ink-dim"> · {MISS_WORD[kick.outcome as keyof typeof MISS_WORD]}</span>}
      </p>
      {kick.line && (
        <p className={`text-body text-pretty ${kick.decider ? "text-ink" : "text-ink-dim"}`}>
          <ReportText parts={kick.line} />
        </p>
      )}
    </LaneRow>
  );
}

function Divider({ children }: { children: ReactNode }) {
  return (
    <li className="flex items-center gap-3 py-2 text-small whitespace-nowrap text-ink-dim before:h-px before:flex-1 before:bg-line/70 after:h-px after:flex-1 after:bg-line/70">
      {children}
    </li>
  );
}

/** `SectionHead`: a Heading with a Small on the right, outside a block. */
export function SectionHead({ id, title, aside }: { id: string; title: string; aside?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
      <h2 className="text-heading font-semibold" id={id}>
        {title}
      </h2>
      {aside && <p className="text-small text-ink-dim">{aside}</p>}
    </div>
  );
}

/** The full-time story, oldest first (DR5-5). */
export function Timeline({ timeline, clubs }: { timeline: readonly TimelineItem[]; clubs: Clubs }) {
  return (
    <section aria-labelledby="timeline-h" className="grid gap-1">
      <SectionHead id="timeline-h" title="How it went" />
      <div className="@container">
        <ol aria-label="Key moments">
          {timeline.map((item) => (
            <MomentRow clubs={clubs} item={item} key={`m${item.minute}-${item.side}`} />
          ))}
        </ol>
      </div>
    </section>
  );
}

/** The live feed, newest first (DR4-1, kept by DR5-5): kicks on top, the newest outlined. */
export function LiveFeed({
  timeline,
  kicks,
  clubs,
  kickoffAt,
  shootout,
}: {
  timeline: readonly TimelineItem[];
  kicks: readonly KickItem[];
  clubs: Clubs;
  kickoffAt: string;
  shootout: boolean;
}) {
  const atNinety = timeline.at(-1)?.score ?? [0, 0];
  return (
    <section aria-labelledby="feed-h" className="grid gap-1">
      <SectionHead aside="Newest first" id="feed-h" title="How it’s going" />
      <div className="@container">
        <ol aria-label="The match so far, newest first">
          {[...kicks].reverse().map((kick, index) => (
            <KickRow key={`k${kick.side}-${kick.round}`} kick={kick} newest={index === 0} />
          ))}
          {shootout && (
            <Divider>
              Penalties · {atNinety[0]}–{atNinety[1]} at 90′
            </Divider>
          )}
          {[...timeline].reverse().map((item, index) => (
            <MomentRow clubs={clubs} item={item} key={`m${item.minute}-${item.side}`} newest={!shootout && index === 0} />
          ))}
          <Divider>Kick-off {formatClock(kickoffAt)}</Divider>
        </ol>
      </div>
    </section>
  );
}

const DOT = "grid h-6 w-6 place-items-center rounded-full border-2 text-label font-extrabold";
const DOT_SCORED = ["border-team-0-fill bg-team-0-fill text-ink-on-team-0", "border-team-1-fill bg-team-1-fill text-ink-on-team-1"] as const;
const DOT_MISSED = ["border-team-0 text-team-0", "border-team-1 text-team-1"] as const;

/** `ShootoutTally` in a block: per side the club, the kicks scored and a dot per kick, ✓ or ✕. */
export function ShootoutBlock({
  kicks,
  clubs,
  live,
  intro,
  toss,
  story,
}: {
  kicks: readonly KickItem[];
  clubs: Clubs;
  live: boolean;
  intro?: readonly Segment[];
  toss?: readonly Segment[] | null;
  /** At full time: every kick in order with its line, under the tally. */
  story?: readonly KickItem[];
}) {
  const tally = kicks.at(-1)?.tally ?? [0, 0];
  return (
    <Block
      aside={<p className="text-small text-ink-dim">{live ? `${kicks.length} ${kicks.length === 1 ? "kick" : "kicks"} so far` : `${kicks.length} kicks`}</p>}
      id="shootout-h"
      title="Penalties"
    >
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
              <span aria-hidden="true" className="text-right text-heading font-extrabold tabular-nums">
                {tally[s]}
              </span>
              <span aria-hidden="true" className="col-span-2 flex flex-wrap gap-1.5 min-[412px]:col-span-1">
                {taken.map((kick) => (
                  <span className={`${DOT} ${kick.outcome === "goal" ? DOT_SCORED[s] : DOT_MISSED[s]}`} key={kick.round}>
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
      {intro && (
        <p className="text-body text-pretty text-ink-dim">
          <ReportText parts={intro} />
        </p>
      )}
      {story && (
        <div className="@container">
          <ol aria-label="Every kick in order">
            {story.map((kick) => (
              <KickRow key={`k${kick.side}-${kick.round}`} kick={kick} />
            ))}
          </ol>
        </div>
      )}
      {toss && (
        <p className="text-body text-pretty text-ink">
          <ReportText parts={toss} />
        </p>
      )}
    </Block>
  );
}

// ------------------------------------------------------------------ teams ----

const matchPower = (card: WhyCard) => (card.powerPpm / PPM) * (card.dayRollPpm / PPM);
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** The rating disc (DR3-4), never coloured; Label-to-Small digits at 600. */
export function Disc({ rating, context, small = false }: { rating: number; context: string; small?: boolean }) {
  return (
    <span
      className={`inline-grid flex-none place-items-center rounded-full border-[1.5px] border-ink-dim bg-panel-2 font-semibold text-ink tabular-nums ${
        small ? "h-8 w-8 text-label" : "h-10 w-10 text-small"
      }`}
    >
      <span aria-hidden="true">{rating.toFixed(1)}</span>
      <span className="sr-only">
        rated {rating.toFixed(1)} out of 10 {context}
      </span>
    </span>
  );
}

function CardRow({ card, rating }: { card: WhyCard; rating: number | null }) {
  const power = matchPower(card);
  const band = powerBand(power);
  const notes = [
    card.inGoal && "in goal",
    card.trialist && "trialist",
    card.injured && "injured",
    card.handicapPpm !== PPM && `handicap ×${handicapText(card.handicapPpm)}`,
    card.goals > 0 && plural(card.goals, "goal"),
    card.assists > 0 && plural(card.assists, "assist"),
  ].filter(Boolean);
  return (
    <li className={`grid items-center gap-3 rounded-xl bg-panel-2/80 p-2 ${rating === null ? "grid-cols-[3.25rem_minmax(0,1fr)]" : "grid-cols-[3.25rem_minmax(0,1fr)_auto]"}`}>
      <p className={`grid min-h-10 place-items-center rounded-lg border text-body font-semibold tabular-nums ${band.pill}`}>
        {power.toFixed(2)}
        <span className="sr-only"> power, {band.word}</span>
      </p>
      <div className="grid min-w-0 gap-1">
        <p className="text-body font-semibold [overflow-wrap:anywhere]">
          {card.label.text}
          {card.label.owner !== undefined && <span className="sr-only"> ({card.label.owner}&rsquo;s)</span>}
        </p>
        <p className="text-small text-ink-dim">
          {archetypeLabel(card.archetype)} · {card.ovr}
          {notes.length > 0 && ` · ${notes.join(", ")}`}
        </p>
        <svg aria-hidden="true" className="block h-1 w-full" preserveAspectRatio="none" viewBox="0 0 100 4">
          <rect className="fill-board" height="4" rx="2" width="100" />
          <rect className="fill-report-bar" height="4" rx="2" width={powerBarWidth(power)} />
          <rect className="fill-ink-dim" height="4" width="0.8" x="49.6" />
        </svg>
      </div>
      {rating !== null && <Disc context="for this match" rating={rating} />}
    </li>
  );
}

/**
 * The Teams tab (the Why, DR2-6..8 kept): the key once there are ratings, the
 * chances before kick-off, then per side a block with a 3 px rail in its
 * colour, its five strongest first. The 60-word foot goes behind `How Power
 * works ›` (D); the factor tooltips stay behind `Show every factor` (#279).
 */
export function TeamsPanel({
  why,
  ratings = null,
  heading = false,
}: {
  why: readonly [WhySide, WhySide];
  ratings?: readonly [readonly number[], readonly number[]] | null;
  /** From `lg`, where the tabs give way to two columns, the panel names itself. */
  heading?: boolean;
}) {
  const left = Math.round(why[0].winChancePpm / 10_000);
  const chances = [left, 100 - left] as const;
  return (
    <div className="grid min-w-0 content-start gap-4">
      {heading && (
        <div className="hidden lg:block">
          <SectionHead id="teams-h" title="Teams" />
        </div>
      )}
      <div className="grid gap-1.5">
        <p className="text-small text-ink-dim">Chances before kick-off</p>
        <svg
          aria-label={`Before kick-off: ${why[0].club} ${chances[0]}%, ${why[1].club} ${chances[1]}%`}
          className="block h-2 w-full overflow-hidden rounded"
          preserveAspectRatio="none"
          role="img"
          viewBox="0 0 100 8"
        >
          <rect className="fill-team-0-fill" height="8" width={chances[0]} />
          <rect className="fill-team-1-fill" height="8" width={chances[1]} x={chances[0]} />
        </svg>
        <p aria-hidden="true" className="flex justify-between text-small font-semibold tabular-nums">
          <span className="text-team-0">{chances[0]}%</span>
          <span className="text-team-1">{chances[1]}%</span>
        </p>
      </div>
      {ratings && (
        <p className="flex flex-wrap items-center gap-x-3 gap-y-2 text-small text-ink-dim">
          <span className="rounded-md border border-moss-line bg-moss-bg px-1.5 font-semibold text-moss tabular-nums">1.19</span>
          Power going in
          <span aria-hidden="true" className="grid h-7 w-7 place-items-center rounded-full border-[1.5px] border-ink-dim text-label font-semibold text-ink">
            7.2
          </span>
          Rating, out of 10
        </p>
      )}
      {why.map((side, s) => (
        <section
          aria-label={`${side.club}: the five`}
          className={`grid min-w-0 gap-2 rounded-2xl border border-t-[3px] border-line/60 bg-panel/60 p-4 ${s === 0 ? "border-t-team-0-fill" : "border-t-team-1-fill"}`}
          key={s}
        >
          <h3 className={`text-body font-semibold [overflow-wrap:anywhere] ${TEAM_TEXT[s]}`}>{side.club}</h3>
          <p className="text-small text-ink-dim">
            {[
              `${chances[s]}% before kick-off`,
              side.auto && "auto squad",
              side.keeperless && "no keeper",
              ...side.shortLines.map(({ line, short }) => `${line} ${short} short`),
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
          <ul className="grid gap-1.5">
            {side.cards
              .map((card, slot) => ({ card, slot }))
              .sort((a, b) => matchPower(b.card) - matchPower(a.card) || a.slot - b.slot)
              .map(({ card, slot }) => (
                <CardRow card={card} key={slot} rating={ratings?.[s]?.[slot] ?? null} />
              ))}
          </ul>
        </section>
      ))}
      <div className="flex flex-wrap items-center justify-between gap-x-4">
        <button className="inline-flex min-h-11 items-center text-small font-semibold text-brass" type="button">
          Show every factor
        </button>
        <InfoLink href="/how-it-works#power">How Power works</InfoLink>
      </div>
    </div>
  );
}

/** Match · Teams (DR5-2): below `lg` one is shown, from `lg` both, side by side. */
export function ReportTabs({ base, active }: { base: string; active: "match" | "teams" }) {
  return (
    <div className="lg:hidden">
      <SectionNav
        active={active}
        label="This match"
        tabs={[
          { key: "match", label: "Match", href: base },
          { key: "teams", label: "Teams", href: `${base}?tab=teams` },
        ]}
      />
    </div>
  );
}
