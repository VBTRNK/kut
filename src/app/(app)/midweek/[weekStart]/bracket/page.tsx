import { MidweekBracket } from "@/components/midweek/bracket";
import { MidweekLivePoller } from "@/components/midweek/live-poller";
import { MidweekSeed } from "@/components/midweek/seed";
import { seedHash } from "@/game/midweek/rng";
import { callCards, rowCalls } from "@/lib/midweek/calls";
import { championClub } from "@/lib/midweek/entry";
import { loadCalls } from "@/lib/midweek/results";
import { openWeek, WeekShell, weekNow } from "../week";

export const metadata = { title: "Midweek Madness bracket" };

/**
 * `/midweek/[week]/bracket` (DR5-11, DR5-14): the bracket behind the hub's
 * tile. On a phone a block per round, the latest first; from `lg` the tree.
 * The fairness seal folds away at the foot, with the seed once the week is
 * complete. A member who is out sees their call on each later row, and a
 * row they can call opens its pre-match, where the call is made (ADR-118,
 * ADR-149). While a match is in play the page asks for itself every 20
 * seconds, otherwise once at the next kick-off (ADR-115).
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
  const { evening, bracket, night, inPlay, nextKickoff } = await weekNow(week, now);
  const calls =
    evening && night.rows.some((row) => row.kind === "out")
      ? await loadCalls(supabase, tournament.tournament_id)
      : null;
  const cards = calls
    ? callCards({ bracket, night, predictions: calls.predictions, splits: calls.splits, now })
    : null;
  const seed = tournament.seed ?? null;
  const seal = tournament.seed_hash ?? "";
  const complete = tournament.status === "complete";
  const club = championClub(tournament);

  return (
    <WeekShell sub={complete && club ? `${date} · won by ${club}` : date} title="Bracket" wide>
      <MidweekBracket
        calls={cards ? rowCalls(cards) : undefined}
        now={now}
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
      {evening && <MidweekLivePoller at={now.toISOString()} nextAt={nextKickoff} poll={inPlay} />}
    </WeekShell>
  );
}
