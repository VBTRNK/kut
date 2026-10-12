import { Block } from "@/components/ui/block";
import { Button } from "@/components/ui/button";
import { Tag } from "@/components/ui/tag";
import { formatClock, formatDayDate, formatWeekday } from "@/lib/midweek/entry";
import type { EntryMini, HomeMatch } from "@/lib/midweek/load";
import { MidweekCountdown } from "./countdown";
import { MiniFive } from "./hub";
import { ReportText } from "./player-name";
import { MidweekScoreboard } from "./report";

/**
 * Home's way into Midweek (DR5-16, ADR-154): one Now-style block with the
 * hub's rules. Brass with a primary button while something is due (not
 * picked; your match live), plain once nothing is. Which moment shows is
 * `loadMidweekEntryPoint`'s call (ADR-114); nothing shows when Midweek is
 * disabled or the member has opted out. Home doesn't poll (Q11), so it is
 * the evening as it stood at page load.
 */

/** Home's other Now cards, until S8 moves Home onto the DR5 blocks. */
export const NOW_CARD = "grid gap-3 rounded-2xl border p-4 sm:px-6 sm:py-5";
export const NOW_BRASS = "border-brass/50 bg-brass-bg/30 hover:border-brass";
export const NOW_KICKER =
  "text-[0.7rem] font-extrabold tracking-[0.26em] text-brass uppercase [overflow-wrap:anywhere]";

/** Before the lock: pick your five, or they're in. */
export function MidweekEntryCard({
  lockAt,
  now,
  saved,
}: {
  lockAt: string;
  now: string;
  saved: EntryMini[];
}) {
  const date = formatDayDate(lockAt);
  if (saved.length === 0) {
    return (
      <Block
        aside={
          <p className="text-small font-semibold text-brass">
            Locks <MidweekCountdown now={now} target={lockAt} />
          </p>
        }
        id="home-midweek-h"
        title="Pick your five"
        tone="now"
      >
        <p className="text-small text-ink-dim">
          Midweek Madness, {date}. Not picked yet, so an auto squad would play.
        </p>
        <Button href="/midweek/pick" wide>
          Pick your five
        </Button>
      </Block>
    );
  }
  return (
    <Block aside={<Tag tone="won">✓ Saved</Tag>} id="home-midweek-h" title="Your five">
      <MiniFive cards={saved} label="Your five" />
      <p className="text-small text-ink-dim">
        Midweek Madness, {date}. Change them until {formatWeekday(lockAt)} {formatClock(lockAt)}.
      </p>
      <Button href="/midweek/pick" kind="secondary">
        Change your five
      </Button>
    </Block>
  );
}

/**
 * From the lock to the end of the final: your match, or the final, as it
 * stood at page load. Brass only while your own match is in play.
 */
export function MidweekLiveCard({
  title,
  line,
  match,
  button,
}: {
  title: string;
  line: string;
  match: HomeMatch | null;
  button: { label: string; href: string };
}) {
  const due = match?.live != null && match.youSide !== null;
  return (
    <Block
      aside={<Tag tone="live">Live</Tag>}
      id="home-midweek-h"
      title={match ? (match.youSide !== null ? "Your match" : "The final") : title}
      tone={due ? "now" : "plain"}
    >
      {match && (
        <MidweekScoreboard
          auto={match.auto}
          clubs={match.clubs}
          compact
          goals={match.goals}
          live={match.live}
          penalties={match.penalties}
          winnerSide={match.winnerSide}
          youSide={match.youSide}
        />
      )}
      <p className="text-small text-ink-dim">
        {match?.live ? (
          "Watch it chance by chance."
        ) : match ? (
          <ReportText parts={match.line} />
        ) : (
          line
        )}
      </p>
      <Button href={button.href} kind={due ? "primary" : "secondary"} wide={due}>
        {button.label}
      </Button>
    </Block>
  );
}

/** After the final, until Thursday 23:59 (owner decision D4): plain, nothing is due. */
export function MidweekFinalCard({ title, line }: { title: string; line: string }) {
  return (
    <Block id="home-midweek-h" title={title}>
      <p className="text-small text-ink-dim">{line}</p>
      <Button href="/midweek" kind="secondary">
        Midweek
      </Button>
    </Block>
  );
}
