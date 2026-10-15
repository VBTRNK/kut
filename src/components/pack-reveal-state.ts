// Pure state machine for the pack / starter reveal animation (BUILD_SPEC §49).
// Kept in its own module so it can be unit-tested without pulling in React or
// next/link through pack-reveal.tsx.

// Steps a single card walks through before the next one:
//   0 = rarity clue, 1 = + OVR, 2 = full identity/photo.
export const LAST_STEP = 2;

// A paid pack (#223) starts sealed: the member taps it ("opening", the
// wrapper's gesture), the three backs fan out and hold ("fanned"), then the
// cards follow. The starter has no wrapper and starts at the first card.
export type RevealState =
  | { phase: "sealed" }
  | { phase: "opening" }
  | { phase: "fanned" }
  | { phase: "revealing"; index: number; step: number }
  | { phase: "summary" };

export type RevealAction =
  | { type: "advance" }
  | { type: "skipAll" }
  | { type: "restart"; sealed?: boolean }
  /** A tap on a paid stage: open the pack, or jump ahead to the card itself. */
  | { type: "tap" }
  /** Timers: the gesture has finished, then the backs' hold has. */
  | { type: "fan" }
  | { type: "reveal" };

export function initialRevealState(
  cardCount: number,
  instant: boolean,
  sealed = false,
): RevealState {
  if (instant || cardCount === 0) return { phase: "summary" };
  return sealed ? { phase: "sealed" } : { phase: "revealing", index: 0, step: 0 };
}

export function packRevealReducer(
  state: RevealState,
  action: RevealAction,
  cardCount: number,
): RevealState {
  switch (action.type) {
    case "skipAll":
      return { phase: "summary" };
    case "restart":
      return initialRevealState(cardCount, false, action.sealed);
    case "fan":
      return state.phase === "opening" ? { phase: "fanned" } : state;
    case "reveal":
      return state.phase === "opening" || state.phase === "fanned"
        ? { phase: "revealing", index: 0, step: 0 }
        : state;
    case "tap":
      if (state.phase === "sealed") return { phase: "opening" };
      // A tap during the gesture, the hold, the tier or the rating shows the card.
      if (state.phase === "opening" || state.phase === "fanned")
        return { phase: "revealing", index: 0, step: LAST_STEP };
      if (state.phase === "revealing" && state.step < LAST_STEP)
        return { ...state, step: LAST_STEP };
      return packRevealReducer(state, { type: "advance" }, cardCount);
    case "advance": {
      if (state.phase !== "revealing") return state;
      if (state.step < LAST_STEP) return { ...state, step: state.step + 1 };
      if (state.index + 1 < cardCount)
        return { phase: "revealing", index: state.index + 1, step: 0 };
      return { phase: "summary" };
    }
    default:
      return state;
  }
}
