import type { ReactNode } from "react";
import { BottomSheet } from "@/components/bottom-sheet";
import { LiveCard, type LiveCardPlayer } from "@/components/live-card";
import { Block } from "@/components/ui/block";
import { Button } from "@/components/ui/button";
import { InfoLink } from "@/components/ui/links";
import { COLUMN, FOCUS, PAGE, PageHeader } from "@/components/ui/page";
import { Tag } from "@/components/ui/tag";
import { packSummary } from "@/lib/pack-summary";
import { calculateLiveDiscardValue, getRarityTier } from "@/game/rating-engine";
import { Chrome } from "../ui-pass/build/pages";

// Design fixtures only (#223, refined S0). Runtime offers, prices and paid
// receipts come from SQL in S1/S2; nothing here is a second price list.
// `duration` is the wrapper gesture; the three card backs then hold for HOLD.
export const PACKS = [
  { slug: "tfh-pack", key: "regular", title: "Regular pack", name: "Regular", price: 250,
    floor: null, duration: 1200, gesture: ["Strip tears away", "Paper drops, cards rise"] },
  { slug: "tfh-silver-pack", key: "silver", title: "Silver pack", name: "Silver", price: 500,
    floor: "silver", duration: 1400, gesture: ["Light sweeps the steel", "Sleeve slides off"] },
  { slug: "tfh-gold-pack", key: "gold", title: "Gold pack", name: "Gold", price: 750,
    floor: "gold", duration: 1600, gesture: ["Seal breaks", "Doors swing open"] },
] as const;
export type StudyPack = (typeof PACKS)[number];
/** Reveal timing (ms): backs on show, then tier and rating advance on their own. */
export const TIMING = { hold: 1000, tier: 1100, rating: 1000 } as const;
type Tier = LiveCardPlayer["rarityTier"];

const TIER_NAME: Record<Tier, string> = {
  common: "Common", bronze: "Bronze", silver: "Silver", gold: "Gold", holo: "Holo", elite: "Elite",
};
const TIER_BANDS = [
  ["common", "under 40"], ["bronze", "40 to 49"], ["silver", "50 to 59"],
  ["gold", "60 to 69"], ["holo", "70 to 79"], ["elite", "80 and up"],
] as const;

/** Launch shop: a realistic wallet, so Silver shows as a saving goal. */
export const LAUNCH_BALANCE = 420;
/** Design comparison: every pack affordable, so every opening can be tried. */
export const REVIEW_BALANCE = 1250;

// ---------------------------------------------------------------- fixtures ----

const player = (id: string, displayName: string, liveOvr: number,
  archetype: string): LiveCardPlayer => ({
  id, displayName, liveOvr, rarityTier: getRarityTier(liveOvr) as Tier, archetype, injured: false,
  pac: liveOvr + 4, sho: liveOvr - 3, pas: liveOvr + 1, dri: liveOvr + 2, def: liveOvr - 5, phy: liveOvr,
  photoUrl: null,
});
const P = {
  alex: player("p-alex", "Alex", 37, "tank"),
  kim: player("p-kim", "Kim", 38, "speedster"),
  sam: player("p-sam", "Sam", 45, "defender"),
  robin: player("p-robin", "Robin", 56, "playmaker"),
  jesse: player("p-jesse", "Jesse", 64, "finisher"),
  noor: player("p-noor", "Noor", 74, "all_rounder"),
  lior: player("p-lior", "Lior", 81, "goalkeeper"),
};
// A 36-Player album: the named fixtures plus anonymous slots, by name then id.
const ROSTER = [...Object.values(P).map((p) => ({ id: p.id as string, name: p.displayName })),
  ...Array.from({ length: 29 }, (_, i) => ({ id: `p-x${i}`, name: `Zz ${String(i).padStart(2, "0")}` }))]
  .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id)).map((p) => p.id);
// Held before the opening: 16 anonymous Players, plus an older Sam and Alex.
const BEFORE = [...Array.from({ length: 16 }, (_, i) => ({ card_id: `old-x${i}`, player: `p-x${i}`, ovr: 50 })),
  { card_id: "old-sam", player: P.sam.id as string, ovr: P.sam.liveOvr },
  { card_id: "old-alex", player: P.alex.id as string, ovr: P.alex.liveOvr }];

export const OPENED: Record<StudyPack["key"], LiveCardPlayer[]> = {
  regular: [P.kim, P.sam, P.robin], // No floor: any tier, Sam repeats an owned Player.
  silver: [P.alex, P.sam, P.robin], // Two low draws, so the third came from Silver+.
  gold: [P.alex, P.alex, P.jesse], // A duplicate inside the pack, then the Gold+.
};

export function summaryFor(cards: LiveCardPlayer[]) {
  const opened = cards.map((card, i) => ({ card_id: `new-${i}`, player_id: card.id as string }));
  const owned = [...BEFORE.map((c) => ({ card_id: c.card_id, player_id: c.player, discard_value: calculateLiveDiscardValue(c.ovr) })),
    ...cards.map((card, i) => ({ card_id: `new-${i}`, player_id: card.id as string, discard_value: calculateLiveDiscardValue(card.liveOvr) }))];
  return packSummary({ opened, owned, roster: ROSTER });
}

// ---------------------------------------------------------------- pack art ----

/**
 * The wrapper. Each one borrows its material from the Live card ladder
 * (globals.css): Regular is the Common's uncoated stock with the brass
 * pennant printed on it, Silver the Silver plate's brushed metal and pennant,
 * Gold the Gold card's hot foil and pennant. Shape differs too, so the three
 * stay apart in grayscale: crimped paper, a notched sleeve, a sealed wallet.
 */
export function PackArt({ pack, className = "" }: { pack: StudyPack; className?: string }) {
  const label = (
    <span className="pack__label">
      <b>{pack.name}</b>
      <span>3 Live Cards</span>
    </span>
  );
  return (
    <div aria-hidden="true" className={`pack ${className}`} data-pack={pack.key}>
      <span className="pack__glow" />
      <span className="pack__cards"><i /><i /><i /></span>
      {pack.key === "regular" && <>
        <span className="pack__wrap">
          <span className="pack__mark">FLUT</span>
          <span className="pack__print clip-pennant" />
          {label}
        </span>
        <span className="pack__strip" />
      </>}
      {pack.key === "silver" && <>
        <span className="pack__inner" />
        <span className="pack__wrap">
          <span className="pack__mark">FLUT</span>
          <span className="pack__badge"><span className="live-card__tier-icon live-card__tier-icon--silver" /></span>
          {label}
          <span className="pack__sheen" />
        </span>
      </>}
      {pack.key === "gold" && <>
        <span className="pack__wrap">
          {(["l", "r"] as const).map((side) => (
            <span className={`pack__door pack__door--${side}`} key={side}>
              <span className="pack__doorface">
                <span className="pack__mark">FLUT</span>
                {label}
                <span className="pack__sheen" />
              </span>
            </span>
          ))}
        </span>
        <span className="pack__seal"><span className="clip-pennant" /></span>
      </>}
    </div>
  );
}

function PackPromise({ pack }: { pack: StudyPack }) {
  return pack.floor ? (
    <p className="flex items-center gap-2 text-body font-semibold text-ink">
      <span className={`promise-icon live-card__tier-icon live-card__tier-icon--${pack.floor}`} aria-hidden="true" />
      At least 1 {TIER_NAME[pack.floor]}+
    </p>
  ) : <p className="text-body text-ink-dim">No minimum tier</p>;
}

// -------------------------------------------------------------------- shop ----

export function Notice({ children }: { children: ReactNode }) {
  return <p className="study-notice text-small text-ink-faint">{children}</p>;
}

export function ReviewLinks({ here }: { here: string }) {
  const links = [["index.html", "Launch shop"], ["comparison.html", "All three packs"],
    ["storyboards.html", "Opening storyboards"], ["celebrations.html", "Celebrations"],
    ["history.html", "Older receipts"], ["admin.html", "Admin economy"]].filter(([href]) => href !== here);
  return (
    <nav aria-label="Design review" className="flex flex-wrap gap-x-6 gap-y-1 border-t border-line/60 pt-4">
      {links.map(([href, label]) => (
        <a className={`inline-flex min-h-11 items-center text-small font-semibold text-brass hover:underline ${FOCUS}`} href={href} key={href}>{label} →</a>
      ))}
    </nav>
  );
}

function Offer({ pack, balance, comparison }: { pack: StudyPack; balance: number; comparison: boolean }) {
  const affordable = balance >= pack.price;
  return (
    <article className="pack-offer grid grid-cols-[5.5rem_minmax(0,1fr)] items-center gap-4 rounded-2xl border border-line/60 bg-panel/60 p-4 sm:grid-cols-[minmax(0,1fr)] sm:content-start" data-offer={pack.key}>
      <div className="pack-offer__art"><PackArt pack={pack} /></div>
      <div className="grid min-w-0 gap-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <h2 className="text-heading font-semibold">{pack.title}</h2>
          {comparison && pack.key === "gold" && <Tag tone="out">Off at launch</Tag>}
        </div>
        <p className="text-body text-ink">3 Live Cards</p>
        <PackPromise pack={pack} />
      </div>
      <div className="col-span-2 grid gap-2 sm:col-span-1">
        <Button data-open={pack.key} disabled={!affordable} wide>
          {affordable ? `Open for ${pack.price} coins` : `Need ${pack.price - balance} more coins`}
        </Button>
        <p className="text-small text-ink-dim">
          {affordable ? `Leaves you ${(balance - pack.price).toLocaleString("en-GB")}.` : "Earn coins by attending published sessions."}
        </p>
      </div>
    </article>
  );
}

/** The real BottomSheet, rendered open; the preview script shows one at a time. */
function ConfirmSheet({ pack, balance }: { pack: StudyPack; balance: number }) {
  const promise = pack.floor ? `, at least 1 ${TIER_NAME[pack.floor]}+` : "";
  return (
    <div data-sheet={pack.key} hidden>
      <BottomSheet everyWidth label={`Open a ${pack.title}?`} open onClose={() => {}}>
        <div className="flex items-center gap-4">
          <div className="pack-thumb"><PackArt pack={pack} /></div>
          <h2 className="text-heading font-semibold">Open a {pack.title}?</h2>
        </div>
        <p className="text-body text-ink-dim">
          {pack.price} coins for 3 Live Cards{promise}. You keep {(balance - pack.price).toLocaleString("en-GB")}.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <Button data-cancel kind="secondary">Not now</Button>
          <Button data-pay={pack.key}>Pay {pack.price}</Button>
        </div>
      </BottomSheet>
    </div>
  );
}

export function Shop({ comparison = false }: { comparison?: boolean }) {
  const balance = comparison ? REVIEW_BALANCE : LAUNCH_BALANCE;
  const packs = PACKS.filter((p) => comparison || p.key !== "gold");
  return (
    <Chrome balance={balance}>
      <main className={PAGE}>
        <section className={`${COLUMN} lg:max-w-6xl`}>
          <Notice>{comparison ? "Design review: all three packs. Gold is off at launch, so members won't see it." : "Design preview: launch shop. Example prices and wallet; nothing is charged."}</Notice>
          <PageHeader title="Packs" />
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
            <div className="pack-offers grid gap-4">
              {packs.map((pack) => <Offer balance={balance} comparison={comparison} key={pack.key} pack={pack} />)}
            </div>
            <Block title="The tier ladder">
              <dl className="grid">
                {TIER_BANDS.map(([tier, band]) => (
                  <div className="flex min-h-11 items-center gap-3 border-b border-line/40 last:border-b-0" key={tier}>
                    <span aria-hidden="true" className="tier-chip" data-rarity={tier}>
                      <span className={`live-card__tier-icon--${tier}`} />
                    </span>
                    <dt className="grow text-body font-semibold">{TIER_NAME[tier]}</dt>
                    <dd className="text-small text-ink-dim tabular-nums">OVR {band}</dd>
                  </div>
                ))}
              </dl>
              <InfoLink href="/how-it-works#cards">How tiers work</InfoLink>
            </Block>
          </div>
          <ReviewLinks here={comparison ? "comparison.html" : "index.html"} />
        </section>
      </main>
      {packs.map((pack) => <ConfirmSheet balance={balance} key={pack.key} pack={pack} />)}
    </Chrome>
  );
}

// ----------------------------------------------------------------- opening ----

/** Confetti per tier: none for Common, more and richer up the ladder. */
const BITS: Record<Tier, number> = { common: 0, bronze: 12, silver: 24, gold: 40, holo: 48, elite: 60 };

/**
 * The celebration behind and over a revealed card. Bronze, Silver and Gold
 * burst confetti in their own metal; Holo adds pearl rings; Elite dims the
 * stage, raises still rays and lets gold leaf fall. No flashes, spin or sound.
 */
export function Celebrate({ tier }: { tier: Tier }) {
  if (tier === "common") return null;
  return (
    <span aria-hidden="true" className="celebrate" data-tier={tier}>
      {tier === "elite" && <><span className="celebrate__dim" /><span className="celebrate__rays" /></>}
      <span className="celebrate__glow" />
      {tier === "holo" && <><span className="celebrate__ring" /><span className="celebrate__ring" /></>}
      <span className="celebrate__bits">{Array.from({ length: BITS[tier] }, (_, i) => <i key={i} />)}</span>
    </span>
  );
}

/** A revealed card on the stage, celebrated by its tier. */
export function Revealed({ card, children, className = "" }: { card: LiveCardPlayer; children?: ReactNode; className?: string }) {
  return (
    <div className={`pack-reveal__focus relative w-full max-w-[240px] ${className}`} data-celebrate={card.rarityTier}>
      <Celebrate tier={card.rarityTier} />
      <div className="relative z-[1]"><LiveCard player={card} /></div>
      {children}
    </div>
  );
}

/**
 * PackReveal's three detail steps with its classes. Tier and rating advance
 * on their own; the player waits for a tap, so a good card can be enjoyed.
 */
function RevealStep({ card, step, last }: { card: LiveCardPlayer; step: number; last: boolean }) {
  if (step === 0) return (
    <div className="pack-reveal__focus text-center">
      <p className="pack-reveal__rarity inline-flex items-center gap-2 rounded-full bg-brass/15 px-4 py-2 text-heading font-semibold text-brass">{TIER_NAME[card.rarityTier]}</p>
    </div>
  );
  if (step === 1) return (
    <div className="pack-reveal__focus text-center">
      <p className="text-label font-semibold text-brass">{TIER_NAME[card.rarityTier]}</p>
      <p className="pack-reveal__ovr mt-2 text-figure font-extrabold text-ink">{card.liveOvr}</p>
      <p className="text-label font-semibold text-ink-faint">OVR</p>
    </div>
  );
  return (
    <Revealed card={card}>
      <p className="relative z-[1] mt-3 text-center text-small text-ink-dim">{last ? "Tap to see all three" : "Tap for the next card"}</p>
    </Revealed>
  );
}

/**
 * PackReveal's summary. The receipt is the sub line (stored title and paid
 * price). A card whose tier has moved since shows its opening-time tier, the
 * only extra evidence a member ever needs to see the promise was kept.
 */
export function Summary({ title, price, cards, atOpening, historical = false }: {
  title: string; price: number; cards: LiveCardPlayer[];
  atOpening?: ({ tier: Tier; ovr: number } | null)[]; historical?: boolean;
}) {
  const summary = summaryFor(cards);
  return (
    <div className="pack-reveal grid gap-6">
      <PageHeader title="Your new Live Cards" sub={`${title} · Paid ${price} coins${historical ? "" : ` · ${summary.line}`}`} />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
        {cards.map((card, i) => {
          const chip = historical ? null : summary.chips[i];
          const then = atOpening?.[i];
          return (
            <div className="pack-reveal__summary-card" key={`${card.id}-${i}`}>
              <LiveCard player={card} />
              {chip && <div className="mt-2 flex justify-center"><Tag tone={chip.kind === "new" ? "won" : "neutral"}>{chip.text}</Tag></div>}
              {then && then.tier !== card.rarityTier && (
                <p className="mt-2 text-center text-small text-ink-dim">{TIER_NAME[then.tier]} {then.ovr} when opened</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const SMALL_BUTTON = `min-h-11 rounded-lg border border-line px-3 py-1 font-semibold text-ink-dim hover:text-ink ${FOCUS}`;

function OpeningFor({ pack }: { pack: StudyPack }) {
  const cards = OPENED[pack.key];
  return (
    <div data-duration={pack.duration} data-hold={TIMING.hold} data-opening={pack.key} data-rating={TIMING.rating} data-tier={TIMING.tier} data-title={pack.title} hidden>
      <div className="pack-reveal" data-part="reveal">
        <div className="flex items-center justify-between gap-3 text-small font-semibold text-ink-faint">
          <span aria-live="polite" data-status role="status">{pack.title}</span>
          <button className={SMALL_BUTTON} data-skip type="button">Skip all</button>
        </div>
        <button aria-label={`Open the ${pack.title}`} className={`pack-reveal__stage pack-stage mt-2 w-full cursor-pointer rounded-3xl border ${FOCUS}`} data-pack={pack.key} data-stage type="button">
          <span className="pack-stage__sealed grid justify-items-center" data-sealed>
            <PackArt pack={pack} />
            <span className="pack-stage__hint mt-6 text-small text-ink-dim">Tap to open</span>
          </span>
          {cards.flatMap((card, index) => [0, 1, 2].map((step) => (
            <span className="contents" data-detail={[TIER_NAME[card.rarityTier], `OVR ${card.liveOvr}`, card.displayName][step]} data-index={index} data-step={step} hidden key={`${index}-${step}`}>
              <RevealStep card={card} last={index === cards.length - 1} step={step} />
            </span>
          )))}
        </button>
      </div>
      <div className="grid gap-8 outline-none" data-part="summary" data-summary={pack.key} hidden tabIndex={-1}>
        <Summary cards={cards} price={pack.price} title={pack.title} />
        <div className="grid gap-3 sm:flex sm:justify-center">
          <Button href="/club/collection">View your Collection</Button>
          <Button href="comparison.html" kind="secondary">Open another</Button>
        </div>
        <button className={`${SMALL_BUTTON} justify-self-center text-small`} data-replay type="button">Replay opening</button>
      </div>
    </div>
  );
}

/** `/club/packs/[openingId]`: the fixed receipt is picked by `?receipt=`, as a paid route by its opening id. */
export function Opening() {
  return (
    <Chrome balance={REVIEW_BALANCE}>
      <main className={PAGE}>
        <section className={`${COLUMN} lg:max-w-4xl`}>
          <Notice>Design preview: a fixed example opening. Replay and reload show the same cards.</Notice>
          {PACKS.map((pack) => <OpeningFor key={pack.key} pack={pack} />)}
        </section>
      </main>
    </Chrome>
  );
}

// ------------------------------------------------------------- storyboards ----

function Frame({ n, caption, pack, children }: { n: number; caption: string; pack: StudyPack; children: ReactNode }) {
  return (
    <figure className="story-frame grid min-w-0 content-start gap-2">
      <div className="pack-stage story-stage grid place-items-center rounded-2xl border" data-pack={pack.key}>{children}</div>
      <figcaption className="text-small"><span className="text-ink-faint">{n} · </span>{caption}</figcaption>
    </figure>
  );
}

const seconds = (ms: number) => `${(ms / 1000).toLocaleString("en-GB", { maximumFractionDigits: 1 })} s`;

export function Storyboards() {
  return (
    <Chrome balance={REVIEW_BALANCE}>
      <main className={PAGE}>
        <section className={`${COLUMN} lg:max-w-6xl`}>
          <Notice>Design review: frames 2, 3, 4 and 6 are the real animation, paused.</Notice>
          <PageHeader title="Opening a pack" sub="Tap the pack. It opens its own way, the three backs wait a moment, then each card shows its tier, rating and face on its own. Tap the card for the next." />
          {PACKS.map((pack) => {
            const cards = OPENED[pack.key];
            const best = cards[2];
            return (
              <Block aside={<span className="text-small text-ink-faint tabular-nums">{seconds(pack.duration + TIMING.hold)} to card 1</span>} key={pack.key} title={pack.title}>
                <div className="story-grid grid gap-3">
                  <Frame caption="Tap the pack" n={1} pack={pack}><PackArt pack={pack} /></Frame>
                  <Frame caption={pack.gesture[0]} n={2} pack={pack}><PackArt className="is-opening pack--at-30" pack={pack} /></Frame>
                  <Frame caption={pack.gesture[1]} n={3} pack={pack}><PackArt className="is-opening pack--at-70" pack={pack} /></Frame>
                  <Frame caption={`Three backs, ${seconds(TIMING.hold)}`} n={4} pack={pack}><PackArt className="is-opening is-fanned pack--at-end" pack={pack} /></Frame>
                  <Frame caption="Tier, then rating, on their own" n={5} pack={pack}>
                    <p className="inline-flex items-center rounded-full bg-brass/15 px-4 py-2 text-heading font-semibold text-brass">{TIER_NAME[best.rarityTier]}</p>
                  </Frame>
                  <Frame caption={`${TIER_NAME[best.rarityTier]} celebrated; tap for the next`} n={6} pack={pack}>
                    <Revealed card={best} className="story-revealed celebrate--held" />
                  </Frame>
                  <Frame caption={pack.floor ? `All three; ${TIER_NAME[pack.floor]}+ included` : "All three"} n={7} pack={pack}>
                    <div className="story-cards grid grid-cols-3 gap-1.5">{cards.map((card, i) => <LiveCard key={i} player={card} />)}</div>
                  </Frame>
                </div>
              </Block>
            );
          })}
          <p className="text-small text-ink-dim">A tap during 2–5 jumps ahead to the card. Skip all jumps to 7; reduced motion opens at 7. Replay starts again at 1 without paying.</p>
          <ReviewLinks here="storyboards.html" />
        </section>
      </main>
    </Chrome>
  );
}

// ------------------------------------------------------------ celebrations ----

const CELEBRATION_NOTES: Record<Tier, string> = {
  common: "No celebration. The card simply arrives.",
  bronze: "A small burst of bronze confetti.",
  silver: "More confetti in steel and white; light sweeps the card.",
  gold: "A full gold burst and a warm glow behind the card.",
  holo: "Pearl confetti and two soft iridescent rings.",
  elite: "The stage dims, still rays rise and gold leaf falls slowly.",
};

export function Celebrations() {
  const cards = [P.kim, P.sam, P.robin, P.jesse, P.noor, P.lior];
  return (
    <Chrome balance={REVIEW_BALANCE}>
      <main className={PAGE}>
        <section className={`${COLUMN} lg:max-w-6xl`}>
          <Notice>Design review: each tier&apos;s moment when its card is revealed. No sound.</Notice>
          <PageHeader title="Celebrations" sub="Stronger up the ladder: nothing for Common, something special for Holo and Elite." />
          <div className="celebration-grid grid gap-4">
            {cards.map((card) => (
              <figure className="grid content-start gap-3" key={card.rarityTier}>
                <div className="pack-stage celebration-stage grid place-items-center rounded-3xl border" data-demo={card.rarityTier}>
                  <Revealed card={card} />
                </div>
                <figcaption className="flex items-start justify-between gap-3">
                  <span className="grid gap-1">
                    <span className="text-body font-semibold">{TIER_NAME[card.rarityTier]}</span>
                    <span className="text-small text-ink-dim">{CELEBRATION_NOTES[card.rarityTier]}</span>
                  </span>
                  {card.rarityTier !== "common" && <button className={`${SMALL_BUTTON} flex-none text-small`} data-play={card.rarityTier} type="button">Play again</button>}
                </figcaption>
              </figure>
            ))}
          </div>
          <ReviewLinks here="celebrations.html" />
        </section>
      </main>
    </Chrome>
  );
}

// ----------------------------------------------------------------- history ----

export function History() {
  const fallen = { ...P.jesse, liveOvr: 58, rarityTier: getRarityTier(58) as Tier };
  return (
    <Chrome balance={REVIEW_BALANCE}>
      <main className={PAGE}>
        <section className={`${COLUMN} lg:max-w-4xl`}>
          <Notice>Design review: a Gold pack opened weeks ago. Jesse has dropped to Silver since; the card says what they were when opened.</Notice>
          <Summary atOpening={[null, null, { tier: "gold", ovr: 64 }]} cards={[P.alex, P.kim, fallen]} historical price={750} title="Gold pack" />
          <Notice>An opening from before pack tiers keeps its stored name and price. Opening tiers weren&apos;t recorded, so it shows none.</Notice>
          <Summary cards={[P.kim, P.sam, P.robin]} historical price={175} title="TFH Pack" />
          <ReviewLinks here="history.html" />
        </section>
      </main>
    </Chrome>
  );
}
