import { PAGE, COLUMN, PageHeader } from "@/components/ui/page";
import { Block } from "@/components/ui/block";
import { LinkRow } from "@/components/ui/links";
import { LogoutButton } from "@/components/logout-button";
import { MidweekOptOutPanel } from "@/components/midweek/opt-out-panel";
import { requireUser } from "@/lib/auth/user";
import { isAdminRole } from "@/lib/auth/roles";
import {
  isLockedTonight,
  isPickingOpen,
  nextEntryWeekLabel,
  lockClock,
  scheduleVersionOf,
} from "@/lib/midweek/entry";
import { loadMidweekEntryState } from "@/lib/midweek/load";
import { createClient } from "@/lib/supabase/server";
import { ClubNameForm } from "./club-name-form";

export default async function SettingsPage() {
  const user = await requireUser();
  const supabase = await createClient();
  const [{ data: profile }, midweek] = await Promise.all([
    supabase
      .schema("kut")
      .from("profiles")
      .select("username, club_name, display_name, role")
      .eq("id", user.id)
      .maybeSingle(),
    // The opt-out (ADR-091) shows whenever Midweek does (ADR-097).
    loadMidweekEntryState(supabase),
  ]);
  const now = new Date();

  const displayName = profile?.display_name ?? user.displayName;
  const defaultClubName = `${displayName}'s Club`;

  return (
    <main className={PAGE}>
      <section className={COLUMN}>
        <PageHeader
          title="Settings"
          sub={`Signed in as ${displayName}${profile?.username ? ` · ${profile.username}` : ""}`}
        />
        <Block title="Your club">
          <ClubNameForm currentName={profile?.club_name ?? null} defaultName={defaultClubName} />
        </Block>

        {midweek && (
          <MidweekOptOutPanel
            hasSavedSquadThisWeek={
              isPickingOpen(midweek.current, now) && (midweek.squad?.length ?? 0) > 0
            }
            locked={isLockedTonight(midweek.current, now)}
            optedOut={midweek.current.opted_out}
            revealAt={lockClock(scheduleVersionOf(midweek.current))}
            weekLabel={nextEntryWeekLabel(midweek.current, now)}
          />
        )}

        <ul className="rounded-2xl border border-line/60 bg-panel/60 px-4">
          <LinkRow href="/settings/card" title="My card" meta="Photo and archetype" />
          <LinkRow href="/how-it-works" title="How FLUT works" />
          {isAdminRole(profile?.role) && (
            <LinkRow
              href="/admin/attendance"
              title="Admin tools"
              meta="Attendance, reports, roster and economy"
            />
          )}
        </ul>

        <LogoutButton />
      </section>
    </main>
  );
}
