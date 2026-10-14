import Link from "next/link";
import type { ReactNode } from "react";

/**
 * The DR5 primitives (ADR-153, `design/ui-pass/HANDOFF.md` "Foundations").
 * Every size is one of the six roles of the type scale (`text-title` …
 * `text-label`), every weight 400, 600 or 800, every surface a page, a block
 * or an inset. Pages move onto them one session at a time; the type-scale
 * policy check counts what is still off the scale.
 */

/** The keyboard focus ring every primitive link and button shares. */
export const FOCUS =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass";

/** The page frame: the board ground, a 16 px gutter on a phone, 32 from `sm`. */
export const PAGE = "board-ground min-h-screen px-4 pt-4 pb-8 text-ink sm:px-8 sm:pt-8";

/**
 * The phone column every page starts from. A page widens only where columns
 * help. `minmax(0,1fr)`, not `auto`: an auto track grows to a long club name's
 * min-content and scrolls the page sideways.
 */
export const COLUMN = "mx-auto grid max-w-2xl grid-cols-[minmax(0,1fr)] gap-6 sm:gap-8";

/**
 * `PageHeader`: one back link (top left, Small, brass), the Title, and a Small
 * line of context under it in place of the retired kicker. The serif's only
 * jobs are this Title and a report's headline (DR5-3).
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
          prefetch={false}
          className={`inline-flex min-h-11 items-center justify-self-start rounded-md text-small font-semibold text-brass hover:underline ${FOCUS}`}
          href={back.href}
        >
          <span aria-hidden="true">‹&nbsp;</span>
          {back.label}
        </Link>
      )}
      <h1
        className="font-serif text-title font-normal text-balance text-ink sm:text-title-lg"
        id={id}
      >
        {title}
      </h1>
      {sub && <p className="text-small text-ink-dim">{sub}</p>}
    </header>
  );
}

/**
 * Cards in a grid: two on a phone (each about 140 px at 320, the face's
 * floor), three from `sm`, four or five from `lg`.
 */
export function CardGrid({ children, wide = 5 }: { children: ReactNode; wide?: 4 | 5 }) {
  return (
    <div
      className={`grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:gap-6 ${
        wide === 5 ? "lg:grid-cols-5" : "lg:grid-cols-4"
      }`}
    >
      {children}
    </div>
  );
}
