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
  prefillSlots,
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
        .select(
          "card_id, player_id, is_live, display_name, archetype, ovr, pac, sho, pas, dri, def, phy, rarity_tier, photo_path",
        )
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

  const owned = (collectionResponse.data ?? []) as CollectionRow[];
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

  const byPlayer = new Map(cards.map((card) => [card.playerId, card]));
  const sendNow = saved.slots.flatMap((id) => (id ? [byPlayer.get(id)?.cardId ?? ""] : []));
  const savedCardIds = squad.map((row) => row.card_id);
  let lostSavedNotice: string | null = null;
  if (saved.lostPlayerIds.length > 0) {
    const lost = saved.lostPlayerIds.map(nameOf);
    const slotText =
      saved.lostSlots.length === 1
        ? `slot ${saved.lostSlots[0]} is`
        : `slots ${joinNames(saved.lostSlots.map(String))} are`;
    lostSavedNotice = `${joinNames(lost)} ${lost.length === 1 ? "isn't" : "aren't"} in your collection any more, so ${slotText} open. Save your five again, or a trialist plays there.`;
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
                    lostNames: lastWeek.lostPlayerIds.map(nameOf),
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
        .select(
          "card_id, player_id, is_live, display_name, archetype, ovr, pac, sho, pas, dri, def, phy, rarity_tier, photo_path",
        )
        .in(
          "card_id",
          squad.map((row) => row.card_id),
        ),
      fetchInjuredPlayerIds(supabase),
    ]);
    if (collection.error) throw new Error("Could not load your five.");
    const rows = (collection.data ?? []) as (OwnedCardRow & { card_id: string; ovr: number })[];
    const byCard = new Map(rows.map((row) => [row.card_id, row]));
    const photoUrls = await resolvePhotoUrls(
      supabase,
      rows.map((row) => row.photo_path),
    );
    const missing = squad.filter((row) => !byCard.has(row.card_id)).map((row) => row.player_id);
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
