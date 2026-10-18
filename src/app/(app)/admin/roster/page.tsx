import { requireAdmin } from "@/lib/auth/admin";
import { fetchLifecycle, type LifecycleRow } from "@/lib/academy";
import { createClient } from "@/lib/supabase/server";
import { AddPlayerForm } from "./add-player-form";
import { GoLiveBlock } from "./go-live-block";
import { RosterTable, type RosterRow } from "./roster-table";

// The injury RPCs judge "no later than today" in Europe/Amsterdam; the date
// picker's default and max follow the same clock.
function amsterdamToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Amsterdam" }).format(new Date());
}

export default async function RosterPage() {
  await requireAdmin();
  const supabase = await createClient();
  const [playersRes, attendanceRes, profilesRes, injuredRes, goLiveRes, creditsRes, lifecycle] =
    await Promise.all([
      supabase
        .schema("kut")
        .from("players")
        .select("id, slug, display_name, archetype, is_active")
        .order("display_name"),
      supabase.schema("kut").from("attendance").select("player_id"),
      supabase
        .schema("kut")
        .from("profiles")
        .select("player_id, is_disabled")
        .not("player_id", "is", null),
      // ADR-082. Non-critical: a failed read shows no injury controls rather
      // than failing the roster (e.g. before the migration reaches hosted).
      supabase
        .schema("kut")
        .from("injured_players")
        .select("player_id, started_on, protected_weeks"),
      // The Academy (ADR-165). Non-critical as well: a failed read shows the
      // roster without stages, clocks or the go-live control.
      supabase.schema("kut").from("academy_go_live").select("week_start").maybeSingle(),
      supabase
        .schema("kut")
        .from("academy_credits")
        .select("player_id, granted_week, reason")
        .order("granted_at", { ascending: false }),
      fetchLifecycle(supabase),
    ]);

  if (playersRes.error || attendanceRes.error || profilesRes.error) {
    throw new Error("Could not load the roster.");
  }

  const withHistory = new Set<string>([
    ...(attendanceRes.data ?? []).map((row) => row.player_id),
    ...(profilesRes.data ?? []).flatMap((row) => (row.player_id ? [row.player_id] : [])),
  ]);
  const withAccount = new Set<string>(
    (profilesRes.data ?? []).flatMap((row) =>
      row.player_id && !row.is_disabled ? [row.player_id] : [],
    ),
  );
  if (injuredRes.error) console.error("roster injured players read failed", injuredRes.error);
  const injuries = injuredRes.error
    ? null
    : new Map(
        (injuredRes.data ?? []).map((row) => [
          row.player_id as string,
          { started_on: row.started_on as string, protected_weeks: row.protected_weeks as number },
        ]),
      );
  if (goLiveRes.error) console.error("roster go-live read failed", goLiveRes.error.code);
  const academyAvailable = !goLiveRes.error && lifecycle.length > 0;
  const goLive = (goLiveRes.data as { week_start?: string } | null)?.week_start ?? null;
  const lifecycleById = new Map<string, LifecycleRow>(lifecycle.map((row) => [row.player_id, row]));
  const credits = new Map<string, { granted_week: string; reason: string }[]>();
  for (const credit of (creditsRes.error ? [] : (creditsRes.data ?? [])) as {
    player_id: string;
    granted_week: string;
    reason: string;
  }[]) {
    credits.set(credit.player_id, [...(credits.get(credit.player_id) ?? []), credit]);
  }
  const players: RosterRow[] = (playersRes.data ?? []).map((player) => ({
    ...player,
    has_history: withHistory.has(player.id),
    has_account: withAccount.has(player.id),
    injury: injuries ? (injuries.get(player.id) ?? null) : undefined,
    lifecycle: lifecycleById.get(player.id) ?? null,
    credits: credits.get(player.id) ?? [],
  }));

  return (
    <main className="board-ground min-h-screen px-4 pt-4 pb-8 text-body text-ink sm:px-8 sm:pt-8">
      {/* The form stays narrow; the roster table gets more room, since the
          injury and Academy columns pushed it past max-w-2xl. */}
      <section className="mx-auto max-w-6xl space-y-8">
        <header className="mx-auto max-w-2xl space-y-3">
          <h1 className="font-serif text-title font-normal sm:text-title-lg">Roster</h1>
          <p className="text-ink-dim">First Team, Talents and Retired Players.</p>
        </header>

        {academyAvailable && (
          <div className="mx-auto max-w-2xl">
            <GoLiveBlock goLive={goLive} />
          </div>
        )}

        <div className="mx-auto max-w-2xl">
          <AddPlayerForm />
        </div>

        <section className="border-t border-panel-2 pt-8">
          <RosterTable
            academy={academyAvailable}
            goLive={goLive}
            players={players}
            today={amsterdamToday()}
          />
        </section>
      </section>
    </main>
  );
}
