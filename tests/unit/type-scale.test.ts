import { describe, expect, it } from "vitest";
import {
  EXEMPT,
  CEILING,
  checkCeiling,
  countOffScale,
  tally,
} from "../../scripts/policy/check-type-scale.mjs";

describe("type-scale ratchet (ADR-153)", () => {
  it("rejects any off-scale size after the UI pass close-out", () => {
    expect(CEILING).toBe(0);
    expect(checkCeiling(0)).toBeNull();
    expect(checkCeiling(1)).toMatch(/over the ceiling of 0/);
  });
  it("counts Tailwind size steps and arbitrary lengths, with their variants", () => {
    expect(
      countOffScale(
        'className="text-sm sm:text-2xl text-[13px] max-[359px]:text-[0.7rem] text-lg/7 text-xs"',
      ),
    ).toBe(6);
  });

  it("ignores the six roles, colours and look-alikes", () => {
    expect(
      countOffScale(
        'className="text-small text-label text-title sm:text-title-lg text-figure text-heading text-body text-ink text-[#e8c49c] text-brass/60 text-smaller context-sm"',
      ),
    ).toBe(0);
  });

  it("leaves the card face out", () => {
    const rows = tally({ [EXEMPT[0]]: 'className="text-[7px]"', "src/a.tsx": "text-sm text-xs" });
    expect(rows).toEqual([{ file: "src/a.tsx", count: 2 }]);
  });

  it("keeps the approved brand lockup outside the page scale", () => {
    expect(tally({ "src/components/brand-lockup.tsx": 'className="text-[40px]"' })).toEqual([]);
  });

  it("only lets the count fall, and asks for the ceiling to follow it down", () => {
    expect(checkCeiling(10, 10)).toBeNull();
    expect(checkCeiling(11, 10)).toMatch(/over the ceiling of 10/);
    expect(checkCeiling(9, 10)).toMatch(/Lower CEILING .* to 9/);
  });
});
