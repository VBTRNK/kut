// The rest of the app's sample (DR5 round 3, flut-ui-pass S3): the same
// invented world as the Midweek boards (sample.mjs, world.mjs), stored the way
// the member views return it (player_directory, my_collection_cards,
// active_market_listings, my_trade_offers, club_value_leaderboard,
// activity_feed, user_notifications, chronicle_weeks), so the boards can call
// the app's own functions on it. Nothing here is a real member or Player.
//
// Invented inputs, marked where they are made: coin balances, listing prices
// and expiries, the offers, the risers' deltas, the activity and message rows,
// and the Chronicle's sessions. Everything derived (stats, tiers, discard
// values, Club Value, album slots, pack chips, ownership chips, message groups,
// folded activity, standfirsts) comes from the app's functions.
import { src } from "./source.mjs";
import * as W from "./world.mjs";
import { PLAYER_NAMES, MANAGER_NAMES, CLUB_NAMES } from "./sample.mjs";

const { getRarityTier, calculateLiveDiscardValue, ARCHETYPE_OFFSETS } = src("game/rating-engine.ts");

export const NOW = new Date("2026-10-12T12:00:00+02:00");
export const ME = W.SANNE;
const S = W.S;
const account = (id) => S.account(id);

// ------------------------------------------------------------ the directory ----

const clamp = (v) => Math.min(Math.max(v, 1), 99);
const slugOf = (name) => name.toLowerCase().replace(/[^a-z]+/g, "-").replace(/-$/, "");
const nameOf = (playerId) => PLAYER_NAMES[Number(playerId.slice(1))];

/** A `kut.player_directory` row: stats are OVR plus the archetype's offsets (rating-engine). */
export function directoryRow(p) {
  const off = ARCHETYPE_OFFSETS[p.archetype];
  return {
    id: p.playerId,
    slug: slugOf(nameOf(p.playerId)),
    display_name: nameOf(p.playerId),
    archetype: p.archetype,
    photo_path: null,
    live_ovr: p.ovr,
    pac: clamp(p.ovr + off.pac),
    sho: clamp(p.ovr + off.sho),
    pas: clamp(p.ovr + off.pas),
    dri: clamp(p.ovr + off.dri),
    def: clamp(p.ovr + off.def),
    phy: clamp(p.ovr + off.phy),
    rarity_tier: getRarityTier(p.ovr),
  };
}

export const DIRECTORY = S.world.players.map(directoryRow);
const DIR = new Map(DIRECTORY.map((row) => [row.id, row]));
/** The album's order (`buildSlots`): by name. */
export const ROSTER = [...DIRECTORY].sort((a, b) => a.display_name.localeCompare(b.display_name) || a.id.localeCompare(b.id));
/** By OVR, as the directory page orders it. */
export const BY_OVR = [...DIRECTORY].sort((a, b) => b.live_ovr - a.live_ovr || a.display_name.localeCompare(b.display_name));
export const INJURED = new Set(["p04", "p17"]);

// ------------------------------------------------------------- collections ----

/** A `kut.my_collection_cards` row for an owned engine card. */
function collectionRow(card, listing = null) {
  const d = DIR.get(card.playerId);
  return {
    card_id: card.cardId,
    edition_id: `e-${card.playerId}`,
    edition_title: `${d.display_name} Live`,
    edition_type: "live",
    is_live: true,
    source: "pack",
    player_id: card.playerId,
    player_slug: d.slug,
    display_name: d.display_name,
    archetype: d.archetype,
    ovr: d.live_ovr,
    pac: d.pac,
    sho: d.sho,
    pas: d.pas,
    dri: d.dri,
    def: d.def,
    phy: d.phy,
    rarity_tier: d.rarity_tier,
    discard_value: calculateLiveDiscardValue(d.live_ovr),
    active_listing_id: listing?.id ?? null,
    active_listing_price: listing?.price ?? null,
    active_listing_expires_at: listing?.expires ?? null,
    held_by_offer_id: null,
    photo_path: null,
  };
}

const ownedOf = (userId) => S.entrants.find((e) => e.userId === userId).owned;

// Sanne's two listings: invented prices and expiries.
const MY_LISTINGS = {
  [ownedOf(ME)[0].cardId]: { id: "l-mine-1", price: 60, expires: "2026-10-14T05:00:00Z" },
  [ownedOf(ME)[3].cardId]: { id: "l-mine-2", price: 45, expires: "2026-10-12T19:00:00Z" },
};
export const MY_CARDS = ownedOf(ME)
  .map((card) => collectionRow(card, MY_LISTINGS[card.cardId]))
  .sort((a, b) => b.ovr - a.ovr || a.display_name.localeCompare(b.display_name));

// ------------------------------------------------------------------ market ----

// Other members' listings: invented prices (about 1.6 to 3 times the discard value).
const LISTED = [
  ["Joris", 0, 2.4, "2026-10-12T09:40:00Z"],
  ["Ruben", 2, 1.8, "2026-10-12T08:05:00Z"],
  ["Maarten", 5, 2.2, "2026-10-11T21:10:00Z"],
  ["Laura", 1, 3.0, "2026-10-11T17:30:00Z"],
  ["Sophie", 4, 1.6, "2026-10-11T12:00:00Z"],
  ["Mila", 3, 2.0, "2026-10-10T19:45:00Z"],
  ["Rick", 6, 2.5, "2026-10-10T10:20:00Z"],
  ["Lieke", 2, 1.9, "2026-10-09T20:00:00Z"],
];

/** `kut.active_market_listings` rows, newest first (the Buy tab's default sort). */
export const LISTINGS = LISTED.map(([seller, nth, mult, listedAt], i) => {
  const userId = W.idOf(seller);
  const strongest = [...ownedOf(userId)].sort((a, b) => b.ovr - a.ovr);
  const card = strongest[Math.min(nth * 3, strongest.length - 1)];
  const row = collectionRow(card);
  return {
    ...row,
    listing_id: `l-${i}`,
    price: Math.round((row.discard_value * mult) / 5) * 5,
    seller_id: userId,
    seller_display_name: seller,
    listed_at: listedAt,
  };
});
export const MY_LISTING_ROWS = MY_CARDS.filter((c) => c.active_listing_id).map((c) => ({
  ...c,
  listing_id: c.active_listing_id,
  price: c.active_listing_price,
  seller_id: ME,
  seller_display_name: "Sanne",
}));

// Offers (invented): one on Sanne's first listing, one she sent.
const target = MY_LISTING_ROWS[0];
const joris = [...ownedOf(W.idOf("Joris"))].sort((a, b) => a.ovr - b.ovr)[4];
export const OFFERS = [
  {
    offer_id: "o-in-1",
    listing_id: target.listing_id,
    status: "active",
    offered_coins: 35,
    created_at: "2026-10-12T07:15:00Z",
    expires_at: "2026-10-12T19:15:00Z",
    resolved_at: null,
    coins_to_seller: null,
    is_outgoing: false,
    proposer_name: "Joris",
    seller_name: "Sanne",
    listing_card_name: target.display_name,
    listing_price: target.price,
    offered_cards: [{ card_id: joris.cardId, display_name: nameOf(joris.playerId), ovr: joris.ovr, rarity_tier: getRarityTier(joris.ovr) }],
  },
  {
    offer_id: "o-out-1",
    listing_id: LISTINGS[5].listing_id,
    status: "active",
    offered_coins: Math.round(LISTINGS[5].price * 0.8),
    created_at: "2026-10-11T20:02:00Z",
    expires_at: "2026-10-12T20:02:00Z",
    resolved_at: null,
    coins_to_seller: null,
    is_outgoing: true,
    proposer_name: "Sanne",
    seller_name: LISTINGS[5].seller_display_name,
    listing_card_name: LISTINGS[5].display_name,
    listing_price: LISTINGS[5].price,
    offered_cards: [],
  },
  {
    offer_id: "o-out-0",
    listing_id: "l-old",
    status: "declined",
    offered_coins: 40,
    created_at: "2026-10-08T18:00:00Z",
    expires_at: "2026-10-09T06:00:00Z",
    resolved_at: "2026-10-08T21:30:00Z",
    coins_to_seller: null,
    is_outgoing: true,
    proposer_name: "Sanne",
    seller_name: "Ruben",
    listing_card_name: LISTINGS[1].display_name,
    listing_price: LISTINGS[1].price,
    offered_cards: [],
  },
];

// --------------------------------------------------------------- standings ----

// Coins are invented (wallets); Club Value adds every card's discard value (ADR-057's rule, minus a linked Player).
const COINS = [1240, 2310, 860, 410, 1730, 2950, 640, 520, 300, 1100, 380, 3400, 900, 220, 760, 450, 2080, 1500, 1980, 260, 700, 830];
export const BALANCE = COINS[0];
export const STANDINGS = S.entrants
  .map((e, i) => {
    const cards = e.owned;
    return {
      display_name: account(e.userId),
      club_name: CLUB_NAMES[account(e.userId)],
      club_value: COINS[i] + cards.reduce((sum, c) => sum + calculateLiveDiscardValue(c.ovr), 0),
      card_count: cards.length,
      unique_player_count: new Set(cards.map((c) => c.playerId)).size,
      is_current_user: e.userId === ME,
    };
  })
  .sort((a, b) => b.club_value - a.club_value || a.display_name.localeCompare(b.display_name))
  .map((row, i) => ({ ...row, rank: i + 1 }));
export const ME_ROW = STANDINGS.find((r) => r.is_current_user);

// ------------------------------------------------------------------ risers ----

// `kut.top_risers`: the deltas are invented.
export const RISERS = [BY_OVR[3], BY_OVR[8], BY_OVR[12], BY_OVR[17], BY_OVR[21]].map((row, i) => ({ ...row, ovr_delta: [4, 3, 3, 2, 2][i] }));

// ---------------------------------------------------------------- activity ----

// `kut.activity_feed` rows (invented events among invented members).
const A = (kind, ts, actor, extra = {}) => ({
  kind,
  ts,
  actor_name: actor,
  counterparty_name: null,
  card_name: null,
  amount: null,
  session_date: null,
  session_type: null,
  offered_card_names: null,
  ...extra,
});
export const ACTIVITY = [
  A("pack", "2026-10-12T09:58:00Z", "Ruben", { amount: 250 }),
  A("pack", "2026-10-12T09:57:00Z", "Ruben", { amount: 250 }),
  A("pack", "2026-10-12T09:55:00Z", "Ruben", { amount: 250 }),
  A("listing", "2026-10-12T09:40:00Z", "Joris", { card_name: LISTINGS[0].display_name, amount: LISTINGS[0].price }),
  A("sale", "2026-10-11T22:12:00Z", "Mila", { counterparty_name: "Laura", card_name: "Esther M.", amount: 140 }),
  A("session", "2026-10-11T18:00:00Z", null, { session_date: "2026-10-09", session_type: "regular" }),
  A("trade", "2026-10-11T16:30:00Z", "Koen", { counterparty_name: "Tim", card_name: "Pim L.", amount: 30, offered_card_names: ["Roos N."] }),
  A("pack", "2026-10-11T12:00:00Z", "Sophie", { amount: 250 }),
];

// ---------------------------------------------------------------- messages ----

// `kut.user_notifications` rows; titles and bodies follow the server's wording.
const M = (id, type, title, body, created, read, ref = [null, null]) => ({
  id,
  event_type: type,
  title,
  body,
  reference_type: ref[0],
  reference_id: ref[1],
  read_at: read ? created : null,
  created_at: created,
});
export const MESSAGES = [
  M("m1", "trade_offer", "New trade offer", `Joris offered 35 FLUT Coins and 1 card for ${target.display_name}.`, "2026-10-12T07:15:00Z", false, ["trade_offer", "o-in-1"]),
  M("m2", "kudos_awarded", "Kudos awarded", "You were recognised as Engine for Friday's session.", "2026-10-12T06:30:00Z", false, ["match_session", "s-1009"]),
  M("m3", "session_results", "Session report ready", "Reported goals and recognized kudos are now in the Chronicle.", "2026-10-11T18:00:00Z", false, ["match_session", "s-1009"]),
  M("m4", "midweek_result", "Midweek Madness", "Out in the quarter-finals. +50 FLUT Coins paid.", "2026-10-07T19:15:00Z", true, ["midweek_tournament", W.TOURNAMENT]),
  M("m5", "attendance_reward", "Attendance reward", "+40 FLUT Coins for Monday's session.", "2026-10-06T19:00:00Z", true, ["match_session", "s-1005"]),
  M("m6", "market_sale", "Card sold", "Your Floor J. sold for 55 FLUT Coins. You received 52 after the 5% burn.", "2026-10-05T20:40:00Z", true, ["wallet", null]),
];
export const MESSAGE_LOOKUPS = { weekByTournament: new Map([[W.TOURNAMENT, W.WEEK_START]]), ownedCardBySale: new Map() };

// --------------------------------------------------------------- chronicle ----

// `kut.chronicle_weeks` rows and one issue's sessions (invented).
export const WEEKS = [
  { week_start: "2026-10-05", week_end: "2026-10-11", session_count: 2, appearance_count: 31, goal_count: 46 },
  { week_start: "2026-09-28", week_end: "2026-10-04", session_count: 2, appearance_count: 29, goal_count: 41 },
  { week_start: "2026-09-21", week_end: "2026-09-27", session_count: 1, appearance_count: 15, goal_count: 19 },
  { week_start: "2026-09-14", week_end: "2026-09-20", session_count: 2, appearance_count: 30, goal_count: 22 },
  { week_start: "2026-09-07", week_end: "2026-09-13", session_count: 2, appearance_count: 27, goal_count: 25 },
];
const res = (i, ga, kudos = []) => ({ player_id: `p${String(i).padStart(2, "0")}`, display_name: PLAYER_NAMES[i], slug: slugOf(PLAYER_NAMES[i]), effective_goals: ga, recognized_categories: kudos });
export const ISSUE = {
  week: WEEKS[0],
  sessions: [
    {
      id: "s-1005",
      session_date: "2026-10-05",
      session_type: "regular",
      bibs: PLAYER_NAMES[7],
      submitted: 14,
      eligible: 16,
      results: [res(6, 5, ["Engine"]), res(1, 4), res(19, 3, ["Playmaker"]), res(9, 3), res(13, 2), res(3, 2), res(25, 1), res(11, 1), res(15, 0), res(22, 0)],
      attendees: 16,
    },
    {
      id: "s-1009",
      session_date: "2026-10-09",
      session_type: "regular",
      bibs: null,
      submitted: 12,
      eligible: 15,
      results: [res(1, 6, ["Engine"]), res(19, 4), res(6, 3), res(28, 3, ["Playmaker"]), res(9, 2), res(3, 2), res(13, 1), res(25, 0)],
      attendees: 15,
    },
  ],
  crossings: [
    { player_id: "p06", display_name: PLAYER_NAMES[6], slug: slugOf(PLAYER_NAMES[6]), from_tier: "silver", to_tier: "gold", live_ovr: 60 },
    { player_id: "p19", display_name: PLAYER_NAMES[19], slug: slugOf(PLAYER_NAMES[19]), from_tier: "bronze", to_tier: "silver", live_ovr: 50 },
  ],
};

// ------------------------------------------------------------------- packs ----

export const PACK = { slug: "tfh-pack", title: "TFH Pack", price: 250, cards_per_pack: 3 };
/** One opening: Sanne's three newest cards (her owned list's tail) as `my_pack_opening_results` rows. */
export const OPENING = ownedOf(ME)
  .slice(-3)
  .map((card, slot) => ({ ...collectionRow(card), slot: slot + 1, pack_title: PACK.title, opening_id: "op-1", price_paid: PACK.price }));

export { nameOf, slugOf, MANAGER_NAMES };
