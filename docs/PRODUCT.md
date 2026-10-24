# FLUT product reference

Current behaviour and code by area.
`BUILD_SPEC §N` and ADR-001–141 live at tag `docs-archive-2026-10`;
New ADRs: `docs/decisions.md`; open work: GitHub issues.

Ground rules for every area:

- **SQL is authoritative.** Economy and ratings run in schema `kut`, never
  client writes. `src/game/` holds display constants/helpers; only Midweek has
  a TS engine twin checked against golden vectors (ADR-064).
- **Part L** (`docs/INVARIANTS.md`, 1–31): a change needs an ADR, a spec
  update and its own PR.
- **Values:** `src/game/{config,economy,midweek/config}.ts` mirrors SQL;
  change migrations and constants together.
- **Reads:** member projections require `kut.is_active_member()` (ADR-079);
  never flip to `security_invoker` (KB-013). Tests: `supabase/tests/database/`
  and `tests/integration/`.
- **No scheduler.** Surveys, Midweek and offer expiry run from page visits via
  idempotent `for update skip locked` workers (ADR-061, ADR-098).
- **UI:** six roles in `src/components/ui/`, enforced by `policy:check`.
  The type ceiling is zero outside cards/crest. How it works is a six-topic FAQ
  with help anchors (ADR-161); nav/card lists/filters disable prefetch (ADR-157).

| If you are changing… | Read |
| --- | --- |
| pack price, odds, starter, discard, wallet, Club Value | [Packs and economy](#packs-and-economy) |
| listings, buying, offers, wants | [Market and trades](#market-and-trades) |
| OVR, Form, attributes, tiers, G+A | [Ratings](#ratings-form-and-ga) |
| sessions, attendance, rewards, Chronicle | [Attendance](#attendance-and-the-chronicle) |
| post-session report, kudos | [Reports and kudos](#reports-and-kudos) |
| anything on `/midweek` | [Midweek Madness](#midweek-madness) |
| Special cards, Groundmasters | [Specials](#specials-and-groundmasters) |
| injury, rehab check-in, plaster cast | [Injury mode](#injury-mode) |
| Talents, promotion, At risk, Retired, credits | [Academy](#academy-and-roster-lifecycle) |
| inbox, Home "now" cards, activity feed | [Notifications](#notifications-and-home) |
| `/admin/*` | [Admin](#admin) |
| who sees what, photos, invites | [Privacy](#privacy-consent-and-accounts) |
| names, domain, redirect | [FLUT name and domain](#flut-name-and-domain) |

## Packs and economy

**Behaviour.**
- One currency, FLUT Coins (ADR-034, renamed in ADR-137). Every change is a
  `wallet_ledger` row with a reason.
- Faucets: the starter grant (250 coins and 3 distinct Live cards, once),
  attendance (250 per session), the bibs bonus (100), a session report (50),
  the injury stipend (100 a week), Midweek wins and calls, audited admin grants.
- Sinks: packs, and the 5% market tax, which is burned.
- Packs hold 3 Live cards, weighted by current tier: Common 100, Bronze 60,
  Silver 30, Gold 12, Holo 4, Elite 1 per eligible Player. Regular (`tfh-pack`)
  starts at **250**; Silver 500 / Gold 750 guarantee 1 Silver+ / Gold+
  (ADR-164). Prices/premium availability are manual settings. `open_pack`
  needs the quoted price and an idempotency key.
- Discard burns a copy for `round(10 × 1.08^(OVR − 30))`, computed by the server
  at the moment of discard.
- Club Value (`/club/value`, Standings) is coins + owned discard value + 4× the
  discard value of the member's own linked Player. Duplicates of one edition
  count 100/20/5/0% (v3, ADR-056). Discard always pays in full.
- Collection (ADR-158): summary bar and Album · Manage · Trading (wants, an
  add sheet, copy controls); Filter holds lenses and sort; summary errors omit
  counts (#309). Cards have rating insets and listing/discard blocks.
- Standings has ink ranks and a You tag; phones show club names, with Cards
  and Players columns from `sm`. Club Value uses breakdown blocks (ADR-160).
- Packs (ADR-163): own art and promise; openings start sealed; receipts keep
  title, price paid and tier when opened.
- The starter reveal on `/welcome` is cosmetic. The grant already happened in
  `claim_invitation` (ADR-031).

**Part L:** 2, 4, 5, 6, 7, 8, 10, 11.

**Where.**
- `open_pack(text, bigint, uuid)`, `admin_apply_pack_settings`, `discard_card`,
  `card_discard_value`, `claim_invitation`, `grant_starter_pack`,
  `mark_starter_opened`; `admin_pack_economy` (admin).
- Views: `my_collection_cards`, `my_pack_opening_results`, `my_club_value*`,
  `club_value_leaderboard`, `pack_economy_health` (admin).
- `scripts/measure-pack-ev.mjs` reads each pack's expected value from SQL.
- `src/lib/packs.ts`, `pack-summary.ts`, `album.ts` (a paged book, ADR-048).

**History.** Pack 175 → 250 (ADR-057, ADR-136); attendance reward 75 → 250
(ADR-029); Club Value v3 discounts duplicates (ADR-056); all cards trade (ADR-033).

## Market and trades

**Behaviour.**
- **Listings.** Buy-now, 24/72 hours (ADR-072). `get_listing_bounds` enforces:
  - minimum `max(1, floor(0.8 × discard))`;
  - maximum `max(100, ceil(5 × reference value))`;
  - listed cards stay owned; no discard, re-list or offer.
- **Buying.** `buy_listing` atomically debits the buyer, pays the seller minus
  5%, moves the card, records the sale and notifies both (ADR-019).
- **Reference value.** Median of ≥5 sales in 14 days, clamped to 1–6× discard;
  otherwise 1.5× discard.
- **Trade offers** (ADR-042, `/market/[listingId]`):
  - coins and/or up to 3 cards, escrowed when proposed, at most 10 active;
  - they expire after 12 h;
  - acceptance swaps atomically and refunds other offers;
  - accepted trades never enter `market_sales`.
- **Wants.** 100 private wants, 30 available copies (ADR-058); matches show
  the owner's display name and a copyable prompt.
- **UI** (ADR-159/161): Buy (tier/price/sort in a sheet) · Selling (time left,
  offers; list/cancel on the Collection card) · Offers (incoming/sent). Listings
  keep a phone-pinned Buy, escrow notice, discard value (ADR-103) and ownership
  across copies (ADR-100/102).

**Part L:** 1, 2, 3, 4, 5, 20, 22, 23.

**Where.**
- `create_listing(uuid, bigint, integer)`, `cancel_listing`, `buy_listing`,
  `propose_trade`, `respond_to_trade`, `withdraw_trade`,
  `expire_trade_offers` (lazy, from the market pages),
  `market_reference_value`, `set_card_want`, `set_trade_availability`.
- Views: `active_market_listings` (has `seller_id` and `discard_value`),
  `my_trade_offers`, `my_wanted_cards`, `my_trade_cards`.
- Races: `tests/integration/{market,trade}-race.test.ts`;
  ownership: `src/lib/market-ownership.ts`.

## Ratings, Form and G+A

**Behaviour.**
- Ratings are rebuilt deterministically from history by
  `kut._rebuild_season_core`, never incremented.
- **Activity** (0–100) is decayed and topped up per football week (ISO Monday
  to Sunday):
  - ×0.90 each week;
  - +14 for one appearance, +17 for two or more;
  - weeks without a published session are skipped entirely.
- **activity OVR** = `30 + 45 × (activity/100)^0.8`.
- **Form** (0–8):
  - From the season's v2 cutover (TFH 2026: week of 7 Sep), Form is the sum of
    per-session inputs from member reports, weighted 1/.75/.5/.25/0 by session
    age.
  - Each input is the G+A score plus the kudos score, capped at 3.5.
  - G+A scores 0/1/1.25/1.5 for 0/1/2/3+.
  - Kudos score 0/1/1.5/2 for 0/1/2/3+ recognised categories, including Safe
    Hands on new ballots (ADR-162); no separate keeper bonus.
  - Earlier sessions keep the v1 weekly goal formula (§13.1).
- **Live OVR** = `clamp(round(activity OVR + round(Form)), 30, 83)`.
- **Tiers:** Common 30–39, Bronze 40s, Silver 50s, Gold 60s, Holo 70s,
  Elite 80–83.
- **Attributes** are OVR plus the archetype offsets (seven archetypes; each
  offset set sums to 0). SHO gets `+min(8, 2 × last week's count)`.
- Every Live copy of a Player shows the same current stats.
- Rating story, breakdown and tier-band history explain Form (ADR-047/074/076).

**Part L:** 12, 13, 15, 16.

**Where.**
- `_rebuild_season_core`, `rebuild_season`, `capture_rating_snapshot`
  (weekly snapshots, `top_risers`), `season_rating_rules`.
- Views: `public_live_ratings`, `player_rating_breakdown`,
  `player_form_contributions`.
- `src/game/rating-engine.ts` (display helpers only),
  `src/game/archetypes.ts`, `src/lib/rating-story.ts`.
- Tests: `rating_breakdown.test.sql`, `goals_assists_cutover.test.sql`.

**History.**
- **Goals → G+A (ADR-101):** from **28 Sep 2026**, one combined integer;
  earlier sessions keep goals-only meaning/labels, without backfill.
  `goals`/`p_goals`/`effective_goals` remain compatibility names. Cutover:
  `GOALS_ASSISTS_CUTOVER` (`src/game/reported-count.ts`), SQL
  `kut._uses_combined_count`, pinned by tests. Midweek statistics are separate.
- Archetype self-service is limited to once per 336 hours, admins exempt
  (ADR-094).

## Attendance and the Chronicle

**Behaviour.**
- An admin records a session (`monday`, `friday` or `other`) with its
  attendees, the bibs bringer, and G+A for attendees without an account, then
  publishes it.
- Only published sessions count. Publishing:
  - rebuilds ratings;
  - pays each linked attendee the attendance reward once, with an inbox
    message;
  - pays the bibs bonus once per (session, Player);
  - opens the session report.
- Corrections are audited (ADR-007). A bibs reassignment pays the new
  bringer; the previous one keeps theirs.
- A session is never deleted: cancel and reactivate (ADR-008, ADR-009). A
  cancelled session does not count as a football week.
- The **Chronicle** (`/chronicle`, `/chronicle/[week]`) has one issue per
  football week (ADR-049). It shows finalized per-player results. While a
  report is open it shows only aggregate progress, marked provisional
  (ADR-060). The index has a latest block and earlier link rows; issues use
  session blocks and tier tags (ADR-160). `/sessions` redirects there.

**Part L:** 5, 9, 15, 16, 17, 21.

**Where.**
- `publish_attendance_session`, `correct_published_attendance_session`,
  `cancel_published_session`, `reactivate_cancelled_session`,
  `process_published_session_rewards`, `grant_attendance_rewards`,
  `grant_bibs_reward`.
- Views: `published_sessions`, `chronicle_*`.
- `src/lib/chronicle.ts`, `src/game/football-week.ts`.

## Reports and kudos

**Behaviour.**
- Publishing opens a **24-hour report** for each linked attendee
  (`/sessions/[sessionId]/report`, the Home "now" card).
- Members report G+A and distinct nominees (or Skip) in three rotating
  categories. Unanswered is not Skip (ADR-068).
- New reports add **Safe Hands** last: “Who impressed you most in goal?” It may
  repeat a regular nominee; any other attendee qualifies, no statistics needed.
  Desktop puts G+A/actions beside kudos; phones stack them (ADR-162).
- A complete form (zero G+A and skipped kudos included) pays **50 once**.
  A submitted report never goes back to draft (ADR-078).
- **At finalization:**
  - a category is recognised when at least two distinct teammates nominated
    it, and only once at least three reporters gave kudos;
  - Safe Hands: one outright leader across both teams, ≥2 distinct submitted
    nominators, same participation gate; ties get nothing. Ordinary scoring;
  - results and rating snapshots are versioned and the ratings rebuilt;
  - each linked attendee gets `session_results`;
  - each recognised Player gets `kudos_awarded`, which names the categories
    and the OVR change, never the nominators (ADR-069).
- Ballots and per-player provisional values stay private until then.
- Admins can correct G+A (never pays) or close early, both with a reason;
  early closure preserves `closes_at` (ADR-067).

**Part L:** 4, 5, 16. Paid-once reward: ADR-059.

**Where.**
- `submit_session_report`, `finalize_session_surveys` → `_finalize_one_session`,
  `admin_correct_session_goals`, `admin_finalize_session_survey`,
  `is_survey_finalized`.
- Tables: `kudos_categories`, `session_reports`, `session_report_results`.
- Lazy trigger: `src/lib/session-reports/finalize-due-surveys.ts`.
- Ballot: `src/lib/session-reports/kudos-ballot.ts`.

**History.**
- The kudos ladder rose to +2 and the session cap to 3.5 (ADR-060, ADR-063).
- Safe Hands: only reports opened after rollout; no backfill (#264).

## Midweek Madness

**Behaviour.**
- **The week.** Every football week, members' five-card squads play a seeded
  knockout on Wednesday evening (BUILD_SPEC §44; byes ADR-166).
  - The lock is **19:55 Europe/Amsterdam**. Round *r* starts at
    lock + 5 + 15(*r*−1) minutes.
  - A match is 14 chance slots of 20 s, then a shoot-out if needed.
  - Each week keeps the clock version it opened with (ADR-104).
- **Who plays.**
  - Every active member who owns a card and hasn't opted out is entered.
    Non-pickers get a random **auto squad** at a 0.55 handicap, and a bye only
    once every saved squad has one (one surviving saved card counts).
  - Empty slots get **trialists**, named after Talents (ADR-165).
  - The week is skipped below 4 entrants or after a week without a published
    session.
- **Squads.** One Player per slot. Power is the OVR factor (1.00–1.12) × form
  roll × pick factor × fitness × handicap, and a fresh day roll every match.
- **Shape** (ADR-116):
  - archetypes give 0–3 plusses per line;
  - each plus short of 3 in an outfield line multiplies the squad by 0.88;
  - one card plays in goal.
- **Archetypes for the week.** They are frozen when the week opens (ADR-099).
  Unclaimed Players draw a new one each week from its seed (ADR-110).
- **Rewards.**
  - Wins pay by round, summing to **250** for the champion (ADR-096), paid
    lazily as the week completes.
  - Members who are already out may **call** the winners of later matches, on
    the Calls page or the pre-match. Correct calls pay 30 divided by the
    matches after round 1, at most 30 a night (ADR-118, ADR-149).
  - Every entrant gets one `midweek_result` message (ADR-109).
- **After the night.**
  - Ratings from 1 to 10 (ADR-117), display only. A match's show from its
    full time on its report and `Your night` (ADR-150); the night's rating
    and line once the week is complete, a row per card (ADR-155).
  - Share images on `Your night`: a champion poster (for everyone) and "my
    night", drawn in the browser (ADR-120).
- **Pages** under Compete (ADR-107/153/154): the hub `/midweek` (a Now block,
  four tiles; names the champion until Thursday 23:59), `/midweek/pick` (your
  locked five from the lock), `/midweek/past`, and `/midweek/[weekStart]`
  (in play it redirects to the hub, ADR-155) with `bracket` (a block per round
  on a phone, the tree from `lg`), `night`, `calls`, `picks`,
  `next/[round]/[pairing]` and `match/[matchId]` (Match and Teams, ADR-156).
- **Live** (ADR-115/147/148): every match in play is watchable: a corrected
  clock held at 90′, the feed newest first, shoot-out kicks whose commentary
  waits for full time (#263). Nothing shows before its moment; the match polls
  every 10 s (5 s in a shoot-out), other pages 20 s. Bracket rows in play show
  the score and minute.
- **Pre-match** (ADR-149/155): once both feeders end, a countdown, both fives
  with Power and plusses, and the call for a member who is out; no win chance
  before kick-off.

**Part L:** 4, 5, 25, 26, 27, 28.

**Where.**
- **Engine:** SQL `_mm_*` driven by `run_midweek_due` (open, lock and
  simulate, pay); the TS twin in `src/game/midweek/`; parity pinned by
  `tests/fixtures/midweek-golden.json` and its TS and SQL tests (ADR-090).
  Change all three together.
- **Member RPCs:** `save_midweek_squad(uuid[])`, `set_midweek_opt_out`,
  `save_midweek_prediction`.
- **Reveals:** time-gated `midweek_*_public` views (§44.9). Nothing is revealed
  by a job.
- **Names (ADR-151):** clubs (`*_club`, ADR-145) where the team plays or wins;
  account names (`*_name`) where the member acts, and unnamed trialists.
  `clubName`/`sideClub` (`rows.ts`) fall back to the account.
- **Lazy trigger:** `src/lib/midweek/run-due.ts`, called from Home and every
  Midweek page.
- **Reports:** a seeded phrasebook in `src/lib/midweek/report/` (ADR-093).
- **Live:** `src/lib/midweek/{live,live-load,live-clock}.ts`; the feed and
  shoot-out in `src/components/midweek/feed.tsx`; the pre-match in
  `src/lib/midweek/prematch.ts` and `src/components/midweek/prematch.tsx`.
- **Simulation:** `tests/sim/`.

**History.** Friday Five removed (ADR-088), Midweek specified (ADR-089), first
evening 30 Sep, clock v1 until ADR-104. Never push a migration during a
running Wednesday evening.

## Specials and Groundmasters

**Behaviour.**
- The Special editions schema exists, but **nothing is issued** (ADR-055).
  Packs and starters draw Live editions only.
- A Special's identity, rating, rarity and art are a frozen snapshot that never
  changes.
- Projections read the stored `snapshot_rarity_tier` (ADR-121, KB-038). Live
  tiers follow current state.
- A Special is never drawn in the injury cast. It may play in Midweek, where
  the strongest copy per Player is used.
- `/admin/editions` is a read-only foundation page.

**Part L:** 14 (and 6, 7, 10 once a pack can roll one).

**Where.**
- `20260916000000_special_edition_scaffolding.sql`,
  `protect_frozen_card_edition`.
- Tests: `special_editions.test.sql`, `special_snapshot_tiers.test.sql`.

**Next.** Groundmasters, proposed in #222.

## Injury mode

**Behaviour.**
- An admin starts injury mode from the injury date (ADR-082).
- Each football week without an appearance, the member may do one **rehab
  check-in**, for the current or the previous week. It pays **100** and
  **protects** that week's Activity: no ×0.90 decay. Form still fades.
- Injury mode ends by itself at the first attended session after the injury
  date, or when an admin ends it. Protection is never backdated.
- **Comeback Form** (ADR-083): after 3 or more protected weeks, the first
  return earns `min(2, 0.25 × protected weeks)` as a fading Form input.
- **Plaster cast:** the Live card of a currently injured Player is drawn in a
  signed cast on every card screen (ADR-084 to ADR-087). In Midweek its
  fitness is 0.95.
- A Player without an account can be injured too (ADR-165): it pauses the
  absence clock and draws the cast, with no check-in or message.

## Academy and roster lifecycle

**Behaviour** (ADR-165, #246). Live from go-live, recorded once on the roster
(the current football week); before it members see nothing of this.
- Stages: **Talent** (no Live card) → **First Team** → **Retired**. At risk is
  a warning, not a stage. Every Player keeps a profile.
- **Progress** = counted weeks played in the last 8 + active credits (≤2,
  with a reason, expiring after 8 counted weeks). The Academy on
  Players shows progress ≥2; ≥3 with a real week promotes, permanently.
- **First Team:** 8 counted weeks absent warns (At risk tag, profile and card
  block, owners' message); 12 retires. Injury weeks don't count; a game resets
  it. Retirement is recomputed; a comeback needs re-promotion.
- **Retired:** copies stay owned and tradeable; no new copies (packs, starter,
  reset, rotation: `can_mint_copies`); no Midweek (lock, save, picker); a stamp
  on current cards, never snapshots; out of ratings, risers and album
  completion, into a Retired set and `/players/retired`.
- Promotion week: Home "New:" tile, Packs inset, Chronicle roster block.
- Admin: Add a Player (Talent with 0–2 credits, or First Team; similar names
  first), Stage and Clock columns, Credit, Promote / Bring back;
  attendance marks Talents and adds one on the spot.

**Part L:** 27, 29, 30, 31.

**Where.** `_evaluate_lifecycle`, `admin_register_player`,
`admin_promote_player`, `admin_grant_academy_credit`,
`admin_record_academy_go_live`; views `academy_status`,
`player_lifecycle_public`, `player_lifecycle_events_public`. `src/lib/academy.ts`,
`src/components/academy.tsx`; `academy_lifecycle.test.sql`.

**Part L:** 4, 5, 15, 24.

**Where.**
- `admin_start_injury`, `admin_end_injury`, `injury_check_in(date)`,
  `my_injury_status`, `comeback_form_inputs`.
- Views: `injured_players`.
- `src/lib/{injuries,injury-cast}.ts`; Home and `/injury` share the form.
- Tests: `injury_protection.test.sql`, `injury_comeback.test.sql`.

## Notifications and Home

**Behaviour.**
- `user_notifications` is a private inbox (`/messages`), written only by
  server functions inside the transaction that caused it.
- Event types: `market_sale`, `market_purchase`, `attendance_reward`,
  `pack_opened`, `admin_notice`, `bibs_bonus`, `trade_offer`,
  `trade_response`, `session_report`, `session_results`, `report_correction`,
  `kudos_awarded`, `injury_check_in`, `midweek_result`, `player_promoted`
  (everyone), `player_at_risk`, `player_retired` (owners).
- Message rows use a title, body/time and New tag, grouped by day; no event
  kicker or inline destination label (ADR-160).
- Every message opens its subject through `/messages/[id]/open`, which also
  marks it read (ADR-114).
- **Home:**
  - one Now block, soonest due first (your live match first); other items are
    tiles. Club Value/Rank stack below 360 px; packs are primary only when
    nothing is due (ADR-158).
  - risers are rows below `lg`, then cards; a Chronicle tile shows the latest
    week's standfirst; activity excludes superadmin (ADR-038/039/054).
- No push, email or realtime delivery exists.

**Part L:** none directly. Messages ride the economy transactions, so a sale
never misses one side's message.

**Where.**
- `mark_notifications_read`. Views: `activity_feed`, `top_risers`.
- `src/lib/messages.ts`, `messages-load.ts`, `src/lib/home/`,
  `src/lib/activity.ts`.
- `src/lib/notification-copy.ts` translates stored "KUT Coins" text at display
  time (ADR-137). A test fails if a migration adds an untranslated literal.

## Admin

**Behaviour.**
- Roles: `user`, `admin`, `superadmin`. Pages under `/admin`:
  - **Attendance:** record, publish, correct, cancel; reports, G+A
    corrections, early close.
  - **Roster:** add a Talent or First Team Player, the Academy controls
    (ADR-165), deactivate or hard-delete a never-used Player (ADR-025/026),
    injuries. **Invites.**
  - **Accounts** (`/admin/links`): link to a Player (ADR-028), disable or
    delete (ADR-030), soft reset to 250 coins (ADR-035), adjust a wallet
    (at most 100,000 per call).
  - **Recovery** (`/admin/accounts`): audited password resets (ADR-011).
    **Economy**: atomic prices/toggles, draft suggestions, SQL metrics,
    paid-price usage and cohort flows (ADR-164). **Midweek**: switch/void/rehearsal.
- Shared UI (ADR-160); Midweek needs no weekly admin work.
- A superadmin may grant coins to their own wallet; `admin_adjust_wallet`
  refuses the caller's own (ADR-052).

**Part L:** 5, 8, 12, 17, 19.

**Where.** The `admin_*` RPCs, `admin_account_events` (audit),
`midweek_admin_overview`, `admin_session_report_roster`.

## Privacy, consent and accounts

**Behaviour.**
- **Membership** is invite-only (ADR-006): a token is claimable once and stored
  as a hash, sign-up takes a username (ADR-028), and sign-in is by password,
  with no Supabase Auth redirect flow.
- **Members-only:** every page and projection (ADR-020, ADR-079); base-table
  member reads also require `is_active_member()` (ADR-152), including own rows
  after an account is disabled. Denied reads return zero rows. The own-profile
  read remains available for login to detect a disabled account. No public
  roster. Never exposed: emails, tokens, others' ledgers, admin notes.
- **Card ownership** is private (the album, wants, collections). Exceptions:
  - a listing shows its seller;
  - Midweek shows the five entered cards from the lock. Entry is the default
    and the opt-out is the consent (ADR-091);
  - an owner count appears only at 3 or more owners.
- Settings uses club/Midweek blocks and navigation rows; sign-in uses Fields.
  Players has search and an all-width Filter sheet (ADR-160).
- **Photos.** A member sets their own Player's photo and archetype on
  `/settings/card` (ADR-027). Photos live in a private Storage bucket; reads
  require active membership (ADR-152). App-issued signed URLs last up to one
  hour; existing URLs retain their original expiry. The silhouette is the default.
- **Share images** (ADR-120) are the one deliberate exception to §53. They
  carry names and photos, are drawn in the browser and sent only by the member;
  nothing is hosted.
- **Backups** (ADR-141) cover schema `kut` only. Auth accounts are not backed
  up.

**Part L:** 18, 19, plus the ADR-079 gate on every definer view.

**Where.**
- `is_active_member`, `is_admin`, `claim_invitation`, `set_own_player_photo`,
  `set_own_player_archetype`, `set_own_club_name`.
- `src/lib/invites/`, `src/lib/auth/`, `src/lib/player-photos.ts`.
- Tests: `member_only_projections.test.sql`, `active_member_base_reads.test.sql`.

## FLUT name and domain

**Behaviour.**
- The game is **FLUT, Football League Ultimate Team** (ADR-137, 8 Oct;
  formerly KUT). The currency is **FLUT Coins**.
- Only user-visible words changed. They come from `src/lib/brand.ts`.
- Internal names stay `kut`: the schema, the repo, the Vercel project, the
  ledger reasons and server-written text (translated at display).
- The primary host is `https://flut.vibetrunk.com` (ADR-139). `next.config.ts`
  redirects every path on `kut.vibetrunk.com` to the same path and query there
  with a **307**.
- Sign-in cookies are per host. Invite links use `APP_URL`.

**History.** A 308 was declined (9 Oct) so a rollback stays instant.
`/club/midweek/*` → `/midweek/*` is permanent (ADR-107).

**Where.** `next.config.ts` and `tests/unit/legacy-host-redirect.test.ts`.
`docs/RELEASING.md` has the live check.
