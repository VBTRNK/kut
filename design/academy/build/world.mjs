// The Academy sample (#246 S1). An invented club, nothing here is a real
// member or Player. Attendance, credits and injuries are the invented inputs;
// stages, progress, absence, tiers and discard values follow from them through
// lifecycle.mjs and the app's own rating helpers.
//
// Ratings: the Talents' and the lifecycle Players' OVRs are the rules'
// worked examples (#246, checked against the formulas in review 1): a weekly
// newcomer is promoted at 51, an absentee is 53 at 8 weeks and 46 at 12.
// Every other OVR is invented.
import { src } from "../../ui-pass/build/source.mjs";
import { absence, progress, windowOf } from "./lifecycle.mjs";

const { getRarityTier, calculateLiveDiscardValue, ARCHETYPE_OFFSETS } = src("game/rating-engine.ts");

export const GO_LIVE = "2026-10-19";
/** Wed 3 Feb 2027, after Monday's session was published. */
export const NOW = new Date("2027-02-03T12:00:00+01:00");
export const NOW_WEEK = "2027-02-01";

const addDays = (iso, days) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
const mondays = [];
for (let w = "2026-08-31"; w <= NOW_WEEK; w = addDays(w, 7)) mondays.push(w);
/** No sessions over Christmas, so those weeks don't count. */
const SKIPPED = new Set(["2026-12-21", "2026-12-28"]);
export const COUNTED = mondays.filter((w) => !SKIPPED.has(w));
const since = (from) => COUNTED.filter((w) => w >= from);
const every = (from, to = NOW_WEEK) => COUNTED.filter((w) => w >= from && w <= to);

export const WINDOW = windowOf(COUNTED, NOW_WEEK);

const clamp = (v) => Math.min(Math.max(v, 1), 99);
const slugOf = (name) => name.toLowerCase().replace(/[^a-z]+/g, "-").replace(/-$/, "");

/** A `kut.player_directory`-shaped row: stats are OVR plus the archetype's offsets. */
function row(id, name, archetype, ovr) {
  const off = ARCHETYPE_OFFSETS[archetype];
  return {
    id,
    slug: slugOf(name),
    display_name: name,
    archetype,
    photo_path: null,
    live_ovr: ovr,
    pac: clamp(ovr + off.pac),
    sho: clamp(ovr + off.sho),
    pas: clamp(ovr + off.pas),
    dri: clamp(ovr + off.dri),
    def: clamp(ovr + off.def),
    phy: clamp(ovr + off.phy),
    rarity_tier: getRarityTier(ovr),
  };
}

// --------------------------------------------------------------- the roster ----
// `stage` is the stored stage before the lifecycle runs: everyone on the
// roster at the migration is founding First Team; Talents were registered later.

const PEOPLE = [
  // Regulars (founding First Team).
  { id: "p01", name: "Anouk B.", archetype: "playmaker", ovr: 71, stage: "first_team", attended: since("2026-08-31") },
  { id: "p02", name: "Daan K.", archetype: "finisher", ovr: 66, stage: "first_team", attended: since("2026-08-31") },
  { id: "p03", name: "Esther M.", archetype: "defender", ovr: 63, stage: "first_team", attended: since("2026-08-31").filter((_, i) => i % 5 !== 2) },
  { id: "p04", name: "Gijs H.", archetype: "tank", ovr: 61, stage: "first_team", attended: since("2026-08-31").filter((_, i) => i % 3 !== 1) },
  { id: "p05", name: "Iris W.", archetype: "speedster", ovr: 58, stage: "first_team", attended: since("2026-08-31").filter((_, i) => i % 2 === 0) },
  { id: "p06", name: "Mo A.", archetype: "goalkeeper", ovr: 57, stage: "first_team", attended: since("2026-08-31").filter((_, i) => i % 4 !== 3) },
  { id: "p07", name: "Roos N.", archetype: "all_rounder", ovr: 55, stage: "first_team", attended: since("2026-08-31").filter((_, i) => i % 3 === 0) },
  { id: "p08", name: "Tess F.", archetype: "finisher", ovr: 54, stage: "first_team", attended: since("2026-08-31").filter((_, i) => i % 4 === 0) },
  { id: "p09", name: "Umut C.", archetype: "defender", ovr: 52, stage: "first_team", attended: since("2026-08-31").filter((_, i) => i % 3 === 2) },
  { id: "p10", name: "Vera I.", archetype: "playmaker", ovr: 49, stage: "first_team", attended: since("2026-08-31").filter((_, i) => i % 5 === 1) },
  // Lifecycle Players.
  /** At risk: last played 9 Nov. */
  { id: "p11", name: "Kees R.", archetype: "tank", ovr: 53, stage: "first_team", attended: every("2026-08-31", "2026-11-09") },
  /** Retires this week: last played 26 Oct, the 12th absent week is 1 Feb. */
  { id: "p12", name: "Olaf G.", archetype: "speedster", ovr: 46, stage: "first_team", attended: every("2026-08-31", "2026-10-26") },
  /** Retired 25 Jan (not seen since before go-live); came back on 1 Feb with a credit. */
  { id: "p13", name: "Pim L.", archetype: "all_rounder", ovr: 44, stage: "first_team", attended: [...every("2026-08-31", "2026-10-12"), "2027-02-01"], credits: ["2027-02-01"] },
  /** Retired 25 Jan, not back. */
  { id: "p14", name: "Wout Y.", archetype: "defender", ovr: 42, stage: "first_team", attended: every("2026-08-31", "2026-09-28") },
  /** Injured since 23 Nov (an unlinked Player): paused, so not At risk. */
  { id: "p15", name: "Hidde P.", archetype: "finisher", ovr: 50, stage: "first_team", attended: every("2026-08-31", "2026-11-16"), injuredWeeks: since("2026-11-23") },
  // Talents (registered while recording attendance).
  /** A weekly newcomer: promoted this week. */
  { id: "t01", name: "Fenna L.", archetype: "all_rounder", ovr: 51, stage: "talent", attended: ["2027-01-18", "2027-01-25", "2027-02-01"] },
  { id: "t02", name: "Jip W.", archetype: "speedster", ovr: 45, stage: "talent", attended: ["2027-01-11", "2027-02-01"] },
  /** Fading: 30 Nov leaves the window next counted week. */
  { id: "t03", name: "Sven B.", archetype: "defender", ovr: 41, stage: "talent", attended: ["2026-11-30", "2027-01-18"] },
  /** One real week and a credit. */
  { id: "t04", name: "Merel T.", archetype: "playmaker", ovr: 38, stage: "talent", attended: ["2027-01-25"], credits: ["2027-01-25"] },
  /** A one-off visitor: never visible. */
  { id: "t05", name: "Lars N.", archetype: "all_rounder", ovr: 33, stage: "talent", attended: ["2027-01-11"] },
];

/** Run the lifecycle for one Player: their stage now, and what the mocks show about it. */
function evaluate(p) {
  if (p.stage === "talent") {
    const pr = progress(p, COUNTED, NOW_WEEK);
    if (pr.promotes) {
      // Promotion happened at the operation that made progress reach 3: this week's publish.
      return { stage: "first_team", promotedWeek: NOW_WEEK, newlyPromoted: true, progress: pr, clock: absence({ ...p, promotedWeek: NOW_WEEK }, COUNTED, NOW_WEEK, GO_LIVE) };
    }
    return { stage: "talent", progress: pr };
  }
  const clock = absence(p, COUNTED, NOW_WEEK, GO_LIVE);
  if (clock.retired) {
    const comeback = progress(p, COUNTED, NOW_WEEK, clock.retiredWeek);
    return { stage: "retired", clock, progress: comeback, retiredThisWeek: clock.retiredWeek === NOW_WEEK };
  }
  return { stage: "first_team", clock };
}

export const PLAYERS = PEOPLE.map((p) => ({ ...p, ...evaluate(p), row: row(p.id, p.name, p.archetype, p.ovr), discard: calculateLiveDiscardValue(p.ovr) }));
export const byId = new Map(PLAYERS.map((p) => [p.id, p]));
export const P = (id) => byId.get(id);

export const FIRST_TEAM = PLAYERS.filter((p) => p.stage === "first_team").sort((a, b) => b.ovr - a.ovr || a.name.localeCompare(b.name));
export const RETIRED = PLAYERS.filter((p) => p.stage === "retired").sort((a, b) => a.name.localeCompare(b.name));
export const TALENTS = PLAYERS.filter((p) => p.stage === "talent");
/** The Academy: visible Talents, then comebacks (Retired with progress >= 2). */
export const ACADEMY = [
  ...TALENTS.filter((p) => p.progress.visible).sort((a, b) => b.progress.total - a.progress.total || a.name.localeCompare(b.name)),
  ...RETIRED.filter((p) => p.progress.visible),
];
export const AT_RISK = FIRST_TEAM.filter((p) => p.clock.atRisk);
export const INJURED = new Set(["p15"]);

/** "25 Jan" for a week's Monday. */
export const weekLabel = (iso) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));

// -------------------------------------------------------------- the member ----

/** "You" are Sanne. Copies she owns, by Player (counts). */
export const ME = { name: "Sanne", club: "Sanne's Club", balance: 1240 };
export const OWNED = new Map([
  ["p01", 1], ["p02", 2], ["p03", 1], ["p05", 1], ["p06", 1], ["p07", 2], ["p09", 1], ["p10", 1],
  ["p11", 2], ["p12", 1], ["p13", 1], ["p15", 1],
]);

// Sanity checks: the sample must show what each board says it shows.
const expect = (cond, msg) => {
  if (!cond) throw new Error(`Academy sample: ${msg}`);
};
expect(P("t01").newlyPromoted, "Fenna is promoted this week");
expect(P("t02").progress.visible && !P("t02").progress.fading, "Jip is visible, not fading");
expect(P("t03").progress.fading, "Sven is fading");
expect(P("t04").progress.credits.length === 1, "Merel has one credit");
expect(!P("t05").progress.visible, "Lars is not visible");
expect(P("p11").clock.atRisk && P("p11").clock.absent === 10, "Kees is At risk at 10");
expect(P("p12").stage === "retired" && P("p12").retiredThisWeek, "Olaf retires this week");
expect(P("p13").stage === "retired" && P("p13").progress.visible, "Pim is a visible comeback");
expect(P("p14").stage === "retired" && P("p14").clock.retiredWeek === "2027-01-25", "Wout retired on 25 Jan");
expect(P("p15").stage === "first_team" && !P("p15").clock.atRisk, "Hidde is paused by injury");
