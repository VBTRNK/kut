import { COMPETE_STATUS, type CompeteStatus } from "@/lib/nav/routes";

const TONE: Record<CompeteStatus, string> = {
  pick: "bg-brass text-ink-on-accent",
  live: "bg-live text-ink-on-live",
};

const SHAPE = {
  // Beside the bottom bar's icon, the two centred together. At 12 px (the
  // Label floor) the word no longer fits on the icon's corner inside a 64 px
  // tab at 320 px, so it sits next to it (ADR-153).
  bar: "px-1.5",
  // After the label on the desktop bar.
  inline: "px-2",
};

/**
 * Compete's status badge (ADR-107, HANDOFF "Navigation"): `Pick` in brass,
 * `Live` in live red. The chip is what the eye reads; screen readers get one
 * sentence instead, so the link reads "Compete Pick. Midweek Madness: you
 * haven't picked your five". The `inline` chip brings that sentence along; on
 * the bottom bar the chip sits before the label, so the bar places
 * `CompeteBadgeWords` after the label itself.
 */
export function CompeteBadge({
  status,
  variant,
}: {
  status: CompeteStatus;
  variant: keyof typeof SHAPE;
}) {
  const chip = (
    <span
      aria-hidden="true"
      className={`rounded-full text-label font-extrabold whitespace-nowrap ${SHAPE[variant]} ${TONE[status]}`}
    >
      {COMPETE_STATUS[status].text}
    </span>
  );
  if (variant === "bar") return chip;
  return (
    <>
      {chip}
      <CompeteBadgeWords status={status} />
    </>
  );
}

/** The badge's words for screen readers, after the tab's label. */
export function CompeteBadgeWords({ status }: { status: CompeteStatus }) {
  const { text, label } = COMPETE_STATUS[status];
  return <span className="sr-only">{` ${text}. ${label}`}</span>;
}
