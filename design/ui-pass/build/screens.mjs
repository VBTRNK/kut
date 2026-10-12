// The DR5 boards (S2): which page, at which moment, with which data. Every
// number and line comes from the app's own functions over the sample week
// stored as rows (world.mjs): assembleBracket, myNight, eveningPhase,
// firstMatch, liveView, reportInputFromRows, renderStoredReport, matchRatings,
// nightRatings, latestMatchRatings, callCards, settledStatus, preMatchSide,
// lineCount, lastWeekSummary, finishStat, finalLine, countdownText. The only
// invented inputs are Sanne's calls and the club's split on them (members'
// choices, which no function computes); they are marked where they are made.
import { src, mock, h } from "./source.mjs";
import * as W from "./world.mjs";

const P = mock("pages.tsx");
const M = mock("midweek.tsx");
const R = mock("report.tsx");
const E = src("lib/midweek/evening.ts");
const entry = src("lib/midweek/entry.ts");
const { liveView } = src("lib/midweek/live.ts");
const { kickItems, shootoutStory } = src("lib/midweek/report/kicks.ts");
const { reportInputFromRows, renderStoredReport } = src("lib/midweek/report/from-db.ts");
const { matchRatings } = src("lib/midweek/report/ratings.ts");
const NR = src("lib/midweek/night-ratings.ts");
const C = src("lib/midweek/calls.ts");
const { preMatchSide, preMatchHref } = src("lib/midweek/prematch.ts");
const { predictionCoins } = src("game/midweek/rewards.ts");
const PL = src("lib/midweek/plusses.ts");
const { strongestCopies } = src("lib/midweek/copies.ts");
const { getRarityTier } = src("game/rating-engine.ts");
const { archetypeLabel } = src("game/archetypes.ts");
const { MIDWEEK } = src("game/midweek/config.ts");
const { sideClub } = src("lib/midweek/rows.ts");
const { lockAt: lockFor } = src("game/midweek/schedule.ts");

const ROUNDS = W.ROUNDS;
const WEEK = W.WEEK_START;
const BASE = `/midweek/${WEEK}`;
const SANNE = W.SANNE;
const time = W.time;
const clock = (d) => d.toLocaleTimeString("en-GB", { timeZone: "Europe/Amsterdam", hour12: false });
const roundName = (r) => E.roundName(r, ROUNDS);
const PER_CALL = predictionCoins(ROUNDS);
const tierOf = (ovr) => getRarityTier(ovr);

// ------------------------------------------------------------ the evening ----

function evening(now) {
  const v = W.at(now);
  const night = E.myNight({ userId: SANNE, rounds: ROUNDS, lockAt: W.LOCK, scheduleVersion: W.VERSION, matches: v.matches });
  const phase = E.eveningPhase({ rounds: ROUNDS, lockAt: W.LOCK, scheduleVersion: W.VERSION, now, night });
  const bracket = E.assembleBracket({
    rounds: ROUNDS,
    lockAt: W.LOCK,
    scheduleVersion: W.VERSION,
    draw: v.draw,
    matches: v.matches,
    autoUserIds: v.autoUserIds,
    live: { events: v.events, now },
  });
  return { v, night, phase, bracket, now };
}

const whole = (id) => W.at(time("23:59:00")).whole.find((row) => row.match_id === id);
const fullEntries = W.at(time("23:59:00")).entries;
const allEvents = W.at(time("23:59:00")).allEvents;

/** The report the server renders for a match (as `loadLiveMatch` and the report page do). */
function reportOf(id, ownersPublished) {
  const input = reportInputFromRows({
    seedHash: W.S.hash,
    rounds: ROUNDS,
    match: whole(id),
    events: allEvents.filter((e) => e.match_id === id),
    entries: fullEntries,
    ownersPublished,
  });
  return { input, report: renderStoredReport(input) };
}

const youOf = (row) => (row.side_0_user_id === SANNE ? 0 : row.side_1_user_id === SANNE ? 1 : null);
const clubsOf = (row) => [sideClub(row, 0), sideClub(row, 1)];
const autoOf = (row, v) => [v.autoUserIds.has(row.side_0_user_id), v.autoUserIds.has(row.side_1_user_id ?? "")];

function liveOf(id, now) {
  const row = whole(id);
  const { report } = reportOf(id, false);
  const view = liveView({
    timeline: report.timeline,
    kicks: report.shootout?.kicks ?? [],
    kickoffAt: row.reveal_at,
    scheduleVersion: W.VERSION,
    now,
  });
  const why = report.why.map((side) => ({ ...side, cards: side.cards.map((c) => ({ ...c, goals: 0, assists: 0 })) }));
  return { row, view, why, kicks: kickItems(view.kicks) };
}

// Sanne's calls and the club's split on them: invented member choices (see top).
const PREDICTIONS = [
  { round: 4, pairing: 0, predicted_user_id: W.idOf("Niels"), predicted_name: "Niels", saved_at: time("20:35:02").toISOString() },
  { round: 5, pairing: 0, predicted_user_id: W.idOf("Joris"), predicted_name: "Joris", saved_at: time("20:52:40").toISOString() },
].map((row) => ({ tournament_id: W.TOURNAMENT, week_start: WEEK, correct: null, ...row }));
const SPLITS = [
  { round: 4, pairing: 0, side_0_picks: 6, side_1_picks: 4 },
  { round: 4, pairing: 1, side_0_picks: 3, side_1_picks: 8 },
  { round: 5, pairing: 0, side_0_picks: 2, side_1_picks: 10 },
].map((row) => ({ match_id: W.matchId(row.round, row.pairing), tournament_id: W.TOURNAMENT, ...row }));

function callsAt(ev) {
  const predictions = PREDICTIONS.filter((row) => Date.parse(row.saved_at) <= ev.now.getTime());
  const cards = C.callCards({ bracket: ev.bracket, night: ev.night, predictions, splits: SPLITS, now: ev.now });
  return cards ?? [];
}

// ------------------------------------------------------------------ tiles ----

const PAST = { title: "Past weeks", state: "Every week’s result", href: "/midweek/past" };
const YOUR_FIVE = { title: "Your five", state: "Locked at 19:55", href: "/midweek/pick" };

function bracketTile(ev) {
  const live = ev.bracket.find((round) => round.pairs.some((pair) => pair.kind === "inplay"));
  if (live) {
    const n = live.pairs.filter((pair) => pair.kind === "inplay").length;
    return { title: "Bracket", state: `${live.name} · ${n} live`, href: `${BASE}/bracket`, tone: "live" };
  }
  const next = ev.bracket.find((round) => Date.parse(round.kickoffAt) > ev.now.getTime());
  return { title: "Bracket", state: next ? `${next.name} at ${entry.formatClock(next.kickoffAt)}` : "Complete", href: `${BASE}/bracket` };
}

function nightTile(ev) {
  const last = ev.night.rows.at(-1);
  const state = !last
    ? `Starts ${entry.formatClock(ev.bracket[0].kickoffAt)}`
    : last.kind === "live"
      ? `${roundName(last.round)} now · win +${last.coins}`
      : last.kind === "next"
        ? `Through · +${ev.night.coins} so far`
        : `+${ev.night.coins} so far`;
  return { title: "Your night", state, href: `${BASE}/night` };
}

function callsTile(cards) {
  const open = cards.filter((card) => card.state === "open").length;
  const right = C.callsRight(cards);
  return {
    title: "Calls",
    state: open > 0 ? `${open} open` : right > 0 ? `${right} right so far` : "Nothing open",
    href: `${BASE}/calls`,
    tone: open > 0 ? "now" : "plain",
  };
}

// ------------------------------------------------- next week, before the lock ----

// Mon 12 Oct, 12:00: next week is open for picking; the sample week is last week.
const PICK_NOW = new Date("2026-10-12T12:00:00+02:00");
const NEXT_LOCK = lockFor("2026-10-12");
const countdown = entry.countdownText(NEXT_LOCK, PICK_NOW);
const pickSub = `${entry.formatDayDate(NEXT_LOCK.toISOString())} · locks ${entry.formatClock(NEXT_LOCK.toISOString())}`;

const sanneEntry = W.S.tournament.entries.find((e) => e.userId === SANNE);
// The picker boards use Julia's collection: Sanne owns no Goalkeeper, so her
// picker never shows the plusses count (DR3-8).
const PICKER = W.idOf("Julia");
const sanneOwned = W.S.entrants.find((e) => e.userId === PICKER).owned;
const PLAYER = (id) => W.S.directory.player(id);
const ownedRows = sanneOwned.map((card) => ({ card_id: card.cardId, player_id: card.playerId, is_live: true, ovr: card.ovr, archetype: card.archetype, injured: card.injured }));
const tiles = strongestCopies(ownedRows, new Set(ownedRows.filter((c) => c.injured).map((c) => c.player_id))).sort(
  (a, b) => b.card.ovr - a.card.ovr || PLAYER(a.card.player_id).localeCompare(PLAYER(b.card.player_id)),
);
const pickCard = ({ card, copies }) => {
  const tier = tierOf(card.ovr);
  return {
    playerId: card.player_id,
    name: PLAYER(card.player_id),
    meta: `${archetypeLabel(card.archetype)} · ${E.TIER_LABEL[tier]} · OVR ${card.ovr}${card.injured ? " · injured" : ""}`,
    slotMeta: `${archetypeLabel(card.archetype)} · OVR ${card.ovr}`,
    plusses: PL.plussesLine(card.archetype)?.text ?? null,
    mini: { rarityTier: tier, ovr: card.ovr, injured: card.injured },
    face: E.entryCardFace({ player_id: card.player_id, player_name: PLAYER(card.player_id), ovr: card.ovr, archetype: card.archetype, injured: card.injured, photo_path: null }, new Map()),
    copies,
    archetype: card.archetype,
  };
};
const PICKS = tiles.map(pickCard);
const KEEPER = PICKS.filter((c) => c.archetype === "goalkeeper").slice(0, 1);
const OUTFIELD = PICKS.filter((c) => c.archetype !== "goalkeeper");
const savedIds = [...KEEPER, ...OUTFIELD.slice(0, 4)].map((c) => c.playerId);

function pickerProps(chosenIds, status) {
  const chosen = PICKS.filter((card) => chosenIds.includes(card.playerId));
  const slots = Array.from({ length: MIDWEEK.squadSize }, (_, i) => chosen[i] ?? null);
  const count = PL.lineCount(slots.map((card) => (card ? { archetype: card.archetype, displayName: card.name } : null)));
  const plusses =
    count.kind === "nokeeper"
      ? { lines: null, short: null, verdict: "Add a Goalkeeper to see your count.", keeper: null }
      : (() => {
          const verdict = PL.lineVerdict(count);
          return { lines: count.lines, short: count.short, verdict: `${verdict.lead} ${verdict.rest}`, keeper: PL.keeperLine(count) };
        })();
  return {
    sub: pickSub,
    status,
    saveLine:
      status === "saved"
        ? "Saved Mon 12 Oct, 09:41. Change them until Wed 19:55."
        : status === "dirty"
          ? "Save to make it count."
          : "Not picked: an auto squad plays.",
    slots: slots.map((card) => (card ? { name: card.name, meta: card.slotMeta, mini: card.mini } : null)),
    plusses,
    rows: PICKS.map((card) => ({ ...card, in: chosenIds.includes(card.playerId) })),
    lastWeek: true,
    grid: true,
  };
}

const lastWeekLine = (() => {
  const night = E.myNight({ userId: SANNE, rounds: ROUNDS, lockAt: W.LOCK, scheduleVersion: W.VERSION, matches: W.at(time("23:59:00")).matches });
  const rewards = night.rows.filter((row) => row.kind === "won" || row.kind === "bye").map((row) => ({ round_no: row.round, amount: row.coins }));
  // The tile's state is short; lastWeekSummary's full sentence stays the past week's.
  const out = night.rows.find((row) => row.kind === "out");
  return `Out in the ${roundName(out.round).toLowerCase()} · +${rewards.reduce((sum, row) => sum + row.amount, 0)}`;
})();

const BEFORE_TILES = [
  { title: "Last week", state: lastWeekLine, href: BASE },
  { title: "Bracket", state: `Drawn at ${entry.formatClock(NEXT_LOCK.toISOString())}` },
  PAST,
  { title: "How it works", state: "Plusses, Power, ratings", href: "/how-it-works#midweek" },
];

function hubBefore(saved) {
  const cards = saved ? sanneEntry.cards.map((c) => (c.trialist ? null : { rarityTier: tierOf(c.ovr), ovr: c.ovr, injured: c.injured })) : [null, null, null, null, null];
  return P.HubPage({
    live: false,
    status: saved ? null : "pick",
    title: "Midweek Madness",
    sub: pickSub,
    now: M.NowFive({ cards, saved, countdown, savedLine: "Saved Mon 12 Oct, 09:41. Change them until Wed 19:55." }),
    tiles: BEFORE_TILES,
  });
}

// ------------------------------------------------------------ evening hubs ----

function hubDraw() {
  const ev = evening(time("19:57:00"));
  const first = E.firstMatch({ userId: SANNE, draw: ev.v.draw, rounds: ROUNDS, lockAt: W.LOCK, scheduleVersion: W.VERSION });
  const five = (id) => {
    const view = E.fiveOf(ev.v.entries, id);
    return { label: id === SANNE ? "Your five" : `${W.club(id)}`, you: id === SANNE, cards: view.cards.map((c) => c.mini), auto: view.auto };
  };
  return P.HubPage({
    live: false,
    status: "live",
    title: "Midweek Madness",
    sub: `Wed 7 Oct · ${ev.phase.title.toLowerCase()}`,
    now: M.NowDraw({
      title: first.round === 1 ? "Your first match" : "Your first match",
      sub: `${roundName(first.round)} · ${entry.formatClock(first.kickoffAt)}`,
      text: first.text,
      fives: [five(SANNE), ...first.opponentIds.map(five)],
    }),
    tiles: [nightTile(ev), bracketTile(ev), YOUR_FIVE, PAST],
  });
}

function hubLive(hms, final) {
  const ev = evening(time(hms));
  const round = final ? ROUNDS : ev.phase.round;
  const pair = ev.bracket[round - 1].pairs.find((p) => p.kind === "inplay" && (final || p.sides.some((s) => s.userId === SANNE)));
  const l = liveOf(pair.match.match_id, ev.now);
  const cards = callsAt(ev);
  return P.HubPage({
    live: true,
    status: "live",
    title: "Midweek Madness",
    sub: `Wed 7 Oct · ${ev.phase.title.toLowerCase()}`,
    now: M.NowMatch({
      title: final ? "The final" : "Your match",
      clubs: clubsOf(l.row),
      goals: l.view.score,
      live: { minute: l.view.minute, penalties: l.view.penalties },
      youSide: youOf(l.row),
      href: `${BASE}/match/${l.row.match_id}`,
    }),
    tiles: [ev.night.rows.some((r) => r.kind === "out") ? callsTile(cards) : nightTile(ev), bracketTile(ev), YOUR_FIVE, PAST],
  });
}

function hubBetween() {
  const ev = evening(time("20:20:10"));
  const next = ev.night.rows.find((row) => row.kind === "next");
  const pair = ev.bracket[next.round - 1].pairs[next.pairing];
  const href = pair.kind === "upcoming" && pair.preMatch ? preMatchHref(WEEK, next.round, next.pairing) : null;
  return P.HubPage({
    live: true,
    status: "live",
    title: "Midweek Madness",
    sub: `Wed 7 Oct · ${ev.phase.title.toLowerCase()}`,
    now: M.NowNext({
      clubs: [pair.sides[0].name, pair.sides[1].name],
      sub: `${roundName(next.round)} · ${entry.formatClock(next.revealAt)}`,
      countdown: entry.countdownText(new Date(next.revealAt), ev.now),
      preMatch: href,
      waiting: href ? null : "Its pre-match opens when the other match ends.",
    }),
    tiles: [nightTile(ev), bracketTile(ev), YOUR_FIVE, PAST],
  });
}

function hubOut() {
  const ev = evening(time("20:35:10"));
  const out = ev.night.rows.find((row) => row.kind === "out");
  const cards = callsAt(ev);
  return P.HubPage({
    live: true,
    status: "live",
    title: "Midweek Madness",
    sub: `Wed 7 Oct · ${ev.phase.title.toLowerCase()}`,
    now: M.NowOut({
      line: `Lost to ${out.opponent} ${out.score} in the ${roundName(out.round).toLowerCase()}.`,
      coins: `+${ev.night.coins} · paid after the final`,
      open: cards.filter((card) => card.state === "open").length,
      href: `${BASE}/calls`,
    }),
    tiles: [callsTile(cards), bracketTile(ev), YOUR_FIVE, PAST],
  });
}

function completeData() {
  const ev = evening(time("21:08:00"));
  const final = ev.v.matches.find((m) => m.round === ROUNDS && !m.bye);
  const finish = E.finishStat(ev.night, ROUNDS);
  const cards = callsAt(ev);
  const right = C.callsRight(cards);
  const championId = W.S.tournament.championUserId;
  const champ = E.fiveOf(fullEntries, championId);
  return {
    ev,
    final,
    champion: W.club(championId),
    result: (next) =>
      M.NowResult({
        coins: `+${ev.night.coins + right * PER_CALL}`,
        coinsNote: `${ev.night.coins} for wins, ${right * PER_CALL} for calls`,
        finish: finish.value,
        finishNote: finish.note,
        next,
      }),
    championBlock: M.ChampionBlock({
      line: `${W.club(championId)}. ${E.finalLine(final)}`,
      href: `${BASE}/match/${final.match_id}`,
      cards: champ.cards.map((c) => c.mini),
      label: `${W.account(championId)}’s five`,
    }),
    tiles: [
      { title: "Your night", state: `+${ev.night.coins} · your ratings`, href: `${BASE}/night` },
      { title: "Bracket", state: `Won by ${W.club(championId)}`, href: `${BASE}/bracket` },
      { title: "Calls", state: `${right} of ${cards.filter((c) => c.pick !== null).length} right`, href: `${BASE}/calls` },
    ],
    cards,
  };
}

function hubComplete() {
  const d = completeData();
  return P.HubPage({
    live: false,
    status: null,
    title: `${d.champion} are champions`,
    sub: "Midweek Madness · Wed 7 Oct",
    now: d.result({ line: `Next Wednesday is open: ${entry.formatDayDate(NEXT_LOCK.toISOString())}, locks ${entry.formatClock(NEXT_LOCK.toISOString())}.`, href: "/midweek/pick" }),
    extra: d.championBlock,
    tiles: [...d.tiles, PAST],
  });
}

function weekPast() {
  const d = completeData();
  return P.WeekPage({
    title: "Wed 7 Oct",
    sub: `Midweek Madness · ${d.champion} won it`,
    result: d.result(null),
    champion: d.championBlock,
    tiles: [...d.tiles, { title: "Who picked whom", state: "Owners and picks", href: `${BASE}/picks` }],
    seal: W.S.hash,
  });
}

// ------------------------------------------------------------- the pages ----

function bracketPage(hms, withTree) {
  const ev = evening(time(hms));
  const Bracket = src("components/midweek/bracket.tsx").MidweekBracket;
  return P.BracketPage({
    sub: `Wed 7 Oct · ${ev.phase.title.toLowerCase()}`,
    rounds: [...ev.bracket].reverse().filter((round) => Date.parse(round.kickoffAt) <= ev.now.getTime() + 15 * 60_000),
    you: SANNE,
    weekStart: WEEK,
    now: ev.now,
    tree: withTree ? h(Bracket, { rounds: ev.bracket, you: SANNE, weekStart: WEEK }) : undefined,
    calls: C.rowCalls(callsAt(ev)),
  });
}

function ratedRowsMatch(rated) {
  return rated.cards.map((card) => ({ name: card.name, meta: card.meta, line: null, mini: card.mini, rating: card.rating, best: false }));
}

function nightPage(hms) {
  const ev = evening(time(hms));
  const complete = ev.v.status === "complete";
  const entries = ev.v.entries;
  let ratings = null;
  if (complete) {
    const night = NR.nightRatings({ seedHash: W.S.hash, userId: SANNE, rounds: ROUNDS, weekStart: WEEK, matches: ev.v.matches, events: ev.v.events, entries, photoUrls: new Map() });
    ratings = {
      title: "Your five’s ratings",
      sub: `Mean of ${night.matchCount} matches`,
      rows: night.cards.map((card) => ({ name: card.name, meta: card.meta, line: card.line, mini: card.mini, rating: card.rating, best: card.best })),
      context: "for the night",
    };
  } else {
    const rated = NR.latestMatchRatings({ seedHash: W.S.hash, userId: SANNE, rounds: ROUNDS, weekStart: WEEK, matches: ev.v.matches, events: ev.v.events, entries });
    if (rated) ratings = { title: `Against ${rated.opponent}`, sub: `${rated.round} · out of 10`, rows: ratedRowsMatch(rated), context: "for this match", href: rated.href };
  }
  const cards = callsAt(ev);
  const right = C.callsRight(cards);
  const picks = cards.filter((c) => c.pick !== null).length;
  return P.NightPage({
    sub: complete ? "Wed 7 Oct · complete" : `Wed 7 Oct · ${ev.phase.title.toLowerCase()}`,
    status: complete ? null : "live",
    path: ev.night.rows,
    rounds: ROUNDS,
    roundName,
    weekStart: WEEK,
    preMatch: null,
    coins: complete ? `+${ev.night.coins} paid` : `+${ev.night.coins} · paid after the final`,
    ratings,
    calls: complete && picks > 0 ? { line: C.weeklyCallsLine(right, picks, PER_CALL), href: `${BASE}/calls` } : null,
    share: complete,
  });
}

/** Where a call leads (owner, 12 Oct): its pre-match while open, the match live, the report once ended. */
function callLink(card, ev) {
  const pair = ev.bracket[card.round - 1].pairs[card.pairing];
  if (pair.kind === "upcoming") return pair.preMatch ? { label: "Pre-match", href: preMatchHref(WEEK, card.round, card.pairing) } : null;
  if (pair.kind === "inplay") return { label: "Watch it", href: `${BASE}/match/${pair.match.match_id}` };
  if (pair.kind === "played") return { label: "Report", href: `${BASE}/match/${pair.match.match_id}` };
  return null;
}

function callsPage(hms) {
  const ev = evening(time(hms));
  const cards = callsAt(ev);
  return P.CallsPage({
    sub: `Wed 7 Oct · +${PER_CALL} ${"FLUT Coins"} a correct call, paid after the final`,
    cards: cards.map((card) => ({ card, status: C.settledStatus(card, false, PER_CALL), live: card.live, link: callLink(card, ev) })),
  });
}

/** A pre-match: yours between rounds, or (out) one you can call, with its call block on top (DR4-7). */
function preMatchPage(hms, round, pairing) {
  const ev = evening(time(hms));
  const pair = ev.bracket[round - 1].pairs[pairing];
  const ids = [pair.sides[0].userId, pair.sides[1].userId];
  const sides = ids.map((id) => preMatchSide(ev.v.entries, id));
  const card = callsAt(ev).find((c) => c.round === round && c.pairing === pairing) ?? null;
  return P.PreMatchPage({
    title: `${pair.sides[0].name} v ${pair.sides[1].name}`,
    sub: `${E.capitalise(E.matchName(round, pairing, ROUNDS))} · kick-off ${entry.formatClock(pair.kickoffAt)}, ${entry.countdownText(new Date(pair.kickoffAt), ev.now)}`,
    sides,
    youSide: ids[0] === SANNE ? 0 : ids[1] === SANNE ? 1 : null,
    call: card ? { card, status: C.settledStatus(card, false, PER_CALL) } : null,
    updated: `Updated ${clock(ev.now)}`,
  });
}

// ------------------------------------------------------------------ report ----

function reportFullTime(id, tab) {
  const { input, report } = reportOf(id, false);
  const row = whole(id);
  const v = W.at(time("23:59:00"));
  const story = report.shootout ? shootoutStory(report.shootout) : null;
  const you = youOf(row);
  return P.ReportPage({
    back: `${BASE}/bracket`,
    headline: report.headlineParts,
    sub: `${E.capitalise(E.matchName(row.round, row.pairing, ROUNDS))} · full time${you !== null ? " · your match" : ""}`,
    clubs: clubsOf(row),
    goals: input.outcome.goals,
    penalties: input.outcome.penalties,
    winnerSide: input.outcome.winnerSide,
    youSide: you,
    auto: autoOf(row, v),
    live: null,
    tab,
    base: `${BASE}/match/${id}`,
    facts: report.facts,
    timeline: report.timeline,
    kicks: [],
    shootout: story ? { intro: story.intro, story: story.kicks, toss: story.toss } : null,
    liveShootout: false,
    kickoffAt: row.reveal_at,
    why: report.why,
    ratings: matchRatings(input).map((side) => side.map((card) => card.rating)),
    foot: null,
  });
}

function reportLive(id, hms, tab) {
  const now = time(hms);
  const l = liveOf(id, now);
  const v = W.at(now);
  const you = youOf(l.row);
  const final = l.row.round === ROUNDS;
  const shootout = l.view.shootout && l.view.penalties !== null;
  return P.ReportPage({
    back: `${BASE}/bracket`,
    headline: `${clubsOf(l.row)[0]} v ${clubsOf(l.row)[1]}`,
    sub: final ? "The final · live" : `${E.capitalise(E.matchName(l.row.round, l.row.pairing, ROUNDS))} · live${you !== null ? " · your match" : ""}`,
    clubs: clubsOf(l.row),
    goals: l.view.score,
    penalties: null,
    winnerSide: null,
    youSide: you,
    auto: autoOf(l.row, v),
    live: { minute: l.view.minute, penalties: l.view.penalties },
    tab,
    base: `${BASE}/match/${id}`,
    facts: [],
    timeline: l.view.timeline,
    kicks: l.kicks,
    shootout: null,
    liveShootout: shootout,
    kickoffAt: l.row.reveal_at,
    why: l.why,
    ratings: null,
    foot: `Updated ${clock(now)} · checks every ${shootout ? 5 : 10} seconds`,
  });
}

// ------------------------------------------------------------- home entry ----

function homeEntry() {
  const live = liveOf(W.matchId(3, 1), time("20:33:20"));
  const d = completeData();
  return P.HomeEntryBoard({
    states: [
      {
        label: "Before the lock, not picked",
        note: "Today's brass Now card, on the scale: one primary button, the countdown on the right.",
        body: P.HomeEntry({
          title: "Pick your five",
          aside: h("p", { className: "text-small font-semibold text-brass" }, `Locks ${countdown}`),
          line: `Midweek Madness, ${entry.formatDayDate(NEXT_LOCK.toISOString())}. Not picked yet, so an auto squad would play.`,
          button: { label: "Pick your five", href: "/midweek/pick" },
        }),
      },
      {
        label: "Your match live · 20:33",
        note: "The scoreboard without tags, the minute; Home doesn't poll (Q11), so no feed.",
        body: P.HomeEntry({
          title: "Your match",
          aside: null,
          line: "Quarter-finals live. Watch it chance by chance.",
          button: { label: "Watch it", href: `${BASE}/match/${live.row.match_id}` },
          children: R.MatchScoreboard({
            clubs: clubsOf(live.row),
            goals: live.view.score,
            live: { minute: live.view.minute, penalties: null },
            youSide: youOf(live.row),
            auto: [false, false],
            compact: true,
          }),
        }),
      },
      {
        label: "After the final · 21:08",
        note: "Plain, not brass: nothing is due. The champion leads Midweek until Thursday 23:59 (D4).",
        body: P.HomeEntry({
          title: `${d.champion} are champions`,
          aside: null,
          line: `You went out in the quarter-finals: +${d.ev.night.coins} paid.`,
          button: { label: "Midweek", href: "/midweek" },
          tone: "plain",
        }),
      },
    ],
  });
}

// --------------------------------------------------------- before / after ----

function beforeAfter() {
  const id = W.matchId(3, 2);
  const { input, report } = reportOf(id, false);
  const row = whole(id);
  const old = src("components/midweek/report.tsx");
  const { ReportText: OldText } = src("components/midweek/player-name.tsx");
  const clubs = clubsOf(row);
  const short = report.timeline.slice(0, 4);
  const before = h(
    "div",
    { className: "grid w-[412px] content-start gap-5 bg-board p-5" },
    h("a", { className: "justify-self-start text-sm font-bold text-brass", href: "#" }, "← Wed 7 Oct bracket"),
    h("p", { className: "text-[0.7rem] font-extrabold tracking-[0.26em] text-brass uppercase" }, "Quarter-final 3 · out at 20:30"),
    h("h1", { className: "display text-[30px] text-pretty" }, h(OldText, { parts: report.headlineParts })),
    h(old.MidweekScoreboard, { auto: autoOf(row, W.at(time("23:59:00"))), goals: input.outcome.goals, clubs, penalties: input.outcome.penalties, winnerSide: input.outcome.winnerSide, youSide: null }),
    h(
      "ul",
      { className: "grid gap-1.5" },
      report.facts.map((fact, i) => h("li", { key: i, className: "border-l-2 border-brass-line pl-3 font-serif text-lg leading-[1.35] text-pretty text-ink" }, h(OldText, { parts: fact.parts }))),
    ),
    h("h2", { className: "display text-3xl" }, "How it went"),
    h(old.MidweekLaneTimeline, { clubs, timeline: short }),
  );
  const after = h(
    "div",
    { className: "grid w-[412px] content-start gap-6 bg-board p-4" },
    h(mock("ui.tsx").PageHeader, { back: { href: "#", label: "Bracket" }, sub: "Quarter-final 3 · full time", title: h(R.ReportText, { parts: report.headlineParts, plain: true }) }),
    h(R.MatchScoreboard, { auto: autoOf(row, W.at(time("23:59:00"))), goals: input.outcome.goals, clubs, penalties: input.outcome.penalties, winnerSide: input.outcome.winnerSide, youSide: null }),
    h(R.ReportTabs, { active: "match", base: "#" }),
    h(
      "ul",
      { className: "grid list-disc gap-2 pl-5 text-body marker:text-ink-faint" },
      report.facts.map((fact, i) => h("li", { key: i, className: "text-pretty" }, h(R.ReportText, { parts: fact.parts }))),
    ),
    h(R.Timeline, { clubs, timeline: short }),
  );
  return h(
    "div",
    { className: "flex gap-10 bg-board-deep p-8 text-ink" },
    h(P.BeforeAfter, { label: "Before: today's report at 412 px (the real components). A serif headline in two team colours, a tracked kicker, serif facts on brass rails, bold coloured names, every moment a tinted box." }, before),
    h(P.BeforeAfter, { label: "After: the same report on the DR5 scale. Plain headline, Small context, Body facts and moments, names in team colour at regular weight, a rail per moment, Match · Teams." }, after),
  );
}

// ------------------------------------------------------------------- boards ----

export const PAGES = [
  { id: "found", name: "A · Foundations" },
  { id: "hub", name: "B · Midweek hub (C2)" },
  { id: "pick", name: "C · The picker" },
  { id: "evening", name: "D · The evening's pages" },
  { id: "past", name: "E · After the final, a past week, Home" },
  { id: "report", name: "F · The match report (E2)" },
];

const QF2 = W.matchId(3, 1);
const QF3 = W.matchId(3, 2);
const R2E = W.matchId(2, 3);

export const BOARDS = [
  {
    stem: "A1-Foundations",
    page: "found",
    widths: [1200],
    title: "Foundations: scale, weights, spacing, surfaces, primitives",
    note: "The DR5 rules as code. Six text roles become six tokens (`text-title` … `text-label`), so S4 can forbid any other size outside the card. The primitives are TSX in design/ui-pass's generator, named with their props, ready for `src/components/ui/`.",
    body: () => P.FoundationsBoard(),
  },
  {
    stem: "A2-Before-After-Report",
    page: "found",
    widths: [944],
    title: "Before and after: the report's top at 412 px",
    note: "Quarter-final 3 at full time, the same renderer lines both sides. Left: the real components as they are today. Right: DR5. Measured in this crop: before 10 sizes, 15 type voices, 10 text colours; after 5 sizes, 7 voices, 7 colours. The whole Match tab at 412 px: 6 sizes, 10 voices, 7 colours (S1 measured 13, 21 and 13 for today's report).",
    body: () => beforeAfter(),
  },
  {
    stem: "B1-Hub-Pick",
    page: "hub",
    widths: [320, 412, 1440],
    title: "/midweek before the lock, not picked · Mon 12 Oct",
    note: "The Now block is brass (it needs you): five empty slots, the countdown, one primary button to /midweek/pick. Tiles: Last week (lastWeekSummary), Bracket (not a place until the draw, so a dashed tile without a link), Past weeks, How it works. From lg the tiles sit beside the block.",
    body: () => hubBefore(false),
  },
  {
    stem: "B2-Hub-Saved",
    page: "hub",
    widths: [320, 412],
    title: "/midweek before the lock, saved · Mon 12 Oct",
    note: "Saved: the block turns plain (nothing is due), the five as mini cards, Change your five as a secondary button.",
    body: () => hubBefore(true),
  },
  {
    stem: "B3-Hub-Draw",
    page: "hub",
    widths: [320, 412],
    title: "/midweek at the draw · 19:57",
    note: "From the lock to round 1: your first match (firstMatch). Sanne has a bye, so both possible round-2 opponents' fives, as mini cards. Tiles switch to the evening's set and stay put until the final (DR5-1).",
    body: () => hubDraw(),
  },
  {
    stem: "B4-Hub-Between",
    page: "hub",
    widths: [320, 412],
    title: "/midweek between rounds · 20:20:10",
    note: "Through to the quarter-finals; two round-2 shoot-outs still running. The Now block: your next match, its countdown, the pre-match as the primary (open: both feeders ended, DR4-7).",
    body: () => hubBetween(),
  },
  {
    stem: "B5-Hub-YourMatch",
    page: "hub",
    widths: [320, 412, 1440],
    title: "/midweek while your match plays · 20:33:20",
    note: "Your quarter-final at 64′: the scoreboard (team colours, one match open, DR2-1) and Watch it; the moments are on the match page (owner: no latest chance on the hub). The Bracket tile is live pink with the round's count. The sticky evening clock (MidweekClock) is not on the hub: the Now block and the tiles carry the moment (question Q3).",
    body: () => hubLive("20:33:20", false),
  },
  {
    stem: "B6-Hub-Out",
    page: "hub",
    widths: [320, 412],
    title: "/midweek once you're out · 20:35:10",
    note: "Out in the quarter-finals. The Now block says where your night ended and leads to the calls while one is open; tile 1 becomes Calls (DR5-1).",
    body: () => hubOut(),
  },
  {
    stem: "B7-Hub-FinalLive",
    page: "hub",
    widths: [320, 412],
    title: "/midweek during the final · 21:01:40",
    note: "The final is everyone's Now block. Sanne is out, so tile 1 stays Calls (the final's call closed at kick-off).",
    body: () => hubLive("21:01:40", true),
  },
  {
    stem: "C1-Pick-Empty",
    page: "pick",
    widths: [320, 412, 1440],
    title: "/midweek/pick, nothing picked · Mon 12 Oct",
    note: "The picker on its own page (F7). Slots read `Trialist · OVR 30`, one Small line says empty slots play a trialist (D). The archetype chips go into a Filter sheet (C). The save bar carries the one-line privacy notice (DR5-8). From lg: the five and the save on the left, the card grid on the right.",
    body: () => P.PickerPage(pickerProps([], "none")),
  },
  {
    stem: "C2-Pick-Editing",
    page: "pick",
    widths: [320, 412],
    title: "/midweek/pick while editing · three picked",
    note: "Three cards in, unsaved: Save your five is the primary. The plusses per line from lineCount; the rule itself behind How plusses work › (DR5-10). The picker boards use Julia's collection (one Goalkeeper); Sanne owns none, so her picker never shows the count.",
    body: () => P.PickerPage(pickerProps([...KEEPER, ...OUTFIELD.slice(0, 2)].map((c) => c.playerId), "dirty")),
  },
  {
    stem: "C3-Pick-Saved",
    page: "pick",
    widths: [320, 412],
    title: "/midweek/pick, saved",
    note: "A saved five with its Goalkeeper, the verdict, Saved. Change your five is secondary: nothing on this screen is urgent now.",
    body: () => P.PickerPage(pickerProps(savedIds, "saved")),
  },
  {
    stem: "D1-Bracket-Live",
    page: "evening",
    widths: [320, 412, 1440],
    title: "/midweek/[week]/bracket · 20:35:10",
    note: "The Bracket tile's page. On a phone, a block per round, the latest round first (rounds not yet near kick-off are left out until they are). Rows on the scale: club lines with scores, the state on the right, your pairing in brass. Once you're out each row carries your call or `Call open` (rowCalls), and a settled pairing links to its pre-match, where you can call it. From lg the real tree (DR4-10), which S5 moves onto the scale without changing its structure.",
    body: () => bracketPage("20:35:10", true),
  },
  {
    stem: "D2-Night-Out",
    page: "evening",
    widths: [320, 412],
    title: "/midweek/[week]/night once you're out · 20:35:10",
    note: "Your night: round by round, each row a link to its report; your five against Sophie rated for that match (latestMatchRatings), rows simpler (DR5-6); How ratings work › is all that is left of the rule (pre-decided cut).",
    body: () => nightPage("20:35:10"),
  },
  {
    stem: "D3-Calls-Open",
    page: "evening",
    widths: [320, 412],
    title: "/midweek/[week]/calls · 20:35:10",
    note: "Calls (ADR-118) on their own page: one Small line instead of the paragraph (D), a block per match, two big buttons, the status from settledStatus, and a link to the match: `Pre-match ›` while it is open, `Watch it ›` in play, `Report ›` once ended. Ways in: the hub's Make your calls and its Calls tile, the bracket's rows, the pre-match itself. Sanne's pick is an invented sample choice.",
    body: () => callsPage("20:35:10"),
  },
  {
    stem: "D4-PreMatch",
    page: "evening",
    widths: [320, 412],
    title: "The pre-match, restyled · 20:20:10",
    note: "Sophie Saints v Sanne's Club before kick-off (DR4-7). The title is the pairing in ink, the line is shortened (D), each five a block with its colour as a top rail, Power pill, mini card, name, Small meta. The Power foot goes behind How Power works ›.",
    body: () => preMatchPage("20:20:10", 3, 1),
  },
  {
    stem: "D5-PreMatch-Call",
    page: "evening",
    widths: [320, 412],
    title: "A pre-match you can call, once you're out · 20:35:10",
    note: "Semi-final 1, Niels Newcastle v Sophie Saints, seen by Sanne (out): the call block on top (DR4-7), both fives under it, so reading the fives and calling are one page. Reached from the call's Pre-match ›, the bracket row, or the hub.",
    body: () => preMatchPage("20:35:10", 4, 0),
  },
  {
    stem: "E1-Hub-Champion",
    page: "past",
    widths: [320, 412, 1440],
    title: "/midweek after the final · 21:08",
    note: "The champion leads (D4): the title names them. Your night in two figures (finishStat, the coins), next week's picker as the one primary. The final in a line (finalLine) with the champion's five as mini cards. Tiles: Your night, Bracket, Calls, Past weeks.",
    body: () => hubComplete(),
  },
  {
    stem: "E2-Week-Past",
    page: "past",
    widths: [320, 412],
    title: "/midweek/2026-10-05, a week gone by",
    note: "A past week is the hub after its final, without the Now: your result, the final, and four tiles (Who picked whom moves behind one). The fairness seal folds away at the foot.",
    body: () => weekPast(),
  },
  {
    stem: "E3-Night-Complete",
    page: "past",
    widths: [320, 412],
    title: "/midweek/[week]/night after the final",
    note: "The night's ratings (nightRatings): mini card, name, the card's line in Small, the disc, ★ Best; the per-match chips go (DR5-6), each report's Teams tab has them. Your calls in one row. Share the night without SHARE_NOTE (pre-decided cut).",
    body: () => nightPage("21:08:00"),
  },
  {
    stem: "E4-Home-Entry",
    page: "past",
    widths: [320, 412],
    title: "Home's Midweek entry, three moments",
    note: "The entry on the new Home (S3 mocks the rest of Home). One block, the same rules as the hub's Now: brass and a primary only when something is due.",
    body: () => homeEntry(),
  },
  {
    stem: "F1-Report-Live-Yours",
    page: "report",
    widths: [320, 412],
    title: "Your match live, Match tab · 20:33:20",
    note: "The live title is the pairing in plain ink. The scoreboard with Live · 64′ and the progress line, Match · Teams, the feed newest first; the newest slides in, without an outline (owner). No headline, no facts until full time.",
    body: () => reportLive(QF2, "20:33:20", "match"),
  },
  {
    stem: "F2-Report-Live-Teams",
    page: "report",
    widths: [412],
    title: "Your match live, Teams tab · 20:33:20",
    note: "The Why without goals and assists (ADR-115) and without ratings; the key appears from full time.",
    body: () => reportLive(QF2, "20:33:20", "teams"),
  },
  {
    stem: "F3-Report-Live-Pens",
    page: "report",
    widths: [320, 412],
    title: "Another match, mid shoot-out · 20:35:10",
    note: "Stijnfeld United v Bartcelona, six kicks in: the Penalties block (tally and dots) above the feed, kicks on top, no outline on the newest. Polls every 5 s.",
    body: () => reportLive(QF3, "20:35:10", "match"),
  },
  {
    stem: "F4-Report-FullTime-Match",
    page: "report",
    widths: [320, 412],
    title: "Full time, 2–2, 4–3 on pens, Match tab",
    note: "The headline in plain ink, Small context, facts as Body bullets, the moments oldest first as rows with rails, then the shoot-out: tally, intro, every kick with its line, the decider outlined.",
    body: () => reportFullTime(QF3, "match"),
  },
  {
    stem: "F5-Report-FullTime-Teams",
    page: "report",
    widths: [320, 412],
    title: "Full time, Teams tab",
    note: "The key, the chances, each side a block with a top rail: Power pill, name, Small meta, bar, rating disc. Show every factor keeps the tooltips (#279 is fixed or moot in S6).",
    body: () => reportFullTime(QF3, "teams"),
  },
  {
    stem: "F6-Report-Desktop",
    page: "report",
    widths: [1440],
    title: "Full time on desktop",
    note: "From lg the tabs go: Match on the left with the moments in two lanes either side of a minute-and-score spine, Teams on the right (DR5-2, confirmed).",
    body: () => reportFullTime(QF3, "match"),
  },
  {
    stem: "F7-Report-LongClub",
    page: "report",
    widths: [320],
    title: "The 80-character club at 320 px",
    note: "Round 2, Sanne's Club 2–0 against Eline's 80-character club: two lines on the scoreboard, then an ellipsis (DR4-9); report text wraps.",
    body: () => reportFullTime(R2E, "match"),
  },
];
