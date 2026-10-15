import { describe, expect, it } from "vitest";
import {
  PACK_GESTURE_MS,
  openPackErrorMessage,
  openedNote,
  packKind,
  packPromise,
  promiseText,
} from "@/lib/packs";

describe("pack identity (#223)", () => {
  it("draws the wrapper from the stored slug only; an unknown slug is neutral", () => {
    expect(packKind("tfh-pack")).toBe("regular");
    expect(packKind("tfh-silver-pack")).toBe("silver");
    expect(packKind("tfh-gold-pack")).toBe("gold");
    expect(packKind("tfh-special-pack")).toBe("neutral");
    expect(packKind(null)).toBe("neutral");
    expect(packKind(undefined)).toBe("neutral");
    // Prototype keys are not slugs.
    expect(packKind("gold")).toBe("neutral");
    expect(packKind("constructor")).toBe("neutral");
  });

  it("gives each wrapper its own gesture length", () => {
    expect([PACK_GESTURE_MS.regular, PACK_GESTURE_MS.silver, PACK_GESTURE_MS.gold]).toEqual([
      1200, 1400, 1600,
    ]);
  });
});

describe("an offer's promise comes from the server's min_tier", () => {
  it("states a floor or its absence", () => {
    expect(promiseText(packPromise("silver"))).toBe("At least 1 Silver+");
    expect(promiseText(packPromise("gold"))).toBe("At least 1 Gold+");
    expect(promiseText(packPromise(null))).toBe("No minimum tier");
  });

  it("promises nothing on an older schema or an unknown value", () => {
    expect(packPromise(undefined)).toBeNull();
    expect(packPromise("platinum")).toBeNull();
    expect(packPromise(3)).toBeNull();
    expect(promiseText(null)).toBeNull();
  });
});

describe("a receipt's opening-time evidence", () => {
  it("names the tier when opened only when it has moved since", () => {
    expect(openedNote("silver", "gold", 64)).toBe("Gold 64 when opened");
    expect(openedNote("gold", "gold", 64)).toBeNull();
    expect(openedNote("bronze", "silver", null)).toBe("Silver when opened");
  });

  it("says nothing for openings before pack tiers recorded it", () => {
    expect(openedNote("silver", null, null)).toBeNull();
    expect(openedNote("silver", undefined, undefined)).toBeNull();
    expect(openedNote("silver", "nonsense", 50)).toBeNull();
  });
});

describe("open_pack errors in member words", () => {
  it("names an unmeetable guarantee and says nothing was charged", () => {
    expect(openPackErrorMessage({ message: "pack guarantee cannot be met" })).toMatch(
      /minimum tier.*weren't charged/,
    );
  });

  it("distinguishes a pack taken off sale and too few coins", () => {
    expect(openPackErrorMessage({ message: "active pack not found" })).toMatch(/isn't on offer/);
    expect(openPackErrorMessage({ message: "insufficient FLUT Coins for this pack" })).toBe(
      "You don't have enough FLUT Coins for this pack.",
    );
    expect(openPackErrorMessage({ message: "insufficient KUT Coins for this pack" })).toBe(
      "You don't have enough FLUT Coins for this pack.",
    );
  });

  it("keeps anything else generic", () => {
    const generic = "The pack could not be opened. Check your FLUT Coin balance and try again.";
    expect(openPackErrorMessage(null)).toBe(generic);
    expect(openPackErrorMessage({ message: "connection reset" })).toBe(generic);
    expect(openPackErrorMessage({ message: null })).toBe(generic);
  });
});
