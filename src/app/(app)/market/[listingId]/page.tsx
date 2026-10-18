import { notFound } from "next/navigation";
import { AttributeBars } from "@/components/card-stats";
import { Block } from "@/components/ui/block";
import { Button } from "@/components/ui/button";
import { COLUMN, PAGE, PageHeader } from "@/components/ui/page";
import { Figure, Tag } from "@/components/ui/tag";
import { LiveCard } from "@/components/live-card";
import { MarketOwnership } from "@/components/market-ownership";
import { archetypeLabel } from "@/game/archetypes";
import { requireUser } from "@/lib/auth/user";
import { fetchInjuredPlayerIds } from "@/lib/injuries";
import { toListedCardPlayer, type ListedCardRow } from "@/lib/live-card-player";
import {
  countOwnedCopies,
  ownershipDisplayData,
  type OwnedCardIdentity,
} from "@/lib/market-ownership";
import { resolvePhotoUrls } from "@/lib/player-photos";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/uuid";
import { BuyListingForm } from "../buy-listing-form";
import { ProposeOfferForm, type OfferableCard } from "../propose-offer-form";

export const metadata = { title: "Listing" };

type ListingPageProps = { params: Promise<{ listingId: string }> };

type Listing = ListedCardRow & {
  listing_id: string;
  edition_id: string;
  card_id: string;
  price: number;
  seller_id: string;
  seller_display_name: string;
  /** Appended by `20261010000000` (ADR-103). Absent until the hosted push, and
   *  null for a card with no rating: either way nothing renders (KB-014). */
  discard_value?: number | null;
};

/**
 * One listing, full width. The market grid is two columns on a phone (KB-006), far
 * too narrow for the coin input and card list an offer needs, so this page is where
 * a coin-and-card offer is built (ADR-051). Buy-now is here too, so the grid tile
 * stays a card, a price and one button.
 */
export default async function ListingPage({ params }: ListingPageProps) {
  const user = await requireUser();
  const { listingId } = await params;
  // A malformed id (a stray path segment) fails the `uuid` cast below with a
  // query error instead of the intended "not found" (KB-007).
  if (!isUuid(listingId)) notFound();
  const supabase = await createClient();

  // Mirrors the market index: retire offers past their 12h window before reading.
  await supabase.schema("kut").rpc("expire_trade_offers");

  const [{ data, error }, { data: wallet }, { data: ownCards, error: ownCardsError }] =
    await Promise.all([
      supabase
        .schema("kut")
        // "*" rather than a column list: ADR-086 appended player_id and is_live,
        // and the page ships before the hosted schema does.
        .from("active_market_listings")
        .select("*")
        .eq("listing_id", listingId)
        .maybeSingle(),
      supabase.schema("kut").from("wallets").select("balance").eq("user_id", user.id).maybeSingle(),
      supabase
        .schema("kut")
        .from("my_collection_cards")
        .select(
          "card_id, player_id, edition_id, display_name, ovr, rarity_tier, active_listing_id, held_by_offer_id",
        )
        .order("ovr", { ascending: false }),
    ]);

  if (error) throw new Error("Could not load this listing.");
  // Sold, cancelled and expired listings all drop out of the view, so this 404s them
  // rather than rendering a dead Buy button.
  if (!data) notFound();
  if (ownCardsError) throw new Error("Could not load your cards.");

  const listing = data as Listing;
  const balance = wallet?.balance ?? 0;
  const isOwnListing = listing.seller_id === user.id;
  const [photoUrls, injuredPlayerIds] = await Promise.all([
    resolvePhotoUrls(supabase, [listing.photo_path]),
    fetchInjuredPlayerIds(supabase),
  ]);

  type OwnCard = OfferableCard &
    OwnedCardIdentity & {
      active_listing_id: string | null;
      held_by_offer_id: string | null;
    };
  const collectionCards = (ownCards ?? []) as OwnCard[];
  // Ownership deliberately uses the complete private view result. Only after
  // counting do listing and offer holds make a copy ineligible for this offer.
  const ownership = ownershipDisplayData(countOwnedCopies(collectionCards), listing);
  const offerableCards: OfferableCard[] = collectionCards
    .filter((card) => !card.active_listing_id && !card.held_by_offer_id)
    .map((card) => ({
      card_id: card.card_id,
      display_name: card.display_name,
      ovr: card.ovr,
      rarity_tier: card.rarity_tier,
    }));

  const cardPlayer = toListedCardPlayer(listing, injuredPlayerIds, photoUrls);
  const retired = listing.player_stage === "retired";

  return (
    <main className={`${PAGE} pb-28 sm:pb-8`}>
      <section className={`${COLUMN} lg:max-w-5xl`}>
        <PageHeader
          back={{ href: "/market", label: "Market" }}
          title={listing.display_name}
          sub={
            <>
              {archetypeLabel(listing.archetype)} ·{" "}
              <span className="capitalize">{listing.rarity_tier}</span> · {listing.ovr} OVR
            </>
          }
        />
        <div className="grid gap-6 md:grid-cols-[minmax(0,18rem)_minmax(0,1fr)] md:items-start">
          <div className="mx-auto w-full max-w-[15rem] md:max-w-none">
            <LiveCard
              badge={ownership && <MarketOwnership ownership={ownership} />}
              player={cardPlayer}
              size="detail"
            />
          </div>
          <div className="grid min-w-0 gap-6">
            <Block aside={retired ? <Tag tone="out">Retired</Tag> : undefined} title="Buy now">
              {retired && (
                <p className="text-body text-ink-dim">
                  Can&rsquo;t play Midweek while {listing.display_name} is Retired. Packs
                  don&rsquo;t make this card any more.
                </p>
              )}
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <p>
                  <Figure>{listing.price.toLocaleString()}</Figure>
                  <span className="sr-only"> FLUT Coins</span>
                </p>
                <p className="text-small text-ink-dim">
                  {typeof listing.discard_value === "number" && (
                    <>Discard value {listing.discard_value.toLocaleString()} · </>
                  )}
                  Sold by {listing.seller_display_name}
                </p>
              </div>
              {isOwnListing ? (
                <>
                  <p className="text-small text-ink-dim">
                    This is your listing. Cancel it from this card in your Collection.
                  </p>
                  <Button href={`/club/collection/${listing.card_id}`} kind="secondary">
                    View your card
                  </Button>
                </>
              ) : (
                <div className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom,0px))] z-20 border-t border-line/60 bg-board-deep/95 p-4 backdrop-blur sm:static sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
                  <BuyListingForm
                    detail
                    canAfford={balance >= listing.price}
                    listingId={listing.listing_id}
                    price={listing.price}
                  />
                </div>
              )}
            </Block>
            <AttributeBars player={listing} />
            {!isOwnListing && (
              <Block title="Or make an offer">
                <ProposeOfferForm
                  askingPrice={listing.price}
                  listingId={listing.listing_id}
                  offerableCards={offerableCards}
                />
              </Block>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
