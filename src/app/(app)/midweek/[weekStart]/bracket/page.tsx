import { MidweekBracket } from "@/components/midweek/bracket";
import { MidweekJumpLinks } from "@/components/midweek/jump-links";
import { MidweekLivePoller } from "@/components/midweek/live-poller";
import { MidweekSeed } from "@/components/midweek/seed";
import { seedHash } from "@/game/midweek/rng";
import { callCards, callJumpLink, rowCalls } from "@/lib/midweek/calls";
import { championClub } from "@/lib/midweek/entry";
import { yourNextRound } from "@/lib/midweek/evening";
import { loadCalls } from "@/lib/midweek/results";
import { openWeek, WeekShell, weekNow } from "../week";

export const metadata = { title: "Midweek Madness bracket" };

/**
 * `/midweek/[week]/bracket` (DR5-11): the bracket behind the hub's tile, as
 * the week page shows it (Bracket-FromLock, Bracket-Evening, Bracket-Complete),
 * with the fairness seal, and the seed once the week is complete. A member who
 * is out sees their call on each later row (ADR-118). S6 restyles it (DR5-14).
 */
export default async function MidweekWeekBracketPage({
  params,
}: {
  params: Promise<{ weekStart: string }>;
}) {
  const { weekStart } = await params;
  const week = await openWeek(weekStart, "Bracket");
  if (week.blocked) return week.blocked;
  const { supabase, tournament, userId, date } = week;
  const now = new Date();
  const { rounds, evening, bracket, night, inPlay, nextKickoff } = await weekNow(week, now);
  const calls =
    evening && night.rows.some((row) => row.kind === "out")
      ? await loadCalls(supabase, tournament.tournament_id)
      : null;
  const cards = calls
    ? callCards({ bracket, night, predictions: calls.predictions, splits: calls.splits, now })
    : null;
  const callLink = cards ? callJumpLink(cards, rounds) : null;
  const seed = tournament.seed ?? null;
  const seal = tournament.seed_hash ?? "";
  const complete = tournament.status === "complete";
  const club = championClub(tournament);

  return (
    <WeekShell sub={complete && club ? `${date} · won by ${club}` : date} title="Bracket" wide>
      {evening && <MidweekLivePoller at={now.toISOString()} nextAt={nextKickoff} poll={inPlay} />}
      <MidweekJumpLinks
        blocks={callLink ? [{ href: `#round-${callLink.round}`, label: callLink.label }] : []}
        rounds={bracket}
        yours={evening ? yourNextRound(bracket, userId) : null}
      />
      <MidweekBracket
        calls={cards ? rowCalls(cards) : undefined}
        rounds={bracket}
        weekStart={weekStart}
        you={userId}
      />
      {complete && seal && (
        <MidweekSeed
          seed={seed}
          seedHash={seal}
          seedMatches={seed !== null && seedHash(seed) === seal}
        />
      )}
      {evening && seal && <MidweekSeed seedHash={seal} />}
    </WeekShell>
  );
}
