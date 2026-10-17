// The Academy boards (#246 S1). Stages, progress, absence, tiers and discard
// values come from world.mjs (lifecycle.mjs over invented attendance) and the
// app's own helpers; the copy is the proposal under review.
import path from "node:path";
import { sourceModule, h } from "../../ui-pass/build/source.mjs";
import { here } from "./paths.mjs";
import * as W from "./world.mjs";

const X = sourceModule(path.join(here, "academy.tsx"));
const { toLiveCardPlayer } = sourceModule(path.join(here, "../../../src/lib/live-card-player.ts"));
const { archetypeLabel } = sourceModule(path.join(here, "../../../src/game/archetypes.ts"));

const NO_PHOTOS = new Map();
const card = (p) => toLiveCardPlayer(p.row, W.INJURED, NO_PHOTOS);
const at = (p) => {
  globalThis.__mockPath = p;
};
const tierName = (t) => t[0].toUpperCase() + t.slice(1);
const L = W.weekLabel;
const STAMP = "stamp";
const P = W.P;

// --------------------------------------------------------------- sentences ----

function academyRow(p) {
  const { real, credits, fading } = p.progress;
  const r = real.length;
  const c = credits.length;
  const href = `/players/${p.row.slug}`;
  if (p.stage === "retired")
    return { name: p.name, href, real: r, credits: c, tag: { tone: "neutral", text: "Comeback" }, line: `Retired ${L(p.clock.retiredWeek)} · ${X.progressWords(r, c)} · one more week brings them back` };
  if (fading) return { name: p.name, href, real: r, credits: c, tag: { tone: "warn", text: "Fading" }, line: `${X.progressWords(r, c)} · a week drops off unless they play next week` };
  return { name: p.name, href, real: r, credits: c, line: `${X.progressWords(r, c)} · one more week promotes` };
}

function strip(p, since = null) {
  const real = p.progress.real;
  const credits = p.progress.credits;
  return W.WINDOW.map((w) => ({
    day: String(Number(w.slice(8))),
    month: L(w).split(" ")[1],
    kind: real.includes(w) ? "played" : credits.includes(w) && !p.attended.includes(w) ? "credit" : since && w <= since ? "before" : "missed",
  }));
}

const fenna = P("t01");
const promotedLine = `${tierName(fenna.row.rarity_tier)} ${fenna.ovr}`;

// ------------------------------------------------------------------ boards ----

function players() {
  at("/players");
  return X.PlayersPage({
    academy: W.ACADEMY.map(academyRow),
    cards: W.FIRST_TEAM.map((p) => ({ player: card(p), href: `/players/${p.row.slug}`, tag: p.clock.atRisk ? { tone: "warn", text: "At risk" } : p.newlyPromoted ? { tone: "won", text: "New" } : undefined })),
    retired: { count: W.RETIRED.length },
  });
}

function retiredList() {
  at("/players");
  return X.RetiredListPage({
    stamp: STAMP,
    cards: W.RETIRED.map((p) => ({
      player: card(p),
      href: `/players/${p.row.slug}`,
      since: L(p.clock.retiredWeek),
      foot: p.progress.visible ? `Comeback: ${X.progressWords(p.progress.real.length, p.progress.credits.length)}` : `Retired ${L(p.clock.retiredWeek)}`,
    })),
  });
}

function talent(id) {
  at("/players");
  const p = P(id);
  const r = p.progress.real.length;
  const c = p.progress.credits.length;
  return X.TalentProfile({
    name: p.name,
    sub: `Talent · ${archetypeLabel(p.archetype)} · in the Academy`,
    real: r,
    credits: c,
    headline: "One more counted week promotes " + p.name.split(" ")[0] + ".",
    line: `${X.progressWords(r, c)} out of the last eight. Promotion gives them a Live card in packs and a slot in the album.`,
    weeks: strip(p),
    ovr: p.ovr,
    tier: tierName(p.row.rarity_tier),
    fading: p.progress.fading ? h("span", null, h("b", null, `${L(p.progress.real[0])} drops off next week. `), "Without a game then, they fall below 2 and leave the Academy until they play again.") : undefined,
  });
}

const attrs = (p) => p.row;

function atRiskProfile() {
  at("/players");
  const p = P("p11");
  return X.CardProfile({
    name: p.name,
    sub: `${archetypeLabel(p.archetype)} · ${p.ovr} OVR · ${p.row.rarity_tier}`,
    player: card(p),
    attrs: attrs(p),
    stage: X.AtRiskBlock({ name: p.name, absent: p.clock.absent, toRetire: p.clock.toRetire, copies: W.OWNED.get(p.id) }),
  });
}

function retiredProfile(stamp = STAMP) {
  at("/players");
  const p = P("p13");
  return X.CardProfile({
    name: p.name,
    sub: `${archetypeLabel(p.archetype)} · ${p.ovr} OVR · ${p.row.rarity_tier} · Retired`,
    player: card(p),
    attrs: attrs(p),
    retired: true,
    stamp,
    since: L(p.clock.retiredWeek),
    stage: X.RetiredBlock({
      name: p.name,
      since: L(p.clock.retiredWeek),
      comeback: { real: p.progress.real.length, credits: p.progress.credits.length, line: "Back on 1 Feb, plus a credit. One more counted week returns Pim to the First Team, with the same card." },
    }),
  });
}

function home() {
  at("/");
  return X.HomePage({ newIn: { name: fenna.name, state: `First Team · ${promotedLine} · in packs`, href: `/players/${fenna.row.slug}` } });
}

const msg = (id, event_type, title, body, read = false) => ({ id, event_type, title, body, reference_type: null, reference_id: null, read_at: read ? "2027-02-02T08:00:00Z" : null, created_at: "2027-02-01T21:10:00Z" });

function messages() {
  at("/messages");
  const kees = P("p11");
  const olaf = P("p12");
  const open = msg("m1", "player_promoted", `${fenna.name} joins the First Team`, `Three weeks in the Academy earned a Live card: ${promotedLine}. It's in packs from today, and has a slot in your album.`);
  return X.MessagesPage({
    open,
    rows: [
      open,
      msg("m2", "player_at_risk", `${kees.name} is at risk of retiring`, `${kees.clock.absent} counted weeks without a game; at 12 they retire. Your ${W.OWNED.get("p11")} copies stay yours either way, but a Retired card can't play Midweek.`),
      msg("m3", "player_retired", `${olaf.name} has retired`, `12 counted weeks without a game. Your copy stays yours to keep or trade, but can't play Midweek. A comeback brings it back.`, true),
    ],
  });
}

function chronicle() {
  at("/chronicle");
  const olaf = P("p12");
  return X.ChronicleRoster({
    title: "Week of 1 Feb",
    dates: "Mon 1 to Sun 7 Feb 2027",
    rows: [
      { tag: { tone: "won", text: "Promoted" }, text: `${fenna.name} joins the First Team`, meta: `${promotedLine} · three weeks running` },
      { tag: { tone: "out", text: "Retired" }, text: `${olaf.name} retires`, meta: `12 counted weeks away · ${tierName(olaf.row.rarity_tier)} ${olaf.ovr}` },
      { tag: { tone: "you", text: "Back" }, text: `${P("p13").name} is back`, meta: "First game since retiring: 2 of 3 towards a comeback" },
    ],
  });
}

function packs() {
  at("/club/packs");
  return X.PacksNew({ name: fenna.name, line: `${promotedLine}, promoted this week. Every pack can hold the card.` });
}

function ownedAtRisk() {
  at("/club/collection");
  const p = P("p11");
  return X.OwnedCardPage({ name: p.name, sub: `Live card · ${p.ovr} OVR · ${tierName(p.row.rarity_tier)}`, player: card(p), discard: p.discard, block: X.AtRiskBlock({ name: p.name, absent: p.clock.absent, toRetire: p.clock.toRetire }) });
}

function ownedRetired() {
  at("/club/collection");
  const p = P("p12");
  return X.OwnedCardPage({ name: p.name, sub: `Live card · ${p.ovr} OVR · ${tierName(p.row.rarity_tier)}`, player: card(p), discard: p.discard, retired: true, since: L(p.clock.retiredWeek), block: X.RetiredBlock({ name: p.name, since: L(p.clock.retiredWeek) }) });
}

function album() {
  at("/club/collection");
  const ft = W.FIRST_TEAM;
  const unique = ft.filter((p) => W.OWNED.has(p.id)).length;
  return X.AlbumPage({
    unique,
    total: ft.length,
    cards: [...W.OWNED.values()].reduce((a, b) => a + b, 0),
    set: W.RETIRED.map((p) => ({ name: p.name, player: W.OWNED.has(p.id) ? card(p) : null, since: L(p.clock.retiredWeek) })),
  });
}

function listing() {
  at("/market");
  const p = P("p14");
  return X.ListingPage({ name: p.name, player: card(p), price: Math.max(p.discard + 6, 40), seller: "Joris", since: L(p.clock.retiredWeek), stamp: STAMP });
}

function picker() {
  at("/midweek/pick");
  const mine = ["p01", "p02", "p12", "p05", "p07", "p13"].map(P);
  // Saved: Anouk, Daan, Olaf, Iris. Olaf retired, so the survivors move up.
  const saved = ["p01", "p02", "p12", "p05"];
  const kept = saved.filter((id) => P(id).stage !== "retired");
  const open = [...Array(5 - kept.length)].map((_, i) => kept.length + i + 1);
  return X.PickerPage({
    notice: h("span", null, h("b", null, `${P("p12").name} is no longer available for Midweek. `), `Retired cards can't play. Your other picks moved up; slots ${open.join(" and ")} play a trialist until you pick again.`),
    rows: mine.map((p) => {
      const retired = p.stage === "retired";
      const picked = kept.includes(p.id) ? kept.indexOf(p.id) + 1 : undefined;
      return { name: p.name, meta: `${tierName(p.row.rarity_tier)} · OVR ${p.ovr}`, mini: { rarityTier: p.row.rarity_tier, ovr: p.ovr }, retired, picked };
    }),
  });
}

function lineup() {
  at("/midweek");
  const five = ["p01", "p02", "p05"].map(P);
  return X.LineupBoard({
    club: "Sanne's Club",
    fallback: "Sanne's trialist",
    rows: [
      ...five.map((p) => ({ name: p.name, meta: `${archetypeLabel(p.archetype)} · OVR ${p.ovr}`, mini: { rarityTier: p.row.rarity_tier, ovr: p.ovr } })),
      { name: P("t02").name, meta: "Academy · OVR 30", mini: null },
      { name: P("t04").name, meta: "Academy · OVR 30", mini: null },
    ],
  });
}

function attendance() {
  at("/admin/attendance");
  const ticked = new Set(["p01", "p02", "t01", "p13"]);
  const show = ["p01", "p02", "p03", "p05", "t01", "t02", "t03", "p13", "p14"].map(P);
  return X.AttendanceAddTalent({
    players: show.map((p) => ({ name: p.name, on: ticked.has(p.id), tag: p.stage === "talent" || p.newlyPromoted ? "Talent" : p.stage === "retired" ? "Retired" : undefined })),
    query: "Jip Willems",
    match: { name: P("t02").name, meta: `Talent since ${L(P("t02").attended[0])}; played once.` },
  });
}

function stageOf(p) {
  if (p.stage === "talent") return { tone: "auto", text: "Talent" };
  if (p.stage === "retired") return { tone: "out", text: "Retired" };
  if (p.newlyPromoted) return { tone: "won", text: "Promoted" };
  if (p.clock.atRisk) return { tone: "warn", text: "At risk" };
  return { tone: "neutral", text: "First Team" };
}
function clockOf(p) {
  if (p.stage === "talent") return `${X.progressWords(p.progress.real.length, p.progress.credits.length)}${p.progress.visible ? "" : " · not shown"}`;
  if (p.stage === "retired") return `Since ${L(p.clock.retiredWeek)} · comeback ${p.progress.real.length + p.progress.credits.length} of 3`;
  if (W.INJURED.has(p.id)) return "Paused (injured)";
  return p.clock.absent === 0 ? "Played this week" : `${p.clock.absent} weeks away`;
}

function roster(live) {
  at("/admin/roster");
  const ids = ["p01", "p11", "p15", "t01", "t02", "t03", "t04", "t05", "p12", "p13", "p14"];
  const rows = ids.map(P).map((p) => ({
    name: p.name,
    stage: live ? stageOf(p) : { tone: p.stage === "talent" && !p.newlyPromoted ? "auto" : "neutral", text: p.stage === "talent" && !p.newlyPromoted ? "Talent" : "First Team" },
    clock: live ? clockOf(p) : p.stage === "talent" ? clockOf(p) : "Starts at go-live",
    active: true,
    injury: W.INJURED.has(p.id) ? "Injured since 23 Nov" : "Mark injured…",
    actions: p.stage === "talent" || p.stage === "retired" ? ["Credit", p.stage === "talent" ? "Promote" : "Bring back", "Deactivate"] : ["Deactivate"],
  }));
  const pim = P("p13");
  const merel = P("t04");
  return X.AdminRoster({
    add: X.AddPlayerBlock({ stage: "Talent", credits: "0" }),
    live: live
      ? { on: true, line: "Live since the week of 19 Oct 2026. Promotions, warnings and retirements follow each publish." }
      : { on: false, line: "Off: members see no Academy, stages or Retired set yet. You can already add Talents and give them credits below, and mark unlinked Players injured." },
    rows: live ? rows : rows.filter((r) => !["Olaf G.", "Pim L.", "Wout Y."].includes(r.name)).map((r) => (r.name === "Fenna L." ? { ...r, stage: { tone: "auto", text: "Talent" } } : r)),
    detail: live
      ? X.TalentAdmin({ name: pim.name, kind: "retired", real: pim.progress.real.length, credits: pim.progress.credits.length, canPromote: true, lines: [`Retired in the week of ${L(pim.clock.retiredWeek)}.`, "Credit given 1 Feb (reason: played the cup friendly); expires after 8 counted weeks."] })
      : X.TalentAdmin({ name: merel.name, kind: "talent", real: merel.progress.real.length, credits: merel.progress.credits.length, canPromote: true, lines: ["Talent since 25 Jan.", "Credit given 25 Jan; expires after 8 counted weeks."] }),
  });
}

function addTalent() {
  at("/admin/roster");
  const jip = P("t02");
  return X.AddTalentPage({ add: X.AddPlayerBlock({ name: "Jip", stage: "Talent", credits: "2", match: { name: jip.name, meta: `Talent since ${L(jip.attended[0])}.` } }) });
}

function goLive() {
  at("/admin/roster");
  return X.GoLiveSheet({ week: "19 Oct" });
}

function faq() {
  at("/how-it-works");
  return X.FaqPage();
}

function stamps() {
  const sample = ["p12", "p13", "p14"].map(P);
  const regulars = ["p01", "p03"].map(P);
  return X.StampOptions({
    columns: [
      { key: "stamp", title: "A · The club stamp (recommended)", line: "Colours fade and a red rubber stamp sits across the art, in the band under the shirt number, where the cast writes: never across a face, a rating or the name. Reads at 140 px.", cards: [regulars[0], sample[0]].map(card), mini: { rarityTier: sample[0].row.rarity_tier, ovr: sample[0].ovr }, detail: card(sample[1]), since: L(sample[1].clock.retiredWeek) },
      { key: "sash", title: "B · The sash", line: "A black band across the top corner, like a testimonial shirt. Quieter, but it covers the pennant at grid size.", cards: [regulars[0], sample[0]].map(card), mini: { rarityTier: sample[0].row.rarity_tier, ovr: sample[0].ovr }, detail: card(sample[1]), since: L(sample[1].clock.retiredWeek) },
      { key: "plaque", title: "C · The clubhouse wall", line: "Sepia with a brass plaque over the name. Elegant, but every tier turns the same brown, so rarity reads only from the pennant.", cards: [regulars[1], sample[2]].map(card), mini: { rarityTier: sample[2].row.rarity_tier, ovr: sample[2].ovr }, detail: card(sample[1]), since: L(sample[1].clock.retiredWeek) },
    ],
  });
}

// ------------------------------------------------------------------- index ----

export const PAGES = [
  { id: "members", title: "Academy and stages" },
  { id: "moment", title: "Promotion moment" },
  { id: "retired", title: "At risk and Retired" },
  { id: "midweek", title: "Midweek" },
  { id: "admin", title: "Admin" },
];

const PHONE = [320, 412];
export const BOARDS = [
  { page: "members", stem: "A1-Players-Academy", title: "Players with the Academy", widths: [...PHONE, 1440], body: players, note: "/players after go-live. On a phone the Academy follows the First Team (owner feedback). It lists visible Talents (progress ≥ 2) and comebacks; Fading when the oldest week leaves the window next week. Lars (1 week) isn't shown. The grid is the First Team only; Retired is a row at the foot. On desktop the Academy sits beside the grid." },
  { page: "members", stem: "A2-Talent-Profile", title: "A Talent's profile", widths: [...PHONE, 1440], body: () => talent("t02"), note: "/players/jip-w. No card yet: three pips, the last eight counted weeks as a strip, and the rating they'd start from. Decision Q3: show a Talent's OVR." },
  { page: "members", stem: "A3-Talent-Fading", title: "A fading Talent", widths: [412], body: () => talent("t03"), note: "Sven: 30 Nov leaves the window at the next counted week, so without a game he drops below 2 and out of the Academy." },
  { page: "members", stem: "A4-Talent-Credit", title: "A Talent with a credit", widths: [412], body: () => talent("t04"), note: "Merel: one real week and one credit (a ring with +). A credit is never shown as a game." },
  { page: "moment", stem: "B1-Messages", title: "Messages: promoted, At risk, Retired", widths: PHONE, body: messages, note: "Three new event types. Promotion goes to every member; At risk and Retired go to owners of copies (listed or escrowed included). Keyed to the transition, so a re-run never re-sends. Decision Q4: promotion to everyone." },
  { page: "moment", stem: "B2-Home-NewIn", title: "Home in a promotion week", widths: [...PHONE, 1440], body: home, note: "The Now block stays whatever is due (here the Midweek pick). The promotion is a plain tile, 'New: Fenna L.', for the promotion week, linking to her profile. Decision Q5: a tile, not the Now block." },
  { page: "moment", stem: "B3-Chronicle-Roster", title: "The Chronicle's roster block", widths: [412], body: chronicle, note: "A dated fact, so a snapshot: the tier and OVR as of that week. Promotions, retirements and returns; At risk is a warning, not news, so it stays out." },
  { page: "moment", stem: "B4-Packs-NewIn", title: "Packs: new in packs", widths: [412], body: packs, note: "One inset above the offers for the promotion week. Pack prices and weights don't change (out of scope)." },
  { page: "retired", stem: "C1-Stamp-Options", title: "The Retired treatment: three directions", widths: [1200], body: stamps, note: "Decision Q1. The real LiveCard under a design-only overlay (academy.css). A is recommended: like the cast it is drawn on the card, it keeps the tier legible, and at 140 px it still says Retired. Every other board uses A." },
  { page: "retired", stem: "C2-Profile-AtRisk", title: "At risk on a profile", widths: [412, 1440], body: atRiskProfile, note: "Kees: 10 counted weeks away (warned at 8), 2 to go. No mark on the card itself: the warn tag sits on the Players grid and the block here." },
  { page: "retired", stem: "C3-Profile-Retired", title: "A Retired profile with a comeback", widths: [412, 1440], body: retiredProfile, note: "Pim retired on 25 Jan, played on 1 Feb and has a credit: comeback 2 of 3. The rating keeps decaying as today." },
  { page: "retired", stem: "C4-Retired-List", title: "The Retired list", widths: [412, 1440], body: retiredList, note: "/players/retired, the row at the foot of Players. Not in the OVR ranking or its filters." },
  { page: "retired", stem: "C5-Card-AtRisk", title: "Your copy, At risk", widths: [412], body: ownedAtRisk, note: "The collection card page. Discard value as today (the rating's own curve)." },
  { page: "retired", stem: "C6-Card-Retired", title: "Your copy, Retired", widths: [412], body: ownedRetired, note: "Still sellable and discardable; only Midweek and packs change." },
  { page: "retired", stem: "C7-Album-RetiredSet", title: "The album's Retired set", widths: [412, 1440], body: album, note: "Completion counts the First Team only. The Retired set follows the last page (and is a filter). Empty slots name the Player, since trading is the only way to fill them." },
  { page: "retired", stem: "C8-Listing-Retired", title: "A Retired card on the market", widths: [412], body: listing, note: "One line on the listing; no market rule changes. Price invented." },
  { page: "midweek", stem: "D1-Picker-Retired", title: "The picker after a pick retires", widths: PHONE, body: picker, note: "Olaf was saved in slot 3 and retired. The picker filters him from the five (picks move up) and shows him as Retired, not pickable. The lock and save enforce the same rule." },
  { page: "midweek", stem: "D2-Lineup-Trialists", title: "Named trialists (S5)", widths: [412], body: lineup, note: "After launch, trialist rows carry a visible Talent's name, frozen at the lock. Same OVR 30, same mini. Fallback '<manager>'s trialist' before go-live or with too few Talents." },
  { page: "admin", stem: "E1-Attendance-AddTalent", title: "Record attendance: add a Talent", widths: [...PHONE, 1440], body: attendance, note: "Talents and Retired Players are tickable with a small word. Typing a new name offers a similar existing Player first; adding never merges." },
  { page: "admin", stem: "E2-Roster-Live", title: "Roster after go-live", widths: [412, 1440], body: () => roster(true), note: "Stage and Clock columns. Promote/Bring back and Credit for Talents and Retired; a First Team row has neither (a no-op). The detail block opens from a row." },
  { page: "admin", stem: "E3-Roster-BeforeGoLive", title: "Roster before go-live", widths: [412, 1440], body: () => roster(false), note: "The Academy block is the brass one: go-live is due. Talents and credits already work; clocks show 'Starts at go-live'." },
  { page: "admin", stem: "E6-Roster-AddTalent", title: "Add a Talent on the roster, with credits", widths: PHONE, body: addTalent, note: "Owner feedback: add Talents and give credits without a session. Starts as Talent (the default) or First Team; a Talent can start with 0 to 2 credits and a reason. A similar existing name is offered first. A Talent with 2 credits and no game shows in the Academy (progress 2) and is promoted at their first counted week." },
  { page: "admin", stem: "E4-GoLive-Confirm", title: "Go live: the confirmation", widths: PHONE, body: goLive, note: "Always the current football week; no backdating, no undo." },
  { page: "admin", stem: "E5-FAQ", title: "How it works: the FAQ change", widths: [412], body: faq, note: "Two questions in Cards and ratings (#academy, #retired), so the FAQ stays six topics (ADR-161), and one line in Midweek on named trialists. Credits aren't explained to members (owner, Q7)." },
];
