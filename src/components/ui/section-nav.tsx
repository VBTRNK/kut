"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CompeteBadgeWords } from "@/components/app-shell/compete-badge";
import {
  activeEntryKey,
  ariaCurrent,
  formatBadgeCount,
  type BadgedRoute,
  type CompeteStatus,
} from "@/lib/nav/routes";
import { FOCUS } from "./page";
import { Tag } from "./tag";

const DOT: Record<CompeteStatus, string> = {
  pick: "bg-brass",
  live: "bg-live motion-safe:animate-pulse",
};

/**
 * A badge tells you about a place you are not at. A count is a word that fits
 * (`Offers 1`). Compete's status is a dot with its words for screen readers:
 * a `Pick` or `Live` chip squeezed "Midweek" to "Mid…" at 320 px.
 */
function TabBadge({ tab }: { tab: BadgedRoute }) {
  if (tab.status)
    return (
      <>
        <span aria-hidden="true" className={`h-2 w-2 flex-none rounded-full ${DOT[tab.status]}`} />
        <CompeteBadgeWords status={tab.status} />
      </>
    );
  const text = formatBadgeCount(tab.badgeCount ?? 0);
  if (!text) return null;
  return (
    <Tag tone="you">
      {text}
      {tab.badgeNoun && <span className="sr-only"> {tab.badgeNoun}</span>}
    </Tag>
  );
}

/**
 * `SectionNav`: views of one section, 2–4 segments, one row per screen:
 * Compete's Midweek · Standings · Players, Market's tabs, Collection's Album ·
 * Manage · Trading (DR5, ADR-153). Links, so every view has its own address.
 *
 * The active tab resolves as `SectionTabs`' did: the longest owned prefix of
 * the pathname wins, so `/market/offers` lights Offers and `/market/<id>` Buy.
 * `active` overrides it for views the pathname can't see (`?view=manage`) and
 * then marks that tab as the page itself. Equal segments across a phone; from
 * `sm` the row stops at 448 px, so it never stretches across a desktop.
 */
export function SectionNav({
  label,
  tabs,
  active,
}: {
  /** The nav's accessible name, e.g. "Compete". */
  label: string;
  tabs: readonly BadgedRoute[];
  active?: string;
}) {
  const pathname = usePathname();
  const resolved = active ?? activeEntryKey(tabs, pathname);
  return (
    <nav
      aria-label={label}
      className="grid auto-cols-fr grid-flow-col gap-1 rounded-xl border border-line/70 bg-board-deep/40 p-1 sm:max-w-md"
    >
      {tabs.map((tab) => {
        const on = tab.key === resolved;
        return (
          <Link
            aria-current={active ? (on ? "page" : undefined) : ariaCurrent(tab, pathname, resolved)}
            className={`flex min-h-11 min-w-0 items-center justify-center gap-1.5 rounded-lg px-2 text-small font-semibold ${
              on ? "bg-brass-bg text-brass" : "text-ink-dim hover:text-ink"
            } ${FOCUS}`}
            href={tab.href}
            key={tab.key}
          >
            <span className="truncate">{tab.label}</span>
            {!on && <TabBadge tab={tab} />}
          </Link>
        );
      })}
    </nav>
  );
}
