import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { EconomyForm } from "@/app/(app)/admin/economy/economy-form";
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/app/(app)/admin/economy/actions", () => ({ applyPackSettings: vi.fn() }));
import {
  PACK_SLUGS,
  economyWarnings,
  healthStatus,
  suggestedPrices,
  validPrice,
  type PackMetric,
} from "@/lib/pack-economy";

const packs: PackMetric[] = PACK_SLUGS.map((slug, index) => ({
  slug,
  title: ["Regular", "Silver", "Gold"][index],
  price: [250, 500, 750][index],
  is_active: index === 0,
  min_tier: index === 0 ? null : index === 1 ? "silver" : "gold",
  cards_per_pack: 3,
  eligible_count: 36,
  qualifying_count: 20,
  expected_discard_per_slot: 147.98 / 3,
  expected_discard_per_pack: [147.98, 206.02, 245.85][index],
  expected_silver_plus: 1,
  expected_gold_plus: 0.5,
  expected_holo_plus: 0.1,
  expected_elite: 0,
  chance_silver_plus: 0.51,
  chance_gold_plus: 0.35,
  chance_holo_plus: 0.11,
  chance_elite: 0,
  suggested_price: [250, 500, 750][index],
  suggestion_state: "suggested",
  value_ratio: [1, 1.77, 2.632][index],
}));
const prices = { "tfh-pack": 250, "tfh-silver-pack": 500, "tfh-gold-pack": 750 };

describe("admin pack price previews", () => {
  it("keeps the 75/80/95 percent health boundaries", () => {
    expect([0.75, 0.75001, 0.8, 0.80001, 0.94999, 0.95, 1].map(healthStatus)).toEqual([
      "Target",
      "Watch",
      "Watch",
      "Warning",
      "Warning",
      "Critical",
      "Critical",
    ]);
  });
  it("accepts only bounded whole coins", () => {
    expect([1, 1_000_000].every(validPrice)).toBe(true);
    expect([0, -1, 1.5, 1_000_001, NaN, Infinity].some(validPrice)).toBe(false);
  });
  it("uses the canonical SQL value ratio and draft Regular, rounding up 25", () => {
    expect(Object.values(suggestedPrices(packs, 250))).toEqual([250, 500, 750]);
    expect(Object.values(suggestedPrices(packs, 500))).toEqual([500, 1000, 1475]);
    expect(Object.values(suggestedPrices(packs, 1))).toEqual([200, 400, 600]);
    expect(Object.values(suggestedPrices(packs, NaN))).toEqual([null, null, null]);
    expect(
      suggestedPrices([{ ...packs[0], expected_discard_per_pack: 187.5 }], 250)["tfh-pack"],
    ).toBe(250);
  });
  it("leaves empty and unsupported suggestions explanatory, and ignores zero/zero via SQL's ratio", () => {
    expect(
      suggestedPrices(
        packs.map((p) => ({ ...p, suggestion_state: "unavailable" })),
        250,
      )["tfh-silver-pack"],
    ).toBeNull();
    expect(
      suggestedPrices(
        [packs[0], { ...packs[1], suggestion_state: "unsupported", value_ratio: null }],
        250,
      )["tfh-silver-pack"],
    ).toBeNull();
    expect(suggestedPrices(packs, 250)["tfh-silver-pack"]).toBe(500);
  });
  it("warns at 100%, on value and maturity while keeping manual prices valid", () => {
    const changed = [{ ...packs[0], chance_silver_plus: 0.9 }, packs[1], packs[2]];
    const warnings = economyWarnings(changed, { ...prices, "tfh-silver-pack": 100 });
    expect(warnings.join(" ")).toContain("no net coins removed");
    expect(warnings.join(" ")).toContain("beats Regular per coin");
    expect(warnings.join(" ")).toContain("guarantee adds little");
    expect(validPrice(100)).toBe(true);
    expect(economyWarnings(packs, prices)).toEqual([]);
    expect(economyWarnings(packs, { ...prices, "tfh-silver-pack": 475 }).join(" ")).toContain(
      "less than the 10%",
    );
  });
  it("does not turn an empty pool into zero expected value", () => {
    expect(
      economyWarnings([{ ...packs[0], expected_discard_per_pack: null }], prices).join(" "),
    ).toContain("no qualifying Live players");
  });
});

it("renders empty/unsupported pools explicitly and omits all-zero Elite outcomes", () => {
  const empty = {
    ...packs[1],
    expected_discard_per_pack: null,
    expected_silver_plus: null,
    expected_gold_plus: null,
    expected_holo_plus: null,
    expected_elite: null,
    chance_silver_plus: null,
    chance_gold_plus: null,
    chance_holo_plus: null,
    chance_elite: null,
    qualifying_count: 0,
    suggestion_state: "unavailable" as const,
    value_ratio: null,
  };
  const html = renderToStaticMarkup(
    createElement(EconomyForm, {
      initial: {
        measured_at: "2026-10-15T12:00:00Z",
        revision: null,
        packs: [
          packs[0],
          empty,
          { ...packs[2], suggestion_state: "unsupported", value_ratio: null },
        ],
        usage: [],
        cohort: {
          definition: "enabled non-superadmin profiles",
          members: 0,
          median_balance: null,
          balances: [],
        },
        flows: {},
      },
    }),
  );
  expect(html).toContain("No suggestion: no qualifying Live players.");
  expect(html).toContain("No finite suggestion: Regular cannot produce an outcome.");
  expect(html).not.toContain("Elite cards");
  expect(html).not.toContain("Any Elite");
  expect(html).not.toContain("NaN");
  expect(html).not.toContain("Infinity");
  expect(html).toMatch(/Cards<\/th><td[^>]*>12<\/td><td[^>]*>\u2014<\/td>/);
});
