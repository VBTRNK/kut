import type { ReactNode } from "react";

/**
 * The small pieces of the Midweek pages: notices and the trialist frame.
 * Presentational only, so server pages and client components can render them.
 */

/** A boxed notice with a round mark; `warn` for things that changed under the member. */
export function MidweekNotice({
  tone,
  children,
  live = false,
}: {
  tone: "info" | "warn";
  children: ReactNode;
  live?: boolean;
}) {
  return (
    <div
      className={`flex items-start gap-3 rounded-2xl border p-4 text-body text-pretty text-ink-dim ${
        tone === "warn" ? "border-warning-line bg-warning-bg/55" : "border-line/60 bg-panel/60"
      }`}
      role={live ? "status" : undefined}
    >
      <span
        aria-hidden="true"
        className={`mt-0.5 grid h-5 w-5 flex-none place-items-center rounded-full text-label font-extrabold ${
          tone === "warn" ? "bg-warning text-[#1d1206]" : "bg-steel text-[#0d171c]"
        }`}
      >
        {tone === "warn" ? "!" : "i"}
      </span>
      <div className="min-w-0 [&_b]:font-semibold [&_b]:text-ink">{children}</div>
    </div>
  );
}

/**
 * `MidweekTrialistCard`: a card-sized dashed frame for the desktop team sheet.
 * Spans throughout, because the picker puts it inside a button.
 */
export function MidweekTrialistCard({
  slot,
  state,
  trialistOvr,
}: {
  slot: number;
  state: "trialist" | "choosing";
  trialistOvr: number;
}) {
  if (state === "choosing") {
    return (
      <span className="grid aspect-[5/7] w-full place-items-center content-center gap-1.5 rounded-[0.9rem] border-2 border-dashed border-brass-line bg-brass-bg/30 p-3 text-center text-brass">
        <b className="text-figure font-extrabold">+</b>
        <span className="text-label font-semibold">Choosing</span>
        <span className="max-w-48 text-small">Pick a card for slot {slot}.</span>
      </span>
    );
  }
  return (
    <span className="grid aspect-[5/7] w-full place-items-center content-center gap-1.5 rounded-[0.9rem] border-2 border-dashed border-line bg-[repeating-linear-gradient(135deg,rgb(74_64_48/22%)_0_8px,transparent_8px_16px)] p-3 text-center text-ink-faint">
      <b className="text-figure font-extrabold text-ink-dim">{trialistOvr}</b>
      <span className="text-label font-semibold">Trialist</span>
      <span className="max-w-48 text-small">Empty slot</span>
    </span>
  );
}
