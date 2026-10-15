# Issue 223 — pack references and rollout contract

S0 inventory, 15 October 2026. Inspected source, server SQL, tests, research and
design references. This is a change map, not a claim that the copy is implemented.
Search with `rg -ni 'pack|starter|tfh-pack|basicPack' src tests supabase scripts`.

## Member and admin surfaces

| Caller | Current assumption | Required treatment / owning slice |
| --- | --- | --- |
| `src/app/(app)/page.tsx` | Reads only `tfh-pack` price/count, labels it Open a pack | S2: category shortcut "Choose a pack" with no universal price, or explicitly name Regular and its live quote. Read failures must not invent an offer. |
| `club/packs/page.tsx` | `active_pack_offers`, explicit legacy column list, generic contents | S2: `select("*")`, optional floor metadata, explicit slug→art mapping, exact promise, live price. Render only returned active offers. Unknown slugs get neutral art and server text, never an invented guarantee. |
| `club/packs/open-pack-form.tsx` | All offers use brass; name + price sheet; retained idempotency key | S2: shared art/promise in offer and existing BottomSheet. Preserve input validation, quote reconfirmation, focus and double-submit prevention. |
| `club/packs/actions.ts` | Generic failure, handles price_changed; redirects to opening ID | S2: retain auth/slug/UUID/safe integer guards and signature. Distinguish unavailable guarantee from insufficient funds when a known server error supports it; unknown errors remain safe/generic. Never add ROI checks. |
| `club/packs/[openingId]/page.tsx` | Reads `*`; uses current `pack_title`, ignores `pack_slug`/`price_paid` | S1/S2: immutable identity/title/floor receipt and actual paid price, opening-time tier/OVR next to current Live cards. Optional fields tolerate old schema. Do not infer type from price, order or pulled rarity. |
| `components/pack-reveal.tsx`, `pack-reveal-state.ts`, `globals.css` | Shared starter/paid rarity→OVR→player; skip; reduced motion on mount | S2: explicit optional paid identity, distinct seal introduction, visible stage focus, summary focus, polite step status, presentation-only replay; starter defaults stay. Changes must cover both callers. |
| `lib/pack-summary.ts` | Collection/new/duplicate chips; no pack offer data | Retain this purpose; copy identity belongs to receipt, not chips. Test repeated players and unchanged album semantics. |
| `how-it-works/page.tsx`, `src/game/economy.ts` | "TFH Pack" and `ECONOMY.basicPackPrice/CardCount` | S2: live offers/prices/floors, Live-only, duplicates, conditional final draw in help. Remove unused pack display constants after checking callers; keep starter/reward constants. Do not change historical research fixtures. |
| `lib/activity.ts` and Home feed projection query | Single event says "a pack"; folding combines one actor's consecutive purchases | S1 append pack receipt identity/title columns to `activity_feed`, null for other kinds. S2 select them; use exact name for one pack; fold only matching pack identity AND paid-price groups, so mixed purchases/prices do not lose meaning. Old rows with no metadata stay generic. |
| `lib/messages.ts`, messages page/row/reader | Legacy `pack_opened` label; no current pack notification producer | Keep category label and safe old messages. No new notification requirement. Translate only known server templates, preserving names/amounts/free text. |
| `lib/notification-copy.ts` | Legacy KUT insufficient-funds and club-reset server templates | Preserve historic adapter/fixtures. S1 new server text says FLUT; S2 tests known error presentation without rewriting stored message data. |
| `admin/economy/page.tsx` | Active-only health, legacy slot EV, no controls | S1 canonical guarantee-aware SQL and all-pack analytics; S3 live measured time, advisory drafts/suggestions, atomic manual save/conflict/audit. Old schema: read-only legacy health and explicit controls unavailable. No manufactured zeros/suggestions when missing data. |
| `admin/editions/page.tsx` | "Packs currently contain Live cards only" | Keep; no Specials in this feature. |
| `club/collection/page.tsx`, `midweek/pick/page.tsx`, `components/midweek/picker.tsx` | Generic Open a pack links | S2: category CTAs can say "Choose a pack"; never attach a universal pack price. No Midweek rules change. |
| `app-shell/nav-items.tsx`, `lib/nav/routes.ts`, `club/page.tsx`, `components/icons.tsx` | Category Packs/icon | Keep category name and route. No Store rename. |
| `welcome/{page,actions,starter-cards}.tsx/ts`, `starter-reveal.tsx`, `lib/nav/context.ts` | Already-granted three distinct cards and starter first-login gate | Keep starter terminology, one-off 250-coin grant, no purchase quote or paid wrapper identity. Starter opening marks/reloads cosmetics only. |
| `admin/links/{links-table,actions}.tsx/ts`, `admin/roster/roster-table.tsx` | Reset starter text / pack eligibility description | Preserve starter amount and reset semantics; do not replace with Regular price. Eligibility stays Live, active, collectible. |
| `lib/live-card-player.ts`, `format.ts`, `filters.ts`, reveal comments | Pack result adapters or implementation references | Retain current Live/cast/photo behavior; no copy replacement needed. |

Paths without a prefix in the table are under `src/app/(app)/` or `src/` as named.

## Server producers and immutable history

- Latest `open_pack(text,bigint,uuid)` body: migration
  `20260918000000_basic_pack_175.sql`; price 250 in `20261019000000`.
  Add one migration, do not edit either. Its current Live eligibility includes
  `edition_type = 'live'`; old health omits that clause and is active-only.
  Extract canonical pool/weights/discard and guarantee math for both paths.
- `pack_definitions` currently has an admin ALL policy. S1 must inspect grants
  and revoke direct authenticated mutations/remove bypass policy so the
  validated audited settings RPC is the only member/admin write route.
- Current result projection: `20261018000000_special_snapshot_tiers.sql`.
  Append receipt fields at the end; preserve current Live stats, cast/photo and
  owner filter. Keep the member gate/RLS from current base-table migrations.
  Do not change definer projections to invoker as an unrelated security fix.
- Current activity projection: `20260926000000_trade_log_rating_story_listing_duration.sql`
  plus `20260928000000_active_member_projection_gate.sql`. Pack amount is
  `pack_openings.price_paid`, correctly historical already. Append identity
  fields at the end of every UNION arm and keep superadmin/member filters.
- Opening history stores only `pack_id` and `price_paid`; name comes from the
  mutable definition. Before renaming TFH Pack to Regular, backfill the actual
  pre-change title/slug for existing openings; floor/drawn tier evidence stays
  null because it was never recorded. Do not invent old OVR/tier from current
  ratings. Legacy Regular naming can be explained as "TFH Pack (Regular)".
- Snapshot new receipt title/slug/floor plus per-slot opening tier/OVR inside
  the debit/mint transaction. New readers tolerate absent columns; old readers
  continue to work after append-only changes. Later price/toggle edits never
  alter receipt identity/price/evidence. Results remain available if sold/burned.
- `claim_invitation`, `admin_reset_club`, `mark_starter_opened` and their
  reset/first-login notices are starter producers; leave their grant rules alone.
- `user_messages` still accepts `pack_opened`, but latest `open_pack` does not
  insert such a notice. Preserve legacy data/event parsing rather than adding
  redundant paid messages or blanket text updates.

## S1 contract (as built, ADR-164)

Migration `20261023000000_pack_tiers.sql`; tests `pack_tiers.test.sql` and
`tests/integration/pack-tiers-race.test.ts`. S2/S3 read this, not the SQL.

- **Definitions.** `tfh-pack` "Regular pack" 250 (a check keeps it on),
  `tfh-silver-pack` "Silver pack" 500 `min_tier='silver'`, `tfh-gold-pack`
  "Gold pack" 750 `min_tier='gold'`. Silver and Gold are seeded **off**: the
  current shop would list Silver without its promise (deviation, see the PR).
  Map art from the slug only; unknown slugs stay neutral.
- **Purchase.** `open_pack(text,bigint,uuid)` and its response keys are
  unchanged. New error: `P0002 'pack guarantee cannot be met'` (empty floor;
  no debit). `'insufficient FLUT Coins for this pack'` replaces the KUT text.
- **Reads (appended columns, use `select("*")`).** `active_pack_offers.min_tier`.
  `my_pack_opening_results`: `pack_slug`/`pack_title` now the recorded receipt
  (old openings say "TFH Pack"), then `min_tier`, `opened_tier`, `opened_ovr`
  (null for openings before S1: never infer them) and `floor_draw`. Show "Gold
  64 when opened" only when `opened_tier` differs from `rarity_tier`.
  `activity_feed.pack_slug`/`pack_title` (null outside packs and in fixtures);
  fold only equal slug and `amount`. `pack_economy_health` lists every pack and
  appends `is_active`, `min_tier`, `qualifying_count`.
- **Admin read.** `admin_pack_economy()` (admins; 42501 otherwise) returns
  `measured_at`; `revision` {`revision`,`changed_at`,`changed_by_name`};
  `packs[]` per definition (price order): `slug,title,price,cards_per_pack,
  is_active,min_tier,eligible_count,qualifying_count,expected_discard_per_slot,
  expected_discard_per_pack,expected_{silver_plus,gold_plus,holo_plus,elite},
  chance_{silver_plus,gold_plus,holo_plus,elite},suggested_price,
  suggestion_state ('suggested'|'unavailable'|'unsupported'),value_ratio`;
  expectations are null when the floor has no qualifying Player. `usage[]` by
  recorded `slug,title,price_paid` with `openings_7d/28d`, `coins_7d/28d`.
  `cohort` {`definition`,`members`,`median_balance`,`balances` sorted, no ids}.
  `flows` always has `rewards_and_grants`, `discards`, `packs`, `market_tax`
  (ledger tax plus burned trade tax) and `admin_adjustments`, each signed
  `net_7d`/`net_28d`; market sales/buys and trade escrow are transfers, left out.
  The page divides these per-pack figures by draft prices; it never redraws.
- **Cohort.** Enabled, non-superadmin profiles. No test-account marker exists,
  so none is claimed.
- **Settings write.** `admin_apply_pack_settings(expected_revision, regular,
  silver, gold, silver_active, gold_active)`: admins only (42501), whole coins
  1 to 1,000,000 (22023, a technical bound). Locks the three rows in slug order
  (a purchase's `FOR SHARE` waits, two admins serialize). Returns `status`
  `applied` (one audit row, revision + 1), `unchanged` or `conflict` (with the
  current `revision` and `packs`, nothing written). Direct writes are revoked;
  the audit is `pack_settings_changes` (admin read). No economic checks.
- **Suggestions** (SQL, current Regular price): R* = max(price,
  roundUp25(EV/0.75)); premium = roundUp25(max(EV/0.75, R* x largest value
  ratio / 0.90)) over cards, discard, Silver+/Gold+/Holo+/Elite copies, 0/0
  ignored. On the 15 Oct fixture: 250 / 500 / 750 (pgTAP parity with
  `scripts/analyze-pack-tiers.mjs` to 1e-9).

## Verification reach

- S1 pgTAP: new guarantees/settings/analytics/receipt cases, plus existing
  `next_features_contracts`, `member_admin_links`, `activity_feed`, member-only
  projections/base reads, cast-on-packs, special snapshot and starter tests.
  Other suites insert `source='pack'` cards for fixtures; those are not offers.
- S1 integration: `tests/integration/next-features-race.test.ts` already covers
  same/different-key opens. Add settings/open races, coherent guarantee,
  rollback, stale quote and replay after price/availability changes.
- S2 unit: `pack-reveal-state`, `home-messages`, `activity`, `notification-copy`,
  `live-card-player`, nav tests and receipt fallback/explicit identity cases.
  Browser: mobile/desktop, keyboard/focus, reduced motion/skip, all packs,
  low companions/duplicates and real paid-result reload/replay without payment.
- S3 unit/browser: manual warning overrides, suggested fill vs save, draft
  Regular comparisons, empty/zero pools, conflicts, unavailable old-schema RPC.
- `scripts/measure-pack-ev.mjs` reads existing view columns and says active-only;
  S1 preserve its contract, S3 update explanation/extra metrics as needed.
  Research `analyze-pack-tiers.mjs` is explicitly independent research, not a
  production odds engine. Keep its evidence and tests intact.
- Historical migration wording, archived design prices and old ADRs are
  history. Do not mass-replace Basic/TFH/175/250. Update current PRODUCT and new
  ADR as each runtime slice lands; S0 records only the design boundary.
