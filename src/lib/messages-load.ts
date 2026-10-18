import type { createClient } from "@/lib/supabase/server";
import { targetLookupIds, type TargetLookups, type UserNotification } from "./messages";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/** The message columns the inbox and the open route read. */
export const MESSAGE_COLUMNS =
  "id, event_type, title, body, reference_type, reference_id, read_at, created_at";

/**
 * Reads what `messageTarget` can't take from a row: the weeks of the Midweek
 * tournaments named, and which bought cards the member still owns. Tolerant: a
 * failed read leaves those messages without a link, never fails the inbox.
 */
export async function loadTargetLookups(
  supabase: SupabaseServerClient,
  messages: readonly UserNotification[],
): Promise<TargetLookups> {
  const { tournamentIds, saleIds, lifecycleEventIds } = targetLookupIds(messages);
  const [tournaments, sales, lifecycleEvents] = await Promise.all([
    tournamentIds.length === 0
      ? null
      : supabase
          .schema("kut")
          .from("midweek_tournaments_public")
          .select("tournament_id, week_start")
          .in("tournament_id", tournamentIds),
    saleIds.length === 0
      ? null
      : supabase.schema("kut").from("market_sales").select("id, card_id").in("id", saleIds),
    lifecycleEventIds.length === 0
      ? null
      : supabase
          .schema("kut")
          .from("player_lifecycle_events_public")
          .select("id, slug")
          .in("id", lifecycleEventIds),
  ]);
  if (tournaments?.error) console.error("messages tournament read failed", tournaments.error.code);
  if (sales?.error) console.error("messages sale read failed", sales.error.code);
  if (lifecycleEvents?.error)
    console.error("messages lifecycle read failed", lifecycleEvents.error.code);
  const slugByLifecycleEvent = new Map(
    ((lifecycleEvents?.data ?? []) as { id: string; slug: string }[]).map((row) => [
      row.id,
      row.slug,
    ]),
  );

  const weekByTournament = new Map(
    ((tournaments?.data ?? []) as { tournament_id: string; week_start: string }[]).map((row) => [
      row.tournament_id,
      row.week_start,
    ]),
  );
  const saleCards = (sales?.data ?? []) as { id: string; card_id: string }[];
  const ownedCardBySale = new Map<string, string>();
  if (saleCards.length > 0) {
    const owned = await supabase
      .schema("kut")
      .from("my_collection_cards")
      .select("card_id")
      .in(
        "card_id",
        saleCards.map((sale) => sale.card_id),
      );
    const ownedIds = new Set(((owned.data ?? []) as { card_id: string }[]).map((r) => r.card_id));
    for (const sale of saleCards) {
      if (ownedIds.has(sale.card_id)) ownedCardBySale.set(sale.id, sale.card_id);
    }
  }
  return { weekByTournament, ownedCardBySale, slugByLifecycleEvent };
}
