import { PAGE, COLUMN } from "@/components/ui/page";
import { notFound } from "next/navigation";
import { PackReveal, type RevealCard } from "@/components/pack-reveal";
import { requireUser } from "@/lib/auth/user";
import { fetchInjuredPlayerIds } from "@/lib/injuries";
import { toListedCardPlayer, type ListedCardRow } from "@/lib/live-card-player";
import { packSummary } from "@/lib/pack-summary";
import { openedNote, packKind } from "@/lib/packs";
import { resolvePhotoUrls } from "@/lib/player-photos";
import { createClient } from "@/lib/supabase/server";

type PackResultPageProps = { params: Promise<{ openingId: string }> };

type PackResultCard = ListedCardRow & {
  opening_id: string;
  opened_at: string;
  price_paid: number;
  pack_title: string;
  slot: number;
  card_id: string;
  // Appended by #223 S1 (ADR-164): the receipt's stored identity and what each
  // card was when opened. Absent on an older schema, null before S1.
  pack_slug?: string | null;
  opened_tier?: string | null;
  opened_ovr?: number | null;
};

export default async function PackResultPage({ params }: PackResultPageProps) {
  await requireUser();
  const { openingId } = await params;
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("kut")
    // "*" rather than a column list: ADR-086 appended player_id and is_live, and
    // the page ships before the hosted schema does.
    .from("my_pack_opening_results")
    .select("*")
    .eq("opening_id", openingId)
    .order("slot");

  if (error) throw new Error("Could not load this pack opening.");
  if (!data || data.length === 0) notFound();

  const cards = data as PackResultCard[];
  const [photoUrls, injuredPlayerIds, ownedResponse, rosterResponse] = await Promise.all([
    resolvePhotoUrls(
      supabase,
      cards.map((card) => card.photo_path),
    ),
    fetchInjuredPlayerIds(supabase),
    supabase.schema("kut").from("my_collection_cards").select("card_id, player_id, discard_value"),
    // The album's slot order (`buildSlots`): by name, then id.
    supabase.schema("kut").from("player_directory").select("id, display_name"),
  ]);
  // The chips are a nicety: a failed read shows the cards without them.
  const summary =
    ownedResponse.error || rosterResponse.error
      ? null
      : packSummary({
          opened: cards.map((card) => ({
            card_id: card.card_id,
            player_id: card.player_id ?? null,
          })),
          owned: (ownedResponse.data ?? []) as {
            card_id: string;
            player_id: string;
            discard_value: number;
          }[],
          roster: ((rosterResponse.data ?? []) as { id: string; display_name: string }[])
            .sort(
              (a, b) => a.display_name.localeCompare(b.display_name) || a.id.localeCompare(b.id),
            )
            .map((player) => player.id),
        });

  const revealCards: RevealCard[] = cards.map((card, index) => {
    const player = toListedCardPlayer(card, injuredPlayerIds, photoUrls);
    return {
      cardId: card.card_id,
      player,
      chip: summary?.chips[index]?.text ?? null,
      openedNote: openedNote(player.rarityTier, card.opened_tier, card.opened_ovr),
    };
  });
  // The receipt as stored: its own slug, title and price paid, never inferred
  // from today's prices or the cards drawn.
  const receipt = cards[0];

  return (
    <main className={PAGE}>
      <section className={`${COLUMN} lg:max-w-4xl`}>
        <PackReveal
          cards={revealCards}
          cardHrefBase="/club/collection/"
          doneHref="/club/collection"
          doneLabel="View your Collection"
          secondaryHref="/club/packs"
          secondaryLabel="Open another"
          pack={{
            kind: packKind(receipt.pack_slug),
            title: receipt.pack_title,
            pricePaid: receipt.price_paid,
          }}
          summaryLine={summary?.line}
        />
      </section>
    </main>
  );
}
