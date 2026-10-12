// The DR4 sample evening stored the way kut._mm_lock_tournament stores it and
// read back the way the member views return it at any moment (ADR-098,
// ADR-105, ADR-106), so the DR5 screens can call the app's real functions
// (assembleBracket, myNight, callCards, nightRatings, ...). Invented world:
// nothing here is a real member, club or Player.
import { src } from "./source.mjs";
import { buildSample, CLUB_NAMES, MANAGER_NAMES, PLAYER_NAMES } from "./sample.mjs";

const { MIDWEEK } = src("game/midweek/config.ts");
const { maskInPlay } = src("lib/midweek/live.ts");

export const S = buildSample();
export const WEEK_START = "2026-10-05";
export const TOURNAMENT = "t-2026-10-05";
export const ROUNDS = S.rounds;
export const LOCK = S.lock.toISOString();
export const VERSION = S.version;
const REG = MIDWEEK.match.chanceSlots * S.schedule.slotSeconds * 1000;
const KICK = S.schedule.kickSeconds * 1000;

const account = (id) => S.account(id);
const club = (id) => CLUB_NAMES[account(id)];
const playerName = (id) => PLAYER_NAMES[Number(id.slice(1))];
export const idOf = (name) => S.tournament.entries.find((e) => account(e.userId) === name).userId;
export const SANNE = idOf("Sanne");
export const ELINE = idOf("Eline");

const matchId = (round, pairing) => `m${round}-${pairing}`;
const kickoffOf = (round) => S.matches.find((m) => m.round === round).kickoffAt;

// ---------------------------------------------------------------- stored rows

const sample = (round, pairing) => S.matches.find((m) => m.round === round && m.pairing === pairing);

export function endsAt(round, pairing) {
  const m = sample(round, pairing);
  return new Date(Date.parse(m.kickoffAt) + REG + (m.report.shootout?.kicks.length ?? 0) * KICK);
}

function matchRow(m) {
  const o = m.input.outcome;
  const [a, b] = m.userIds;
  return {
    match_id: matchId(m.round, m.pairing),
    tournament_id: TOURNAMENT,
    week_start: WEEK_START,
    round: m.round,
    pairing: m.pairing,
    bye: false,
    side_0_user_id: a,
    side_0_name: account(a),
    side_1_user_id: b,
    side_1_name: account(b),
    side_0_club: club(a),
    side_1_club: club(b),
    side_0_goals: o.goals[0],
    side_1_goals: o.goals[1],
    side_0_penalties: o.penalties?.[0] ?? null,
    side_1_penalties: o.penalties?.[1] ?? null,
    winner_side: o.winnerSide,
    winner_user_id: m.userIds[o.winnerSide],
    win_chance_ppm: o.winChancePpm,
    side_0_day_rolls_ppm: o.dayRollsPpm[0],
    side_1_day_rolls_ppm: o.dayRollsPpm[1],
    reveal_at: m.kickoffAt,
    ends_at: endsAt(m.round, m.pairing).toISOString(),
  };
}

const byeRows = S.tournament.byes.map((bye) => ({
  match_id: matchId(1, bye.pairing),
  tournament_id: TOURNAMENT,
  week_start: WEEK_START,
  round: 1,
  pairing: bye.pairing,
  bye: true,
  side_0_user_id: bye.userId,
  side_0_name: account(bye.userId),
  side_1_user_id: null,
  side_1_name: null,
  side_0_club: club(bye.userId),
  side_1_club: null,
  side_0_goals: null,
  side_1_goals: null,
  side_0_penalties: null,
  side_1_penalties: null,
  winner_side: 0,
  winner_user_id: bye.userId,
  win_chance_ppm: null,
  side_0_day_rolls_ppm: null,
  side_1_day_rolls_ppm: null,
  reveal_at: kickoffOf(1),
  ends_at: kickoffOf(1),
}));

const ALL_MATCHES = [...byeRows, ...S.matches.map(matchRow)];

const DRAW = ALL_MATCHES.filter((row) => row.round === 1).map((row) => ({
  match_id: row.match_id,
  tournament_id: TOURNAMENT,
  week_start: WEEK_START,
  pairing: row.pairing,
  bye: row.bye,
  side_0_user_id: row.side_0_user_id,
  side_0_name: row.side_0_name,
  side_1_user_id: row.side_1_user_id,
  side_1_name: row.side_1_name,
  side_0_club: row.side_0_club,
  side_1_club: row.side_1_club,
  kickoff_at: row.reveal_at,
}));

/** Every event with the moment the member view first shows it (ADR-106). */
const ALL_EVENTS = S.matches.flatMap((m) => {
  const id = matchId(m.round, m.pairing);
  const kickoff = Date.parse(m.kickoffAt);
  let pen = 0;
  return m.input.outcome.events.map((event, seq) => {
    const empty = {
      minute: null, penalty_round: null, creator_slot: null, shooter_slot: null, defender_slot: null,
      kicker_slot: null, keeper_slot: null, chance_type: null, outcome: null, p_goal_ppm: null,
    };
    const base = { ...empty, match_id: id, seq, kind: event.kind, side: event.side };
    if (event.kind === "chance") {
      return {
        row: {
          ...base, minute: event.minute, creator_slot: event.creator, shooter_slot: event.shooter,
          defender_slot: event.defender, chance_type: event.chanceType, outcome: event.outcome,
          p_goal_ppm: event.pGoalPpm,
        },
        at: kickoff + Math.floor((event.minute * REG) / MIDWEEK.match.minutes),
      };
    }
    if (event.kind === "penalty") {
      pen += 1;
      return {
        row: {
          ...base, penalty_round: event.round, kicker_slot: event.kicker, keeper_slot: event.keeper,
          outcome: event.outcome, p_goal_ppm: event.pGoalPpm,
        },
        at: kickoff + REG + pen * KICK,
      };
    }
    return { row: base, at: endsAt(m.round, m.pairing).getTime() };
  });
});

function entryRows(complete, diceOut) {
  const shares = new Map(S.tournament.pickShares.map((share) => [share.playerId, share]));
  return S.tournament.entries.flatMap((entry) =>
    entry.cards.map((card) => {
      const share = card.playerId === null ? undefined : shares.get(card.playerId);
      return {
        tournament_id: TOURNAMENT,
        week_start: WEEK_START,
        user_id: entry.userId,
        manager_name: account(entry.userId),
        club_name: club(entry.userId),
        auto: entry.auto,
        keeper_slot: entry.keeperSlot,
        keeperless: entry.keeperless,
        balance_ppm: entry.balancePpm,
        slot: card.slot,
        trialist: card.trialist,
        player_id: card.playerId,
        player_name: card.playerId === null ? null : playerName(card.playerId),
        photo_path: null,
        ovr: card.ovr,
        archetype: card.archetype,
        injured: card.injured,
        ovr_factor_ppm: card.ovrFactorPpm,
        form_roll_ppm: diceOut ? card.formRollPpm : null,
        pick_factor_ppm: diceOut ? card.pickFactorPpm : null,
        fitness_ppm: card.fitnessPpm,
        handicap_ppm: card.handicapPpm,
        power_ppm: diceOut ? card.powerPpm : null,
        picks: complete && share ? share.picks : null,
        owners: complete && share && share.owners >= MIDWEEK.ownerCountMin ? share.owners : null,
      };
    }),
  );
}

export const FINAL_ENDS = endsAt(ROUNDS, 0);

/**
 * The week as a member's pages read it at `now`: the views show a pairing from
 * its kick-off and withhold its result until it ends; events each from their
 * own moment; entries from the lock, their dice from round 1's kick-off.
 */
export function at(now) {
  const t = now.getTime();
  const roundOne = Date.parse(kickoffOf(1));
  const complete = t >= FINAL_ENDS.getTime();
  const shown = ALL_MATCHES.filter((row) => Date.parse(row.reveal_at) <= t).map((row) => ({
    ...row,
    ends_at: Date.parse(row.ends_at) <= t ? row.ends_at : null,
  }));
  const ends = new Map(ALL_MATCHES.map((row) => [row.match_id, row.ends_at]));
  return {
    now,
    status: complete ? "complete" : "simulated",
    matches: maskInPlay(shown, ends, now),
    /** Every match whole: what the server's report read uses for a match it may show. */
    whole: ALL_MATCHES,
    draw: t >= Date.parse(LOCK) ? DRAW : [],
    events: ALL_EVENTS.filter((e) => e.at <= t).map((e) => e.row),
    allEvents: ALL_EVENTS.map((e) => e.row),
    entries: t >= Date.parse(LOCK) ? entryRows(complete, t >= roundOne) : [],
    autoUserIds: new Set(S.tournament.entries.filter((e) => e.auto).map((e) => e.userId)),
  };
}

export const tournamentRow = (status) => ({
  tournament_id: TOURNAMENT,
  week_start: WEEK_START,
  lock_at: LOCK,
  status,
  rounds: ROUNDS,
  seed_hash: S.hash,
  schedule_version: VERSION,
  champion_user_id: status === "complete" ? S.tournament.championUserId : null,
  champion_name: status === "complete" ? account(S.tournament.championUserId) : null,
  champion_club: status === "complete" ? club(S.tournament.championUserId) : null,
});

export { account, club, matchId, kickoffOf, MANAGER_NAMES };
/** A moment of the evening, Amsterdam time on Wed 7 Oct 2026 (CEST, UTC+2). */
export const time = (hms) => new Date(`2026-10-07T${hms}+02:00`);
