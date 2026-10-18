import { redirect } from "next/navigation";
import { LiveCard, type LiveCardPlayer } from "@/components/live-card";
import { MidweekTrialistCard } from "@/components/midweek/bits";
import { MidweekPicker, type PickCard } from "@/components/midweek/picker";
import { Block } from "@/components/ui/block";
import { InfoLink } from "@/components/ui/links";
import { CardGrid, COLUMN, PAGE, PageHeader } from "@/components/ui/page";
import { Tag } from "@/components/ui/tag";
import { MIDWEEK } from "@/game/midweek/config";
import { requireUser } from "@/lib/auth/user";
import { fetchInjuredPlayerIds } from "@/lib/injuries";
import { toLiveCardPlayer, type OwnedCardRow } from "@/lib/live-card-player";
import { strongestCopies } from "@/lib/midweek/copies";
import {
  formatClock,
  formatDayDate,
  isLockedTonight,
  isPickingOpen,
  joinNames,
  lostClause,
  prefillSlots,
  slotPhrase,
  starterNotice,
  weekArchetype,
  type MidweekCurrent,
  type MySquadRow,
} from "@/lib/midweek/entry";
import { entryCardFace, TIER_LABEL } from "@/lib/midweek/evening";
import { loadMidweekEntryState } from "@/lib/midweek/load";
import { loadWeekResults } from "@/lib/midweek/results";
import { runDueMidweek } from "@/lib/midweek/run-due";
import { resolvePhotoUrls } from "@/lib/player-photos";
import { createClient } from "@/lib/supabase/server";
import { isRetiredRow } from "@/lib/academy";
import { MidweekMiniCard } from "@/components/midweek/mini-card";

export const metadata = { title: "Pick your five" };

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

type CollectionRow = {
  card_id: string;
  player_id: string;
  is_live: boolean;
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
  photo_path: string | null;
  // Appended by 20261024000000 (ADR-165): a Retired card can't play Midweek.
  player_stage?: string | null;
};

const BACK = { href: "/midweek", label: "Midweek" };

/** Display names for Players the member no longer owns, for the notices. */
async function playerNames(supabase: SupabaseServerClient, ids: string[]) {
  if (ids.length === 0) return new Map<string, string>();
  const { data } = await supabase
    .schema("kut")
    .from("player_directory")
    .select("id, display_name")
    .in("id", ids);
  return new Map(
    ((data ?? []) as { id: string; display_name: string }[]).map((row) => [
      row.id,
      row.display_name,
    ]),
  );
}

/**
 * `/midweek/pick` (DR5-11, DR5-13, ADR-154): the picker while picking is open;
 * from the lock, your locked five, read-only. It reads what the picker read
 * on `/midweek` before, at the same moments. Opted out, or between weeks, it
 * goes back to the hub, which says why.
 */
export default async function MidweekPickPage() {
  const user = await requireUser();
  await runDueMidweek();
  const supabase = await createClient();
  const state = await loadMidweekEntryState(supabase);
  if (!state) redirect("/leaderboard");
  const { current } = state;
  const now = new Date();
  if (!current.tournament_id || !current.lock_at || !current.week_start) redirect("/midweek");
  if (current.opted_out) redirect("/midweek");
  if (isLockedTonight(current, now)) {
    return (
      <LockedFive current={current} squad={state.squad} supabase={supabase} userId={user.id} />
    );
  }
  if (!isPickingOpen(current, now)) redirect("/midweek");

  const lockAt = current.lock_at;
  const squad = state.squad;
  if (squad === null) throw new Error("Could not load your saved five.");

  const [collectionResponse, lastWeekResponse, injuredPlayerIds, frozenResponse] =
    await Promise.all([
      supabase
        .schema("kut")
        .from("my_collection_cards")
        // "*": views only gain columns (the stage, ADR-165).
        .select("*")
        .order("ovr", { ascending: false })
        .order("display_name"),
      supabase
        .schema("kut")
        .from("my_midweek_squad")
        .select("*")
        .lt("week_start", current.week_start)
        .order("week_start", { ascending: false })
        .order("slot")
        .limit(MIDWEEK.squadSize * 2),
      fetchInjuredPlayerIds(supabase),
      supabase
        .schema("kut")
        .from("midweek_archetypes")
        .select("player_id, archetype")
        .eq("tournament_id", current.tournament_id),
    ]);
  if (collectionResponse.error) throw new Error("Could not load your collection.");
  // The archetypes this week plays, frozen when it opened (ADR-099). Vercel
  // deploys before the hosted push, so until then the view is missing and every
  // card falls back to its live archetype, as the lock then still reads it.
  const frozen = new Map(
    frozenResponse.error
      ? []
      : ((frozenResponse.data ?? []) as { player_id: string; archetype: string }[]).map((row) => [
          row.player_id,
          row.archetype,
        ]),
  );

  // One "playable in Midweek" condition (ADR-165): not Retired. Retired cards
  // are listed below the picker, faded and not pickable (#246 S1, Q6).
  const everything = (collectionResponse.data ?? []) as CollectionRow[];
  const owned = everything.filter((card) => !isRetiredRow(card));
  const retiredTiles = strongestCopies(everything.filter(isRetiredRow), injuredPlayerIds);
  const retiredPlayerIds = new Set(retiredTiles.map(({ card }) => card.player_id));
  const tiles = strongestCopies(owned, injuredPlayerIds);
  const ownedPlayerIds = new Set(tiles.map(({ card }) => card.player_id));
  const photoUrls = await resolvePhotoUrls(
    supabase,
    tiles.map(({ card }) => card.photo_path),
  );
  const cards: PickCard[] = tiles.map(({ card, copies }) => {
    const week = weekArchetype(frozen, card.player_id, card.archetype);
    return {
      playerId: card.player_id,
      cardId: card.card_id,
      displayName: card.display_name,
      archetype: week.archetype,
      archetypeLabel: week.label,
      change: week.change,
      next: week.next,
      tierLabel: TIER_LABEL[card.rarity_tier],
      copies,
      card: toLiveCardPlayer({ ...card, archetype: week.archetype }, injuredPlayerIds, photoUrls),
    };
  });

  // The saved five, one Player per slot; a Player no longer owned leaves the
  // slot open and is named below.
  const saved = prefillSlots(squad, ownedPlayerIds, MIDWEEK.squadSize);
  // "Load last week's five": the latest earlier tournament the member saved for.
  const earlier = lastWeekResponse.error ? [] : ((lastWeekResponse.data ?? []) as MySquadRow[]);
  const lastWeekRows = earlier.filter((row) => row.week_start === earlier[0]?.week_start);
  const lastWeek =
    lastWeekRows.length > 0 ? prefillSlots(lastWeekRows, ownedPlayerIds, MIDWEEK.squadSize) : null;
  const names = await playerNames(supabase, [
    ...saved.lostPlayerIds,
    ...(lastWeek?.lostPlayerIds ?? []),
  ]);
  const nameOf = (id: string) => names.get(id) ?? "A Player";
  const gone = (ids: string[]) => ids.filter((id) => !retiredPlayerIds.has(id)).map(nameOf);
  const retired = (ids: string[]) => ids.filter((id) => retiredPlayerIds.has(id)).map(nameOf);

  const byPlayer = new Map(cards.map((card) => [card.playerId, card]));
  const sendNow = saved.slots.flatMap((id) => (id ? [byPlayer.get(id)?.cardId ?? ""] : []));
  const savedCardIds = squad.map((row) => row.card_id);
  let lostSavedNotice: string | null = null;
  if (saved.lostPlayerIds.length > 0) {
    const clause = lostClause(gone(saved.lostPlayerIds), retired(saved.lostPlayerIds));
    lostSavedNotice = `${clause}, so ${slotPhrase(saved.lostSlots)} open. Save your five again, or a trialist plays there.`;
  } else if (savedCardIds.length > 0 && sendNow.some((id) => !savedCardIds.includes(id))) {
    lostSavedNotice =
      "Your collection has changed since you saved, so a different copy of one of your Players would play now. Save your five again to make it count.";
  }

  return (
    <main className={PAGE}>
      <div className={`${COLUMN} lg:max-w-6xl`}>
        <PageHeader
          back={BACK}
          sub={`${formatDayDate(lockAt)} · locks ${formatClock(lockAt)}`}
          title="Pick your five"
        />
        {cards.length === 0 ? (
          <Block title="No cards yet">
            <p className="text-body text-ink-dim">
              You need at least one card to take part. Every Player you add from a pack can play.
            </p>
            <InfoLink href="/club/packs">Open a pack</InfoLink>
          </Block>
        ) : (
          <MidweekPicker
            cards={cards}
            initialSlots={saved.slots}
            lastWeek={
              lastWeek
                ? {
                    slots: lastWeek.slots,
                    lostNames: gone(lastWeek.lostPlayerIds),
                    retiredNames: retired(lastWeek.lostPlayerIds),
                    lostSlots: lastWeek.lostSlots,
                  }
                : null
            }
            lockAt={lockAt}
            lostSavedNotice={lostSavedNotice}
            savedAt={squad[0]?.saved_at ?? null}
            savedCardIds={savedCardIds}
            starterLead={starterNotice(cards.length, MIDWEEK.squadSize)}
            trialistOvr={MIDWEEK.trialist.ovr}
          />
        )}
        {retiredTiles.length > 0 && (
          <Block
            aside={<p className="text-small text-ink-dim">Can&rsquo;t be picked</p>}
            title="Retired cards"
          >
            <ul className="grid">
              {retiredTiles.map(({ card }) => (
                <li
                  className="grid min-h-14 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b border-line/40 py-2 opacity-70 last:border-b-0"
                  key={card.player_id}
                >
                  <MidweekMiniCard
                    injured={card.is_live && injuredPlayerIds.has(card.player_id)}
                    ovr={card.ovr}
                    rarityTier={card.rarity_tier}
                    retired
                  />
                  <span className="grid min-w-0">
                    <span className="truncate text-body font-semibold">{card.display_name}</span>
                    <span className="truncate text-small text-ink-dim">
                      Can&rsquo;t play Midweek
                    </span>
                  </span>
                  <Tag tone="out">Retired</Tag>
                </li>
              ))}
            </ul>
            <InfoLink href="/how-it-works#retired">When a Player retires</InfoLink>
          </Block>
        )}
      </div>
    </main>
  );
}

/**
 * From the lock: the five that plays tonight, read-only. Before the draw it is
 * the saved five as the engine plays it (the surviving picks moved up,
 * trialists after them, ADR-095); once drawn, the entered five, an auto squad
 * included. Only the member's own five.
 */
async function LockedFive({
  supabase,
  current,
  squad,
  userId,
}: {
  supabase: SupabaseServerClient;
  current: MidweekCurrent;
  squad: MySquadRow[] | null;
  userId: string;
}) {
  const lockAt = current.lock_at as string;
  const header = (
    <PageHeader
      back={BACK}
      sub={`${formatDayDate(lockAt)} · locked at ${formatClock(lockAt)}`}
      title="Your five"
    />
  );
  let cards: (LiveCardPlayer | null)[] = [];
  let auto = false;
  let lost: string[] = [];
  let retiredLost: string[] = [];

  if (current.status === "simulated") {
    const results = await loadWeekResults(supabase, current.tournament_id as string, new Date());
    const rows = results.entries
      .filter((row) => row.user_id === userId)
      .sort((a, b) => a.slot - b.slot);
    const photoUrls = await resolvePhotoUrls(
      supabase,
      rows.map((row) => row.photo_path),
    );
    auto = rows[0]?.auto ?? false;
    cards = rows.map((row) =>
      row.trialist || row.player_name === null ? null : entryCardFace(row, photoUrls),
    );
  } else if (squad && squad.length > 0) {
    const [collection, injuredPlayerIds] = await Promise.all([
      supabase
        .schema("kut")
        .from("my_collection_cards")
        // "*": the stage was appended by 20261024000000 (ADR-165).
        .select("*")
        .in(
          "card_id",
          squad.map((row) => row.card_id),
        ),
      fetchInjuredPlayerIds(supabase),
    ]);
    if (collection.error) throw new Error("Could not load your five.");
    const rows = (collection.data ?? []) as (OwnedCardRow & { card_id: string; ovr: number })[];
    // The lock drops a Retired pick like a sold one (ADR-165): it is still
    // owned, but no longer available for Midweek.
    retiredLost = rows.filter(isRetiredRow).map((row) => row.display_name);
    const byCard = new Map(
      rows.filter((row) => !isRetiredRow(row)).map((row) => [row.card_id, row]),
    );
    const photoUrls = await resolvePhotoUrls(
      supabase,
      rows.map((row) => row.photo_path),
    );
    const retiredCards = new Set(rows.filter(isRetiredRow).map((row) => row.card_id));
    const missing = squad
      .filter((row) => !byCard.has(row.card_id) && !retiredCards.has(row.card_id))
      .map((row) => row.player_id);
    const names = await playerNames(supabase, missing);
    const kept = squad.flatMap((row) => {
      const card = byCard.get(row.card_id);
      return card ? [toLiveCardPlayer(card, injuredPlayerIds, photoUrls)] : [];
    });
    cards = [...kept, ...Array.from({ length: MIDWEEK.squadSize - kept.length }, () => null)];
    lost = missing.map((id) => names.get(id) ?? "A Player");
  }

  return (
    <main className={PAGE}>
      <div className={`${COLUMN} lg:max-w-5xl`}>
        {header}
        {cards.length === 0 ? (
          <Block title="No five tonight">
            <p className="text-body text-ink-dim">
              You didn&rsquo;t pick, so an auto squad plays for you. See it once the draw is out.
            </p>
          </Block>
        ) : (
          <Block
            aside={auto ? <Tag tone="auto">Auto squad</Tag> : <Tag tone="won">✓ Locked</Tag>}
            title="Tonight’s five"
          >
            {lost.length > 0 && (
              <p className="text-small text-ink-dim">
                {joinNames(lost)} {lost.length === 1 ? "was" : "were"} no longer in your collection
                at the lock, so a trialist took {lost.length === 1 ? "that slot" : "those slots"}.
              </p>
            )}
            {retiredLost.length > 0 && (
              <p className="text-small text-ink-dim">
                {joinNames(retiredLost)} {retiredLost.length === 1 ? "was" : "were"} no longer
                available for Midweek at the lock (Retired), so{" "}
                {retiredLost.length === 1 ? "that slot was" : "those slots were"} filled after your
                other picks.
              </p>
            )}
            <CardGrid>
              {cards.map((card, index) =>
                card ? (
                  <LiveCard key={index} player={card} />
                ) : (
                  <MidweekTrialistCard
                    key={index}
                    slot={index + 1}
                    state="trialist"
                    trialistOvr={MIDWEEK.trialist.ovr}
                  />
                ),
              )}
            </CardGrid>
          </Block>
        )}
      </div>
    </main>
  );
}
