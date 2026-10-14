import Link from "next/link";
import { requireUser } from "@/lib/auth/user";
import { createClient } from "@/lib/supabase/server";
import { CollectionHeader } from "@/components/album/collection-header";
import { Block } from "@/components/ui/block";
import { Button } from "@/components/ui/button";
import { InfoLink } from "@/components/ui/links";
import { COLUMN, PAGE, FOCUS } from "@/components/ui/page";
import { AddWantedSheet } from "./add-wanted-sheet";
import { setCardWant, setTradeAvailability } from "../discovery-actions";
import { CopyMessageButton } from "./copy-message-button";

type Wanted = {
  edition_id: string;
  state: string;
  edition_title: string;
  is_live: boolean;
  display_name: string;
  owned_count: number;
  lowest_listing_price: number | null;
};
type Availability = { edition_id: string; owner_display_name: string };
type Edition = {
  id: string;
  title: string;
  players: { display_name: string } | { display_name: string }[] | null;
};
type TradeCard = {
  card_id: string;
  edition_id: string;
  edition_title: string;
  display_name: string;
  is_available: boolean;
  availability_state: string;
  acquired_at: string;
};

export default async function WantedPage() {
  const user = await requireUser();
  const supabase = await createClient();
  const [
    wantedResponse,
    availabilityResponse,
    editionsResponse,
    tradeResponse,
    collectionResponse,
    rosterResponse,
    clubValueResponse,
    profileResponse,
  ] = await Promise.all([
    supabase
      .schema("kut")
      .from("my_wanted_cards")
      .select(
        "edition_id, state, edition_title, is_live, display_name, owned_count, lowest_listing_price",
      )
      .order("created_at"),
    supabase.schema("kut").rpc("get_my_wanted_availability"),
    supabase
      .schema("kut")
      .from("card_editions")
      .select("id, title, players(display_name)")
      .eq("is_live", true)
      .order("title"),
    supabase
      .schema("kut")
      .from("my_trade_cards")
      .select(
        "card_id, edition_id, edition_title, display_name, is_available, availability_state, acquired_at",
      )
      .order("display_name")
      .order("acquired_at"),
    supabase.schema("kut").from("my_collection_cards").select("player_id"),
    supabase.schema("kut").from("player_directory").select("id, archetype"),
    supabase.schema("kut").from("my_club_value").select("club_value").maybeSingle(),
    supabase.schema("kut").from("profiles").select("player_id").eq("id", user.id).maybeSingle(),
  ]);
  if (
    wantedResponse.error ||
    availabilityResponse.error ||
    editionsResponse.error ||
    tradeResponse.error ||
    collectionResponse.error ||
    rosterResponse.error
  ) {
    console.error("trading preferences read failed", {
      wanted: wantedResponse.error?.message,
      availability: availabilityResponse.error?.message,
      editions: editionsResponse.error?.message,
      copies: tradeResponse.error?.message,
      collection: collectionResponse.error?.message,
      roster: rosterResponse.error?.message,
    });
    throw new Error("Could not load trading preferences.");
  }

  const wanted = (wantedResponse.data ?? []) as Wanted[];
  const active = wanted.filter((row) => row.state === "active");
  const availability = (availabilityResponse.data ?? []) as Availability[];
  const activeIds = new Set(active.map((row) => row.edition_id));
  const tradeCards = (tradeResponse.data ?? []) as TradeCard[];
  const editionTotals = new Map<string, number>();
  for (const card of tradeCards)
    editionTotals.set(card.edition_id, (editionTotals.get(card.edition_id) ?? 0) + 1);
  const editionSeen = new Map<string, number>();

  const owned = collectionResponse.data ?? [];
  const roster = rosterResponse.data ?? [];
  const own = roster.find((player) => player.id === profileResponse.data?.player_id);
  const editions = ((editionsResponse.data ?? []) as Edition[]).map((edition) => {
    const player = Array.isArray(edition.players) ? edition.players[0] : edition.players;
    return {
      id: edition.id,
      title: edition.title,
      name: player?.display_name ?? edition.title,
      selected: activeIds.has(edition.id),
    };
  });
  return (
    <main className={PAGE}>
      <div className={`${COLUMN} lg:max-w-5xl`}>
        <CollectionHeader
          mode="trading"
          cardCount={owned.length}
          uniquePlayers={new Set(owned.map((card) => card.player_id)).size}
          totalPlayers={roster.length}
          clubValue={clubValueResponse.error ? null : (clubValueResponse.data?.club_value ?? null)}
          showArchetypeNudge={own?.archetype === "all_rounder"}
        />
        <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
          <Block
            title="Wanted"
            aside={<p className="text-small text-ink-dim">{active.length} of 100</p>}
          >
            <p className="text-small text-ink-dim">Wanted cards stay private.</p>
            {active.length === 0 ? (
              <p className="text-small text-ink-dim">Nothing wanted yet.</p>
            ) : (
              <ul className="grid">
                {active.map((want) => {
                  const owners = availability.filter((row) => row.edition_id === want.edition_id);
                  return (
                    <li
                      className="grid gap-1 border-b border-line/40 py-3 last:border-b-0"
                      key={want.edition_id}
                    >
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="text-body font-semibold">{want.display_name}</span>
                        <form action={setCardWant}>
                          <input name="editionId" type="hidden" value={want.edition_id} />
                          <input name="wanted" type="hidden" value="false" />
                          <button
                            className={`min-h-11 rounded-md text-small font-semibold text-ink-dim ${FOCUS}`}
                          >
                            Remove
                          </button>
                        </form>
                      </div>
                      <p className="text-small text-ink-dim">{want.edition_title}</p>
                      <p className="text-small text-ink-dim">
                        {want.owned_count
                          ? `You own ${want.owned_count}`
                          : "Not in your collection"}{" "}
                        ·{" "}
                        {want.lowest_listing_price !== null ? (
                          <Link
                            prefetch={false}
                            className="font-semibold text-brass hover:underline"
                            href={`/market?q=${encodeURIComponent(want.display_name)}`}
                          >
                            listed from {want.lowest_listing_price} ›
                          </Link>
                        ) : (
                          "No public listing"
                        )}
                      </p>
                      {owners.length === 0 ? (
                        <p className="text-small text-ink-dim">
                          Nobody has marked a copy available yet.
                        </p>
                      ) : (
                        <ul className="grid gap-2">
                          {owners.map((owner) => (
                            <li
                              className="flex flex-wrap items-center justify-between gap-2"
                              key={owner.owner_display_name}
                            >
                              <span className="text-small text-moss">
                                {owner.owner_display_name} has one
                              </span>
                              <CopyMessageButton
                                card={`${want.is_live ? "Live " : ""}${want.display_name}`}
                                owner={owner.owner_display_name}
                              />
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
            <AddWantedSheet editions={editions} />
            <InfoLink href="/how-it-works#trading">How trading works</InfoLink>
          </Block>
          <Block
            title="Your copies"
            id="available"
            aside={
              <p className="text-small text-ink-dim">
                {tradeCards.filter((card) => card.is_available).length} of 30
              </p>
            }
          >
            {tradeCards.length === 0 ? (
              <p className="text-small text-ink-dim">Your owned cards will appear here.</p>
            ) : (
              <ul className="grid">
                {tradeCards.map((card) => {
                  const copy = (editionSeen.get(card.edition_id) ?? 0) + 1;
                  editionSeen.set(card.edition_id, copy);
                  const eligible = card.availability_state === "eligible";
                  const state = card.is_available
                    ? "Available"
                    : eligible
                      ? "Private"
                      : card.availability_state === "listed"
                        ? "Listed cards can’t also be available."
                        : "Cards held in an offer can’t also be available.";
                  return (
                    <li
                      className="border-b border-line/40 py-2.5 last:border-b-0"
                      key={card.card_id}
                    >
                      <form
                        action={setTradeAvailability}
                        className="flex flex-wrap items-center justify-between gap-3"
                      >
                        <input name="cardId" type="hidden" value={card.card_id} />
                        <input
                          name="available"
                          type="hidden"
                          value={card.is_available ? "false" : "true"}
                        />
                        <span className="grid min-w-0 flex-1">
                          <span className="text-body font-semibold">
                            {card.display_name}
                            {(editionTotals.get(card.edition_id) ?? 1) > 1 ? ` · Copy ${copy}` : ""}
                          </span>
                          <span className="text-small text-ink-dim">
                            {card.edition_title} · {state}
                          </span>
                        </span>
                        <Button
                          kind="secondary"
                          type="submit"
                          aria-pressed={card.is_available}
                          disabled={!eligible && !card.is_available}
                        >
                          {card.is_available ? "Make private" : "Make available"}
                        </Button>
                      </form>
                    </li>
                  );
                })}
              </ul>
            )}
          </Block>
        </div>
      </div>
    </main>
  );
}
