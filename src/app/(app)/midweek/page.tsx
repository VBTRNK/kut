import { redirect } from "next/navigation";
import { NowFive, NowNote, type HubTile, type Mini } from "@/components/midweek/hub";
import { MidweekOptInButton } from "@/components/midweek/opt-in-button";
import { Button } from "@/components/ui/button";
import { InfoLink } from "@/components/ui/links";
import { MIDWEEK } from "@/game/midweek/config";
import { requireUser } from "@/lib/auth/user";
import { fetchInjuredPlayerIds } from "@/lib/injuries";
import {
  formatClock,
  formatDayDate,
  formatSavedAt,
  formatWeekday,
  isLockedTonight,
  isPickingOpen,
  type MidweekTournament,
} from "@/lib/midweek/entry";
import { championLeads } from "@/lib/midweek/evening";
import { loadMidweekEntryState, savedMinis } from "@/lib/midweek/load";
import { runDueMidweek } from "@/lib/midweek/run-due";
import { createClient } from "@/lib/supabase/server";
import { ChampionHub, EveningHub, HOW_TILE, HubFrame, lastWeekTile, PAST_TILE } from "./views";

export const metadata = { title: "Midweek Madness" };

/**
 * `/midweek`, the hub (C2, DR5-1, DR5-12, ADR-154): Compete's tabs, one Now
 * block for the moment and four tiles in fixed places, each opening a page of
 * its own (DR5-11). The picker is `/midweek/pick`. Which moment shows is the
 * same as before: the evening from the lock (ADR-113), last Wednesday's
 * champion until Thursday 23:59 (D4), otherwise picking.
 */
export default async function MidweekPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const user = await requireUser();
  // No scheduler: a visit locks, completes or opens a week that is due before
  // the page reads it, so a visit at 20:01 sees the locked week (ADR-098).
  await runDueMidweek();
  const supabase = await createClient();
  const [state, { view }] = await Promise.all([loadMidweekEntryState(supabase), searchParams]);
  // Disabled with nothing running (Week-Disabled), or a failed read: Midweek
  // doesn't show, and Compete's tab, which lands here, goes to Standings
  // instead of a dead end (ADR-107).
  if (!state) redirect("/leaderboard");
  // `?view=pick` was the way through to next week's picker while the champion
  // led; the picker has its own page now, so old links land on it.
  if (view === "pick") redirect("/midweek/pick");
  const { current } = state;
  const now = new Date();
  const nowIso = now.toISOString();

  if (!current.tournament_id || !current.lock_at || !current.week_start || !current.seed_hash) {
    return (
      <HubFrame
        now={
          <NowNote
            action={<InfoLink href="/how-it-works#midweek">How it works</InfoLink>}
            title="Opening soon"
          >
            The first week of Midweek Madness opens soon.
          </NowNote>
        }
        sub="Every Wednesday"
        tiles={[PAST_TILE, HOW_TILE]}
        title="Midweek Madness"
      />
    );
  }

  // Wednesday evening: tonight's week is locked and its rounds come out.
  if (isLockedTonight(current, now)) {
    return <EveningHub current={current} now={now} supabase={supabase} userId={user.id} />;
  }

  const previousResponse = await supabase
    .schema("kut")
    .from("midweek_tournaments_public")
    .select("*")
    .lt("week_start", current.week_start)
    .order("week_start", { ascending: false })
    .limit(1);
  const previous = previousResponse.error
    ? null
    : (((previousResponse.data ?? [])[0] ?? null) as MidweekTournament | null);

  if (!isPickingOpen(current, now)) {
    // The latest week has ended and the next isn't open yet (the switch is
    // paused, or the worker hasn't opened it).
    const latestResponse = await supabase
      .schema("kut")
      .from("midweek_tournaments_public")
      .select("*")
      .eq("tournament_id", current.tournament_id)
      .maybeSingle();
    const latest = latestResponse.error ? null : (latestResponse.data as MidweekTournament | null);
    if (latest && championLeads(latest, now)) {
      return <ChampionHub next={null} supabase={supabase} tournament={latest} userId={user.id} />;
    }
    const last = latest ? await lastWeekTile(supabase, user.id, latest) : null;
    return (
      <HubFrame
        now={
          <NowNote title="Next week opens soon">
            Your five don&rsquo;t carry over, but you can load them again in one tap.
          </NowNote>
        }
        sub="Midweek Madness"
        tiles={[...(last ? [last] : []), PAST_TILE, HOW_TILE]}
        title="Midweek Madness"
      />
    );
  }

  // Owner decision D4: last Wednesday's champion leads until Thursday 23:59
  // Amsterdam; its Now block offers next week's picker meanwhile.
  if (previous && championLeads(previous, now)) {
    return (
      <ChampionHub next={current} supabase={supabase} tournament={previous} userId={user.id} />
    );
  }

  const lockAt = current.lock_at;
  const sub = `${formatDayDate(lockAt)} · locks ${formatClock(lockAt)}`;
  const last = previous ? await lastWeekTile(supabase, user.id, previous) : null;
  const tiles: HubTile[] = [
    ...(last ? [last] : []),
    { title: "Bracket", state: `Drawn at ${formatClock(lockAt)}` },
    PAST_TILE,
    HOW_TILE,
  ];

  if (current.opted_out) {
    return (
      <HubFrame
        now={
          <NowNote
            action={
              <div className="flex flex-wrap gap-2">
                <MidweekOptInButton />
                <Button href="/settings" kind="secondary">
                  Settings
                </Button>
              </div>
            }
            title="You’re sitting this out"
          >
            You opted out, so you aren&rsquo;t entered and none of your cards are shown. Come back
            and you&rsquo;re in for {formatDayDate(lockAt)}.
          </NowNote>
        }
        sub={sub}
        tiles={tiles}
        title="Midweek Madness"
      />
    );
  }

  const squad = state.squad;
  if (squad === null) throw new Error("Could not load your saved five.");
  const injuredPlayerIds = await fetchInjuredPlayerIds(supabase);
  const saved = await savedMinis(supabase, squad, injuredPlayerIds);
  if (saved === null) throw new Error("Could not load your saved five.");
  // A saved card no longer owned plays as a trialist until the five is saved again.
  const lost = squad.length - saved.length;
  const cards: Mini[] = [
    ...saved,
    ...Array.from({ length: MIDWEEK.squadSize - saved.length }, () => null),
  ];
  const status = squad.length === 0 ? "none" : lost > 0 ? "dirty" : "saved";
  const line =
    status === "none"
      ? "Not picked yet, so an auto squad would play."
      : status === "dirty"
        ? `${lost === 1 ? "A Player" : `${lost} Players`} you saved left your collection. Save your five again.`
        : `Saved ${formatSavedAt(squad[0].saved_at)}. Change them until ${formatWeekday(lockAt)} ${formatClock(lockAt)}.`;

  return (
    <HubFrame
      now={<NowFive cards={cards} line={line} lockAt={lockAt} now={nowIso} status={status} />}
      sub={sub}
      tiles={tiles}
      title="Midweek Madness"
    />
  );
}
