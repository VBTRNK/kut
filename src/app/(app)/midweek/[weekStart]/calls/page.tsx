import { MidweekCalls } from "@/components/midweek/calls-list";
import { MidweekLivePoller } from "@/components/midweek/live-poller";
import { MidweekPredictions } from "@/components/midweek/predictions";
import { InfoLink } from "@/components/ui/links";
import { predictionCoins } from "@/game/midweek/rewards";
import { callCards, callRecords, weeklyCallsLine } from "@/lib/midweek/calls";
import { loadCalls } from "@/lib/midweek/results";
import { openWeek, WeekNote, WeekShell, weekNow } from "../week";

export const metadata = { title: "Calls" };

/**
 * `/midweek/[week]/calls` (DR5-11, ADR-118): once you're out, a call for each
 * later match while the evening runs, each closing at its kick-off; once the
 * week is complete, your calls for good, read-only. Before you're out, or for
 * a member who was never in, nothing to call. S6 restyles it (DR5-14).
 */
export default async function MidweekCallsPage({
  params,
}: {
  params: Promise<{ weekStart: string }>;
}) {
  const { weekStart } = await params;
  const week = await openWeek(weekStart, "Calls");
  if (week.blocked) return week.blocked;
  const { supabase, tournament, date } = week;
  const now = new Date();
  const { rounds, results, evening, bracket, night, inPlay, nextKickoff } = await weekNow(
    week,
    now,
  );
  const out = night.rows.some((row) => row.kind === "out");
  const calls = out ? await loadCalls(supabase, tournament.tournament_id) : null;
  const coins = predictionCoins(rounds);
  const how = <InfoLink href="/how-it-works#midweek-calls">How calls work</InfoLink>;

  if (evening && calls) {
    const cards =
      callCards({ bracket, night, predictions: calls.predictions, splits: calls.splits, now }) ??
      [];
    return (
      <WeekShell sub={date} title="Calls">
        <MidweekLivePoller at={now.toISOString()} nextAt={nextKickoff} poll={inPlay} />
        <MidweekPredictions
          at={now.toISOString()}
          cards={cards}
          coins={coins}
          rounds={rounds}
          tournamentId={tournament.tournament_id}
          weekStart={weekStart}
        />
      </WeekShell>
    );
  }

  const records = calls ? callRecords(calls.predictions, results.matches, rounds) : [];
  if (records.length > 0) {
    const right = records.filter((record) => record.correct === true).length;
    return (
      <WeekShell sub={date} title="Calls">
        <MidweekCalls
          coins={coins}
          line={weeklyCallsLine(right, records.length, coins)}
          records={records}
        />
        {how}
      </WeekShell>
    );
  }

  return (
    <WeekShell sub={date} title="Calls">
      <WeekNote title={out ? "No calls" : "Nothing to call"}>
        {out
          ? "You didn’t call any of the matches after yours."
          : "Once you’re out, you can call the winners of the matches still to come."}
      </WeekNote>
      {how}
    </WeekShell>
  );
}
