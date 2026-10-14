import Link from "next/link";
import { PageHeader } from "@/components/ui/page";
import { SectionNav } from "@/components/ui/section-nav";
import type { RouteEntry } from "@/lib/nav/routes";

export const VIEW_TABS: RouteEntry[] = [
  { key: "album", href: "/club/collection", label: "Album" },
  { key: "manage", href: "/club/collection?view=manage", label: "Manage" },
  { key: "trading", href: "/club/collection/wanted", label: "Trading" },
];

/** The Collection's completion bar. */
export function Completion({ count, total }: { count: number; total: number }) {
  return (
    <svg
      aria-label={`${count} of ${total} collected`}
      className="h-2 w-full"
      preserveAspectRatio="none"
      viewBox="0 0 100 8"
    >
      <rect className="fill-line/60" height="8" rx="4" width="100" />
      <rect className="fill-brass" height="8" rx="4" width={total ? (count / total) * 100 : 0} />
    </svg>
  );
}

type CollectionHeaderProps = {
  mode: "album" | "manage" | "trading";
  cardCount: number;
  uniquePlayers: number;
  totalPlayers: number;
  /** Null when the figure could not be read — the header simply omits it. */
  clubValue: number | null;
  showArchetypeNudge: boolean;
};

export function CollectionHeader({
  mode,
  cardCount,
  uniquePlayers,
  totalPlayers,
  clubValue,
  showArchetypeNudge,
}: CollectionHeaderProps) {
  return (
    <header className="grid gap-4">
      <PageHeader
        title="Collection"
        sub={
          <>
            {uniquePlayers} of {totalPlayers} Players · {cardCount}{" "}
            {cardCount === 1 ? "card" : "cards"}
            {clubValue !== null && (
              <>
                {" "}
                ·{" "}
                <Link
                  prefetch={false}
                  className="font-semibold text-brass hover:underline"
                  href="/club/value"
                >
                  Club Value {clubValue.toLocaleString()} ›
                </Link>
              </>
            )}
          </>
        }
      />
      <Completion count={uniquePlayers} total={totalPlayers} />
      <div className="grid gap-3">
        <SectionNav active={mode} label="Collection view" tabs={VIEW_TABS} />
        {showArchetypeNudge && (
          <Link
            prefetch={false}
            className="block rounded-xl border border-brass-line bg-brass-bg/40 px-4 py-3 text-small font-semibold text-ink-dim hover:text-brass"
            href="/settings/card"
          >
            Your card is an All-rounder by default &mdash;{" "}
            <span className="text-brass">choose your type &rarr;</span>
          </Link>
        )}
      </div>
    </header>
  );
}
