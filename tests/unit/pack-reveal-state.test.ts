import { describe, expect, it } from "vitest";
import {
  LAST_STEP,
  initialRevealState,
  packRevealReducer,
  type RevealState,
} from "@/components/pack-reveal-state";

const CARDS = 3;
const step = (state: RevealState, action: Parameters<typeof packRevealReducer>[1]) =>
  packRevealReducer(state, action, CARDS);

describe("pack reveal state machine", () => {
  it("starts mid-reveal normally and instantly under reduced motion", () => {
    expect(initialRevealState(CARDS, false)).toEqual({ phase: "revealing", index: 0, step: 0 });
    expect(initialRevealState(CARDS, true)).toEqual({ phase: "summary" });
    expect(initialRevealState(0, false)).toEqual({ phase: "summary" });
  });

  it("walks rarity → ovr → identity, then to the next card", () => {
    let state = initialRevealState(CARDS, false);
    state = step(state, { type: "advance" });
    expect(state).toEqual({ phase: "revealing", index: 0, step: 1 });
    state = step(state, { type: "advance" });
    expect(state).toEqual({ phase: "revealing", index: 0, step: 2 });
    state = step(state, { type: "advance" });
    expect(state).toEqual({ phase: "revealing", index: 1, step: 0 });
  });

  it("lands on the summary after the last card's last step", () => {
    let state: RevealState = { phase: "revealing", index: CARDS - 1, step: 2 };
    state = step(state, { type: "advance" });
    expect(state).toEqual({ phase: "summary" });
    // Advancing again is a no-op.
    expect(step(state, { type: "advance" })).toEqual({ phase: "summary" });
  });

  it("skipAll jumps straight to the summary from anywhere", () => {
    expect(step({ phase: "revealing", index: 0, step: 0 }, { type: "skipAll" })).toEqual({
      phase: "summary",
    });
    expect(step({ phase: "revealing", index: 2, step: 1 }, { type: "skipAll" })).toEqual({
      phase: "summary",
    });
  });

  it("restart replays from the first card unless there are none", () => {
    expect(step({ phase: "summary" }, { type: "restart" })).toEqual({
      phase: "revealing",
      index: 0,
      step: 0,
    });
    expect(packRevealReducer({ phase: "summary" }, { type: "restart" }, 0)).toEqual({
      phase: "summary",
    });
  });

  it("a paid pack starts sealed; the gesture and the backs' hold lead to card 1 (#223)", () => {
    expect(initialRevealState(CARDS, false, true)).toEqual({ phase: "sealed" });
    expect(initialRevealState(CARDS, true, true)).toEqual({ phase: "summary" });
    let state = initialRevealState(CARDS, false, true);
    // Timers do nothing until the member taps the pack.
    expect(step(state, { type: "fan" })).toEqual({ phase: "sealed" });
    expect(step(state, { type: "reveal" })).toEqual({ phase: "sealed" });
    expect(step(state, { type: "advance" })).toEqual({ phase: "sealed" });
    state = step(state, { type: "tap" });
    expect(state).toEqual({ phase: "opening" });
    state = step(state, { type: "fan" });
    expect(state).toEqual({ phase: "fanned" });
    state = step(state, { type: "reveal" });
    expect(state).toEqual({ phase: "revealing", index: 0, step: 0 });
    // A late timer from the wrapper never moves a card along.
    expect(step(state, { type: "fan" })).toBe(state);
    expect(step(state, { type: "reveal" })).toBe(state);
  });

  it("a tap during the gesture, hold, tier or rating jumps to the card itself", () => {
    expect(step({ phase: "opening" }, { type: "tap" })).toEqual({
      phase: "revealing",
      index: 0,
      step: LAST_STEP,
    });
    expect(step({ phase: "fanned" }, { type: "tap" })).toEqual({
      phase: "revealing",
      index: 0,
      step: LAST_STEP,
    });
    expect(step({ phase: "revealing", index: 1, step: 0 }, { type: "tap" })).toEqual({
      phase: "revealing",
      index: 1,
      step: LAST_STEP,
    });
    // On the card, a tap moves on: the next card, then the summary.
    expect(step({ phase: "revealing", index: 1, step: LAST_STEP }, { type: "tap" })).toEqual({
      phase: "revealing",
      index: 2,
      step: 0,
    });
    expect(step({ phase: "revealing", index: 2, step: LAST_STEP }, { type: "tap" })).toEqual({
      phase: "summary",
    });
  });

  it("skip all works sealed and mid-gesture; replay of a paid pack starts sealed", () => {
    for (const phase of ["sealed", "opening", "fanned"] as const) {
      expect(step({ phase }, { type: "skipAll" })).toEqual({ phase: "summary" });
    }
    expect(step({ phase: "summary" }, { type: "restart", sealed: true })).toEqual({
      phase: "sealed",
    });
  });
});
