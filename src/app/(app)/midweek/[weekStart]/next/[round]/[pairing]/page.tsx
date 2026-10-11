import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { MidweekNotice } from "@/components/midweek/bits";
import { MidweekLivePoller } from "@/components/midweek/live-poller";
import { MIDWEEK_PAGE } from "@/components/midweek/page-head";
import { MidweekPredictions } from "@/components/midweek/predictions";
import { MidweekPreMatchBoard, MidweekPreMatchFive } from "@/components/midweek/prematch";
import { MIDWEEK } from "@/game/midweek/config";
import { predictionCoins } from "@/game/midweek/rewards";
import { requireUser } from "@/lib/auth/user";
import { callCards } from "@/lib/midweek/calls";
import {
  formatClock,
  formatDayDate,
  scheduleVersionOf,
  skipOrVoidNotice,
} from "@/lib/midweek/entry";
import {
  assembleBracket,
  capitalise,
  isWeekStart,
  matchName,
  myNight,
} from "@/lib/midweek/evening";
import { POLL_MS } from "@/lib/midweek/live-clock";
import { LINE_RULE } from "@/lib/midweek/plusses";
import { nextPairing, preMatchSide, routeNumber } from "@/lib/midweek/prematch";
import { loadCalls, loadTournamentByWeek, loadWeekResults } from "@/lib/midweek/results";
import { runDueMidweek } from "@/lib/midweek/run-due";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Midweek Madness pre-match" };

/**
 * `/midweek/[weekStart]/next/[round]/[pairing]`: a later round's pairing
 * before kick-off (DR4-7, ADR-149; `PreMatch-Yours`, `PreMatch-Other-Out`). It
 * is addressed by round and pairing, because a match's id is public only from
 * its kick-off. It opens once both feeders have ended, when calls open
 * (ADR-118), and shows both fives with the week's Power and the plusses per
 * line, from member-readable views only: never the win chance or a day roll,
 * which come at kick-off. A member who is out can call the match here. From
 * kick-off it redirects to the match page; the page polls from its kick-off
 * until it does. While a feeder still plays, it says so and links to it.
 */
export default async function MidweekPreMatchPage({
  params,
}: {
  params: Promise<{ weekStart: string; round: string; pairing: string }>;
}) {
  const user = await requireUser();
  await runDueMidweek();
  const { weekStart, round: roundSegment, pairing: pairingSegment } = await params;
  // Every segment is checked before any query (KB-007).
  const round = routeNumber(roundSegment);
  const pairing = routeNumber(pairingSegment);
  if (!isWeekStart(weekStart) || round === null || pairing === null) notFound();
  const supabase = await createClient();
  const tournament = await loadTournamentByWeek(supabase, weekStart);
  const rounds = tournament?.rounds;
  if (
    !tournament ||
    !rounds ||
    skipOrVoidNotice(tournament, MIDWEEK.minEntrants) ||
    round < 2 ||
    round > rounds ||
    pairing >= 2 ** (rounds - round)
  ) {
    notFound();
  }

  const now = new Date();
  const nowIso = now.toISOString();
  const results = await loadWeekResults(supabase, tournament.tournament_id, now);
  // From its kick-off the pairing is a match, on its own page.
  const match = results.matches.find((row) => row.round === round && row.pairing === pairing);
  if (match) redirect(`/midweek/${weekStart}/match/${match.match_id}`);

  const lockAt = tournament.lock_at;
  const scheduleVersion = scheduleVersionOf(tournament);
  const bracket = assembleBracket({
    rounds,
    lockAt,
    scheduleVersion,
    draw: results.draw,
    matches: results.matches,
    autoUserIds: new Set(results.entries.filter((row) => row.auto).map((row) => row.user_id)),
  });
  const label = capitalise(matchName(round, pairing, rounds));
  const back = (
    <Link
      className="justify-self-start text-sm font-bold text-brass hover:underline"
      href={`/midweek/${weekStart}`}
    >
      &larr; {formatDayDate(lockAt)} bracket
    </Link>
  );
  const kicker = (text: string) => (
    <p className="text-[0.7rem] font-extrabold tracking-[0.26em] text-brass uppercase">{text}</p>
  );

  const next = nextPairing(bracket, round, pairing);
  if (!next) {
    // A feeder still to finish: nothing of this pairing yet, the way to watch
    // a feeder in play, and a poll until the page opens.
    const feeders = bracket[round - 2].pairs
      .slice(2 * pairing, 2 * pairing + 2)
      .flatMap((pair) => (pair.kind === "inplay" ? [pair] : []));
    const kickoffAt = bracket[round - 1].kickoffAt;
    return (
      <main className={MIDWEEK_PAGE}>
        <article className="mx-auto grid max-w-3xl gap-5 py-4 sm:gap-6 sm:py-8">
          <header className="grid gap-3">
            {back}
            {kicker(`${label} · pre-match`)}
            <h1 className="display text-[30px] sm:text-[40px]">Not settled yet</h1>
          </header>
          <MidweekNotice tone="info">
            <b>The pre-match opens when both matches before it have ended.</b> Then both fives and
            their Power show here until kick-off at {formatClock(kickoffAt)}.
          </MidweekNotice>
          {feeders.map((pair) => (
            <Link
              className="justify-self-start text-sm font-bold text-brass hover:underline"
              href={`/midweek/${weekStart}/match/${pair.match.match_id}`}
              key={pair.pairing}
            >
              Watch {pair.sides[0].name} v {pair.sides[1].name} &rarr;
            </Link>
          ))}
          <MidweekLivePoller
            at={nowIso}
            nextAt={bracket.find((r) => Date.parse(r.kickoffAt) > now.getTime())?.kickoffAt ?? null}
            poll={feeders.length > 0}
          />
        </article>
      </main>
    );
  }

  const [home, away] = next.sides.map((side) =>
    side.userId === null ? null : preMatchSide(results.entries, side.userId),
  );
  if (!home || !away) notFound();
  const youSide = home.userId === user.id ? 0 : away.userId === user.id ? 1 : null;
  const clubs = [home.club, away.club] as const;

  // A member who is out calls this match here too (DR4-7, amending DR3-6).
  const night = myNight({
    userId: user.id,
    rounds,
    lockAt,
    scheduleVersion,
    matches: results.matches,
  });
  const calls = night.rows.some((row) => row.kind === "out")
    ? await loadCalls(supabase, tournament.tournament_id)
    : null;
  const card = calls
    ? callCards({
        bracket,
        night,
        predictions: calls.predictions,
        splits: calls.splits,
        now,
      })?.find((c) => c.round === round && c.pairing === pairing)
    : undefined;

  return (
    <main className={MIDWEEK_PAGE}>
      <article className="mx-auto grid max-w-6xl gap-5 py-4 sm:gap-6 sm:py-8">
        <header className="grid gap-3">
          {back}
          {kicker(`${label}${youSide !== null ? " · your next match" : ""}`)}
          <h1 className="sr-only">
            {clubs[0]} v {clubs[1]}, before kick-off
          </h1>
        </header>
        <MidweekPreMatchBoard
          clubs={clubs}
          kickoffAt={next.kickoffAt}
          now={nowIso}
          youSide={youSide}
        />
        <p className="text-sm leading-relaxed text-ink-dim">
          Both fives as they were locked at {formatClock(lockAt)}, with this week&rsquo;s Power. The
          chances before kick-off and each card&rsquo;s day roll come at kick-off, when this page
          turns into the live match.
        </p>
        {card && (
          <MidweekPredictions
            at={nowIso}
            cards={[card]}
            coins={predictionCoins(rounds)}
            foot={false}
            rounds={rounds}
            tournamentId={tournament.tournament_id}
          />
        )}
        <div className="grid gap-7 md:grid-cols-2 lg:gap-10">
          <MidweekPreMatchFive s={0} side={home} you={youSide === 0} />
          <MidweekPreMatchFive s={1} side={away} you={youSide === 1} />
        </div>
        <p className="text-xs leading-relaxed text-ink-faint">
          Power is a card&rsquo;s strength this week, from its rating, form, pick and fitness, fixed
          at the lock; 1.00, the tick on each bar, is an ordinary card. {LINE_RULE}
        </p>
        <div className="flex justify-center">
          <MidweekLivePoller
            at={nowIso}
            foot
            intervalMs={POLL_MS.match}
            nextAt={next.kickoffAt}
            poll={false}
          />
        </div>
      </article>
    </main>
  );
}
