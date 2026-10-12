// DR5 primitives (design only): the shared pieces the S4 build moves into
// `src/components/ui/`. Every size is one of the six roles of the type scale
// (`text-title` … `text-label`, design/ui-pass/HANDOFF.md "Foundations"),
// every weight 400, 600 or 800, every surface page, block or inset.
import Link from "next/link";
import type { ReactNode } from "react";

/** The page frame: the board ground, a 16 px gutter on a phone, 32 from `sm`. */
export const PAGE = "board-ground min-h-screen px-4 pt-4 pb-8 text-ink sm:px-8 sm:pt-8";
/** The phone column every page starts from; a page widens only where columns help. */
export const COLUMN = "mx-auto grid max-w-2xl grid-cols-[minmax(0,1fr)] gap-6 sm:gap-8";

/**
 * `PageHeader`: one back link (top left, Small, brass), the Title (the serif's
 * only job besides a report's headline, DR5-3), and a Small line of context
 * under it in place of the retired kicker.
 */
export function PageHeader({
  title,
  sub,
  back,
  id,
}: {
  title: ReactNode;
  sub?: ReactNode;
  back?: { href: string; label: string };
  id?: string;
}) {
  return (
    <header className="grid gap-2">
      {back && (
        <Link
          className="inline-flex min-h-11 items-center justify-self-start text-small font-semibold text-brass hover:underline"
          href={back.href}
        >
          <span aria-hidden="true">‹&nbsp;</span>
          {back.label}
        </Link>
      )}
      <h1 className="font-serif text-title font-normal text-balance text-ink sm:text-title-lg" id={id}>
        {title}
      </h1>
      {sub && <p className="text-small text-ink-dim">{sub}</p>}
    </header>
  );
}

const BLOCK_TONE = {
  plain: "border-line/60 bg-panel/60",
  /** Needs you now: at most one per screen. */
  now: "border-brass-line bg-brass-bg/45",
} as const;

/**
 * `Block`: the one surface for a thing on a page. Panel, 1 px line, radius 16,
 * padding 16. A block has a heading (Heading, with an optional Small or tag on
 * the right), or the whole block is one link (`LinkTile`).
 */
export function Block({
  title,
  id,
  aside,
  tone = "plain",
  children,
  className = "",
}: {
  title?: ReactNode;
  id?: string;
  aside?: ReactNode;
  tone?: keyof typeof BLOCK_TONE;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      aria-labelledby={title ? id : undefined}
      className={`grid min-w-0 grid-cols-[minmax(0,1fr)] content-start gap-3 rounded-2xl border p-4 ${BLOCK_TONE[tone]} ${className}`}
    >
      {title && (
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h2 className="min-w-0 text-heading font-semibold" id={id}>
            {title}
          </h2>
          {aside}
        </div>
      )}
      {children}
    </section>
  );
}

/** `Inset`: panel-2, radius 12, no border; only inside a block (a row, a stat). */
export function Inset({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-xl bg-panel-2/80 px-3 py-2.5 ${className}`}>{children}</div>;
}

export type NavTab = { key: string; label: string; href: string; badge?: ReactNode };

/**
 * `SectionNav`: views of the same thing, 2–4 segments, one row per screen
 * (Compete's Midweek · Standings · Players, a report's Match · Teams, Market's
 * Buy · Selling · Offers). Links, so every view has its own address.
 */
export function SectionNav({
  label,
  tabs,
  active,
}: {
  label: string;
  tabs: readonly NavTab[];
  active: string;
}) {
  return (
    <nav
      aria-label={label}
      className="grid auto-cols-fr grid-flow-col gap-1 rounded-xl border border-line/70 bg-board-deep/40 p-1 lg:max-w-md"
    >
      {tabs.map((tab) => {
        const on = tab.key === active;
        return (
          <Link
            aria-current={on ? "page" : undefined}
            className={`flex min-h-11 min-w-0 items-center justify-center gap-1.5 rounded-lg px-2 text-small font-semibold ${
              on ? "bg-brass-bg text-brass" : "text-ink-dim hover:text-ink"
            }`}
            href={tab.href}
            key={tab.key}
          >
            <span className="truncate">{tab.label}</span>
            {/* A badge tells you about a place you are not at; the active tab is the page itself. */}
            {!on && tab.badge}
          </Link>
        );
      })}
    </nav>
  );
}

const TILE_STATE = {
  plain: "text-ink-dim",
  live: "text-live",
  now: "text-brass",
} as const;

/**
 * `LinkTile`: a place with state worth showing (a count, a deadline, money,
 * live). The state is the tile and the whole tile is the link. Without `href`
 * it is the same tile, not yet a place to go (`Bracket · drawn at 19:55`).
 */
export function LinkTile({
  href,
  title,
  state,
  tone = "plain",
  icon,
}: {
  href?: string;
  title: string;
  state: ReactNode;
  tone?: keyof typeof TILE_STATE;
  /** A brass icon before the title, for a place with an identity of its own (the Chronicle). */
  icon?: ReactNode;
}) {
  const body = (
    <>
      <span className="flex items-baseline justify-between gap-2 text-body font-semibold">
        <span className="flex min-w-0 items-center gap-2">
          {icon && (
            <span aria-hidden="true" className="flex-none text-brass">
              {icon}
            </span>
          )}
          <span className="min-w-0 truncate">{title}</span>
        </span>
        {href && (
          <span aria-hidden="true" className="text-ink-faint">
            ›
          </span>
        )}
      </span>
      <span className={`text-small ${href ? TILE_STATE[tone] : "text-ink-faint"}`}>{state}</span>
    </>
  );
  const frame = "grid min-h-20 min-w-0 grid-cols-[minmax(0,1fr)] content-start gap-1 rounded-2xl border p-4";
  return href ? (
    <Link className={`${frame} border-line/60 bg-panel/60 hover:border-brass-line`} href={href}>
      {body}
    </Link>
  ) : (
    <div aria-disabled="true" className={`${frame} border-dashed border-line/60`}>
      {body}
    </div>
  );
}

/** `LinkRow`: a place without state in a list of its kind; the whole row is the link. */
export function LinkRow({
  href,
  title,
  meta,
  end,
}: {
  href: string;
  title: ReactNode;
  meta?: ReactNode;
  end?: ReactNode;
}) {
  return (
    <li className="border-b border-line/40 last:border-b-0">
      <Link
        className="grid min-h-14 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-2.5 hover:text-brass"
        href={href}
      >
        <span className="grid min-w-0 gap-0.5">
          <span className="text-body font-semibold">{title}</span>
          {meta && <span className="text-small text-ink-dim">{meta}</span>}
        </span>
        <span className="flex items-center gap-2 text-small text-ink-dim">
          {end}
          <span aria-hidden="true" className="text-ink-faint">
            ›
          </span>
        </span>
      </Link>
    </li>
  );
}

/** `InfoLink`: the one way to an explanation, `How ratings work ›`, at the foot of a block. */
export function InfoLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      className="inline-flex min-h-11 items-center justify-self-start text-small font-semibold text-brass hover:underline"
      href={href}
    >
      {children}
      <span aria-hidden="true">&nbsp;›</span>
    </Link>
  );
}

const TAG_TONE = {
  neutral: "border-line text-ink-dim",
  you: "border-brass-line bg-brass-bg text-brass",
  won: "border-moss-line bg-moss-bg text-moss",
  out: "border-line text-ink-faint",
  auto: "border-steel-line text-steel",
  warn: "border-warning-line bg-warning-bg text-warning",
  live: "border-live-line bg-live-bg text-live",
  goal: "border-brass-line bg-brass-bg text-brass",
} as const;

export type TagTone = keyof typeof TAG_TONE;

/**
 * `Tag`: one style for every chip and tag (Label, 12 px, sentence case). It
 * always carries a word, so colour is never the only signal. `live` adds the
 * pulsing dot.
 */
export function Tag({ tone = "neutral", children }: { tone?: TagTone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-label font-semibold whitespace-nowrap tabular-nums ${TAG_TONE[tone]}`}
    >
      {tone === "live" && (
        <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-live motion-safe:animate-pulse" />
      )}
      {children}
    </span>
  );
}

/** `Figure`: scores and the one big number on a tile (Archivo 800, tabular). Never words. */
export function Figure({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <span className={`text-figure font-extrabold tabular-nums ${className}`}>
      {children}
    </span>
  );
}

const BUTTON = {
  /** The one primary action on a screen. */
  primary: "bg-brass text-ink-on-accent font-extrabold hover:brightness-105",
  secondary: "border border-line bg-panel text-ink font-semibold hover:border-brass-line",
} as const;

/** `Button`: one filled brass button per screen; everything else is secondary, a tile or a link. */
export function Button({
  href,
  kind = "primary",
  children,
  wide = false,
}: {
  href?: string;
  kind?: keyof typeof BUTTON;
  children: ReactNode;
  wide?: boolean;
}) {
  const className = `inline-flex min-h-12 items-center justify-center rounded-xl px-5 text-body ${BUTTON[kind]} ${wide ? "w-full" : ""}`;
  return href ? (
    <Link className={className} href={href}>
      {children}
    </Link>
  ) : (
    <button className={className} type="button">
      {children}
    </button>
  );
}

/** `Stat`: a labelled number in an inset (a Label head, a Figure, a Small note). */
export function Stat({
  label,
  value,
  note,
  tone,
}: {
  label: string;
  value: ReactNode;
  note?: ReactNode;
  tone?: "brass";
}) {
  return (
    <Inset className="grid content-start gap-1">
      <dt className="text-label font-semibold text-ink-faint">{label}</dt>
      <dd className="grid gap-1">
        <Figure className={tone === "brass" ? "text-brass" : ""}>{value}</Figure>
        {note && <span className="text-small text-ink-dim">{note}</span>}
      </dd>
    </Inset>
  );
}
