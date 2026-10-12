import { MidweekWeeklyCalls } from "@/components/midweek/calls-list";
import { MidweekLivePoller } from "@/components/midweek/live-poller";
import { MidweekPath } from "@/components/midweek/path";
import { MidweekMatchRatings, MidweekRatingList } from "@/components/midweek/rating-list";
import { MidweekShare } from "@/components/midweek/share";
import { Block } from "@/components/ui/block";
import { predictionCoins } from "@/game/midweek/rewards";
import { callRecords, weeklyCallsLine } from "@/lib/midweek/calls";
import { championClub, formatClock } from "@/lib/midweek/entry";
import { nextPairing, preMatchHref } from "@/lib/midweek/prematch";
import {
  loadCalls,
  loadLatestMatchRatings,
  loadMyRewards,
  loadNightRatingsFor,
} from "@/lib/midweek/results";
import { shareImages } from "@/lib/midweek/share";
import { openWeek, WeekNote, WeekShell, weekNow } from "../week";

export const metadata = { title: "Your night" };

/**
 * `/midweek/[week]/night` (DR5-11): your rounds and their coins; during the
 * evening your five's ratings for the match just played, from its full time
 * (DR4-8, ADR-150); once the week is complete the night's ratings (DR3,
 * ADR-117), your calls in a line and the share images (ADR-120). What the
 * evening page and the champion view showed, at the same moments. Laid out
 * as DR5-14: link rows, then the ratings block, the calls in one row, and
 * Share the night.
 */
export default async function MidweekNightPage({
  params,
}: {
  params: Promise<{ weekStart: string }>;
}) {
  const { weekStart } = await params;
  const week = await openWeek(weekStart, "Your night");
  if (week.blocked) return week.blocked;
  const { supabase, tournament, userId, date } = week;
  const now = new Date();
  const { rounds, results, evening, bracket, night, inPlay, nextKickoff, scheduleVersion } =
    await weekNow(week, now);
  const complete = tournament.status === "complete";

  // Before round 1 the night has no rows yet; the draw says whether you're in.
  const entered =
    night.entered ||
    results.draw.some((row) => row.side_0_user_id === userId || row.side_1_user_id === userId);
  // The next match's pre-match, once both its feeders have ended (DR4-7, ADR-149).
  const nextRow = night.rows.find((row) => row.kind === "next");
  const preMatch =
    evening && nextRow?.kind === "next" && nextPairing(bracket, nextRow.round, nextRow.pairing)
      ? preMatchHref(weekStart, nextRow.round, nextRow.pairing)
      : null;
  const matchRated =
    evening && entered
      ? await loadLatestMatchRatings(
          supabase,
          { seed_hash: tournament.seed_hash ?? null, rounds, week_start: weekStart },
          results,
          userId,
        )
      : null;

  let after = null;
  if (complete) {
    const championId = tournament.champion_user_id ?? null;
    const [rated, rewards, calls] = await Promise.all([
      // The member's ratings, and the champion's for the poster, in one read.
      loadNightRatingsFor(supabase, tournament, results, [
        userId,
        ...(championId ? [championId] : []),
      ]),
      loadMyRewards(supabase, tournament.tournament_id),
      night.rows.some((row) => row.kind === "out")
        ? loadCalls(supabase, tournament.tournament_id)
        : Promise.resolve(null),
    ]);
    const records = calls ? callRecords(calls.predictions, results.matches, rounds) : [];
    const right = records.filter((record) => record.correct === true).length;
    const perCall = predictionCoins(rounds);
    const share = shareImages({
      lockAt: tournament.lock_at,
      rounds,
      scheduleVersion,
      userId,
      championId,
      championName: championClub(tournament),
      championAccount: tournament.champion_name ?? null,
      matches: results.matches,
      entries: results.entries,
      ratings: rated,
      coins:
        rewards.reduce((sum, row) => sum + Number(row.amount), 0) +
        (calls?.reward ? Number(calls.reward.amount) : right * perCall),
      calls: { right, picks: records.length },
    });
    const ratings = rated.get(userId) ?? null;
    after = (
      <>
        {ratings && <MidweekRatingList ratings={ratings} />}
        {records.length > 0 && (
          <MidweekWeeklyCalls
            href={`/midweek/${weekStart}/calls`}
            line={weeklyCallsLine(right, records.length, perCall)}
          />
        )}
        <MidweekShare night={share.night} poster={share.poster} />
      </>
    );
  }

  if (!entered) {
    // Nothing of your own, but the champion poster is everyone's to share.
    return (
      <WeekShell sub={date} title="Your night">
        <WeekNote title="Not in this one">You weren&rsquo;t in this week&rsquo;s bracket.</WeekNote>
        {after}
      </WeekShell>
    );
  }

  return (
    <WeekShell sub={date} title="Your night">
      <Block
        aside={
          <p className="text-small text-ink-dim">
            +{night.coins}
            {complete
              ? " paid"
              : night.alive
                ? " so far · paid after the final"
                : " · paid after the final"}
          </p>
        }
        id="night-h"
        title="Round by round"
      >
        {night.rows.length === 0 && (
          <p className="text-small text-ink-dim">
            Round 1 kicks off at {formatClock(bracket[0].kickoffAt)}.
          </p>
        )}
        <MidweekPath preMatch={preMatch} rounds={rounds} rows={night.rows} weekStart={weekStart} />
      </Block>
      {matchRated && <MidweekMatchRatings rated={matchRated} />}
      {after}
      {evening && <MidweekLivePoller at={now.toISOString()} nextAt={nextKickoff} poll={inPlay} />}
    </WeekShell>
  );
}
