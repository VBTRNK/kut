import type { ReactNode } from "react";
import { Block, Inset } from "@/components/ui/block";
import { Button } from "@/components/ui/button";
import { InfoLink, LinkTile } from "@/components/ui/links";
import { Tag } from "@/components/ui/tag";
import type { LiveCardPlayer } from "@/components/live-card";
import type { LiveScore } from "@/lib/midweek/live";
import { MidweekCountdown } from "./countdown";
import { MidweekMiniCard } from "./mini-card";
import { TEAM_TEXT } from "./player-name";
import { MidweekScoreboard, type Clubs } from "./report";

/**
 * The Midweek hub (DR5-1, DR5-12, ADR-154): one Now block that changes with
 * the evening, then four tiles in fixed places, each opening a page of its
 * own (DR5-11). Presentational: `/midweek` picks the moment and hands these
 * their words and numbers.
 */

export type Mini = {
  rarityTier: LiveCardPlayer["rarityTier"];
  ovr: number;
  injured: boolean;
} | null;

/** A five as mini cards, five in one row at 320 px; a trialist's slot is dashed. */
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

export type HubTile = {
  title: string;
  state: ReactNode;
  /** Without one the tile is dashed: not a place yet (`Bracket · Drawn at 19:55`). */
  href?: string;
  tone?: "plain" | "live" | "now";
};

/**
 * The tiles, always in the same places (DR5-1). Two across from 360 px; below
 * it they stack, as Home's do (DR5-17): "How it works" doesn't fit half a
 * 320 px column.
 */
export function HubTiles({ tiles }: { tiles: readonly HubTile[] }) {
  return (
    <nav aria-label="Midweek" className="grid gap-3 min-[360px]:grid-cols-2">
      {tiles.map((tile) => (
        <LinkTile
          href={tile.href}
          key={tile.title}
          state={tile.state}
          title={tile.title}
          tone={tile.tone}
        />
      ))}
    </nav>
  );
}

/**
 * The hub's frame: the Now block (and anything under it), then the tiles; from
 * `lg` the tiles sit beside it, two by two.
 */
export function HubGrid({ now, tiles }: { now: ReactNode; tiles: readonly HubTile[] }) {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:items-start lg:gap-8">
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-6">{now}</div>
      <HubTiles tiles={tiles} />
    </div>
  );
}

/** Before the lock: your five, picked or not. Brass while nothing counts yet. */
export function NowFive({
  cards,
  status,
  lockAt,
  now,
  line,
}: {
  cards: readonly Mini[];
  /** `dirty`: saved, but a Player in it has left your collection. */
  status: "none" | "saved" | "dirty";
  lockAt: string;
  now: string;
  line: string;
}) {
  const saved = status === "saved";
  return (
    <Block
      aside={
        saved ? (
          <Tag tone="won">✓ Saved</Tag>
        ) : (
          <p className="text-small font-semibold text-brass">
            Locks <MidweekCountdown now={now} target={lockAt} />
          </p>
        )
      }
      id="now-h"
      title="Your five"
      tone={saved ? "plain" : "now"}
    >
      <MiniFive cards={cards} label="Your five" />
      <p className="text-small text-ink-dim">{line}</p>
      {status === "none" ? (
        <Button href="/midweek/pick" wide>
          Pick your five
        </Button>
      ) : (
        <Button href="/midweek/pick" kind={saved ? "secondary" : "primary"} wide={!saved}>
          Change your five
        </Button>
      )}
    </Block>
  );
}

/** A plain Now block with a line and an optional action: the moments without a mock. */
export function NowNote({
  title,
  aside,
  children,
  action,
}: {
  title: string;
  aside?: ReactNode;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <Block aside={aside} id="now-h" title={title}>
      <p className="text-body text-pretty text-ink-dim">{children}</p>
      {action}
    </Block>
  );
}

/** The draw is out, before round 1: who you meet (or, after a bye, who you may meet). */
export function NowDraw({
  sub,
  text,
  fives,
}: {
  sub: string;
  text: string;
  fives: readonly { label: string; you: boolean; auto: boolean; cards: readonly Mini[] }[];
}) {
  return (
    <Block
      aside={<p className="text-small text-ink-dim tabular-nums">{sub}</p>}
      id="now-h"
      title="Your first match"
    >
      <p className="text-body text-pretty">{text}</p>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-3">
        {fives.map((five) => (
          <div className="grid grid-cols-[minmax(0,1fr)] gap-1.5" key={five.label}>
            <p className="flex flex-wrap items-center gap-1.5 text-small font-semibold">
              <span className="min-w-0 [overflow-wrap:anywhere]">{five.label}</span>
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
 * one match, team colours). The score and the minute only, on the block's own
 * ground (a compact board); the moments are on the match page (owner, DR5
 * round 2).
 */
export function NowMatch({
  title,
  clubs,
  goals,
  live,
  youSide,
  auto,
  href,
}: {
  title: string;
  clubs: Clubs;
  goals: readonly [number, number];
  live: LiveScore;
  youSide: 0 | 1 | null;
  auto: readonly [boolean, boolean];
  href: string;
}) {
  return (
    <Block id="now-h" title={title} tone="now">
      <MidweekScoreboard
        auto={auto}
        clubs={clubs}
        compact
        goals={goals}
        live={live}
        penalties={null}
        winnerSide={null}
        youSide={youSide}
      />
      <Button href={href} wide>
        Watch it
      </Button>
    </Block>
  );
}

/** A played match on the hub (the final before the week is paid): its score and its report. */
export function NowPlayed({
  title,
  board,
  href,
}: {
  title: string;
  board: ReactNode;
  href: string;
}) {
  return (
    <Block id="now-h" title={title}>
      {board}
      <InfoLink href={href}>Report</InfoLink>
    </Block>
  );
}

/** Between rounds while you're in: your next match, and its pre-match once it opens (DR4-7). */
export function NowNext({
  clubs,
  sub,
  kickoffAt,
  now,
  preMatch,
}: {
  clubs: readonly [string, string];
  sub: string;
  kickoffAt: string;
  now: string;
  preMatch: string | null;
}) {
  return (
    <Block
      aside={<p className="text-small text-ink-dim tabular-nums">{sub}</p>}
      id="now-h"
      title="Your next match"
      tone="now"
    >
      <p className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3">
        <span
          className={`line-clamp-2 text-body font-semibold [overflow-wrap:anywhere] ${TEAM_TEXT[0]}`}
        >
          {clubs[0]}
        </span>
        <span className="text-small text-ink-faint">v</span>
        <span
          className={`line-clamp-2 text-right text-body font-semibold [overflow-wrap:anywhere] ${TEAM_TEXT[1]}`}
        >
          {clubs[1]}
        </span>
      </p>
      <p className="text-small text-ink-dim">
        Kick-off <MidweekCountdown now={now} target={kickoffAt} />.
      </p>
      {preMatch ? (
        <Button href={preMatch} wide>
          Pre-match
        </Button>
      ) : (
        <p className="text-small text-ink-dim">Its pre-match opens when the other match ends.</p>
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
    <Block
      aside={<p className="text-small text-ink-dim">{coins}</p>}
      id="now-h"
      title="You’re out"
      tone={open > 0 ? "now" : "plain"}
    >
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
      <dl className="grid grid-cols-2 items-start gap-2">
        <Inset className="grid content-start gap-0.5">
          <dt className="text-label font-semibold text-ink-faint">You</dt>
          <dd className="grid gap-0.5">
            <span className="text-figure font-extrabold text-brass tabular-nums">{coins}</span>
            <span className="text-small text-ink-dim">{coinsNote}</span>
          </dd>
        </Inset>
        <Inset className="grid content-start gap-0.5">
          <dt className="text-label font-semibold text-ink-faint">Your finish</dt>
          <dd className="grid gap-0.5">
            {/* A finish is words ("Quarters", "Champion"), so a Heading, never a Figure. */}
            <span className="text-heading font-semibold">{finish}</span>
            <span className="text-small text-ink-dim">{finishNote}</span>
          </dd>
        </Inset>
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

/** The champion under the result (Q4): the final in one line and their five as mini cards. */
export function ChampionBlock({
  line,
  href,
  cards,
  label,
}: {
  line: string;
  href: string | null;
  cards: readonly Mini[];
  label: string;
}) {
  return (
    <Block id="final-h" title="The final">
      <p className="text-body text-pretty">{line}</p>
      {cards.length > 0 && <MiniFive cards={cards} label={label} />}
      {href && <InfoLink href={href}>Report</InfoLink>}
    </Block>
  );
}
