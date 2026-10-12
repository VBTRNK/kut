import type { ReactNode } from "react";

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
 * `Tag`: one style for every chip and tag (Label, 12 px, sentence case, never
 * tracked capitals). It always carries a word, so colour is never the only
 * signal. `live` adds the pulsing dot. It replaces `Chip` and `LiveMarker` as
 * each page moves onto the scale.
 */
export function Tag({ tone = "neutral", children }: { tone?: TagTone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-label font-semibold whitespace-nowrap tabular-nums ${TAG_TONE[tone]}`}
    >
      {tone === "live" && (
        <span
          aria-hidden="true"
          className="h-1.5 w-1.5 rounded-full bg-live motion-safe:animate-pulse"
        />
      )}
      {children}
    </span>
  );
}

/** `Figure`: scores and the one big number on a tile (Archivo 800, tabular). Never words. */
export function Figure({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <span className={`text-figure font-extrabold tabular-nums ${className}`}>{children}</span>;
}
