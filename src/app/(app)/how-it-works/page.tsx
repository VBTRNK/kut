import Link from "next/link";
import { ARCHETYPES, ARCHETYPE_CHANGE_COOLDOWN_DAYS, ARCHETYPE_LABELS } from "@/game/archetypes";
import { GAME_CONFIG } from "@/game/config";
import { ECONOMY } from "@/game/economy";
import { bracketShape } from "@/game/midweek/bracket";
import { MIDWEEK, PPM } from "@/game/midweek/config";
import { PREDICTION_COINS_CAP, predictionCoins, roundPayouts } from "@/game/midweek/rewards";
import { GOALS_ASSISTS_CUTOVER } from "@/game/reported-count";
import {
  ARCHETYPE_OFFSETS,
  RARITY_BANDS,
  calculateActivityOvr,
  calculateLiveDiscardValue,
} from "@/game/rating-engine";
import { Block } from "@/components/ui/block";
import { PAGE, COLUMN, FOCUS, PageHeader } from "@/components/ui/page";
import { LinkTile } from "@/components/ui/links";
import { requireUser } from "@/lib/auth/user";
import { RATING } from "@/lib/midweek/report/rating-rule";
import {
  lockClock,
  roundIntervalText,
  roundOneClock,
  scheduleVersionOf,
} from "@/lib/midweek/entry";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "How FLUT works" };

const RARITY_INTENT: Record<(typeof RARITY_BANDS)[number]["tier"], string> = {
  common: "Muted, basic frame",
  bronze: "Warm metallic",
  silver: "Silver metallic",
  gold: "Gold metallic",
  holo: "Animated shimmer",
  elite: "Premium animated treatment",
};

const ATTRS = ["pac", "sho", "pas", "dri", "def", "phy"] as const;

/** FAQ topics and stable destinations for help links (DR5-25). */
const TOPICS = [
  { id: "cards", title: "Cards and ratings", state: "Attendance, form, tiers" },
  { id: "packs", title: "Packs and discard", state: "What a pack holds" },
  { id: "market", title: "Market and trading", state: "Buying, offers, wants" },
  { id: "value", title: "Club Value", state: "How the standings count" },
  { id: "midweek", title: "Midweek Madness", state: "Plusses, Power, calls" },
  { id: "privacy", title: "What others see", state: "Your five, your wants" },
] as const;

function Question({
  title,
  id,
  children,
}: {
  title: string;
  id?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className="scroll-mt-20 grid min-w-0 gap-2 border-t border-line/40 pt-3 text-body text-ink-dim [&_strong]:font-semibold [&_strong]:text-ink"
    >
      <h3 className="text-body font-semibold text-ink">{title}</h3>
      {children}
    </section>
  );
}

export default async function HowItWorksPage() {
  await requireUser();
  // The clock of the latest week (ADR-104), so the rules match the week being
  // played; a failed read falls back to the version the next week opens on.
  const supabase = await createClient();
  const { data: midweekCurrent } = await supabase
    .schema("kut")
    .from("midweek_current")
    .select("*")
    .maybeSingle();
  const scheduleVersion = scheduleVersionOf(
    midweekCurrent as { schedule_version?: number | null } | null,
  );
  const lockAtClock = lockClock(scheduleVersion);
  const roundOneAt = roundOneClock(scheduleVersion);

  const activityOvrRows = [10, 27, 48, 80, 100].map((activity) => ({
    activity,
    ovr: Math.round(calculateActivityOvr(activity)),
  }));
  const discardRows = [30, 40, 50, 60, 70, 80].map((ovr) => ({
    ovr,
    value: calculateLiveDiscardValue(ovr),
  }));
  // "28 September 2026": the first football week whose count is G+A (ADR-101).
  const cutoverLabel = new Intl.DateTimeFormat("en-GB", {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(new Date(`${GOALS_ASSISTS_CUTOVER}T00:00:00Z`));
  // Midweek Madness coins per win (§44.7), for a full bracket of each size.
  const midweekPayRows = [4, 8, 16, 32].map((entrants) => ({
    entrants,
    pays: roundPayouts(bracketShape(entrants).rounds),
  }));

  return (
    <main className={`${PAGE} [&_h1]:scroll-mt-20 [&_h2]:scroll-mt-20`}>
      <div className={COLUMN}>
        <PageHeader
          id="top"
          title="How FLUT works"
          sub="Attendance drives every card. Here is how the rest follows."
        />
        <nav aria-label="Topics" className="grid grid-cols-2 gap-3 [&_.truncate]:whitespace-normal">
          {TOPICS.map((topic) => (
            <LinkTile
              href={`#${topic.id}`}
              key={topic.id}
              state={topic.state}
              title={topic.title}
            />
          ))}
        </nav>
        <Block id="cards" title="Cards and ratings">
          <Question title="How does attendance build my rating?">
            <p>
              Attendance builds an Activity Score from 0 to 100. In each football week with a
              published session:
            </p>
            <ul className="ml-5 list-disc space-y-1">
              <li>
                It first decays to {Math.round(GAME_CONFIG.activityWeeklyDecay * 100)}% of its
                previous value.
              </li>
              <li>
                +{GAME_CONFIG.activityFirstAppearance} if you attended at least once that week.
              </li>
              <li>
                +{GAME_CONFIG.activitySecondAppearance} more if you attended a second session
                (Monday and Friday).
              </li>
            </ul>
            <p>
              A week with no TFH session changes nothing &mdash; nobody gains, nobody decays. Miss
              football and your score just decays that week.
            </p>
            <p className="text-body text-ink-dim">
              Showing up also pays: every published session you attend credits{" "}
              {ECONOMY.attendanceCoinReward} FLUT Coins straight to your wallet, with a dated note
              in your{" "}
              <Link className="underline" href="/messages">
                Messages
              </Link>
              . It lands once the admin publishes that session&rsquo;s attendance. Whoever brings
              the bibs to the session gets a one-off +{ECONOMY.bibsCoinBonus} FLUT Coins on top.
            </p>
          </Question>
          <Question title="How does Activity become OVR?">
            <p>
              Your card&rsquo;s activity-based OVR is{" "}
              <code className="font-sans">
                30 + 45 &times; (activity / 100) <sup>0.8</sup>
              </code>
              , then rounded Form is added and the result is rounded. Live OVR is capped between{" "}
              {GAME_CONFIG.liveOvrMin} and {GAME_CONFIG.liveOvrMax}.
            </p>
            <table className="w-full max-w-sm text-left text-small">
              <thead className="text-ink-faint">
                <tr>
                  <th className="py-1 pr-4 text-label font-semibold">Activity</th>
                  <th className="py-1 text-label font-semibold">Approx. OVR</th>
                </tr>
              </thead>
              <tbody>
                {activityOvrRows.map((row) => (
                  <tr key={row.activity} className="border-t border-line/60">
                    <td className="py-1 pr-4">{row.activity}</td>
                    <td className="py-1">{row.ovr}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Question>
          <Question title="How do reports and kudos add Form?" id="form">
            <p>
              Report your goals and assists as one total (G+A) within 24 hours of attendance being
              published, and nominate teammates in three rotating kudos categories. Only the
              combined total is kept. Kudos count when at least two teammates nominate a category
              and at least three reporters give kudos.
            </p>
            <p>
              Newly opened reports after the Safe Hands rollout add a fourth category: who impressed
              you most in goal? You may repeat a regular nominee. One player across both teams wins
              with the outright most nominations, at least two distinct nominators, and at least
              three reporters giving kudos. Tied leaders receive no award. Safe Hands counts as one
              ordinary kudos category; existing reports keep their original three categories.
            </p>
            <p>
              G+A adds up to 1.5 Form: 1 G+A gives 1 Form, 2 give 1.25, and 3 or more give 1.5. One
              recognized kudos category gives 1 Form; two give 1.5 and three or more give 2. A
              single session contributes at most 3.5 Form combined. Each session contribution fades
              across the next four published sessions at 100%, 75%, 50%, 25%, then zero; total Form
              is capped at {GAME_CONFIG.formCap}. Your G+A in the latest published football week
              lifts Shooting (SHO) by 2 each, up to +8, until the next week is published. Completing
              every field, including an explicit zero and Skip choices, pays{" "}
              {ECONOMY.sessionReportReward} FLUT Coins once.
            </p>
            <p>
              Sessions before {cutoverLabel} counted goals only, and keep that meaning: their
              numbers are never relabelled or re-scored. Sessions before self-reporting began retain
              their original weekly goal formula, so historical ratings do not silently change.
            </p>
          </Question>
          <Question title="What happens if I am injured?">
            <p>
              Ask an admin to start <strong>injury mode</strong> from your injury date. In each
              football week you sit out:
            </p>
            <ul className="ml-5 list-disc space-y-1">
              <li>
                A <strong>rehab check-in</strong> appears on Home once that week&rsquo;s session is
                published. You can still do it the following week if you missed it.
              </li>
              <li>
                Checking in pays <strong>{ECONOMY.injuryStipend} FLUT Coins</strong> and keeps your
                Activity where it was, so your OVR doesn&rsquo;t drop for that week.
              </li>
              <li>
                A week you don&rsquo;t check in for decays as normal. Only this week and last week
                can be checked in, so older weeks can&rsquo;t be protected afterwards.
              </li>
            </ul>
            <p>
              Form still fades as usual, so your card settles on its attendance base. Your cards go
              into <strong>plaster, signed by the club</strong>, while it lasts. Injury mode ends by
              itself the first time you play a session again.
            </p>
            <p className="text-body text-ink-dim">
              Coming back pays off too. If you checked in for at least 3 weeks, your first session
              back earns a <strong>comeback boost</strong>: 0.25 Form for every week you checked in,
              up to 2 Form. Like any Form, it fades over your next four sessions.
            </p>
          </Question>
          <Question title="How does OVR set the tier?">
            <table className="w-full max-w-md text-left text-small">
              <thead className="text-ink-faint">
                <tr>
                  <th className="py-1 pr-4 text-label font-semibold">Tier</th>
                  <th className="py-1 pr-4 text-label font-semibold">OVR</th>
                  <th className="py-1 text-label font-semibold">Look</th>
                </tr>
              </thead>
              <tbody>
                {RARITY_BANDS.map((band) => (
                  <tr key={band.tier} className="border-t border-line/60">
                    <td className="py-1 pr-4 font-semibold capitalize">{band.tier}</td>
                    <td className="py-1 pr-4">
                      {band.min}&ndash;{band.max}
                    </td>
                    <td className="py-1">{RARITY_INTENT[band.tier]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p>
              All Live copies of a Player share the current rating and tier. When OVR moves, every
              copy moves with it.
            </p>
            <p>
              Top risers shows the five cards that rose most since the last published football week.
            </p>
          </Question>
          <Question title="What does an archetype change?" id="archetypes">
            <p>
              Your archetype doesn&rsquo;t change your OVR &mdash; it redistributes it across the
              six attributes. There&rsquo;s one for each style of player, including a Goalkeeper
              profile. You can pick your own from{" "}
              <Link className="font-semibold text-brass underline" href="/settings/card">
                your card settings
              </Link>
              .
            </p>
            <p>
              <strong className="text-ink">
                A Player with no linked account gets a new archetype every week.
              </strong>{" "}
              It is drawn at random from all seven, All-rounder and Goalkeeper included, when each
              Midweek Madness week opens, so cards of that Player show different stats from week to
              week. OVR stays the same. Once an account is linked, the archetype stays as it is
              until that member changes it.
            </p>
            <p>
              In Midweek Madness archetypes count as plusses per line instead of these numbers; see{" "}
              <Link className="font-semibold text-brass underline" href="#plusses">
                Your squad&rsquo;s shape
              </Link>
              .
            </p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[26rem] text-left text-small">
                <thead className="text-ink-faint">
                  <tr>
                    <th className="py-1 pr-3 text-label font-semibold">Archetype</th>
                    {ATTRS.map((attr) => (
                      <th key={attr} className="py-1 pr-3 text-label font-semibold">
                        {attr}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ARCHETYPES.map((archetype) => (
                    <tr key={archetype} className="border-t border-line/60">
                      <td className="py-1 pr-3 font-semibold">{ARCHETYPE_LABELS[archetype]}</td>
                      {ATTRS.map((attr) => {
                        const offset = ARCHETYPE_OFFSETS[archetype][attr];
                        return (
                          <td key={attr} className="py-1 pr-3">
                            {offset > 0 ? `+${offset}` : offset}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Question>
          <a
            className={`inline-flex min-h-11 items-center justify-self-start rounded-md text-small font-semibold text-brass hover:underline ${FOCUS}`}
            href="#top"
          >
            Back to the topics ↑
          </a>
        </Block>

        <Block id="packs" title="Packs and discard">
          <Question title="What is in a pack?">
            <p>
              A <strong>TFH Pack</strong> costs {ECONOMY.basicPackPrice} FLUT Coins and gives{" "}
              {ECONOMY.basicPackCardCount} Live Cards. Draws are weighted by rarity, so Common
              players come up far more often than Gold or better. The result is fixed the moment you
              open &mdash; refreshing never rerolls it. Duplicates can happen.
            </p>
            <Link
              className={`inline-flex min-h-11 items-center rounded-md font-semibold text-brass hover:underline ${FOCUS}`}
              prefetch={false}
              href="/club/packs"
            >
              Open a pack &rarr;
            </Link>
          </Question>
          <Question title="What does discarding a card pay?">
            <p>
              Discarding permanently burns a card for a guaranteed payout based on its current OVR (
              <code className="font-sans">
                round(10 &times; 1.08 <sup>OVR&minus;30</sup>)
              </code>
              ). Discard cannot be undone. A card can be discarded unless it has an active market
              listing or is committed to a pending trade offer.
            </p>
            <table className="w-full max-w-xs text-left text-small">
              <thead className="text-ink-faint">
                <tr>
                  <th className="py-1 pr-4 text-label font-semibold">OVR</th>
                  <th className="py-1 text-label font-semibold">Discard value</th>
                </tr>
              </thead>
              <tbody>
                {discardRows.map((row) => (
                  <tr key={row.ovr} className="border-t border-line/60">
                    <td className="py-1 pr-4">{row.ovr}</td>
                    <td className="py-1">{row.value} FLUT Coins</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Question>
          <a
            className={`inline-flex min-h-11 items-center justify-self-start rounded-md text-small font-semibold text-brass hover:underline ${FOCUS}`}
            href="#top"
          >
            Back to the topics ↑
          </a>
        </Block>

        <Block id="market" title="Market and trading">
          <Question title="How do listings and offers work?">
            <p>
              List any card at a buy-now price (within server-set bounds), choosing whether it runs
              for {ECONOMY.listingDurationChoiceHours.join(" or ")} hours. When it sells, a{" "}
              {ECONOMY.marketTaxPercent}% tax (minimum 1 coin) is <strong>burned</strong> &mdash; it
              doesn&rsquo;t go to anyone &mdash; and the seller gets the rest. A listed card is
              locked until it sells, is cancelled, or expires.
            </p>
            <p>
              Instead of paying the buy-now price, you can <strong>make an offer</strong>: some FLUT
              Coins and/or up to {ECONOMY.tradeOfferMaxCards} of your own cards. Everything you
              offer is held in escrow until the seller accepts or declines, or the offer expires
              after {ECONOMY.tradeOfferExpiryHours} hours. Accepting an offer pays the seller the
              coins (minus the same {ECONOMY.marketTaxPercent}% burn), swaps the cards, and cancels
              every other offer on that listing. Your{" "}
              <Link className="font-semibold text-brass underline" href="/market/offers">
                Offers
              </Link>{" "}
              page tracks both sides.
            </p>
            <Link
              className={`inline-flex min-h-11 items-center rounded-md font-semibold text-brass hover:underline ${FOCUS}`}
              prefetch={false}
              href="/market"
            >
              Browse the market &rarr;
            </Link>
          </Question>
          <Question title="How do wanted and available cards work?" id="trading">
            <p>
              Wanted cards stay private. Another member sees your name only when you make a matching
              copy available. Listed cards and cards held in an offer cannot also be available.
            </p>
            <p>
              Contact each other and agree the terms together. The owner can then list the card in
              Market and you can offer cards and/or coins. Listings are public and are never
              reserved, so complete an agreed trade promptly.
            </p>
          </Question>
          <a
            className={`inline-flex min-h-11 items-center justify-self-start rounded-md text-small font-semibold text-brass hover:underline ${FOCUS}`}
            href="#top"
          >
            Back to the topics ↑
          </a>
        </Block>

        <Block id="value" title="Club Value">
          <Question title="How do the standings count my club?">
            <p>Your Club Value is a plain sum of three numbers:</p>
            <ul className="ml-5 list-disc space-y-1">
              <li>your wallet balance in FLUT Coins;</li>
              <li>
                plus each edition&rsquo;s weighted copies: the first contributes 100% of discard
                value, the second 20%, the third 5%, and later copies 0%;
              </li>
              <li>
                plus your linked player&rsquo;s own Live-card discard value, counted{" "}
                <strong>{ECONOMY.personalCardClubWeight}&times;</strong> &mdash; showing up to
                football is the fastest way to grow your club.
              </li>
            </ul>
            <p>
              The{" "}
              <Link className="font-semibold text-brass underline" href="/leaderboard">
                standings
              </Link>
              , under Compete, rank every club by that total, and{" "}
              <Link className="font-semibold text-brass underline" href="/club/value">
                your Club Value page
              </Link>{" "}
              shows the full breakdown card by card.
            </p>
          </Question>
          <a
            className={`inline-flex min-h-11 items-center justify-self-start rounded-md text-small font-semibold text-brass hover:underline ${FOCUS}`}
            href="#top"
          >
            Back to the topics ↑
          </a>
        </Block>

        <Block id="midweek" title="Midweek Madness">
          <Question title="When does the week play?">
            <p>
              Every Wednesday, {MIDWEEK.squadSize} of your cards play a knockout against everyone
              else&rsquo;s. You pick them during the week, the bracket is played the moment squads
              lock, and the results come out round by round that evening.
            </p>
            <ul className="ml-5 list-disc space-y-1">
              <li>
                Pick up to {MIDWEEK.squadSize} cards from your collection,{" "}
                <strong className="text-ink">one per Player</strong>, any time until{" "}
                <strong className="text-ink">Wednesday {lockAtClock}</strong>. Change them as often
                as you like. Where you own two copies of a Player, the stronger one plays.
              </li>
              <li>
                Round 1 comes out at {roundOneAt}, then a round {roundIntervalText(scheduleVersion)}{" "}
                until the final. Every match in play shows its score so far on the hub and the
                bracket; open it to follow it live, chance by chance, and kick by kick in a
                shoot-out. Between rounds, a match whose two clubs are settled has a pre-match: both
                fives with their Power for the week. The chances and each card&rsquo;s day roll come
                at kick-off.
              </li>
              <li>
                No published TFH session the week before, or fewer than {MIDWEEK.minEntrants}{" "}
                entrants, means no tournament that week.
              </li>
            </ul>
          </Question>
          <Question title="What if I do not pick?">
            <p>
              You still play. An <strong className="text-ink">auto squad</strong> of up to{" "}
              {MIDWEEK.squadSize} random Players from your collection takes your place, heavily
              handicapped. It rarely gets far; picking is always better. Empty slots are filled by{" "}
              <strong className="text-ink">trialists</strong>: Common All-rounders at OVR{" "}
              {MIDWEEK.trialist.ovr}, handicapped so a real card always beats one.
            </p>
          </Question>
          <Question title="How plusses work" id="plusses">
            <p>
              Every archetype brings plusses to three lines: attack, midfield and defence. An
              All-rounder brings one to each; every other archetype brings four, strong in one or
              two lines and empty in another. Add up the plusses of your four cards that don&rsquo;t
              play in goal.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full max-w-md text-left text-small">
                <thead className="text-ink-faint">
                  <tr>
                    <th className="py-1 pr-2 text-label font-semibold">Archetype</th>
                    <th className="py-1 pr-2 text-label font-semibold">Attack</th>
                    <th className="py-1 pr-2 text-label font-semibold">Midfield</th>
                    <th className="py-1 text-label font-semibold">Defence</th>
                  </tr>
                </thead>
                <tbody>
                  {ARCHETYPES.map((archetype) => (
                    <tr key={archetype} className="border-t border-line/60">
                      <td className="py-1 pr-2 font-semibold">{ARCHETYPE_LABELS[archetype]}</td>
                      {MIDWEEK.shape.plusses[archetype].map((plusses, line) => (
                        <td
                          key={line}
                          aria-label={`${plusses} ${plusses === 1 ? "plus" : "plusses"}`}
                          className="py-1 pr-2 font-semibold text-brass"
                        >
                          {plusses === 0 ? (
                            <span className="text-ink-faint">&ndash;</span>
                          ) : (
                            "+".repeat(plusses)
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="ml-5 list-disc space-y-1">
              <li>
                <strong className="text-ink">
                  Every line needs at least {MIDWEEK.balance.minPlusses} plusses.
                </strong>{" "}
                Each plus a line falls short costs your whole squad{" "}
                {Math.round((1 - MIDWEEK.balance.shortfallPpm / PPM) * 100)}%.
              </li>
              <li>
                A plus counts about the same in every line, so four specialists who cover all three
                beat four All-rounders, and four of a kind lose to both.
              </li>
              <li>
                <strong className="text-ink">Take a Goalkeeper</strong>: without one, the card with
                the most defence goes in goal and keeps goal much worse. Whoever is in goal adds no
                plusses to the lines.
              </li>
              <li>
                The picker counts your plusses once your five has a Goalkeeper. Without one, who
                stands in goal is only settled at the lock, so it can&rsquo;t yet say which four
                cards count.
              </li>
            </ul>
            <p>
              A week plays each card&rsquo;s archetype as it was when that week opened, so the
              picker never changes under you. Players with no linked account draw a new archetype
              just before each week opens, so look again each week. You can change your own
              archetype once every {ARCHETYPE_CHANGE_COOLDOWN_DAYS} days; in Midweek Madness it
              counts from the next week.
            </p>
          </Question>
          <Question title="How Power works" id="power">
            <p>
              A card&rsquo;s <strong className="text-ink">Power</strong> is its strength this week,
              fixed at the lock from its OVR, form, pick and fitness; 1.00 is an ordinary card. The
              pre-match shows both fives&rsquo; Power before kick-off.
            </p>
            <ul className="ml-5 list-disc space-y-1">
              <li>
                <strong className="text-ink">OVR</strong> counts, but only a little: the gap between
                a Common and a Holo is small.
              </li>
              <li>
                <strong className="text-ink">Form</strong>: each Player gets one roll for the week,
                the same for every squad that fields them.
              </li>
              <li>
                <strong className="text-ink">Pick</strong>: the fewer managers who pick a Player,
                the bigger their boost. Popular picks get a small dent.
              </li>
              <li>
                <strong className="text-ink">Fitness</strong>: an injured Player&rsquo;s Live card
                plays on, at slightly less.
              </li>
              <li>
                <strong className="text-ink">Day</strong>: a fresh roll every match, so upsets
                happen.
              </li>
            </ul>
            <p>
              The Teams tab shows the week&rsquo;s Power times the match&rsquo;s day roll. Longer
              bars mean stronger cards; 1.00 is the ordinary-card tick. Show every factor explains
              the five factors. Goals, assists and each card&rsquo;s{" "}
              <Link className="font-semibold text-brass underline" href="#midweek-ratings">
                rating
              </Link>{" "}
              appear at full time.
            </p>
          </Question>
          <Question title="What do wins pay?">
            <p>
              Every match you win pays FLUT Coins, more each round. A bye counts as a win. The
              champion takes {MIDWEEK.championTotal} in all. Coins are paid after the final.{" "}
              <strong className="text-ink">Your cards are never at stake</strong>: entering
              doesn&rsquo;t move, lock or risk a card, and a result only ever pays coins.
            </p>
            <table className="w-full max-w-md text-left text-small">
              <thead className="text-ink-faint">
                <tr>
                  <th className="py-1 pr-4 text-label font-semibold">Entrants</th>
                  <th className="py-1 text-label font-semibold">Pay per win, round by round</th>
                </tr>
              </thead>
              <tbody>
                {midweekPayRows.map((row) => (
                  <tr key={row.entrants} className="border-t border-line/60">
                    <td className="py-1 pr-4 tabular-nums">up to {row.entrants}</td>
                    <td className="py-1 tabular-nums">{row.pays.join(" · ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Question>
          <Question title="How ratings work" id="midweek-ratings">
            <p id="ratings" className="scroll-mt-20">
              Every card you entered gets a rating out of 10 for each match it plays, the moment
              that match ends, and one for the night once the week is paid: the mean of its matches.
              A bye isn&rsquo;t a match.
            </p>
            <ul className="ml-5 list-disc space-y-1">
              <li>
                Every card starts at {RATING.base}. Goals, assists, saves and blocks add to it, more
                for the harder ones: a goal from a half-chance counts for more than a tap-in, and a
                save for more the bigger the chance it stopped.
              </li>
              <li>
                A win adds {RATING.result} and a defeat takes {RATING.result} off. Each goal your
                side concedes takes a little off, most off the keeper.
              </li>
              <li>
                <strong className="text-ink">A miss never costs the shooter.</strong>
              </li>
              <li>
                Ratings run from {RATING.floor} to {RATING.cap}, with a line about each card&rsquo;s
                night. They&rsquo;re for fun: they pay nothing and change no result.
              </li>
            </ul>
            <p>
              During the night, Your night shows your five&rsquo;s ratings for the match you just
              played. Once the week is paid it shows the night&rsquo;s ratings. Every match report
              shows each card&rsquo;s rating for that match from its full time.
            </p>
          </Question>
          <Question title="How calls work" id="midweek-calls">
            <p id="calls" className="scroll-mt-20">
              Once your own match is lost, you can call the winners of the matches still to come, on
              the Calls page or a match&rsquo;s pre-match. A match opens once both matches before it
              have ended and closes at its kick-off. Until then, tap a name to call it, the other
              name to change it, or the same name again to clear it.
            </p>
            <p>
              Every call that comes true pays {predictionCoins(5)} FLUT Coins with up to 32
              entrants, {predictionCoins(4)} with up to 16, {predictionCoins(3)} with up to 8 and{" "}
              {predictionCoins(2)} with 4, so a night&rsquo;s calls pay at most{" "}
              {PREDICTION_COINS_CAP}. They&rsquo;re paid with your wins after the final. From
              kick-off everyone sees how the club split on a match, never who picked whom.
            </p>
          </Question>
          <Question title="Can the draw be changed?">
            <p>
              Every draw comes from a secret seed fixed before anyone picks. Its fingerprint, the{" "}
              <strong className="text-ink">fairness seal</strong>, is on the page all week, and the
              seed is published after the final so anyone can check it. Nobody, admins included, can
              re-roll a week.
            </p>
          </Question>
          <a
            className={`inline-flex min-h-11 items-center justify-self-start rounded-md text-small font-semibold text-brass hover:underline ${FOCUS}`}
            href="#top"
          >
            Back to the topics ↑
          </a>
        </Block>

        <Block id="privacy" title="What others see">
          <Question title="Who sees my cards and club?">
            <p className="text-body text-ink-dim">
              From {lockAtClock} on the Wednesday, members see the five cards you entered (or your
              auto squad). Form, pick boost and Power appear from the first kick-off; owner and pick
              counts appear once the week is paid. Nobody ever sees the rest of your collection.
              Owner counts are shown only when at least {MIDWEEK.ownerCountMin} members own a
              Player. Don&rsquo;t want to take part?{" "}
              <Link className="underline" href="/settings">
                Opt out in Settings
              </Link>{" "}
              and you&rsquo;re never entered or shown.
            </p>
            <p>
              Midweek shows your club name, the one you set in{" "}
              <Link className="underline" href="/settings">
                Settings
              </Link>
              , wherever your team plays, wins or goes through: the bracket, the match pages, the
              results and the images. Your own name stays where you act: your night, your calls and
              the picker. A trialist is still named after you. Renaming your club renames it on past
              weeks too.
            </p>
            <p>
              After the final, Your night can make two images for the club&rsquo;s group chat: the
              champion poster and your night. They show club, manager and Player names and
              Players&rsquo; photos, so they travel beyond FLUT once you send them. They&rsquo;re
              made on your phone; nothing is uploaded.
            </p>
          </Question>
          <Question title="Who sees my wants and messages?">
            <p>
              Your collection and wanted cards stay private. A listing shows its seller; making a
              matching copy available shows your name to the member who wants it.
            </p>
            <p>
              Your{" "}
              <Link className="font-semibold text-brass underline" href="/messages">
                Messages
              </Link>{" "}
              inbox keeps a private record of your club and market activity &mdash; sales,
              purchases, and coin rewards. Only you can read it.
            </p>
          </Question>
          <a
            className={`inline-flex min-h-11 items-center justify-self-start rounded-md text-small font-semibold text-brass hover:underline ${FOCUS}`}
            href="#top"
          >
            Back to the topics ↑
          </a>
        </Block>
      </div>
    </main>
  );
}
