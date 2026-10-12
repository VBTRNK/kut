import { notFound } from "next/navigation";
import { MidweekNotice } from "@/components/midweek/bits";
import { ReportText } from "@/components/midweek/player-name";
import {
  MidweekPenalties,
  MidweekScoreboard,
  MidweekTimeline,
  ReportLayout,
  reportLine,
  reportTab,
  type Clubs,
} from "@/components/midweek/report";
import { MidweekWhyList } from "@/components/midweek/why-list";
import { COLUMN, PAGE, PageHeader } from "@/components/ui/page";
import { MIDWEEK } from "@/game/midweek/config";
import { requireUser } from "@/lib/auth/user";
import { formatDayDate, scheduleVersionOf, skipOrVoidNotice } from "@/lib/midweek/entry";
import { isWeekStart } from "@/lib/midweek/evening";
import { maskInPlay } from "@/lib/midweek/live";
import { loadLiveMatch, loadMatchEnds } from "@/lib/midweek/live-load";
import { reportInputFromRows, renderStoredReport } from "@/lib/midweek/report/from-db";
import { matchRatings } from "@/lib/midweek/report/ratings";
import { loadTournamentByWeek } from "@/lib/midweek/results";
import { sideClub, type EntryCardRow, type EventRow, type MatchRow } from "@/lib/midweek/rows";
import { runDueMidweek } from "@/lib/midweek/run-due";
import { createClient } from "@/lib/supabase/server";
import { InPlayMatch } from "./in-play";
import { isUuid } from "@/lib/uuid";

export const metadata = { title: "Midweek Madness match report" };

/**
 * `/midweek/[weekStart]/match/[matchId]`: one match's report (ADR-111, as
 * DR5-15 lays it out), rendered on the server from the stored match, its
 * events and both sides' lock-time entries, every name but the headline's in
 * its side's colour. Two tabs, Match and Teams (`?tab=teams`), both in the
 * page and side by side from `lg`. A match that isn't revealed yet, a bye or
 * a void week has no report. Every match in play shows live, chance by
 * chance, without its result (`InPlayMatch`, ADR-115, ADR-147). From the
 * match's full time Teams adds each card's rating for this match (ADR-117,
 * ADR-150): it needs only this match, so not the week's end.
 */
export default async function MidweekReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ weekStart: string; matchId: string }>;
  searchParams: Promise<{ tab?: string | string[] }>;
}) {
  const user = await requireUser();
  await runDueMidweek();
  const { weekStart, matchId } = await params;
  const tab = reportTab((await searchParams).tab);
  // Both segments are checked before any query (KB-007).
  if (!isWeekStart(weekStart) || !isUuid(matchId)) notFound();
  const supabase = await createClient();
  const tournament = await loadTournamentByWeek(supabase, weekStart);
  if (!tournament) notFound();

  const back = `/midweek/${weekStart}/bracket`;
  const base = `/midweek/${weekStart}/match/${matchId}`;
  const notice = skipOrVoidNotice(tournament, MIDWEEK.minEntrants);
  if (notice) {
    return (
      <main className={PAGE}>
        <div className={COLUMN}>
          <PageHeader
            back={{ href: back, label: "Bracket" }}
            sub={`Midweek Madness · ${formatDayDate(tournament.lock_at)}`}
            title="Match report"
          />
          <MidweekNotice tone={notice.tone}>
            <b>{notice.lead}</b> {notice.rest}
          </MidweekNotice>
        </div>
      </main>
    );
  }
  if (!tournament.rounds) notFound();

  const [matchResponse, eventsResponse] = await Promise.all([
    supabase
      .schema("kut")
      .from("midweek_matches_public")
      .select("*")
      .eq("tournament_id", tournament.tournament_id)
      .eq("match_id", matchId)
      .maybeSingle(),
    supabase
      .schema("kut")
      .from("midweek_events_public")
      .select("*")
      .eq("match_id", matchId)
      .order("seq"),
  ]);
  if (matchResponse.error || eventsResponse.error) throw new Error("Could not load this match.");
  const match = matchResponse.data as MatchRow | null;
  // Not revealed yet reads as zero rows, the same as no such match.
  if (!match || match.bye || match.side_1_user_id === null) notFound();

  const entriesResponse = await supabase
    .schema("kut")
    .from("midweek_entries_public")
    .select("*")
    .eq("tournament_id", tournament.tournament_id)
    .in("user_id", [match.side_0_user_id, match.side_1_user_id]);
  if (entriesResponse.error) throw new Error("Could not load this match's squads.");

  // A match in play shows no result before its full time (ADR-106, ADR-115):
  // every match live, chance by chance (ADR-147).
  const now = new Date();
  const ends =
    tournament.status === "simulated"
      ? await loadMatchEnds(tournament.tournament_id)
      : new Map<string, string | null>();
  const [shown] = maskInPlay([match], ends, now);
  if (shown.in_play) {
    const entries = (entriesResponse.data ?? []) as EntryCardRow[];
    const rounds = tournament.rounds;
    const scheduleVersion = scheduleVersionOf(tournament);
    const yours =
      shown.side_0_user_id === user.id ? 0 : shown.side_1_user_id === user.id ? 1 : null;
    const live = await loadLiveMatch(supabase, {
      tournament: {
        tournament_id: tournament.tournament_id,
        seed_hash: tournament.seed_hash,
        rounds,
      },
      scheduleVersion,
      match: shown,
      now,
    });
    const autoOf = (id: string | null) => entries.some((row) => row.user_id === id && row.auto);
    return (
      <InPlayMatch
        auto={[autoOf(shown.side_0_user_id), autoOf(shown.side_1_user_id)]}
        back={back}
        base={base}
        kickoffAt={shown.reveal_at}
        live={live}
        clubs={[sideClub(shown, 0), sideClub(shown, 1)]}
        now={now.toISOString()}
        scheduleVersion={scheduleVersion}
        sub={reportLine({
          round: shown.round,
          pairing: shown.pairing,
          rounds,
          live: true,
          yours: yours !== null,
        })}
        tab={tab}
        youSide={yours}
      />
    );
  }

  const input = reportInputFromRows({
    seedHash: tournament.seed_hash ?? "",
    rounds: tournament.rounds,
    match,
    events: (eventsResponse.data ?? []) as EventRow[],
    entries: (entriesResponse.data ?? []) as EntryCardRow[],
    // Owner counts are published once the week is complete (D3).
    ownersPublished: tournament.status === "complete",
  });
  if (!input) notFound();
  const report = renderStoredReport(input);
  // Past the in-play branch above, so this match has ended (ADR-150).
  const ratings = matchRatings(input).map((side) => side.map((card) => card.rating)) as [
    number[],
    number[],
  ];
  const clubs: Clubs = [input.sides[0].club, input.sides[1].club];
  const youSide =
    match.side_0_user_id === user.id ? 0 : match.side_1_user_id === user.id ? 1 : null;

  return (
    <ReportLayout
      back={back}
      base={base}
      board={
        <MidweekScoreboard
          auto={[input.sides[0].auto, input.sides[1].auto]}
          goals={input.outcome.goals}
          clubs={clubs}
          penalties={input.outcome.penalties}
          winnerSide={input.outcome.winnerSide}
          youSide={youSide}
        />
      }
      match={
        <>
          {report.facts.length > 0 && (
            <ul className="grid list-disc gap-2 pl-5 text-body marker:text-ink-faint">
              {report.facts.map((fact, index) => (
                <li className="text-pretty" key={index}>
                  <ReportText parts={fact.parts} />
                </li>
              ))}
            </ul>
          )}
          <MidweekTimeline clubs={clubs} timeline={report.timeline} />
          {report.shootout && <MidweekPenalties clubs={clubs} shootout={report.shootout} />}
        </>
      }
      sub={reportLine({
        round: match.round,
        pairing: match.pairing,
        rounds: tournament.rounds,
        live: false,
        yours: youSide !== null,
      })}
      tab={tab}
      teams={<MidweekWhyList ratings={ratings} why={report.why} />}
      title={<ReportText parts={report.headlineParts} plain />}
    />
  );
}
