import { PAGE, COLUMN, PageHeader } from "@/components/ui/page";
import { type Archetype, formatArchetypeChangeAt, nextArchetypeChangeAt } from "@/game/archetypes";
import { requireUser } from "@/lib/auth/user";
import { resolvePhotoUrls } from "@/lib/player-photos";
import { createClient } from "@/lib/supabase/server";
import { CardEditor } from "./card-editor";

export const metadata = { title: "My card" };

type PlayerRow = {
  id: string;
  slug: string;
  display_name: string;
  archetype: string;
  photo_path: string | null;
};

export default async function MyCardPage() {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: profile, error: profileError } = await supabase
    .schema("kut")
    .from("profiles")
    .select("player_id")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) throw new Error("Could not load your profile.");

  const shell = (children: React.ReactNode) => (
    <main className={PAGE}>
      <section className={COLUMN}>
        <PageHeader title="My card" back={{ href: "/settings", label: "Settings" }} />
        {children}
      </section>
    </main>
  );

  if (!profile?.player_id) {
    return shell(
      <div className="rounded-3xl border border-dashed border-line bg-panel/60 p-8 text-center text-ink-dim">
        <h2 className="font-semibold text-heading text-ink">No player linked yet</h2>
        <p className="mx-auto mt-2 max-w-md">
          Your account isn&rsquo;t linked to a TFH player, so there&rsquo;s no card to edit yet. Ask
          an admin to link your account to your player.
        </p>
      </div>,
    );
  }

  const { data: player, error: playerError } = await supabase
    .schema("kut")
    .from("players")
    .select("id, slug, display_name, archetype, photo_path")
    .eq("id", profile.player_id)
    .maybeSingle();

  if (playerError) throw new Error("Could not load your player.");
  if (!player) {
    return shell(
      <div className="rounded-3xl border border-dashed border-line bg-panel/60 p-8 text-center text-ink-dim">
        <h2 className="font-semibold text-heading text-ink">Player not found</h2>
        <p className="mt-2">
          Your linked player could not be loaded. Ask an admin to check your account.
        </p>
      </div>,
    );
  }

  const row = player as PlayerRow;
  const photoUrls = await resolvePhotoUrls(supabase, [row.photo_path]);
  const currentPhotoUrl = row.photo_path ? (photoUrls.get(row.photo_path) ?? null) : null;

  // archetype_changed_at arrives with migration 20261004000000 (ADR-094).
  // Vercel deploys before the hosted push, so it is read on its own and a
  // missing column reads as "never changed"; the RPC still enforces the rule.
  const { data: stamp } = await supabase
    .schema("kut")
    .from("players")
    .select("archetype_changed_at")
    .eq("id", row.id)
    .maybeSingle();
  const changedAt =
    (stamp as { archetype_changed_at: string | null } | null)?.archetype_changed_at ?? null;
  const nextChange = nextArchetypeChangeAt(changedAt);

  return shell(
    <CardEditor
      currentArchetype={row.archetype as Archetype}
      currentPhotoUrl={currentPhotoUrl}
      displayName={row.display_name}
      nextArchetypeChange={nextChange ? formatArchetypeChangeAt(nextChange) : null}
      playerId={row.id}
    />,
  );
}
