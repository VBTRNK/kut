import Link from "next/link";
import { CardGrid, COLUMN, PAGE } from "@/components/ui/page";
import { Tag } from "@/components/ui/tag";
import { FilterBar } from "@/components/filter-bar";
import { LiveCard, type LiveCardPlayer } from "@/components/live-card";
import { requireUser } from "@/lib/auth/user";
import { fetchInjuredPlayerIds } from "@/lib/injuries";
import { toLiveCardPlayer } from "@/lib/live-card-player";
import { resolvePhotoUrls } from "@/lib/player-photos";
import { createClient } from "@/lib/supabase/server";
import { CollectionAlbum } from "@/components/album/collection-album";
import { CollectionHeader } from "@/components/album/collection-header";
import {
  applyLens,
  buildSlots,
  paginate,
  parseLens,
  type AlbumCollectionCard,
  type AlbumDirectoryPlayer,
} from "@/lib/album";
import { notFound } from "next/navigation";
import { fetchLifecycle, firstTeamOnly, isRetiredRow, weekLabel } from "@/lib/academy";

type CollectionCard = {
  card_id: string;
  edition_id: string;
  edition_title: string;
  edition_type: string;
  is_live: boolean;
  source: string;
  player_id: string;
  player_slug: string;
  display_name: string;
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
  held_by_offer_id: string | null;
  photo_path: string | null;
  // Appended by 20261024000000 (ADR-165): the Retired stamp.
  player_stage?: string | null;
};

type CollectionPageProps = {
  searchParams: Promise<{
    discard?: string;
    purchase?: string;
    q?: string;
    rarity?: string;
    sort?: string;
    view?: string;
    page?: string;
    lens?: string;
  }>;
};

// Ascending, matching the Market, the player directory and the album's own lens
// menu. This grid was the only surface listing tiers highest-first.
const RARITIES = ["common", "bronze", "silver", "gold", "holo", "elite"] as const;
const SORTS = {
  ovr: "Rating, high to low",
  name: "Name, A to Z",
  value: "Discard value",
} as const;
type SortKey = keyof typeof SORTS;
const TIER_OPTIONS = RARITIES.map((tier) => ({
  value: tier,
  label: tier[0].toUpperCase() + tier.slice(1),
}));
const SORT_OPTIONS = (Object.keys(SORTS) as SortKey[]).map((key) => ({
  value: key,
  label: SORTS[key],
}));

export default async function CollectionPage({ searchParams }: CollectionPageProps) {
  const user = await requireUser();
  const supabase = await createClient();
  const [{ data, error }, rosterResponse, profileResponse, clubValueResponse, query] =
    await Promise.all([
      supabase
        .schema("kut")
        .from("my_collection_cards")
        // "*": views only gain columns (the stage, ADR-165).
        .select("*")
        .order("ovr", { ascending: false })
        .order("display_name"),
      supabase.schema("kut").from("player_directory").select("*").order("display_name"),
      supabase.schema("kut").from("profiles").select("player_id").eq("id", user.id).maybeSingle(),
      // Club Value moved onto this header when /club retired (ADR-053). Non-critical:
      // the page's own throw below stays reserved for the cards query.
      supabase.schema("kut").from("my_club_value").select("club_value").maybeSingle(),
      searchParams,
    ]);

  if (error) {
    throw new Error("Could not load your collection.");
  }

  // A club's collection is tens of cards, not thousands, so the whole set is
  // fetched once and narrowed here: it keeps the header totals honest (they
  // describe the whole collection, not the current filter) in one round trip.
  const all = (data ?? []) as CollectionCard[];
  const clubValue = clubValueResponse.data?.club_value ?? null;
  const everyone = (rosterResponse.data ?? []) as (AlbumDirectoryPlayer & {
    lifecycle_stage?: string | null;
  })[];
  // Album completion counts the First Team; Retired copies get their own set
  // after the last page (ADR-165, #246 S1 C4).
  const directory = firstTeamOnly(everyone);
  const retiredPlayers = everyone.filter(isRetiredRow);
  const ownPlayer = profileResponse.data?.player_id
    ? directory.find((player) => player.id === profileResponse.data?.player_id)
    : null;
  if (query.view !== "manage") {
    if (rosterResponse.error) throw new Error("Could not load the TFH album.");
    const page = query.page ?? "1";
    const requestedPage = page === "all" ? page : Number(page);
    if (page !== "all" && (!Number.isInteger(requestedPage) || Number(requestedPage) < 1))
      notFound();
    const albumCards = all.map((card) => ({
      ...card,
      live_ovr: card.ovr,
    })) as unknown as AlbumCollectionCard[];
    const roster = directory;
    const retiredWeeks =
      retiredPlayers.length > 0
        ? new Map(
            (await fetchLifecycle(supabase, { stage: "retired" })).map((row) => [
              row.player_id,
              row.retired_week,
            ]),
          )
        : new Map<string, string | null>();
    const retiredSet = retiredPlayers.map((player) => {
      const week = retiredWeeks.get(player.id);
      return {
        player,
        since: week ? weekLabel(week) : null,
        copies: albumCards.filter((card) => card.player_id === player.id),
      };
    });
    const filteredSlots = applyLens(buildSlots(roster, albumCards), parseLens(query.lens));
    const albumTotal = paginate(filteredSlots, 1).total;
    if (page !== "all" && Number(page) > albumTotal) notFound();
    const visibleSlots =
      page === "all"
        ? filteredSlots
        : (() => {
            const [left, right] =
              Number(page) % 2 === 0
                ? [Number(page) - 1, Number(page)]
                : [Number(page), Number(page) + 1];
            return [
              ...(paginate(filteredSlots, left).slots ?? []),
              ...(right <= albumTotal ? paginate(filteredSlots, right).slots : []),
            ];
          })();
    const visiblePaths = [
      ...visibleSlots.flatMap((slot) => slot.copies.map((card) => card.photo_path)),
      ...retiredSet.flatMap((entry) => entry.copies.slice(0, 1).map((card) => card.photo_path)),
    ];
    const [photoUrls, injuredPlayerIds] = await Promise.all([
      resolvePhotoUrls(supabase, visiblePaths),
      fetchInjuredPlayerIds(supabase),
    ]);
    return (
      <main className={PAGE}>
        <section className={`${COLUMN} lg:max-w-6xl`}>
          <CollectionAlbum
            cards={albumCards}
            clubValue={clubValue}
            lensValue={query.lens}
            ownPlayerId={profileResponse.data?.player_id ?? null}
            pageValue={page}
            injuredPlayerIds={injuredPlayerIds}
            photoUrls={photoUrls}
            retiredSet={retiredSet}
            roster={roster}
          />
        </section>
      </main>
    );
  }
  const term = query.q?.trim().slice(0, 80) ?? "";
  const rarity = RARITIES.includes(query.rarity as (typeof RARITIES)[number])
    ? query.rarity
    : undefined;
  const sort: SortKey = query.sort && query.sort in SORTS ? (query.sort as SortKey) : "ovr";

  const cards = all
    .filter((card) => (rarity ? card.rarity_tier === rarity : true))
    .filter((card) => (term ? card.display_name.toLowerCase().includes(term.toLowerCase()) : true))
    .sort((a, b) =>
      sort === "name"
        ? a.display_name.localeCompare(b.display_name)
        : sort === "value"
          ? b.discard_value - a.discard_value
          : b.ovr - a.ovr || a.display_name.localeCompare(b.display_name),
    );

  const [photoUrls, injuredPlayerIds] = await Promise.all([
    resolvePhotoUrls(
      supabase,
      cards.map((card) => card.photo_path),
    ),
    fetchInjuredPlayerIds(supabase),
  ]);
  const firstTeamIds = new Set(directory.map((player) => player.id));
  const uniquePlayers = new Set(
    all.filter((card) => firstTeamIds.has(card.player_id)).map((card) => card.player_id),
  ).size;
  const totalPlayers = directory.length;
  const filtered = Boolean(term || rarity);

  return (
    <main className={PAGE}>
      <section className={`${COLUMN} lg:max-w-6xl`}>
        <CollectionHeader
          cardCount={all.length}
          clubValue={clubValue}
          mode="manage"
          showArchetypeNudge={ownPlayer?.archetype === "all_rounder"}
          totalPlayers={totalPlayers}
          uniquePlayers={uniquePlayers}
        />

        {query.discard &&
          Number.isSafeInteger(Number(query.discard)) &&
          Number(query.discard) > 0 && (
            <p className="rounded-2xl border border-moss-line/40 bg-moss-bg/50 p-4 font-semibold text-moss">
              Card discarded. {query.discard} FLUT Coins were added to your wallet.
            </p>
          )}
        {query.purchase &&
          Number.isSafeInteger(Number(query.purchase)) &&
          Number(query.purchase) > 0 && (
            <p className="rounded-2xl border border-moss-line/40 bg-moss-bg/50 p-4 font-semibold text-moss">
              Purchase complete. {query.purchase} FLUT Coins were paid and the card is now in your
              collection.
            </p>
          )}

        {all.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-line bg-panel/60 p-8 text-center">
            <h2 className="text-heading font-semibold">Your collection is empty</h2>
            <p className="mt-3 text-ink-dim">Open a pack to receive your first Live Cards.</p>
            <Link
              className="mt-6 inline-flex min-h-12 items-center rounded-xl bg-gradient-to-b from-[#eebd63] to-[#d29a34] px-5 font-extrabold text-ink-on-accent"
              href="/club/packs"
            >
              Open a pack
            </Link>
          </div>
        ) : (
          <>
            {/* The same bar the Market and the player directory use. This grid
                had its own vocabulary for exactly the same three fields: chips
                for tier, a link row for sort, and a search box with no button. */}
            <FilterBar
              basePath="/club/collection"
              chips={{ name: "rarity", allLabel: "All tiers", options: TIER_OPTIONS }}
              defaultSort="ovr"
              preserve={{ view: "manage" }}
              searchPlaceholder="Search your cards"
              sorts={SORT_OPTIONS}
              summary={`${filtered ? `${cards.length} of ${all.length} cards · ` : ""}${SORTS[sort]}`}
              values={{ q: term || undefined, rarity, sort }}
            />

            {cards.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-line p-8 text-center text-ink-dim">
                No cards match these filters.{" "}
                <Link
                  className="font-semibold text-brass hover:underline"
                  href="/club/collection?view=manage"
                >
                  Clear them
                </Link>
                .
              </p>
            ) : (
              <>
                <CardGrid>
                  {cards.map((card) => {
                    const cardPlayer = toLiveCardPlayer(card, injuredPlayerIds, photoUrls);
                    return (
                      <Link
                        prefetch={false}
                        aria-label={`Open ${card.display_name}'s card`}
                        className="relative block rounded-[0.9rem] outline-offset-4 outline-brass focus-visible:outline-2"
                        href={`/club/collection/${card.card_id}`}
                        key={card.card_id}
                      >
                        <LiveCard player={cardPlayer} />
                        {/* Status rides the card rather than floating as loose text
                              beneath it, so a scanned grid reads in one pass. */}
                        {card.active_listing_id && (
                          <span className="absolute left-1/2 top-3 z-10 -translate-x-1/2 rounded-full bg-board-deep/90">
                            <Tag tone="you">Listed · {card.active_listing_price}</Tag>
                          </span>
                        )}
                        {!card.is_live && (
                          <span className="absolute bottom-3 left-1/2 z-10 -translate-x-1/2 rounded-full border border-line bg-board-deep/90 px-3 py-1 text-label font-semibold text-ink-dim backdrop-blur-sm">
                            {card.edition_title}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </CardGrid>
              </>
            )}
          </>
        )}
      </section>
    </main>
  );
}
