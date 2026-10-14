import { describe, expect, it } from "vitest";
import {
  SKIP,
  SAFE_HANDS_CATEGORY_ID,
  UNDECIDED,
  ballotPayload,
  duplicateNominees,
  seedBallot,
  undecidedCategories,
} from "@/lib/session-reports/kudos-ballot";

const CAT = [
  "10000000-0000-4000-8000-000000000001",
  "10000000-0000-4000-8000-000000000002",
  "10000000-0000-4000-8000-000000000003",
];
const ANN = "20000000-0000-4000-8000-00000000000a";
const BOB = "20000000-0000-4000-8000-00000000000b";

describe("kudos ballot seeding", () => {
  it("opens an untouched ballot undecided rather than on Skip", () => {
    const ballot = seedBallot(CAT, {}, []);
    expect(Object.values(ballot)).toEqual([UNDECIDED, UNDECIDED, UNDECIDED]);
    expect(undecidedCategories(CAT, ballot)).toEqual(CAT);
  });

  it("restores saved nominations and recorded skips independently", () => {
    const ballot = seedBallot(CAT, { [CAT[0]]: ANN }, [CAT[2]]);
    expect(ballot).toEqual({ [CAT[0]]: ANN, [CAT[1]]: UNDECIDED, [CAT[2]]: SKIP });
    expect(undecidedCategories(CAT, ballot)).toEqual([CAT[1]]);
  });
});

describe("kudos ballot validation", () => {
  it("allows Safe Hands to repeat a regular pick, but keeps regular picks unique", () => {
    const categories = [...CAT, SAFE_HANDS_CATEGORY_ID];
    const ballot = { [CAT[0]]: ANN, [CAT[1]]: BOB, [CAT[2]]: SKIP, [SAFE_HANDS_CATEGORY_ID]: ANN };
    expect(duplicateNominees(categories, ballot)).toEqual([]);
    expect(ballotPayload(categories, ballot, "submit")).toEqual({
      ok: true,
      nominations: { [CAT[0]]: ANN, [CAT[1]]: BOB, [CAT[2]]: null, [SAFE_HANDS_CATEGORY_ID]: ANN },
    });
    expect(duplicateNominees(categories, { ...ballot, [CAT[1]]: ANN })).toEqual([ANN]);
    expect(ballotPayload(categories, { ...ballot, [CAT[1]]: ANN }, "draft").ok).toBe(false);
  });

  it("keeps Safe Hands unanswered until nominated or explicitly skipped", () => {
    const categories = [...CAT, SAFE_HANDS_CATEGORY_ID];
    const ballot = seedBallot(categories, { [CAT[0]]: ANN }, [CAT[1], CAT[2]]);
    expect(undecidedCategories(categories, ballot)).toEqual([SAFE_HANDS_CATEGORY_ID]);
    expect(ballotPayload(categories, ballot, "submit").ok).toBe(false);
    expect(ballotPayload(categories, ballot, "draft")).toEqual({
      ok: true,
      nominations: { [CAT[0]]: ANN, [CAT[1]]: null, [CAT[2]]: null },
    });
    expect(
      ballotPayload(categories, { ...ballot, [SAFE_HANDS_CATEGORY_ID]: SKIP }, "submit").ok,
    ).toBe(true);
    expect(seedBallot(categories, {}, categories)[SAFE_HANDS_CATEGORY_ID]).toBe(SKIP);
    expect(
      seedBallot(categories, { [SAFE_HANDS_CATEGORY_ID]: ANN }, [])[SAFE_HANDS_CATEGORY_ID],
    ).toBe(ANN);
  });
  it("reports a teammate picked in two categories", () => {
    expect(duplicateNominees(CAT, { [CAT[0]]: ANN, [CAT[1]]: ANN, [CAT[2]]: BOB })).toEqual([ANN]);
    expect(duplicateNominees(CAT, { [CAT[0]]: ANN, [CAT[1]]: BOB, [CAT[2]]: SKIP })).toEqual([]);
  });

  it("does not count repeated skips or blanks as duplicates", () => {
    expect(duplicateNominees(CAT, { [CAT[0]]: SKIP, [CAT[1]]: SKIP, [CAT[2]]: UNDECIDED })).toEqual(
      [],
    );
  });
});

describe("kudos ballot payload", () => {
  it("sends an explicit Skip as null and omits an undecided category", () => {
    const payload = ballotPayload(
      CAT,
      { [CAT[0]]: ANN, [CAT[1]]: SKIP, [CAT[2]]: UNDECIDED },
      "draft",
    );
    expect(payload).toEqual({ ok: true, nominations: { [CAT[0]]: ANN, [CAT[1]]: null } });
  });

  it("refuses to submit while a category is undecided", () => {
    const ballot = { [CAT[0]]: ANN, [CAT[1]]: SKIP, [CAT[2]]: UNDECIDED };
    expect(ballotPayload(CAT, ballot, "submit").ok).toBe(false);
    expect(ballotPayload(CAT, ballot, "draft").ok).toBe(true);
  });

  it("accepts a fully skipped ballot the member chose deliberately", () => {
    const payload = ballotPayload(
      CAT,
      { [CAT[0]]: SKIP, [CAT[1]]: SKIP, [CAT[2]]: SKIP },
      "submit",
    );
    expect(payload).toEqual({
      ok: true,
      nominations: { [CAT[0]]: null, [CAT[1]]: null, [CAT[2]]: null },
    });
  });

  it("rejects duplicates and malformed values instead of recording a Skip", () => {
    expect(ballotPayload(CAT, { [CAT[0]]: ANN, [CAT[1]]: ANN, [CAT[2]]: SKIP }, "draft")).toEqual({
      ok: false,
      error: "Choose a different teammate in each category.",
    });
    expect(ballotPayload(CAT, { [CAT[0]]: "banana" }, "draft")).toEqual({
      ok: false,
      error: "That nomination is no longer valid.",
    });
  });
});
