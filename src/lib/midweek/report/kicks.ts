import type { Segment, ShootoutKick, ShootoutReport } from "./types";

/**
 * A shoot-out kick as the feed and the report show it (#263, DR4-4): the kick,
 * the tally after it, and at full time its own line of commentary. Pure and
 * client-safe.
 */
export type KickItem = ShootoutKick & {
  /** The shoot-out's tally after this kick, side 0 first. */
  tally: [number, number];
  /** Full time only: the renderer's line for a kick not scored, or the decider's. */
  line: Segment[] | null;
  /** Full time only: the kick that decided the shoot-out. Never set live. */
  decider: boolean;
};

/**
 * The kicks so far with their running tally and nothing else: what a live
 * page may show, since each kick's line and the decider would tell what
 * follows. Built from the kicks alone, so a kick reads the same live and at
 * full time.
 */
export function kickItems(kicks: readonly ShootoutKick[]): KickItem[] {
  const tally: [number, number] = [0, 0];
  return kicks.map((kick) => {
    if (kick.outcome === "goal") tally[kick.side] += 1;
    return { ...kick, tally: [tally[0], tally[1]], line: null, decider: false };
  });
}

/**
 * The full-time shoot-out (DR4-5): the intro, every kick with its own line
 * under it, and the draw's line when a draw settled it. The lines follow the
 * renderer's own rule (`renderShootout`): line 0 is the intro, then one line
 * per kick not scored and one for the decider, and a draw adds the last one.
 */
export function shootoutStory(shootout: ShootoutReport): {
  intro: Segment[];
  kicks: KickItem[];
  toss: Segment[] | null;
} {
  let next = 1;
  const kicks = kickItems(shootout.kicks).map((kick, index) => {
    const decider = index === shootout.decider;
    const line = kick.outcome !== "goal" || decider ? (shootout.lineParts[next++] ?? null) : null;
    return { ...kick, line, decider };
  });
  return {
    intro: shootout.lineParts[0] ?? [],
    kicks,
    toss: shootout.decider === null ? (shootout.lineParts[next] ?? null) : null,
  };
}
