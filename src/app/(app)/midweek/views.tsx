import type { ReactNode } from "react";
import { CompeteTabs } from "@/components/app-shell/compete-tabs";
import {
  ChampionBlock,
  HubGrid,
  NowDraw,
  NowMatch,
  NowNext,
  NowNote,
  NowOut,
  NowPlayed,
  NowResult,
  type HubTile,
  type Mini,
} from "@/components/midweek/hub";
import { MidweekLivePoller } from "@/components/midweek/live-poller";
import { MidweekScoreboard } from "@/components/midweek/report";
import { Button } from "@/components/ui/button";
import { COLUMN, PAGE, PageHeader } from "@/components/ui/page";
import { MIDWEEK } from "@/game/midweek/config";
import { predictionCoins } from "@/game/midweek/rewards";
import { roundStartAt } from "@/game/midweek/schedule";
import { callCards, callsRight, type CallCard } from "@/lib/midweek/calls";
import {
  championClub,
  formatClock,
  formatDayDate,
  lastWeekTileState,
  scheduleVersionOf,
  skipOrVoidNotice,
  stageName,
  type MidweekCurrent,
  type MidweekTournament,
} from "@/lib/midweek/entry";
import {
  assembleBracket,
  eveningPhase,
  finalLine,
  finishStat,
  firstMatch,
  fiveOf,
  liveLine,
  myNight,
  roundName,
  settledWinner,
  sideScore,
  type BracketRound,
  type MyNight,
} from "@/lib/midweek/evening";
import { loadLiveMatch } from "@/lib/midweek/live-load";
import { nextPairing, preMatchHref } from "@/lib/midweek/prematch";
import {
  loadCalls,
  loadLiveRowEvents,
  loadMyRewards,
  loadWeekResults,
} from "@/lib/midweek/results";
import { sideClub, type MatchRow } from "@/lib/midweek/rows";
import type { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/** "The draw is out" → "the draw is out", for the Small line under the title. */
const lowerFirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);

export const PAST_TILE: HubTile = {
  title: "Past weeks",
  state: "Every week’s result",
  href: "/midweek/past",
};
export const HOW_TILE: HubTile = {
  title: "How it works",
  state: "Plusses, Power, ratings",
  href: "/how-it-works#midweek",
};

/**
 * `/midweek` (DR5-12, ADR-154): Compete's tabs, the Title and a Small line,
 * then the Now block and the tiles. `foot` carries the live poller's
 * `Updated` line during the evening.
 */
export function HubFrame({
  title,
  sub,
  now,
  tiles,
  foot = null,
}: {
  title: string;
  sub: string;
  now: ReactNode;
  tiles: readonly HubTile[];
  foot?: ReactNode;
}) {
  return (
    <main className={PAGE}>
      <div className={`${COLUMN} lg:max-w-5xl`}>
        <CompeteTabs />
        <PageHeader sub={sub} title={title} />
        <HubGrid now={now} tiles={tiles} />
        {foot}
      </div>
    </main>
  );
}

// ---- before the lock -------------------------------------------------------------

/**
 * The Last week tile before the lock: how far the member got and their coins,
 * opening that week; or why nothing was played (Week-Skipped, Week-Void).
 */
export async function lastWeekTile(
  supabase: SupabaseServerClient,
  userId: string,
  tournament: MidweekTournament,
): Promise<HubTile | null> {
  const href = `/midweek/${tournament.week_start}`;
  const notice = skipOrVoidNotice(tournament, MIDWEEK.minEntrants);
  if (notice) {
    return {
      title: "Last week",
      state: tournament.status === "void" ? "Called off" : "Not played",
      href,
    };
  }
  if (tournament.status !== "complete" || !tournament.rounds) return null;
  const [rewardsResponse, entryResponse] = await Promise.all([
    supabase
      .schema("kut")
      .from("my_midweek_rewards")
      .select("*")
      .eq("tournament_id", tournament.tournament_id),
    supabase
      .schema("kut")
      .from("midweek_entries_public")
      .select("user_id")
      .eq("tournament_id", tournament.tournament_id)
      .eq("user_id", userId)
      .limit(1),
  ]);
  if (rewardsResponse.error || entryResponse.error) return null;
  return {
    title: "Last week",
    state: lastWeekTileState({
      rounds: tournament.rounds,
      rewards: rewardsResponse.data ?? [],
      entered: (entryResponse.data ?? []).length > 0,
      isChampion: tournament.champion_user_id === userId,
    }),
    href,
  };
}

// ---- Wednesday evening ---------------------------------------------------------

/** The Bracket tile: the round in play with how many matches are live, the next kick-off, or the winner. */
function bracketTile(bracket: readonly BracketRound[], now: Date, base: string): HubTile {
  const live = bracket.find((round) => round.pairs.some((pair) => pair.kind === "inplay"));
  if (live) {
    const count = live.pairs.filter((pair) => pair.kind === "inplay").length;
    return {
      title: "Bracket",
      state: `${live.name} · ${count} live`,
      href: `${base}/bracket`,
      tone: "live",
    };
  }
  const next = bracket.find((round) => Date.parse(round.kickoffAt) > now.getTime());
  return {
    title: "Bracket",
    state: next ? `${next.name} at ${formatClock(next.kickoffAt)}` : "Every round played",
    href: `${base}/bracket`,
  };
}

/** The Your night tile: when it starts, the round you're playing, or your coins so far. */
function nightTile(night: MyNight, bracket: readonly BracketRound[], base: string): HubTile {
  const rounds = bracket.length;
  const last = night.rows.filter((row) => row.kind !== "next").at(-1);
  const next = night.rows.find((row) => row.kind === "next");
  const state = !last
    ? `Starts ${formatClock(bracket[0].kickoffAt)}`
    : last.kind === "live"
      ? `${roundName(last.round, rounds)} now · win +${last.coins}`
      : next
        ? `Through · +${night.coins} so far`
        : `+${night.coins} so far`;
  return { title: "Your night", state, href: `${base}/night` };
}

/** The Calls tile, once you're out: how many are open, or how many came true. */
function callsTile(cards: readonly CallCard[], base: string): HubTile {
  const open = cards.filter((card) => card.state === "open").length;
  const right = callsRight(cards);
  return {
    title: "Calls",
    state: open > 0 ? `${open} open` : right > 0 ? `${right} right so far` : "Nothing open",
    href: `${base}/calls`,
    tone: open > 0 ? "now" : "plain",
  };
}

/**
 * The hub from the lock to the end of the final (DR5-12; MM 2.0 F5 and F6,
 * ADR-113, ADR-115). The Now block is the one thing that needs you:
 *
 * - `draw` (lock to round 1): your first match, each five as mini cards;
 * - your match in play, or the final for everyone: its scoreboard and Watch it;
 * - between rounds while you're in: your next match and its pre-match once
 *   both its feeders have ended (DR4-7, ADR-149);
 * - out: where it ended, and Make your calls while one is open (ADR-118).
 *
 * The tiles keep their places: your night (Calls once you're out), the
 * bracket, your five and past weeks. Every page behind them reads what the
 * evening page read, at the same moments. While a match is in play the hub
 * asks for itself again every 20 seconds, otherwise once at the next kick-off
 * (`MidweekLivePoller`). The sticky evening clock is retired (Q3).
 */
export async function EveningHub({
  supabase,
  current,
  now,
  userId,
}: {
  supabase: SupabaseServerClient;
  current: MidweekCurrent;
  now: Date;
  userId: string;
}) {
  const lockAt = current.lock_at as string;
  const weekStart = current.week_start as string;
  const base = `/midweek/${weekStart}`;
  const date = formatDayDate(lockAt);
  const nowIso = now.toISOString();
  const scheduleVersion = scheduleVersionOf(current);
  const yourFive: HubTile = {
    title: "Your five",
    state: `Locked at ${formatClock(lockAt)}`,
    href: "/midweek/pick",
  };
  const rounds = current.status === "simulated" ? current.rounds : null;

  if (!rounds) {
    // The lock has passed but the worker hasn't drawn the week yet: a moment at
    // most, since every Midweek page runs it first (ADR-098).
    const roundOneAt = roundStartAt(new Date(lockAt), 1, scheduleVersion).toISOString();
    const roundOne = formatClock(roundOneAt);
    return (
      <HubFrame
        foot={<MidweekLivePoller at={nowIso} nextAt={roundOneAt} poll={false} />}
        now={
          <NowNote
            aside={<p className="text-small text-ink-dim tabular-nums">Round 1 · {roundOne}</p>}
            title="Squads are locked"
          >
            {current.opted_out
              ? "You opted out, so you aren’t in tonight."
              : "The draw comes out in a moment."}
          </NowNote>
        }
        sub={`${date} · squads are locked`}
        tiles={[
          { title: "Bracket", state: `Drawn at ${formatClock(lockAt)}` },
          ...(current.opted_out ? [] : [yourFive]),
          PAST_TILE,
          HOW_TILE,
        ]}
        title="Midweek Madness"
      />
    );
  }

  const results = await loadWeekResults(supabase, current.tournament_id as string, now);
  const night = myNight({ userId, rounds, lockAt, scheduleVersion, matches: results.matches });
  // Before round 1 the night has no rows yet; the draw says whether you're in.
  const entered =
    night.entered ||
    results.draw.some((row) => row.side_0_user_id === userId || row.side_1_user_id === userId);
  const phase = eveningPhase({ rounds, lockAt, scheduleVersion, now, night });
  const autoUserIds = new Set(results.entries.filter((row) => row.auto).map((row) => row.user_id));
  // Every match in play shows its score so far (ADR-148): the Bracket tile counts them.
  const rowEvents = await loadLiveRowEvents(supabase, results.matches);
  const bracket = assembleBracket({
    rounds,
    lockAt,
    scheduleVersion,
    draw: results.draw,
    matches: results.matches,
    autoUserIds,
    live: rowEvents ? { events: rowEvents, now } : undefined,
  });
  const thisRound = phase.round > 0 ? bracket[phase.round - 1] : null;
  const inPlay = thisRound?.pairs.some((pair) => pair.kind === "inplay") ?? false;
  const nextKickoff =
    bracket.find((round) => Date.parse(round.kickoffAt) > now.getTime())?.kickoffAt ?? null;

  // The one match this member watches live: theirs this round, or the final.
  const watched = thisRound?.pairs.find(
    (pair) =>
      pair.kind === "inplay" &&
      (phase.kind === "final" || pair.sides.some((side) => side.userId === userId)),
  );
  // Calls, once the member is out (ADR-118): every later match they are not in.
  const out = night.rows.find((row) => row.kind === "out");
  const calls = out ? await loadCalls(supabase, current.tournament_id as string) : null;
  const cards = calls
    ? callCards({ bracket, night, predictions: calls.predictions, splits: calls.splits, now })
    : null;
  const live =
    watched?.kind === "inplay"
      ? await loadLiveMatch(supabase, {
          tournament: {
            tournament_id: current.tournament_id as string,
            seed_hash: current.seed_hash,
            rounds,
          },
          scheduleVersion,
          match: watched.match,
          now,
        })
      : null;

  const youSide = (match: MatchRow) =>
    match.side_0_user_id === userId ? 0 : match.side_1_user_id === userId ? 1 : null;
  const autoOf = (match: MatchRow) =>
    [autoUserIds.has(match.side_0_user_id), autoUserIds.has(match.side_1_user_id ?? "")] as const;
  const matchBlock = (title: string, match: MatchRow) => (
    <NowMatch
      auto={autoOf(match)}
      clubs={[sideClub(match, 0), sideClub(match, 1)]}
      goals={live?.live.score ?? [0, 0]}
      href={`${base}/match/${match.match_id}`}
      live={{
        minute: live?.live.minute ?? 0,
        penalties: live?.live.penalties ?? null,
        clock: { kickoffAt: match.reveal_at, scheduleVersion, at: nowIso },
      }}
      title={title}
      youSide={youSide(match)}
    />
  );

  let block: ReactNode;
  if (phase.kind === "draw") {
    const first = firstMatch({ userId, draw: results.draw, rounds, lockAt, scheduleVersion });
    const five = (id: string) => {
      const view = fiveOf(results.entries, id);
      if (!view) return [];
      const club = results.entries.find((row) => row.user_id === id)?.club_name;
      return [
        {
          label: id === userId ? "Your five" : (club ?? `${view.manager}’s Club`),
          you: id === userId,
          auto: view.auto,
          cards: view.cards.map((card) => card.mini as Mini),
        },
      ];
    };
    block = first ? (
      <NowDraw
        fives={[...five(userId), ...first.opponentIds.flatMap(five)]}
        sub={`${roundName(first.round, rounds)} · ${formatClock(first.kickoffAt)}`}
        text={first.text}
      />
    ) : (
      <NowNote title="Tonight">
        {current.opted_out
          ? "You opted out, so you aren’t in tonight."
          : `You aren’t in tonight. Round 1 kicks off at ${formatClock(bracket[0].kickoffAt)}.`}
      </NowNote>
    );
  } else if (phase.kind === "final") {
    const pair = bracket[rounds - 1].pairs[0];
    block =
      pair.kind === "inplay" ? (
        matchBlock("The final", pair.match)
      ) : pair.kind === "played" ? (
        <NowPlayed
          board={<FinalScoreboard autoUserIds={autoUserIds} match={pair.match} userId={userId} />}
          href={`${base}/match/${pair.match.match_id}`}
          title="The final"
        />
      ) : (
        <NowNote title="The final">{liveLine(night, rounds, lockAt, scheduleVersion)}</NowNote>
      );
  } else if (watched?.kind === "inplay") {
    block = matchBlock("Your match", watched.match);
  } else if (out?.kind === "out") {
    block = (
      <NowOut
        coins={`+${night.coins} · paid after the final`}
        href={`${base}/calls`}
        line={`Lost to ${out.opponent} ${out.score} in ${stageName(out.round, rounds)}.`}
        open={cards?.filter((card) => card.state === "open").length ?? 0}
      />
    );
  } else {
    const next = night.rows.find((row) => row.kind === "next");
    const pair = next?.kind === "next" ? bracket[next.round - 1]?.pairs[next.pairing] : undefined;
    block =
      next?.kind === "next" && pair ? (
        <NowNext
          clubs={[pair.sides[0].name, pair.sides[1]?.name ?? "To be decided"]}
          kickoffAt={next.revealAt}
          now={nowIso}
          // Its pre-match once both its feeders have ended (DR4-7, ADR-149).
          preMatch={
            nextPairing(bracket, next.round, next.pairing)
              ? preMatchHref(weekStart, next.round, next.pairing)
              : null
          }
          sub={`${roundName(next.round, rounds)} · ${formatClock(next.revealAt)}`}
        />
      ) : (
        <NowNote title={night.entered ? "Your night" : "Tonight"}>
          {night.entered
            ? liveLine(night, rounds, lockAt, scheduleVersion)
            : current.opted_out
              ? "You opted out, so you aren’t in tonight."
              : "You aren’t in tonight. Follow the bracket."}
        </NowNote>
      );
  }

  const tiles: HubTile[] = entered
    ? [
        cards ? callsTile(cards, base) : nightTile(night, bracket, base),
        bracketTile(bracket, now, base),
        yourFive,
        PAST_TILE,
      ]
    : [bracketTile(bracket, now, base), PAST_TILE, HOW_TILE];

  return (
    <HubFrame
      foot={<MidweekLivePoller at={nowIso} nextAt={nextKickoff} poll={inPlay} />}
      now={block}
      sub={`${date} · ${lowerFirst(phase.title)}`}
      tiles={tiles}
      title="Midweek Madness"
    />
  );
}

/** The final at full time, in team colours: a single-match block (DR2-1). */
function FinalScoreboard({
  match,
  userId,
  autoUserIds,
}: {
  match: MatchRow;
  userId: string;
  autoUserIds: ReadonlySet<string>;
}) {
  const a = sideScore(match, 0);
  const b = sideScore(match, 1);
  const side1 = match.side_1_user_id ?? "";
  return (
    <MidweekScoreboard
      auto={[autoUserIds.has(match.side_0_user_id), autoUserIds.has(side1)]}
      clubs={[sideClub(match, 0), sideClub(match, 1)]}
      goals={[a.goals, b.goals]}
      penalties={a.penalties !== null && b.penalties !== null ? [a.penalties, b.penalties] : null}
      winnerSide={settledWinner(match)}
      youSide={match.side_0_user_id === userId ? 0 : side1 === userId ? 1 : null}
    />
  );
}

// ---- Wednesday night and Thursday: the champion (owner decision D4) --------------

/**
 * After the final, until Thursday 23:59 (D4, Q4): the title names the
 * champion; the Now block is the member's night (coins, finish) and next
 * week's picker while it is open; the final and the champion's five as mini
 * cards under it. The ratings, the share images, the calls and the seed are
 * behind the tiles.
 */
export async function ChampionHub({
  supabase,
  tournament,
  next,
  userId,
}: {
  supabase: SupabaseServerClient;
  tournament: MidweekTournament;
  /** Next week's open tournament, when it exists. */
  next: MidweekCurrent | null;
  userId: string;
}) {
  const rounds = tournament.rounds as number;
  const base = `/midweek/${tournament.week_start}`;
  const [results, rewards, calls] = await Promise.all([
    loadWeekResults(supabase, tournament.tournament_id),
    loadMyRewards(supabase, tournament.tournament_id),
    loadCalls(supabase, tournament.tournament_id),
  ]);
  const championId = tournament.champion_user_id ?? null;
  const champion = championId ? fiveOf(results.entries, championId) : null;
  const final = results.matches.find((match) => match.round === rounds && !match.bye);
  const night = myNight({
    userId,
    rounds,
    lockAt: tournament.lock_at,
    scheduleVersion: scheduleVersionOf(tournament),
    matches: results.matches,
  });
  const finish = finishStat(night, rounds);
  const coins = rewards.reduce((sum, row) => sum + Number(row.amount), 0);
  // Calls (ADR-118): counted from the member's own picks, since a member with
  // none right has no reward row; the coins from the row once paid.
  const picks = calls.predictions.length;
  const right = calls.predictions.filter((row) => row.correct === true).length;
  const callCoins = calls.reward ? Number(calls.reward.amount) : right * predictionCoins(rounds);
  const club = championClub(tournament);
  const pickNext =
    next && next.lock_at && next.status === "open"
      ? {
          line: `Next Wednesday is open: ${formatDayDate(next.lock_at)}, locks ${formatClock(next.lock_at)}.`,
          href: "/midweek/pick",
        }
      : null;

  return (
    <HubFrame
      now={
        <>
          {night.entered ? (
            <NowResult
              coins={`+${coins + callCoins}`}
              coinsNote={picks > 0 ? `${coins} for wins, ${callCoins} for calls` : "paid"}
              finish={finish.value}
              finishNote={finish.note}
              next={pickNext}
            />
          ) : (
            <NowNote
              action={
                pickNext && (
                  <Button href={pickNext.href} wide>
                    Pick next week’s five
                  </Button>
                )
              }
              title="Your night"
            >
              You weren&rsquo;t in this one.{pickNext ? ` ${pickNext.line}` : ""}
            </NowNote>
          )}
          {final && (
            <ChampionBlock
              cards={champion?.cards.map((card) => card.mini as Mini) ?? []}
              href={`${base}/match/${final.match_id}`}
              label={`${tournament.champion_name ?? "The champion"}’s five`}
              line={`${club ?? "The champion"}. ${finalLine(final)}`}
            />
          )}
        </>
      }
      sub={`Midweek Madness · ${formatDayDate(tournament.lock_at)}`}
      tiles={[
        {
          title: "Your night",
          state: night.entered ? `+${night.coins} · your ratings` : "You sat it out",
          href: `${base}/night`,
        },
        {
          title: "Bracket",
          state: club ? `Won by ${club}` : "Every round played",
          href: `${base}/bracket`,
        },
        picks > 0
          ? { title: "Calls", state: `${right} of ${picks} right`, href: `${base}/calls` }
          : { title: "Who picked whom", state: "Owners and picks", href: `${base}/picks` },
        PAST_TILE,
      ]}
      title={club ? `${club} are champions` : "Midweek Madness"}
    />
  );
}
