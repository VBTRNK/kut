// DR5 Midweek components (design only): C2 (DR5-1) and DR5-5 to DR5-8, DR5-10.
// The hub is one Now block that changes with the evening and four tiles in
// fixed places; everything else is a page of its own behind a tile.
import Link from "next/link";
import type { ReactNode } from "react";
import { LiveCard, type LiveCardPlayer } from "@/components/live-card";
import { MidweekMiniCard } from "@/components/midweek/mini-card";
import { formatClock } from "@/lib/midweek/entry";
import type { BracketPair, BracketRound, BracketSlot, PathRow } from "@/lib/midweek/evening";
import type { CallCard } from "@/lib/midweek/calls";
import type { PreSide } from "@/lib/midweek/prematch";
import { powerBand } from "@/lib/midweek/power";
import { MIDWEEK } from "@/game/midweek/config";
import { Block, Button, Inset, InfoLink, LinkTile, Tag } from "./ui";
import { Disc, MatchScoreboard, TEAM_TEXT, type Clubs, type LiveState } from "./report";

export type Mini = { rarityTier: LiveCardPlayer["rarityTier"]; ovr: number; injured: boolean } | null;

/** A five as mini cards: a trialist's slot dashed (`Trialist`), five in one row at 320 px. */
export function MiniFive({ cards, label }: { cards: readonly Mini[]; label: string }) {
  return (
    <ul aria-label={label} className="flex flex-wrap gap-1.5">
      {cards.map((card, index) => (
        <li key={index}>
          {card ? (
            <MidweekMiniCard injured={card.injured} ovr={card.ovr} rarityTier={card.rarityTier} />
          ) : (
            <span className="grid aspect-[5/7] w-[46px] place-items-center rounded-md border border-dashed border-brass-line text-label text-ink-faint">
              <span aria-hidden="true">Tri</span>
              <span className="sr-only">Trialist</span>
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

// ------------------------------------------------------------------- hub ----

export type Tile = { title: string; state: ReactNode; href?: string; tone?: "plain" | "live" | "now" };

/** The four tiles, always in the same places (DR5-1). */
export function HubTiles({ tiles }: { tiles: readonly Tile[] }) {
  return (
    <nav aria-label="Midweek" className="grid grid-cols-2 gap-3">
      {tiles.map((tile) => (
        <LinkTile href={tile.href} key={tile.title} state={tile.state} title={tile.title} tone={tile.tone} />
      ))}
    </nav>
  );
}

/** Before the lock: your five, picked or not (Picker moves to `/midweek/pick`, F7). */
export function NowFive({
  cards,
  saved,
  countdown,
  savedLine,
}: {
  cards: readonly Mini[];
  saved: boolean;
  countdown: string;
  savedLine?: string;
}) {
  return (
    <Block
      aside={saved ? <Tag tone="won">✓ Saved</Tag> : <p className="text-small font-semibold text-brass">Locks {countdown}</p>}
      id="now-h"
      title="Your five"
      tone={saved ? "plain" : "now"}
    >
      <MiniFive cards={cards} label="Your five" />
      <p className="text-small text-ink-dim">
        {saved ? savedLine : "Not picked yet, so an auto squad would play."}
      </p>
      {saved ? (
        <Button href="/midweek/pick" kind="secondary">
          Change your five
        </Button>
      ) : (
        <Button href="/midweek/pick" wide>
          Pick your five
        </Button>
      )}
    </Block>
  );
}

/** The draw is out, before round 1: who you meet (or, after a bye, who you may meet). */
export function NowDraw({
  title,
  sub,
  text,
  fives,
}: {
  title: string;
  sub: string;
  text: string;
  fives: { label: string; you: boolean; cards: readonly Mini[]; auto: boolean }[];
}) {
  return (
    <Block aside={<p className="text-small text-ink-dim">{sub}</p>} id="now-h" title={title}>
      <p className="text-body text-pretty">{text}</p>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-3">
        {fives.map((five) => (
          <div className="grid grid-cols-[minmax(0,1fr)] gap-1.5" key={five.label}>
            <p className="flex flex-wrap items-center gap-1.5 text-small font-semibold">
              <span className="min-w-0 truncate">{five.label}</span>
              {five.you && <Tag tone="you">You</Tag>}
              {five.auto && <Tag tone="auto">Auto</Tag>}
            </p>
            <MiniFive cards={five.cards} label={five.label} />
          </div>
        ))}
      </div>
    </Block>
  );
}

/**
 * A match in play for you: yours this round, or the final for everyone (DR2-1:
 * one match, team colours). The score and the minute only; the moments are on
 * the match page (owner, 12 Oct: no latest chance on the hub).
 */
export function NowMatch({
  title,
  clubs,
  goals,
  live,
  youSide,
  href,
}: {
  title: string;
  clubs: Clubs;
  goals: readonly [number, number];
  live: LiveState;
  youSide: 0 | 1 | null;
  href: string;
}) {
  return (
    <Block id="now-h" title={title} tone="now">
      <MatchScoreboard auto={[false, false]} clubs={clubs} compact goals={goals} live={live} youSide={youSide} />
      <Button href={href} wide>
        Watch it
      </Button>
    </Block>
  );
}

/** Between rounds while you're in: your next match, and its pre-match once it opens (DR4-7). */
export function NowNext({
  clubs,
  sub,
  countdown,
  preMatch,
  waiting,
}: {
  clubs: Clubs;
  sub: string;
  countdown: string;
  preMatch: string | null;
  waiting: string | null;
}) {
  return (
    <Block aside={<p className="text-small text-ink-dim">{sub}</p>} id="now-h" title="Your next match" tone="now">
      <p className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3">
        <span className={`line-clamp-2 text-body font-semibold ${TEAM_TEXT[0]}`}>{clubs[0]}</span>
        <span className="text-small text-ink-faint">v</span>
        <span className={`line-clamp-2 text-right text-body font-semibold ${TEAM_TEXT[1]}`}>{clubs[1]}</span>
      </p>
      <p className="text-small text-ink-dim">Kick-off {countdown}.</p>
      {preMatch ? (
        <Button href={preMatch} wide>
          Pre-match
        </Button>
      ) : (
        waiting && <p className="text-small text-ink-dim">{waiting}</p>
      )}
    </Block>
  );
}

/** Out: where your night ended, and the calls while any are open (ADR-118). */
export function NowOut({
  line,
  coins,
  open,
  href,
}: {
  line: string;
  coins: string;
  open: number;
  href: string;
}) {
  return (
    <Block aside={<p className="text-small text-ink-dim">{coins}</p>} id="now-h" title="You’re out" tone={open > 0 ? "now" : "plain"}>
      <p className="text-body">{line}</p>
      {open > 0 && (
        <>
          <p className="text-small text-ink-dim">Call the winners still to come.</p>
          <Button href={href} wide>
            Make your calls
          </Button>
        </>
      )}
    </Block>
  );
}

/** After the final: your result, paid, and next week while it is open. */
export function NowResult({
  coins,
  coinsNote,
  finish,
  finishNote,
  next,
}: {
  coins: string;
  coinsNote: string;
  finish: string;
  finishNote: string;
  next: { line: string; href: string } | null;
}) {
  return (
    <Block id="now-h" title="Your night" tone={next ? "now" : "plain"}>
      <dl className="grid grid-cols-2 items-end gap-2">
        <div>
          <dt className="text-label font-semibold text-ink-faint">You</dt>
          <dd className="grid gap-0.5">
            <span className="text-figure font-extrabold text-brass tabular-nums">{coins}</span>
            <span className="text-small text-ink-dim">{coinsNote}</span>
          </dd>
        </div>
        <div>
          <dt className="text-label font-semibold text-ink-faint">Your finish</dt>
          <dd className="grid gap-0.5">
            {/* A finish is words ("Quarters", "Champion"), so a Heading, never a Figure. */}
            <span className="text-heading font-semibold">{finish}</span>
            <span className="text-small text-ink-dim">{finishNote}</span>
          </dd>
        </div>
      </dl>
      {next && (
        <>
          <p className="text-small text-ink-dim">{next.line}</p>
          <Button href={next.href} wide>
            Pick next week’s five
          </Button>
        </>
      )}
    </Block>
  );
}

/** The champion: the final in one line and their five as mini cards. */
export function ChampionBlock({
  line,
  href,
  cards,
  label,
}: {
  line: string;
  href: string;
  cards: readonly Mini[];
  label: string;
}) {
  return (
    <Block id="final-h" title="The final">
      <p className="text-body">{line}</p>
      <MiniFive cards={cards} label={label} />
      <InfoLink href={href}>Report</InfoLink>
    </Block>
  );
}

// ---------------------------------------------------------------- picker ----

export type PickRow = {
  name: string;
  meta: string;
  plusses: string | null;
  mini: NonNullable<Mini>;
  face: LiveCardPlayer;
  copies: number;
  in: boolean;
};

/** The five slots: a mini card and name, or a dashed trialist slot. */
export function PickSlots({ slots }: { slots: readonly ({ name: string; meta: string; mini: NonNullable<Mini> } | null)[] }) {
  return (
    <ol aria-label="Your five" className="grid gap-1.5">
      {slots.map((slot, index) => (
        <li
          className={`grid min-h-14 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-xl px-2.5 py-1.5 ${
            slot ? "bg-panel-2/80" : "border border-dashed border-line"
          }`}
          key={index}
        >
          {slot ? (
            <MidweekMiniCard injured={slot.mini.injured} ovr={slot.mini.ovr} rarityTier={slot.mini.rarityTier} small />
          ) : (
            <span className="grid aspect-[5/7] w-[34px] place-items-center rounded-md border border-dashed border-line text-label text-ink-faint">
              {index + 1}
            </span>
          )}
          <span className="grid min-w-0">
            <span className={`truncate text-body ${slot ? "font-semibold" : "text-ink-dim"}`}>{slot ? slot.name : "Trialist"}</span>
            <span className="truncate text-small text-ink-dim">{slot ? slot.meta : `OVR ${MIDWEEK.trialist.ovr}`}</span>
          </span>
          {slot && (
            <button className="inline-flex min-h-11 items-center px-2 text-small font-semibold text-ink-dim" type="button">
              Remove
            </button>
          )}
        </li>
      ))}
    </ol>
  );
}

/** The plusses per line (DR3 kept, DR5-10): three insets, the verdict, the rule behind a link. */
export function Plusses({
  lines,
  short,
  verdict,
  keeper,
}: {
  lines: readonly number[] | null;
  short: readonly number[] | null;
  verdict: string;
  keeper: string | null;
}) {
  return (
    <div className="grid gap-2">
      {lines && short && (
        <dl aria-label="Plusses per line" className="grid grid-cols-3 gap-2">
          {["Attack", "Midfield", "Defence"].map((name, line) => (
            <Inset className="grid gap-0.5" key={name}>
              <dt className="text-label font-semibold text-ink-faint">{name}</dt>
              <dd className={`text-body font-semibold tabular-nums ${short[line] > 0 ? "text-warning" : "text-moss"}`}>
                {lines[line]} {short[line] > 0 ? `· ${short[line]} short` : "✓"}
              </dd>
            </Inset>
          ))}
        </dl>
      )}
      <p className="text-small text-ink-dim">
        {verdict}
        {keeper && ` ${keeper}`}
      </p>
      <InfoLink href="/how-it-works#plusses">How plusses work</InfoLink>
    </div>
  );
}

/** The save bar: status, the primary save, and the one-line privacy notice (DR5-8). */
export function SaveBar({
  status,
  line,
  lastWeek,
  sticky = false,
}: {
  status: "none" | "dirty" | "saved";
  line: string;
  lastWeek: boolean;
  sticky?: boolean;
}) {
  return (
    <div
      className={`grid gap-3 rounded-2xl border p-4 ${
        status === "dirty" ? "border-brass-line bg-panel" : "border-line/60 bg-panel/60"
      } ${sticky ? "max-sm:shadow-[0_-12px_24px_-10px_rgb(0_0_0/70%)]" : ""}`}
    >
      <p className="flex flex-wrap items-center gap-2 text-small">
        {status === "saved" ? <Tag tone="won">✓ Saved</Tag> : status === "dirty" ? <Tag tone="you">Not saved</Tag> : <Tag>Not picked</Tag>}
        <span className="text-ink-dim">{line}</span>
      </p>
      <div className="flex flex-wrap gap-2">
        {status === "saved" ? (
          <Button kind="secondary">Change your five</Button>
        ) : (
          <>
            <Button>Save your five</Button>
            {lastWeek && <Button kind="secondary">Load last week’s</Button>}
          </>
        )}
      </div>
      <p className="text-small text-ink-dim">
        Members see the five you enter from 19:55.{" "}
        <Link className="font-semibold whitespace-nowrap text-brass hover:underline" href="/how-it-works#privacy">
          Privacy ›
        </Link>
      </p>
    </div>
  );
}

/** Your cards: one row per Player below `lg`, the card grid from `lg`. Filters live in a sheet (C). */
export function PickList({ rows, grid }: { rows: readonly PickRow[]; grid: boolean }) {
  return (
    <section aria-labelledby="cards-h" className="grid gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-heading font-semibold" id="cards-h">
          Your cards
        </h2>
        <Button kind="secondary">Filter</Button>
      </div>
      {/* Below lg one row per Player; from lg the card grid. Each width has exactly one list. */}
      {grid && (
        <ul className="hidden grid-cols-4 gap-x-4 gap-y-5 lg:grid">
          {rows.map((row) => (
            <li className="grid content-start gap-2" key={row.name}>
              <div className={row.in ? "[&_.live-card]:outline-3 [&_.live-card]:outline-offset-3 [&_.live-card]:outline-moss" : ""}>
                <LiveCard player={row.face} />
              </div>
              {row.in ? (
                <p className="flex min-h-11 items-center justify-center rounded-xl border border-moss-line bg-moss-bg text-small font-semibold text-moss">
                  ✓ In your five
                </p>
              ) : (
                <button className="min-h-11 rounded-xl border border-line text-small font-semibold text-ink hover:border-brass-line" type="button">
                  Add
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {(
        <ul className={`grid gap-1.5 ${grid ? "lg:hidden" : ""}`}>
          {rows.map((row) => (
            <li
              className={`grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-xl px-2.5 py-2 ${
                row.in ? "bg-moss-bg/60" : "bg-panel/60"
              }`}
              key={row.name}
            >
              <MidweekMiniCard injured={row.mini.injured} ovr={row.mini.ovr} rarityTier={row.mini.rarityTier} />
              <span className="grid min-w-0">
                <span className="truncate text-body font-semibold">{row.name}</span>
                <span className="text-small text-ink-dim">
                  {row.meta}
                  {row.copies > 1 && ` · ×${row.copies}`}
                </span>
                {row.plusses && <span className="text-small text-ink-faint">{row.plusses}</span>}
              </span>
              {row.in ? (
                <Tag tone="won">✓ In</Tag>
              ) : (
                <button className="min-h-11 rounded-lg border border-line px-3 text-small font-semibold" type="button">
                  Add
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ------------------------------------------------------------- your night ----

const PATH_WORD = (row: PathRow, rounds: number, roundName: (r: number) => string): { title: string; meta: string } => {
  const where = roundName(row.round);
  switch (row.kind) {
    case "bye":
      return { title: "Bye", meta: where };
    case "won":
      return { title: `Beat ${row.opponent} ${row.score}`, meta: where };
    case "out":
      return { title: `Lost to ${row.opponent} ${row.score}`, meta: where };
    case "live":
      return { title: `Playing ${row.opponent} now`, meta: `${where} · live` };
    case "next":
      return { title: row.opponent ? `Next: ${row.opponent}` : "Next: to be decided", meta: `${where} · ${formatClock(row.revealAt)}` };
  }
};

/** `Your night` (MidweekPath, revised): one row per round, each a link to its report. */
export function PathList({
  rows,
  rounds,
  roundName,
  weekStart,
  preMatch,
}: {
  rows: readonly PathRow[];
  rounds: number;
  roundName: (round: number) => string;
  weekStart: string;
  preMatch: string | null;
}) {
  return (
    <ol aria-label="Your night" className="grid">
      {rows.map((row) => {
        const { title, meta } = PATH_WORD(row, rounds, roundName);
        const coins =
          row.kind === "out" ? "" : row.kind === "next" || row.kind === "live" ? `win +${row.coins}` : `+${row.coins}`;
        const href =
          row.kind === "won" || row.kind === "out" || row.kind === "live"
            ? `/midweek/${weekStart}/match/${row.matchId}`
            : row.kind === "next"
              ? preMatch
              : null;
        const body = (
          <>
            <span className="grid min-w-0 gap-0.5">
              <span className={`text-body ${row.kind === "out" ? "text-ink-dim" : "font-semibold"}`}>{title}</span>
              <span className="text-small text-ink-dim">{meta}</span>
            </span>
            <span className="flex items-center gap-2 text-small tabular-nums">
              {row.kind === "live" && <Tag tone="live">Live</Tag>}
              <span className={row.kind === "won" || row.kind === "bye" ? "font-semibold text-brass" : "text-ink-dim"}>{coins}</span>
              {href && (
                <span aria-hidden="true" className="text-ink-faint">
                  ›
                </span>
              )}
            </span>
          </>
        );
        const cls = "grid min-h-14 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-2.5";
        return (
          <li className="border-b border-line/40 last:border-b-0" key={row.round}>
            {href ? (
              <Link className={`${cls} hover:text-brass`} href={href}>
                {body}
              </Link>
            ) : (
              <div className={cls}>{body}</div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

export type RatedRow = { name: string; meta: string; line: string | null; mini: Mini; rating: number; best: boolean };

/** Ratings, simpler (DR5-6): mini card, name, line in Small, disc. No per-match chips. */
export function RatingRows({ rows, context }: { rows: readonly RatedRow[]; context: string }) {
  return (
    <ul className="grid gap-1.5">
      {rows.map((row) => (
        <li className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-xl bg-panel-2/80 p-2" key={row.name}>
          {row.mini ? (
            <MidweekMiniCard injured={row.mini.injured} ovr={row.mini.ovr} rarityTier={row.mini.rarityTier} small />
          ) : (
            <span className="grid aspect-[5/7] w-[34px] place-items-center rounded-md border border-dashed border-line text-label text-ink-faint">
              Tri
            </span>
          )}
          <span className="grid min-w-0 gap-0.5">
            <span className="flex flex-wrap items-center gap-1.5 text-body font-semibold">
              <span className="min-w-0 [overflow-wrap:anywhere]">{row.name}</span>
              {row.best && <Tag>★ Best</Tag>}
            </span>
            <span className="text-small text-ink-dim">{row.line ?? row.meta}</span>
          </span>
          <Disc context={context} rating={row.rating} />
        </li>
      ))}
    </ul>
  );
}

// ------------------------------------------------------------------ calls ----

/** A call card (ADR-118, DR3-6): the two clubs to choose from as buttons, the status in Small. */
export function CallBlock({
  card,
  status,
  live,
  link = null,
}: {
  card: CallCard;
  status: string;
  live: boolean;
  /** `Pre-match ›` while it is open, `Watch it ›` in play, `Report ›` once ended. */
  link?: { label: string; href: string } | null;
}) {
  const chosen = (s: 0 | 1) => card.pick === s;
  const open = card.state === "open";
  const split = card.split;
  const total = split ? split[0] + split[1] : 0;
  return (
    <Block
      aside={
        live ? (
          <Tag tone="live">Live</Tag>
        ) : card.state === "ended" ? (
          card.pick === null ? null : card.pick === card.winner ? <Tag tone="won">✓ Right</Tag> : <Tag tone="out">Wrong</Tag>
        ) : (
          <p className="text-small text-ink-dim">Kick-off {formatClock(card.kickoffAt)}</p>
        )
      }
      id={`call-${card.round}-${card.pairing}`}
      title={card.label}
      tone={open && card.pick === null ? "now" : "plain"}
    >
      <div className="grid grid-cols-2 gap-2">
        {([0, 1] as const).map((s) => (
          <button
            aria-pressed={chosen(s)}
            className={`grid min-h-12 min-w-0 items-center rounded-xl border px-3 text-left text-body ${
              chosen(s) ? "border-brass bg-brass-bg font-semibold text-brass" : "border-line text-ink"
            } ${card.sides[s].userId === null ? "text-ink-faint" : ""}`}
            disabled={!open || card.sides[s].userId === null}
            key={s}
            type="button"
          >
            <span className="truncate">{card.sides[s].name}</span>
          </button>
        ))}
      </div>
      {split && total > 0 && (
        <div className="grid gap-1">
          <svg aria-label={`${split[0]} picked ${card.sides[0].name}, ${split[1]} picked ${card.sides[1].name}`} className="block h-1.5 w-full overflow-hidden rounded" preserveAspectRatio="none" role="img" viewBox="0 0 100 6">
            <rect className="fill-steel" height="6" width={Math.round((split[0] / total) * 100)} />
            <rect className="fill-line" height="6" width={100 - Math.round((split[0] / total) * 100)} x={Math.round((split[0] / total) * 100)} />
          </svg>
          <p aria-hidden="true" className="flex justify-between text-small text-ink-dim tabular-nums">
            <span>{split[0]} picked</span>
            <span>{split[1]} picked</span>
          </p>
        </div>
      )}
      <p className="text-small text-ink-dim">{status}</p>
      {link && <InfoLink href={link.href}>{link.label}</InfoLink>}
    </Block>
  );
}

// ---------------------------------------------------------------- bracket ----

const pairHref = (pair: BracketPair, weekStart: string): string | null =>
  pair.kind === "played" || pair.kind === "inplay"
    ? `/midweek/${weekStart}/match/${pair.match.match_id}`
    : pair.kind === "upcoming" && pair.preMatch
      ? `/midweek/${weekStart}/next/${pair.round}/${pair.pairing}`
      : null;

function sideLine(slot: BracketSlot, score: string | null, tone: string, you: boolean) {
  return (
    <span className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-2">
      <span className={`truncate text-body ${tone}`}>
        {slot.name}
        {you && <span className="sr-only"> (you)</span>}
      </span>
      {score !== null && <span className={`text-body tabular-nums ${tone}`}>{score}</span>}
    </span>
  );
}

/**
 * `MidweekMatchRow`, restyled: two club lines with their scores, the state on
 * the right (`Live 64′`, `20:45`, `Pre-match`), your pairing ringed in brass.
 * The whole row is the link; club names stay on one line (DR4-6, DR4-9).
 */
export type RowCall = { kind: "picked"; name: string } | { kind: "open" };

export function MatchRow({
  pair,
  you,
  weekStart,
  call = null,
}: {
  pair: BracketPair;
  you: string;
  weekStart: string;
  /** Once you're out: your call on this match, or that it is open to call (`rowCalls`). */
  call?: RowCall | null;
}) {
  const mine = (slot: BracketSlot) => !slot.placeholder && slot.userId === you;
  const isYou = pair.sides.some(mine);
  const href = pairHref(pair, weekStart);
  let lines: ReactNode;
  let state: ReactNode = null;
  if (pair.kind === "bye") {
    lines = sideLine(pair.sides[0], null, "text-ink-dim", mine(pair.sides[0]));
    state = <span className="text-small text-ink-faint">Bye</span>;
  } else if (pair.kind === "played") {
    const m = pair.match;
    const winner = m.winner_side ?? 0;
    const score = (s: 0 | 1) => {
      const goals = s === 0 ? m.side_0_goals : m.side_1_goals;
      const pens = s === 0 ? m.side_0_penalties : m.side_1_penalties;
      return `${goals}${pens !== null ? ` (${pens})` : ""}`;
    };
    lines = (
      <>
        {sideLine(pair.sides[0], score(0), winner === 0 ? "font-semibold text-ink" : "text-ink-faint", mine(pair.sides[0]))}
        {sideLine(pair.sides[1], score(1), winner === 1 ? "font-semibold text-ink" : "text-ink-faint", mine(pair.sides[1]))}
      </>
    );
  } else if (pair.kind === "inplay") {
    const live = pair.live;
    const score = (s: 0 | 1) => (live ? `${live.goals[s]}${live.penalties ? ` (${live.penalties[s]})` : ""}` : "–");
    lines = (
      <>
        {sideLine(pair.sides[0], score(0), "text-ink", mine(pair.sides[0]))}
        {sideLine(pair.sides[1], score(1), "text-ink", mine(pair.sides[1]))}
      </>
    );
    state = <Tag tone="live">{live?.penalties ? "Pens" : `${live?.minute ?? 0}′`}</Tag>;
  } else {
    lines = (
      <>
        {sideLine(pair.sides[0], null, pair.sides[0].placeholder ? "text-ink-faint" : "text-ink", mine(pair.sides[0]))}
        {sideLine(pair.sides[1], null, pair.sides[1].placeholder ? "text-ink-faint" : "text-ink", mine(pair.sides[1]))}
      </>
    );
    state = (
      <span className="grid justify-items-end text-small">
        <span className="text-ink-dim tabular-nums">{formatClock(pair.kickoffAt)}</span>
        {pair.preMatch && <span className="font-semibold text-brass">Pre-match</span>}
      </span>
    );
  }
  const cls = `grid min-h-14 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border px-3 py-2 ${
    isYou ? "border-brass-line bg-brass-bg/30" : "border-line/50 bg-panel/50"
  }`;
  const inner = (
    <>
      <span className="grid min-w-0 gap-0.5">
        {lines}
        {call && (
          <span className="pt-1">
            {call.kind === "picked" ? <Tag tone="you">Your call: {call.name}</Tag> : <Tag tone="you">Call open</Tag>}
          </span>
        )}
      </span>
      <span className="flex items-center gap-2">
        {state}
        {href && (
          <span aria-hidden="true" className="text-ink-faint">
            ›
          </span>
        )}
      </span>
    </>
  );
  return (
    <li>
      {href ? (
        <Link className={`${cls} hover:border-brass-line`} href={href}>
          {inner}
        </Link>
      ) : (
        <div className={cls}>{inner}</div>
      )}
    </li>
  );
}

/** One round of the bracket as a block of rows. */
export function RoundBlock({
  round,
  you,
  weekStart,
  now,
  calls,
}: {
  round: BracketRound;
  you: string;
  weekStart: string;
  now: Date;
  calls?: ReadonlyMap<string, RowCall>;
}) {
  const live = round.pairs.some((pair) => pair.kind === "inplay");
  const started = Date.parse(round.kickoffAt) <= now.getTime();
  return (
    <Block
      aside={live ? <Tag tone="live">Live</Tag> : <p className="text-small text-ink-dim tabular-nums">{started ? "Played" : `Kick-off ${formatClock(round.kickoffAt)}`}</p>}
      id={`round-${round.round}-h`}
      title={round.name}
    >
      <ul className="grid gap-2 sm:grid-cols-2">
        {round.pairs.map((pair) => (
          <MatchRow call={calls?.get(`${pair.round}/${pair.pairing}`) ?? null} key={pair.pairing} pair={pair} weekStart={weekStart} you={you} />
        ))}
      </ul>
    </Block>
  );
}

// -------------------------------------------------------------- pre-match ----

/** One side's five on the pre-match (DR4-7, DR4-11), restyled: a rail block, plusses, cards by Power. */
export function PreFive({ side, s, you }: { side: PreSide; s: 0 | 1; you: boolean }) {
  return (
    <section
      aria-label={`${side.club}: the five`}
      className={`grid min-w-0 content-start gap-3 rounded-2xl border border-t-[3px] border-line/60 bg-panel/60 p-4 ${s === 0 ? "border-t-team-0-fill" : "border-t-team-1-fill"}`}
    >
      <div className="grid gap-0.5">
        <h2 className={`text-body font-semibold [overflow-wrap:anywhere] ${TEAM_TEXT[s]}`}>{side.club}</h2>
        <p className="flex flex-wrap items-center gap-1.5 text-small text-ink-dim">
          {side.account}’s five
          {you && <Tag tone="you">You</Tag>}
          {side.auto && <Tag tone="auto">Auto</Tag>}
        </p>
      </div>
      <dl aria-label="Plusses per line" className="grid grid-cols-3 gap-2">
        {["Attack", "Midfield", "Defence"].map((name, line) => (
          <Inset className="grid gap-0.5" key={name}>
            <dt className="text-label font-semibold text-ink-faint">{name}</dt>
            <dd className={`text-body font-semibold tabular-nums ${side.short[line] > 0 ? "text-warning" : "text-moss"}`}>
              {side.lines[line]} {side.short[line] > 0 ? `· ${side.short[line]} short` : "✓"}
            </dd>
          </Inset>
        ))}
      </dl>
      <ul className="grid gap-1.5">
        {side.cards.map((card) => {
          const band = powerBand(card.power);
          return (
            <li className="grid grid-cols-[3.25rem_auto_minmax(0,1fr)] items-center gap-3 rounded-xl bg-panel-2/80 p-2" key={card.name}>
              <p className={`grid min-h-10 place-items-center rounded-lg border text-body font-semibold tabular-nums ${band.pill}`}>
                {card.power.toFixed(2)}
              </p>
              {card.trialist ? (
                <span className="grid aspect-[5/7] w-[34px] place-items-center rounded-md border border-dashed border-line text-label text-ink-faint">Tri</span>
              ) : (
                <MidweekMiniCard injured={card.injured} ovr={card.ovr} rarityTier={card.rarityTier} small />
              )}
              <span className="grid min-w-0">
                <span className="text-body font-semibold [overflow-wrap:anywhere]">{card.name}</span>
                <span className="text-small text-ink-dim">
                  {[card.archetype, card.tier, `OVR ${card.ovr}`, card.inGoal && "in goal", card.injured && "injured"].filter(Boolean).join(" · ")}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
