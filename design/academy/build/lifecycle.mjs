// The Academy lifecycle rules (ADR-165, #246 rules comment) as plain functions,
// design-only, so every number on a mock follows from attendance instead of
// being typed in. S2's SQL evaluator is the authority; this mirror exists so
// the mocks and S2's tests can be compared against one worked world.
//
// Assumption the rules leave to S2, marked here: a counted week counts as
// absent once its first session is published without the Player in it, so
// the current week counts from its Monday publish.

/** The last 8 counted weeks up to and including `now` (a Monday). */
export function windowOf(counted, now, size = 8) {
  return counted.filter((week) => week <= now).slice(-size);
}

/** Credits still active in `now`'s week: granted at or before it, expiring after 8 later counted weeks. */
export function activeCredits(credits, counted, now) {
  return credits.filter((grant) => {
    if (grant > now) return false;
    return counted.filter((week) => week > grant && week <= now).length < 8;
  });
}

/**
 * Progress = distinct real counted weeks in the last 8 counted weeks + active
 * credits (at most 2). `since` limits the real weeks to those after a
 * retirement (comeback progress). Returns the parts, so a mock can draw each pip.
 */
export function progress({ attended, credits = [] }, counted, now, since = null) {
  const window = windowOf(counted, now);
  const real = window.filter((week) => attended.includes(week) && (since === null || week > since));
  const active = activeCredits(credits, counted, now).slice(0, 2);
  const total = real.length + active.length;
  // The oldest week of the window leaves it at the next counted week.
  const leaving = window.length === 8 && real[0] === window[0];
  return {
    real,
    credits: active,
    total,
    visible: total >= 2,
    promotes: total >= 3 && real.length >= 1,
    /** Without an appearance next counted week, progress falls below 2 and the Talent drops out of view. */
    fading: total === 2 && leaving,
  };
}

/**
 * The First Team clock. It starts at the latest of the latest promotion and
 * go-live; an appearance resets it; a counted week that overlaps an injury
 * doesn't count. 8 absent weeks warn (At risk); the 12th retires, and
 * appearances after that only build comeback progress.
 */
export function absence({ attended, promotedWeek = null, injuredWeeks = [] }, counted, now, goLive) {
  const start = [promotedWeek, goLive].filter(Boolean).sort().at(-1);
  let run = 0;
  let retiredWeek = null;
  for (const week of counted.filter((w) => w > start && w <= now)) {
    if (attended.includes(week)) run = 0;
    else if (!injuredWeeks.includes(week)) run += 1;
    if (run >= 12 && retiredWeek === null) retiredWeek = week;
  }
  return {
    absent: run,
    retiredWeek,
    retired: retiredWeek !== null,
    atRisk: retiredWeek === null && run >= 8,
    toRetire: Math.max(0, 12 - run),
  };
}
