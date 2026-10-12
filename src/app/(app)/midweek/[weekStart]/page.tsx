import { redirect } from "next/navigation";
import { HubTiles } from "@/components/midweek/hub";
import { MidweekSeed } from "@/components/midweek/seed";
import { COLUMN, PAGE, PageHeader } from "@/components/ui/page";
import { seedHash } from "@/game/midweek/rng";
import { weekResult } from "../views";
import { openWeek } from "./week";

export const metadata = { title: "Midweek Madness week" };

/**
 * `/midweek/[weekStart]`, a week (DR5-11, DR5-14, E2-Week-Past): the hub
 * after its final without the Now. The week's date as the Title, who won it
 * in the Small line, your night (coins and finish), the final in a line with
 * the champion's five, and four tiles: your night (ratings and the share
 * images), the bracket, your calls and who picked whom. The fairness seal
 * folds away at the foot. Past weeks stay readable when Midweek Madness is
 * switched off, as history (ADR-097); a void or skipped week shows only its
 * notice (§44.9). While the week is still being played its page is the hub,
 * so an old link to a week in play lands there.
 */
export default async function MidweekWeekPage({
  params,
}: {
  params: Promise<{ weekStart: string }>;
}) {
  const { weekStart } = await params;
  const week = await openWeek(weekStart, null);
  if (week.blocked) return week.blocked;
  const { supabase, tournament, userId, date } = week;
  if (tournament.status !== "complete") redirect("/midweek");

  const { club, blocks, tiles } = await weekResult({ supabase, tournament, next: null, userId });
  const seed = tournament.seed ?? null;
  const seal = tournament.seed_hash ?? "";

  return (
    <main className={PAGE}>
      <div className={`${COLUMN} lg:max-w-5xl`}>
        <PageHeader
          back={{ href: "/midweek/past", label: "Past weeks" }}
          sub={club ? `Midweek Madness · ${club} won it` : "Midweek Madness"}
          title={date}
        />
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:items-start lg:gap-8">
          <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-6">{blocks}</div>
          <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3">
            <HubTiles
              tiles={[
                tiles.night,
                tiles.bracket,
                ...(tiles.calls ? [tiles.calls] : []),
                tiles.picks,
              ]}
            />
            {seal && (
              <MidweekSeed
                seed={seed}
                seedHash={seal}
                seedMatches={seed !== null && seedHash(seed) === seal}
              />
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
