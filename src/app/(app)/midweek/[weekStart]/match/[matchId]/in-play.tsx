import { MidweekLiveFeed } from "@/components/midweek/feed";
import { MidweekLivePoller } from "@/components/midweek/live-poller";
import {
  MidweekPenalties,
  MidweekScoreboard,
  ReportLayout,
  type Clubs,
  type ReportTab,
} from "@/components/midweek/report";
import { MidweekWhyList } from "@/components/midweek/why-list";
import { matchPollMs } from "@/lib/midweek/live-clock";
import type { LiveMatch } from "@/lib/midweek/live-load";
import { kickItems } from "@/lib/midweek/report/kicks";

/**
 * A match page while the match is in play (ADR-115, ADR-147, DR5-15): every
 * match is watched live. The pairing as the title in plain ink, the
 * scoreboard with the running clock, then Match (the shoot-out's tally once
 * it has begun, the feed newest on top: the kicks, then the moments) and
 * Teams (the Why without goals and assists). No headline or facts: they would
 * give the result away. Polls every 10 seconds, every 5 once the shoot-out
 * has begun; the poll keeps the tab, which is in the address.
 */
export function InPlayMatch({
  back,
  base,
  sub,
  tab,
  clubs,
  youSide,
  auto,
  live,
  kickoffAt,
  scheduleVersion,
  now,
}: {
  back: string;
  base: string;
  sub: string;
  tab: ReportTab;
  clubs: Clubs;
  youSide: 0 | 1 | null;
  auto: readonly [boolean, boolean];
  live: LiveMatch | null;
  kickoffAt: string;
  scheduleVersion: number;
  now: string;
}) {
  const shootout = (live?.live.shootout ?? false) && live?.live.penalties != null;
  const kicks = kickItems(live?.live.kicks ?? []);
  return (
    <ReportLayout
      back={back}
      base={base}
      board={
        <MidweekScoreboard
          auto={auto}
          goals={live?.live.score ?? [0, 0]}
          live={{
            minute: live?.live.minute ?? 0,
            penalties: live?.live.penalties ?? null,
            clock: { kickoffAt, scheduleVersion, at: now },
          }}
          clubs={clubs}
          penalties={null}
          winnerSide={null}
          youSide={youSide}
        />
      }
      foot={<MidweekLivePoller at={now} foot intervalMs={matchPollMs(shootout)} poll />}
      match={
        <>
          {shootout && <MidweekPenalties clubs={clubs} live={kicks} />}
          <MidweekLiveFeed
            kickoffAt={kickoffAt}
            kicks={kicks}
            clubs={clubs}
            shootout={shootout}
            timeline={live?.live.timeline ?? []}
          />
        </>
      }
      sub={sub}
      tab={tab}
      teams={live && <MidweekWhyList why={live.why} />}
      title={`${clubs[0]} v ${clubs[1]}`}
    />
  );
}
