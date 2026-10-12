import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, Ref } from "react";
import { IconSearch } from "@/components/icons";
import { FOCUS } from "./page";

/**
 * `Toolbar`: the search on the left, one Filter button on the right, a Small
 * result line under them. Tiers, types, lenses and sort live in the filter
 * sheet at every width (Q7), so a list never has more than this one row above
 * it. The search is a slot because the page owns its form.
 */
export function Toolbar({
  children,
  filter,
  summary,
}: {
  /** The search: usually a `<form>` around a `SearchField`. */
  children: ReactNode;
  /** The `FilterButton`. */
  filter: ReactNode;
  summary?: ReactNode;
}) {
  return (
    <div className="grid gap-2">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
        {children}
        {filter}
      </div>
      {summary && <p className="text-small text-ink-dim">{summary}</p>}
    </div>
  );
}

/** The toolbar's search input; `label` is its accessible name and its placeholder. */
export function SearchField({
  label,
  ...input
}: Omit<InputHTMLAttributes<HTMLInputElement>, "className" | "placeholder"> & { label: string }) {
  return (
    <label className="flex min-h-11 min-w-0 items-center gap-2 rounded-xl border border-line bg-board-deep/60 px-3 focus-within:border-brass-line">
      <IconSearch aria-hidden="true" className="h-4 w-4 shrink-0 text-ink-faint" />
      <input
        aria-label={label}
        className="w-full min-w-0 bg-transparent text-body text-ink placeholder:text-ink-faint focus:outline-none"
        placeholder={label}
        type="search"
        {...input}
      />
    </label>
  );
}

/** The toolbar's one Filter button, brass with a count while any filter is on. */
export function FilterButton({
  on = 0,
  type = "button",
  ref,
  ...rest
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children"> & {
  on?: number;
  /** For the sheet to hand focus back to on close. */
  ref?: Ref<HTMLButtonElement>;
}) {
  return (
    <button
      ref={ref}
      className={`inline-flex min-h-11 items-center gap-2 rounded-xl border px-4 text-small font-semibold ${
        on ? "border-brass-line bg-brass-bg text-brass" : "border-line bg-panel text-ink"
      } ${FOCUS}`}
      type={type}
      {...rest}
    >
      Filter
      {on > 0 && (
        <span className="tabular-nums">
          <span aria-hidden="true">· </span>
          {on}
          <span className="sr-only"> on</span>
        </span>
      )}
    </button>
  );
}
