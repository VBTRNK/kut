import { describe, expect, it } from "vitest";
import { matchPollMs, POLL_MS, startLivePoll, type PollEnv } from "@/lib/midweek/live-clock";

/**
 * A fake browser for the poller: a device clock that can run ahead of or
 * behind the server's, a tab that can be hidden, and timers that run as the
 * test moves the clock on.
 */
function fakeBrowser(skewMs = 0) {
  let device = 0;
  let visible = true;
  let refreshes = 0;
  let nextId = 0;
  const timers = new Map<number, { at: number; every: number | null; run: () => void }>();
  const env: PollEnv = {
    now: () => device,
    visible: () => visible,
    refresh: () => {
      refreshes += 1;
    },
    every: (run, ms) => {
      const id = nextId++;
      timers.set(id, { at: device + ms, every: ms, run });
      return () => timers.delete(id);
    },
    after: (run, ms) => {
      const id = nextId++;
      timers.set(id, { at: device + ms, every: null, run });
      return () => timers.delete(id);
    },
  };
  return {
    env,
    /** The server's clock as an ISO string, `skewMs` ahead of the device. */
    serverIso: (ms = device) => new Date(ms + skewMs).toISOString(),
    serverMs: () => device + skewMs,
    advance(ms: number) {
      const end = device + ms;
      for (;;) {
        const due = [...timers.entries()]
          .filter(([, timer]) => timer.at <= end)
          .sort((a, b) => a[1].at - b[1].at)[0];
        if (!due) break;
        const [id, timer] = due;
        device = timer.at;
        if (timer.every === null) timers.delete(id);
        else timer.at += timer.every;
        timer.run();
      }
      device = end;
    },
    hide: () => {
      visible = false;
    },
    show: () => {
      visible = true;
    },
    refreshes: () => refreshes,
  };
}

describe("poll intervals (Q6, ADR-147)", () => {
  it("polls the match page every 10 s, every 5 s in a shoot-out, the evening every 20 s", () => {
    expect(matchPollMs(false)).toBe(10_000);
    expect(matchPollMs(true)).toBe(5_000);
    expect(POLL_MS.evening).toBe(20_000);
  });

  it("refreshes every interval while a match is in play, skipping a hidden tab", () => {
    const browser = fakeBrowser();
    startLivePoll(
      { at: browser.serverIso(), poll: true, nextAt: null, intervalMs: 10_000 },
      browser.env,
    );
    browser.advance(30_000);
    expect(browser.refreshes()).toBe(3);
    browser.hide();
    browser.advance(30_000);
    expect(browser.refreshes()).toBe(3);
  });
});

describe("waiting for the next kick-off (ADR-147)", () => {
  it("refreshes at kick-off on the corrected clock, though the device runs 3 minutes slow", () => {
    const browser = fakeBrowser(180_000);
    const kickoff = browser.serverMs() + 60_000;
    startLivePoll(
      {
        at: browser.serverIso(),
        poll: false,
        nextAt: new Date(kickoff).toISOString(),
        intervalMs: 20_000,
      },
      browser.env,
    );
    browser.advance(60_000);
    expect(browser.refreshes()).toBe(0);
    browser.advance(1_000);
    expect(browser.refreshes()).toBe(1);
  });

  it("keeps polling after a failed refresh at kick-off, until a new render arrives", () => {
    const browser = fakeBrowser();
    const kickoff = browser.serverMs() + 30_000;
    const poller = startLivePoll(
      {
        at: browser.serverIso(),
        poll: false,
        nextAt: new Date(kickoff).toISOString(),
        intervalMs: 20_000,
      },
      browser.env,
    );
    // The refresh at kick-off fails: no new render, so the same poller runs on.
    browser.advance(31_000);
    expect(browser.refreshes()).toBe(1);
    browser.advance(20_000);
    expect(browser.refreshes()).toBe(2);
    // The next refresh lands: the page renders with new props and a new poller.
    poller.stop();
    startLivePoll(
      { at: browser.serverIso(), poll: true, nextAt: null, intervalMs: 20_000 },
      browser.env,
    );
    browser.advance(20_000);
    expect(browser.refreshes()).toBe(3);
  });

  it("a render that arrives with its kick-off already due keeps polling", () => {
    const browser = fakeBrowser();
    startLivePoll(
      {
        at: browser.serverIso(),
        poll: false,
        nextAt: new Date(browser.serverMs() - 5_000).toISOString(),
        intervalMs: 20_000,
      },
      browser.env,
    );
    browser.advance(40_000);
    expect(browser.refreshes()).toBe(2);
  });

  it("a hidden waiting tab shown after kick-off refreshes at once", () => {
    const browser = fakeBrowser();
    const kickoff = browser.serverMs() + 60_000;
    const poller = startLivePoll(
      {
        at: browser.serverIso(),
        poll: false,
        nextAt: new Date(kickoff).toISOString(),
        intervalMs: 20_000,
      },
      browser.env,
    );
    browser.hide();
    browser.advance(70_000);
    expect(browser.refreshes()).toBe(0);
    browser.show();
    poller.onShow();
    expect(browser.refreshes()).toBe(1);
  });

  it("a tab shown before its kick-off waits for it", () => {
    const browser = fakeBrowser();
    const poller = startLivePoll(
      {
        at: browser.serverIso(),
        poll: false,
        nextAt: new Date(browser.serverMs() + 60_000).toISOString(),
        intervalMs: 20_000,
      },
      browser.env,
    );
    browser.hide();
    browser.advance(10_000);
    browser.show();
    poller.onShow();
    expect(browser.refreshes()).toBe(0);
  });
});
