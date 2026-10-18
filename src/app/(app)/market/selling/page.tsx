import Link from "next/link";
import type { LiveCardPlayer } from "@/components/live-card";
import { MidweekMiniCard } from "@/components/midweek/mini-card";
import { Block } from "@/components/ui/block";
import { COLUMN, PAGE, PageHeader, FOCUS } from "@/components/ui/page";
import { SectionNav } from "@/components/ui/section-nav";
import { requireUser } from "@/lib/auth/user";
import { fetchInjuredPlayerIds } from "@/lib/injuries";
import { getNavContext } from "@/lib/nav/context";
import { buildMarketTabs } from "@/lib/nav/routes";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Selling" };

type ListedCard = {
  card_id: string;
  player_id: string;
  display_name: string;
  ovr: number;
  rarity_tier: LiveCardPlayer["rarityTier"];
  active_listing_id: string;
  active_listing_price: number;
  active_listing_expires_at: string;
  // Appended by 20261024000000 (ADR-165).
  player_stage?: string | null;
};

export default async function SellingPage() {
  await requireUser();
  const supabase = await createClient();
  await supabase.schema("kut").rpc("expire_trade_offers");
  const [collection, offers, injuredPlayerIds, { incomingOfferCount }] = await Promise.all([
    supabase
      .schema("kut")
      .from("my_collection_cards")
      .select("*")
      .not("active_listing_id", "is", null)
      .order("active_listing_expires_at"),
    supabase
      .schema("kut")
      .from("my_trade_offers")
      .select("*")
      .eq("status", "active")
      .eq("is_outgoing", false),
    fetchInjuredPlayerIds(supabase),
    getNavContext(),
  ]);
  if (collection.error) throw new Error("Could not load your listings.");
  if (offers.error) throw new Error("Could not load offers on your listings.");
  const listings = (collection.data ?? []) as ListedCard[];
  const now = new Date().getTime();

  return (
    <main className={PAGE}>
      <div className={`${COLUMN} lg:max-w-3xl`}>
        <PageHeader title="Market" />
        <SectionNav label="Market" tabs={buildMarketTabs(incomingOfferCount)} />
        <Block
          title="Your listings"
          aside={<p className="text-small text-ink-dim">{listings.length} active</p>}
        >
          {listings.length === 0 ? (
            <p className="text-body text-ink-dim">You have no active listings.</p>
          ) : (
            <ul className="grid">
              {listings.map((card) => {
                const count = (offers.data ?? []).filter(
                  (offer) => offer.listing_id === card.active_listing_id,
                ).length;
                const hours = Math.max(
                  0,
                  Math.ceil((Date.parse(card.active_listing_expires_at) - now) / 3_600_000),
                );
                return (
                  <li className="border-b border-line/40 last:border-b-0" key={card.card_id}>
                    <Link
                      prefetch={false}
                      className={`grid min-h-16 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-md py-2 hover:text-brass ${FOCUS}`}
                      href={`/market/${card.active_listing_id}`}
                    >
                      <MidweekMiniCard
                        small
                        ovr={card.ovr}
                        rarityTier={card.rarity_tier}
                        injured={injuredPlayerIds.has(card.player_id)}
                        retired={card.player_stage === "retired"}
                      />
                      <span className="grid min-w-0">
                        <span className="truncate text-body font-semibold">
                          {card.display_name}
                        </span>
                        <span className="text-small text-ink-dim">
                          {hours} h left · {count} {count === 1 ? "offer" : "offers"}
                          {card.player_stage === "retired" && " · Retired"}
                        </span>
                        <span className="sr-only">
                          {card.rarity_tier} · OVR {card.ovr}
                        </span>
                      </span>
                      <span className="text-body font-semibold tabular-nums">
                        {card.active_listing_price.toLocaleString()}
                        <span className="sr-only"> coins</span>
                        <span aria-hidden="true" className="ml-2 text-ink-faint">
                          ›
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="text-small text-ink-dim">
            List a card from its page in your{" "}
            <Link
              prefetch={false}
              className={`rounded-md text-brass underline ${FOCUS}`}
              href="/club/collection?view=manage"
            >
              Collection
            </Link>
            .
          </p>
        </Block>
      </div>
    </main>
  );
}
