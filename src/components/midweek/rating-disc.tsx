/** The disc's sizes: the rating rows, the Why list. */
const SIZES = {
  md: "h-10 w-10 text-small",
  sm: "h-8 w-8 text-label",
} as const;

/** A rating as one decimal: `7.0`, never `7`. */
export const ratingText = (rating: number) => rating.toFixed(1);

/**
 * `MidweekRatingDisc` (DR3-4): a rating is never coloured. A neutral circle,
 * so nobody reads it against Power's tinted bands: different shape, side,
 * range and colour. Screen readers hear `rated 7.5 out of 10 {for the night}`.
 */
export function MidweekRatingDisc({
  rating,
  size = "md",
  context,
}: {
  rating: number;
  size?: keyof typeof SIZES;
  /** `for the night`, `for this match`, `against Eline`. */
  context: string;
}) {
  return (
    <span
      className={`inline-grid flex-none place-items-center rounded-full border-[1.5px] border-ink-dim bg-panel-2 font-semibold text-ink tabular-nums ${SIZES[size]}`}
    >
      <span aria-hidden="true">{ratingText(rating)}</span>
      <span className="sr-only">
        rated {ratingText(rating)} out of 10 {context}
      </span>
    </span>
  );
}
