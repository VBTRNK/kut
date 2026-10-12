import type { ReactNode } from "react";
import { Block } from "@/components/ui/block";
import { COLUMN, PAGE, PageHeader } from "@/components/ui/page";
import { SectionNav } from "@/components/ui/section-nav";
import { Tag } from "@/components/ui/tag";
import type { Side } from "@/game/midweek/match";
import { capitalise, matchName } from "@/lib/midweek/evening";
import { ordinal, type LiveScore } from "@/lib/midweek/live";
import type { KickItem } from "@/lib/midweek/report/kicks";
import { shootoutStory } from "@/lib/midweek/report/kicks";
import type { ShootoutReport, TimelineItem } from "@/lib/midweek/report/types";
import { MidweekKickRow, MidweekMomentRow, MidweekShootoutTally, ReportSectionHead } from "./feed";
import { MidweekMatchClock } from "./match-clock";
import { ReportText, TEAM_TEXT } from "./player-name";

export { ordinal };

/**
 * The match report's parts (DR5-15, as `design/ui-pass/build/report.tsx`
 * draws them): the scoreboard, the full-time timeline and the `Penalties`
 * block; the Teams tab is `MidweekWhyList`. Presentational: the page renders
 * the report on the server and hands these its pieces. Team colours only
 * here, where one match is open (DR2-1): side 0 violet on the left, side 1
 * teal on the right (DR3-10).
 */

export type Clubs = readonly [string, string];

/** The report's two views (DR5-2): links, so each has its own address and a poll keeps it. */
export type ReportTab = "match" | "teams";

/** `?tab=teams` opens Teams; anything else is Match. */
export const reportTab = (tab: string | string[] | undefined): ReportTab =>
  tab === "teams" ? "teams" : "match";

/**
 * The report's Small line under its title (DR5-15): `Quarter-final 3 · full
 * time · your match`, `Round 1, match 2 · live`. The final is everyone's, so
 * it never says "your match" (DR4-3).
 */
export function reportLine({
  round,
  pairing,
  rounds,
  live,
  yours,
}: {
  round: number;
  pairing: number;
  rounds: number;
  live: boolean;
  yours: boolean;
}): string {
  const mine = yours && round !== rounds ? " · your match" : "";
  return `${capitalise(matchName(round, pairing, rounds))} · ${live ? "live" : "full time"}${mine}`;
}

/**
 * A match page (E2, DR5-2, DR5-15), live or at full time: `‹ Bracket`, the
 * headline (or `Club v Club` live) in plain ink and the Small line, the
 * scoreboard, then `Match · Teams`. Below `lg` one tab shows and the other is
 * in the page but hidden, so a tab changes nothing the page sends; from `lg`
 * both sit side by side and the tabs hide.
 */
export function ReportLayout({
  back,
  title,
  sub,
  board,
  tab,
  base,
  match,
  teams,
  foot = null,
}: {
  back: string;
  title: ReactNode;
  sub: string;
  board: ReactNode;
  tab: ReportTab;
  /** The page's own path, without `?tab`. */
  base: string;
  match: ReactNode;
  teams: ReactNode;
  foot?: ReactNode;
}) {
  const shown = (on: boolean) =>
    `${on ? "grid" : "hidden lg:grid"} min-w-0 grid-cols-[minmax(0,1fr)] content-start gap-6`;
  return (
    <main className={PAGE}>
      <article className={`${COLUMN} lg:max-w-6xl`}>
        <PageHeader back={{ href: back, label: "Bracket" }} sub={sub} title={title} />
        {board}
        <div className="lg:hidden">
          <SectionNav
            active={tab}
            label="This match"
            tabs={[
              { key: "match", label: "Match", href: base },
              { key: "teams", label: "Teams", href: `${base}?tab=teams` },
            ]}
          />
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:items-start lg:gap-10">
          <div className={shown(tab === "match")}>{match}</div>
          <div className={shown(tab === "teams")}>{teams}</div>
        </div>
        {foot && <div className="flex justify-center">{foot}</div>}
      </article>
    </main>
  );
}

/**
 * `MidweekScoreboard`: always side 0 on the left and side 1 on the right, from
 * the per-side goals, never the renderer's winner-first `score`. A block with
 * both sides' fills as a 3 px strip across the top (DR3-2); each club in its
 * colour at Body 600 (Heading from `sm`, two lines at most), the score as a
 * Figure in ink. Under each club its tags: `✓ Through` or `Out` at full time,
 * `You`, `Auto`. Live (ADR-115, DR4-2) the score so far, no Through or Out,
 * and on its own row the running `Live · 64′` with its progress line
 * (`MidweekMatchClock`). `compact` (the hub's and Home's Now blocks): no frame
 * of its own, no tags and no line.
 */
export function MidweekScoreboard({
  clubs,
  goals,
  penalties,
  winnerSide,
  youSide,
  auto,
  compact = false,
  live = null,
}: {
  clubs: Clubs;
  goals: readonly [number, number];
  penalties: readonly [number, number] | null;
  /** Ignored while `live`. */
  winnerSide: Side | null;
  youSide: Side | null;
  auto: readonly [boolean, boolean];
  compact?: boolean;
  live?: LiveScore | null;
}) {
  const label = live
    ? `Live, ${live.penalties ? "penalties" : `${ordinal(live.minute)} minute`}: ${clubs[0]} ${goals[0]}, ${clubs[1]} ${goals[1]}` +
      (live.penalties ? `, penalties ${live.penalties[0]}–${live.penalties[1]}.` : ".")
    : `Final score: ${clubs[0]} ${goals[0]}, ${clubs[1]} ${goals[1]}` +
      (penalties && winnerSide !== null
        ? `; ${clubs[winnerSide]} won ${Math.max(...penalties)}–${Math.min(...penalties)} on penalties.`
        : ".");
  const side = (s: Side) => (
    <div
      className={`grid min-w-0 content-start gap-1.5 ${s === 1 ? "justify-items-end text-right" : ""}`}
    >
      <p
        className={`line-clamp-2 text-body font-semibold hyphens-auto [overflow-wrap:anywhere] sm:text-heading ${TEAM_TEXT[s]}`}
      >
        {clubs[s]}
      </p>
      {!compact && (
        <p className={`flex flex-wrap gap-1 ${s === 1 ? "justify-end" : ""}`}>
          {!live &&
            winnerSide !== null &&
            (s === winnerSide ? <Tag tone="won">✓ Through</Tag> : <Tag tone="out">Out</Tag>)}
          {youSide === s && <Tag tone="you">You</Tag>}
          {auto[s] && <Tag tone="auto">Auto</Tag>}
        </p>
      )}
    </div>
  );
  return (
    <div
      aria-label={label}
      className={`relative grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start gap-3 overflow-hidden ${
        compact ? "" : "rounded-2xl border border-line/60 bg-panel/60 p-4 pt-5"
      }`}
      role="group"
    >
      {/* The two club colours as a 3 px strip across the top (DR3-2);
          decorative, the names and sides carry it. */}
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
        <MidweekMatchClock
          clock={live.clock}
          line={!compact}
          minute={live.minute}
          penalties={live.penalties}
        />
      )}
    </div>
  );
}

/**
 * `MidweekTimeline` (DR5-15): the full-time report's key moments under `How
 * it went`, oldest first, as a story under its headline (Q4), each a row on
 * its side (`MidweekMomentRow`). A live page shows `MidweekLiveFeed` instead,
 * newest first.
 */
export function MidweekTimeline({
  timeline,
  clubs,
}: {
  timeline: readonly TimelineItem[];
  clubs: Clubs;
}) {
  return (
    <section aria-labelledby="timeline-h" className="grid gap-1">
      <ReportSectionHead id="timeline-h" title="How it went" />
      <div className="@container">
        <ol aria-label="Key moments">
          {timeline.map((item) => (
            <MidweekMomentRow item={item} key={`m${item.minute}-${item.side}`} clubs={clubs} />
          ))}
        </ol>
      </div>
    </section>
  );
}

/**
 * `MidweekPenalties` (DR4-5, DR5-15): the shoot-out as one block. Live, the
 * tally above the feed, whose kicks are in it. At full time, after the
 * moments: the tally, the intro line, then every kick in order as the live
 * feed showed it, each with its own line under it (`shootoutStory`), the
 * decider ringed in brass, and a draw's line last when a draw settled it.
 */
export function MidweekPenalties({
  clubs,
  live = null,
  shootout = null,
}: {
  clubs: Clubs;
  /** A shoot-out in play: its kicks so far. */
  live?: readonly KickItem[] | null;
  /** At full time. */
  shootout?: ShootoutReport | null;
}) {
  const story = shootout ? shootoutStory(shootout) : null;
  const kicks = live ?? story?.kicks ?? [];
  return (
    <Block
      aside={
        <p className="text-small text-ink-dim">
          {kicks.length} {kicks.length === 1 ? "kick" : "kicks"}
          {live ? " so far" : ""}
        </p>
      }
      id="shootout-h"
      title="Penalties"
    >
      <MidweekShootoutTally clubs={clubs} kicks={kicks} live={live !== null} />
      {story && (
        <>
          <p className="text-body text-pretty text-ink-dim">
            <ReportText parts={story.intro} />
          </p>
          <div className="@container">
            <ol aria-label="Every kick in order">
              {story.kicks.map((kick) => (
                <MidweekKickRow key={`k${kick.side}-${kick.round}`} kick={kick} />
              ))}
            </ol>
          </div>
          {story.toss && (
            <p className="text-body text-pretty text-ink">
              <ReportText parts={story.toss} />
            </p>
          )}
        </>
      )}
    </Block>
  );
}
