// The Academy mocks (#246 S1), design only: the real app chrome, LiveCard, the
// DR5 primitives (src/components/ui) and two new pieces, `Progress` (three
// pips) and `Retired` (the stamp over a real card). Every size is one of the
// six type roles. Nothing in the app imports this file; S3 lifts from it.
import Link from "next/link";
import type { ReactNode } from "react";
import { AppNav } from "@/components/app-shell/app-nav";
import { AttributeBars } from "@/components/card-stats";
import { LiveCard, type LiveCardPlayer } from "@/components/live-card";
import { MessageRow } from "@/components/message-row";
import { MidweekNotice } from "@/components/midweek/bits";
import { MidweekMiniCard } from "@/components/midweek/mini-card";
import { IconChronicle } from "@/components/icons";
import { Block, Inset, Stat } from "@/components/ui/block";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/form";
import { FigureTile, InfoLink, LinkRow, LinkTile } from "@/components/ui/links";
import { CardGrid, COLUMN, PAGE, PageHeader } from "@/components/ui/page";
import { SectionNav } from "@/components/ui/section-nav";
import { Figure, Tag } from "@/components/ui/tag";
import type { UserNotification } from "@/lib/messages";
import { buildCompeteTabs } from "@/lib/nav/routes";

type Tier = LiveCardPlayer["rarityTier"];
export type Stamp = "stamp" | "sash" | "plaque";

export function Chrome({ children, unread = 0 }: { children: ReactNode; unread?: number }) {
  return (
    <>
      <AppNav balance={1240} competeStatus={null} displayName="Sanne" incomingOfferCount={0} isAdmin={false} unreadCount={unread} />
      <div className="pb-[calc(4rem_+_env(safe-area-inset-bottom,0px))] sm:pb-0">{children}</div>
    </>
  );
}

const CompeteNav = () => <SectionNav label="Compete" tabs={buildCompeteTabs(null)} />;

// ------------------------------------------------------------- new pieces ----

/**
 * `Progress`: three pips towards promotion. A filled pip is a counted week
 * played, a brass ring with + is a credit, a dashed one is still to come.
 * The words beside it carry the meaning; the pips are decoration.
 */
export function Progress({ real, credits, size = "row" }: { real: number; credits: number; size?: "row" | "big" }) {
  const pip = size === "big" ? "h-6 w-6 text-small" : "h-3.5 w-3.5 text-[10px]";
  const pips = [...Array(3)].map((_, i) => (i < real ? "real" : i < real + credits ? "credit" : "empty"));
  return (
    <span aria-hidden="true" className="flex flex-none items-center gap-1">
      {pips.map((kind, i) => (
        <span
          className={`grid ${pip} place-items-center rounded-full font-extrabold leading-none ${
            kind === "real" ? "bg-brass" : kind === "credit" ? "border-2 border-brass text-brass" : "border-2 border-dashed border-line"
          }`}
          key={i}
        >
          {kind === "credit" && size === "big" ? "+" : null}
        </span>
      ))}
    </span>
  );
}

/** The words for a progress: "2 of 3 weeks", "1 week + 1 credit". */
export function progressWords(real: number, credits: number) {
  const weeks = `${real} ${real === 1 ? "week" : "weeks"}`;
  return credits ? `${weeks} + ${credits} ${credits === 1 ? "credit" : "credits"}` : `${real} of 3 weeks`;
}

/** A real LiveCard with the Retired treatment drawn over it (current surfaces only). */
export function Retired({ player, stamp = "stamp", size = "grid", since }: { player: LiveCardPlayer; stamp?: Stamp; size?: "grid" | "detail"; since?: string }) {
  return (
    <div className="retired" data-stamp={stamp}>
      <LiveCard player={player} size={size} />
      {stamp === "stamp" && (
        <span aria-hidden="true" className="retired__stamp">
          <b>Retired</b>
        </span>
      )}
      {stamp === "sash" && (
        <span aria-hidden="true" className="retired__sash">
          Retired
        </span>
      )}
      {stamp === "plaque" && (
        <span aria-hidden="true" className="retired__plaque">
          Retired
        </span>
      )}
      <span className="sr-only">Retired{since ? ` since ${since}` : ""}: this card can&rsquo;t play Midweek</span>
    </div>
  );
}

export function RetiredMini({ rarityTier, ovr, small }: { rarityTier: Tier; ovr: number; small?: boolean }) {
  return (
    <span className="retired-mini">
      <MidweekMiniCard injured={false} ovr={ovr} rarityTier={rarityTier} small={small} />
    </span>
  );
}

// ----------------------------------------------------------------- Players ----

export type AcademyRow = { name: string; href: string; real: number; credits: number; line: string; tag?: { tone: "warn" | "you" | "neutral"; text: string } };

/** The Academy on the Players page: Talents and comebacks with progress >= 2. */
export function AcademyBlock({ rows }: { rows: readonly AcademyRow[] }) {
  return (
    <Block aside={<p className="text-small text-ink-dim">{rows.length} close to the First Team</p>} id="academy" title="Academy">
      <p className="text-small text-ink-dim">Players without a card yet. Three weeks out of the last eight earns one.</p>
      <ul className="grid">
        {rows.map((r) => (
          <LinkRow
            end={<Progress credits={r.credits} real={r.real} />}
            href={r.href}
            key={r.name}
            meta={r.line}
            title={
              <span className="flex flex-wrap items-center gap-2">
                {r.name}
                {r.tag && <Tag tone={r.tag.tone}>{r.tag.text}</Tag>}
              </span>
            }
          />
        ))}
      </ul>
      <InfoLink href="/how-it-works#academy">How the Academy works</InfoLink>
    </Block>
  );
}

export function PlayersPage({ academy, cards, retired }: { academy: readonly AcademyRow[]; cards: readonly { player: LiveCardPlayer; href: string; tag?: { tone: "warn" | "won"; text: string } }[]; retired: { count: number } }) {
  return (
    <Chrome>
      <main className={PAGE}>
        <section className={`${COLUMN} lg:max-w-6xl`}>
          <CompeteNav />
          <PageHeader sub={`${cards.length} in the First Team`} title="Players" />
          {/* Phones: the First Team, then the Academy, then Retired. From lg the Academy is a side column. */}
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:items-start lg:gap-8">
            <div className="grid min-w-0 gap-6 lg:col-start-1 lg:row-start-1">
              <div className="flex min-h-12 items-center justify-between gap-3 rounded-xl border border-line/60 bg-panel/60 px-4 text-small text-ink-dim">
                <span>Highest OVR first</span>
                <span className="font-semibold text-brass">Filter</span>
              </div>
              <CardGrid wide={4}>
                {cards.map((c) => (
                  <div className="relative" key={c.href}>
                    <Link className="block rounded-[0.9rem]" href={c.href}>
                      <LiveCard player={c.player} />
                    </Link>
                    {c.tag && <span className="absolute top-2 left-1/2 z-10 -translate-x-1/2"><Tag tone={c.tag.tone}>{c.tag.text}</Tag></span>}
                  </div>
                ))}
              </CardGrid>
            </div>
            <div className="grid min-w-0 lg:col-start-2 lg:row-span-2 lg:row-start-1">
              <AcademyBlock rows={academy} />
            </div>
            <ul className="grid min-w-0 rounded-2xl border border-line/60 bg-panel/60 px-4 lg:col-start-1 lg:row-start-2">
              <LinkRow end={<span className="tabular-nums">{retired.count}</span>} href="/players/retired" meta="Their cards still trade, but can't play Midweek" title="Retired" />
            </ul>
          </div>
        </section>
      </main>
    </Chrome>
  );
}

export function RetiredListPage({ cards, stamp }: { cards: readonly { player: LiveCardPlayer; href: string; since: string; foot: string }[]; stamp: Stamp }) {
  return (
    <Chrome>
      <main className={PAGE}>
        <section className={`${COLUMN} lg:max-w-6xl`}>
          <PageHeader back={{ href: "/players", label: "Players" }} sub={`${cards.length} Players · 12 counted weeks without a game`} title="Retired" />
          <p className="text-body text-ink-dim">
            Packs don&rsquo;t make these cards any more. Copies stay owned and tradeable, but can&rsquo;t play Midweek. One more promotion brings a Player back.
          </p>
          <CardGrid>
            {cards.map((c) => (
              <div className="grid min-w-0 content-start gap-2" key={c.href}>
                <Link className="block rounded-[0.9rem]" href={c.href}>
                  <Retired player={c.player} since={c.since} stamp={stamp} />
                </Link>
                <p className="text-small text-ink-dim">{c.foot}</p>
              </div>
            ))}
          </CardGrid>
          <InfoLink href="/how-it-works#retired">When a Player retires</InfoLink>
        </section>
      </main>
    </Chrome>
  );
}

// ---------------------------------------------------------------- profiles ----

/** The last eight counted weeks as a strip: played, credit, or not. */
export function WeekStrip({ weeks }: { weeks: readonly { day: string; month: string; kind: "played" | "missed" | "credit" | "before" }[] }) {
  return (
    <ol className="grid grid-cols-8 gap-1" aria-label="The last eight counted weeks">
      {weeks.map((w, i) => (
        <li className="grid min-w-0 justify-items-center gap-1" key={i}>
          <span
            className={`grid h-8 w-full place-items-center rounded-md text-label font-semibold ${
              w.kind === "played" ? "bg-brass text-ink-on-accent" : w.kind === "credit" ? "border-2 border-brass text-brass" : w.kind === "before" ? "bg-panel-2/40 text-ink-faint" : "border border-dashed border-line text-ink-faint"
            }`}
          >
            {w.kind === "played" ? "✓" : w.kind === "credit" ? "+" : ""}
            <span className="sr-only">{w.kind === "played" ? "played" : w.kind === "credit" ? "credit" : "no game"}</span>
          </span>
          <span className="grid justify-items-center text-label text-ink-faint tabular-nums">
            <span>{w.day}</span>
            <span>{w.month}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

export function TalentProfile({ name, sub, real, credits, headline, line, weeks, ovr, tier, fading }: { name: string; sub: string; real: number; credits: number; headline: string; line: ReactNode; weeks: Parameters<typeof WeekStrip>[0]["weeks"]; ovr: number; tier: string; fading?: string }) {
  return (
    <Chrome>
      <main className={PAGE}>
        <section className={`${COLUMN} lg:max-w-5xl`}>
          <PageHeader back={{ href: "/players", label: "Players" }} sub={sub} title={name} />
          <div className="grid grid-cols-[minmax(0,1fr)] gap-6 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] md:items-start sm:gap-8">
            <Block aside={<Tag tone="auto">Talent</Tag>} title="Road to the First Team">
              <div className="flex flex-wrap items-center gap-4">
                <Progress credits={credits} real={real} size="big" />
                <Figure>{real + credits} of 3</Figure>
              </div>
              <p className="text-body font-semibold">{headline}</p>
              <p className="text-body text-ink-dim">{line}</p>
              {fading && <MidweekNotice tone="warn">{fading}</MidweekNotice>}
              <WeekStrip weeks={weeks} />
              <InfoLink href="/how-it-works#academy">How the Academy works</InfoLink>
            </Block>
            <div className="grid min-w-0 gap-6">
              <Block title="Rating">
                <dl className="grid grid-cols-2 gap-3">
                  <Stat label="OVR now" note={tier} value={ovr} />
                  <Stat label="In packs" note="After promotion" value="No" />
                </dl>
                <p className="text-small text-ink-dim">Their rating builds from their first game, so a promoted Talent&rsquo;s card starts where this one is.</p>
              </Block>
              <Block title="Midweek">
                <p className="text-body text-ink-dim">Talents in the Academy fill Midweek&rsquo;s trialist slots by name. They play at OVR 30, like any trialist.</p>
              </Block>
            </div>
          </div>
        </section>
      </main>
    </Chrome>
  );
}

/** A First Team or Retired profile: the real profile's layout with a stage block above the attributes. */
export function CardProfile({ name, sub, player, attrs, stage, retired, stamp = "stamp", since }: { name: string; sub: string; player: LiveCardPlayer; attrs: Parameters<typeof AttributeBars>[0]["player"]; stage: ReactNode; retired?: boolean; stamp?: Stamp; since?: string }) {
  return (
    <Chrome>
      <main className={PAGE}>
        <section className={`${COLUMN} lg:max-w-5xl`}>
          <PageHeader back={{ href: "/players", label: "Players" }} sub={sub} title={name} />
          <div className="grid grid-cols-[minmax(0,1fr)] gap-6 md:grid-cols-[minmax(240px,330px)_minmax(0,1fr)] md:items-start sm:gap-8">
            <div className="min-w-0">{retired ? <Retired player={player} since={since} size="detail" stamp={stamp} /> : <LiveCard player={player} size="detail" />}</div>
            <div className="min-w-0 space-y-6 sm:space-y-8">
              {stage}
              <Block title="Attributes">
                <AttributeBars player={attrs} />
              </Block>
              <Block title="Rating history">
                <p className="text-small text-ink-dim">The chart as today.</p>
              </Block>
            </div>
          </div>
        </section>
      </main>
    </Chrome>
  );
}

export function AtRiskBlock({ name, absent, toRetire, copies }: { name: string; absent: number; toRetire: number; copies?: number }) {
  return (
    <Block aside={<Tag tone="warn">At risk</Tag>} title={`${absent} weeks without a game`}>
      <p className="text-body text-ink-dim">
        {name} retires after 12 counted weeks without a game: {toRetire} more. One game resets the count.
      </p>
      {copies ? (
        <p className="text-body text-ink-dim">
          Your {copies === 1 ? "copy stays" : `${copies} copies stay`} yours either way. Retired cards can&rsquo;t play Midweek.
        </p>
      ) : null}
      <InfoLink href="/how-it-works#retired">When a Player retires</InfoLink>
    </Block>
  );
}

export function RetiredBlock({ name, since, comeback }: { name: string; since: string; comeback?: { real: number; credits: number; line: string } }) {
  return (
    <Block aside={<Tag tone="out">Retired</Tag>} title={`Retired since ${since}`}>
      <p className="text-body text-ink-dim">
        12 counted weeks without a game. Packs don&rsquo;t make {name}&rsquo;s card any more; copies stay owned and tradeable but can&rsquo;t play Midweek.
      </p>
      {comeback && (
        <Inset className="grid gap-2">
          <span className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-body font-semibold">Comeback</span>
            <span className="flex items-center gap-2 text-small text-ink-dim">
              <Progress credits={comeback.credits} real={comeback.real} />
              {progressWords(comeback.real, comeback.credits)}
            </span>
          </span>
          <span className="text-small text-ink-dim">{comeback.line}</span>
        </Inset>
      )}
      <InfoLink href="/how-it-works#retired">When a Player retires</InfoLink>
    </Block>
  );
}

// -------------------------------------------------------- promotion moment ----

export function HomePage({ newIn }: { newIn: { name: string; state: string; href: string } }) {
  return (
    <Chrome unread={2}>
      <main className={PAGE}>
        <div className={`${COLUMN} lg:max-w-5xl`}>
          <PageHeader sub="Wed 3 Feb" title="This week in FLUT" />
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:items-start lg:gap-8">
            <Block aside={<p className="text-small font-semibold text-brass">Locks 19:55</p>} title="Pick your five" tone="now">
              <p className="text-body text-ink-dim">Midweek Madness, Wed 3 Feb. Not picked yet, so an auto squad would play.</p>
              <Button href="/midweek/pick">Pick your five</Button>
            </Block>
            <div className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2">
              <FigureTile href="/club/value" label="Club Value" value="1,389" />
              <FigureTile href="/leaderboard" label="Rank" value="#4" />
              <LinkTile href="/club/packs" state="250 coins · 5 cards" title="Open a pack" />
              <LinkTile href={newIn.href} state={newIn.state} title={`New: ${newIn.name}`} />
            </div>
          </div>
          <LinkTile href="/chronicle" icon={<IconChronicle className="h-4 w-4" />} state="Fenna joins the First Team" title="The Chronicle, week of 1 Feb" />
        </div>
      </main>
    </Chrome>
  );
}

export function MessagesPage({ rows, open }: { rows: readonly UserNotification[]; open: UserNotification }) {
  return (
    <Chrome unread={rows.filter((r) => !r.read_at).length}>
      <main className={PAGE}>
        <section className={COLUMN}>
          <PageHeader title="Messages" />
          <p className="text-small text-ink-dim">{rows.filter((r) => !r.read_at).length} new</p>
          <section aria-label="Today" className="grid gap-1">
            <h2 className="pt-3.5 pb-1.5 text-label font-semibold text-ink-faint">This week</h2>
            <ol className="grid rounded-2xl border border-line/60 bg-panel/60 px-4 [&>li]:border-b [&>li]:border-line/40 [&>li:last-child]:border-b-0">
              {rows.map((m) => (
                <li key={m.id}>
                  <MessageRow message={m} target={null} time="Mon 22:10" />
                </li>
              ))}
            </ol>
          </section>
          <Block title={open.title}>
            <p className="text-body text-ink-dim">{open.body}</p>
            <Button href="/players/fenna-l" kind="secondary">
              See Fenna&rsquo;s card
            </Button>
          </Block>
        </section>
      </main>
    </Chrome>
  );
}

export function ChronicleRoster({ title, dates, rows }: { title: string; dates: string; rows: readonly { tag: { tone: "won" | "warn" | "out" | "you"; text: string }; text: string; meta: string }[] }) {
  return (
    <Chrome>
      <main className={PAGE}>
        <section className={COLUMN}>
          <PageHeader back={{ href: "/chronicle", label: "Chronicle" }} sub={dates} title={title} />
          <p className="text-small text-ink-dim">The session blocks, the goals and the crossings as today.</p>
          <Block id="roster" title="The roster">
            <ul className="grid">
              {rows.map((r) => (
                <li className="grid grid-cols-[minmax(0,1fr)] gap-1 border-b border-line/40 py-2.5 last:border-b-0" key={r.text}>
                  <span className="flex flex-wrap items-center gap-2 text-body">
                    <Tag tone={r.tag.tone}>{r.tag.text}</Tag>
                    <span className="font-semibold">{r.text}</span>
                  </span>
                  <span className="text-small text-ink-dim">{r.meta}</span>
                </li>
              ))}
            </ul>
          </Block>
        </section>
      </main>
    </Chrome>
  );
}

export function PacksNew({ name, line }: { name: string; line: string }) {
  return (
    <Chrome>
      <main className={PAGE}>
        <section className={COLUMN}>
          <PageHeader back={{ href: "/club", label: "Club" }} sub="1,240 coins" title="Packs" />
          <Inset className="flex flex-wrap items-center justify-between gap-3">
            <span className="grid gap-0.5">
              <span className="text-body font-semibold">New in packs: {name}</span>
              <span className="text-small text-ink-dim">{line}</span>
            </span>
            <InfoLink href="/players/fenna-l">Card</InfoLink>
          </Inset>
          <p className="text-small text-ink-dim">The pack offers as today; nothing about them changes.</p>
        </section>
      </main>
    </Chrome>
  );
}

// ------------------------------------------------------------- your cards ----

export function OwnedCardPage({ name, sub, player, discard, block, retired, stamp = "stamp", since }: { name: string; sub: string; player: LiveCardPlayer; discard: number; block: ReactNode; retired?: boolean; stamp?: Stamp; since?: string }) {
  return (
    <Chrome>
      <main className={PAGE}>
        <section className={`${COLUMN} lg:max-w-5xl`}>
          <PageHeader back={{ href: "/club/collection", label: "Collection" }} sub={sub} title={name} />
          <div className="grid grid-cols-[minmax(0,1fr)] gap-6 md:grid-cols-[minmax(240px,330px)_minmax(0,1fr)] md:items-start sm:gap-8">
            <div className="min-w-0">{retired ? <Retired player={player} since={since} size="detail" stamp={stamp} /> : <LiveCard player={player} size="detail" />}</div>
            <div className="min-w-0 space-y-6">
              {block}
              <Block title="This copy">
                <dl className="grid grid-cols-2 gap-3">
                  <Stat label="Discard" note="coins now" value={discard} />
                  <Stat label="Copies" note="You own" value={2} />
                </dl>
                <div className="flex flex-wrap gap-3">
                  <Button href="#sell">Sell</Button>
                  <Button href="#discard" kind="secondary">
                    Discard for {discard}
                  </Button>
                </div>
              </Block>
            </div>
          </div>
        </section>
      </main>
    </Chrome>
  );
}

export function AlbumPage({ unique, total, cards, set }: { unique: number; total: number; cards: number; set: readonly { name: string; player: LiveCardPlayer | null; since: string }[] }) {
  const owned = set.filter((s) => s.player).length;
  return (
    <Chrome>
      <main className={PAGE}>
        <section className={`${COLUMN} lg:max-w-5xl`}>
          <header className="grid gap-4">
            <PageHeader sub={`${unique} of ${total} First Team · ${cards} cards · Club Value 1,389 ›`} title="Collection" />
            <div className="grid gap-1.5">
              <div className="h-2 overflow-hidden rounded-full bg-panel-2">
                <div className="h-full rounded-full bg-brass" style={{ width: `${Math.round((unique / total) * 100)}%` }} />
              </div>
              <p className="text-small text-ink-dim">
                {total - unique} First Team Players to go. Retired Players don&rsquo;t count.
              </p>
            </div>
            <SectionNav active="album" label="Collection view" tabs={[{ key: "album", label: "Album", href: "/club/collection" }, { key: "manage", label: "Manage", href: "/club/collection?view=manage" }, { key: "trading", label: "Trading", href: "/club/collection/wanted" }]} />
          </header>
          <p className="text-small text-ink-dim">The First Team pages as today, then the Retired set after the last page (and as a filter: Retired · {set.length}).</p>
          <Block aside={<p className="text-small text-ink-dim">{owned} of {set.length}</p>} id="retired-set" title="Retired set">
            <p className="text-small text-ink-dim">Packs don&rsquo;t make these any more: the only way to fill a slot is a trade.</p>
            <CardGrid wide={4}>
              {set.map((s) =>
                s.player ? (
                  <Retired key={s.name} player={s.player} since={s.since} />
                ) : (
                  <div className="grid aspect-[5/7] place-items-center content-center gap-1 rounded-[0.9rem] border-2 border-dashed border-line/70 p-3 text-center" key={s.name}>
                    <span className="text-body font-semibold text-ink-dim">{s.name}</span>
                    <span className="text-small text-ink-faint">Retired {s.since}</span>
                  </div>
                ),
              )}
            </CardGrid>
          </Block>
        </section>
      </main>
    </Chrome>
  );
}

export function ListingPage({ name, player, price, seller, since, stamp }: { name: string; player: LiveCardPlayer; price: number; seller: string; since: string; stamp: Stamp }) {
  return (
    <Chrome>
      <main className={PAGE}>
        <section className={`${COLUMN} lg:max-w-5xl`}>
          <PageHeader back={{ href: "/market", label: "Market" }} sub={`Listed by ${seller} · 41 h left`} title={name} />
          <div className="grid grid-cols-[minmax(0,1fr)] gap-6 md:grid-cols-[minmax(240px,330px)_minmax(0,1fr)] md:items-start sm:gap-8">
            <Retired player={player} since={since} size="detail" stamp={stamp} />
            <div className="min-w-0 space-y-6">
              <Block aside={<Tag tone="out">Retired</Tag>} title={`${price} coins`}>
                <p className="text-body text-ink-dim">Can&rsquo;t play Midweek while {name} is Retired. Packs don&rsquo;t make this card any more.</p>
                <Button wide>Buy for {price}</Button>
              </Block>
            </div>
          </div>
        </section>
      </main>
    </Chrome>
  );
}

// ------------------------------------------------------------------ Midweek ----

export function PickerPage({ notice, rows }: { notice: ReactNode; rows: readonly { name: string; meta: string; mini: { rarityTier: Tier; ovr: number }; retired?: boolean; picked?: number }[] }) {
  return (
    <Chrome>
      <main className={PAGE}>
        <section className={COLUMN}>
          <PageHeader back={{ href: "/midweek", label: "Midweek" }} sub="Locks Wed 19:55" title="Pick your five" />
          <MidweekNotice tone="warn">{notice}</MidweekNotice>
          <Block aside={<p className="text-small text-ink-dim">Empty slots play a trialist</p>} title="Your cards">
            <ul className="grid">
              {rows.map((r) => (
                <li className={`grid min-h-14 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b border-line/40 py-2 last:border-b-0 ${r.retired ? "opacity-70" : ""}`} key={r.name}>
                  {r.retired ? <RetiredMini ovr={r.mini.ovr} rarityTier={r.mini.rarityTier} /> : <MidweekMiniCard injured={false} ovr={r.mini.ovr} rarityTier={r.mini.rarityTier} />}
                  <span className="grid min-w-0">
                    <span className="truncate text-body font-semibold">{r.name}</span>
                    <span className="truncate text-small text-ink-dim">{r.retired ? "Can't play Midweek" : r.meta}</span>
                  </span>
                  {r.retired ? <Tag tone="out">Retired</Tag> : r.picked ? <Tag tone="you">Slot {r.picked}</Tag> : <span className="text-small font-semibold text-brass">Pick</span>}
                </li>
              ))}
            </ul>
          </Block>
        </section>
      </main>
    </Chrome>
  );
}

export function LineupBoard({ club, rows, fallback }: { club: string; rows: readonly { name: string; meta: string; mini: { rarityTier: Tier; ovr: number } | null }[]; fallback: string }) {
  return (
    <Chrome>
      <main className={PAGE}>
        <section className={COLUMN}>
          <PageHeader back={{ href: "/midweek", label: "Midweek" }} sub="Round 2 · 20:15" title="Next match" />
          <Block aside={<p className="text-small text-ink-dim">Power 251</p>} title={club}>
            <ul className="grid">
              {rows.map((r, i) => (
                <li className="grid min-h-12 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b border-line/40 py-2 last:border-b-0" key={i}>
                  {r.mini ? <MidweekMiniCard injured={false} ovr={r.mini.ovr} rarityTier={r.mini.rarityTier} small /> : <MidweekMiniCard ovr={30} small variant="trialist" />}
                  <span className="grid min-w-0">
                    <span className="truncate text-body font-semibold">{r.name}</span>
                    <span className="truncate text-small text-ink-dim">{r.meta}</span>
                  </span>
                  {!r.mini && <Tag tone="neutral">Trialist</Tag>}
                </li>
              ))}
            </ul>
          </Block>
          <Block title="Before go-live, or no Talents to draw">
            <ul className="grid">
              <li className="grid min-h-12 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 py-2">
                <MidweekMiniCard ovr={30} small variant="trialist" />
                <span className="grid min-w-0">
                  <span className="truncate text-body font-semibold">{fallback}</span>
                  <span className="truncate text-small text-ink-dim">All-rounder · OVR 30</span>
                </span>
                <Tag tone="neutral">Trialist</Tag>
              </li>
            </ul>
          </Block>
        </section>
      </main>
    </Chrome>
  );
}

// -------------------------------------------------------------------- admin ----

const ADMIN_TABS = ["Attendance", "Roster", "Accounts", "Midweek", "Economy"];
function AdminTabs({ active }: { active: string }) {
  return (
    <nav aria-label="Admin" className="flex flex-wrap gap-2">
      {ADMIN_TABS.map((t) => (
        <a className={`inline-flex min-h-11 items-center rounded-lg border px-3 text-small font-semibold ${t === active ? "border-brass-line bg-brass-bg text-brass" : "border-line text-ink-dim"}`} href="#" key={t}>
          {t}
        </a>
      ))}
    </nav>
  );
}

export function AttendanceAddTalent({ players, query, match }: { players: readonly { name: string; on: boolean; tag?: string }[]; query: string; match: { name: string; meta: string } }) {
  return (
    <Chrome>
      <main className={PAGE}>
        <section className={COLUMN}>
          <AdminTabs active="Attendance" />
          <PageHeader sub="Monday 1 Feb" title="Record attendance" />
          <Block title="Who played?">
            <p className="text-small text-ink-dim">Tap each attendee. Talents and Retired Players are here too.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {players.map((p) => (
                <button className={`flex min-h-12 items-center justify-between gap-2 rounded-xl border px-4 py-3 text-left text-body font-semibold ${p.on ? "border-brass bg-brass text-ink-on-accent" : "border-line bg-panel text-ink"}`} key={p.name} type="button">
                  <span className="truncate">{p.name}</span>
                  {p.tag && <span className={`text-label font-semibold ${p.on ? "text-ink-on-accent" : "text-ink-faint"}`}>{p.tag}</span>}
                </button>
              ))}
            </div>
          </Block>
          <Block title="Not on the list?">
            <Field help="They join the Academy as a Talent. A card comes with promotion." label="Add a Talent" placeholder="Display name" value={query} readOnly />
            <MidweekNotice tone="warn">
              <b>Is this {match.name}?</b> {match.meta}
            </MidweekNotice>
            <div className="flex flex-wrap gap-3">
              <Button kind="secondary">Tick {match.name}</Button>
              <Button kind="secondary">Add {query} as new</Button>
            </div>
          </Block>
          <Button wide>4 selected · review</Button>
        </section>
      </main>
    </Chrome>
  );
}

export type RosterAdminRow = { name: string; stage: { tone: "auto" | "neutral" | "warn" | "out" | "won"; text: string }; clock: string; active: boolean; injury: string; actions: readonly string[] };

export function AdminRoster({ live, rows, detail, add }: { live: { on: boolean; line: string }; rows: readonly RosterAdminRow[]; detail: ReactNode; add: ReactNode }) {
  return (
    <Chrome>
      <main className="board-ground min-h-screen px-4 pt-4 pb-8 text-body text-ink sm:px-8 sm:pt-8">
        <section className="mx-auto grid max-w-5xl grid-cols-[minmax(0,1fr)] gap-6 sm:gap-8">
          <AdminTabs active="Roster" />
          <PageHeader sub="First Team, Talents and Retired Players" title="Roster" />
          <Block aside={<Tag tone={live.on ? "won" : "neutral"}>{live.on ? "Live" : "Off"}</Tag>} title="Academy" tone={live.on ? "plain" : "now"}>
            <p className="text-body text-ink-dim">{live.line}</p>
            {!live.on && <Button>Go live this week</Button>}
          </Block>
          {add}
          {detail}
          <div className="overflow-x-auto rounded-2xl border border-line bg-panel">
            <table className="w-full text-left text-small">
              <thead className="text-label font-semibold text-ink-faint">
                <tr className="border-b border-line">
                  <th className="px-4 py-3">Display name</th>
                  <th className="px-4 py-3">Stage</th>
                  <th className="px-4 py-3">Clock</th>
                  <th className="px-4 py-3">Active</th>
                  <th className="px-4 py-3">Injury</th>
                  <th className="px-4 py-3 text-right">Manage</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr className="border-b border-line/50 last:border-0" key={r.name}>
                    <td className="px-4 py-3 font-semibold whitespace-nowrap">{r.name}</td>
                    <td className="px-4 py-3">
                      <Tag tone={r.stage.tone}>{r.stage.text}</Tag>
                    </td>
                    <td className="px-4 py-3 text-ink-dim whitespace-nowrap">{r.clock}</td>
                    <td className="px-4 py-3 text-ink-dim">{r.active ? "y" : "n"}</td>
                    <td className="px-4 py-3 text-label text-ink-dim whitespace-nowrap">{r.injury}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        {r.actions.map((a) => (
                          <span className="inline-flex min-h-11 items-center rounded-lg border border-line px-3 text-label font-semibold whitespace-nowrap text-ink-dim" key={a}>
                            {a}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </Chrome>
  );
}

/** A choice of two or three, as radio buttons in segments (Small 600). */
function Choice({ legend, name, options, on, help }: { legend: string; name: string; options: readonly string[]; on: string; help?: ReactNode }) {
  return (
    <fieldset className="grid gap-2">
      <legend className="pb-2 text-small font-semibold">{legend}</legend>
      <div className="grid auto-cols-fr grid-flow-col gap-1 rounded-xl border border-line/70 bg-board-deep/40 p-1">
        {options.map((o) => (
          <label className={`grid min-h-11 cursor-pointer place-items-center rounded-lg px-2 text-center text-small font-semibold ${o === on ? "bg-brass-bg text-brass" : "text-ink-dim"}`} key={o}>
            <input className="sr-only" defaultChecked={o === on} name={name} type="radio" value={o} />
            {o}
          </label>
        ))}
      </div>
      {help && <p className="text-small text-ink-dim">{help}</p>}
    </fieldset>
  );
}

/**
 * Add a Player on the roster: a Talent (the default, optionally with credits)
 * or straight into the First Team. Attendance can still add a Talent on the
 * spot; this is the way without a session (owner, S1 feedback).
 */
export function AddPlayerBlock({ name, stage, credits, match }: { name?: string; stage: "Talent" | "First Team"; credits: "0" | "1" | "2"; match?: { name: string; meta: string } }) {
  const talent = stage === "Talent";
  return (
    <Block title="Add a Player">
      <Field label="Display name" placeholder="e.g. Jip W." readOnly value={name ?? ""} />
      {match && (
        <MidweekNotice tone="warn">
          <b>Is this {match.name}?</b> {match.meta} Open their row instead, or add a different name (e.g. &ldquo;Jip B.&rdquo;).
        </MidweekNotice>
      )}
      <Choice
        help={talent ? "In the Academy, without a card. Promoted after 3 of the last 8 counted weeks." : "A Live card in packs straight away, as Add Player does today."}
        legend="Starts as"
        name="stage"
        on={talent ? "Talent" : "First Team"}
        options={["Talent", "First Team"]}
      />
      <div className="grid gap-2">
        <span className="text-small font-semibold">Archetype</span>
        <span className="flex min-h-12 items-center justify-between rounded-xl border border-line bg-board-deep/60 px-4 text-body">
          All-rounder <span aria-hidden="true" className="text-ink-faint">⌄</span>
        </span>
      </div>
      {talent && (
        <>
          <Choice
            help="Each counts as a week towards promotion and expires after 8 counted weeks. Up to 2 active."
            legend="Credits to start with"
            name="credits"
            on={credits}
            options={["0", "1", "2"]}
          />
          {credits !== "0" && <Field label="Reason for the credits" placeholder="e.g. trained with us all summer" readOnly />}
        </>
      )}
      <Button wide>{talent ? (credits === "0" ? "Add Talent" : `Add Talent with ${credits} ${credits === "1" ? "credit" : "credits"}`) : "Add to the First Team"}</Button>
    </Block>
  );
}

/** The roster page with the add form filled in, for its own board. */
export function AddTalentPage({ add }: { add: ReactNode }) {
  return (
    <Chrome>
      <main className="board-ground min-h-screen px-4 pt-4 pb-8 text-body text-ink sm:px-8 sm:pt-8">
        <section className={COLUMN}>
          <AdminTabs active="Roster" />
          <PageHeader sub="First Team, Talents and Retired Players" title="Roster" />
          {add}
        </section>
      </main>
    </Chrome>
  );
}

export function TalentAdmin({ name, real, credits, lines, canPromote, kind }: { name: string; real: number; credits: number; lines: readonly string[]; canPromote: boolean; kind: "talent" | "retired" }) {
  return (
    <Block aside={<Tag tone={kind === "talent" ? "auto" : "out"}>{kind === "talent" ? "Talent" : "Retired"}</Tag>} title={name}>
      <span className="flex flex-wrap items-center gap-3 text-body">
        <Progress credits={credits} real={real} />
        {progressWords(real, credits)} {kind === "retired" ? "towards a comeback" : "towards promotion"}
      </span>
      <ul className="grid gap-1 text-small text-ink-dim">
        {lines.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
      <Inset className="grid gap-3">
        <span className="text-body font-semibold">Give a credit</span>
        <span className="text-small text-ink-dim">Counts as one week towards promotion, never as attendance, rating or coins. Up to 2 active; each expires after 8 counted weeks.</span>
        <Field label="Reason" placeholder="e.g. played the away friendly" readOnly />
        <Button disabled={credits >= 2} kind="secondary">
          Give a credit ({credits} of 2)
        </Button>
      </Inset>
      <Inset className="grid gap-3">
        <span className="text-body font-semibold">{kind === "talent" ? "Promote to the First Team" : "Bring back to the First Team"}</span>
        <span className="text-small text-ink-dim">
          {kind === "talent"
            ? `Gives ${name} a Live card in packs now, for someone who's clearly a regular. Permanent; they keep their Player ID.`
            : `Puts ${name}'s existing card back in packs and Midweek now. They keep their Player ID and edition.`}
        </span>
        <Button disabled={!canPromote} kind="secondary">
          {kind === "talent" ? "Promote" : "Bring back"}
        </Button>
      </Inset>
    </Block>
  );
}

export function GoLiveSheet({ week }: { week: string }) {
  return (
    <Chrome>
      <main className="board-ground min-h-screen px-4 pt-4 pb-8 text-body text-ink sm:px-8 sm:pt-8">
        <section className={COLUMN}>
          <AdminTabs active="Roster" />
          <Block title="Go live this week?" tone="now">
            <p className="text-body text-ink-dim">The Academy starts in the football week of {week}. It can&rsquo;t be backdated or undone.</p>
            <ul className="grid list-disc gap-1 pl-5 text-body text-ink-dim">
              <li>Members see the Academy, stages and the Retired set.</li>
              <li>Clocks start now: nobody is At risk for 8 counted weeks, or Retired for 12.</li>
              <li>Promotions and messages follow each publish.</li>
            </ul>
            <div className="flex flex-wrap gap-3">
              <Button>Go live, week of {week}</Button>
              <Button kind="secondary">Not yet</Button>
            </div>
          </Block>
        </section>
      </main>
    </Chrome>
  );
}

// ---------------------------------------------------------------------- FAQ ----

function Question({ title, id, children }: { title: string; id?: string; children: ReactNode }) {
  return (
    <section className="grid min-w-0 gap-2 border-t border-line/40 pt-3 text-body text-ink-dim [&_strong]:font-semibold [&_strong]:text-ink" id={id}>
      <h3 className="text-body font-semibold text-ink">{title}</h3>
      {children}
    </section>
  );
}

export function FaqPage() {
  return (
    <Chrome>
      <main className={PAGE}>
        <div className={COLUMN}>
          <PageHeader sub="Attendance drives every card. Here is how the rest follows." title="How FLUT works" />
          <Block id="cards" title="Cards and ratings">
            <p className="text-small text-ink-dim">The topic&rsquo;s questions as today, then:</p>
            <Question id="academy" title="How does the Academy work?">
              <p>
                Someone new starts as a <strong>Talent</strong>: no card yet, but a real rating from their first game. Once they have played in <strong>2 of the last 8 counted weeks</strong> they show in the Academy on Players.
              </p>
              <p>
                <strong>Three</strong> counted weeks out of the last eight promote them to the <strong>First Team</strong>: their Live card goes into packs and they get an album slot. Promotion is permanent. A counted week is a Monday-to-Sunday week with a published session; playing twice in one week counts once.
              </p>
            </Question>
            <Question id="retired" title="What happens when a Player retires?">
              <p>
                A First Team Player who misses <strong>8 counted weeks</strong> in a row is <strong>At risk</strong>: owners get a message. After <strong>12</strong> they <strong>retire</strong>. Weeks in injury mode don&rsquo;t count, and one game resets the count.
              </p>
              <p>
                Retiring never takes a card away. Copies stay yours to keep, sell, trade or discard, and wanted lists keep them. Packs and starter packs stop making the card, it can&rsquo;t play Midweek, and it moves to the album&rsquo;s Retired set. Its rating keeps moving as usual.
              </p>
              <p>
                A Retired Player who comes back builds a <strong>comeback</strong> in the Academy, by the same three-week rule. Coming back reuses the same card.
              </p>
            </Question>
          </Block>
          <Block id="midweek" title="Midweek Madness">
            <p className="text-small text-ink-dim">Added to &ldquo;How plusses work&rdquo;, where the trialist is explained:</p>
            <Question title="Who plays in an empty slot?">
              <p>
                A <strong>trialist</strong>: an All-rounder at OVR 30. Trialists borrow the names of Talents in the Academy, but they play exactly the same. A Retired card can&rsquo;t be picked; a saved pick that retires is replaced like a sold card.
              </p>
            </Question>
          </Block>
        </div>
      </main>
    </Chrome>
  );
}

// -------------------------------------------------------------- stamp board ----

export function StampOptions({ columns }: { columns: readonly { key: Stamp; title: string; line: string; cards: readonly LiveCardPlayer[]; mini: { rarityTier: Tier; ovr: number }; detail: LiveCardPlayer; since: string }[] }) {
  return (
    <main className={PAGE}>
      <div className="mx-auto grid max-w-6xl gap-8">
        <PageHeader sub="Same face and rating, a treatment drawn over it. Current surfaces only, never snapshots." title="The Retired treatment" />
        <div className="grid grid-cols-3 gap-8">
          {columns.map((c) => (
            <section className="grid content-start gap-4" key={c.key}>
              <h2 className="text-heading font-semibold">{c.title}</h2>
              <p className="text-small text-ink-dim">{c.line}</p>
              <div className="max-w-[300px]">
                <Retired player={c.detail} since={c.since} size="detail" stamp={c.key} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                {c.cards.map((p) => (
                  <div className="w-[150px]" key={p.displayName}>
                    <Retired player={p} since={c.since} stamp={c.key} />
                  </div>
                ))}
              </div>
              <Inset className="flex items-center gap-3">
                <RetiredMini ovr={c.mini.ovr} rarityTier={c.mini.rarityTier} />
                <span className="grid">
                  <span className="text-body font-semibold">Mini, in a row</span>
                  <span className="text-small text-ink-dim">Retired: can&rsquo;t play Midweek</span>
                </span>
              </Inset>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
