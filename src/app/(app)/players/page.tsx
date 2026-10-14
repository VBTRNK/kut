import { PAGE, COLUMN, PageHeader, CardGrid } from "@/components/ui/page";
import Link from "next/link";
import { FilterBar } from "@/components/filter-bar";
import { ARCHETYPES, ARCHETYPE_LABELS, isArchetype } from "@/game/archetypes";
import { LiveCard, type LiveCardPlayer } from "@/components/live-card";
import { requireUser } from "@/lib/auth/user";
import { CompeteTabs } from "@/components/app-shell/compete-tabs";
import { fetchInjuredPlayerIds } from "@/lib/injuries";
import { toLiveCardPlayer } from "@/lib/live-card-player";
import { resolvePhotoUrls } from "@/lib/player-photos";
import { createClient } from "@/lib/supabase/server";

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

  let request = supabase
    .schema("kut")
    .from("player_directory")
    .select(
      "id, slug, display_name, archetype, photo_path, live_ovr, pac, sho, pas, dri, def, phy, rarity_tier",
    );

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

  const players = (data ?? []) as DirectoryRow[];
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
          sub={`${players.length} ${players.length === 1 ? "Player" : "Players"}`}
        />

        <FilterBar
          result="Show Players"
          summary={
            SORT_OPTIONS.find((option) => option.value === query.sort)?.label ?? "Highest OVR first"
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
          <CardGrid>
            {players.map((player) => {
              const cardPlayer = toLiveCardPlayer(player, injuredPlayerIds, photoUrls);
              return (
                <Link
                  prefetch={false}
                  aria-label={`Open ${player.display_name}'s profile`}
                  className="block rounded-[0.9rem] outline-offset-4 outline-brass focus-visible:outline-2"
                  href={`/players/${player.slug}`}
                  key={player.id}
                >
                  <LiveCard player={cardPlayer} />
                </Link>
              );
            })}
          </CardGrid>
        )}
      </section>
    </main>
  );
}
