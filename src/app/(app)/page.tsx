import Link from "next/link";
import type { ReactNode } from "react";
import { IconChronicle } from "@/components/icons";
import { LiveCard, type LiveCardPlayer } from "@/components/live-card";
import {
  MidweekEntryCard,
  MidweekFinalCard,
  MidweekLiveCard,
} from "@/components/midweek/entry-points";
import {
  ACTIVITY_FLOOR_ISO,
  describeFoldedActivity,
  foldActivity,
  type ActivityRow,
} from "@/lib/activity";
import { checkInClosesAt, orderNowCards, type NowCard } from "@/lib/home/now";
import { formatShortLock, formatWeekday } from "@/lib/midweek/entry";
import { championLeadsUntil } from "@/lib/midweek/evening";
import { countNoun } from "@/game/reported-count";
import { formatDate } from "@/lib/format";
import { fetchInjuredPlayerIds, type InjuryStatus } from "@/lib/injuries";
import { toLiveCardPlayer } from "@/lib/live-card-player";
import { loadMidweekEntryPoint } from "@/lib/midweek/load";
import { runDueMidweek } from "@/lib/midweek/run-due";
import { resolvePhotoUrls } from "@/lib/player-photos";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Block } from "@/components/ui/block";
import { Button } from "@/components/ui/button";
import { FigureTile, InfoLink, LinkTile } from "@/components/ui/links";
import { COLUMN, FOCUS, PAGE, PageHeader } from "@/components/ui/page";
import { Tag } from "@/components/ui/tag";
import { MidweekMiniCard } from "@/components/midweek/mini-card";
import { ARCHETYPE_LABELS, type Archetype } from "@/game/archetypes";
import { formatChronicleDate, issueStandfirst } from "@/lib/chronicle";
import { InjuryCheckInCard } from "./injury/check-in-card";

type TopRiser = {
  id: string;
  slug: string;
  display_name: string;
  archetype: string;
  live_ovr: number;
  pac: number;
  sho: number;
  pas: number;
  dri: number;
  def: number;
  phy: number;
  rarity_tier: LiveCardPlayer["rarityTier"];
  photo_path: string | null;
  ovr_delta: number;
};

export default async function Home() {
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  if (claimsError || typeof userId !== "string") {
    redirect("/login");
  }

  // Midweek Madness has no scheduler: a Home visit locks, completes or opens a
  // week that is due, before this page reads it (ADR-098).
  await runDueMidweek();

  const [
    { data: profile, error: profileError },
    risersResponse,
    walletResponse,
    clubValueResponse,
    rankResponse,
    activityResponse,
    reportResponse,
    injuryResponse,
    chronicleResponse,
    packResponse,
  ] = await Promise.all([
    supabase.schema("kut").from("profiles").select("is_disabled").eq("id", userId).maybeSingle(),
    supabase
      .schema("kut")
      .from("top_risers")
      .select(
        "id, slug, display_name, archetype, live_ovr, pac, sho, pas, dri, def, phy, rarity_tier, photo_path, ovr_delta",
      )
      .limit(5),
    supabase.schema("kut").from("wallets").select("balance").eq("user_id", userId).maybeSingle(),
    supabase.schema("kut").from("my_club_value").select("club_value").maybeSingle(),
    supabase
      .schema("kut")
      .from("club_value_leaderboard")
      .select("rank")
      .eq("is_current_user", true)
      .maybeSingle(),
    supabase
      .schema("kut")
      .from("activity_feed")
      // "*": #223 appended pack_slug and pack_title; views only gain columns.
      .select("*")
      .gte("ts", ACTIVITY_FLOOR_ISO)
      .order("ts", { ascending: false })
      // Enough to fill six rows once a member's run of pack openings folds into one.
      .limit(30),
    supabase
      .schema("kut")
      .from("my_session_reports")
      .select("session_id, session_date, report_status, reward_received, closes_at")
      .eq("survey_status", "open")
      .order("closes_at")
      .limit(1)
      .maybeSingle(),
    supabase.schema("kut").rpc("my_injury_status"),
    supabase
      .schema("kut")
      .from("chronicle_weeks")
      .select("week_start, session_count, appearance_count, goal_count")
      .order("week_start", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.schema("kut").from("active_pack_offers").select("title, price").order("price"),
  ]);

  if (profileError) {
    throw new Error("Could not verify your FLUT membership.");
  }
  if (!profile || profile.is_disabled) {
    redirect("/login");
  }
  if (risersResponse.error) {
    throw new Error("Could not load this week's movers.");
  }
  if (reportResponse.error) {
    throw new Error("Could not load your open session report.");
  }

  const risers = (risersResponse.data ?? []) as TopRiser[];
  const [photoUrls, injuredPlayerIds] = await Promise.all([
    resolvePhotoUrls(
      supabase,
      risers.map((player) => player.photo_path),
    ),
    fetchInjuredPlayerIds(supabase),
  ]);
  // Midweek Madness: picking, the evening, or the champion until Thursday
  // (ADR-097, ADR-098). Tolerant: null whenever it is disabled, opted out or not
  // deployed, and then nothing shows.
  const now = new Date();
  const midweek = await loadMidweekEntryPoint(supabase, injuredPlayerIds, now, userId);
  // A failed read is not a zero balance (KB-014): both stats degrade to "we
  // don't know" rather than asserting a figure the member never had. The
  // `?? balance` on Club Value stays — a member with no cards has no
  // my_club_value row, and their club really is worth just their coins.
  if (walletResponse.error) console.error("home wallet read failed", walletResponse.error);
  if (clubValueResponse.error)
    console.error("home club value read failed", clubValueResponse.error);
  const balance = walletResponse.error ? null : (walletResponse.data?.balance ?? 0);
  const clubValue = clubValueResponse.error
    ? null
    : (clubValueResponse.data?.club_value ?? balance);
  const rank = rankResponse.data?.rank ?? null;
  // The activity feed is a non-critical widget — never fail the Home page over it.
  // Six rows, with a member's consecutive pack openings folded into one (ADR-114).
  const activity = foldActivity((activityResponse.data ?? []) as ActivityRow[], 6);
  const openReport = reportResponse.data;
  // Injury mode (ADR-082) is non-critical here too: a failed read hides the
  // check-in card rather than failing Home.
  if (injuryResponse.error) console.error("home injury status read failed", injuryResponse.error);
  const injury = (injuryResponse.error ? null : injuryResponse.data) as InjuryStatus | null;

  const nowCards: NowCard<{ block: ReactNode; tile: ReactNode; due: boolean }>[] = [];
  if (midweek) {
    const due =
      midweek.kind === "pick"
        ? midweek.saved.length === 0
        : midweek.kind === "live" && midweek.match?.live != null && midweek.match.youSide !== null;
    nowCards.push({
      key: "midweek",
      leads: midweek.kind === "live",
      deadline:
        midweek.kind === "pick"
          ? Date.parse(midweek.lockAt)
          : midweek.kind === "final"
            ? championLeadsUntil(midweek.lockAt).getTime()
            : null,
      value: {
        due,
        block:
          midweek.kind === "pick" ? (
            <MidweekEntryCard
              lockAt={midweek.lockAt}
              now={now.toISOString()}
              saved={midweek.saved}
            />
          ) : midweek.kind === "live" ? (
            <MidweekLiveCard
              button={midweek.button}
              line={midweek.line}
              match={midweek.match}
              title={midweek.title}
            />
          ) : (
            <MidweekFinalCard line={midweek.line} title={midweek.title} />
          ),
        tile: (
          <LinkTile
            href={midweek.kind === "pick" ? "/midweek/pick" : "/midweek"}
            title="Midweek Madness"
            tone={due ? "now" : "plain"}
            state={
              midweek.kind === "pick"
                ? `${midweek.saved.length ? "Your five is saved" : "Not picked"} · locks ${formatShortLock(midweek.lockAt)}`
                : midweek.title
            }
          />
        ),
      },
    });
  }
  if (openReport) {
    const title =
      openReport.report_status === "submitted"
        ? "View your report"
        : `Add ${countNoun(openReport.session_date)} & kudos`;
    const line = `+50 coins · ${formatWeekday(openReport.session_date)}${openReport.closes_at ? ` · closes ${formatShortLock(openReport.closes_at)}` : ""}`;
    const href = `/sessions/${openReport.session_id}/report`;
    const due = openReport.report_status !== "submitted";
    nowCards.push({
      key: "report",
      deadline: openReport.closes_at ? Date.parse(openReport.closes_at) : null,
      value: {
        due,
        block: (
          <Block title="Your report" tone={due ? "now" : "plain"}>
            <p className="text-small text-ink-dim">{line}</p>
            <Button href={href} kind={due ? "primary" : "secondary"} wide>
              {title}
            </Button>
          </Block>
        ),
        tile: (
          <LinkTile href={href} title="Your report" tone={due ? "now" : "plain"} state={line} />
        ),
      },
    });
  }
  if (injury?.injured && injury.checkable_week_start) {
    nowCards.push({
      key: "check-in",
      deadline: checkInClosesAt(injury.checkable_week_start),
      value: {
        due: true,
        block: (
          <InjuryCheckInCard
            stipend={injury.stipend}
            weekLabel={formatDate(injury.checkable_week_start)}
            weekStart={injury.checkable_week_start}
          />
        ),
        tile: (
          <LinkTile
            href="/injury"
            title="Rehab check-in"
            tone="now"
            state={`+${injury.stipend} coins · week of ${formatDate(injury.checkable_week_start)}`}
          />
        ),
      },
    });
  }
  const ordered = orderNowCards(nowCards);
  const lead = ordered.find((card) => card.value.due) ?? ordered[0];
  const somethingDue = ordered.some((card) => card.value.due);
  const latest = chronicleResponse.error ? null : chronicleResponse.data;
  // Packs are a category: one offer is named with its price, several say where
  // they start. A failed read invents nothing.
  const offers = packResponse.error ? [] : (packResponse.data ?? []);
  const packState =
    offers.length === 0
      ? "See the packs"
      : offers.length === 1
        ? `${offers[0].title} · ${offers[0].price} coins`
        : `${offers.length} packs from ${offers[0].price} coins`;

  return (
    <main className={PAGE}>
      <div className={`${COLUMN} lg:max-w-5xl`}>
        <PageHeader
          title="This week in FLUT"
          sub={new Intl.DateTimeFormat("en-GB", {
            weekday: "short",
            day: "numeric",
            month: "short",
            timeZone: "Europe/Amsterdam",
          }).format(now)}
        />
        <div
          className={`grid gap-6 lg:items-start lg:gap-8 ${lead ? "lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]" : ""}`}
        >
          {lead && (
            <section aria-label="Now" className="grid">
              {lead.value.block}
            </section>
          )}
          <div className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2">
            <FigureTile
              href="/club/value"
              label="Club Value"
              value={clubValue === null ? "—" : Number(clubValue).toLocaleString()}
            />
            <FigureTile href="/leaderboard" label="Rank" value={rank === null ? "—" : `#${rank}`} />
            {somethingDue ? (
              <LinkTile href="/club/packs" title="Open a pack" state={packState} />
            ) : (
              <div className="min-[360px]:col-span-2">
                <Button href="/club/packs" wide>
                  Open a pack
                </Button>
              </div>
            )}
            {ordered
              .filter((card) => card !== lead)
              .map((card) => (
                <div className="grid" key={card.key}>
                  {card.value.tile}
                </div>
              ))}
          </div>
        </div>
        {injury?.injured && !injury.checkable_week_start && (
          <p className="rounded-2xl border border-line/60 bg-panel/60 p-4 text-small text-ink-dim">
            <span className="font-semibold text-ink">Injury mode.</span>{" "}
            {injury.checked_in_this_week
              ? "Your card is protected this week. ✓"
              : "Your next rehab check-in opens once this week's session is published."}{" "}
            {injury.protected_weeks > 0 &&
              `${injury.protected_weeks} ${injury.protected_weeks === 1 ? "week" : "weeks"} protected so far.`}
          </p>
        )}
        <Block title="Top risers" aside={<InfoLink href="/players">Players</InfoLink>}>
          {risers.length === 0 ? (
            <p className="text-small text-ink-dim">
              Movers appear once a second football week has been published. Meanwhile, browse every
              card in the{" "}
              <Link
                prefetch={false}
                className="font-semibold text-brass hover:underline"
                href="/players"
              >
                player directory
              </Link>
              .
            </p>
          ) : (
            <>
              <ul className="grid lg:hidden">
                {risers.map((player) => (
                  <li className="border-b border-line/40 last:border-b-0" key={player.id}>
                    <Link
                      prefetch={false}
                      href={`/players/${player.slug}`}
                      className={`grid min-h-14 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-md py-2 hover:text-brass ${FOCUS}`}
                    >
                      <MidweekMiniCard
                        small
                        rarityTier={player.rarity_tier}
                        ovr={player.live_ovr}
                        injured={injuredPlayerIds.has(player.id)}
                      />
                      <span className="grid min-w-0">
                        <span className="truncate text-body font-semibold">
                          {player.display_name}
                        </span>
                        <span className="truncate text-small text-ink-dim">
                          {ARCHETYPE_LABELS[player.archetype as Archetype]} · OVR {player.live_ovr}
                        </span>
                      </span>
                      <Tag tone="won">▲ +{player.ovr_delta}</Tag>
                    </Link>
                  </li>
                ))}
              </ul>
              <div className="hidden grid-cols-5 gap-4 lg:grid">
                {risers.map((player) => (
                  <Link
                    prefetch={false}
                    aria-label={`Open ${player.display_name}'s profile`}
                    className={`rounded-[0.9rem] ${FOCUS}`}
                    href={`/players/${player.slug}`}
                    key={player.id}
                  >
                    <LiveCard
                      player={toLiveCardPlayer(player, injuredPlayerIds, photoUrls)}
                      trend={player.ovr_delta}
                    />
                  </Link>
                ))}
              </div>
            </>
          )}
        </Block>
        <LinkTile
          href="/chronicle"
          icon={<IconChronicle className="h-4 w-4" />}
          title="This week's Chronicle"
          state={
            latest
              ? `Week of ${formatChronicleDate(latest.week_start)} · ${issueStandfirst(latest.session_count, latest.appearance_count, latest.goal_count, latest.week_start)}`
              : chronicleResponse.error
                ? "Read the Chronicle"
                : "The first issue arrives when a session is published."
          }
        />
        <Block title="Club activity">
          {activity.length === 0 ? (
            <p className="text-small text-ink-dim">
              Recent sales, listings, pack openings, and published sessions will show up here.
            </p>
          ) : (
            <ol className="grid">
              {activity.map((row, index) => (
                <li
                  className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 border-b border-line/40 py-2.5 last:border-b-0"
                  key={`${row.kind}-${row.ts}-${index}`}
                >
                  <span className="text-body text-pretty">
                    {row.kind === "session" ? (
                      <Link href="/chronicle" className="hover:text-brass hover:underline">
                        {describeFoldedActivity(row)}
                      </Link>
                    ) : (
                      describeFoldedActivity(row)
                    )}
                  </span>
                  <time className="text-small tabular-nums text-ink-faint" dateTime={row.ts}>
                    {formatDate(row.ts)}
                  </time>
                </li>
              ))}
            </ol>
          )}
        </Block>
      </div>
    </main>
  );
}
