import { Block } from "@/components/ui/block";
import { InfoLink } from "@/components/ui/links";
import { PAGE, COLUMN, PageHeader } from "@/components/ui/page";
import { requireUser } from "@/lib/auth/user";
import { packKind, packPromise } from "@/lib/packs";
import { createClient } from "@/lib/supabase/server";
import { OpenPackForm } from "./open-pack-form";

// `min_tier` was appended by #223 S1 (ADR-164); an older schema omits it, and
// then the shop promises nothing beyond the cards.
type PackOffer = {
  slug: string;
  title: string;
  price: number;
  cards_per_pack: number;
  min_tier?: string | null;
};

/** Mirrors the live-rating tier thresholds the database applies on publish. */
const TIER_BANDS = [
  ["common", "Common", "under 40"],
  ["bronze", "Bronze", "40 to 49"],
  ["silver", "Silver", "50 to 59"],
  ["gold", "Gold", "60 to 69"],
  ["holo", "Holo", "70 to 79"],
  ["elite", "Elite", "80 and up"],
] as const;

export default async function PacksPage() {
  const user = await requireUser();
  const supabase = await createClient();
  const [packsResponse, walletResponse] = await Promise.all([
    supabase
      .schema("kut")
      .from("active_pack_offers")
      // "*": views only gain columns, and the page ships before the schema does.
      .select("*")
      .order("price"),
    supabase.schema("kut").from("wallets").select("balance").eq("user_id", user.id).maybeSingle(),
  ]);

  if (packsResponse.error || walletResponse.error) {
    throw new Error("Could not load the pack store.");
  }

  const packs = (packsResponse.data ?? []) as PackOffer[];
  const balance = walletResponse.data?.balance ?? 0;

  return (
    <main className={PAGE}>
      <section className={`${COLUMN} lg:max-w-6xl`}>
        <PageHeader title="Packs" />

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
          {packs.length === 0 ? (
            <p className="rounded-3xl border border-dashed border-line bg-panel/60 p-10 text-center text-ink-dim">
              No packs are available right now.
            </p>
          ) : (
            // Only the offers the server returned, in price order: an unknown
            // slug gets neutral art and its own title, never an invented promise.
            <div className="pack-offers grid gap-4">
              {packs.map((pack) => (
                <OpenPackForm
                  balance={balance}
                  cardsPerPack={pack.cards_per_pack}
                  key={pack.slug}
                  kind={packKind(pack.slug)}
                  packSlug={pack.slug}
                  price={pack.price}
                  promise={packPromise(pack.min_tier)}
                  title={pack.title}
                />
              ))}
            </div>
          )}

          <Block title="The tier ladder">
            <dl className="mt-4">
              {TIER_BANDS.map(([tier, label, band]) => (
                <div className="flex items-center gap-3.5 border-b border-line/30 py-3" key={tier}>
                  <span aria-hidden="true" className="tier-chip" data-rarity={tier}>
                    <span className={`live-card__tier-icon--${tier}`} />
                  </span>
                  <dt className="grow text-body font-semibold">{label}</dt>
                  <dd className="text-small tabular-nums text-ink-faint">OVR {band}</dd>
                </div>
              ))}
            </dl>
            <InfoLink href="/how-it-works#cards">How tiers work</InfoLink>
          </Block>
        </div>
      </section>
    </main>
  );
}
