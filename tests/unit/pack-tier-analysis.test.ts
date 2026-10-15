import { assert, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  calculateActivityOvr,
  calculateLiveDiscardValue,
  getRarityTier,
} from "@/game/rating-engine";
// Research harness stays outside the application; compare its curve mirrors to
// the existing display helpers so an analysis rerun cannot silently drift.
import {
  analyze,
  activityOvr,
  discard,
  project,
  suggestPrice,
  CANDIDATES,
  tierOf,
} from "../../scripts/analyze-pack-tiers.mjs";

describe("issue 223 pack research", () => {
  it("uses the existing Live tier and discard curves across their full range", () => {
    for (let ovr = 30; ovr <= 83; ovr++) {
      expect(tierOf(ovr)).toBe(getRarityTier(ovr));
      expect(discard(ovr)).toBe(calculateLiveDiscardValue(ovr));
    }
    for (let activity = 0; activity <= 100; activity++)
      expect(activityOvr(activity)).toBe(calculateActivityOvr(activity));
  });

  it("keeps per-player weights, replacement duplicates and budgeted uniqueness", () => {
    const roster = [
      { ovr: 30, tier: "common" },
      { ovr: 60, tier: "gold" },
      { ovr: 60, tier: "gold" },
    ];
    const pack = { name: "test", price: 500, slots: ["gold", "common"] };
    const result = analyze(roster, pack, 500);
    expect(result.expectedGoldPlus).toBeCloseTo(1 + 24 / 124);
    expect(result.chanceGoldPlus).toBe(1);
    expect(result.expectedDiscard).toBeCloseTo(101 + (100 * 10 + 24 * 101) / 124);
    expect(result.duplicateChance).toBeCloseTo(12 / 124);
    expect(result.expectedUniqueFromEmpty).toBeCloseTo(2 - 12 / 124);
    expect(analyze(roster, pack, 499).expectedUniqueFromEmpty).toBe(0);
    expect(analyze(roster.slice(0, 1), pack).unavailable).toBe(true);
    expect(() => analyze(roster, pack, -1)).toThrow("Invalid coin budget");
    expect(() => project(roster, 4, () => 1)).toThrow("Activity required");
  });

  it("restricts the last draw only when the first two miss the guarantee", () => {
    const roster = [
      { ovr: 30, tier: "common" },
      { ovr: 60, tier: "gold" },
    ];
    const pack = {
      name: "guarantee",
      price: 500,
      slots: ["common", "common", "silver"],
      guaranteeWhenNeeded: true,
    };
    const p = 12 / 112;
    const result = analyze(roster, pack, 500);
    expect(result.chanceSilverPlus).toBeCloseTo(1);
    expect(result.chanceGoldPlus).toBeCloseTo(1);
    expect(result.expectedGoldPlus).toBeCloseTo(3 * p + (1 - p) ** 3);
    expect(result.expectedDiscard).toBeCloseTo(
      3 * (10 * (1 - p) + 101 * p) + (1 - p) ** 3 * (101 - 10),
    );
    expect(result.duplicateChance).toBeCloseTo(1);
    expect(result.expectedUniqueFromEmpty).toBeCloseTo(2 - p ** 3);
    const allGold = analyze(roster.slice(1), pack, 500);
    expect(allGold.expectedGoldPlus).toBe(3);
    expect(allGold.expectedDiscard).toBe(303);
  });

  it("suggests the proposed 250/500/750 prices from the verified production roster", () => {
    const { roster } = JSON.parse(
      readFileSync(
        new URL("../../scripts/research/pack-roster-2026-10-15.json", import.meta.url),
        "utf8",
      ),
    );
    const regular = analyze(roster, CANDIDATES[0]);
    expect(suggestPrice(regular, regular)).toBe(250);
    for (const [name, expected] of [
      ["Silver guarantee / 500", 500],
      ["Gold guarantee / 750", 750],
    ]) {
      const pack = analyze(
        roster,
        CANDIDATES.find((c: { name: string }) => c.name === name),
      );
      const price = suggestPrice(pack, regular);
      expect(price).toBe(expected);
      assert(price !== null);
      expect(pack.expectedDiscard / price).toBeLessThanOrEqual(0.75);
      for (const metric of [
        "cards",
        "expectedDiscard",
        "expectedSilverPlus",
        "expectedGoldPlus",
        "expectedHoloPlus",
        "expectedElitePlus",
      ] as const)
        expect(pack[metric] / price).toBeLessThanOrEqual((0.9 * regular[metric]) / regular.price);
    }
  });

  it("raises suggestions when the roster matures and does not invent unavailable odds", () => {
    const roster = [{ ovr: 75, tier: "holo" }];
    const regular = analyze(roster, CANDIDATES[0]);
    const premium = analyze(
      roster,
      CANDIDATES.find((c: { name: string }) => c.name === "Silver guarantee / 500"),
    );
    expect(suggestPrice(regular, regular)).toBe(1300);
    expect(suggestPrice(premium, regular)).toBe(1450);
    expect(suggestPrice({ ...premium, expectedElitePlus: 1 }, regular)).toBeNull();
    expect(suggestPrice({ unavailable: true }, regular)).toBeNull();
  });
});
