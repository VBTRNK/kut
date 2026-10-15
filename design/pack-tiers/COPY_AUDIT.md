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

## Data contract choices for S1 review

Proposed fixed slugs: existing `tfh-pack`, new `tfh-silver-pack`/`tfh-gold-pack`.
Do not select a design from price or floor. Keep the current purchase signature
and response keys. New fields are append-only/optional for reads; every opening
uses one materialized eligible-pool snapshot so tier changes cannot defeat the
guarantee halfway through. Empty pools fail atomically with no debit/mint.

Settings save takes all three prices/two toggles and an expected version token.
Lock definitions in stable order, recheck version, validate auth and bounded
positive integers, update all or none and write one who/before/after/time audit.
Use a monotonic revision rather than a timestamp-only token to avoid equal-time
edit collisions. Regular stays on. Decide the finite technical upper bound in
S1 alongside bigint/JS safe-integer handling; it is not an economic constraint.
Manual override above/below recommendations is valid with no extra approval.

Analytics should return authoritative per-pack metrics plus measured-at/version;
the TS form may divide those metrics by draft prices, not recalculate the pool
or guarantee odds. Canonical SQL suggestions can use the same metrics; include
parity vectors for 75%/10%/roundUp25 and undefined ratios.
Health must account for conditional third-slot EV; the old per-slot EV column
can remain the base draw statistic for old clients, never label it as every
slot's premium EV. Full premium pack EV is separately authoritative.

Use one cohort (enabled non-superadmin profiles, including admins/newcomers,
matching the accepted research); do not guess test identities from display
names. S1 must inspect whether a real explicit test-account marker exists;
exclude it consistently if present, otherwise state the cohort and avoid
claiming an unsupported exclusion. Seven/28-day usage groups by immutable
identity and paid price; affordability uses draft prices in S3. Tax is a sink,
market/escrow transfers are not. Reward/discard totals are not pack ROI.

Catalogue rollout: S1 DB/RPC PR independently reviewed/merged; hosted application
only through VibeTrunk/supabase by owner authorization. New client must work
before that catalogue application. Until metadata/RPC exists, no premium promise
or settings save control is fabricated. Owner should coordinate catalogue
application and S2 deployment so an old UI's generic premium copy is not exposed
as a launch. Launch checks are owner actions, not authorized by this session.

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
