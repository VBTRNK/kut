/**
 * Power as the Why list and the pre-match show it (DR2-6, DR4-7): its band in
 * words and colours, and its bar's share. Client-safe, so a server component
 * can call it too.
 */

/** Strength bands for Power: pill text, tint, border and the band in words. Bars stay neutral. */
const BANDS = [
  {
    min: 1.1,
    word: "strong",
    pill: "border-[#3c5230] bg-[#1c2416] text-[#8bbd6c]",
  },
  {
    min: 1.0,
    word: "above ordinary",
    pill: "border-[#4a5030] bg-[#22241a] text-[#c3d27c]",
  },
  {
    min: 0.9,
    word: "below ordinary",
    pill: "border-[#5c4419] bg-[#2b1f0a] text-[#e0ac4a]",
  },
  {
    min: -Infinity,
    word: "weak",
    pill: "border-[#6a3524] bg-[#2a1712] text-[#e8794f]",
  },
] as const;

/** The band of a power as shown, so "1.10" on screen is always strong. */
export function powerBand(power: number) {
  const shown = Number(power.toFixed(2));
  return BANDS.find((band) => shown >= band.min)!;
}

const BAR_LOW = 0.5;
const BAR_HIGH = 1.5;

/** The bar's filled share of 0.50–1.50, in percent, never quite empty. */
export function powerBarWidth(power: number): number {
  const share = ((power - BAR_LOW) / (BAR_HIGH - BAR_LOW)) * 100;
  return Math.round(Math.max(2, Math.min(100, share)) * 10) / 10;
}
