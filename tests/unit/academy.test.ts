import { describe, expect, it } from "vitest";
import {
  academyLine,
  firstTeamOnly,
  footballWeek,
  isRetiredRow,
  progressWords,
  tierLabel,
  weekLabel,
  weekStrip,
  weeksToRetire,
  type LifecycleRow,
} from "@/lib/academy";
import { toListedCardPlayer, toLiveCardPlayer, type CardFaceRow } from "@/lib/live-card-player";
import { lostClause, prefillNotice } from "@/lib/midweek/entry";

const row = (over: Partial<LifecycleRow> = {}): LifecycleRow => ({
  player_id: "p1",
  slug: "fenna-l",
  display_name: "Fenna L.",
  archetype: "all_rounder",
  photo_path: null,
  is_active: true,
  lifecycle_stage: "talent",
  live_ovr: 45,
  rarity_tier: "bronze",
  progress: 2,
  progress_weeks: 2,
  progress_credits: 0,
  academy_visible: true,
  fading: false,
  window_weeks: null,
  played_weeks: null,
  credit_weeks: null,
  absent_weeks: null,
  at_risk: false,
  clock_start: null,
  retired_week: null,
  promoted_week: null,
  ...over,
});

describe("Academy words (ADR-165)", () => {
  it("words progress as weeks, adding credits only when there are some", () => {
    expect(progressWords(2, 0)).toBe("2 of 3 weeks");
    expect(progressWords(1, 0)).toBe("1 of 3 weeks");
    expect(progressWords(1, 1)).toBe("1 week + 1 credit");
    expect(progressWords(0, 2)).toBe("0 weeks + 2 credits");
  });

  it("says what a Talent, a fading Talent and a comeback need", () => {
    expect(academyLine(row())).toBe("2 of 3 weeks · one more week promotes");
    expect(academyLine(row({ fading: true }))).toBe(
      "2 of 3 weeks · a week drops off unless they play next week",
    );
    expect(
      academyLine(
        row({
          lifecycle_stage: "retired",
          retired_week: "2027-01-25",
          progress_credits: 1,
          progress_weeks: 1,
        }),
      ),
    ).toBe("Retired 25 Jan · 1 week + 1 credit · one more week brings them back");
  });

  it("counts the weeks left before retirement", () => {
    expect(weeksToRetire({ absent_weeks: 10 })).toBe(2);
    expect(weeksToRetire({ absent_weeks: null })).toBe(12);
    expect(weeksToRetire({ absent_weeks: 14 })).toBe(0);
  });

  it("draws the strip from the window: played, a credit's week, before a retirement, missed", () => {
    const strip = weekStrip(
      row({
        lifecycle_stage: "retired",
        retired_week: "2027-01-11",
        window_weeks: ["2027-01-04", "2027-01-11", "2027-01-18", "2027-01-25", "2027-02-01"],
        played_weeks: ["2027-02-01"],
        credit_weeks: ["2027-01-25"],
      }),
    );
    expect(strip.map((week) => week.kind)).toEqual([
      "before",
      "before",
      "missed",
      "credit",
      "played",
    ]);
    expect(strip[4]).toMatchObject({ day: "1", month: "Feb" });
    expect(weekStrip(row())).toEqual([]);
  });

  it("finds the club-time football week, Monday first", () => {
    // Sunday 7 Feb 2027, 23:30 in Amsterdam, is still the week of 1 Feb.
    expect(footballWeek(new Date("2027-02-07T22:30:00Z"))).toBe("2027-02-01");
    // Monday 8 Feb 2027, 00:30 in Amsterdam, starts the next week.
    expect(footballWeek(new Date("2027-02-07T23:30:00Z"))).toBe("2027-02-08");
    expect(weekLabel("2026-10-19")).toBe("19 Oct");
    expect(tierLabel("bronze")).toBe("Bronze");
  });

  it("splits the album roster from Retired rows, tolerating an older schema", () => {
    const rows = [
      { id: "a", lifecycle_stage: "first_team" },
      { id: "b", lifecycle_stage: "retired" },
      { id: "c" },
    ];
    expect(firstTeamOnly(rows).map((r) => r.id)).toEqual(["a", "c"]);
    expect(isRetiredRow({ player_stage: "retired" })).toBe(true);
    expect(isRetiredRow({})).toBe(false);
  });
});

const face: CardFaceRow = {
  display_name: "Olaf G.",
  archetype: "all_rounder",
  photo_path: null,
  pac: 50,
  sho: 50,
  pas: 50,
  dri: 50,
  def: 50,
  phy: 50,
  rarity_tier: "bronze",
};
const PLAYER = "11111111-1111-4111-8111-111111111111";

describe("the Retired stamp on current card surfaces only", () => {
  it("stamps a current card whose view says Retired", () => {
    const none = new Set<string>();
    const photos = new Map<string, string>();
    expect(
      toLiveCardPlayer(
        { ...face, id: PLAYER, live_ovr: 46, lifecycle_stage: "retired" },
        none,
        photos,
      ).retired,
    ).toBe(true);
    expect(
      toLiveCardPlayer(
        { ...face, player_id: PLAYER, is_live: true, ovr: 46, player_stage: "retired" },
        none,
        photos,
      ).retired,
    ).toBe(true);
    expect(
      toListedCardPlayer(
        { ...face, ovr: 46, player_id: PLAYER, is_live: true, player_stage: "retired" },
        none,
        photos,
      ).retired,
    ).toBe(true);
  });

  it("leaves a snapshot row or an older schema alone", () => {
    const none = new Set<string>();
    const photos = new Map<string, string>();
    expect(toListedCardPlayer({ ...face, ovr: 46 }, none, photos).retired).toBe(false);
    expect(
      toLiveCardPlayer(
        { ...face, id: PLAYER, live_ovr: 46, lifecycle_stage: "first_team" },
        none,
        photos,
      ).retired,
    ).toBe(false);
  });
});

describe("a Retired pick is no longer available for Midweek, not gone", () => {
  it("words sold and Retired picks differently", () => {
    expect(lostClause(["Tess F."], [])).toBe("Tess F. isn't in your collection any more");
    expect(lostClause([], ["Olaf G."])).toBe("Olaf G. is no longer available for Midweek");
    expect(lostClause(["Tess F."], ["Olaf G.", "Kees B."])).toBe(
      "Tess F. isn't in your collection any more and Olaf G. and Kees B. are no longer available for Midweek",
    );
    expect(
      prefillNotice([], [3], ["Olaf G."])
        .map((segment) => segment.text)
        .join(""),
    ).toBe(
      "Loaded last week's five. Olaf G. is no longer available for Midweek, so slot 3 is open. Nothing is saved until you press Save.",
    );
  });
});
