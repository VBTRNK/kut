// DR5 artboard pages (design only): the real app chrome (`AppNav`) around the
// DR5 primitives and the revised Midweek and report components.
import type { ReactNode } from "react";
import { AppNav } from "@/components/app-shell/app-nav";
import type { CompeteStatus } from "@/lib/nav/routes";
import { Block, Button, COLUMN, InfoLink, Inset, LinkRow, LinkTile, PAGE, PageHeader, SectionNav, Stat, Tag, Figure } from "./ui";
import {
  CallBlock,
  HubTiles,
  PathList,
  PickList,
  PickSlots,
  Plusses,
  PreFive,
  RatingRows,
  RoundBlock,
  SaveBar,
  type PickRow,
  type RatedRow,
  type RowCall,
  type Tile,
} from "./midweek";
import {
  LiveFeed,
  MatchScoreboard,
  ReportTabs,
  ReportText,
  SectionHead,
  ShootoutBlock,
  TeamsPanel,
  Timeline,
  type Clubs,
  type LiveState,
} from "./report";
import type { BracketRound, PathRow } from "@/lib/midweek/evening";
import type { CallCard } from "@/lib/midweek/calls";
import type { PreSide } from "@/lib/midweek/prematch";
import type { KickItem } from "@/lib/midweek/report/kicks";
import type { ReportFact, Segment, TimelineItem, WhySide } from "@/lib/midweek/report/types";

export function Chrome({ children, status = null, balance = 1240 }: { children: ReactNode; status?: CompeteStatus | null; balance?: number }) {
  return (
    <>
      <AppNav balance={balance} competeStatus={status} displayName="Sanne" incomingOfferCount={0} isAdmin={false} unreadCount={0} />
      <div className="pb-[calc(4rem_+_env(safe-area-inset-bottom,0px))] sm:pb-0">{children}</div>
    </>
  );
}

/** Compete's section tabs in the DR5 style; the Midweek tab says `Live` during the evening. */
export function CompeteNav({ live }: { live: boolean }) {
  return (
    <SectionNav
      active="midweek"
      label="Compete"
      tabs={[
        { key: "midweek", label: "Midweek", href: "/midweek", badge: live ? <Tag tone="live">Live</Tag> : undefined },
        { key: "standings", label: "Standings", href: "/leaderboard" },
        { key: "players", label: "Players", href: "/players" },
      ]}
    />
  );
}

// -------------------------------------------------------------- the hub ----

export type HubProps = {
  live: boolean;
  status: CompeteStatus | null;
  title: string;
  sub: string;
  now: ReactNode;
  extra?: ReactNode;
  tiles: readonly Tile[];
};

/** `/midweek` (C2, DR5-1): the Now block, then four tiles; from `lg` the tiles sit beside it. */
export function HubPage(p: HubProps) {
  return (
    <Chrome status={p.status}>
      <main className={PAGE}>
        <div className={`${COLUMN} lg:max-w-5xl`}>
          <div className="lg:max-w-md">
            <CompeteNav live={p.live} />
          </div>
          <PageHeader sub={p.sub} title={p.title} />
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:items-start lg:gap-8">
            <div className="grid min-w-0 gap-6">
              {p.now}
              {p.extra}
            </div>
            <HubTiles tiles={p.tiles} />
          </div>
        </div>
      </main>
    </Chrome>
  );
}

// ------------------------------------------------------------- the picker ----

export type PickerProps = {
  sub: string;
  status: "none" | "dirty" | "saved";
  saveLine: string;
  slots: Parameters<typeof PickSlots>[0]["slots"];
  plusses: Parameters<typeof Plusses>[0];
  rows: readonly PickRow[];
  lastWeek: boolean;
  grid: boolean;
};

/**
 * `/midweek/pick` (F7): the five, the plusses, the save bar with the privacy
 * line, then your cards. From `lg` two columns: the five and the save on the
 * left (sticky), the card grid on the right.
 */
export function PickerPage(p: PickerProps) {
  return (
    <Chrome>
      <main className={PAGE}>
        <div className={`${COLUMN} lg:max-w-6xl`}>
          <PageHeader back={{ href: "/midweek", label: "Midweek" }} sub={p.sub} title="Pick your five" />
          <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:items-start lg:gap-10">
            <div className="grid min-w-0 gap-4 lg:sticky lg:top-24">
              <Block aside={<p className="text-small text-ink-dim">Empty slots play a trialist</p>} id="five-h" title="Your five">
                <PickSlots slots={p.slots} />
                <Plusses {...p.plusses} />
              </Block>
              <SaveBar lastWeek={p.lastWeek} line={p.saveLine} status={p.status} sticky={p.status === "dirty"} />
            </div>
            <PickList grid={p.grid} rows={p.rows} />
          </div>
        </div>
      </main>
    </Chrome>
  );
}

// ------------------------------------------------------------ the bracket ----

/** `/midweek/[week]/bracket`: a block per round, newest round first while the evening runs. */
export function BracketPage({
  sub,
  rounds,
  you,
  weekStart,
  now,
  tree,
  calls,
}: {
  sub: string;
  rounds: readonly BracketRound[];
  calls?: ReadonlyMap<string, RowCall>;
  you: string;
  weekStart: string;
  now: Date;
  /** From `lg`, the real tree (DR4-10), type moved onto the scale in S5. */
  tree?: ReactNode;
}) {
  return (
    <Chrome status="live">
      <main className={PAGE}>
        <div className={`${COLUMN} lg:max-w-7xl`}>
          <PageHeader back={{ href: "/midweek", label: "Midweek" }} sub={sub} title="Bracket" />
          <div className={`grid gap-4 ${tree ? "lg:hidden" : ""}`}>
            {rounds.map((round) => (
              <RoundBlock calls={calls} key={round.round} now={now} round={round} weekStart={weekStart} you={you} />
            ))}
          </div>
          {tree && <div className="hidden lg:block">{tree}</div>}
        </div>
      </main>
    </Chrome>
  );
}

// ------------------------------------------------------------ your night ----

export type NightProps = {
  sub: string;
  status: CompeteStatus | null;
  path: readonly PathRow[];
  rounds: number;
  roundName: (round: number) => string;
  weekStart: string;
  preMatch: string | null;
  coins: string;
  ratings: { title: string; sub: string; rows: readonly RatedRow[]; context: string; href?: string } | null;
  calls: { line: string; href: string } | null;
  share: boolean;
};

/** `/midweek/[week]/night`: your path, your five's ratings, your calls in a line, and the share images. */
export function NightPage(p: NightProps) {
  return (
    <Chrome status={p.status}>
      <main className={PAGE}>
        <div className={COLUMN}>
          <PageHeader back={{ href: "/midweek", label: "Midweek" }} sub={p.sub} title="Your night" />
          <Block aside={<p className="text-small text-ink-dim">{p.coins}</p>} id="path-h" title="Round by round">
            <PathList preMatch={p.preMatch} roundName={p.roundName} rounds={p.rounds} rows={p.path} weekStart={p.weekStart} />
          </Block>
          {p.ratings && (
            <Block aside={<p className="text-small text-ink-dim">{p.ratings.sub}</p>} id="ratings-h" title={p.ratings.title}>
              <RatingRows context={p.ratings.context} rows={p.ratings.rows} />
              <div className="flex flex-wrap justify-between gap-x-4">
                <InfoLink href="/how-it-works#ratings">How ratings work</InfoLink>
                {p.ratings.href && <InfoLink href={p.ratings.href}>Report</InfoLink>}
              </div>
            </Block>
          )}
          {p.calls && (
            <ul className="rounded-2xl border border-line/60 bg-panel/60 px-4">
              <LinkRow href={p.calls.href} meta={p.calls.line} title="Your calls" />
            </ul>
          )}
          {p.share && (
            <Block id="share-h" title="Share the night">
              <div className="grid grid-cols-2 gap-3">
                {["The champion", "Your night"].map((name) => (
                  <Inset className="grid gap-2" key={name}>
                    <span aria-hidden="true" className="aspect-[4/5] rounded-lg bg-board-deep/70" />
                    <span className="text-small font-semibold">{name}</span>
                  </Inset>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button kind="secondary">Share</Button>
                <Button kind="secondary">Save both</Button>
              </div>
            </Block>
          )}
        </div>
      </main>
    </Chrome>
  );
}

// ------------------------------------------------------------------ calls ----

/** `/midweek/[week]/calls`: open calls first, then closed and ended (ADR-118). */
export function CallsPage({
  sub,
  cards,
}: {
  sub: string;
  cards: readonly { card: CallCard; status: string; live: boolean; link: { label: string; href: string } | null }[];
}) {
  return (
    <Chrome status="live">
      <main className={PAGE}>
        <div className={COLUMN}>
          <PageHeader back={{ href: "/midweek", label: "Midweek" }} sub={sub} title="Calls" />
          <p className="text-small text-ink-dim">
            Call the winners still to come. Everyone sees the split from kick-off.{" "}
            <a className="font-semibold text-brass hover:underline" href="/how-it-works#calls">
              How calls work ›
            </a>
          </p>
          <div className="grid gap-4">
            {cards.map(({ card, status, live, link }) => (
              <CallBlock card={card} key={`${card.round}-${card.pairing}`} link={link} live={live} status={status} />
            ))}
          </div>
        </div>
      </main>
    </Chrome>
  );
}

// -------------------------------------------------------------- past week ----

/** `/midweek/[week]` for a week gone by: the same blocks as the hub after its final, and its tiles. */
export function WeekPage({
  title,
  sub,
  champion,
  result,
  tiles,
  seal,
}: {
  title: string;
  sub: string;
  champion: ReactNode;
  result: ReactNode;
  tiles: readonly Tile[];
  seal: string;
}) {
  return (
    <Chrome>
      <main className={PAGE}>
        <div className={`${COLUMN} lg:max-w-5xl`}>
          <PageHeader back={{ href: "/midweek/past", label: "Past weeks" }} sub={sub} title={title} />
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:items-start lg:gap-8">
            <div className="grid min-w-0 gap-6">
              {result}
              {champion}
            </div>
            <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3">
              <HubTiles tiles={tiles} />
              <details className="rounded-2xl border border-line/60 px-4">
                <summary className="flex min-h-12 cursor-pointer items-center text-small font-semibold text-ink-dim">Fairness seal</summary>
                <p className="pb-3 font-mono text-label break-all text-ink-faint">{seal}</p>
              </details>
            </div>
          </div>
        </div>
      </main>
    </Chrome>
  );
}

// --------------------------------------------------------------- pre-match ----

export function PreMatchPage({
  title,
  sub,
  sides,
  youSide,
  call,
  updated,
}: {
  title: string;
  sub: string;
  sides: readonly [PreSide, PreSide];
  youSide: 0 | 1 | null;
  call: { card: CallCard; status: string } | null;
  updated: string;
}) {
  return (
    <Chrome status="live">
      <main className={PAGE}>
        <div className={`${COLUMN} lg:max-w-5xl`}>
          <PageHeader back={{ href: "/midweek/2026-10-05/bracket", label: "Bracket" }} sub={sub} title={title} />
          {call && <CallBlock card={call.card} live={false} status={call.status} />}
          <p className="text-small text-ink-dim">Both fives as locked at 19:55.</p>
          <div className="grid gap-4 lg:grid-cols-2">
            <PreFive s={0} side={sides[0]} you={youSide === 0} />
            <PreFive s={1} side={sides[1]} you={youSide === 1} />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-x-4">
            <InfoLink href="/how-it-works#power">How Power works</InfoLink>
            <p className="text-small text-ink-faint">{updated}</p>
          </div>
        </div>
      </main>
    </Chrome>
  );
}

// ------------------------------------------------------------------ report ----

export type ReportProps = {
  back: string;
  headline: readonly Segment[] | string;
  sub: string;
  clubs: Clubs;
  goals: readonly [number, number];
  penalties: readonly [number, number] | null;
  winnerSide: 0 | 1 | null;
  youSide: 0 | 1 | null;
  auto: readonly [boolean, boolean];
  live: LiveState | null;
  tab: "match" | "teams";
  base: string;
  facts: readonly ReportFact[];
  timeline: readonly TimelineItem[];
  kicks: readonly KickItem[];
  shootout: { intro: readonly Segment[]; story: readonly KickItem[]; toss: readonly Segment[] | null } | null;
  liveShootout: boolean;
  kickoffAt: string;
  why: readonly [WhySide, WhySide];
  ratings: readonly [readonly number[], readonly number[]] | null;
  foot: string | null;
};

/**
 * A match page (E2, DR5-2): the header with the headline (or the live title)
 * in plain ink, the scoreboard, then Match · Teams. Below `lg` one tab; from
 * `lg` Match on the left with its moments in two lanes, Teams on the right.
 */
export function ReportPage(p: ReportProps) {
  const match = (
    <div className="grid min-w-0 content-start gap-6">
      {p.facts.length > 0 && (
        <ul className="grid list-disc gap-2 pl-5 text-body marker:text-ink-faint">
          {p.facts.map((fact, index) => (
            <li className="text-pretty" key={index}>
              <ReportText parts={fact.parts} />
            </li>
          ))}
        </ul>
      )}
      {p.live ? (
        <>
          {p.liveShootout && <ShootoutBlock clubs={p.clubs} kicks={p.kicks} live />}
          <LiveFeed clubs={p.clubs} kickoffAt={p.kickoffAt} kicks={p.kicks} shootout={p.liveShootout} timeline={p.timeline} />
        </>
      ) : (
        <>
          <Timeline clubs={p.clubs} timeline={p.timeline} />
          {p.shootout && (
            <ShootoutBlock clubs={p.clubs} intro={p.shootout.intro} kicks={p.shootout.story} live={false} story={p.shootout.story} toss={p.shootout.toss} />
          )}
        </>
      )}
    </div>
  );
  return (
    <Chrome status="live">
      <main className={PAGE}>
        <article className={`${COLUMN} lg:max-w-6xl`}>
          <PageHeader
            back={{ href: p.back, label: "Bracket" }}
            sub={p.sub}
            title={typeof p.headline === "string" ? p.headline : <ReportText parts={p.headline} plain />}
          />
          <MatchScoreboard auto={p.auto} clubs={p.clubs} goals={p.goals} live={p.live} penalties={p.penalties} winnerSide={p.winnerSide} youSide={p.youSide} />
          <ReportTabs active={p.tab} base={p.base} />
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:items-start lg:gap-10">
            <div className={p.tab === "match" ? "grid min-w-0" : "hidden min-w-0 lg:grid"}>{match}</div>
            <aside className={p.tab === "teams" ? "grid min-w-0" : "hidden min-w-0 lg:grid"}>
              <TeamsPanel heading ratings={p.ratings} why={p.why} />
            </aside>
          </div>
          {p.foot && <p className="text-center text-small text-ink-faint">{p.foot}</p>}
        </article>
      </main>
    </Chrome>
  );
}

// -------------------------------------------------------------------- home ----

/** Home's Midweek entry in three moments, as S3 places it on the new Home. */
export function HomeEntryBoard({ states }: { states: readonly { label: string; note: string; body: ReactNode }[] }) {
  return (
    <main className={PAGE}>
      <div className={`${COLUMN} gap-10`}>
        {states.map((state) => (
          <section className="grid gap-3" key={state.label}>
            <p className="rounded-lg border border-dashed border-steel-line px-3 py-2 text-small text-steel">
              <b className="font-semibold">{state.label}.</b> {state.note}
            </p>
            {state.body}
          </section>
        ))}
      </div>
    </main>
  );
}

/** Home's entry block: a Now block that links to `/midweek`, same rules as the hub's. */
export function HomeEntry({
  title,
  aside,
  line,
  button,
  children,
  tone = "now",
}: {
  title: string;
  aside: ReactNode;
  line: string;
  button: { label: string; href: string };
  children?: ReactNode;
  tone?: "now" | "plain";
}) {
  return (
    <Block aside={aside} id={`home-${title}`} title={title} tone={tone}>
      {children}
      <p className="text-small text-ink-dim">{line}</p>
      <Button href={button.href} kind={tone === "now" ? "primary" : "secondary"} wide={tone === "now"}>
        {button.label}
      </Button>
    </Block>
  );
}

// ------------------------------------------------------------- foundations ----

const ROLES = [
  ["Title", "text-title sm:text-title-lg font-serif font-normal", "32 px, 40 from sm · Instrument Serif 400", "The page title and a report's headline. Nothing else.", "Midweek Madness"],
  ["Figure", "text-figure font-extrabold tabular-nums", "40 px · Archivo 800, tabular", "Scores and the one big number on a tile. Never words.", "2–2 · +50"],
  ["Heading", "text-heading font-semibold", "20 px · Archivo 600", "Section and block headings.", "How it went"],
  ["Body", "text-body", "16 px · Archivo 400 (600 to name)", "Everything read: report lines, facts, rows.", "Bas V. pulls it back for Gijs H."],
  ["Small", "text-small text-ink-dim", "14 px · Archivo 400, ink-dim", "Context, meta, times; the line under a title. Replaces the kicker.", "Quarter-final 3 · full time"],
  ["Label", "text-label font-semibold", "12 px · Archivo 600, sentence case", "Tags, chips, column heads. The floor: nothing smaller.", "Goal · Auto · Live 64′"],
] as const;

/** The foundations board: scale, weights, spacing, surfaces, colour jobs and the primitives. */
export function FoundationsBoard() {
  return (
    <main className="board-ground grid gap-10 p-10 text-ink">
      <header className="grid gap-2">
        <h1 className="font-serif text-title-lg">Foundations</h1>
        <p className="max-w-3xl text-body text-ink-dim">
          The DR5 system as utilities: six text roles (<code>text-title</code> … <code>text-label</code>, a token each in
          globals.css), weights 400, 600 and 800, the spacing steps 1, 2, 3, 4, 6, 8, 12, and three surfaces. Everything on
          the other boards is built from what is on this one.
        </p>
      </header>

      <section className="grid gap-4">
        <h2 className="text-heading font-semibold">Six roles</h2>
        <div className="grid gap-2">
          {ROLES.map(([name, cls, spec, job, sample]) => (
            <div className="grid grid-cols-[8rem_minmax(0,1.3fr)_minmax(0,1fr)] items-baseline gap-6 border-b border-line/40 py-3" key={name}>
              <p className="grid gap-0.5">
                <span className="text-body font-semibold">{name}</span>
                <code className="text-label text-ink-faint">{cls.split(" ")[0]}</code>
              </p>
              <p className={cls}>{sample}</p>
              <p className="grid gap-0.5 text-small text-ink-dim">
                <span className="text-ink">{spec}</span>
                {job}
              </p>
            </div>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-3 gap-6">
        <Block id="weights-h" title="Three weights">
          <p className="text-body">400 · to read</p>
          <p className="text-body font-semibold">600 · to name or head</p>
          <p className="text-body font-extrabold">800 · figures and the primary button</p>
          <p className="text-small text-ink-dim">900 (black) only on the card face. No tracked capitals; no kicker.</p>
        </Block>
        <Block id="space-h" title="Spacing">
          <div className="flex items-end gap-3">
            {[1, 2, 3, 4, 6, 8, 12].map((step) => (
              <span className="grid justify-items-center gap-1" key={step}>
                <span className={`block w-4 rounded-sm bg-brass/70 ${["h-1", "h-2", "h-3", "h-4", "h-6", "h-8", "h-12"][[1, 2, 3, 4, 6, 8, 12].indexOf(step)]}`} />
                <span className="text-label text-ink-dim">{step * 4}</span>
              </span>
            ))}
          </div>
          <p className="text-small text-ink-dim">16 inside a block, 8–12 between rows, 24 between blocks on a phone and 32 from sm, page gutter 16 (32 from sm).</p>
        </Block>
        <Block id="colour-h" title="Colour has jobs">
          <p className="flex flex-wrap gap-1.5">
            <Tag tone="you">Brass · action, now</Tag>
            <Tag tone="live">Live</Tag>
            <Tag tone="won">Moss · good</Tag>
            <span className="inline-flex items-center rounded-full border border-team-0 px-2 py-0.5 text-label font-semibold text-team-0">Side 0</span>
            <span className="inline-flex items-center rounded-full border border-team-1 px-2 py-0.5 text-label font-semibold text-team-1">Side 1</span>
          </p>
          <p className="text-small text-ink-dim">Text is ink, ink-dim or ink-faint. At most five text colours on a screen. Team colours mark sides: names, rails, dots, never a whole box.</p>
        </Block>
      </div>

      <section className="grid gap-4">
        <h2 className="text-heading font-semibold">Three surfaces</h2>
        <div className="grid grid-cols-3 gap-6 rounded-2xl border border-dashed border-line/60 p-6">
          <div className="grid content-start gap-1">
            <p className="text-body font-semibold">Page</p>
            <p className="text-small text-ink-dim">The board. No border, no fill. <code>PAGE</code>, <code>COLUMN</code> (max-w-2xl; a page widens only where columns help).</p>
          </div>
          <Block id="surf-block-h" title="Block">
            <p className="text-small text-ink-dim">Panel, 1 px line, radius 16, padding 16. Has a heading, or is one link (a tile). Brass tint: needs you now, one per screen.</p>
            <Inset>
              <p className="text-small">Inset: panel-2, radius 12, no border. Only inside a block: a row, a stat.</p>
            </Inset>
          </Block>
          <Block id="surf-now-h" title="Block, now" tone="now">
            <p className="text-small text-ink-dim">The one thing this screen asks of you.</p>
            <Button wide>Pick your five</Button>
          </Block>
        </div>
      </section>

      <section className="grid gap-4">
        <h2 className="text-heading font-semibold">Primitives</h2>
        <div className="grid grid-cols-2 gap-6">
          {[
            ["PageHeader", "{ title, sub?, back? }", <PageHeader back={{ href: "#", label: "Bracket" }} key="ph" sub="Quarter-final 3 · full time" title="Bas V. settles it" />],
            ["Block", "{ title?, id?, aside?, tone: 'plain' | 'now', children }", <Block aside={<p className="text-small text-ink-dim">+50 so far</p>} id="pb-h" key="b" title="Round by round"><p className="text-body">A block is one thing.</p></Block>],
            ["SectionNav", "{ label, tabs: { key, label, href, badge? }[], active }", <SectionNav active="match" key="sn" label="Match" tabs={[{ key: "match", label: "Match", href: "#" }, { key: "teams", label: "Teams", href: "#" }]} />],
            ["LinkTile", "{ href?, title, state, tone: 'plain' | 'live' | 'now' }", <div className="grid grid-cols-2 gap-3" key="lt"><LinkTile href="#" state="Quarter-finals · 4 live" title="Bracket" tone="live" /><LinkTile state="Drawn at 19:55" title="Bracket" /></div>],
            ["LinkRow", "{ href, title, meta?, end? }", <ul className="rounded-2xl border border-line/60 px-4" key="lr"><LinkRow end="+50" href="#" meta="Quarter-finals" title="Wed 7 Oct" /></ul>],
            ["InfoLink · Tag · Button", "{ href, children } · { tone, children } · { href?, kind, wide? }", <div className="grid gap-3" key="it"><InfoLink href="#">How ratings work</InfoLink><p className="flex flex-wrap gap-1.5"><Tag tone="goal">Goal</Tag><Tag>Save</Tag><Tag tone="auto">Auto</Tag><Tag tone="won">✓ Through</Tag><Tag tone="out">Out</Tag><Tag tone="live">Live · 64′</Tag></p><p className="flex flex-wrap gap-2"><Button>Save your five</Button><Button kind="secondary">Load last week’s</Button></p></div>],
            ["Stat · Figure", "{ label, value, note?, tone? } · { children }", <dl className="grid grid-cols-2 gap-2" key="st"><Stat label="You" note="paid to your wallet" tone="brass" value="+50" /><Stat label="Your finish" note="Quarter-finals" value="Last 8" /></dl>],
            ["Figure in a scoreboard", "MatchScoreboard { clubs, goals, penalties, winnerSide, youSide, auto, live?, compact? }", <p key="fg"><Figure>2–2</Figure></p>],
          ].map(([name, props, sample]) => (
            <div className="grid content-start gap-3 rounded-2xl border border-dashed border-line/60 p-4" key={name as string}>
              <p className="grid gap-0.5">
                <span className="text-body font-semibold">{name}</span>
                <code className="text-label text-ink-faint">{props}</code>
              </p>
              {sample}
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

/** A labelled column for the before/after board. */
export function BeforeAfter({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid content-start gap-3">
      <p className="rounded-lg border border-dashed border-steel-line px-3 py-2 text-small text-steel">{label}</p>
      {children}
    </div>
  );
}

export { SectionHead };
