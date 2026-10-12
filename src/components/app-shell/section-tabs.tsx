"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { activeEntryKey, ariaCurrent, type RouteEntry } from "@/lib/nav/routes";

/**
 * Admin's eight tabs as a flat wrapping row, where a segmented control would
 * leave each tab about 45 px wide on a phone. Every other section's tabs are
 * `SectionNav` (`@/components/ui/section-nav`, ADR-153), which replaced this
 * component's segmented variant; Admin moves onto the scale in S10.
 *
 * Text-only by design: a client component rendered by server pages, so an
 * `Icon` prop would be a function crossing the RSC boundary.
 *
 * Active resolution goes through `activeEntryKey`, so the longest owned prefix
 * wins.
 */
type SectionTabsProps = {
  /** The `aria-label` on the nav, e.g. "Admin". */
  label: string;
  tabs: readonly RouteEntry[];
};

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass";

export function SectionTabs({ label, tabs }: SectionTabsProps) {
  const pathname = usePathname();
  const resolved = activeEntryKey(tabs, pathname);

  return (
    <nav aria-label={label} className="flex flex-wrap gap-2">
      {tabs.map((tab) => {
        const active = tab.key === resolved;
        return (
          <Link
            aria-current={ariaCurrent(tab, pathname, resolved)}
            className={`inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-bold ${
              active ? "bg-brass/10 text-brass" : "text-ink-faint hover:text-ink"
            } ${focusRing}`}
            href={tab.href}
            key={tab.key}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
