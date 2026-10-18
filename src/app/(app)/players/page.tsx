import { PAGE, COLUMN, PageHeader, CardGrid } from "@/components/ui/page";
import Link from "next/link";
import { AcademyBlock } from "@/components/academy";
import { LinkRow } from "@/components/ui/links";
import { Tag } from "@/components/ui/tag";
import { FilterBar } from "@/components/filter-bar";
import { ARCHETYPES, ARCHETYPE_LABELS, isArchetype } from "@/game/archetypes";
import { LiveCard, type LiveCardPlayer } from "@/components/live-card";
import { requireUser } from "@/lib/auth/user";
import { CompeteTabs } from "@/components/app-shell/compete-tabs";
import { fetchInjuredPlayerIds } from "@/lib/injuries";
import { toLiveCardPlayer } from "@/lib/live-card-player";
import { resolvePhotoUrls } from "@/lib/player-photos";
import { createClient } from "@/lib/supabase/server";
import { fetchAcademyGoLive, fetchLifecycle, footballWeek, isRetiredRow } from "@/lib/academy";

export const metadata = { title: "Players" };

type DirectoryRow = {
  id: string;
  slug: string;
  display_name: string;
  archetype: string;
  photo_path: string | null;
  live_ovr: number;
  pac: number;
  sho: number;
  pas: number;
  dri: number;
  def: number;
  phy: number;
  rarity_tier: LiveCardPlayer["rarityTier"];
  // Appended by 20261024000000 (ADR-165); absent on an older schema.
  lifecycle_stage?: string | null;
  at_risk?: boolean | null;
};

const RARITIES = ["common", "bronze", "silver", "gold", "holo", "elite"] as const;
const TIER_OPTIONS = RARITIES.map((tier) => ({
  value: tier,
  label: tier[0].toUpperCase() + tier.slice(1),
}));
const SORT_OPTIONS = [
  { value: "ovr", label: "Highest OVR" },
  { value: "name", label: "Name" },
  { value: "newest", label: "Newest" },
];

type PlayerDirectoryPageProps = {
  searchParams: Promise<{ q?: string; rarity?: string; archetype?: string; sort?: string }>;
};

export default async function PlayerDirectoryPage({ searchParams }: PlayerDirectoryPageProps) {
  await requireUser();
  const supabase = await createClient();
  const query = await searchParams;

  // "*": views only gain columns (the stage and At risk, ADR-165).
  let request = supabase.schema("kut").from("player_directory").select("*");

  const term = query.q?.trim().slice(0, 80);
  if (term) request = request.ilike("display_name", `%${term}%`);
  if (RARITIES.includes(query.rarity as (typeof RARITIES)[number]))
    request = request.eq("rarity_tier", query.rarity);
  if (query.archetype && isArchetype(query.archetype))
    request = request.eq("archetype", query.archetype);
  if (query.sort === "name") request = request.order("display_name");
  else if (query.sort === "newest") request = request.order("created_at", { ascending: false });
  else request = request.order("live_ovr", { ascending: false }).order("display_name");

  const { data, error } = await request;
  if (error) throw new Error("Could not load the player directory.");

  // The directory keeps Retired rows for name lookups; the rating list is the
  // First Team, and Retired Players have their own page (ADR-165).
  const all = (data ?? []) as DirectoryRow[];
  const players = all.filter((player) => !isRetiredRow(player));
  const goLive = await fetchAcademyGoLive(supabase);
  const lifecycle = goLive ? await fetchLifecycle(supabase) : [];
  const academy = lifecycle.filter(
    (row) => row.academy_visible && row.lifecycle_stage !== "first_team",
  );
  const retiredCount = lifecycle.filter((row) => row.lifecycle_stage === "retired").length;
  const thisWeek = footballWeek(new Date());
  const newThisWeek = new Set(
    lifecycle
      .filter((row) => row.lifecycle_stage === "first_team" && row.promoted_week === thisWeek)
      .map((row) => row.player_id),
  );
  const [photoUrls, injuredPlayerIds] = await Promise.all([
    resolvePhotoUrls(
      supabase,
      players.map((player) => player.photo_path),
    ),
    fetchInjuredPlayerIds(supabase),
  ]);

  return (
    <main className={PAGE}>
      <section className={`${COLUMN} lg:max-w-6xl`}>
        <CompeteTabs />
        <PageHeader
          title="Players"
          sub={
            goLive
              ? `${players.length} in the First Team`
              : `${players.length} ${players.length === 1 ? "Player" : "Players"}`
          }
        />

        {/* Phones: the First Team, then the Academy, then Retired. From lg the
            Academy is a side column (#246 S1, Q2). Before go-live: the grid only. */}
        <div
          className={
            goLive
              ? "grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:items-start lg:gap-8"
              : "grid gap-6"
          }
        >
          <div className="grid min-w-0 gap-6 lg:col-start-1 lg:row-start-1">
            <FilterBar
              result="Show Players"
              summary={
                SORT_OPTIONS.find((option) => option.value === query.sort)?.label ??
                "Highest OVR first"
              }
              basePath="/players"
              chips={{ name: "rarity", allLabel: "All tiers", options: TIER_OPTIONS }}
              defaultSort="ovr"
              searchPlaceholder="Search Players"
              selects={[
                {
                  name: "archetype",
                  anyLabel: "Any archetype",
                  options: ARCHETYPES.map((archetype) => ({
                    value: archetype,
                    label: ARCHETYPE_LABELS[archetype],
                  })),
                },
              ]}
              sorts={SORT_OPTIONS}
              values={{
                q: query.q,
                rarity: query.rarity,
                archetype: query.archetype,
                sort: query.sort,
              }}
            />

            {players.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-line p-8 text-center text-ink-dim">
                No players match these filters.
              </p>
            ) : (
              <CardGrid wide={goLive ? 4 : 5}>
                {players.map((player) => {
                  const cardPlayer = toLiveCardPlayer(player, injuredPlayerIds, photoUrls);
                  // At risk is a warning tag, never a card treatment (#246 S1).
                  const tag = player.at_risk ? (
                    <Tag tone="warn">At risk</Tag>
                  ) : newThisWeek.has(player.id) ? (
                    <Tag tone="won">New</Tag>
                  ) : null;
                  return (
                    <Link
                      prefetch={false}
                      aria-label={`Open ${player.display_name}'s profile`}
                      className="relative block rounded-[0.9rem] outline-offset-4 outline-brass focus-visible:outline-2"
                      href={`/players/${player.slug}`}
                      key={player.id}
                    >
                      <LiveCard player={cardPlayer} />
                      {tag && (
                        <span className="absolute top-2 left-1/2 z-10 -translate-x-1/2 rounded-full bg-board-deep/90">
                          {tag}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </CardGrid>
            )}
          </div>
          {goLive && (
            <>
              <div className="grid min-w-0 lg:col-start-2 lg:row-span-2 lg:row-start-1">
                <AcademyBlock rows={academy} />
              </div>
              {retiredCount > 0 && (
                <ul className="grid min-w-0 rounded-2xl border border-line/60 bg-panel/60 px-4 lg:col-start-1 lg:row-start-2">
                  <LinkRow
                    end={<span className="tabular-nums">{retiredCount}</span>}
                    href="/players/retired"
                    meta="Their cards still trade, but can't play Midweek"
                    title="Retired"
                  />
                </ul>
              )}
            </>
          )}
        </div>
      </section>
    </main>
  );
}
