import { describe, expect, it } from "vitest";
import { clockOffsetMs, correctedNowMs } from "@/lib/midweek/live-clock";
import { assembleBracket, pairSentence } from "@/lib/midweek/evening";
import { liveView, maskInPlay, matchMinute, rowLive, type RowEvent } from "@/lib/midweek/live";
import { kickItems } from "@/lib/midweek/report/kicks";
import type { ShootoutKick, TimelineItem } from "@/lib/midweek/report/types";
import type { MatchRow } from "@/lib/midweek/rows";

const row = (id: string, extra: Partial<MatchRow> = {}): MatchRow => ({
  match_id: id,
  tournament_id: "t",
  week_start: "2026-10-12",
  round: 1,
  pairing: 0,
  bye: false,
  side_0_user_id: "a",
  side_0_name: "Sanne",
  side_1_user_id: "b",
  side_1_name: "Eline",
  side_0_goals: 1,
  side_1_goals: 0,
  side_0_penalties: null,
  side_1_penalties: null,
  winner_side: 0,
  winner_user_id: "a",
  win_chance_ppm: 460_000,
  side_0_day_rolls_ppm: [],
  side_1_day_rolls_ppm: [],
  reveal_at: "2026-10-14T18:00:00.000Z",
  ...extra,
});

describe("maskInPlay (ADR-115)", () => {
  const now = new Date("2026-10-14T18:03:00.000Z");

  it("withholds the result of a match whose stored end is still ahead", () => {
    const [masked] = maskInPlay([row("m")], new Map([["m", "2026-10-14T18:04:40.000Z"]]), now);
    expect(masked).toMatchObject({
      in_play: true,
      side_0_goals: null,
      side_1_goals: null,
      winner_side: null,
      winner_user_id: null,
    });
  });

  it("shows a match that has ended, a bye, and a week with no stored times whole", () => {
    const [ended, bye, old] = maskInPlay(
      [row("ended"), row("bye", { bye: true, side_1_user_id: null }), row("old")],
      new Map([
        ["ended", "2026-10-14T18:02:00.000Z"],
        ["old", null],
      ]),
      now,
    );
    expect(ended).toMatchObject({ in_play: false, winner_side: 0, side_0_goals: 1 });
    expect(bye.in_play).toBe(false);
    expect(old).toMatchObject({ in_play: false, winner_side: 0 });
  });

  it("keeps in play a match the view already withholds (ADR-106), with no end to read", () => {
    const [withheld] = maskInPlay(
      [
        row("m", {
          winner_side: null,
          winner_user_id: null,
          side_0_goals: null,
          side_1_goals: null,
        }),
      ],
      new Map(),
      now,
    );
    expect(withheld.in_play).toBe(true);
  });
});

describe("liveView (ADR-115)", () => {
  const moment = (
    minute: number,
    side: 0 | 1,
    score: [number, number],
    kind: TimelineItem["kind"] = "goal",
  ): TimelineItem => ({
    minute,
    side,
    kind,
    text: `${minute}`,
    parts: [{ text: `${minute}` }],
    score,
  });
  const timeline = [moment(10, 1, [0, 0], "save"), moment(39, 0, [1, 0]), moment(80, 1, [1, 1])];
  const kick = (side: 0 | 1, outcome: ShootoutKick["outcome"]): ShootoutKick => ({
    side,
    round: 1,
    kicker: side === 0 ? "Gijs H." : "Ayla D.",
    keeper: side === 0 ? "Ayla D." : "Gijs H.",
    outcome,
  });
  const kicks = [kick(0, "goal"), kick(1, "goal"), kick(0, "save"), kick(1, "goal")];
  const at = (seconds: number) => new Date(Date.parse("2026-10-14T18:15:00.000Z") + seconds * 1000);
  const view = (seconds: number) =>
    liveView({
      timeline,
      kicks,
      kickoffAt: "2026-10-14T18:15:00.000Z",
      scheduleVersion: 2,
      now: at(seconds),
    });

  it("reveals each chance at kick-off + minute × 280 s / 90, with the score so far", () => {
    // Minute 39 is due at 121.33 s.
    expect(view(121).timeline.map((m) => m.minute)).toEqual([10]);
    expect(view(122).timeline.map((m) => m.minute)).toEqual([10, 39]);
    expect(view(122).score).toEqual([1, 0]);
    expect(view(122).minute).toBe(39);
    expect(view(0).score).toEqual([0, 0]);
  });

  it("caps the clock at 90 and reveals the kicks one every 5 seconds after full time", () => {
    expect(view(280).minute).toBe(90);
    expect(view(280).shootout).toBe(true);
    expect(view(280).kicks).toEqual([]);
    expect(view(280).penalties).toEqual([0, 0]);
    expect(view(290).kicks).toHaveLength(2);
    expect(view(290).penalties).toEqual([1, 1]);
    expect(view(300).penalties).toEqual([1, 2]);
    expect(view(279).shootout).toBe(false);
    expect(view(279).penalties).toBeNull();
  });

  it("a week on the old clock (version 1) shows everything at kick-off", () => {
    const old = liveView({
      timeline,
      kicks,
      kickoffAt: "2026-10-14T18:15:00.000Z",
      scheduleVersion: 1,
      now: at(0),
    });
    expect(old.timeline).toHaveLength(3);
  });

  it("a level shoot-out stays live after its last kick, with no kick marked decisive", () => {
    // Four kicks are due by 300 s; the draw would come at 305 s, the match's end.
    const live = view(304);
    expect(live.kicks).toHaveLength(4);
    expect(live.shootout).toBe(true);
    expect(kickItems(live.kicks).some((kick) => kick.decider || kick.line)).toBe(false);
  });
});

describe("the running clock (ADR-147)", () => {
  const kickoffAt = "2026-10-14T18:30:00.000Z";
  const kickoff = Date.parse(kickoffAt);

  it("counts 0′ to 90′ over the 14 slots and holds at 90′", () => {
    expect(matchMinute(kickoffAt, 2, kickoff - 5_000)).toBe(0);
    expect(matchMinute(kickoffAt, 2, kickoff)).toBe(0);
    // 64′ is due at 64 × 280 / 90 = 199.1 s.
    expect(matchMinute(kickoffAt, 2, kickoff + 199_000)).toBe(63);
    expect(matchMinute(kickoffAt, 2, kickoff + 199_200)).toBe(64);
    expect(matchMinute(kickoffAt, 2, kickoff + 280_000)).toBe(90);
    // Into a shoot-out, or long after: still 90′; what follows comes from the server.
    expect(matchMinute(kickoffAt, 2, kickoff + 600_000)).toBe(90);
  });

  it("agrees with the server's minute on a device clock that is minutes wrong", () => {
    const at = new Date(kickoff + 199_200).toISOString();
    for (const skew of [-180_000, 0, 240_000]) {
      // The render arrives with the device clock `skew` off the server's.
      const arrived = Date.parse(at) + skew;
      const offset = clockOffsetMs(at, arrived);
      expect(matchMinute(kickoffAt, 2, correctedNowMs(offset, arrived))).toBe(64);
      // Ten device seconds later, ten server seconds later: 67′.
      expect(matchMinute(kickoffAt, 2, correctedNowMs(offset, arrived + 10_000))).toBe(67);
    }
  });
});

describe("kickItems (DR4-4)", () => {
  it("carries the tally after each kick, and no line or decider live", () => {
    const items = kickItems([
      { side: 1, round: 1, kicker: "A", keeper: "B", outcome: "goal" },
      { side: 0, round: 1, kicker: "B", keeper: "A", outcome: "save" },
      { side: 1, round: 2, kicker: "C", keeper: "B", outcome: "wide" },
      { side: 0, round: 2, kicker: "D", keeper: "A", outcome: "goal" },
    ]);
    expect(items.map((kick) => kick.tally)).toEqual([
      [0, 1],
      [0, 1],
      [0, 1],
      [1, 1],
    ]);
    expect(items.every((kick) => kick.line === null && !kick.decider)).toBe(true);
  });
});

describe("rows of matches in play (DR4-6, ADR-148)", () => {
  const kickoffAt = "2026-10-14T18:00:00.000Z";
  const at = (ms: number) => new Date(Date.parse(kickoffAt) + ms);
  const ev = (kind: RowEvent["kind"], side: 0 | 1, outcome: RowEvent["outcome"], id = "m") => ({
    match_id: id,
    kind,
    side,
    outcome,
  });
  const regulation: RowEvent[] = [
    ev("chance", 0, "goal"),
    ev("chance", 1, "save"),
    ev("chance", 1, "goal"),
    ev("chance", 0, "woodwork"),
    ev("chance", 1, "goal"),
    // Another match's goal never counts here.
    ev("chance", 0, "goal", "other"),
  ];

  it("counts chances scored per side, and the minute from the kick-off", () => {
    expect(
      rowLive({ match: row("m"), events: regulation, scheduleVersion: 2, now: at(199_200) }),
    ).toEqual({
      goals: [1, 2],
      penalties: null,
      minute: 64,
      clock: { kickoffAt, scheduleVersion: 2, at: at(199_200).toISOString() },
    });
  });

  it("counts kicks only in the shoot-out, from its first kick, and never the settling draw", () => {
    const missFirst = [...regulation.slice(0, 3), ev("penalty", 0, "save")];
    expect(
      rowLive({ match: row("m"), events: missFirst, scheduleVersion: 2, now: at(285_000) }),
    ).toMatchObject({ goals: [1, 1], penalties: [0, 0], minute: 90 });
    const level = [
      ev("chance", 0, "goal"),
      ev("chance", 1, "goal"),
      ev("penalty", 0, "goal"),
      ev("penalty", 1, "goal"),
      ev("penalty", 0, "wide"),
      ev("penalty", 1, "save"),
      ev("toss", 1, null),
    ];
    expect(
      rowLive({ match: row("m"), events: level, scheduleVersion: 2, now: at(320_000) }),
    ).toMatchObject({ goals: [1, 1], penalties: [1, 1] });
  });

  it("the bracket shows every match in play live with its score, and a week with no event times whole", () => {
    const now = at(199_200);
    const playing = row("m", {
      winner_side: null,
      winner_user_id: null,
      side_0_goals: null,
      side_1_goals: null,
      in_play: true,
    });
    const bracket = (matches: MatchRow[], live = true) =>
      assembleBracket({
        rounds: 1,
        lockAt: "2026-10-14T17:55:00.000Z",
        scheduleVersion: 2,
        matches,
        autoUserIds: new Set(),
        live: live ? { events: regulation, now } : undefined,
      })[0].pairs[0];
    const pair = bracket([playing]);
    expect(pair).toMatchObject({ kind: "inplay", live: { goals: [1, 2], minute: 64 } });
    expect(pairSentence(pair)).toBe("Live, 64th minute: Sanne 1, Eline 2. Watch it.");
    // Without the events read, still live and linked, with no score.
    expect(pairSentence(bracket([playing], false))).toBe("Live: Sanne v Eline. Watch it.");
    // A week from before ADR-104 has no stored end, so it shows whole from the
    // kick-off with its stored score; its events are never counted.
    const [old] = maskInPlay([row("m")], new Map([["m", null]]), now);
    const whole = bracket([old]);
    expect(whole.kind).toBe("played");
    expect(pairSentence(whole)).toBe("Sanne 1, Eline 0. Sanne won.");
  });

  it("names the shoot-out in the sentence", () => {
    const pair = assembleBracket({
      rounds: 1,
      lockAt: "2026-10-14T17:55:00.000Z",
      scheduleVersion: 2,
      matches: [row("m", { winner_side: null, winner_user_id: null, in_play: true })],
      autoUserIds: new Set(),
      live: {
        events: [ev("chance", 0, "goal"), ev("chance", 1, "goal"), ev("penalty", 0, "goal")],
        now: at(290_000),
      },
    })[0].pairs[0];
    expect(pairSentence(pair)).toBe(
      "Live, penalties: Sanne 1, Eline 1, 1–0 in the shoot-out. Watch it.",
    );
  });
});
