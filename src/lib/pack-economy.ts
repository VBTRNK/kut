import type { PackTier } from "./packs";

export const PACK_SLUGS = ["tfh-pack", "tfh-silver-pack", "tfh-gold-pack"] as const;
export type PackSlug = (typeof PACK_SLUGS)[number];
export type PackMetric = {
  slug: PackSlug;
  title: string;
  price: number;
  is_active: boolean;
  min_tier: PackTier | null;
  cards_per_pack: number;
  eligible_count: number;
  qualifying_count: number;
  expected_discard_per_slot: number | null;
  expected_discard_per_pack: number | null;
  expected_silver_plus: number | null;
  expected_gold_plus: number | null;
  expected_holo_plus: number | null;
  expected_elite: number | null;
  chance_silver_plus: number | null;
  chance_gold_plus: number | null;
  chance_holo_plus: number | null;
  chance_elite: number | null;
  suggested_price: number | null;
  suggestion_state: "suggested" | "unavailable" | "unsupported";
  value_ratio: number | null;
};
export type PackEconomy = {
  measured_at: string;
  revision: { revision: number; changed_at: string; changed_by_name: string | null } | null;
  packs: PackMetric[];
  usage: {
    slug: string;
    title: string;
    price_paid: number;
    openings_7d: number;
    openings_28d: number;
    coins_7d: number;
    coins_28d: number;
  }[];
  cohort: {
    definition: string;
    members: number;
    median_balance: number | null;
    balances: number[];
  };
  flows: Record<string, { net_7d: number; net_28d: number }>;
};
export type PackSettings = Record<PackSlug, { price: number; is_active: boolean }>;
export type SettingsResult = {
  status: "applied" | "unchanged" | "conflict";
  revision: number;
  packs: PackSettings;
};

export function validPrice(price: number) {
  return Number.isSafeInteger(price) && price >= 1 && price <= 1_000_000;
}
export function healthStatus(ratio: number) {
  return ratio >= 0.95 ? "Critical" : ratio > 0.8 ? "Warning" : ratio > 0.75 ? "Watch" : "Target";
}
const roundUp25 = (value: number) => Math.ceil(Number((value / 25).toFixed(9))) * 25;

/** SQL supplies the value ratio and pool state; drafts only change the price denominator. */
export function suggestedPrices(packs: PackMetric[], regularPrice: number) {
  const regular = packs.find((pack) => pack.slug === "tfh-pack");
  const floor = regular?.expected_discard_per_pack;
  const base =
    floor == null || !validPrice(regularPrice)
      ? null
      : Math.max(regularPrice, roundUp25(floor / 0.75));
  return Object.fromEntries(
    packs.map((pack) => [
      pack.slug,
      base === null ||
      pack.suggestion_state !== "suggested" ||
      pack.expected_discard_per_pack === null
        ? null
        : pack.slug === "tfh-pack"
          ? base
          : pack.value_ratio === null
            ? null
            : roundUp25(
                Math.max(pack.expected_discard_per_pack / 0.75, (base * pack.value_ratio) / 0.9),
              ),
    ]),
  ) as Record<PackSlug, number | null>;
}
export const VALUE_ROWS = [
  ["cards_per_pack", "Cards"],
  ["expected_discard_per_pack", "Discard coins"],
  ["expected_silver_plus", "Silver+ cards"],
  ["expected_gold_plus", "Gold+ cards"],
  ["expected_holo_plus", "Holo+ cards"],
  ["expected_elite", "Elite cards"],
] as const;

export function economyWarnings(packs: PackMetric[], prices: Record<PackSlug, number>) {
  const warnings: string[] = [];
  const regular = packs.find((p) => p.slug === "tfh-pack");
  for (const pack of packs) {
    const price = prices[pack.slug];
    if (!validPrice(price)) continue;
    if (pack.expected_discard_per_pack === null) {
      warnings.push(`${pack.title}: no qualifying Live players; purchases fail without charging.`);
      continue;
    }
    const ratio = pack.expected_discard_per_pack / price;
    if (ratio > 0.75)
      warnings.push(
        `${pack.title} returns ${(ratio * 100).toFixed(1)}% in current discards${ratio >= 1 ? "; no net coins removed at 100% or above" : ""}. Target: 75% or less.`,
      );
    if (!regular || pack.slug === regular.slug || !validPrice(prices[regular.slug])) continue;
    const efficiency =
      pack.value_ratio === null ? null : (pack.value_ratio * prices[regular.slug]) / price;
    if (pack.suggestion_state === "unsupported")
      warnings.push(
        `${pack.title}: Regular cannot produce one of its outcomes; no finite value-ladder suggestion.`,
      );
    else if (efficiency !== null && efficiency > 0.9 + 1e-9)
      warnings.push(
        `${pack.title} ${efficiency > 1 + 1e-9 ? "beats Regular per coin" : "has less than the 10% efficiency margin"} on its strongest value measure. Regular should lead.`,
      );
    const chance =
      pack.min_tier === "silver"
        ? regular.chance_silver_plus
        : pack.min_tier === "gold"
          ? regular.chance_gold_plus
          : null;
    if (chance !== null && chance >= 0.9)
      warnings.push(
        `Regular already meets ${pack.title}'s floor in ${(chance * 100).toFixed(1)}% of packs; the guarantee adds little.`,
      );
  }
  return warnings;
}
