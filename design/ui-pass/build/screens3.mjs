// The DR5 round 3 boards (flut-ui-pass S3): the rest of the app. Every derived
// number comes from the app's own functions over app-world.mjs: toLiveCardPlayer,
// buildSlots/applyLens/paginate, packSummary, countOwnedCopies/
// ownershipDisplayData, foldActivity/describeFoldedActivity, groupMessages/
// messageTarget/presentNotification, issueStandfirst/formatChronicleDate,
// formatReportedCount, calculateLiveDiscardValue, getRarityTier,
// countdownText, roundOneClock. Invented inputs are listed in app-world.mjs.
import { src, mock, h } from "./source.mjs";
import * as A from "./app-world.mjs";

const X = mock("app.tsx");
const P = mock("pages.tsx");
const { toLiveCardPlayer, toListedCardPlayer } = src("lib/live-card-player.ts");
const album = src("lib/album.ts");
const { packSummary } = src("lib/pack-summary.ts");
const { countOwnedCopies, ownershipDisplayData } = src("lib/market-ownership.ts");
const { MarketOwnership } = src("components/market-ownership.tsx");
const { foldActivity, describeFoldedActivity } = src("lib/activity.ts");
const { groupMessages, messageTarget } = src("lib/messages.ts");
const { presentNotification } = src("lib/notification-copy.ts");
const { issueStandfirst, formatChronicleDate } = src("lib/chronicle.ts");
const { formatReportedCount, countNoun } = src("game/reported-count.ts");
const { formatDate } = src("lib/format.ts");
const entry = src("lib/midweek/entry.ts");
const { lockAt: lockFor } = src("game/midweek/schedule.ts");
const { archetypeLabel } = src("game/archetypes.ts");
const { MIDWEEK } = src("game/midweek/config.ts");

const NO_PHOTOS = new Map();
const card = (row) => toLiveCardPlayer(row, A.INJURED, NO_PHOTOS);
const listed = (row) => toListedCardPlayer(row, A.INJURED, NO_PHOTOS);
const mini = (row) => ({ rarityTier: row.rarity_tier, ovr: row.ovr ?? row.live_ovr, injured: A.INJURED.has(row.player_id ?? row.id) });
const coins = (n) => Number(n).toLocaleString("en-GB");
const at = (path) => {
  globalThis.__mockPath = path;
};
const hoursLeft = (iso) => {
  const h = Math.max(0, Math.round((Date.parse(iso) - A.NOW.getTime()) / 3_600_000));
  return `${h} h left`;
};

// ------------------------------------------------------------------- home ----

const NEXT_LOCK = lockFor("2026-10-12");
const pickCountdown = entry.countdownText(NEXT_LOCK, A.NOW);
const homeRisers = A.RISERS.map((r) => ({
  name: r.display_name,
  meta: `${archetypeLabel(r.archetype)} · OVR ${r.live_ovr}`,
  delta: r.ovr_delta,
  mini: mini(r),
  href: `/players/${r.slug}`,
  player: card(r),
}));
const homeActivity = foldActivity(A.ACTIVITY, 6).map((row) => ({ label: "", text: describeFoldedActivity(row), time: formatDate(row.ts) }));

function home(quiet) {
  at("/");
  const now = quiet
    ? P.HomeEntry({
        title: "Joristown Rovers are champions",
        aside: null,
        line: "You went out in the quarter-finals: +50 paid.",
        button: { label: "Midweek", href: "/midweek" },
        tone: "plain",
      })
    : P.HomeEntry({
        title: "Pick your five",
        aside: h("p", { className: "text-small font-semibold text-brass" }, `Locks ${pickCountdown}`),
        line: `Midweek Madness, ${entry.formatDayDate(NEXT_LOCK.toISOString())}. Not picked yet, so an auto squad would play.`,
        button: { label: "Pick your five", href: "/midweek/pick" },
      });
  return X.HomePage({
    sub: quiet ? "Thu 8 Oct" : "Mon 12 Oct",
    status: quiet ? null : "pick",
    now,
    dueTiles: quiet ? [] : [{ title: "Your report", state: "+50 · closes Thu", href: "/sessions/s-1009/report" }],
    clubValue: coins(A.ME_ROW.club_value),
    rank: `#${A.ME_ROW.rank}`,
    pack: quiet ? { state: "", primary: true } : { state: `${A.PACK.price} coins · ${A.PACK.cards_per_pack} cards`, primary: false },
    risers: homeRisers,
    activity: homeActivity,
    chronicle: {
      title: "This week's Chronicle",
      state: `Week of ${formatChronicleDate(A.WEEKS[0].week_start)} · ${issueStandfirst(A.WEEKS[0].session_count, A.WEEKS[0].appearance_count, A.WEEKS[0].goal_count, A.WEEKS[0].week_start)}`,
    },
  });
}

// -------------------------------------------------------------- collection ----

const albumCards = A.MY_CARDS.map((c) => ({ ...c, live_ovr: c.ovr }));
const slots = album.buildSlots(A.ROSTER, albumCards);
const unique = slots.filter((s) => s.copies.length > 0).length;
const head = { unique, total: slots.length, cards: A.MY_CARDS.length, clubValue: coins(A.ME_ROW.club_value) };

function slotView(slot) {
  const first = slot.copies[0];
  return {
    index: slot.index,
    name: slot.player.display_name,
    href: first ? `/club/collection/${first.card_id}` : `/players/${slot.player.slug}`,
    tier: slot.player.rarity_tier,
    player: first ? card(first) : null,
    copies: slot.copies.length,
    listed: Boolean(first?.active_listing_id),
  };
}

function albumPage(lensValue, label) {
  at("/club/collection");
  const filtered = album.applyLens(slots, album.parseLens(lensValue));
  const { pages, total } = album.paginate(filtered, 1);
  return X.AlbumPage({
    ...head,
    lens: label,
    pageCount: total,
    pages: pages.slice(0, 2).map((s, i) => ({ number: i + 1, slots: s.map(slotView) })),
  });
}

function managePage() {
  at("/club/collection");
  return X.ManagePage({
    ...head,
    rows: A.MY_CARDS.map((c) => ({
      player: card(c),
      href: `/club/collection/${c.card_id}`,
      listed: c.active_listing_id ? `${c.active_listing_price}` : null,
    })),
  });
}

function filterSheet() {
  at("/club/collection");
  const gaps = album.applyLens(slots, album.parseLens("gaps")).length;
  return X.FilterSheetBoard({
    groups: [
      { label: "Show", options: [`All Players ${slots.length}`, `Gaps ${gaps}`, `Specialists ${album.applyLens(slots, album.parseLens("specialists")).length}`], on: `Gaps ${gaps}` },
      { label: "Type", options: ["Any", "All-rounder", "Goalkeeper", "Speedster", "Finisher", "Playmaker", "Defender", "Tank"], on: "Any" },
      { label: "Tier", options: ["Any", "Common", "Bronze", "Silver", "Gold", "Holo", "Elite"], on: "Any" },
    ],
    result: `Show ${gaps} Players`,
  });
}

function tradingPage() {
  at("/club/collection");
  // Wanted (invented choices): two Players Sanne lacks; who has one comes from the listings and availability.
  const gapsList = slots.filter((s) => s.copies.length === 0);
  const [w1, w2] = [gapsList.find((s) => A.LISTINGS.some((l) => l.player_id === s.player.id)) ?? gapsList[0], gapsList[3]];
  const lowest = (pid) => Math.min(...A.LISTINGS.filter((l) => l.player_id === pid).map((l) => l.price));
  const wanted = [w1, w2].map((s, i) => ({
    name: s.player.display_name,
    meta: A.LISTINGS.some((l) => l.player_id === s.player.id)
      ? h("a", { className: "font-semibold text-brass hover:underline", href: `/market?q=${s.player.display_name}` }, `Not in your collection · listed from ${lowest(s.player.id)} ›`)
      : "Not in your collection · no listing",
    owners: i === 1 ? ["Lieke"] : [],
  }));
  const seen = new Map();
  const copies = A.MY_CARDS.slice(0, 6).map((c, i) => {
    const total = A.MY_CARDS.filter((x) => x.player_id === c.player_id).length;
    const n = (seen.get(c.player_id) ?? 0) + 1;
    seen.set(c.player_id, n);
    const name = `${c.display_name}${total > 1 ? ` · copy ${n}` : ""}`;
    if (c.active_listing_id) return { name, state: "Listed", available: false, reason: "Listed cards can’t also be available." };
    return { name, state: i === 1 ? "Available" : "Private", available: i === 1 };
  });
  return X.TradingPage({ ...head, wanted, copies, wantCount: 2, availableCount: 1 });
}

function cardPage() {
  at("/club/collection");
  const c = A.MY_CARDS[0];
  return X.CardPage({
    player: card(c),
    sub: `${archetypeLabel(c.archetype)} · ${c.rarity_tier[0].toUpperCase()}${c.rarity_tier.slice(1)} · OVR ${c.ovr}`,
    discard: c.discard_value,
    listing: c.active_listing_id ? `${c.active_listing_price} coins · ${hoursLeft(c.active_listing_expires_at)}` : null,
    why: [
      { label: "Attendance", value: String(c.ovr) },
      { label: "Form", value: "+0" },
      { label: "Live OVR", value: String(c.ovr) },
    ],
  });
}

// ------------------------------------------------------------------- packs ----

const LADDER = [
  ["common", "under 40"],
  ["bronze", "40 to 49"],
  ["silver", "50 to 59"],
  ["gold", "60 to 69"],
  ["holo", "70 to 79"],
  ["elite", "80 and up"],
].map(([tier, band]) => ({ tier, band }));
const PACK = { title: A.PACK.title, price: A.PACK.price, cards: A.PACK.cards_per_pack };

function revealPage() {
  at("/club/packs");
  const summary = packSummary({
    opened: A.OPENING.map((c) => ({ card_id: c.card_id, player_id: c.player_id })),
    owned: A.MY_CARDS.map((c) => ({ card_id: c.card_id, player_id: c.player_id, discard_value: c.discard_value })),
    roster: A.ROSTER.map((p) => p.id),
  });
  return X.RevealSummaryPage({
    title: A.PACK.title,
    line: summary.line,
    cards: A.OPENING.map((c, i) => ({ player: listed(c), chip: summary.chips[i], href: `/club/collection/${c.card_id}` })),
  });
}

// ------------------------------------------------------------------ market ----

const ownership = countOwnedCopies(A.MY_CARDS);
const incomingOpen = A.OFFERS.filter((o) => !o.is_outgoing && o.status === "active").length;
const marketRows = [...A.LISTINGS, A.MY_LISTING_ROWS[0]].map((l) => ({
  player: listed(l),
  href: `/market/${l.listing_id}`,
  price: l.price,
  seller: `Sold by ${l.seller_display_name}`,
  own: l.seller_id === A.ME,
  ownership: (() => {
    const own = ownershipDisplayData(ownership, l);
    return own ? h(MarketOwnership, { compact: true, ownership: own }) : null;
  })(),
}));

function listingPage() {
  at("/market");
  const l = A.LISTINGS[0];
  const own = ownershipDisplayData(ownership, l);
  return X.ListingPage({
    player: listed(l),
    sub: `${archetypeLabel(l.archetype)} · ${l.rarity_tier[0].toUpperCase()}${l.rarity_tier.slice(1)} · OVR ${l.ovr}`,
    price: l.price,
    discard: l.discard_value,
    seller: l.seller_display_name,
    ownership: own?.text ?? null,
    cards: A.MY_CARDS.filter((c) => !c.active_listing_id).slice(0, 4).map((c) => `${c.display_name} · ${c.ovr}`),
  });
}

function sellingPage() {
  at("/market");
  return X.SellingPage({
    offers: incomingOpen,
    rows: A.MY_LISTING_ROWS.map((l) => {
      const n = A.OFFERS.filter((o) => o.listing_id === l.listing_id && o.status === "active").length;
      return {
        name: l.display_name,
        meta: `${hoursLeft(l.active_listing_expires_at)} · ${n === 0 ? "no offers" : n === 1 ? "1 offer" : `${n} offers`}`,
        price: l.price,
        href: `/market/${l.listing_id}`,
        mini: mini(l),
      };
    }),
  });
}

function offerView(o) {
  const open = o.status === "active";
  return {
    title: `${o.listing_card_name} · ${o.listing_price} asked`,
    meta: o.is_outgoing ? `To ${o.seller_name} · ${open ? `expires ${formatDate(o.expires_at)}` : `answered ${formatDate(o.resolved_at)}`}` : `From ${o.proposer_name} · ${hoursLeft(o.expires_at)}`,
    coins: o.offered_coins,
    cards: o.offered_cards.map((c) => `${c.display_name} (${c.ovr})`),
    status: open ? "Open" : o.status === "declined" ? "Declined" : o.status,
    tone: open ? "you" : "out",
    actions: open ? (o.is_outgoing ? "withdraw" : "respond") : null,
  };
}

function offersPage() {
  at("/market");
  return X.OffersPage({
    offers: incomingOpen,
    incoming: A.OFFERS.filter((o) => !o.is_outgoing).map(offerView),
    sent: A.OFFERS.filter((o) => o.is_outgoing).map(offerView),
  });
}

// ----------------------------------------------------------------- compete ----

function standingsPage() {
  at("/leaderboard");
  return X.StandingsPage({
    rows: A.STANDINGS.map((r) => ({ rank: r.rank, name: r.display_name, club: r.club_name, value: r.club_value, cards: r.card_count, players: r.unique_player_count, you: r.is_current_user })),
  });
}

function playersPage() {
  at("/players");
  return X.PlayersPage({ cards: A.BY_OVR.map((p) => ({ player: card(p), href: `/players/${p.slug}` })) });
}

// --------------------------------------------------------------- chronicle ----

const range = (w) => `${formatChronicleDate(w.week_start)} – ${formatChronicleDate(w.week_end, { day: "numeric", month: "long", year: "numeric" })}`;

function chronicleIndex() {
  at("/chronicle");
  const [latest, ...earlier] = A.WEEKS;
  return X.ChronicleIndexPage({
    count: A.WEEKS.length,
    latest: {
      title: `Week of ${formatChronicleDate(latest.week_start)}`,
      dates: range(latest),
      standfirst: issueStandfirst(latest.session_count, latest.appearance_count, latest.goal_count, latest.week_start),
      href: `/chronicle/${latest.week_start}`,
    },
    earlier: earlier.map((w) => ({
      title: `Week of ${formatChronicleDate(w.week_start)}`,
      meta: `${w.session_count} sessions · ${w.appearance_count} in · ${w.goal_count} ${countNoun(w.week_start)}`,
      href: `/chronicle/${w.week_start}`,
    })),
  });
}

function chronicleWeek() {
  at("/chronicle");
  const w = A.ISSUE.week;
  const weekday = (d) => new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`));
  return X.ChronicleWeekPage({
    title: `Week of ${formatChronicleDate(w.week_start)}`,
    dates: range(w),
    standfirst: issueStandfirst(w.session_count, w.appearance_count, w.goal_count, w.week_start),
    sessions: A.ISSUE.sessions.map((s) => ({
      id: s.id,
      title: weekday(s.session_date),
      aside: `${s.attendees} in · ${s.results.reduce((n, r) => n + (r.effective_goals ?? 0), 0)} ${countNoun(s.session_date)}`,
      bibs: s.bibs,
      reports: `${s.submitted} of ${s.eligible} reports`,
      rows: s.results.map((r) => ({
        name: r.display_name,
        count: r.effective_goals ? formatReportedCount(r.effective_goals, s.session_date) : "—",
        kudos: r.recognized_categories.length ? r.recognized_categories.join(" · ") : null,
        href: `/players/${r.slug}`,
      })),
    })),
    crossings: A.ISSUE.crossings.map((c) => ({ name: c.display_name, from: c.from_tier[0].toUpperCase() + c.from_tier.slice(1), to: c.to_tier[0].toUpperCase() + c.to_tier.slice(1), ovr: c.live_ovr })),
  });
}

// ---------------------------------------------------------------- messages ----

function messagesPage() {
  at("/messages");
  const groups = groupMessages(A.MESSAGES, A.NOW).map((g) => ({
    heading: g.heading,
    rows: g.messages.map(({ message, time }) => {
      const shown = presentNotification(message);
      return { title: shown.title, body: shown.body, time, unread: !message.read_at, href: messageTarget(message, A.MESSAGE_LOOKUPS)?.href ?? null };
    }),
  }));
  return X.MessagesPage({ unread: A.MESSAGES.filter((m) => !m.read_at).length, groups });
}

// ----------------------------------------------------------------- account ----

function settingsPage() {
  at("/settings");
  return X.SettingsPage({ name: "Sanne", username: "sanne", club: "Sanne's Club", round1: entry.roundOneClock(MIDWEEK.schedule.current) });
}

function howPage() {
  at("/how-it-works");
  return X.HowItWorksPage({
    topics: [
      { id: "cards", title: "Cards and ratings", state: "Attendance, form, tiers" },
      { id: "packs", title: "Packs and discard", state: "What a pack holds" },
      { id: "market", title: "Market and trading", state: "Buying, offers, wants" },
      { id: "value", title: "Club Value", state: "How the standings count" },
      { id: "midweek", title: "Midweek Madness", state: "Plusses, Power, calls" },
      { id: "privacy", title: "What others see", state: "Your five, your wants" },
    ],
    section: {
      title: "Midweek Madness",
      parts: [
        { id: "plusses", title: "How plusses work", body: ["Each line needs 3 plusses from the four cards not in goal; every plus short costs the whole five ×0.88."] },
        { id: "power", title: "How Power works", body: ["Power is a card’s strength this week, from its rating, form, pick and fitness, fixed at the lock. 1.00, the tick on each bar, is an ordinary card."] },
        { id: "ratings", title: "How ratings work", body: ["Every card starts at 6 and gains for goals, assists, saves and blocks, more for the harder ones; a win adds 0.4."] },
        { id: "calls", title: "How calls work", body: ["Once you’re out, you can call the winners still to come. A match opens once both matches before it have ended, and closes at its kick-off."] },
      ],
    },
  });
}

// ------------------------------------------------------------------ boards ----

export const PAGES3 = [
  { id: "home", name: "G · Home" },
  { id: "collection", name: "H · Collection" },
  { id: "packs", name: "I · Packs" },
  { id: "market", name: "J · Market" },
  { id: "compete", name: "K · Standings and Players" },
  { id: "news", name: "L · Chronicle and Messages" },
  { id: "account", name: "M · Settings, How it works, sign-in" },
];

export const BOARDS3 = [
  {
    stem: "G1-Home-Due",
    page: "home",
    widths: [320, 412, 1440],
    title: "Home with things due · Mon 12 Oct",
    note: "DR5-17. The kicker goes; a Small date under the Title. One Now block, brass: the soonest thing due (the hub's rules, DR5-16). Then tiles: Club Value and Rank as Figures, Open a pack as a tile while something is due (DR5-7), and anything else due as a brass-text tile (Your report). Top risers as rows with mini cards on a phone, five cards from lg. the Chronicle as a tile of its own with its icon and the issue's standfirst (owner: distinct from the activity rows), then Club activity as plain rows. The risers' lede and `New here? How FLUT works` are cut.",
    body: () => home(false),
  },
  {
    stem: "G2-Home-Quiet",
    page: "home",
    widths: [412],
    title: "Home with nothing due · Thu 8 Oct",
    note: "Nothing is due, so the Midweek block is plain (the champion until Thursday 23:59) and Open a pack becomes the one primary button (DR5-7).",
    body: () => home(true),
  },
  {
    stem: "H1-Collection-Album",
    page: "collection",
    widths: [320, 412, 1440],
    title: "/club/collection, the album",
    note: "DR5-18. Title, one Small line (Players, cards, Club Value as its link), the completion bar, then Album · Manage · Trading. The five lens chips and two menus go into one Filter button (C); a Small line says which lens and page. A page is a block with a Heading and a count; gaps are dashed with the Player's name; ×2 and Listed are Tags. A spread of two pages from lg. Before: the first slot at about 660 px of a 915 px phone; here at about 330 px.",
    body: () => albumPage(undefined, "All Players"),
  },
  {
    stem: "H2-Collection-Filter",
    page: "collection",
    widths: [412],
    title: "The Filter sheet, open",
    note: "The sheet Market already uses (FilterBar's BottomSheet), restyled: a group per field, one row of choice chips each, Clear, and one primary that names the result. The album's Show (All, Gaps, Specialists), Type and Tier; Manage and Market put Tier and Sort here; the Market adds the price range.",
    body: () => filterSheet(),
  },
  {
    stem: "H3-Collection-Manage",
    page: "collection",
    widths: [412],
    title: "/club/collection?view=manage",
    note: "The same header and tabs; the toolbar (search, Filter) instead of chips; Listed as a Tag with its price instead of a tracked capital.",
    body: () => managePage(),
  },
  {
    stem: "H4-Collection-Trading",
    page: "collection",
    widths: [320, 412],
    title: "/club/collection/wanted, Trading",
    note: "Title stays Collection with the Trading tab (was a page title of its own). The intro shortens to the privacy line (D). Wanted as a block of rows, each with where to get it; Add a wanted card opens the sheet (the two long details lists go). Your copies as rows with one button each; a listed copy says why it can't be available. How to complete a trade moves to How trading works ›.",
    body: () => tradingPage(),
  },
  {
    stem: "H5-Card-Detail",
    page: "collection",
    widths: [412],
    title: "/club/collection/[card], a listed card",
    note: "Back link, the name as the Title, a Small line with type, tier and OVR. Why this rating as three insets; List and Discard as blocks with Small lines from the copy audit (D: `25 to 240 coins. The card is locked while listed.`, `This can’t be undone.`). The 30 px sideways scroll here is #295, fixed on its own.",
    body: () => cardPage(),
  },
  {
    stem: "I1-Packs",
    page: "packs",
    widths: [320, 412, 1440],
    title: "/club/packs",
    note: "DR5-19. No kicker, no lede (the coin pill has the balance). The pack keeps its art as a brass block: Heading, the price as a Figure, `3 Live Cards. Duplicates can happen.` (D), the one primary, what it leaves you. The ladder as rows; its foot moves to How tiers work ›.",
    body: () => {
      at("/club/packs");
      return X.PacksPage({ pack: PACK, balance: A.BALANCE, ladder: LADDER });
    },
  },
  {
    stem: "I2-Pack-Confirm",
    page: "packs",
    widths: [412],
    title: "Open a pack: the confirm sheet",
    note: "Today's two-step open, on the scale: a Heading, one Body line, Not now and Pay.",
    body: () => {
      at("/club/packs");
      return X.PackConfirmBoard({ pack: PACK, balance: A.BALANCE });
    },
  },
  {
    stem: "I3-Reveal-Summary",
    page: "packs",
    widths: [320, 412],
    title: "After the reveal: the summary",
    note: "The Title, the pack and packSummary's line in Small; each card's chip as a Tag under it (New · fills slot N, ×N · discards for N). `Pack opening saved — the result was fixed before this reveal.` is cut (D). The reveal itself (tap to flip) keeps its show; S7 moves its labels onto the scale.",
    body: () => revealPage(),
  },
  {
    stem: "J1-Market-Buy",
    page: "market",
    widths: [320, 412, 1440],
    title: "/market, Buy",
    note: "DR5-20. No kicker or lede (the 5% moves to where a seller sets a price). Buy · Selling · Offers (DR5-9, #237), the badge on Offers. The toolbar, then the grid: the price as a Tag on the card, the seller and ownership in Small, Buy as a secondary button (one primary per screen). Your own listing says so.",
    body: () => {
      at("/market");
      return X.MarketBuyPage({ rows: marketRows, offers: incomingOpen });
    },
  },
  {
    stem: "J2-Market-Listing",
    page: "market",
    widths: [412, 1440],
    title: "/market/[listing]",
    note: "Back, the name as Title, type, tier and OVR in Small. Buy now as a block: the price as a Figure, discard value and seller in Small; the Buy button pinned above the tab bar on a phone, as today. Or make an offer as a block; its escrow line stays (needed to act).",
    body: () => listingPage(),
  },
  {
    stem: "J3-Market-Selling",
    page: "market",
    widths: [320, 412],
    title: "/market/selling, your listings (#237)",
    note: "New tab. Your active listings as rows: mini card, name, time left and offers, the price; each opens its listing. No new data: my_collection_cards carries active_listing_price and _expires_at, my_trade_offers carries listing_id. Listing still starts from the card.",
    body: () => sellingPage(),
  },
  {
    stem: "J4-Market-Offers",
    page: "market",
    widths: [320, 412],
    title: "/market/offers",
    note: "No kicker or lede (D: said where you make an offer). On your listings first: an open one is the screen's brass block with Accept as the primary. You sent: open and answered. Coins in Body 600, the cards in a line.",
    body: () => offersPage(),
  },
  {
    stem: "K1-Standings",
    page: "compete",
    widths: [320, 412],
    title: "/leaderboard, Standings",
    note: "DR5-21. Compete's tabs, the Title with one Small line; the 30-word lede moves behind See the maths ›. One table in a block: Label heads, rank in ink (no brass for the top 3: brass means action), your row tinted with a You tag. Cards and Players as columns from sm, in the Small line below it.",
    body: () => standingsPage(),
  },
  {
    stem: "K2-Players",
    page: "compete",
    widths: [412, 1440],
    title: "/players",
    note: "Compete's tabs, the Title with the count in Small, the toolbar, the grid. The lede is cut (D).",
    body: () => playersPage(),
  },
  {
    stem: "L1-Chronicle",
    page: "news",
    widths: [320, 412],
    title: "/chronicle",
    note: "DR5-22. The masthead (4 px brass rules, tracked capitals) becomes the Title and a Small line. The latest issue is a block with its standfirst (issueStandfirst) and Read the issue; earlier issues are link rows.",
    body: () => chronicleIndex(),
  },
  {
    stem: "L2-Chronicle-Week",
    page: "news",
    widths: [412],
    title: "/chronicle/2026-10-05",
    note: "The week as the Title, the standfirst in Body. A block per session: weekday as Heading, attendance and G+A on the right, reports and bibs in Small, rows of name and count (formatReportedCount), kudos in Small. Crossings as rows with tier Tags; its explanation is cut (D).",
    body: () => chronicleWeek(),
  },
  {
    stem: "L3-Messages",
    page: "news",
    widths: [320, 412],
    title: "/messages",
    note: "DR5-23. Four voices per row become two: the title (Body, 600 while unread) and the body in Small, with the time and a New tag on the right. The tracked kicker and the inline `Bracket →` go: the row is the link (C). Groups by day from groupMessages with a Label head. Titles and bodies are the server's wording (presentNotification); the rows are invented.",
    body: () => messagesPage(),
  },
  {
    stem: "M1-Settings",
    page: "account",
    widths: [320, 412],
    title: "/settings",
    note: "DR5-24. Signed in as … moves into the Small line. Club name as a block with Field. Midweek Madness: the switch in the heading, a Tag for the state, the three privacy lines kept and shortened (ADR-091). My card and How FLUT works as link rows; Sign out secondary.",
    body: () => settingsPage(),
  },
  {
    stem: "M2-How-It-Works",
    page: "account",
    widths: [412],
    title: "/how-it-works becomes the FAQ (#233)",
    note: "DR5-25. Topic tiles at the top, an anchor per topic, and every `How … works ›` link in the app lands on one (`#plusses`, `#power`, `#ratings`, `#calls`, `#trading`, ...). Numbered serif sections become blocks with Heading and Body. S8 rewrites the text and closes #233; this board shows the structure and one topic, with today's sentences.",
    body: () => howPage(),
  },
  {
    stem: "M3-Login",
    page: "account",
    widths: [320, 412],
    title: "/login",
    note: "DR5-26. The crest lockup stays as the brand mark, with its own type like the card face (question Q5). Sign in as the Title; the line shortened; the email hint shortened; one primary.",
    body: () => {
      at("/login");
      return X.LoginPage();
    },
  },
  {
    stem: "M4-Welcome",
    page: "account",
    widths: [320, 412],
    title: "/welcome",
    note: "The lockup centred, the Title, the sealed pack with a Label instead of tracked capitals, one Body line, one primary.",
    body: () => {
      at("/welcome");
      return X.WelcomePage();
    },
  },
];
