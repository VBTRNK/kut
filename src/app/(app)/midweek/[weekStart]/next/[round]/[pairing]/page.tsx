import { notFound, redirect } from "next/navigation";
import { MidweekCountdown } from "@/components/midweek/countdown";
import { MidweekLivePoller } from "@/components/midweek/live-poller";
import { MidweekPredictions } from "@/components/midweek/predictions";
import { MidweekPreMatchFive } from "@/components/midweek/prematch";
import { Block } from "@/components/ui/block";
import { InfoLink, LinkRow } from "@/components/ui/links";
import { COLUMN, PAGE, PageHeader } from "@/components/ui/page";
import { MIDWEEK } from "@/game/midweek/config";
import { predictionCoins } from "@/game/midweek/rewards";
import { requireUser } from "@/lib/auth/user";
import { callCards } from "@/lib/midweek/calls";
import { formatClock, scheduleVersionOf, skipOrVoidNotice } from "@/lib/midweek/entry";
import {
  assembleBracket,
  capitalise,
  isWeekStart,
  matchName,
  myNight,
} from "@/lib/midweek/evening";
import { POLL_MS } from "@/lib/midweek/live-clock";
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
 * which come at kick-off. A member who is out can call the match here, above
 * both fives (DR5-14). The pairing is the Title, the kick-off and countdown
 * the Small line; each five is a block with its colour as a top rail, and
 * what Power is sits behind `How Power works ›`. From kick-off it redirects
 * to the match page; the page polls from its kick-off until it does. While a
 * feeder still plays, it says so and links to it.
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
  const back = { href: `/midweek/${weekStart}/bracket`, label: "Bracket" };

  const next = nextPairing(bracket, round, pairing);
  if (!next) {
    // A feeder still to finish: nothing of this pairing yet, the way to watch
    // a feeder in play, and a poll until the page opens.
    const feeders = bracket[round - 2].pairs
      .slice(2 * pairing, 2 * pairing + 2)
      .flatMap((pair) => (pair.kind === "inplay" ? [pair] : []));
    const kickoffAt = bracket[round - 1].kickoffAt;
    return (
      <main className={PAGE}>
        <div className={COLUMN}>
          <PageHeader back={back} sub={`${label} · pre-match`} title="Not settled yet" />
          <Block>
            <p className="text-body text-pretty text-ink-dim">
              The pre-match opens when both matches before it have ended. Then both fives and their
              Power show here until kick-off at {formatClock(kickoffAt)}.
            </p>
            {feeders.length > 0 && (
              <ul>
                {feeders.map((pair) => (
                  <LinkRow
                    href={`/midweek/${weekStart}/match/${pair.match.match_id}`}
                    key={pair.pairing}
                    title={`Watch ${pair.sides[0].name} v ${pair.sides[1].name}`}
                  />
                ))}
              </ul>
            )}
          </Block>
          <MidweekLivePoller
            at={nowIso}
            nextAt={bracket.find((r) => Date.parse(r.kickoffAt) > now.getTime())?.kickoffAt ?? null}
            poll={feeders.length > 0}
          />
        </div>
      </main>
    );
  }

  const [home, away] = next.sides.map((side) =>
    side.userId === null ? null : preMatchSide(results.entries, side.userId),
  );
  if (!home || !away) notFound();
  const youSide = home.userId === user.id ? 0 : away.userId === user.id ? 1 : null;

  // A member who is out calls this match here too, above both fives (DR4-7, amending DR3-6).
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
  const kickoff = formatClock(next.kickoffAt);

  return (
    <main className={PAGE}>
      <div className={`${COLUMN} lg:max-w-5xl`}>
        <PageHeader
          back={back}
          sub={
            <>
              {label}
              {youSide !== null ? " · your next match" : ""} · kick-off {kickoff},{" "}
              <MidweekCountdown now={nowIso} target={next.kickoffAt} />
            </>
          }
          title={`${home.club} v ${away.club}`}
        />
        {card && (
          <MidweekPredictions
            at={nowIso}
            cards={[card]}
            coins={predictionCoins(rounds)}
            tournamentId={tournament.tournament_id}
          />
        )}
        <p className="text-small text-ink-dim">Both fives as locked at {formatClock(lockAt)}.</p>
        <div className="grid gap-4 lg:grid-cols-2">
          <MidweekPreMatchFive s={0} side={home} you={youSide === 0} />
          <MidweekPreMatchFive s={1} side={away} you={youSide === 1} />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-x-4">
          <InfoLink href="/how-it-works#power">How Power works</InfoLink>
          <MidweekLivePoller
            at={nowIso}
            foot
            intervalMs={POLL_MS.match}
            nextAt={next.kickoffAt}
            poll={false}
          />
        </div>
      </div>
    </main>
  );
}
