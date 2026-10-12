// DR5 round 3 (flut-ui-pass S3), design only: the rest of the app on the DR5
// system. The real app chrome (`Chrome`), the real `LiveCard` face and the
// S2 primitives (`ui.tsx`), plus four new ones proposed for S4: `FigureTile`,
// `Toolbar`, `Field` and `Switch`. Every size is one of the six roles.
import Link from "next/link";
import type { ReactNode } from "react";
import { LiveCard, type LiveCardPlayer } from "@/components/live-card";
import { MidweekMiniCard } from "@/components/midweek/mini-card";
import { IconChronicle } from "@/components/icons";
import { Chrome } from "./pages";
import { Block, Button, COLUMN, Figure, InfoLink, Inset, LinkRow, LinkTile, PAGE, PageHeader, SectionNav, Tag, type NavTab } from "./ui";

type Tier = LiveCardPlayer["rarityTier"];

// ----------------------------------------------------------- new primitives ----

/** `FigureTile`: a place whose state is one number (Club Value, Rank). Label, Figure, Small. */
export function FigureTile({ href, label, value, note }: { href: string; label: string; value: ReactNode; note?: ReactNode }) {
  return (
    <Link className="grid min-w-0 grid-cols-[minmax(0,1fr)] content-start gap-1 rounded-2xl border border-line/60 bg-panel/60 p-4 hover:border-brass-line" href={href}>
      <span className="flex items-baseline justify-between gap-2 text-small text-ink-dim">
        <span className="truncate">{label}</span>
        <span aria-hidden="true" className="text-ink-faint">
          ›
        </span>
      </span>
      <Figure className="truncate">{value}</Figure>
      {note && <span className="text-small text-ink-dim">{note}</span>}
    </Link>
  );
}

/**
 * `Toolbar`: search on the left, one Filter button on the right with the count
 * of filters on, a Small result line under it. Tiers, types, lenses and sort
 * live in the sheet (`FilterSheet`), at every width: one row, never above tabs.
 */
export function Toolbar({ placeholder, value, on = 0, summary }: { placeholder: string; value?: string; on?: number; summary?: ReactNode }) {
  return (
    <div className="grid gap-2">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
        <label className="flex min-h-11 min-w-0 items-center gap-2 rounded-xl border border-line bg-board-deep/60 px-3 text-body">
          <span aria-hidden="true" className="text-ink-faint">
            ⌕
          </span>
          <span className="sr-only">{placeholder}</span>
          <span className={`min-w-0 truncate ${value ? "text-ink" : "text-ink-faint"}`}>{value ?? placeholder}</span>
        </label>
        <button className={`inline-flex min-h-11 items-center gap-2 rounded-xl border px-4 text-small font-semibold ${on ? "border-brass-line bg-brass-bg text-brass" : "border-line bg-panel text-ink"}`} type="button">
          Filter
          {on > 0 && <span className="tabular-nums">· {on}</span>}
        </button>
      </div>
      {summary && <p className="text-small text-ink-dim">{summary}</p>}
    </div>
  );
}

/** A group in the filter sheet: a Small 600 head and one row of choice chips. */
function ChoiceGroup({ label, options, on }: { label: string; options: readonly string[]; on: string }) {
  return (
    <fieldset className="grid gap-2">
      <legend className="pb-2 text-small font-semibold">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <span
            aria-checked={option === on}
            className={`inline-flex min-h-11 items-center rounded-full border px-4 text-small font-semibold ${option === on ? "border-brass-line bg-brass-bg text-brass" : "border-line text-ink-dim"}`}
            key={option}
            role="radio"
          >
            {option}
          </span>
        ))}
      </div>
    </fieldset>
  );
}

/** `Field`: a label (Small 600), the input, a Small help line. */
export function Field({ label, value, placeholder, help, type = "text" }: { label: string; value?: string; placeholder?: string; help?: ReactNode; type?: string }) {
  return (
    <label className="grid gap-2">
      <span className="text-small font-semibold">{label}</span>
      <span className={`flex min-h-12 items-center rounded-xl border border-line bg-board-deep/60 px-4 text-body ${value ? "text-ink" : "text-ink-faint"}`} data-type={type}>
        {type === "password" && value ? "••••••••••" : (value ?? placeholder ?? "")}
      </span>
      {help && <span className="text-small text-ink-dim">{help}</span>}
    </label>
  );
}

/** `Switch`: the one toggle (role switch); its state is also a word beside it. */
export function Switch({ on, label }: { on: boolean; label: string }) {
  return (
    <span aria-checked={on} aria-label={label} className={`relative inline-block h-8 w-[52px] flex-none rounded-full ${on ? "bg-moss" : "bg-line"}`} role="switch">
      <span aria-hidden="true" className={`absolute top-1 h-6 w-6 rounded-full ${on ? "left-6 bg-board-deep" : "left-1 bg-ink-dim"}`} />
    </span>
  );
}

/** Cards in a grid: two on a phone (each about 140 px at 320, the face's floor), then 3, 4 or 5. */
export function CardGrid({ children, wide = 5 }: { children: ReactNode; wide?: 4 | 5 }) {
  return <div className={`grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 ${wide === 5 ? "lg:grid-cols-5" : "lg:grid-cols-4"} lg:gap-6`}>{children}</div>;
}

/** A card with one tag on top (Listed, a price, a pack chip): a Tag, never a tracked capital. */
export function CardWithTag({ player, href, tag, foot, badge }: { player: LiveCardPlayer; href: string; tag?: ReactNode; foot?: ReactNode; badge?: ReactNode }) {
  return (
    <div className="grid min-w-0 content-start gap-2">
      <div className="relative">
        <Link aria-label={`Open ${player.displayName}`} className="block rounded-[0.9rem]" href={href}>
          <LiveCard badge={badge} player={player} />
        </Link>
        {tag && <span className="absolute top-2 left-1/2 z-10 -translate-x-1/2">{tag}</span>}
      </div>
      {foot}
    </div>
  );
}

const TIER_NAME: Record<Tier, string> = { common: "Common", bronze: "Bronze", silver: "Silver", gold: "Gold", holo: "Holo", elite: "Elite" };

// ---------------------------------------------------------------------- home ----

export type HomeProps = {
  sub: string;
  now: ReactNode;
  dueTiles: readonly { title: string; state: string; href: string }[];
  clubValue: string;
  rank: string;
  pack: { state: string; primary: boolean };
  risers: readonly { name: string; meta: string; delta: number; mini: { rarityTier: Tier; ovr: number; injured: boolean }; href: string; player: LiveCardPlayer }[];
  activity: readonly { label: string; text: string; time: string }[];
  chronicle: { title: string; state: string };
  status: "pick" | "live" | null;
};

/**
 * Home (DR5-17): the Title and a Small date, one Now block (the soonest thing
 * due, brass), then tiles: Club Value, Rank, Open a pack (a tile while
 * something is due, DR5-7), and anything else due. Top risers as rows on a
 * phone, five cards from `lg`; the Chronicle a tile of its own; Club
 * activity as plain rows.
 */
export function HomePage(p: HomeProps) {
  return (
    <Chrome status={p.status}>
      <main className={PAGE}>
        <div className={`${COLUMN} lg:max-w-5xl`}>
          <PageHeader sub={p.sub} title="This week in FLUT" />
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:items-start lg:gap-8">
          {p.now}
          {/* Two across from 360 px: below it a Figure (1,389) can't fit half the column. */}
          <div className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2">
            <FigureTile href="/club/value" label="Club Value" value={p.clubValue} />
            <FigureTile href="/leaderboard" label="Rank" value={p.rank} />
            {p.pack.primary ? (
              <div className="min-[360px]:col-span-2">
                <Button href="/club/packs" wide>
                  Open a pack
                </Button>
              </div>
            ) : (
              <LinkTile href="/club/packs" state={p.pack.state} title="Open a pack" />
            )}
            {p.dueTiles.map((tile) => (
              <LinkTile href={tile.href} key={tile.title} state={tile.state} title={tile.title} tone="now" />
            ))}
          </div>
          </div>
          <Block aside={<InfoLink href="/players">Players</InfoLink>} id="risers-h" title="Top risers">
            <ul className="grid lg:hidden">
              {p.risers.map((r) => (
                <li className="border-b border-line/40 last:border-b-0" key={r.name}>
                  <Link className="grid min-h-14 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 py-2 hover:text-brass" href={r.href}>
                    <MidweekMiniCard injured={r.mini.injured} ovr={r.mini.ovr} rarityTier={r.mini.rarityTier} small />
                    <span className="grid min-w-0">
                      <span className="truncate text-body font-semibold">{r.name}</span>
                      <span className="truncate text-small text-ink-dim">{r.meta}</span>
                    </span>
                    <Tag tone="won">▲ +{r.delta}</Tag>
                  </Link>
                </li>
              ))}
            </ul>
            <div className="hidden grid-cols-5 gap-4 lg:grid">
              {p.risers.map((r) => (
                <Link className="block rounded-[0.9rem]" href={r.href} key={r.name}>
                  <LiveCard player={r.player} trend={r.delta} />
                </Link>
              ))}
            </div>
          </Block>
          {/* The Chronicle is its own tile, not a row among the activity (owner, S3). */}
          <LinkTile href="/chronicle" icon={<IconChronicle className="h-4 w-4" />} state={p.chronicle.state} title={p.chronicle.title} />
          <Block id="activity-h" title="Club activity">
            <ol className="grid">
              {p.activity.map((row, i) => (
                <li className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 border-b border-line/40 py-2.5 last:border-b-0" key={i}>
                  <span className="text-body text-pretty">{row.text}</span>
                  <time className="text-small text-ink-faint tabular-nums">{row.time}</time>
                </li>
              ))}
            </ol>
          </Block>
        </div>
      </main>
    </Chrome>
  );
}

/** Home's Now block for a session report (DR5-17): brass only when it is the soonest. */
export function NowReport({ title, line, tone }: { title: string; line: string; tone: "now" | "plain" }) {
  return (
    <Block aside={<p className="text-small font-semibold text-brass">+50</p>} id="now-report" title={title} tone={tone}>
      <p className="text-small text-ink-dim">{line}</p>
      <Button href="/sessions/s-1009/report" kind={tone === "now" ? "primary" : "secondary"} wide={tone === "now"}>
        Add G+A &amp; kudos
      </Button>
    </Block>
  );
}

// --------------------------------------------------------------- collection ----

const COLLECTION_TABS: readonly NavTab[] = [
  { key: "album", label: "Album", href: "/club/collection" },
  { key: "manage", label: "Manage", href: "/club/collection?view=manage" },
  { key: "trading", label: "Trading", href: "/club/collection/wanted" },
];

/** The completion bar (an SVG, CSP-safe as today's). */
function Completion({ count, total }: { count: number; total: number }) {
  return (
    <svg aria-label={`${count} of ${total} collected`} className="h-2 w-full" preserveAspectRatio="none" viewBox="0 0 100 8">
      <rect className="fill-line/60" height="8" rx="4" width="100" />
      <rect className="fill-brass" height="8" rx="4" width={total ? (count / total) * 100 : 0} />
    </svg>
  );
}

/** Collection's header (DR5-18): Title, one Small line with Club Value as its link, the bar, the tabs. */
function CollectionHead({ active, unique, total, cards, clubValue }: { active: string; unique: number; total: number; cards: number; clubValue: string }) {
  return (
    <>
      <div className="grid gap-3">
        <PageHeader
          sub={
            <>
              {unique} of {total} Players · {cards} cards ·{" "}
              <Link className="font-semibold whitespace-nowrap text-brass hover:underline" href="/club/value">
                Club Value {clubValue} ›
              </Link>
            </>
          }
          title="Collection"
        />
        <Completion count={unique} total={total} />
      </div>
      <SectionNav active={active} label="Collection" tabs={COLLECTION_TABS} />
    </>
  );
}

export type AlbumSlotView = { index: number; name: string; href: string; tier: Tier; player: LiveCardPlayer | null; copies: number; listed: boolean };

/** One album slot: the card, or a dashed gap with the Player's name; ×2 and Listed as Tags. */
function Slot({ slot }: { slot: AlbumSlotView }) {
  return (
    <div className="grid min-w-0 content-start gap-1">
      <span className="text-label font-semibold text-ink-faint tabular-nums">{slot.index}</span>
      {slot.player ? (
        <div className="relative">
          <Link aria-label={`${slot.name}, collected`} className="block rounded-[0.9rem]" href={slot.href}>
            <LiveCard player={slot.player} />
          </Link>
          {slot.listed && (
            <span className="absolute top-2 left-1/2 z-10 -translate-x-1/2">
              <Tag tone="you">Listed</Tag>
            </span>
          )}
          {slot.copies > 1 && (
            <span className="absolute right-1 bottom-1 z-10">
              <Tag tone="you">×{slot.copies}</Tag>
            </span>
          )}
        </div>
      ) : (
        <Link aria-label={`${slot.name}, not collected`} className="grid aspect-[5/7] content-end rounded-[0.9rem] border border-dashed border-line bg-board-deep/50 p-3" href={slot.href}>
          <span className="truncate text-small text-ink-faint">{slot.name}</span>
        </Link>
      )}
    </div>
  );
}

/**
 * `/club/collection` (DR5-18): header, Album · Manage · Trading, one toolbar
 * row (the lens chips move into the sheet), then the page: Heading, a Label
 * count, three across from `sm`. A spread of two pages from `lg`.
 */
export function AlbumPage({ unique, total, cards, clubValue, pages, pageCount, lens }: { unique: number; total: number; cards: number; clubValue: string; pages: readonly { number: number; slots: readonly AlbumSlotView[] }[]; pageCount: number; lens: string }) {
  return (
    <Chrome>
      <main className={PAGE}>
        <div className={`${COLUMN} lg:max-w-6xl`}>
          <CollectionHead active="album" cards={cards} clubValue={clubValue} total={total} unique={unique} />
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
            <p className="text-small text-ink-dim">
              {lens} · page {pages[0].number} of {pageCount}
            </p>
            <button className="inline-flex min-h-11 items-center rounded-xl border border-line bg-panel px-4 text-small font-semibold" type="button">
              Filter
            </button>
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            {pages.map((page, i) => (
              <section aria-labelledby={`page-${page.number}`} className={`grid gap-4 rounded-2xl border border-line/60 bg-panel/60 p-4 ${i > 0 ? "hidden lg:grid" : ""}`} key={page.number}>
                <div className="flex items-baseline justify-between gap-3">
                  <h2 className="text-heading font-semibold" id={`page-${page.number}`}>
                    Page {page.number}
                  </h2>
                  <span className="text-small text-ink-dim tabular-nums">
                    {page.slots.filter((s) => s.player).length} of {page.slots.length}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {page.slots.map((slot) => (
                    <Slot key={slot.index} slot={slot} />
                  ))}
                </div>
              </section>
            ))}
          </div>
          {/* Page 1 has no way back; from lg a step is a spread (pages 3–4). */}
          <nav aria-label="Album pages" className="grid grid-cols-2 gap-3">
            {pages[0].number > 1 ? <Button kind="secondary">‹ Page {pages[0].number - 1}</Button> : <span />}
            <Button kind="secondary">
              <span className="lg:hidden">Page {pages[0].number + 1} ›</span>
              <span className="hidden lg:inline">
                Pages {pages[0].number + 2}–{pages[0].number + 3} ›
              </span>
            </Button>
          </nav>
          <InfoLink href="/club/collection?page=all">Show all pages</InfoLink>
        </div>
      </main>
    </Chrome>
  );
}

/** `/club/collection?view=manage`: the same header and tabs, the toolbar, the grid with Listed as a Tag. */
export function ManagePage({ unique, total, cards, clubValue, rows }: { unique: number; total: number; cards: number; clubValue: string; rows: readonly { player: LiveCardPlayer; href: string; listed: string | null }[] }) {
  return (
    <Chrome>
      <main className={PAGE}>
        <div className={`${COLUMN} lg:max-w-6xl`}>
          <CollectionHead active="manage" cards={cards} clubValue={clubValue} total={total} unique={unique} />
          <Toolbar placeholder="Search your cards" summary="Rating, high to low" />
          <CardGrid>
            {rows.map((row) => (
              <CardWithTag href={row.href} key={row.href} player={row.player} tag={row.listed ? <Tag tone="you">Listed · {row.listed}</Tag> : undefined} />
            ))}
          </CardGrid>
        </div>
      </main>
    </Chrome>
  );
}

/** The filter sheet, open (Collection's lenses and Manage's tiers and sort share it). */
export function FilterSheetBoard({ groups, result }: { groups: readonly { label: string; options: readonly string[]; on: string }[]; result: string }) {
  return (
    <Chrome>
      <main className={`${PAGE} relative`}>
        <div className={`${COLUMN} opacity-40`} aria-hidden="true">
          <PageHeader title="Collection" sub="7 of 30 Players · 9 cards" />
          <SectionNav active="album" label="Collection" tabs={COLLECTION_TABS} />
          <div className="h-96 rounded-2xl border border-line/60 bg-panel/60" />
        </div>
        <section aria-label="Filter" aria-modal="true" className="absolute inset-x-0 bottom-0 grid gap-6 rounded-t-3xl border border-line bg-panel p-4 pb-6 sm:mx-auto sm:max-w-md sm:rounded-3xl" role="dialog">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-heading font-semibold">Filter</h2>
            <button className="min-h-11 text-small font-semibold text-brass" type="button">
              Clear
            </button>
          </div>
          {groups.map((g) => (
            <ChoiceGroup key={g.label} label={g.label} on={g.on} options={g.options} />
          ))}
          <Button wide>{result}</Button>
        </section>
      </main>
    </Chrome>
  );
}

export type WantedRow = { name: string; meta: ReactNode; owners: readonly string[] };
export type CopyRow = { name: string; state: string; available: boolean; reason?: string };

/**
 * `/club/collection/wanted` → Trading (DR5-18): the privacy line only, your
 * wanted cards as blocks (where to get each), then your available copies as
 * rows with one button each. Adding a want opens the same sheet pattern.
 */
export function TradingPage({ unique, total, cards, clubValue, wanted, copies, wantCount, availableCount }: { unique: number; total: number; cards: number; clubValue: string; wanted: readonly WantedRow[]; copies: readonly CopyRow[]; wantCount: number; availableCount: number }) {
  return (
    <Chrome>
      <main className={PAGE}>
        <div className={`${COLUMN} lg:max-w-5xl`}>
          <CollectionHead active="trading" cards={cards} clubValue={clubValue} total={total} unique={unique} />
          <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
            <Block aside={<p className="text-small text-ink-dim tabular-nums">{wantCount} of 100</p>} id="wanted-h" title="Wanted">
              <p className="text-small text-ink-dim">Wanted cards stay private.</p>
              <ul className="grid">
                {wanted.map((w) => (
                  <li className="grid gap-1 border-b border-line/40 py-3 last:border-b-0" key={w.name}>
                    <span className="flex items-baseline justify-between gap-3">
                      <span className="text-body font-semibold">{w.name}</span>
                      <button className="min-h-11 text-small font-semibold text-ink-dim" type="button">
                        Remove
                      </button>
                    </span>
                    <span className="text-small text-ink-dim">{w.meta}</span>
                    {w.owners.length > 0 && (
                      <span className="flex flex-wrap gap-1.5">
                        {w.owners.map((o) => (
                          <Tag key={o} tone="won">
                            {o} has one
                          </Tag>
                        ))}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
              <Button kind="secondary">Add a wanted card</Button>
              <InfoLink href="/how-it-works#trading">How trading works</InfoLink>
            </Block>
            <Block aside={<p className="text-small text-ink-dim tabular-nums">{availableCount} of 30</p>} id="copies-h" title="Your copies">
              <ul className="grid">
                {copies.map((c, i) => (
                  <li className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-line/40 py-2.5 last:border-b-0" key={i}>
                    <span className="grid min-w-0">
                      <span className="truncate text-body font-semibold">{c.name}</span>
                      <span className="text-small text-ink-dim">{c.reason ?? c.state}</span>
                    </span>
                    {c.reason ? (
                      <Tag tone="out">{c.state}</Tag>
                    ) : (
                      <button className={`min-h-11 rounded-xl border px-3 text-small font-semibold ${c.available ? "border-line text-ink-dim" : "border-brass-line text-brass"}`} type="button">
                        {c.available ? "Make private" : "Make available"}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </Block>
          </div>
        </div>
      </main>
    </Chrome>
  );
}

/** `/club/collection/[card]` (DR5-18): back, the card, the name as Title, the facts, then List and Discard as blocks. */
export function CardPage({ player, sub, discard, listing, why }: { player: LiveCardPlayer; sub: string; discard: number; listing: string | null; why: readonly { label: string; value: string }[] }) {
  return (
    <Chrome>
      <main className={PAGE}>
        <div className={`${COLUMN} lg:max-w-5xl`}>
          <PageHeader back={{ href: "/club/collection", label: "Collection" }} sub={sub} title={player.displayName} />
          <div className="grid gap-6 md:grid-cols-[minmax(0,18rem)_minmax(0,1fr)] md:items-start">
            <div className="mx-auto w-full max-w-[15rem] md:max-w-none">
              <LiveCard player={player} size="detail" />
            </div>
            <div className="grid min-w-0 gap-6">
              <Block id="why-h" title="Why this rating">
                <dl className="grid grid-cols-3 gap-2">
                  {why.map((w) => (
                    <Inset className="grid gap-1" key={w.label}>
                      <dt className="text-label font-semibold text-ink-faint">{w.label}</dt>
                      <dd className="text-heading font-semibold tabular-nums">{w.value}</dd>
                    </Inset>
                  ))}
                </dl>
                <InfoLink href="/how-it-works#form">How ratings move</InfoLink>
              </Block>
              {listing ? (
                <Block aside={<Tag tone="you">Listed</Tag>} id="list-h" title="On the market">
                  <p className="text-small text-ink-dim">{listing}</p>
                  <Button kind="secondary">Cancel the listing</Button>
                </Block>
              ) : (
                <Block id="list-h" title="List on the market">
                  <Field help="25 to 240 coins. The card is locked while listed." label="Price" placeholder="Price in FLUT Coins" />
                  <Button kind="secondary">List it</Button>
                </Block>
              )}
              <Block aside={<p className="text-small text-ink-dim tabular-nums">{discard} coins</p>} id="discard-h" title="Discard">
                <p className="text-small text-ink-dim">This can’t be undone.</p>
                <Button kind="secondary">Discard for {discard}</Button>
              </Block>
            </div>
          </div>
        </div>
      </main>
    </Chrome>
  );
}

// -------------------------------------------------------------------- packs ----

/** `/club/packs` (DR5-19): no lede (the coin pill has the balance), the pack as a block with its one primary, the ladder as rows. */
export function PacksPage({ pack, balance, ladder }: { pack: { title: string; price: number; cards: number }; balance: number; ladder: readonly { tier: Tier; band: string }[] }) {
  return (
    <Chrome>
      <main className={PAGE}>
        <div className={`${COLUMN} lg:max-w-5xl`}>
          <PageHeader title="Packs" />
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
            <section aria-labelledby="pack-h" className="pack-art grid gap-4 rounded-2xl border border-brass-line bg-[radial-gradient(120%_100%_at_12%_0%,#4a2f08_0%,#1c1509_46%,#100d08_100%)] p-4 sm:p-6">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="text-heading font-semibold" id="pack-h">
                  {pack.title}
                </h2>
              </div>
              <p className="text-small text-ink-dim">{pack.cards} Live Cards. Duplicates can happen.</p>
              <Button wide>Open for {pack.price} coins</Button>
              <p className="text-small text-ink-dim">Leaves you {(balance - pack.price).toLocaleString("en-GB")}.</p>
            </section>
            <Block id="ladder-h" title="The tier ladder">
              <dl className="grid">
                {ladder.map((row) => (
                  <div className="flex min-h-11 items-center gap-3 border-b border-line/40 last:border-b-0" key={row.tier}>
                    <span aria-hidden="true" className="tier-chip" data-rarity={row.tier}>
                      <span className={`live-card__tier-icon--${row.tier}`} />
                    </span>
                    <dt className="grow text-body font-semibold">{TIER_NAME[row.tier]}</dt>
                    <dd className="text-small text-ink-dim tabular-nums">OVR {row.band}</dd>
                  </div>
                ))}
              </dl>
              <InfoLink href="/how-it-works#cards">How tiers work</InfoLink>
            </Block>
          </div>
        </div>
      </main>
    </Chrome>
  );
}

/** The confirm sheet, as today's two-step open, on the scale. */
export function PackConfirmBoard({ pack, balance }: { pack: { title: string; price: number; cards: number }; balance: number }) {
  return (
    <Chrome>
      <main className={`${PAGE} relative`}>
        <div aria-hidden="true" className={`${COLUMN} opacity-40`}>
          <PageHeader title="Packs" />
          <div className="h-80 rounded-2xl border border-brass-line" />
        </div>
        <section aria-labelledby="confirm-h" aria-modal="true" className="absolute inset-x-0 bottom-0 grid gap-4 rounded-t-3xl border border-line bg-panel p-4 pb-6 sm:mx-auto sm:max-w-md sm:rounded-3xl" role="dialog">
          <h2 className="text-heading font-semibold" id="confirm-h">
            Open a {pack.title}?
          </h2>
          <p className="text-body text-ink-dim">
            {pack.price} coins for {pack.cards} Live Cards. You keep {(balance - pack.price).toLocaleString("en-GB")}.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Button kind="secondary">Not now</Button>
            <Button>Pay {pack.price}</Button>
          </div>
        </section>
      </main>
    </Chrome>
  );
}

/** The reveal's summary (DR5-19): the Title, the pack and the summary line in Small, the cards with their chips as Tags. */
export function RevealSummaryPage({ title, line, cards }: { title: string; line: string | null; cards: readonly { player: LiveCardPlayer; chip: { kind: "new" | "copies"; text: string } | null; href: string }[] }) {
  return (
    <Chrome>
      <main className={PAGE}>
        <div className={`${COLUMN} lg:max-w-4xl`}>
          <PageHeader sub={line ? `${title} · ${line}` : title} title="Your new Live Cards" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
            {cards.map((c, i) => (
              <CardWithTag foot={c.chip && <span className="justify-self-center"><Tag tone={c.chip.kind === "new" ? "won" : "neutral"}>{c.chip.text}</Tag></span>} href={c.href} key={i} player={c.player} />
            ))}
          </div>
          <div className="grid gap-3 sm:flex sm:justify-center">
            <Button href="/club/collection">View your Collection</Button>
            <Button href="/club/packs" kind="secondary">
              Open another
            </Button>
          </div>
        </div>
      </main>
    </Chrome>
  );
}

// ------------------------------------------------------------------- market ----

export function marketTabs(offers: number): NavTab[] {
  return [
    { key: "buy", label: "Buy", href: "/market" },
    { key: "selling", label: "Selling", href: "/market/selling" },
    { key: "offers", label: "Offers", href: "/market/offers", badge: offers ? <Tag tone="you">{offers}</Tag> : undefined },
  ];
}

/** `/market` Buy (DR5-20): no lede, the tabs, the toolbar, the grid: price as a Tag on the card, Buy as a secondary button. */
export function MarketBuyPage({ rows, offers }: { rows: readonly { player: LiveCardPlayer; href: string; price: number; seller: string; own: boolean; ownership: ReactNode }[]; offers: number }) {
  return (
    <Chrome>
      <main className={PAGE}>
        <div className={`${COLUMN} lg:max-w-6xl`}>
          <PageHeader title="Market" />
          <SectionNav active="buy" label="Market" tabs={marketTabs(offers)} />
          <Toolbar placeholder="Search Players" summary={`${rows.length} listings · newest first`} />
          <CardGrid wide={4}>
            {rows.map((row) => (
              <CardWithTag
                foot={
                  <>
                    <p className="truncate text-small text-ink-dim">{row.seller}</p>
                    {row.own ? (
                      <p className="grid min-h-12 place-items-center rounded-xl border border-dashed border-line text-small text-ink-dim">Your listing</p>
                    ) : (
                      <Button kind="secondary" wide>
                        Buy for {row.price}
                      </Button>
                    )}
                  </>
                }
                href={row.href}
                key={row.href}
                player={row.player}
                badge={row.ownership}
              />
            ))}
          </CardGrid>
        </div>
      </main>
    </Chrome>
  );
}

/** `/market/[listing]` (DR5-20): back, the card, the name as Title, price as a Figure, Buy pinned on a phone, then the offer as a block. */
export function ListingPage({ player, sub, price, discard, seller, ownership, cards }: { player: LiveCardPlayer; sub: string; price: number; discard: number; seller: string; ownership: string | null; cards: readonly string[] }) {
  return (
    <Chrome>
      <main className={`${PAGE} pb-28 sm:pb-8`}>
        <div className={`${COLUMN} lg:max-w-5xl`}>
          <PageHeader back={{ href: "/market", label: "Market" }} sub={sub} title={player.displayName} />
          <div className="grid gap-6 md:grid-cols-[minmax(0,18rem)_minmax(0,1fr)] md:items-start">
            <div className="mx-auto w-full max-w-[15rem] md:max-w-none">
              <LiveCard player={player} size="detail" />
            </div>
            <div className="grid min-w-0 gap-6">
              <Block id="price-h" title="Buy now">
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <Figure className="text-brass">{price}</Figure>
                  <p className="text-small text-ink-dim">
                    Discard value {discard} · sold by {seller}
                  </p>
                </div>
                {ownership && <p className="text-small text-ink-dim">{ownership}</p>}
                <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom,0px))] z-20 border-t border-line/60 bg-board-deep/95 p-4 sm:static sm:border-0 sm:bg-transparent sm:p-0">
                  <Button wide>Buy for {price} coins</Button>
                </div>
              </Block>
              <Block id="offer-h" title="Or make an offer">
                <Field label="Coins" placeholder={`Up to ${price}`} />
                <div className="grid gap-2">
                  <span className="text-small font-semibold">Add cards</span>
                  <div className="flex flex-wrap gap-2">
                    {cards.map((c) => (
                      <span className="inline-flex min-h-11 items-center rounded-full border border-line px-4 text-small text-ink-dim" key={c}>
                        {c}
                      </span>
                    ))}
                  </div>
                </div>
                <p className="text-small text-ink-dim">Coins and cards are held until the seller answers, or for 12 h.</p>
                <Button kind="secondary">Send offer</Button>
              </Block>
            </div>
          </div>
        </div>
      </main>
    </Chrome>
  );
}

/** `/market/selling` (#237, DR5-9): your listings as rows: mini card, name, time left and offers, the price. */
export function SellingPage({ rows, offers }: { rows: readonly { name: string; meta: string; price: number; href: string; mini: { rarityTier: Tier; ovr: number; injured: boolean } }[]; offers: number }) {
  return (
    <Chrome>
      <main className={PAGE}>
        <div className={`${COLUMN} lg:max-w-3xl`}>
          <PageHeader title="Market" />
          <SectionNav active="selling" label="Market" tabs={marketTabs(offers)} />
          <Block aside={<p className="text-small text-ink-dim">{rows.length} active</p>} id="selling-h" title="Your listings">
            <ul className="grid">
              {rows.map((row) => (
                <li className="border-b border-line/40 last:border-b-0" key={row.href}>
                  <Link className="grid min-h-16 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 py-2 hover:text-brass" href={row.href}>
                    <MidweekMiniCard injured={row.mini.injured} ovr={row.mini.ovr} rarityTier={row.mini.rarityTier} small />
                    <span className="grid min-w-0">
                      <span className="truncate text-body font-semibold">{row.name}</span>
                      <span className="text-small text-ink-dim">{row.meta}</span>
                    </span>
                    <span className="flex items-center gap-2 text-body font-semibold tabular-nums">
                      {row.price}
                      <span aria-hidden="true" className="text-ink-faint">
                        ›
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            <p className="text-small text-ink-dim">List a card from its page in your Collection.</p>
          </Block>
        </div>
      </main>
    </Chrome>
  );
}

export type OfferView = { title: string; meta: string; coins: number; cards: readonly string[]; status: string; tone: "you" | "neutral" | "out"; actions: "respond" | "withdraw" | null };

function OfferBlock({ offer, primary }: { offer: OfferView; primary: boolean }) {
  return (
    <Block aside={<Tag tone={offer.tone}>{offer.status}</Tag>} id={`o-${offer.title}`} title={offer.title} tone={primary ? "now" : "plain"}>
      <p className="text-small text-ink-dim">{offer.meta}</p>
      <p className="text-body">
        <b className="font-semibold tabular-nums">{offer.coins} coins</b>
        {offer.cards.length > 0 && <> + {offer.cards.join(", ")}</>}
      </p>
      {offer.actions === "respond" && (
        <div className="grid grid-cols-2 gap-3">
          <Button kind="secondary">Decline</Button>
          <Button kind={primary ? "primary" : "secondary"}>Accept</Button>
        </div>
      )}
      {offer.actions === "withdraw" && <Button kind="secondary">Withdraw</Button>}
    </Block>
  );
}

/** `/market/offers` (DR5-20): no lede; Incoming (an open one is the screen's brass block) and Sent. */
export function OffersPage({ incoming, sent, offers }: { incoming: readonly OfferView[]; sent: readonly OfferView[]; offers: number }) {
  return (
    <Chrome>
      <main className={PAGE}>
        <div className={`${COLUMN} lg:max-w-3xl`}>
          <PageHeader title="Market" />
          <SectionNav active="offers" label="Market" tabs={marketTabs(offers)} />
          <section className="grid gap-3" aria-labelledby="in-h">
            <h2 className="text-heading font-semibold" id="in-h">
              On your listings
            </h2>
            {incoming.map((o, i) => (
              <OfferBlock key={i} offer={o} primary={i === 0 && o.actions === "respond"} />
            ))}
          </section>
          <section className="grid gap-3" aria-labelledby="sent-h">
            <h2 className="text-heading font-semibold" id="sent-h">
              You sent
            </h2>
            {sent.map((o, i) => (
              <OfferBlock key={i} offer={o} primary={false} />
            ))}
          </section>
        </div>
      </main>
    </Chrome>
  );
}

// ------------------------------------------------------------------ compete ----

/**
 * A section tab's badge where a word won't fit at 320 px: a brass dot with
 * the word for screen readers. The primary tab bar's Compete still says Pick.
 */
function PickDot() {
  return (
    <>
      <span aria-hidden="true" className="h-2 w-2 flex-none rounded-full bg-brass" />
      <span className="sr-only">you haven’t picked your five</span>
    </>
  );
}

function CompeteTabs({ active }: { active: string }) {
  return (
    <div className="lg:max-w-md">
      <SectionNav
        active={active}
        label="Compete"
        tabs={[
          { key: "midweek", label: "Midweek", href: "/midweek", badge: <PickDot /> },
          { key: "standings", label: "Standings", href: "/leaderboard" },
          { key: "players", label: "Players", href: "/players" },
        ]}
      />
    </div>
  );
}

/** `/leaderboard` (DR5-21): the lede goes behind `How Club Value works ›`; one table, your row marked with a Tag. */
export function StandingsPage({ rows }: { rows: readonly { rank: number; name: string; club: string; value: number; cards: number; players: number; you: boolean }[] }) {
  const cols = "grid-cols-[2rem_minmax(0,1fr)_auto] sm:grid-cols-[2.5rem_minmax(0,1fr)_7rem_4rem_4rem]";
  return (
    <Chrome status="pick">
      <main className={PAGE}>
        <div className={`${COLUMN} lg:max-w-4xl`}>
          <CompeteTabs active="standings" />
          <PageHeader sub="By Club Value: coins plus what your cards are worth." title="Standings" />
          <Block id="table-h">
            <div className={`grid gap-x-3 border-b border-line/60 pb-2 text-label font-semibold text-ink-faint ${cols}`}>
              <span className="text-center">#</span>
              <span>Member and club</span>
              <span className="text-right">Value</span>
              <span className="hidden text-right sm:block">Cards</span>
              <span className="hidden text-right sm:block">Players</span>
            </div>
            <ol className="-mt-3">
              {rows.map((r) => (
                <li className={`grid min-h-14 items-center gap-x-3 border-b border-line/40 py-2 last:border-b-0 ${cols} ${r.you ? "-mx-2 rounded-xl bg-brass-bg/50 px-2" : ""}`} key={r.rank}>
                  <span className="text-center text-body font-semibold text-ink-dim tabular-nums">{r.rank}</span>
                  <span className="grid min-w-0">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="truncate text-body font-semibold">{r.name}</span>
                      {r.you && <Tag tone="you">You</Tag>}
                    </span>
                    {/* The counts are columns from sm; on a phone the club alone (Q6). */}
                    <span className="truncate text-small text-ink-dim">{r.club}</span>
                  </span>
                  <span className="text-right text-body font-semibold tabular-nums">{r.value.toLocaleString("en-GB")}</span>
                  <span className="hidden text-right text-small text-ink-dim tabular-nums sm:block">{r.cards}</span>
                  <span className="hidden text-right text-small text-ink-dim tabular-nums sm:block">{r.players}</span>
                </li>
              ))}
            </ol>
          </Block>
          <InfoLink href="/club/value">See the maths</InfoLink>
        </div>
      </main>
    </Chrome>
  );
}

/** `/players` (DR5-21): the tabs, Title with the count, the toolbar, the grid. */
export function PlayersPage({ cards }: { cards: readonly { player: LiveCardPlayer; href: string }[] }) {
  return (
    <Chrome status="pick">
      <main className={PAGE}>
        <div className={`${COLUMN} lg:max-w-6xl`}>
          <CompeteTabs active="players" />
          <PageHeader sub={`${cards.length} Players`} title="Players" />
          <Toolbar placeholder="Search Players" summary="Highest OVR first" />
          <CardGrid>
            {cards.map((c) => (
              <CardWithTag href={c.href} key={c.href} player={c.player} />
            ))}
          </CardGrid>
        </div>
      </main>
    </Chrome>
  );
}

// ---------------------------------------------------------------- chronicle ----

/** `/chronicle` (DR5-22): Title, Small line, the latest issue as the one block with a button, earlier issues as rows. */
export function ChronicleIndexPage({ latest, earlier, count }: { latest: { title: string; dates: string; standfirst: string; href: string }; earlier: readonly { title: string; meta: string; href: string }[]; count: number }) {
  return (
    <Chrome>
      <main className={PAGE}>
        <div className={COLUMN}>
          <PageHeader back={{ href: "/", label: "Home" }} sub={`One issue per football week · ${count} issues`} title="FLUT Chronicle" />
          <Block aside={<p className="text-small text-ink-dim">{latest.dates}</p>} id="latest-h" title={latest.title}>
            <p className="text-body">{latest.standfirst}</p>
            <Button href={latest.href} kind="secondary">
              Read the issue
            </Button>
          </Block>
          <Block id="earlier-h" title="Earlier issues">
            <ul className="-my-2">
              {earlier.map((w) => (
                <LinkRow href={w.href} key={w.href} meta={w.meta} title={w.title} />
              ))}
            </ul>
          </Block>
        </div>
      </main>
    </Chrome>
  );
}

export type SessionView = { id: string; title: string; aside: string; bibs: string | null; reports: string; rows: readonly { name: string; count: string; kudos: string | null; href: string }[] };

/** `/chronicle/[week]` (DR5-22): Title is the week, standfirst as Body, a block per session (rows), Crossings as rows with tier tags. */
export function ChronicleWeekPage({ title, dates, standfirst, sessions, crossings }: { title: string; dates: string; standfirst: string; sessions: readonly SessionView[]; crossings: readonly { name: string; from: string; to: string; ovr: number }[] }) {
  return (
    <Chrome>
      <main className={PAGE}>
        <div className={COLUMN}>
          <PageHeader back={{ href: "/chronicle", label: "All issues" }} sub={dates} title={title} />
          <p className="text-body">{standfirst}</p>
          {sessions.map((s) => (
            <Block aside={<p className="text-small text-ink-dim">{s.aside}</p>} id={`s-${s.id}`} key={s.id} title={s.title}>
              <p className="text-small text-ink-dim">
                {s.reports}
                {s.bibs && <> · bibs by {s.bibs}</>}
              </p>
              <ol className="grid sm:grid-cols-2 sm:gap-x-8">
                {s.rows.map((r) => (
                  <li className="border-b border-line/40" key={r.name}>
                    <Link className="grid min-h-11 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-2 hover:text-brass" href={r.href}>
                      <span className="grid min-w-0">
                        <span className="truncate text-body">{r.name}</span>
                        {r.kudos && <span className="text-small text-ink-dim">{r.kudos}</span>}
                      </span>
                      <span className="text-body font-semibold tabular-nums">{r.count}</span>
                    </Link>
                  </li>
                ))}
              </ol>
            </Block>
          ))}
          <Block id="crossings-h" title="Crossings">
            <ul className="grid">
              {crossings.map((c) => (
                <li className="grid min-h-12 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-line/40 py-2 last:border-b-0" key={c.name}>
                  <span className="truncate text-body font-semibold">{c.name}</span>
                  <span className="flex items-center gap-1.5">
                    <Tag>{c.from}</Tag>
                    <span aria-hidden="true" className="text-ink-faint">
                      →
                    </span>
                    <Tag tone="won">{c.to}</Tag>
                    <span className="ml-1 text-body font-semibold tabular-nums">{c.ovr}</span>
                  </span>
                </li>
              ))}
            </ul>
          </Block>
        </div>
      </main>
    </Chrome>
  );
}

// ----------------------------------------------------------------- messages ----

export type MessageView = { title: string; body: string; time: string; unread: boolean; href: string | null };

/**
 * `/messages` (DR5-23): Title, a Small count with Mark all read, groups with a
 * Label head, one link per row: title (Body 600), body (Small), time and New.
 * The kicker and the inline `Bracket →` go; the row is the link (C).
 */
export function MessagesPage({ unread, groups }: { unread: number; groups: readonly { heading: string; rows: readonly MessageView[] }[] }) {
  return (
    <Chrome>
      <main className={PAGE}>
        <div className={COLUMN}>
          <PageHeader title="Messages" />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-small text-ink-dim">{unread} new</p>
            <Button kind="secondary">Mark all read</Button>
          </div>
          {groups.map((g) => (
            <section aria-labelledby={`g-${g.heading}`} className="grid gap-2" key={g.heading}>
              <h2 className="text-label font-semibold text-ink-faint" id={`g-${g.heading}`}>
                {g.heading}
              </h2>
              <ol className="grid rounded-2xl border border-line/60 bg-panel/60 px-4">
                {g.rows.map((m, i) => {
                  const body = (
                    <>
                      <span className="grid min-w-0 gap-0.5">
                        <span className="flex min-w-0 items-center gap-2">
                          <span className={`truncate text-body ${m.unread ? "font-semibold" : ""}`}>{m.title}</span>
                        </span>
                        <span className="text-small text-ink-dim [overflow-wrap:anywhere]">{m.body}</span>
                      </span>
                      <span className="grid justify-items-end gap-1 text-small text-ink-faint tabular-nums">
                        <time>{m.time}</time>
                        {m.unread ? <Tag tone="you">New</Tag> : m.href ? <span aria-hidden="true">›</span> : null}
                      </span>
                    </>
                  );
                  const row = "grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 py-3";
                  return (
                    <li className="border-b border-line/40 last:border-b-0" key={i}>
                      {m.href || m.unread ? (
                        <a className={`${row} hover:text-brass`} href="#">
                          {body}
                        </a>
                      ) : (
                        <div className={row}>{body}</div>
                      )}
                    </li>
                  );
                })}
              </ol>
            </section>
          ))}
        </div>
      </main>
    </Chrome>
  );
}

// ------------------------------------------------------------------ account ----

/** `/settings` (DR5-24): who you are in the Small line, blocks for Club name and Midweek, rows for the rest. */
export function SettingsPage({ name, username, club, round1 }: { name: string; username: string; club: string; round1: string }) {
  return (
    <Chrome>
      <main className={PAGE}>
        <div className={COLUMN}>
          <PageHeader sub={`Signed in as ${name} · ${username}`} title="Settings" />
          <Block id="club-h" title="Your club">
            <Field help={`Shown in the standings and on Midweek. Leave it blank for ${club}.`} label="Club name" placeholder={club} />
            <Button kind="secondary">Save club name</Button>
          </Block>
          <Block aside={<Switch label="Take part in Midweek Madness" on />} id="mm-h" title="Midweek Madness">
            <p className="flex items-center gap-2">
              <Tag tone="won">Taking part</Tag>
            </p>
            <ul className="grid list-disc gap-1 pl-5 text-small text-ink-dim marker:text-ink-faint">
              <li>Members see the five you enter, or your auto squad, from {round1} on Wednesday.</li>
              <li>The rest of your collection is never shown.</li>
              <li>Opting out takes you out completely.</li>
            </ul>
          </Block>
          <ul className="rounded-2xl border border-line/60 bg-panel/60 px-4">
            <LinkRow href="/settings/card" meta="Photo and archetype" title="My card" />
            <LinkRow href="/how-it-works" title="How FLUT works" />
          </ul>
          <Button kind="secondary">Sign out</Button>
        </div>
      </main>
    </Chrome>
  );
}

/**
 * `/how-it-works` (DR5-25, #233): the rules page becomes the FAQ. Topic tiles
 * at the top, an anchor per topic, and every `How … works ›` link lands on
 * one. S8 rewrites the sections; this board shows the structure and one topic.
 */
export function HowItWorksPage({ topics, section }: { topics: readonly { id: string; title: string; state: string }[]; section: { title: string; parts: readonly { id: string; title: string; body: readonly string[] }[] } }) {
  return (
    <Chrome>
      <main className={PAGE}>
        <div className={COLUMN}>
          <PageHeader sub="Attendance drives every card. Here is how the rest follows." title="How FLUT works" />
          <nav aria-label="Topics" className="grid grid-cols-2 gap-3">
            {topics.map((t) => (
              <LinkTile href={`#${t.id}`} key={t.id} state={t.state} title={t.title} />
            ))}
          </nav>
          <Block id="midweek" title={section.title}>
            {section.parts.map((part) => (
              <section className="grid gap-2 border-t border-line/40 pt-3" id={part.id} key={part.id}>
                <h3 className="text-body font-semibold">{part.title}</h3>
                {part.body.map((line, i) => (
                  <p className="text-body text-ink-dim" key={i}>
                    {line}
                  </p>
                ))}
              </section>
            ))}
            <a className="inline-flex min-h-11 items-center justify-self-start text-small font-semibold text-brass" href="#top">
              Back to the topics ↑
            </a>
          </Block>
        </div>
      </main>
    </Chrome>
  );
}

/** The crest lockup (design/flut §2): the brand mark, which keeps its own type like the card face. */
function Lockup({ centred }: { centred?: boolean }) {
  return (
    <p className={`flex items-center gap-4 ${centred ? "flex-col gap-3 text-center" : ""}`}>
      <span aria-hidden="true" className={`clip-pennant shrink-0 bg-brass ${centred ? "h-[50px] w-11" : "h-20 w-[70px]"}`} />
      <span className="grid gap-2">
        <span className={`${centred ? "text-5xl" : "text-[40px]"} leading-none font-black tracking-[-0.02em] text-ink`}>FLUT</span>
        <span className="text-[0.7rem] leading-[1.45] font-extrabold tracking-[0.26em] text-brass uppercase">
          <span className="block">Football League</span>
          <span className="block">Ultimate Team</span>
        </span>
      </span>
    </p>
  );
}

/** `/login` (DR5-26): the lockup, the Title, one Small line, the form on the scale. */
export function LoginPage() {
  return (
    <main className="board-ground flex min-h-screen items-center justify-center px-4 py-8 text-ink sm:p-10">
      <section className="grid w-full max-w-md gap-8">
        <Lockup />
        <PageHeader sub="FLUT is for invited members." title="Sign in" />
        <form className="grid gap-5">
          <Field help="Or the email address you joined with." label="Username" />
          <Field label="Password" type="password" />
          <Button wide>Sign in</Button>
        </form>
      </section>
    </main>
  );
}

/** `/welcome` (DR5-26): the lockup centred, the Title, the sealed pack, one line, the one button. */
export function WelcomePage() {
  return (
    <main className="board-ground min-h-screen px-4 py-8 text-ink sm:p-10">
      <section className="mx-auto grid max-w-md justify-items-center gap-6 text-center">
        <Lockup centred />
        <h1 className="font-serif text-title font-normal text-balance sm:text-title-lg">Your starter pack is waiting</h1>
        <div className="grid aspect-[4/3] w-full place-items-center rounded-2xl border border-brass-line bg-[radial-gradient(circle_at_top,_#4a2f08,_#15130f_62%)]">
          <span className="grid justify-items-center gap-2">
            <span aria-hidden="true" className="text-figure">
              🎒
            </span>
            <span className="text-label font-semibold text-brass">Sealed starter pack</span>
          </span>
        </div>
        <p className="text-body text-ink-dim">250 FLUT Coins and three Live Cards are already yours.</p>
        <Button wide>Open your starter pack</Button>
      </section>
    </main>
  );
}
