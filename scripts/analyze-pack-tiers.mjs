// Research only for #223; never used to open a pack or change game rules.
// Mirrors the weights in 20260918000000_basic_pack_175.sql and rating/discard
// curves in 20261001000000_injury_comeback_form.sql / rating-engine.ts.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export const TIERS = ["common", "bronze", "silver", "gold", "holo", "elite"];
const WEIGHTS = [100, 60, 30, 12, 4, 1];
export const discard = (ovr) => Math.round(10 * 1.08 ** (ovr - 30));
export const tierOf = (ovr) => TIERS[Math.min(5, Math.floor((ovr - 30) / 10))];
export const activityOvr = (activity) => 30 + 45 * (activity / 100) ** 0.8;

export const CANDIDATES = [
  { name: "Basic", price: 250, slots: ["common", "common", "common"] },
  { name: "Silver 2 / 500", price: 500, slots: ["silver", "common"] },
  { name: "Silver 2 / 600", price: 600, slots: ["silver", "common"] },
  { name: "Silver 3 / 750", price: 750, slots: ["silver", "common", "common"] },
  { name: "Silver-only 2 / 600", price: 600, slots: ["silver", "silver"] },
  { name: "Silver-only 2 / 750", price: 750, slots: ["silver", "silver"] },
  { name: "Silver-only 2 / 800", price: 800, slots: ["silver", "silver"] },
  { name: "Gold 2 / 1000", price: 1000, slots: ["gold", "common"] },
  { name: "Gold 2 / 1250", price: 1250, slots: ["gold", "common"] },
  { name: "Gold 3 / 1500", price: 1500, slots: ["gold", "silver", "common"] },
  { name: "Gold-only 2 / 1500", price: 1500, slots: ["gold", "gold"] },
  { name: "Gold + Silver / 1500", price: 1500, slots: ["gold", "silver"] },
  {
    name: "Silver guarantee / 500",
    price: 500,
    slots: ["common", "common", "silver"],
    guaranteeWhenNeeded: true,
  },
  {
    name: "Gold guarantee / 750",
    price: 750,
    slots: ["common", "common", "gold"],
    guaranteeWhenNeeded: true,
  },
];

function validate(roster) {
  assert(Array.isArray(roster) && roster.length > 0, "Roster must be nonempty");
  for (const p of roster) {
    assert(Number.isInteger(p.ovr) && p.ovr >= 30 && p.ovr <= 83, "Invalid Live OVR");
    assert(TIERS.includes(p.tier) && tierOf(p.ovr) === p.tier, "OVR/tier mismatch");
  }
}

export function analyze(roster, candidate, budget = 1500) {
  validate(roster);
  assert(Number.isSafeInteger(budget) && budget >= 0, "Invalid coin budget");
  assert(Number.isSafeInteger(candidate.price) && candidate.price > 0, "Invalid price");
  assert(candidate.slots.length >= 1 && candidate.slots.length <= 3, "Expected 1–3 slots");
  const slots = candidate.slots.map((floor) => {
    assert(TIERS.includes(floor), "Invalid floor");
    const weights = roster.map((p) =>
      TIERS.indexOf(p.tier) >= TIERS.indexOf(floor) ? WEIGHTS[TIERS.indexOf(p.tier)] : 0,
    );
    const total = weights.reduce((a, b) => a + b, 0);
    return total ? weights.map((w) => w / total) : null;
  });
  if (slots.some((s) => s === null)) return { name: candidate.name, unavailable: true };
  const mass = (slot, floor) =>
    slot.reduce((sum, p, i) => sum + (TIERS.indexOf(roster[i].tier) >= floor ? p : 0), 0);
  let chances = TIERS.map((_, floor) => 1 - slots.reduce((p, s) => p * (1 - mass(s, floor)), 1));
  let expectedCounts = TIERS.map((_, floor) => slots.reduce((sum, s) => sum + mass(s, floor), 0));
  let ev = slots.reduce(
    (sum, s) => sum + s.reduce((sum, p, i) => sum + p * discard(roster[i].ovr), 0),
    0,
  );
  let duplicateChance = 0;
  for (let a = 0; a < slots.length; a++)
    for (let b = a + 1; b < slots.length; b++)
      duplicateChance += slots[a].reduce((sum, p, i) => sum + p * slots[b][i], 0);
  if (slots.length === 3)
    duplicateChance -= 2 * slots[0].reduce((sum, p, i) => sum + p * slots[1][i] * slots[2][i], 0);
  let absence = roster.map((_, i) => slots.reduce((p, s) => p * (1 - s[i]), 1));
  if (candidate.guaranteeWhenNeeded) {
    assert.deepEqual(candidate.slots.slice(0, 2), ["common", "common"]);
    assert.equal(slots.length, 3);
    const base = slots[0],
      guaranteed = slots[2];
    const floor = TIERS.indexOf(candidate.slots[2]);
    const tiers = roster.map((p) => TIERS.indexOf(p.tier));
    const values = roster.map((p) => discard(p.ovr));
    const baseEv = base.reduce((sum, p, i) => sum + p * values[i], 0);
    const guaranteedEv = guaranteed.reduce((sum, p, i) => sum + p * values[i], 0);
    const baseMass = TIERS.map((_, t) => mass(base, t));
    const guaranteedMass = TIERS.map((_, t) => mass(guaranteed, t));
    chances = TIERS.map(() => 0);
    expectedCounts = TIERS.map(() => 0);
    ev = 0;
    duplicateChance = 0;
    absence = roster.map(() => 0);
    // Enumerate the first two draws exactly; restrict the last only when needed.
    // Its dependency matters for duplicate/collection probabilities.
    for (let i = 0; i < roster.length; i++) {
      for (let j = 0; j < roster.length; j++) {
        const probability = base[i] * base[j];
        const needsGuarantee = tiers[i] < floor && tiers[j] < floor;
        const last = needsGuarantee ? guaranteed : base;
        const lastMass = needsGuarantee ? guaranteedMass : baseMass;
        ev += probability * (values[i] + values[j] + (needsGuarantee ? guaranteedEv : baseEv));
        duplicateChance += probability * (i === j ? 1 : last[i] + last[j]);
        for (let t = 0; t < TIERS.length; t++) {
          expectedCounts[t] +=
            probability * (Number(tiers[i] >= t) + Number(tiers[j] >= t) + lastMass[t]);
          chances[t] += probability * (tiers[i] >= t || tiers[j] >= t ? 1 : lastMass[t]);
        }
        for (let k = 0; k < roster.length; k++)
          if (k !== i && k !== j) absence[k] += probability * (1 - last[k]);
      }
    }
  }
  const packs = Math.floor(budget / candidate.price);
  const unique = absence.map((p) => 1 - p ** packs);
  return {
    name: candidate.name,
    price: candidate.price,
    cards: slots.length,
    expectedDiscard: ev,
    discardReturn: ev / candidate.price,
    netCoinSinkIfAllDiscarded: candidate.price - ev,
    chanceSilverPlus: chances[2],
    chanceGoldPlus: chances[3],
    chanceHoloPlus: chances[4],
    expectedSilverPlus: expectedCounts[2],
    expectedGoldPlus: expectedCounts[3],
    expectedHoloPlus: expectedCounts[4],
    expectedElitePlus: expectedCounts[5],
    goldPlusPer1000Coins: (expectedCounts[3] * 1000) / candidate.price,
    duplicateChance,
    budget,
    packs,
    spent: packs * candidate.price,
    expectedUniqueFromEmpty: unique.reduce((sum, p) => sum + p, 0),
    expectedUniqueGoldPlusFromEmpty: unique.reduce(
      (sum, p, i) => sum + (TIERS.indexOf(roster[i].tier) >= 3 ? p : 0),
      0,
    ),
    // Worst future liquidation of these copies at the existing Live OVR cap.
    maxFutureDiscard: slots.length * discard(83),
  };
}

// Proposed admin policy, research only: retain a healthy Regular price, target
// <=75% discard return and leave premiums >=10% less efficient per coin.
export function suggestPrice(pack, regular) {
  if (pack.unavailable || regular.unavailable) return null;
  const roundUp25 = (price) => Math.ceil(price / 25) * 25;
  const regularPrice = Math.max(regular.price, roundUp25(regular.expectedDiscard / 0.75));
  if (pack.name === regular.name) return regularPrice;
  const metrics = [
    "cards",
    "expectedDiscard",
    "expectedSilverPlus",
    "expectedGoldPlus",
    "expectedHoloPlus",
    "expectedElitePlus",
  ];
  if (metrics.some((metric) => regular[metric] === 0 && pack[metric] > 0)) return null;
  const relativeValue = Math.max(
    ...metrics.map((metric) => (regular[metric] ? pack[metric] / regular[metric] : 0)),
  );
  return roundUp25(Math.max(pack.expectedDiscard / 0.75, (regularPrice * relativeValue) / 0.9));
}

export function progression(appearances, weeks = 16) {
  let activity = 0;
  return Array.from({ length: weeks }, (_, i) => {
    const n = appearances[i % appearances.length];
    activity = Math.min(100, activity * 0.9 + (n >= 1 ? 14 : 0) + (n >= 2 ? 3 : 0));
    return { week: i + 1, activity, zeroFormOvr: Math.round(activityOvr(activity)) };
  });
}

// Controlled sensitivity, not a forecast or a replacement for the SQL rebuild:
// every future football week has a published game and Form is zero throughout.
export function project(roster, weeks, attendance) {
  return roster.map((p) => {
    assert(
      Number.isFinite(p.activity) && p.activity >= 0 && p.activity <= 100,
      "Activity required for projection",
    );
    let activity = p.activity;
    for (let week = 0; week < weeks; week++) {
      const n = attendance(p);
      activity = Math.min(100, activity * 0.9 + (n >= 1 ? 14 : 0) + (n >= 2 ? 3 : 0));
    }
    const ovr = Math.round(activityOvr(activity));
    return { ovr, tier: tierOf(ovr) };
  });
}

function selfCheck() {
  const common = { ovr: 30, tier: "common" };
  const gold = { ovr: 60, tier: "gold" };
  const basic = analyze([common, gold], CANDIDATES[0]);
  assert(Math.abs(basic.expectedGoldPlus - (3 * 12) / 112) < 1e-12);
  assert(Math.abs(basic.chanceGoldPlus - (1 - (100 / 112) ** 3)) < 1e-12);
  const silver = analyze([common, gold], CANDIDATES[1]);
  assert.equal(silver.chanceGoldPlus, 1);
  assert(Math.abs(silver.duplicateChance - 12 / 112) < 1e-12);
  assert.equal(analyze([common], CANDIDATES[1]).unavailable, true);
  const only = analyze([gold], CANDIDATES[0]);
  assert.equal(only.expectedDiscard, 3 * discard(60));
  assert.equal(only.duplicateChance, 1);
  assert.equal(only.expectedUniqueFromEmpty, 1);
  assert.equal(analyze([common, gold], CANDIDATES[0], 0).expectedUniqueFromEmpty, 0);
  assert.throws(() => analyze([{ ovr: 60, tier: "silver" }], CANDIDATES[0]));
  assert.equal(progression([1]).find((w) => w.activity === 100).week, 12);
  assert.equal(progression([2]).find((w) => w.activity === 100).week, 9);
}

function main() {
  selfCheck();
  if (process.argv[2] === "--self-check") {
    console.log("Pack analysis self-checks passed.");
    return;
  }
  // Invented stress distributions, never a claim about the hosted roster.
  const invented = {
    mixed: [
      [10, 35],
      [10, 45],
      [10, 55],
      [8, 65],
      [2, 75],
    ],
    mature: [
      [10, 35],
      [5, 45],
      [5, 55],
      [10, 65],
      [8, 75],
      [2, 83],
    ],
    high: [
      [5, 35],
      [3, 45],
      [4, 55],
      [10, 65],
      [14, 75],
      [4, 83],
    ],
    allHolo75: [[40, 75]],
    allElite83: [[40, 83]],
  };
  const scenarios = process.argv[2]
    ? { suppliedRoster: JSON.parse(readFileSync(process.argv[2], "utf8")).roster }
    : Object.fromEntries(
        Object.entries(invented).map(([name, groups]) => [
          name,
          groups.flatMap(([n, ovr]) =>
            Array.from({ length: n }, () => ({ ovr, tier: tierOf(ovr) })),
          ),
        ]),
      );
  const budget = Number(process.argv[3] ?? 1500);
  if (process.argv[2]) {
    const roster = scenarios.suppliedRoster;
    for (const shift of [5, 10]) {
      scenarios[`allOvrPlus${shift}Capped83Sensitivity`] = roster.map((p) => {
        const ovr = Math.min(83, p.ovr + shift);
        return { ovr, tier: tierOf(ovr) };
      });
    }
    for (const ovr of [75, 83])
      scenarios[`allAt${ovr}StressBound`] = roster.map(() => ({ ovr, tier: tierOf(ovr) }));
    if (roster.every((p) => Number.isFinite(p.activity))) {
      for (const weeks of [4, 8, 12]) {
        scenarios[`allOnceWeeklyZeroForm${weeks}Weeks`] = project(roster, weeks, () => 1);
        scenarios[`currentSilverPlusAttendOthersAbsent${weeks}Weeks`] = project(
          roster,
          weeks,
          (p) => (TIERS.indexOf(p.tier) >= 2 ? 1 : 0),
        );
      }
    }
  }
  console.log(
    JSON.stringify(
      {
        evidence: process.argv[2]
          ? "Supplied roster; verify capture date separately"
          : "SYNTHETIC sensitivity analysis; hosted data not accessed",
        scenarios: Object.fromEntries(
          Object.entries(scenarios).map(([name, roster]) => {
            const results = CANDIDATES.map((c) => analyze(roster, c, budget));
            return [
              name,
              {
                tierCounts: Object.fromEntries(
                  TIERS.map((t) => [t, roster.filter((p) => p.tier === t).length]),
                ),
                candidates: results.map((pack) => ({
                  ...pack,
                  suggestedPrice: suggestPrice(pack, results[0]),
                })),
              },
            ];
          }),
        ),
        onceWeekly: progression([1]),
        twiceWeekly: progression([2]),
        minimumOvrWhereBasicFutureDiscardExceedsPrice: Array.from(
          { length: 54 },
          (_, i) => i + 30,
        ).find((ovr) => 3 * discard(ovr) > 250),
      },
      null,
      2,
    ),
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
