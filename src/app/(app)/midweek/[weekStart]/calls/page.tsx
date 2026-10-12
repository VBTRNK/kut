import { MidweekCalls } from "@/components/midweek/calls-list";
import { MidweekLivePoller } from "@/components/midweek/live-poller";
import { MidweekPredictions, type CallLink } from "@/components/midweek/predictions";
import { InfoLink } from "@/components/ui/links";
import { predictionCoins } from "@/game/midweek/rewards";
import {
  callCards,
  callRecords,
  callsHeading,
  weeklyCallsLine,
  type CallCard,
} from "@/lib/midweek/calls";
import type { BracketRound } from "@/lib/midweek/evening";
import { preMatchHref } from "@/lib/midweek/prematch";
import { loadCalls } from "@/lib/midweek/results";
import { openWeek, WeekNote, WeekShell, weekNow } from "../week";

export const metadata = { title: "Calls" };

/** Where each call leads (owner, DR5-14): its pre-match while open, the match in play, its report once ended. */
function callLinks(
  cards: readonly CallCard[],
  bracket: readonly BracketRound[],
  weekStart: string,
): Map<string, CallLink> {
  const links = new Map<string, CallLink>();
  for (const card of cards) {
    const pair = bracket[card.round - 1]?.pairs[card.pairing];
    const key = `${card.round}/${card.pairing}`;
    if (pair?.kind === "upcoming" && pair.preMatch) {
      links.set(key, {
        label: "Pre-match",
        href: preMatchHref(weekStart, card.round, card.pairing),
      });
    } else if (pair?.kind === "inplay") {
      links.set(key, {
        label: "Watch it",
        href: `/midweek/${weekStart}/match/${pair.match.match_id}`,
      });
    } else if (pair?.kind === "played") {
      links.set(key, {
        label: "Report",
        href: `/midweek/${weekStart}/match/${pair.match.match_id}`,
      });
    }
  }
  return links;
}

/**
 * `/midweek/[week]/calls` (DR5-11, DR5-14, ADR-118): once you're out, a call
 * for each later match while the evening runs, each a block of its own that
 * closes at its kick-off and leads to its match; once the week is complete,
 * your calls for good, read-only. Before you're out, or for a member who was
 * never in, nothing to call. The rule is behind `How calls work ›`.
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
      <WeekShell sub={`${date} · ${callsHeading(cards, rounds, false).note}`} title="Calls">
        <div className="grid">
          <p className="text-small text-pretty text-ink-dim">
            Call the winners still to come. Everyone sees the split from kick-off.
          </p>
          {how}
        </div>
        <MidweekPredictions
          at={now.toISOString()}
          cards={cards}
          coins={coins}
          links={callLinks(cards, bracket, weekStart)}
          tournamentId={tournament.tournament_id}
        />
        <MidweekLivePoller at={now.toISOString()} nextAt={nextKickoff} poll={inPlay} />
      </WeekShell>
    );
  }

  const records = calls ? callRecords(calls.predictions, results.matches, rounds) : [];
  if (records.length > 0) {
    const right = records.filter((record) => record.correct === true).length;
    return (
      <WeekShell sub={date} title="Calls">
        <MidweekCalls line={weeklyCallsLine(right, records.length, coins)} records={records} />
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
