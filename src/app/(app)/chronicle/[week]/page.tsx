import { PAGE, COLUMN, PageHeader } from "@/components/ui/page";
import { Block } from "@/components/ui/block";
import { Tag } from "@/components/ui/tag";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RARITY_BANDS, type RarityTier } from "@/game/rating-engine";
import { countAttributive, countNoun, formatReportedCount } from "@/game/reported-count";
import { requireUser } from "@/lib/auth/user";
import { formatChronicleDate, isMonday, issueStandfirst } from "@/lib/chronicle";
import { finalizeDueSurveys } from "@/lib/session-reports/finalize-due-surveys";
import { createClient } from "@/lib/supabase/server";
import { ACADEMY, fetchLifecycleEvents, tierLabel } from "@/lib/academy";

type Week = {
  week_start: string;
  week_end: string;
  session_count: number;
  appearance_count: number;
  goal_count: number;
};
type Session = {
  id: string;
  session_date: string;
  session_type: string;
  bibs_washed_by: string | null;
  rating_rules_version: number;
};
type Attendance = {
  session_id: string;
  player_id: string;
  goals: number;
  players: { display_name: string; slug: string } | null;
};
type ReportResult = {
  session_id: string;
  player_id: string;
  display_name: string;
  slug: string;
  effective_goals: number | null;
  recognized_categories: string[];
  submitted_reports: number;
  eligible_accounts: number;
  attendee_count: number;
};
type ReportProgress = {
  session_id: string;
  survey_status: string;
  closes_at: string;
  attendee_count: number;
  submitted_reports: number;
  eligible_accounts: number;
  goal_total: number;
  accepting_reports: boolean;
};
type MyReport = { session_id: string; report_status: string | null };
type Crossing = {
  player_id: string;
  slug: string;
  display_name: string;
  from_tier: RarityTier;
  to_tier: RarityTier;
  live_ovr: number;
};

const TYPE: Record<string, string> = { monday: "Monday", friday: "Friday", other: "Session" };
// Tier order for "did this player move up?" — derived so it cannot drift from the
// rarity bands the rest of the app renders.
const TIERS: RarityTier[] = RARITY_BANDS.map((band) => band.tier);

export const metadata = { title: "Chronicle issue" };

function TierLabel({ tier }: { tier: RarityTier }) {
  return (
    <Tag>
      <span className="capitalize">{tier}</span>
    </Tag>
  );
}

function groupBySession<T extends { session_id: string }>(rows: T[]): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const row of rows) {
    const bucket = grouped.get(row.session_id);
    if (bucket) bucket.push(row);
    else grouped.set(row.session_id, [row]);
  }
  return grouped;
}

function reportCloseLabel(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Amsterdam",
  }).format(new Date(value));
}

export default async function ChronicleIssuePage({
  params,
}: {
  params: Promise<{ week: string }>;
}) {
  await requireUser();
  const { week } = await params;
  if (!isMonday(week)) notFound();
  // Finalize any survey whose window has closed before we read this issue, so a
  // just-closed session shows finalized results rather than "being prepared".
  await finalizeDueSurveys();
  const supabase = await createClient();
  const { data: issue, error } = await supabase
    .schema("kut")
    .from("chronicle_weeks")
    .select("week_start,week_end,session_count,appearance_count,goal_count")
    .eq("week_start", week)
    .maybeSingle();
  if (error) throw new Error("Could not load this Chronicle issue.");
  if (!issue) notFound();
  const current = issue as Week;

  const [sessionsResponse, crossingsResponse, lifecycleEvents] = await Promise.all([
    supabase
      .schema("kut")
      .from("match_sessions")
      .select("id,session_date,session_type,bibs_washed_by,rating_rules_version")
      .eq("status", "published")
      .gte("session_date", current.week_start)
      .lte("session_date", current.week_end)
      .order("session_date"),
    supabase
      .schema("kut")
      .from("chronicle_tier_changes")
      .select("player_id,slug,display_name,from_tier,to_tier,live_ovr")
      .eq("week_start", week),
    // The roster (ADR-165): promotions, retirements and returns from go-live,
    // with the card as it was at the event. At risk is not news. Empty on a
    // failed read or before go-live.
    fetchLifecycleEvents(supabase),
  ]);
  const rosterRows = lifecycleEvents
    .filter((event) => event.effective_week === week)
    .map((event) => {
      const comeback =
        event.kind === "promotion" &&
        lifecycleEvents.some(
          (earlier) =>
            earlier.kind === "retirement" &&
            earlier.player_id === event.player_id &&
            earlier.effective_week < event.effective_week,
        );
      const card = `${tierLabel(event.rarity_tier)} ${event.live_ovr}`;
      return event.kind === "retirement"
        ? {
            event,
            tag: { tone: "out" as const, text: "Retired" },
            text: `${event.display_name} retires`,
            meta: `${ACADEMY.retireWeeks} counted weeks without a game · ${card} · copies stay tradeable`,
          }
        : comeback
          ? {
              event,
              tag: { tone: "won" as const, text: "Back" },
              text: `${event.display_name} is back in the First Team`,
              meta: `Out of retirement with the same card · ${card}`,
            }
          : {
              event,
              tag: { tone: "won" as const, text: "Promoted" },
              text: `${event.display_name} joins the First Team`,
              meta: `${event.reason === "admin" ? "Added to the First Team" : "From the Academy"} · ${card} · in packs`,
            };
    });
  if (sessionsResponse.error || crossingsResponse.error)
    throw new Error("Could not load the matchday reports.");
  const sessions = (sessionsResponse.data ?? []) as Session[];
  const sessionIds = sessions.map((session) => session.id);

  const [attendanceResponse, resultsResponse, progressResponse, myReportsResponse] =
    await Promise.all([
      supabase
        .schema("kut")
        .from("attendance")
        .select("session_id,player_id,goals,players(display_name,slug)")
        .in("session_id", sessionIds),
      supabase
        .schema("kut")
        .from("chronicle_session_reports")
        .select(
          "session_id,player_id,display_name,slug,effective_goals,recognized_categories,submitted_reports,eligible_accounts,attendee_count",
        )
        .in("session_id", sessionIds),
      supabase
        .schema("kut")
        .from("chronicle_session_report_status")
        .select(
          "session_id,survey_status,closes_at,attendee_count,submitted_reports,eligible_accounts,goal_total,accepting_reports",
        )
        .in("session_id", sessionIds),
      supabase
        .schema("kut")
        .from("my_session_reports")
        .select("session_id,report_status")
        .in("session_id", sessionIds),
    ]);
  if (
    attendanceResponse.error ||
    resultsResponse.error ||
    progressResponse.error ||
    myReportsResponse.error
  ) {
    throw new Error("Could not load session reporting progress.");
  }

  const attendanceBySession = groupBySession(
    (attendanceResponse.data ?? []) as unknown as Attendance[],
  );
  const resultsBySession = groupBySession((resultsResponse.data ?? []) as ReportResult[]);
  const progressBySession = new Map(
    ((progressResponse.data ?? []) as ReportProgress[]).map((row) => [row.session_id, row]),
  );
  const myReportBySession = new Map(
    ((myReportsResponse.data ?? []) as MyReport[]).map((row) => [row.session_id, row]),
  );
  const hasUnfinalizedReports = ((progressResponse.data ?? []) as ReportProgress[]).some(
    (row) => row.survey_status !== "finalized",
  );
  const crossings = ((crossingsResponse.data ?? []) as Crossing[]).filter(
    (row) => TIERS.indexOf(row.to_tier) > TIERS.indexOf(row.from_tier),
  );

  return (
    <main className={PAGE}>
      <section className={COLUMN}>
        <PageHeader
          title={`Week of ${formatChronicleDate(current.week_start)}`}
          back={{ href: "/chronicle", label: "All issues" }}
          sub={`${formatChronicleDate(current.week_start)} – ${formatChronicleDate(current.week_end, { day: "numeric", month: "long", year: "numeric" })}`}
        />
        <p className="text-body">
          {issueStandfirst(
            current.session_count,
            current.appearance_count,
            current.goal_count,
            current.week_start,
          )}
        </p>
        {hasUnfinalizedReports && (
          <p className="text-small text-ink-dim">
            The {countAttributive(current.week_start)} total is provisional until reporting is
            finalized.
          </p>
        )}

        {sessions.map((session) => {
          const attendance = (attendanceBySession.get(session.id) ?? []).sort(
            (a, b) =>
              b.goals - a.goals ||
              (a.players?.display_name ?? "").localeCompare(b.players?.display_name ?? ""),
          );
          const results = (resultsBySession.get(session.id) ?? []).sort(
            (a, b) =>
              (b.effective_goals ?? 0) - (a.effective_goals ?? 0) ||
              a.display_name.localeCompare(b.display_name),
          );
          const progress = progressBySession.get(session.id);
          const myReport = myReportBySession.get(session.id);
          const reportsOpen = progress?.accepting_reports === true;
          const reportsFinalized = progress?.survey_status === "finalized";
          const goals =
            session.rating_rules_version === 2
              ? (progress?.goal_total ?? 0)
              : attendance.reduce((sum, row) => sum + row.goals, 0);
          const bibs = session.bibs_washed_by
            ? attendance.find((row) => row.player_id === session.bibs_washed_by)?.players
                ?.display_name
            : null;
          // Goals before the week of 28 Sep 2026, goals + assists from it (ADR-101).
          const noun = countNoun(session.session_date);
          const goalLabel =
            session.rating_rules_version === 2 && reportsOpen
              ? `${noun} reported so far`
              : session.rating_rules_version === 2
                ? `reported ${noun}`
                : noun;

          return (
            <Block
              title={`${TYPE[session.session_type] ?? "Session"} ${formatChronicleDate(session.session_date)}`}
              aside={
                <p className="text-small text-ink-dim">
                  {attendance.length} in · {goals} {goalLabel}
                </p>
              }
              id={`s-${session.id}`}
              key={session.id}
            >
              {bibs && <p className="text-small text-ink-dim">Bibs by {bibs}</p>}

              {session.rating_rules_version === 2 ? (
                reportsFinalized ? (
                  results.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-line p-4 text-small text-ink-dim">
                      Results finalized. No report results were recorded.
                    </p>
                  ) : (
                    <>
                      <p className="text-small text-ink-dim">
                        {progress?.submitted_reports ?? results[0].submitted_reports} of{" "}
                        {progress?.eligible_accounts ?? results[0].eligible_accounts} reports
                        submitted &middot; {progress?.attendee_count ?? results[0].attendee_count}{" "}
                        attendees
                      </p>
                      <ol className="grid gap-x-8 sm:grid-cols-2">
                        {results.map((row) => (
                          <li className="border-b border-line/30 py-3" key={row.player_id}>
                            <div className="flex justify-between gap-4">
                              <Link
                                prefetch={false}
                                className="inline-flex min-h-11 items-center hover:text-brass hover:underline"
                                href={`/players/${row.slug}`}
                              >
                                {row.display_name}
                              </Link>
                              <span className="self-center font-semibold tabular-nums">
                                {row.effective_goals === null
                                  ? "Not reported"
                                  : formatReportedCount(row.effective_goals, session.session_date)}
                              </span>
                            </div>
                            {row.recognized_categories.length > 0 && (
                              <p className="text-small text-ink-dim">
                                {row.recognized_categories.join(" · ")}
                              </p>
                            )}
                          </li>
                        ))}
                      </ol>
                    </>
                  )
                ) : reportsOpen ? (
                  <section className="rounded-xl bg-panel-2/80 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-body font-semibold">Reports open</p>
                        <p className="mt-1 text-small text-ink-dim">
                          {progress?.submitted_reports ?? 0} of {progress?.eligible_accounts ?? 0}{" "}
                          reports submitted &middot; closes{" "}
                          {progress ? reportCloseLabel(progress.closes_at) : "soon"}
                        </p>
                      </div>
                      {myReport && (
                        <Link
                          className="inline-flex min-h-11 items-center rounded-xl border border-line bg-panel px-4 text-body font-semibold hover:border-brass-line"
                          href={`/sessions/${session.id}/report`}
                        >
                          {myReport.report_status === "submitted"
                            ? "View your report"
                            : `Add ${noun} & kudos`}
                        </Link>
                      )}
                    </div>
                    <p className="mt-3 text-small text-ink-faint">
                      {goals} {noun} reported so far. Final player results and recognized kudos
                      appear after reporting closes.
                    </p>
                  </section>
                ) : (
                  <p className="rounded-xl border border-dashed border-line p-4 text-small text-ink-dim">
                    Reports closed &middot; {progress?.submitted_reports ?? 0} of{" "}
                    {progress?.eligible_accounts ?? 0} submitted &middot; results are being
                    prepared.
                  </p>
                )
              ) : attendance.length === 0 ? (
                <p className="text-ink-dim">No attendance was recorded.</p>
              ) : (
                <ol className="grid gap-x-8 sm:grid-cols-2">
                  {attendance.map((row) => (
                    <li
                      className="flex justify-between gap-4 border-b border-line/30 py-2.5"
                      key={row.player_id}
                    >
                      {row.players?.slug ? (
                        <Link
                          prefetch={false}
                          className="inline-flex min-h-11 items-center hover:text-brass hover:underline"
                          href={`/players/${row.players.slug}`}
                        >
                          {row.players.display_name}
                        </Link>
                      ) : (
                        <span>{row.players?.display_name ?? "A player"}</span>
                      )}
                      <span className="self-center font-semibold tabular-nums">
                        {row.goals ? formatReportedCount(row.goals, session.session_date) : "—"}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </Block>
          );
        })}

        {rosterRows.length > 0 && (
          <Block id="roster" title="The roster">
            <ul className="grid">
              {rosterRows.map((row) => (
                <li
                  className="grid grid-cols-[minmax(0,1fr)] gap-1 border-b border-line/40 py-2.5 last:border-b-0"
                  key={row.event.id}
                >
                  <span className="flex flex-wrap items-center gap-2 text-body">
                    <Tag tone={row.tag.tone}>{row.tag.text}</Tag>
                    <Link
                      prefetch={false}
                      className="inline-flex min-h-11 min-w-0 items-center font-semibold hover:text-brass"
                      href={`/players/${row.event.slug}`}
                    >
                      {row.text}
                    </Link>
                  </span>
                  <span className="text-small text-ink-dim">{row.meta}</span>
                </li>
              ))}
            </ul>
          </Block>
        )}

        {crossings.length > 0 && (
          <Block title="Crossings">
            <ol className="grid">
              {crossings.map((row) => (
                <li
                  className="grid min-h-12 items-center gap-2 border-b border-line/40 py-3 last:border-b-0 min-[360px]:grid-cols-[minmax(0,1fr)_auto]"
                  key={row.player_id}
                >
                  <Link
                    prefetch={false}
                    className="inline-flex min-h-11 min-w-0 items-center text-body hover:text-brass min-[360px]:truncate"
                    href={`/players/${row.slug}`}
                  >
                    {row.display_name}
                  </Link>
                  <span className="flex min-w-0 items-center gap-2">
                    <TierLabel tier={row.from_tier} />
                    <span aria-hidden="true" className="text-ink-faint">
                      &rarr;
                    </span>
                    <TierLabel tier={row.to_tier} />
                    <b className="ml-auto text-body font-semibold tabular-nums sm:ml-2">
                      {row.live_ovr}
                    </b>
                  </span>
                </li>
              ))}
            </ol>
          </Block>
        )}
      </section>
    </main>
  );
}
