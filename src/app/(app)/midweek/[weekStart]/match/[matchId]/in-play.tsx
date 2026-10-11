import Link from "next/link";
import { MidweekLiveFeed, MidweekShootoutTally } from "@/components/midweek/feed";
import { MidweekLivePoller } from "@/components/midweek/live-poller";
import { MIDWEEK_PAGE } from "@/components/midweek/page-head";
import { MidweekScoreboard, type Clubs } from "@/components/midweek/report";
import { MidweekWhyList } from "@/components/midweek/why-list";
import { matchPollMs } from "@/lib/midweek/live-clock";
import type { LiveMatch } from "@/lib/midweek/live-load";
import { kickItems } from "@/lib/midweek/report/kicks";

/**
 * A match page while the match is in play (ADR-115, ADR-147): every match is
 * watched live (`Match-Yours-64`, `Match-Other-Pens`, `Match-Final-32`). The
 * scoreboard with the running clock, the shoot-out's tally once it has begun,
 * the feed newest on top (the kicks, then the moments), and the Why without
 * goals and assists. No headline or facts: they would give the result away.
 * Polls every 10 seconds, every 5 once the shoot-out has begun.
 */
export function InPlayMatch({
  back,
  kicker,
  clubs,
  youSide,
  auto,
  live,
  kickoffAt,
  scheduleVersion,
  now,
}: {
  back: { href: string; label: string };
  kicker: string;
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
    <main className={MIDWEEK_PAGE}>
      <article className="mx-auto grid max-w-6xl gap-5 py-4 sm:gap-6 sm:py-8">
        <header className="grid gap-3">
          <Link
            className="justify-self-start text-sm font-bold text-brass hover:underline"
            href={back.href}
          >
            &larr; {back.label}
          </Link>
          <p className="text-[0.7rem] font-extrabold tracking-[0.26em] text-brass uppercase">
            {kicker}
          </p>
          <h1 className="sr-only">
            {clubs[0]} v {clubs[1]}
          </h1>
        </header>
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
        <div className="grid gap-7 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:items-start lg:gap-10">
          <div className="grid min-w-0 content-start gap-6">
            {shootout && (
              <section aria-labelledby="shootout-h" className="grid gap-2.5">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
                  <h2 className="display text-3xl" id="shootout-h">
                    Penalties
                  </h2>
                  <p className="text-[13px] text-ink-faint">
                    {kicks.length} {kicks.length === 1 ? "kick" : "kicks"} so far &middot; one every
                    5 seconds
                  </p>
                </div>
                <MidweekShootoutTally kicks={kicks} live clubs={clubs} />
              </section>
            )}
            <section aria-labelledby="feed-h" className="grid gap-3.5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
                <h2 className="display text-3xl" id="feed-h">
                  How it&rsquo;s going
                </h2>
                <p className="text-[13px] text-ink-faint">Newest first</p>
              </div>
              <MidweekLiveFeed
                kickoffAt={kickoffAt}
                kicks={kicks}
                clubs={clubs}
                shootout={shootout}
                timeline={live?.live.timeline ?? []}
              />
            </section>
          </div>
          {live && (
            <aside className="min-w-0">
              <MidweekWhyList beforeFullTime why={live.why} />
            </aside>
          )}
        </div>
        <div className="flex justify-center">
          <MidweekLivePoller at={now} foot intervalMs={matchPollMs(shootout)} poll />
        </div>
      </article>
    </main>
  );
}
