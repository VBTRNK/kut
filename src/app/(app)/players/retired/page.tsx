import Link from "next/link";
import { notFound } from "next/navigation";
import { LiveCard, type LiveCardPlayer } from "@/components/live-card";
import { InfoLink } from "@/components/ui/links";
import { CardGrid, COLUMN, PAGE, PageHeader } from "@/components/ui/page";
import {
  ACADEMY,
  fetchAcademyGoLive,
  fetchLifecycle,
  isRetiredRow,
  progressWords,
  weekLabel,
} from "@/lib/academy";
import { requireUser } from "@/lib/auth/user";
import { fetchInjuredPlayerIds } from "@/lib/injuries";
import { toLiveCardPlayer } from "@/lib/live-card-player";
import { resolvePhotoUrls } from "@/lib/player-photos";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Retired Players" };

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
  lifecycle_stage?: string | null;
};

/**
 * `/players/retired` (ADR-165, #246 S1 C2): Retired Players' cards with the
 * stamp. Their copies still trade; packs no longer make them. Before go-live
 * the page doesn't exist.
 */
export default async function RetiredPlayersPage() {
  await requireUser();
  const supabase = await createClient();
  const goLive = await fetchAcademyGoLive(supabase);
  if (!goLive) notFound();

  const [{ data, error }, lifecycle] = await Promise.all([
    supabase.schema("kut").from("player_directory").select("*").order("display_name"),
    fetchLifecycle(supabase, { stage: "retired" }),
  ]);
  if (error) throw new Error("Could not load the Retired Players.");
  const players = ((data ?? []) as DirectoryRow[]).filter(isRetiredRow);
  const byPlayer = new Map(lifecycle.map((row) => [row.player_id, row]));
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
        <PageHeader
          back={{ href: "/players", label: "Players" }}
          sub={`${players.length} ${players.length === 1 ? "Player" : "Players"} · ${ACADEMY.retireWeeks} counted weeks without a game`}
          title="Retired"
        />
        <p className="text-body text-ink-dim">
          Packs don&rsquo;t make these cards any more. Copies stay owned and tradeable, but
          can&rsquo;t play Midweek. One more promotion brings a Player back.
        </p>
        {players.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line p-8 text-center text-ink-dim">
            Nobody has retired.
          </p>
        ) : (
          <CardGrid>
            {players.map((player) => {
              const row = byPlayer.get(player.id);
              const since = row?.retired_week ? weekLabel(row.retired_week) : null;
              return (
                <div className="grid min-w-0 content-start gap-2" key={player.id}>
                  <Link
                    prefetch={false}
                    aria-label={`Open ${player.display_name}'s profile`}
                    className="block rounded-[0.9rem] outline-offset-4 outline-brass focus-visible:outline-2"
                    href={`/players/${player.slug}`}
                  >
                    <LiveCard player={toLiveCardPlayer(player, injuredPlayerIds, photoUrls)} />
                  </Link>
                  <p className="text-small text-ink-dim">
                    {row && row.progress >= 2
                      ? `Comeback: ${progressWords(row.progress_weeks, row.progress_credits)}`
                      : since
                        ? `Retired ${since}`
                        : "Retired"}
                  </p>
                </div>
              );
            })}
          </CardGrid>
        )}
        <InfoLink href="/how-it-works#retired">When a Player retires</InfoLink>
      </section>
    </main>
  );
}
