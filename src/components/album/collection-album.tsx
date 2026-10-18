import type { ReactNode } from "react";
import Link from "next/link";
import { AlbumKeyboardNavigation } from "@/components/album/album-keyboard-navigation";
import { AlbumFilter } from "@/components/album/album-filter";
import { Tag } from "@/components/ui/tag";
import { Block } from "@/components/ui/block";
import { CardGrid } from "@/components/ui/page";
import { LiveCard } from "@/components/live-card";
import { toLiveCardPlayer } from "@/lib/live-card-player";
import { CollectionHeader } from "@/components/album/collection-header";
import { ARCHETYPES, ARCHETYPE_LABELS } from "@/game/archetypes";
import type { RarityTier } from "@/game/rating-engine";
import {
  applyLens,
  buildSlots,
  lensParam,
  paginate,
  parseLens,
  spreadFor,
  type AlbumCollectionCard,
  type AlbumDirectoryPlayer,
  type AlbumSlot,
} from "@/lib/album";

const TIERS: RarityTier[] = ["common", "bronze", "silver", "gold", "holo", "elite"];
type Props = {
  roster: AlbumDirectoryPlayer[];
  cards: AlbumCollectionCard[];
  lensValue?: string;
  pageValue?: string;
  ownPlayerId: string | null;
  photoUrls: Map<string, string>;
  /** Players in injury mode (ADR-082), for the plaster cast (ADR-084). */
  injuredPlayerIds: Set<string>;
  clubValue: number | null;
  /** Retired Players (ADR-165): their own set after the last page; never counted. */
  retiredSet?: RetiredSlot[];
};
export type RetiredSlot = {
  player: AlbumDirectoryPlayer;
  since: string | null;
  copies: AlbumCollectionCard[];
};

/** The Retired set: packs don't make these any more, so a slot fills by trade. */
function RetiredSet({
  slots,
  photoUrls,
  injuredPlayerIds,
}: {
  slots: RetiredSlot[];
  photoUrls: Map<string, string>;
  injuredPlayerIds: Set<string>;
}) {
  const owned = slots.filter((slot) => slot.copies.length > 0).length;
  return (
    <Block
      aside={
        <p className="text-small tabular-nums text-ink-dim">
          {owned} of {slots.length}
        </p>
      }
      id="retired-set"
      title="Retired set"
    >
      <p className="text-small text-ink-dim">
        Packs don&rsquo;t make these any more: the only way to fill a slot is a trade. Retired
        Players don&rsquo;t count towards the album.
      </p>
      <CardGrid wide={4}>
        {slots.map(({ player, since, copies }) => {
          const card = copies[0];
          return card ? (
            <Link
              prefetch={false}
              aria-label={`${player.display_name}, Retired: collected`}
              className="block rounded-[0.9rem] outline-offset-4 outline-brass focus-visible:outline-2"
              href={`/club/collection/${card.card_id}`}
              key={player.id}
            >
              <LiveCard player={toLiveCardPlayer(card, injuredPlayerIds, photoUrls)} />
            </Link>
          ) : (
            <Link
              prefetch={false}
              aria-label={`${player.display_name}, Retired: not collected`}
              className="grid aspect-[5/7] place-items-center content-center gap-1 rounded-[0.9rem] border-2 border-dashed border-line/70 p-3 text-center outline-offset-4 outline-brass focus-visible:outline-2"
              href={`/players/${player.slug}`}
              key={player.id}
            >
              <span className="text-body font-semibold text-ink-dim">{player.display_name}</span>
              <span className="text-small text-ink-faint">
                {since ? `Retired ${since}` : "Retired"}
              </span>
            </Link>
          );
        })}
      </CardGrid>
    </Block>
  );
}
function href(lens: string, page: string | number) {
  const p = new URLSearchParams();
  if (lens !== "all") p.set("lens", lens);
  p.set("page", String(page));
  return `/club/collection?${p}`;
}

/* The box every slot shares: a 1rem number strip above a 5:7 frame. Collected and
   empty slots MUST render the same box. When they differed — the collected slot
   carried the strip, the empty slot placed its number inside the frame — the two
   states were ~1rem apart in height, and because each leaf is its own grid in its
   own <article>, row heights are computed per page: any row where one leaf held a
   card and the other held a gap pushed the facing leaves out of horizontal
   alignment for the rest of the spread (KB-003). Every overlay a slot renders
   positions against this wrapper, so `top-5` / `top-8` / `bottom-1` below are
   measured from the top of the number strip, not the top of the card. */
function SlotFrame({ index, children }: { index: number; children: ReactNode }) {
  return (
    <div className="relative pt-4">
      <span className="absolute left-0 top-0 text-label font-semibold tabular-nums text-ink-faint">
        {index}
      </span>
      {children}
    </div>
  );
}

function AlbumSlotView({
  slot,
  photoUrls,
  injuredPlayerIds,
}: {
  slot: AlbumSlot;
  photoUrls: Map<string, string>;
  injuredPlayerIds: Set<string>;
}) {
  const card = slot.copies[0];
  if (!card)
    return (
      <SlotFrame index={slot.index}>
        <Link
          prefetch={false}
          aria-label={`${slot.player.display_name} — not collected`}
          className="relative block aspect-[5/7] rounded-[0.9rem] border border-dashed border-brass/40 bg-board-deep/70 p-3 shadow-inner outline-offset-4 outline-brass focus-visible:outline-2"
          href={`/players/${slot.player.slug}`}
        >
          <svg
            aria-hidden="true"
            className="h-3/5 w-full stroke-brass/20"
            fill="none"
            viewBox="0 0 200 200"
          >
            <path
              d="M64,28 L84,32 Q100,48 116,32 L136,28 L164,44 L180,92 L150,108 L144,94 L144,180 L56,180 L56,94 L50,108 L20,92 L36,44 Z"
              strokeWidth="4"
            />
          </svg>
          <span className="absolute bottom-3 left-3 right-3 border-t border-brass/20 pt-2 text-label font-semibold text-ink-faint">
            {slot.player.display_name}
          </span>
          <span
            className="tier-chip absolute right-2 top-8 h-5 w-5"
            data-rarity={slot.player.rarity_tier}
          >
            <span />
          </span>
        </Link>
      </SlotFrame>
    );
  // The slot shows its first copy, which can be a Special edition.
  const player = toLiveCardPlayer(card, injuredPlayerIds, photoUrls);
  return (
    <SlotFrame index={slot.index}>
      {slot.copies.length > 1 && (
        <span
          aria-hidden="true"
          className="absolute inset-x-1 top-5 z-0 h-[96%] rounded-[0.9rem] border border-line bg-panel-2 translate-x-1.5 translate-y-1.5"
        />
      )}
      <Link
        prefetch={false}
        aria-label={`${slot.player.display_name} — collected`}
        className="relative z-10 block rounded-[0.9rem] outline-offset-4 outline-brass focus-visible:outline-2"
        href={`/club/collection/${card.card_id}`}
      >
        <LiveCard player={player} />
      </Link>
      {card.active_listing_id && (
        <span className="absolute left-1/2 top-8 z-20 -translate-x-1/2 bg-board-deep/90 rounded-full">
          <Tag tone="you">Listed</Tag>
        </span>
      )}
      {card.held_by_offer_id && (
        <span className="absolute inset-x-1 top-8 z-20 rounded-lg bg-board-deep/90 px-2 py-1 text-center text-label font-semibold text-brass">
          In a trade offer
        </span>
      )}
      {slot.copies.length > 1 && (
        <Link
          prefetch={false}
          className="absolute -bottom-2 right-1 z-20 grid min-h-11 min-w-11 place-items-center rounded-full bg-board-deep/90"
          href={`/club/collection?view=manage&q=${encodeURIComponent(slot.player.display_name)}`}
        >
          <Tag tone="you">×{slot.copies.length}</Tag>
        </Link>
      )}
    </SlotFrame>
  );
}

function Leaf({
  number,
  slots,
  photoUrls,
  injuredPlayerIds,
}: {
  number: number;
  slots: AlbumSlot[];
  photoUrls: Map<string, string>;
  injuredPlayerIds: Set<string>;
}) {
  const collected = slots.filter((slot) => slot.copies.length > 0).length;
  return (
    <article className="relative min-w-0 rounded-2xl border border-line/60 bg-panel/60 p-3 sm:p-4">
      <header className="mb-4 flex items-baseline justify-between">
        <h2 className="text-heading font-semibold">Page {number}</h2>
        <span className="text-small tabular-nums text-ink-dim">
          {collected} of {slots.length}
        </span>
      </header>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {slots.map((slot) => (
          <AlbumSlotView
            injuredPlayerIds={injuredPlayerIds}
            key={slot.player.id}
            photoUrls={photoUrls}
            slot={slot}
          />
        ))}
      </div>
      <span className="mt-4 block text-right text-label font-semibold tabular-nums text-ink-faint">
        {number}
      </span>
    </article>
  );
}

export function CollectionAlbum({
  roster,
  cards,
  lensValue,
  pageValue,
  ownPlayerId,
  photoUrls,
  injuredPlayerIds,
  clubValue,
  retiredSet = [],
}: Props) {
  const allSlots = buildSlots(roster, cards);
  const lens = parseLens(lensValue);
  const selectedLens = lensParam(lens);
  const filtered = applyLens(allSlots, lens);
  const requested = pageValue === "all" ? "all" : Number(pageValue ?? 1);
  const { pages, total } = paginate(filtered, typeof requested === "number" ? requested : 1);
  const currentPage = typeof requested === "number" ? requested : 1;
  const [left, right] = spreadFor(currentPage);
  const spreadPages = [
    [left, pages[left - 1] ?? []],
    right !== null && right <= total ? [right, pages[right - 1] ?? []] : null,
  ].filter(Boolean) as [number, AlbumSlot[]][];
  const unique = allSlots.filter((slot) => slot.copies.length > 0).length;
  const own = ownPlayerId ? roster.find((player) => player.id === ownPlayerId) : null;
  const previousPage = currentPage > 1 ? currentPage - 1 : undefined;
  const nextPage = currentPage < total ? currentPage + 1 : undefined;
  const previousSpread = left > 1 ? left - 2 : undefined;
  const nextSpread = right !== null && right < total ? right + 1 : undefined;
  const options = [
    { value: "all", label: "All Players" },
    { value: "gaps", label: "Gaps" },
    { value: "specialists", label: "Specialists" },
    ...ARCHETYPES.map((type) => ({ value: `type:${type}`, label: ARCHETYPE_LABELS[type] })),
    ...TIERS.map((tier) => ({
      value: `tier:${tier}`,
      label: tier[0].toUpperCase() + tier.slice(1),
    })),
  ].map((option) => ({ ...option, count: applyLens(allSlots, parseLens(option.value)).length }));
  const label = options.find((option) => option.value === selectedLens)!.label;
  return (
    <div className="grid gap-6">
      <CollectionHeader
        cardCount={cards.length}
        clubValue={clubValue}
        mode="album"
        showArchetypeNudge={own?.archetype === "all_rounder"}
        totalPlayers={allSlots.length}
        uniquePlayers={unique}
      />
      <AlbumFilter
        selected={selectedLens}
        options={options}
        summary={`${label} · ${requested === "all" ? "all pages" : `page ${currentPage} of ${total}`}`}
      />
      {requested === "all" ? (
        <div className="space-y-6">
          {pages.map((slots, index) => (
            <Leaf
              injuredPlayerIds={injuredPlayerIds}
              key={index}
              number={index + 1}
              photoUrls={photoUrls}
              slots={slots}
            />
          ))}
        </div>
      ) : (
        <AlbumKeyboardNavigation
          nextHref={nextPage ? href(selectedLens, nextPage) : undefined}
          previousHref={previousPage ? href(selectedLens, previousPage) : undefined}
        >
          <div>
            <div className="grid gap-6 lg:grid-cols-2">
              {spreadPages.map(([number, slots]) => (
                <div className={number === currentPage ? "" : "hidden lg:block"} key={number}>
                  <Leaf
                    injuredPlayerIds={injuredPlayerIds}
                    number={number}
                    photoUrls={photoUrls}
                    slots={slots}
                  />
                </div>
              ))}
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 lg:hidden">
            {previousPage ? (
              <Link
                prefetch={false}
                className="min-h-11 rounded-xl border border-line px-4 py-3 text-center text-body font-semibold"
                href={href(selectedLens, previousPage)}
              >
                ‹ Page {previousPage}
              </Link>
            ) : (
              <span />
            )}
            {nextPage ? (
              <Link
                prefetch={false}
                className="min-h-11 rounded-xl border border-brass/60 px-4 py-3 text-center text-body font-semibold text-brass"
                href={href(selectedLens, nextPage)}
              >
                Page {nextPage} ›
              </Link>
            ) : (
              <span />
            )}
          </div>
        </AlbumKeyboardNavigation>
      )}
      {requested !== "all" && (
        <nav aria-label="Album spreads" className="hidden grid-cols-2 gap-3 lg:grid">
          {previousSpread ? (
            <Link
              prefetch={false}
              className="min-h-11 rounded-xl border border-line px-4 py-3 text-center text-body font-semibold"
              href={href(selectedLens, previousSpread)}
            >
              ‹ Pages {previousSpread}–{previousSpread + 1}
            </Link>
          ) : (
            <span />
          )}
          {nextSpread ? (
            <Link
              prefetch={false}
              className="min-h-11 rounded-xl border border-line px-4 py-3 text-center text-body font-semibold"
              href={href(selectedLens, nextSpread)}
            >
              Pages {nextSpread}
              {nextSpread < total ? `–${nextSpread + 1}` : ""} ›
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
      <Link
        prefetch={false}
        className="inline-flex min-h-11 items-center justify-self-start text-small font-semibold text-brass hover:underline"
        href={href(selectedLens, "all")}
      >
        Show all pages
      </Link>
      {retiredSet.length > 0 && (
        <RetiredSet injuredPlayerIds={injuredPlayerIds} photoUrls={photoUrls} slots={retiredSet} />
      )}
    </div>
  );
}
