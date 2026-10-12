// The sample evening for the MM 3.0 and DR5 mocks, from today's engine and renderer:
// the same invented world as tests/sim/midweek-sample.ts, with invented club
// names (#262). Nothing here is a real member, club or Player.
import { createHash } from "node:crypto";
import { src, tests } from "./source.mjs";

const { MIDWEEK } = src("game/midweek/config.ts");
const { seedHash, shaRng } = src("game/midweek/rng.ts");
const { lockAt, roundStartAt, scheduleFor } = src("game/midweek/schedule.ts");
const { simulateTournament } = src("game/midweek/tournament.ts");
const { reportInput } = src("lib/midweek/report/from-engine.ts");
const { renderMatchReport } = src("lib/midweek/report/render.ts");
const { matchRatings } = src("lib/midweek/report/ratings.ts");
const { generateWorld } = tests("sim/midweek-world.ts");

export const PLAYER_NAMES = [
  "Anouk B.", "Bas V.", "Chris D.", "Daan K.", "Esther M.", "Floor J.", "Gijs H.", "Hidde P.",
  "Iris W.", "Jesse T.", "Kees R.", "Lotte S.", "Mo A.", "Noor E.", "Olaf G.", "Pim L.",
  "Quinten Z.", "Roos N.", "Sem O.", "Tess F.", "Umut C.", "Vera I.", "Wout Y.", "Xandra U.",
  "Yara Q.", "Zeger X.", "Ayla D.", "Bram K.", "Carmen P.", "Dirk S.",
];
export const MANAGER_NAMES = [
  "Sanne", "Joris", "Mila", "Thijs", "Lieke", "Ruben", "Fleur", "Koen", "Nina", "Stijn", "Eline",
  "Maarten", "Julia", "Wessel", "Anna", "Tim", "Sophie", "Rick", "Laura", "Niels", "Emma", "Bart",
];
/** Invented club names (#262); a member without one shows `{name}'s Club`. */
export const CLUB_NAMES = {
  Sanne: "Sanne's Club",
  Joris: "Joristown Rovers",
  Mila: "Mila Milan",
  Thijs: "Thijs Hotspur",
  Lieke: "Real Lieke",
  Ruben: "Ruben's Club",
  Fleur: "Fleurentina",
  Koen: "Koenigsberg 05",
  Nina: "Nina's Club",
  Stijn: "Stijnfeld United",
  // The 80-character club name (the longest Settings allows), for every overflow check.
  Eline:
    "Sportclub Elinewijk Zondagmiddag Veteranen Zeven Tegen Zeven Haarlem-Noord 1923",
  Maarten: "Maartenburg",
  Julia: "Julia Juventus",
  Wessel: "Wessel Wanderers",
  Anna: "Anna Athletic",
  Tim: "Tim's Club",
  Sophie: "Sophie Saints",
  Rick: "Rickstad FC",
  Laura: "Laura Lazio",
  Niels: "Niels Newcastle",
  Emma: "Emma Eagles",
  Bart: "Bartcelona",
};

/** Swaps each side-tagged mention of a team (its account name) for its club. */
function clubify(report, accounts, clubs) {
  const seg = (part) =>
    part.side !== undefined && part.text === accounts[part.side] ? { ...part, text: clubs[part.side] } : part;
  const parts = (list) => list.map(seg);
  return {
    ...report,
    headlineParts: parts(report.headlineParts),
    facts: report.facts.map((f) => ({ ...f, parts: parts(f.parts) })),
    timeline: report.timeline.map((t) => ({ ...t, parts: parts(t.parts) })),
    why: report.why.map((w, s) => ({ ...w, manager: clubs[s] })),
    shootout: report.shootout && { ...report.shootout, lineParts: report.shootout.lineParts.map(parts) },
  };
}

export function buildSample() {
  const world = generateWorld(20261007);
  const injured = new Set(["p04", "p17"]);
  const entrants = world.members.map((member, i) => {
    const owned = member.owned.map((card) => ({ ...card, injured: injured.has(card.playerId) }));
    const distinct = [...new Map(owned.map((c) => [c.playerId, c])).values()].sort(
      (a, b) => b.ovr - a.ovr,
    );
    const saved = i % 3 === 2 ? [] : distinct.slice(0, i === 4 ? 4 : 5);
    return { userId: member.userId, owned, saved };
  });
  const seed = createHash("sha256").update("midweek-sample").digest("hex");
  const hash = seedHash(seed);
  const tournament = simulateTournament(shaRng(seed), entrants);
  const account = (id) => MANAGER_NAMES[Number(id.slice(1))];
  const club = (id) => CLUB_NAMES[account(id)];
  // Rendered with account names, so a trialist reads `Eline's first trialist`
  // (DR4-12); then every mention of the team itself becomes its club (Q7).
  const directory = { player: (id) => PLAYER_NAMES[Number(id.slice(1))], manager: account };
  const lock = lockAt("2026-10-05");
  const version = MIDWEEK.schedule.current;
  const schedule = scheduleFor(version);
  const matches = tournament.matches.map((match) => {
    const input = reportInput(tournament, match, hash, directory);
    const accounts = match.userIds.map(account);
    const clubs = match.userIds.map(club);
    const report = clubify(renderMatchReport(input), accounts, clubs);
    return {
      round: match.round,
      pairing: match.pairing,
      userIds: match.userIds,
      accounts,
      clubs,
      kickoffAt: roundStartAt(lock, match.round, version).toISOString(),
      input,
      report,
      ratings: matchRatings(input),
    };
  });
  return {
    entrants,
    world,
    tournament,
    hash,
    lock,
    version,
    schedule,
    rounds: tournament.rounds,
    matches,
    account,
    club,
    directory,
  };
}

if (process.argv[1]?.endsWith("sample.mjs")) {
  const s = buildSample();
  console.log("lock", s.lock.toISOString(), "rounds", s.rounds, "schedule", JSON.stringify(s.schedule));
  for (const m of s.matches) {
    const o = m.input.outcome;
    console.log(
      `R${m.round} P${m.pairing} ${m.kickoffAt.slice(11, 16)} ${m.accounts[0]} ${o.goals[0]}-${o.goals[1]} ${m.accounts[1]}` +
        (o.penalties ? ` pens ${o.penalties[0]}-${o.penalties[1]}` : "") +
        ` w=${m.accounts[o.winnerSide]} moments=${m.report.timeline.length}` +
        (m.report.shootout ? ` kicks=${m.report.shootout.kicks.length}` : ""),
    );
  }
  console.log("byes", s.tournament.byes.map((b) => s.account(b.userId)).join(", "));
}
