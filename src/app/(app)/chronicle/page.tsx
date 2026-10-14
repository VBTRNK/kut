import { PAGE, COLUMN, PageHeader } from "@/components/ui/page";
import { Block } from "@/components/ui/block";
import { Button } from "@/components/ui/button";
import { LinkRow } from "@/components/ui/links";
import { countNoun } from "@/game/reported-count";
import { requireUser } from "@/lib/auth/user";
import { formatChronicleDate, issueStandfirst } from "@/lib/chronicle";
import { createClient } from "@/lib/supabase/server";

type Week = {
  week_start: string;
  week_end: string;
  session_count: number;
  appearance_count: number;
  goal_count: number;
};

export const metadata = { title: "FLUT Chronicle" };

export default async function ChronicleIndexPage() {
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("kut")
    .from("chronicle_weeks")
    .select("week_start, week_end, session_count, appearance_count, goal_count")
    .order("week_start", { ascending: false });
  if (error) throw new Error("Could not load the Chronicle.");
  const weeks = (data ?? []) as Week[];
  const [latest, ...earlier] = weeks;
  return (
    <main className={PAGE}>
      <section className={COLUMN}>
        <PageHeader
          title="FLUT Chronicle"
          sub={`One issue per football week · ${weeks.length} ${weeks.length === 1 ? "issue" : "issues"}`}
          back={{ href: "/", label: "Home" }}
        />
        {latest ? (
          <Block
            title={`Week of ${formatChronicleDate(latest.week_start)}`}
            aside={
              <p className="text-small text-ink-dim">
                {formatChronicleDate(latest.week_start)} –{" "}
                {formatChronicleDate(latest.week_end, {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </p>
            }
          >
            <p className="text-body">
              {issueStandfirst(
                latest.session_count,
                latest.appearance_count,
                latest.goal_count,
                latest.week_start,
              )}
            </p>
            <Button kind="secondary" href={`/chronicle/${latest.week_start}`}>
              Read the issue
            </Button>
          </Block>
        ) : (
          <p className="text-body text-ink-dim">
            The first issue arrives when a session is published.
          </p>
        )}
        {earlier.length > 0 && (
          <Block title="Earlier issues">
            <ul>
              {earlier.map((week) => (
                <LinkRow
                  key={week.week_start}
                  href={`/chronicle/${week.week_start}`}
                  title={`Week of ${formatChronicleDate(week.week_start)}`}
                  meta={`${week.session_count} sessions · ${week.appearance_count} in · ${week.goal_count} ${countNoun(week.week_start)}`}
                />
              ))}
            </ul>
          </Block>
        )}
      </section>
    </main>
  );
}
