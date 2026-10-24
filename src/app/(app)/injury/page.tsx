import { Block } from "@/components/ui/block";
import { COLUMN, PAGE, PageHeader } from "@/components/ui/page";
import { requireUser } from "@/lib/auth/user";
import { formatDate } from "@/lib/format";
import type { InjuryStatus } from "@/lib/injuries";
import { createClient } from "@/lib/supabase/server";
import { InjuryCheckInCard } from "./check-in-card";

/** Home's secondary rehab tile needs its own destination when another Now card leads. */
export default async function InjuryPage() {
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase.schema("kut").rpc("my_injury_status");
  if (error || !data) throw new Error("Could not load your injury status. Please try again.");
  const injury = data as InjuryStatus;

  return (
    <main className={PAGE}>
      <section className={COLUMN}>
        <PageHeader title="Rehab check-in" back={{ href: "/", label: "Home" }} />
        {injury.injured && injury.checkable_week_start ? (
          <InjuryCheckInCard
            key={injury.checkable_week_start}
            stipend={injury.stipend}
            weekLabel={formatDate(injury.checkable_week_start)}
            weekStart={injury.checkable_week_start}
          />
        ) : (
          <Block title="Injury mode">
            <p className="text-small text-ink-dim">
              {!injury.injured
                ? "Your player is not in injury mode."
                : injury.checked_in_this_week
                  ? "Your card is protected this week. ✓"
                  : "Your next rehab check-in opens once this week's session is published."}
            </p>
          </Block>
        )}
      </section>
    </main>
  );
}
