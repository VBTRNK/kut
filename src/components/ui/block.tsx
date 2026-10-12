import { useId, type ReactNode } from "react";
import { Figure } from "./tag";

const BLOCK_TONE = {
  plain: "border-line/60 bg-panel/60",
  /** Needs you now: at most one per screen. */
  now: "border-brass-line bg-brass-bg/45",
} as const;

/**
 * `Block`: the one surface for a thing on a page. Panel, 1 px line, radius 16,
 * padding 16. It has a Heading, with an optional Small or tag on the right,
 * and its columns are `minmax(0,1fr)` so a long name can't widen it. A block
 * that is one link is a `LinkTile` instead.
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
  /** The heading's id, for a link to it; one is made up when it is left out. */
  id?: string;
  aside?: ReactNode;
  tone?: keyof typeof BLOCK_TONE;
  children: ReactNode;
  className?: string;
}) {
  const generated = useId();
  const headingId = id ?? generated;
  return (
    <section
      aria-labelledby={title ? headingId : undefined}
      className={`grid min-w-0 grid-cols-[minmax(0,1fr)] content-start gap-3 rounded-2xl border p-4 ${BLOCK_TONE[tone]} ${className}`}
    >
      {title && (
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h2 className="min-w-0 text-heading font-semibold" id={headingId}>
            {title}
          </h2>
          {aside}
        </div>
      )}
      {children}
    </section>
  );
}

/** `Inset`: panel-2, radius 12, no border. Only inside a block: a row, a stat. */
export function Inset({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-xl bg-panel-2/80 px-3 py-2.5 ${className}`}>{children}</div>;
}

/**
 * `Stat`: a labelled number in an inset (a Label head, a Figure, a Small
 * note). A `dt`/`dd` pair, so it belongs inside a `<dl>`.
 */
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
