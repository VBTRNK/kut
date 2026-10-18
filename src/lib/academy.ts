import type { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * The Academy (ADR-165, #246): Talent → First Team → Retired. SQL decides every
 * stage, progress and clock (`kut._evaluate_lifecycle`); this file only reads
 * the member projections and words them. Nothing here re-derives a rule.
 *
 * "Feature unavailable" is never an error: no go-live row, a member before
 * go-live (the projections return no rows) and a schema older than
 * `20261024000000` all read as an empty Academy.
 */

export type LifecycleStage = "talent" | "first_team" | "retired";

/** The rule numbers the copy quotes; SQL owns them. */
export const ACADEMY = {
  promoteAt: 3,
  windowWeeks: 8,
  atRiskWeeks: 8,
  retireWeeks: 12,
  maxCredits: 2,
} as const;

/** A `kut.player_lifecycle_public` row (members from go-live, admins always). */
export type LifecycleRow = {
  player_id: string;
  slug: string;
  display_name: string;
  archetype: string;
  photo_path: string | null;
  is_active: boolean;
  lifecycle_stage: LifecycleStage;
  live_ovr: number;
  rarity_tier: "common" | "bronze" | "silver" | "gold" | "holo" | "elite";
  progress: number;
  progress_weeks: number;
  progress_credits: number;
  academy_visible: boolean;
  fading: boolean;
  /** ISO Mondays; null until the Player's first evaluation. */
  window_weeks: string[] | null;
  played_weeks: string[] | null;
  credit_weeks: string[] | null;
  /** The First Team clock; null for a Talent and before go-live. */
  absent_weeks: number | null;
  at_risk: boolean;
  clock_start: string | null;
  retired_week: string | null;
  promoted_week: string | null;
};

/** A `kut.player_lifecycle_events_public` row: the Chronicle's roster facts. */
export type LifecycleEvent = {
  id: string;
  player_id: string;
  slug: string;
  display_name: string;
  kind: "promotion" | "retirement";
  effective_week: string;
  reason: "progress" | "admin" | null;
  live_ovr: number;
  rarity_tier: string;
  created_at: string;
};

/** The go-live week, or null while the Academy is unavailable to this reader. */
export async function fetchAcademyGoLive(supabase: SupabaseServerClient): Promise<string | null> {
  const { data, error } = await supabase
    .schema("kut")
    .from("academy_status")
    .select("*")
    .maybeSingle();
  if (error) {
    console.error("academy status read failed", error.code);
    return null;
  }
  return (data as { go_live_week?: string } | null)?.go_live_week ?? null;
}

/** Lifecycle rows, optionally for one Player; empty when unavailable. */
export async function fetchLifecycle(
  supabase: SupabaseServerClient,
  filter: { slug?: string; playerId?: string; stage?: LifecycleStage } = {},
): Promise<LifecycleRow[]> {
  let request = supabase.schema("kut").from("player_lifecycle_public").select("*");
  if (filter.slug) request = request.eq("slug", filter.slug);
  if (filter.playerId) request = request.eq("player_id", filter.playerId);
  if (filter.stage) request = request.eq("lifecycle_stage", filter.stage);
  const { data, error } = await request.order("display_name");
  if (error) {
    console.error("player lifecycle read failed", error.code);
    return [];
  }
  return (data ?? []) as LifecycleRow[];
}

/** Promotions and retirements from go-live, optionally from one week on. */
export async function fetchLifecycleEvents(
  supabase: SupabaseServerClient,
  filter: { week?: string; kind?: LifecycleEvent["kind"] } = {},
): Promise<LifecycleEvent[]> {
  let request = supabase.schema("kut").from("player_lifecycle_events_public").select("*");
  if (filter.week) request = request.eq("effective_week", filter.week);
  if (filter.kind) request = request.eq("kind", filter.kind);
  const { data, error } = await request.order("created_at");
  if (error) {
    console.error("lifecycle events read failed", error.code);
    return [];
  }
  return (data ?? []) as LifecycleEvent[];
}

/** A card row's stage: Retired only when a current view says so. */
export function isRetiredRow(row: {
  lifecycle_stage?: string | null;
  player_stage?: string | null;
}) {
  return (row.player_stage ?? row.lifecycle_stage) === "retired";
}

/** The album's roster: the First Team (warned or not), never Retired Players. */
export function firstTeamOnly<T extends { lifecycle_stage?: string | null }>(rows: readonly T[]) {
  return rows.filter((row) => !isRetiredRow(row));
}

/** The words for a progress: "2 of 3 weeks", "1 week + 1 credit". */
export function progressWords(real: number, credits: number) {
  const weeks = `${real} ${real === 1 ? "week" : "weeks"}`;
  return credits
    ? `${weeks} + ${credits} ${credits === 1 ? "credit" : "credits"}`
    : `${real} of ${ACADEMY.promoteAt} weeks`;
}

const DAY_MONTH = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});
const DAY_MONTH_YEAR = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

/** An ISO Monday as "25 Jan". */
export function weekLabel(week: string) {
  return DAY_MONTH.format(new Date(`${week}T00:00:00Z`));
}

/** An ISO Monday as "19 Oct 2026". */
export function weekLabelLong(week: string) {
  return DAY_MONTH_YEAR.format(new Date(`${week}T00:00:00Z`));
}

/** The ISO Monday of the football week (club time) that `now` falls in. */
export function footballWeek(now: Date) {
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Amsterdam" }).format(now);
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return date.toISOString().slice(0, 10);
}

export type StripWeek = {
  day: string;
  month: string;
  kind: "played" | "credit" | "missed" | "before";
};

/**
 * The last eight counted weeks as a strip: played, a credit granted that week
 * (never shown as a game), before a retirement (a comeback's real weeks only
 * count after it), or missed.
 */
export function weekStrip(row: LifecycleRow): StripWeek[] {
  const played = new Set(row.played_weeks ?? []);
  const credits = new Set(row.credit_weeks ?? []);
  return (row.window_weeks ?? []).map((week) => {
    const [day, month] = weekLabel(week).split(" ");
    const kind: StripWeek["kind"] = played.has(week)
      ? "played"
      : credits.has(week)
        ? "credit"
        : row.retired_week && week <= row.retired_week
          ? "before"
          : "missed";
    return { day, month, kind };
  });
}

/** Counted weeks left before a First Team Player retires. */
export function weeksToRetire(row: Pick<LifecycleRow, "absent_weeks">) {
  return Math.max(0, ACADEMY.retireWeeks - (row.absent_weeks ?? 0));
}

/** The line under a Talent or comeback in the Academy. */
export function academyLine(row: LifecycleRow) {
  const words = progressWords(row.progress_weeks, row.progress_credits);
  const left = Math.max(0, ACADEMY.promoteAt - row.progress);
  if (row.lifecycle_stage === "retired") {
    const since = row.retired_week ? `Retired ${weekLabel(row.retired_week)} · ` : "";
    return `${since}${words} · ${left <= 1 ? "one more week brings them back" : `${left} more weeks bring them back`}`;
  }
  if (row.fading) return `${words} · a week drops off unless they play next week`;
  return `${words} · ${left <= 1 ? "one more week promotes" : `${left} more weeks promote`}`;
}

/** "bronze" → "Bronze". */
export function tierLabel(tier: string) {
  return tier ? `${tier[0].toUpperCase()}${tier.slice(1)}` : tier;
}
