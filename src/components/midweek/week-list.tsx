import { LinkRow } from "@/components/ui/links";
import type { PastWeek } from "@/lib/midweek/evening";

/**
 * `MidweekWeekList` (Weeks-Past, DR5-14): one link row per finished week,
 * newest first, each opening that week's page.
 */
export function MidweekWeekList({ weeks }: { weeks: readonly PastWeek[] }) {
  return (
    <ul aria-label="Past weeks" className="rounded-2xl border border-line/60 bg-panel/60 px-4">
      {weeks.map((week) => (
        <LinkRow
          href={`/midweek/${week.weekStart}`}
          key={week.weekStart}
          meta={week.text}
          title={week.date}
        />
      ))}
    </ul>
  );
}
