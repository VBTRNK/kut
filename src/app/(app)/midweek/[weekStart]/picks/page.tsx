import { MidweekPickShares, type PickShareView } from "@/components/midweek/pick-shares";
import { MIDWEEK } from "@/game/midweek/config";
import { getRarityTier } from "@/game/rating-engine";
import { loadPickShares, loadWeekResults } from "@/lib/midweek/results";
import { openWeek, WeekNote, WeekShell } from "../week";

export const metadata = { title: "Who picked whom" };

/**
 * `/midweek/[week]/picks` (DR5-11): who picked whom, once the week is
 * complete, as the week page shows it: owner counts only from
 * `MIDWEEK.ownerCountMin` (ADR-079, ADR-091). Before that, nothing.
 */
export default async function MidweekPicksPage({
  params,
}: {
  params: Promise<{ weekStart: string }>;
}) {
  const { weekStart } = await params;
  const week = await openWeek(weekStart, "Who picked whom");
  if (week.blocked) return week.blocked;
  const { supabase, tournament, date } = week;

  if (tournament.status !== "complete") {
    return (
      <WeekShell sub={date} title="Who picked whom">
        <WeekNote title="After the final">Who picked whom shows once the final is played.</WeekNote>
      </WeekShell>
    );
  }

  const [shares, results] = await Promise.all([
    loadPickShares(supabase, tournament.tournament_id),
    loadWeekResults(supabase, tournament.tournament_id),
  ]);
  // The chip's tier comes from the locked OVR of an entered copy, never today's rating.
  const lockedOvr = new Map(
    results.entries.flatMap((row) => (row.player_id ? [[row.player_id, row.ovr] as const] : [])),
  );
  const rows: PickShareView[] = shares.map((share) => {
    const ovr = lockedOvr.get(share.player_id);
    return {
      playerId: share.player_id,
      name: share.player_name,
      rarity: ovr === undefined ? null : getRarityTier(ovr),
      picks: share.picks,
      owners: share.owners,
      pickFactorPpm: share.pick_factor_ppm,
    };
  });

  return (
    <WeekShell sub={date} title="Who picked whom">
      {rows.length > 0 ? (
        <MidweekPickShares ownerCountMin={MIDWEEK.ownerCountMin} rows={rows} />
      ) : (
        <WeekNote title="No picks">Nobody picked a five this week.</WeekNote>
      )}
    </WeekShell>
  );
}
