import Link from "next/link";
import { notFound } from "next/navigation";
import { Block, Inset } from "@/components/ui/block";
import { InfoLink } from "@/components/ui/links";
import { PAGE, COLUMN, PageHeader } from "@/components/ui/page";
import { LiveCard, type LiveCardPlayer } from "@/components/live-card";
import { requireUser } from "@/lib/auth/user";
import type { RatingBreakdown } from "@/lib/rating-story";
import { fetchInjuredPlayerIds } from "@/lib/injuries";
import { toLiveCardPlayer } from "@/lib/live-card-player";
import { resolvePhotoUrls } from "@/lib/player-photos";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/uuid";
import { StageBlock } from "@/components/academy";
import { fetchLifecycle } from "@/lib/academy";
import { DiscardCardForm } from "../discard-card-form";
import { CreateListingForm } from "../create-listing-form";
import { CancelListingForm } from "../cancel-listing-form";

type CardPageProps = {
  params: Promise<{ cardId: string }>;
  searchParams: Promise<{ listed?: string; listingCancelled?: string }>;
};

type CollectionCard = {
  card_id: string;
  edition_id: string;
  edition_title: string;
  edition_type: string;
  is_live: boolean;
  source: string;
  display_name: string;
  player_id: string;
  player_slug: string;
  archetype: string;
  ovr: number;
  pac: number;
  sho: number;
  pas: number;
  dri: number;
  def: number;
  phy: number;
  rarity_tier: LiveCardPlayer["rarityTier"];
  discard_value: number;
  active_listing_id: string | null;
  active_listing_price: number | null;
  active_listing_expires_at: string | null;
  held_by_offer_id: string | null;
  photo_path: string | null;
  // Appended by 20261024000000 (ADR-165): the Retired stamp.
  player_stage?: string | null;
};

export default async function CardDetailPage({ params, searchParams }: CardPageProps) {
  await requireUser();
  const { cardId } = await params;
  // A malformed id (a stray path segment) fails the `uuid` cast below with a
  // query error instead of the intended "not found" (KB-007).
  if (!isUuid(cardId)) notFound();
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("kut")
    .from("my_collection_cards")
    // "*": views only gain columns (the stage, ADR-165).
    .select("*")
    .eq("card_id", cardId)
    .maybeSingle();

  if (error) {
    throw new Error("Could not load this card.");
  }

  if (!data) {
    notFound();
  }

  const card = data as CollectionCard;
  const [photoUrls, injuredPlayerIds, [lifecycle], copiesResponse] = await Promise.all([
    resolvePhotoUrls(supabase, [card.photo_path]),
    fetchInjuredPlayerIds(supabase),
    // At risk or Retired (ADR-165): members from go-live.
    fetchLifecycle(supabase, { playerId: card.player_id }),
    supabase
      .schema("kut")
      .from("my_collection_cards")
      .select("card_id", { count: "exact", head: true })
      .eq("player_id", card.player_id),
  ]);
  // ADR-074: the rating story applies only to a Live card. A Special edition is
  // a frozen snapshot, so explaining a current OVR would misdescribe it. The
  // read is non-critical — a failure renders the page without the story
  // rather than 500ing, matching how the rating graph treats its own queries.
  const [query, boundsResponse, breakdownResponse] = await Promise.all([
    searchParams,
    !card.active_listing_id
      ? supabase.schema("kut").rpc("get_listing_bounds", { p_card_id: card.card_id })
      : Promise.resolve({ data: null, error: null }),
    card.is_live
      ? supabase
          .schema("kut")
          .from("player_rating_breakdown")
          .select(
            "live_ovr, form_score, activity_score, form_bonus, attendance_base, is_ovr_capped",
          )
          .eq("player_id", card.player_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  if (boundsResponse.error) console.error("card listing bounds read failed", boundsResponse.error);
  const bounds =
    boundsResponse.data && typeof boundsResponse.data === "object" ? boundsResponse.data : null;
  const minimumPrice = bounds && "minimum_price" in bounds ? Number(bounds.minimum_price) : null;
  const maximumPrice = bounds && "maximum_price" in bounds ? Number(bounds.maximum_price) : null;
  const ratingBreakdown = (breakdownResponse.data as RatingBreakdown | null) ?? null;

  const cardPlayer = toLiveCardPlayer(card, injuredPlayerIds, photoUrls);

  return (
    <main className={PAGE}>
      <div className={`${COLUMN} lg:max-w-5xl`}>
        <PageHeader
          back={{ href: "/club/collection", label: "Collection" }}
          title={card.display_name}
          sub={`${card.is_live ? "Live card" : card.edition_title} · ${card.rarity_tier} · OVR ${card.ovr}${card.player_stage === "retired" ? " · Retired" : ""}`}
        />
        <div className="grid gap-6 md:grid-cols-[minmax(0,18rem)_minmax(0,1fr)] md:items-start">
          <div className="mx-auto w-full max-w-[15rem] md:max-w-none">
            <LiveCard size="detail" player={cardPlayer} />
          </div>
          <div className="grid min-w-0 gap-6">
            <StageBlock copies={copiesResponse.count ?? undefined} row={lifecycle ?? null} />
            {card.is_live && (
              <Block title="Why this rating">
                {ratingBreakdown && (
                  <dl className="grid grid-cols-3 gap-2">
                    {[
                      { label: "Attendance", value: ratingBreakdown.attendance_base },
                      { label: "Form", value: `+${ratingBreakdown.form_bonus}` },
                      { label: "OVR", value: ratingBreakdown.live_ovr },
                    ].map((row) => (
                      <Inset className="grid gap-1" key={row.label}>
                        <dt className="text-label font-semibold text-ink-faint">{row.label}</dt>
                        <dd className="text-heading font-semibold tabular-nums">{row.value}</dd>
                      </Inset>
                    ))}
                  </dl>
                )}
                {ratingBreakdown?.is_ovr_capped && (
                  <p className="text-small text-ink-dim">
                    At the 83 ceiling; attendance is shown after the cap.
                  </p>
                )}
                <InfoLink href="/how-it-works#cards">How ratings move</InfoLink>
                <Link
                  prefetch={false}
                  className="inline-flex min-h-11 items-center text-small font-semibold text-brass hover:underline"
                  href={`/players/${card.player_slug}`}
                >
                  See {card.display_name.split(" ")[0]}’s rating history ›
                </Link>
              </Block>
            )}
            {query.listed === "1" && (
              <p className="rounded-2xl border border-moss-line/40 bg-moss-bg/50 p-4 text-small text-moss">
                Listed successfully. This card is locked until the listing expires or you cancel it.
              </p>
            )}
            {query.listingCancelled === "1" && (
              <p className="rounded-2xl border border-moss-line/40 bg-moss-bg/50 p-4 text-small text-moss">
                Listing cancelled. This card is available again.
              </p>
            )}
            {card.held_by_offer_id && (
              <p className="rounded-2xl border border-brass-line bg-brass-bg p-4 text-small text-brass">
                This card is committed to a pending trade offer. It can’t be listed or discarded
                until that offer is accepted, declined, or expires.
              </p>
            )}
            {!card.held_by_offer_id && card.active_listing_id && card.active_listing_price && (
              <CancelListingForm
                cardId={card.card_id}
                expiresAt={card.active_listing_expires_at}
                listingId={card.active_listing_id}
                price={card.active_listing_price}
              />
            )}
            {!card.held_by_offer_id && !card.active_listing_id && (
              <>
                {minimumPrice !== null && maximumPrice !== null && (
                  <CreateListingForm
                    cardId={card.card_id}
                    maximumPrice={maximumPrice}
                    minimumPrice={minimumPrice}
                  />
                )}
                <DiscardCardForm cardId={card.card_id} discardValue={card.discard_value} />
              </>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
