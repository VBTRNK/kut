import { PAGE, COLUMN, PageHeader } from "@/components/ui/page";
import { Block } from "@/components/ui/block";
import { Tag } from "@/components/ui/tag";
import { InfoLink } from "@/components/ui/links";
import { requireUser } from "@/lib/auth/user";
import { CompeteTabs } from "@/components/app-shell/compete-tabs";
import { createClient } from "@/lib/supabase/server";

type LeaderboardClub = {
  rank: number;
  display_name: string;
  club_name: string;
  club_value: number;
  card_count: number;
  unique_player_count: number;
  is_current_user: boolean;
};

// Phone: rank, member/club and value. Counts join from sm (DR5-21).
export const metadata = { title: "Standings" };

const COLUMNS =
  "grid-cols-[2rem_minmax(0,1fr)_auto] sm:grid-cols-[2.5rem_minmax(0,1fr)_7rem_4rem_4rem]";

export default async function LeaderboardPage() {
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("kut")
    .from("club_value_leaderboard")
    .select(
      "rank, display_name, club_name, club_value, card_count, unique_player_count, is_current_user",
    )
    .order("rank")
    .order("display_name");

  if (error) throw new Error("Could not load the club leaderboard.");
  const clubs = (data ?? []) as LeaderboardClub[];

  return (
    <main className={PAGE}>
      <section className={`${COLUMN} lg:max-w-4xl`}>
        {/* Standings, Midweek and the directory are Compete's sections (ADR-107). */}
        <CompeteTabs />
        <PageHeader title="Standings" sub="By Club Value: coins plus what your cards are worth." />

        {clubs.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line bg-panel/60 p-10 text-center text-ink-dim">
            No active clubs are ready for the standings yet.
          </p>
        ) : (
          <Block>
            <div
              className={`grid gap-x-3 border-b border-line/60 pb-2.5 text-label font-semibold text-ink-faint sm:gap-x-4 sm:pb-3 ${COLUMNS}`}
            >
              <span className="text-center">#</span>
              <span>Member and club</span>
              <span className="text-right">Value</span>
              <span className="hidden text-right sm:block">Cards</span>
              <span className="hidden text-right sm:block">Players</span>
            </div>
            <ol>
              {clubs.map((club) => (
                <li
                  className={`grid items-center gap-x-3 border-b border-line/30 py-3 sm:gap-x-4 ${COLUMNS} ${
                    club.is_current_user ? "rounded-lg bg-brass/8" : ""
                  }`}
                  key={`${club.rank}-${club.display_name}`}
                >
                  <span className="text-center text-body font-semibold tabular-nums text-ink-dim">
                    {club.rank}
                  </span>
                  <span className="min-w-0">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="truncate text-body font-semibold">{club.display_name}</span>
                      {club.is_current_user && <Tag tone="you">You</Tag>}
                    </span>
                    <span className="mt-0.5 block truncate text-small text-ink-dim">
                      {club.club_name}
                    </span>
                  </span>
                  <span className="text-right text-body font-semibold tabular-nums">
                    {Number(club.club_value).toLocaleString()}
                  </span>
                  <span className="hidden text-right text-small tabular-nums text-ink-dim sm:block">
                    {club.card_count}
                  </span>
                  <span className="hidden text-right text-small tabular-nums text-ink-dim sm:block">
                    {club.unique_player_count}
                  </span>
                </li>
              ))}
            </ol>
          </Block>
        )}
        <InfoLink href="/club/value">See the maths</InfoLink>
      </section>
    </main>
  );
}
