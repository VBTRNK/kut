/**
 * Pack identity, promise and opening copy (#223 S2, ADR-164). Pure, so the
 * shop, the opening page, Home and the FAQ say the same thing. Prices,
 * availability and floors come from the server (`active_pack_offers`,
 * `my_pack_opening_results`); nothing here is a second price list.
 */

export type PackTier = "common" | "bronze" | "silver" | "gold" | "holo" | "elite";

/** The wrapper a pack is drawn in. `neutral` for a slug this code doesn't know. */
export type PackKind = "regular" | "silver" | "gold" | "neutral";

export const TIER_NAME: Record<PackTier, string> = {
  common: "Common",
  bronze: "Bronze",
  silver: "Silver",
  gold: "Gold",
  holo: "Holo",
  elite: "Elite",
};

const KIND_BY_SLUG: Record<string, PackKind> = {
  "tfh-pack": "regular",
  "tfh-silver-pack": "silver",
  "tfh-gold-pack": "gold",
};

/** Art follows the stored slug only: never the price, the order or the cards drawn. */
export function packKind(slug: string | null | undefined): PackKind {
  return slug && Object.hasOwn(KIND_BY_SLUG, slug) ? KIND_BY_SLUG[slug] : "neutral";
}

export function isPackTier(value: unknown): value is PackTier {
  return typeof value === "string" && Object.hasOwn(TIER_NAME, value);
}

/**
 * What an offer promises, from the server's `min_tier`:
 * - `undefined`: the column is absent (an older schema), so promise nothing;
 * - `null`: no floor ("No minimum tier");
 * - a tier: "At least 1 Silver+".
 * An unknown value promises nothing rather than guessing.
 */
export type PackPromise = { kind: "none" } | { kind: "floor"; tier: PackTier } | null;

export function packPromise(minTier: unknown): PackPromise {
  if (minTier === undefined) return null;
  if (minTier === null) return { kind: "none" };
  return isPackTier(minTier) ? { kind: "floor", tier: minTier } : null;
}

export function promiseText(promise: PackPromise): string | null {
  if (!promise) return null;
  return promise.kind === "none" ? "No minimum tier" : `At least 1 ${TIER_NAME[promise.tier]}+`;
}

/** The wrapper gesture, then the three backs hold, then tier and rating (ms). */
export const PACK_GESTURE_MS: Record<PackKind, number> = {
  regular: 1200,
  neutral: 1200,
  silver: 1400,
  gold: 1600,
};
export const REVEAL_TIMING = { hold: 1000, tier: 1100, rating: 1000 } as const;

/**
 * A Live card whose tier has moved since the opening shows what it was then
 * ("Gold 64 when opened"). Openings before pack tiers recorded nothing, so
 * they show nothing: never infer an old tier from today's rating.
 */
export function openedNote(
  current: PackTier,
  openedTier: unknown,
  openedOvr: unknown,
): string | null {
  if (!isPackTier(openedTier) || openedTier === current) return null;
  const ovr = typeof openedOvr === "number" && Number.isFinite(openedOvr) ? ` ${openedOvr}` : "";
  return `${TIER_NAME[openedTier]}${ovr} when opened`;
}

/**
 * The member-facing message for a failed `open_pack`. Known server errors get
 * their own words; anything else stays generic. None of these charged coins:
 * the server raises before its debit.
 */
export function openPackErrorMessage(error: { message?: string | null } | null): string {
  const message = error?.message ?? "";
  if (message.includes("pack guarantee cannot be met")) {
    return "No Player meets this pack's minimum tier right now, so it can't be opened. You weren't charged.";
  }
  if (message.includes("active pack not found")) {
    return "This pack isn't on offer any more. Refresh to see the packs you can open.";
  }
  if (message.includes("no eligible Live editions")) {
    return "There are no Live cards to draw right now. You weren't charged.";
  }
  // The current server text says FLUT; older stacks said the previous name.
  if (/insufficient \w+ Coins for this pack/.test(message)) {
    return "You don't have enough FLUT Coins for this pack.";
  }
  return "The pack could not be opened. Check your FLUT Coin balance and try again.";
}
