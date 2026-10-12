import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { MidweekNotice } from "@/components/midweek/bits";
import { Block } from "@/components/ui/block";
import { COLUMN, PAGE, PageHeader } from "@/components/ui/page";
import { MIDWEEK } from "@/game/midweek/config";
import { roundStartAt } from "@/game/midweek/schedule";
import { requireUser } from "@/lib/auth/user";
import {
  formatClock,
  formatDayDate,
  roundIntervalText,
  scheduleVersionOf,
  skipOrVoidNotice,
  type MidweekTournament,
} from "@/lib/midweek/entry";
import { assembleBracket, isWeekStart, myNight } from "@/lib/midweek/evening";
import { loadLiveRowEvents, loadTournamentByWeek, loadWeekResults } from "@/lib/midweek/results";
import { runDueMidweek } from "@/lib/midweek/run-due";
import { createClient } from "@/lib/supabase/server";

/**
 * The pages behind the hub's tiles (DR5-11, ADR-154): `/midweek/[week]/bracket`,
 * `night`, `calls` and `picks`, and the week page itself. Each has a back link
 * and no Compete tabs (one tab row per screen), and reads what the old week
 * page read, at the same moments (DR5-14, ADR-155).
 */

/** A sub-page's frame: the back link to the hub, the Title and the week in Small. */
export function WeekShell({
  title,
  sub,
  children,
  wide = false,
}: {
  title: string;
  sub: string;
  children: ReactNode;
  /** The bracket's tree needs the desktop's width. */
  wide?: boolean;
}) {
  return (
    <main className={PAGE}>
      <div className={`${COLUMN} ${wide ? "lg:max-w-7xl" : ""}`}>
        <PageHeader back={{ href: "/midweek", label: "Midweek" }} sub={sub} title={title} />
        {children}
      </div>
    </main>
  );
}

/** A note on a sub-page with nothing to show yet (or ever, for this member). */
export function WeekNote({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Block title={title}>
      <p className="text-body text-pretty text-ink-dim">{children}</p>
    </Block>
  );
}

export type OpenWeek = {
  userId: string;
  supabase: Awaited<ReturnType<typeof createClient>>;
  tournament: MidweekTournament;
  /** "Wed 7 Oct", the sub-pages' Small line. */
  date: string;
  /**
   * Why there is nothing to show: a void or skipped week (§44.9), or a week
   * not drawn yet. Already a page; the caller returns it.
   */
  blocked: ReactNode | null;
};

/**
 * Opens a week for a sub-page: the member, a due week run first (ADR-098),
 * the week by its start, and, for a week with nothing played, its notice
 * under `title` (the week's date when null). Not a week, or no such week: not
 * found.
 */
export async function openWeek(weekStart: string, title: string | null): Promise<OpenWeek> {
  const user = await requireUser();
  await runDueMidweek();
  if (!isWeekStart(weekStart)) notFound();
  const supabase = await createClient();
  const tournament = await loadTournamentByWeek(supabase, weekStart);
  if (!tournament) notFound();
  const lockAt = tournament.lock_at;
  const date = formatDayDate(lockAt);
  // The week page is titled by its date; a sub-page says the date under its title.
  const heading = title ?? date;
  const sub = title === null ? "Midweek Madness" : date;
  const notice = skipOrVoidNotice(tournament, MIDWEEK.minEntrants);
  let blocked: ReactNode | null = null;
  if (notice) {
    blocked = (
      <WeekShell sub={sub} title={heading}>
        <MidweekNotice tone={notice.tone}>
          <b>{notice.lead}</b> {notice.rest}
        </MidweekNotice>
      </WeekShell>
    );
  } else if (tournament.status === "open" || !tournament.rounds) {
    const scheduleVersion = scheduleVersionOf(tournament);
    const roundOne = formatClock(roundStartAt(new Date(lockAt), 1, scheduleVersion).toISOString());
    blocked = (
      <WeekShell sub={sub} title={heading}>
        <WeekNote title="Not drawn yet">
          The bracket is drawn at the lock, {date} at {formatClock(lockAt)}. Round 1 kicks off at{" "}
          {roundOne}, then a round {roundIntervalText(scheduleVersion)}.
        </WeekNote>
      </WeekShell>
    );
  }
  return { userId: user.id, supabase, tournament, date, blocked };
}

/** The week's results as the bracket and the member's night see them now. */
export async function weekNow(week: OpenWeek, now: Date) {
  const { supabase, tournament, userId } = week;
  const rounds = tournament.rounds as number;
  const lockAt = tournament.lock_at;
  const scheduleVersion = scheduleVersionOf(tournament);
  const results = await loadWeekResults(supabase, tournament.tournament_id, now);
  const evening = tournament.status === "simulated";
  // Every match in play shows its score so far and links to watch it (ADR-148).
  const rowEvents = evening ? await loadLiveRowEvents(supabase, results.matches) : null;
  const bracket = assembleBracket({
    rounds,
    lockAt,
    scheduleVersion,
    draw: results.draw,
    matches: results.matches,
    autoUserIds: new Set(results.entries.filter((row) => row.auto).map((row) => row.user_id)),
    live: rowEvents ? { events: rowEvents, now } : undefined,
  });
  const night = myNight({ userId, rounds, lockAt, scheduleVersion, matches: results.matches });
  // While a match is in play a page asks for itself every 20 seconds,
  // otherwise once at the next kick-off (ADR-115).
  const inPlay = bracket.some((round) => round.pairs.some((pair) => pair.kind === "inplay"));
  const nextKickoff =
    bracket.find((round) => Date.parse(round.kickoffAt) > now.getTime())?.kickoffAt ?? null;
  return { rounds, results, evening, bracket, night, inPlay, nextKickoff, scheduleVersion };
}
