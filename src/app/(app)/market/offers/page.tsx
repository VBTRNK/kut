import Link from "next/link";
import { Block } from "@/components/ui/block";
import { COLUMN, PAGE, PageHeader, FOCUS } from "@/components/ui/page";
import { Tag } from "@/components/ui/tag";
import { formatDate } from "@/lib/format";
import { requireUser } from "@/lib/auth/user";
import { getNavContext } from "@/lib/nav/context";
import { buildMarketTabs } from "@/lib/nav/routes";
import { SectionNav } from "@/components/ui/section-nav";
import { createClient } from "@/lib/supabase/server";
import { RespondToOfferForms, WithdrawOfferForm } from "./offer-response-forms";

export const metadata = { title: "Trade offers" };

type OfferedCard = { card_id: string; display_name: string; ovr: number; rarity_tier: string };
type TradeOffer = {
  offer_id: string;
  status: "active" | "accepted" | "rejected" | "withdrawn" | "expired";
  offered_coins: number;
  created_at: string;
  expires_at: string;
  resolved_at: string | null;
  coins_to_seller: number | null;
  is_outgoing: boolean;
  proposer_name: string;
  seller_name: string;
  listing_card_name: string;
  listing_card_slug: string;
  listing_price: number;
  listing_status: string;
  offered_card_count: number;
  offered_cards: OfferedCard[];
};

const STATUS_LABEL: Record<TradeOffer["status"], string> = {
  active: "Open",
  accepted: "Accepted",
  rejected: "Declined",
  withdrawn: "Withdrawn",
  expired: "Expired",
};

function OfferCard({
  offer,
  now,
  primary = false,
}: {
  offer: TradeOffer;
  now: number;
  primary?: boolean;
}) {
  const cards = Array.isArray(offer.offered_cards) ? offer.offered_cards : [];
  return (
    <li>
      <Block
        title={
          <>
            <Link
              prefetch={false}
              className={`rounded-md hover:text-brass ${FOCUS}`}
              href={`/players/${offer.listing_card_slug}`}
            >
              {offer.listing_card_name}
            </Link>{" "}
            · {offer.listing_price} asked
          </>
        }
        tone={primary ? "now" : "plain"}
        aside={
          <Tag tone={offer.status === "accepted" ? "won" : "neutral"}>
            {STATUS_LABEL[offer.status]}
          </Tag>
        }
      >
        <p className="text-small text-ink-dim">
          {offer.is_outgoing ? `To ${offer.seller_name}` : `From ${offer.proposer_name}`} ·{" "}
          {offer.status === "active"
            ? `${Math.max(0, Math.ceil((Date.parse(offer.expires_at) - now) / 3_600_000))} h left`
            : `Resolved ${formatDate(offer.resolved_at ?? offer.expires_at)}`}
        </p>
        <p className="text-body">
          <b className="font-semibold tabular-nums">{offer.offered_coins} coins</b>
          {cards.length > 0 &&
            ` + ${cards.map((card) => `${card.display_name} (${card.ovr})`).join(", ")}`}
        </p>
        {offer.status === "accepted" && !offer.is_outgoing && offer.coins_to_seller !== null && (
          <p className="text-small text-moss">
            You received {offer.coins_to_seller} FLUT Coins after the 5% burn.
          </p>
        )}
        {offer.status === "active" && !offer.is_outgoing && (
          <RespondToOfferForms offerId={offer.offer_id} primary={primary} />
        )}
        {offer.status === "active" && offer.is_outgoing && (
          <WithdrawOfferForm offerId={offer.offer_id} />
        )}
      </Block>
    </li>
  );
}

type OffersPageProps = {
  searchParams: Promise<{
    sent?: string;
    withdrawn?: string;
    accepted?: string;
    declined?: string;
  }>;
};

export default async function TradeOffersPage({ searchParams }: OffersPageProps) {
  await requireUser();
  const supabase = await createClient();
  await supabase.schema("kut").rpc("expire_trade_offers");
  const [{ data, error }, query] = await Promise.all([
    supabase
      .schema("kut")
      .from("my_trade_offers")
      .select(
        "offer_id, status, offered_coins, created_at, expires_at, resolved_at, coins_to_seller, is_outgoing, proposer_name, seller_name, listing_card_name, listing_card_slug, listing_price, listing_status, offered_card_count, offered_cards",
      )
      .order("created_at", { ascending: false }),
    searchParams,
  ]);
  if (error) throw new Error("Could not load your trade offers.");
  const { incomingOfferCount } = await getNavContext();
  const marketTabs = buildMarketTabs(incomingOfferCount);
  const offers = (data ?? []) as TradeOffer[];
  const incoming = offers.filter((offer) => !offer.is_outgoing);
  const outgoing = offers.filter((offer) => offer.is_outgoing);
  const now = new Date().getTime();
  const primaryOfferId = incoming.find((offer) => offer.status === "active")?.offer_id;
  const flash =
    query.sent === "1"
      ? "Offer sent. Your coins and cards are held until the seller responds."
      : query.withdrawn === "1"
        ? "Offer withdrawn and your escrow refunded."
        : query.accepted === "1"
          ? "Offer accepted. The trade is complete."
          : query.declined === "1"
            ? "Offer declined and the escrow refunded."
            : null;

  return (
    <main className={PAGE}>
      <section className={`${COLUMN} lg:max-w-3xl`}>
        <PageHeader title="Market" />
        <SectionNav label="Market" tabs={marketTabs} />

        {flash && (
          <p className="rounded-2xl border border-moss-line/40 bg-moss-bg/50 p-4 text-body text-moss">
            {flash}
          </p>
        )}

        <div className="space-y-4">
          <h2 className="text-heading font-semibold">On your listings</h2>
          {incoming.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-line p-6 text-center text-ink-dim">
              No offers on your listings yet.
            </p>
          ) : (
            <ul className="space-y-3">
              {incoming.map((offer) => (
                <OfferCard
                  key={offer.offer_id}
                  offer={offer}
                  now={now}
                  primary={offer.offer_id === primaryOfferId}
                />
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-4">
          <h2 className="text-heading font-semibold">You sent</h2>
          {outgoing.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-line p-6 text-center text-ink-dim">
              You haven&rsquo;t made any offers. Find a listing on the{" "}
              <Link prefetch={false} className="text-brass underline" href="/market">
                market
              </Link>
              .
            </p>
          ) : (
            <ul className="space-y-3">
              {outgoing.map((offer) => (
                <OfferCard key={offer.offer_id} offer={offer} now={now} />
              ))}
            </ul>
          )}
        </div>
      </section>
    </main>
  );
}
