import Link from "next/link";
import { CardGrid, COLUMN, PAGE, PageHeader } from "@/components/ui/page";
import { FilterBar } from "@/components/filter-bar";
import { SectionNav } from "@/components/ui/section-nav";
import { LiveCard } from "@/components/live-card";
import { MarketOwnership } from "@/components/market-ownership";
import { requireUser } from "@/lib/auth/user";
import { fetchInjuredPlayerIds } from "@/lib/injuries";
import { toListedCardPlayer, type ListedCardRow } from "@/lib/live-card-player";
import {
  countOwnedCopies,
  ownershipDisplayData,
  type OwnedCardIdentity,
} from "@/lib/market-ownership";
import { getNavContext } from "@/lib/nav/context";
import { buildMarketTabs } from "@/lib/nav/routes";
import { resolvePhotoUrls } from "@/lib/player-photos";
import { createClient } from "@/lib/supabase/server";
import { BuyListingForm } from "./buy-listing-form";

type MarketPageProps = {
  searchParams: Promise<{ q?: string; rarity?: string; sort?: string; min?: string; max?: string }>;
};

type Listing = ListedCardRow & {
  listing_id: string;
  edition_id: string;
  price: number;
  seller_id: string;
  seller_display_name: string;
};

const rarities = ["common", "bronze", "silver", "gold", "holo", "elite"] as const;
const TIER_OPTIONS = rarities.map((tier) => ({
  value: tier,
  label: tier[0].toUpperCase() + tier.slice(1),
}));
const SORT_OPTIONS = [
  { value: "newest", label: "Newest" },
  { value: "price", label: "Price" },
  { value: "ovr", label: "OVR" },
];

export default async function MarketPage({ searchParams }: MarketPageProps) {
  const user = await requireUser();
  const supabase = await createClient();
  const query = await searchParams;

  // Lazily retire trade offers past their 12h window (mirrors the listing lazy-expire).
  await supabase.schema("kut").rpc("expire_trade_offers");

  // "*" rather than a column list: ADR-086 appended player_id and is_live, and
  // the page ships before the hosted schema does.
  let request = supabase.schema("kut").from("active_market_listings").select("*");

  const term = query.q?.trim().slice(0, 80);
  if (term) request = request.ilike("display_name", `%${term}%`);
  if (rarities.includes(query.rarity as (typeof rarities)[number]))
    request = request.eq("rarity_tier", query.rarity);

  const min = Number(query.min);
  const max = Number(query.max);
  if (Number.isSafeInteger(min) && min >= 0) request = request.gte("price", min);
  if (Number.isSafeInteger(max) && max >= 0) request = request.lte("price", max);

  if (query.sort === "price") request = request.order("price");
  else if (query.sort === "ovr") request = request.order("ovr", { ascending: false });
  else request = request.order("listed_at", { ascending: false });

  // The offerable-cards query used to live here for the per-tile offer form. Offers
  // moved to the listing detail page (ADR-051), so the index no longer pays for it.
  const [{ data, error }, { data: wallet }, { data: ownedCards, error: ownedCardsError }] =
    await Promise.all([
      request,
      supabase.schema("kut").from("wallets").select("balance").eq("user_id", user.id).maybeSingle(),
      supabase.schema("kut").from("my_collection_cards").select("player_id, edition_id"),
    ]);

  if (error) throw new Error("Could not load the market.");
  if (ownedCardsError) throw new Error("Could not load your collection ownership.");

  const listings = (data ?? []) as Listing[];
  const ownershipCounts = countOwnedCopies((ownedCards ?? []) as OwnedCardIdentity[]);
  const balance = wallet?.balance ?? 0;
  const [photoUrls, injuredPlayerIds] = await Promise.all([
    resolvePhotoUrls(
      supabase,
      listings.map((listing) => listing.photo_path),
    ),
    fetchInjuredPlayerIds(supabase),
  ]);
  // getNavContext is React.cache()d and the (app) layout already called it this
  // request, so this is free and guarantees the tab badge matches the chrome one.
  const { incomingOfferCount } = await getNavContext();
  const marketTabs = buildMarketTabs(incomingOfferCount);

  return (
    <main className={PAGE}>
      <section className={`${COLUMN} lg:max-w-6xl`}>
        <PageHeader title="Market" />
        <SectionNav label="Market" tabs={marketTabs} />
        <FilterBar
          basePath="/market"
          sheetOnly
          result="Show listings"
          summary={`${listings.length} listings · ${query.sort === "price" ? "lowest price first" : query.sort === "ovr" ? "highest OVR first" : "newest first"}`}
          chips={{ name: "rarity", allLabel: "All tiers", options: TIER_OPTIONS }}
          defaultSort="newest"
          range={{ minName: "min", maxName: "max", minLabel: "Min", maxLabel: "Max" }}
          searchPlaceholder="Search Players"
          sorts={SORT_OPTIONS}
          values={{
            q: query.q,
            rarity: query.rarity,
            sort: query.sort,
            min: query.min,
            max: query.max,
          }}
        />

        {listings.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line p-10 text-center text-ink-dim">
            No active listings match these filters. List a card from your Collection to start the
            market.
          </p>
        ) : (
          <CardGrid wide={4}>
            {listings.map((listing) => {
              const isOwnListing = listing.seller_id === user.id;
              const cardPlayer = toListedCardPlayer(listing, injuredPlayerIds, photoUrls);
              const ownership = ownershipDisplayData(ownershipCounts, listing);
              return (
                <article className="flex flex-col gap-2.5" key={listing.listing_id}>
                  <div className="relative">
                    {/* The card is the way into the listing: offers, and the full
                        stat breakdown, live on its detail page (ADR-051). */}
                    <Link
                      prefetch={false}
                      aria-label={`${listing.display_name} — open this listing`}
                      className="block rounded-[0.9rem] outline-offset-4 outline-brass focus-visible:outline-2"
                      href={`/market/${listing.listing_id}`}
                    >
                      {/* Ownership rides the card too, so every tile in a row is
                          the same height and the Buy buttons line up (KB-026). */}
                      <LiveCard
                        badge={ownership && <MarketOwnership compact ownership={ownership} />}
                        player={cardPlayer}
                      />
                    </Link>
                  </div>

                  <p className="truncate text-small text-ink-dim">
                    Sold by {listing.seller_display_name}
                  </p>

                  {/* The link's aria-label hides the chip, so it is spoken here. */}
                  {ownership && <p className="sr-only">{ownership.accessibleText}</p>}

                  {isOwnListing ? (
                    <p className="grid min-h-12 place-items-center rounded-xl border border-dashed border-line text-small text-ink-dim">
                      Your listing
                    </p>
                  ) : (
                    <BuyListingForm
                      canAfford={balance >= listing.price}
                      listingId={listing.listing_id}
                      price={listing.price}
                    />
                  )}
                </article>
              );
            })}
          </CardGrid>
        )}
      </section>
    </main>
  );
}
