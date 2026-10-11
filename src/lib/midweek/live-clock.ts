/**
 * The live pages' timing on the device (MM 3.0, ADR-147): one corrected clock
 * for the match clock, the countdowns and the poller, and when the poller asks
 * the server for the page again. Pure and client-safe; the components wire it
 * to the browser's timers.
 *
 * The device clock can be wrong, so every page carries the server's render
 * time (`at`) and the device measures its offset from it on arrival. The
 * offset includes the page's delivery time, so the corrected clock errs late,
 * never early: it never shows a minute before the server would.
 */

/** How far the server's clock is ahead of the device's, measured when a render arrives. */
export function clockOffsetMs(at: string, deviceNowMs: number): number {
  return Date.parse(at) - deviceNowMs;
}

/** The device clock corrected to the server's. */
export function correctedNowMs(offsetMs: number, deviceNowMs: number): number {
  return deviceNowMs + offsetMs;
}

/**
 * How often a live page asks for itself again (owner decision Q6): the match
 * page every 10 seconds while its match plays and every 5 once its shoot-out
 * has begun (a kick every 5 seconds); the evening and the bracket every 20.
 */
export const POLL_MS = { match: 10_000, shootout: 5_000, evening: 20_000 } as const;

/** The match page's interval for what it shows. */
export function matchPollMs(shootout: boolean): number {
  return shootout ? POLL_MS.shootout : POLL_MS.match;
}

/** A moment past `nextAt` before the first refresh, so the server is surely there. */
const GRACE_MS = 1_000;

/** The browser, as the poller uses it; a test passes fake timers. */
export type PollEnv = {
  /** The device clock, in milliseconds. */
  now: () => number;
  visible: () => boolean;
  refresh: () => void;
  every: (run: () => void, ms: number) => () => void;
  after: (run: () => void, ms: number) => () => void;
};

/**
 * Starts a page's poller (HANDOFF "Polling", ADR-115, ADR-147). While a match
 * is in play (`poll`) it refreshes every `intervalMs`. Otherwise it waits for
 * the next kick-off (`nextAt`) on the corrected clock, refreshes then, and
 * keeps refreshing every `intervalMs` until a render arrives with new props,
 * which starts a new poller: one failed refresh never leaves a waiting page
 * stuck. A hidden tab skips its refreshes; shown again, it refreshes at once
 * when it polls or its `nextAt` has passed.
 */
export function startLivePoll(
  input: { at: string; poll: boolean; nextAt: string | null; intervalMs: number },
  env: PollEnv,
): { onShow: () => void; stop: () => void } {
  const offset = clockOffsetMs(input.at, env.now());
  const nextMs = input.nextAt === null ? null : Date.parse(input.nextAt) + GRACE_MS;
  const due = () => nextMs !== null && correctedNowMs(offset, env.now()) >= nextMs;
  const refresh = () => {
    if (env.visible()) env.refresh();
  };
  const stops: (() => void)[] = [];
  if (input.poll || due()) {
    stops.push(env.every(refresh, input.intervalMs));
  } else if (nextMs !== null) {
    const wait = nextMs - correctedNowMs(offset, env.now());
    // setTimeout overflows past 2^31 − 1 ms (about 24 days) and fires at once.
    if (wait < 2 ** 31 - 1) {
      stops.push(
        env.after(() => {
          refresh();
          stops.push(env.every(refresh, input.intervalMs));
        }, wait),
      );
    }
  }
  return {
    onShow: () => {
      if (env.visible() && (input.poll || due())) env.refresh();
    },
    stop: () => stops.forEach((stop) => stop()),
  };
}
