import { MidweekWeekList } from "@/components/midweek/week-list";
import { Block } from "@/components/ui/block";
import { COLUMN, PAGE, PageHeader } from "@/components/ui/page";
import { MIDWEEK } from "@/game/midweek/config";
import { requireUser } from "@/lib/auth/user";
import { pastWeeks } from "@/lib/midweek/evening";
import { loadPastWeeks } from "@/lib/midweek/results";
import { runDueMidweek } from "@/lib/midweek/run-due";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Midweek Madness: past weeks" };

/**
 * `/midweek/past` (Weeks-Past, ADR-113, DR5-14): every finished week, newest
 * first, each a link row opening that week's page; a back link, no Compete
 * tabs, as every page behind the hub (DR5-11). Readable with Midweek switched
 * off, like every past week (ADR-097).
 */
export default async function MidweekPastPage() {
  const user = await requireUser();
  await runDueMidweek();
  const supabase = await createClient();
  const data = await loadPastWeeks(supabase);
  const weeks = pastWeeks({ ...data, userId: user.id, minEntrants: MIDWEEK.minEntrants });

  return (
    <main className={PAGE}>
      <div className={COLUMN}>
        <PageHeader
          back={{ href: "/midweek", label: "Midweek" }}
          sub="Midweek Madness"
          title="Past weeks"
        />
        {weeks.length > 0 ? (
          <MidweekWeekList weeks={weeks} />
        ) : (
          <Block>
            <p className="text-body text-ink-dim">No week has been played yet.</p>
          </Block>
        )}
      </div>
    </main>
  );
}
