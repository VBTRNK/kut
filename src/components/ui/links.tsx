import Link from "next/link";
import type { ReactNode } from "react";
import { FOCUS } from "./page";
import { Figure } from "./tag";

const TILE_STATE = {
  plain: "text-ink-dim",
  live: "text-live",
  now: "text-brass",
} as const;

const TILE_FRAME =
  "grid min-h-20 min-w-0 grid-cols-[minmax(0,1fr)] content-start gap-1 rounded-2xl border p-4";

/**
 * `LinkTile`: a place with state worth showing (a count, a deadline, money,
 * live). The state is on the tile and the whole tile is the link. Without
 * `href` it is the same tile, dashed: not a place to go yet (`Bracket ·
 * drawn at 19:55`).
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
  return href ? (
    <Link
      className={`${TILE_FRAME} border-line/60 bg-panel/60 hover:border-brass-line ${FOCUS}`}
      href={href}
    >
      {body}
    </Link>
  ) : (
    <div aria-disabled="true" className={`${TILE_FRAME} border-dashed border-line/60`}>
      {body}
    </div>
  );
}

/** `FigureTile`: a place whose state is one number (Club Value, Rank): a Small label, a Figure. */
export function FigureTile({
  href,
  label,
  value,
  note,
}: {
  href: string;
  label: string;
  value: ReactNode;
  note?: ReactNode;
}) {
  return (
    <Link
      className={`grid min-w-0 grid-cols-[minmax(0,1fr)] content-start gap-1 rounded-2xl border border-line/60 bg-panel/60 p-4 hover:border-brass-line ${FOCUS}`}
      href={href}
    >
      <span className="flex items-baseline justify-between gap-2 text-small text-ink-dim">
        <span className="truncate">{label}</span>
        <span aria-hidden="true" className="text-ink-faint">
          ›
        </span>
      </span>
      <Figure className="truncate">{value}</Figure>
      {note && <span className="text-small text-ink-dim">{note}</span>}
    </Link>
  );
}

/**
 * `LinkRow`: a place without state in a list of its kind. The whole row is the
 * link, so a row never carries a second one. Render it inside a `<ul>`.
 */
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
        className={`grid min-h-14 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-md py-2.5 hover:text-brass ${FOCUS}`}
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

/**
 * `InfoLink`: the one way to an explanation, `How ratings work ›`, at the foot
 * of a block. It lands on a How it works anchor (DR5-25).
 */
export function InfoLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      className={`inline-flex min-h-11 items-center justify-self-start rounded-md text-small font-semibold text-brass hover:underline ${FOCUS}`}
      href={href}
    >
      {children}
      <span aria-hidden="true">&nbsp;›</span>
    </Link>
  );
}
