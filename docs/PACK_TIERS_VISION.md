# Pack tiers: certainty at a premium

Proposal for [#223](https://github.com/VibeTrunk/kut/issues/223), 15 October
2026. The owner supports the pack proposal and has requested live admin
balancing controls, with manual price changes and advisory monitoring only.
This remains a design, not implemented behaviour. The
priority is a dependable better pull while preserving long-term collecting.

## Recommendation

Keep the regular pack and offer these two choices:

| Pack | Coins | Cards | Promise | Start state |
| --- | ---: | ---: | --- | --- |
| Regular | 250 | 3 | Current weighted Live draws | On |
| Silver | **500** | **3** | **At least one Silver or better** | **On** |
| Gold | **750** | **3** | **At least one Gold or better** | **Off** |

Use the existing per-player weights. Draw the first two cards normally. If
either meets the pack's minimum, draw the third normally too. Otherwise draw
the third from eligible Live players at or above that minimum, retaining their
relative weights. This guarantees the advertised result without adding an
extra strong slot to every pack. A Gold card already satisfies a Silver
guarantee; a Holo satisfies both. Duplicates remain possible.

This is paying for certainty. Regular packs remain the efficient way to buy
more cards and, on today's roster, more Gold+ cards per coin. All three packs
can still contain duplicates and the premium packs can contain Common/Bronze
cards. The copy must say **“3 Live cards. At least 1 Silver+ / Gold+.”**
If the goal changes to eliminating every low-tier card, use a different
product; the alternative below makes its cost explicit.

Start with Silver at 500 enabled and Gold at 750 disabled, as requested.
Gold remains visible to admins with live analytics and can be enabled later.
It is supportable on the present roster; its pool has 20 players, not two.
Do not launch Holo/Elite guarantees, guaranteed-new cards or pack-specific
rating boosts. No purchase caps or new currency are needed for this proposal.

## Evidence and the current problem

The owner's three screenshots were transcribed and then matched **entry for
entry** against the owner's production aggregate query, captured at
09:53 UTC on 15 October. Only anonymous OVR/tier frequencies are retained in
the [reproduction fixture](../scripts/research/pack-roster-2026-10-15.json).
The earlier 29-player dataset came from local Docker through `.env.local`;
it was incorrectly labelled hosted and is excluded from this analysis.

| Current tier | Players | OVR range | Weight per player | Share of regular draws |
| --- | ---: | --- | ---: | ---: |
| Common | 3 | 37 | 100 | 26.27% |
| Bronze | 10 | 40–48 | 60 | 52.54% |
| Silver | 3 | 54–59 | 30 | 7.88% |
| Gold | 9 | 60–69 | 12 | 9.46% |
| Holo | 11 | 70–79 | 4 | 3.85% |
| Elite | 0 | — | 1 | 0% |

There are 36 eligible players, including 23 Silver+ and 20 Gold+. Yet
Common/Bronze account for **78.81% of individual draws** and a regular pack
has a **48.95% chance of three low-tier cards**. The complaints fit the odds.
The weighting is per player, not a fixed probability of each tier. One
Common player has 25 times the draw weight of one Holo player.

The production export covers 23 enabled non-superadmin accounts:

- Wallets hold 4,695 coins in total; median 162, upper quartile 218. Only two
  accounts can currently afford 500, one can afford 750 and none can afford
  1,000. These are balances after spending, not proof of unwillingness to save.
- In seven days, 14 buyers opened 41 regular packs for 10,250 coins. External
  rewards/grants added 8,717 and discards added 3,671. These numbers do not
  imply the discarded cards came from those same packs.
- Over 28 days, pack spend was 46,125, discards paid 17,639 and external
  rewards/grants added 32,842. Of 246 packs, 205 cost 175 and 41 cost 250;
  the combined purchase rate is not a clean baseline for today's price.
- Median collection: 22 of 36 Live players, 10 of 20 current Gold+ players
  and 4 of 11 Holos. No account has a complete Live album; two are at 35.
  There are 114 duplicate Live copies across the cohort.

There is demand for packs and substantial room to collect strong players.
There is little evidence for an expensive 1,250–1,500 coin luxury tier as the
first response. At 250 per attendance plus 50 per report, 500 and 750 are
attainable saving goals. Keep the 250 option available throughout.

The market completed 90 sales in 28 days and 11 in the last seven; only one
of those recent sales is a currently Holo player. Buying a specific missing
player should remain a useful alternative to a random guarantee. Historical
sale medians cannot set today's pack price: the export classifies sales by
the player's current tier, and ratings may have risen since the sale. There
is not enough evidence here to predict the market-price response.

The cohort's liquid balance rose by 2,055 coins in seven days and 3,726 in
28 days according to the ledger sums. This is not a global inflation measure:
it excludes other accounts and coins held in trade escrow. Market purchases
and sales transfer coins; escrow movements are not permanent sinks.

## What the proposed packs actually buy

Exact weighted calculations on the current roster; tiers are frozen for the
comparison. Expected discard is a server payout estimate, not market value.
“Any Gold+” and “Any Holo+” are per-pack chances, not per-card odds.

| Pack | Any Silver+ | Any Gold+ | Any Holo+ | Expected discard | Discard / price | Gold+ copies / 1,000 coins |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Regular 250 | 51.05% | 34.85% | 11.12% | 147.98 | 59.2% | 1.597 |
| Silver 500 | 100% | 65.59% | 20.02% | 206.02 | 41.2% | 1.413 |
| Gold 750 | 100% | 100% | 29.98% | 245.85 | 32.8% | 1.401 |

The premium is meaningful: Silver never produces a three-low pack; Gold
never produces a pack below Gold. They produce **11.5% and 12.3% fewer Gold+
copies per coin**, respectively, than regular packs. Holo supply per coin
falls by the same percentages. They therefore improve consistency without
making regular packs obsolete or accelerating the rarest collections at a
fixed budget. Immediate expected coin removal, if every card is discarded,
is about 102 regular / 294 Silver / 504 Gold coins per pack.

For a 1,500-coin budget, starting from an empty album:

| Purchase | Cards minted | Expected distinct players | Expected distinct Gold+ players |
| --- | ---: | ---: | ---: |
| 6 regular packs | 18 | 12.01 | 2.23 |
| 3 Silver packs | 9 | 7.75 | 2.02 |
| 2 Gold packs | 6 | 5.54 | 2.02 |

These are comparisons, not forecasts for today's accounts. Existing holdings,
trades, future ratings and saving behaviour change the outcome. Aggregate
coverage does not tell us which cards each member lacks. In particular,
“owns half the Gold+ pool” does not imply a 50% chance of a new Gold+ card.

There is no duplicate protection. The chance of a repeated player inside a
pack is about 15.4% regular / 8.2% Silver / 7.0% Gold. Premiums reduce that
incidentally because a forced final draw cannot match two lower-tier draws;
they do not promise three different players or a new collection entry.
Midweek still uses the strongest copy per player, so duplicates do not create
extra squad slots. This research does not estimate tournament win-rate changes.

## Alternatives considered

| Alternative | Current result | Why it is not the first choice |
| --- | --- | --- |
| Three cards, double Silver+ weights | Still 27.50% three-low packs | Better odds cannot deliver the advertised certainty |
| Three cards, triple Silver+ weights | Still 16.96% three-low packs | Same problem; a separate weight system also complicates explanation |
| 500: one fixed Silver+ slot + one normal | 67.76% any Gold+, 38.4% discard return | Viable simpler fallback, but two cards feel lean beside the existing three-card pack |
| 750: two Silver+ cards | No low cards; 86.17% any Gold+ | Solves a stronger complaint, but gives 4.9% more Gold+/Holo per coin than regular and concentrates output into 23 players |
| 800: two Silver+ cards | Same contents; slightly fewer strong copies per coin than regular | Best alternative if every low card must be excluded; a higher saving hurdle |
| 1,000: one fixed Gold+ slot + one normal | 100% any Gold+, 22.9% discard return | More expensive with less volume; unnecessary for the first guarantee tier |

Two Silver+ cards at 600 would generate about **31% more Gold+/Holo per coin**
than regular packs today. That is a much bigger supply change than the small
price difference suggests. A pair of Gold+ cards at 1,500 is a possible
future luxury concept, but is not needed to establish a clear pack ladder now.
Guaranteed-new cards would directly remove the final collection chase and
make outcomes depend on a member's holdings; leave those out.

## Live cards prevent a permanent balance guarantee

The actual progression is already substantial: Holo count rose from 1 in the
week of 7 September to 11 now. Current mean Activity is 89.11 for Holos,
66.57 for Golds and 52.15 for Silvers. This is not an equilibrium roster.

From zero Activity, attending once every played football week reaches the
Activity cap in 12 weeks; twice weekly reaches it in nine. With zero Form,
maximum Activity produces OVR 75. Skipped football weeks, absence, injury
protection and session-aged Form mean calendar time is not that calculation.
Silver and Gold are live rating bands, not permanent scarcity classes.

| Controlled sensitivity, not a forecast | Regular return | Silver 500 return | Gold 750 return |
| --- | ---: | ---: | ---: |
| Current roster | 59.2% | 41.2% | 32.8% |
| Every OVR +5, capped at 83 | 80.0% | 50.3% | 41.2% |
| Every OVR +10, capped at 83 | 101.4% | 51.1% | 52.3% |
| Every player at 75 | 382.8% | 191.4% | 127.6% |
| Every player at 83: upper bound | 709.2% | 354.6% | 236.4% |

Weights are recalculated at each new tier in these cases; returns need not
increase smoothly. The uniform cases are bounds, not predictions that
occasional players will attend every week. Screenshot OVR and tier averages
cannot support a per-player attendance/Form forecast, so none is claimed.

Holding cards also defers their discard price. Three cards that later all
reach 58 already discard for more than a regular pack's 250 cost. Three at
75 pay 957 and three at 83 pay 1,773, regardless of their opening tier.
Club Value discounts duplicates; discard payouts do not. A healthy current
return therefore does not prove a healthy future economy.

The proposal is balanced for the measured roster, with headroom in the +5/+10
sensitivities. It does **not** repair the economy for every future roster.
Review the existing regular pack's maturity exposure alongside this work;
do not silently alter ratings, discard values, the regular price or odds.
Higher-tier guarantees must also be reassessed if Silver+ becomes routine:
members should not pay double for an effectively identical product.

## Live admin balancing

Extend `/admin/economy` into one page with three pack rows and one **Apply
changes** button. Reuse `pack_definitions.price` and `is_active`, which already
exist. Prices and availability become normal audited settings, rather than
migrations for each adjustment. Keep Regular, Silver and Gold as fixed pack
types; an arbitrary pack builder or editable odds matrix is unnecessary.

Admins can change all three prices and toggle Silver/Gold. Regular stays
configured on. Initially use **Regular 250 on, Silver 500 on, Gold 750 off**.
An off pack remains visible in admin analytics with a suggested price. The
shop lists only packs currently available for purchase.

### What best deal and negative ROI mean

Regular should lead in **expected value per coin**, while premiums offer
more certainty per opening. Compare total cards, expected discard payout and
expected counts of Silver+, Gold+, Holo+ and Elite per coin. This prevents
“Regular is best” from hiding a premium that produces the rarest cards more
cheaply. Zero-count tiers are omitted until they exist.

This is not a claim that Regular is best for every member's missing card,
risk preference or Midweek squad. Per-pack chances and per-coin expected
counts answer different questions. Keep both visible.

Label monetary return **Current discard return**. Its expected ROI is
`expected current discard payout / price - 1`. The balance goal is below
zero; the recommendation targets a return of at most **75%** to leave a
buffer. An individual profitable pack is still possible. This does not make
claims about future appreciation or resale prices, which cannot be guaranteed
negative without changing the game rules. These are monitoring goals, not
server-enforced purchase or settings limits. The owner accepts responsibility
for reviewing the dashboard and adjusting prices or availability manually.

### Useful analytics without a reporting platform

Calculate these on page load from the actual eligible roster and draw rules,
with a Refresh button and measurement time. No polling, scheduler or stored
dashboard snapshots are needed initially.

- **Per pack:** price, guarantee, on/off state and qualifying pool size. Explain
  an empty qualifying pool when a guarantee cannot be fulfilled. Include expected discard
  payout, discard return, expected net coins removed, and suggested price.
- **Value and odds:** chance of at least one Silver+/Gold+/Holo+/Elite card,
  expected qualifying copies per 1,000 coins, and a clear warning when a
  premium beats Regular on any tracked value measure. The main row can show
  the worst comparison; expandable details show the individual tiers.
- **Recent use:** openings and coins spent per pack over seven and 28 days,
  grouped by the price actually paid. Do not blend old and new prices into a
  misleading estimate of current demand.
- **Economy context:** median member wallet and the number who can afford
  each price, plus coins entering through rewards/discards and leaving through
  packs/tax over those periods. Exclude superadmin/test activity consistently;
  show the member cohort and exclude escrow transfers from permanent sinks.

Do not call same-period discards divided by pack spend “realized pack ROI”:
those discards can come from much older packs. Current collection completion
charts, account-level analysis and causal market forecasts add little to the
first version of this control panel.

### A price suggestion with an explicit rule

Use a fixed 75% discard-return target and target premiums that are at least
10% less efficient per coin than Regular on every tracked value measure.
These are proposed recommendation policies; admins adjust the actual prices,
not a set of economic tuning sliders. Round suggestions up to the next 25
coins. Allow custom whole-coin prices within the normal settings bounds.

First suggest a Regular price that keeps its current price when healthy and
raises it only when needed to meet the target:

```text
suggested Regular = max(current Regular price,
                        roundUp25(Regular expected discard / 0.75))
```

For a premium, compare its per-pack value with Regular for each measure:
card count, discard payout, and expected Silver+/Gold+/Holo+/Elite counts.
Let `largest value ratio` be the largest premium-to-Regular ratio among them.

```text
suggested premium = roundUp25(max(
    premium expected discard / 0.75,
    suggested Regular price * largest value ratio / 0.90
))
```

This is a price floor for the stated policy, not a prediction of willingness
to pay. On the verified roster it independently reproduces **250 / 500 / 750**.
Premium suggestions may move up or down as their relative advantage changes.
The Regular recommendation deliberately avoids unsolicited price cuts; an
admin can still lower it manually, with the resulting analytics visible.

Suggestions assume the suggested Regular price is applied too. **Use
suggested prices** fills the form without saving; **Apply changes** saves the
admin's valid submitted prices and toggles. Preview the return and value
comparisons for those draft prices, using the draft Regular price, so manual
overrides are understandable. Economic warnings do not block saving and need
no extra confirmation flow. Nothing changes until the admin applies it.

If a guarantee has no qualifying players, show **Unavailable**, not a cheap
suggestion. Ignore a ratio where both expected counts are zero. A positive
premium count with no Regular route to that outcome has no finite price that
preserves this policy; flag it for a rule review rather than divide by zero.
Warn when Regular already almost always meets a premium's guarantee: raising
the premium price is not a substitute for a useful product.

### Keep settings and purchases safe

One admin-only database function saves the three prices and two toggles
atomically, checks for edits made by another admin, and records who changed
what and when. Validate authorization and positive whole-coin bounds on the
server. The 75% return target and 10% value margin guide suggestions only.
Keep direct client writes from bypassing the validated settings function.

A dashboard cannot ensure negative ROI or Regular's value lead between admin
visits. This is an accepted operational tradeoff. **Do not add purchase-time
ROI/value checks, automatic economic pauses or economic validation on save.**
Only admin changes alter configured prices and toggles. An empty qualifying
pool must still prevent a purchase without charging, because its promise
cannot be fulfilled; this is ordinary guarantee integrity.

Use a coherent eligible pool for each opening so rating changes cannot break
the guarantee halfway through. The health screen and opening function must share the canonical
pool, weights and guarantee calculations. Do not maintain an independent set
of analytics odds. Future Special rolls must join that same model before they
are switched on.

There is **no automatic repricing** and no scheduled job. Replayed paid
openings still return their saved results even after a pack is disabled.
Keep the existing stale-price confirmation protection for new purchases;
turning a pack off must also block a previously loaded purchase form without
a debit. Historical purchases retain their actual paid price.

The shop and confirmation already read database prices. Replace the FAQ's
static `ECONOMY.basicPackPrice` text with the same live configuration, and show
guarantees consistently. There should be no second price to edit in code.
Keep the existing 75%/80%/95% health bands, adding a clear warning at 100%
and a separate value-ladder warning. Neither warning changes availability.

Price and toggle controls are a modest extension of existing fields. The care
is in shared guarantee-aware calculations, audited writes and existing purchase
integrity; these need database and concurrency tests in the initial pack change.
After that initial release, ordinary price/availability adjustments require
neither a PR nor another analysis session. Raw weight editing, automatic demand
optimization, alerts and historical charts stay outside this first version.

## Pack designs and animations

Make design an explicit implementation step before building the final pack UI.
Create a short design brief and reviewable shop mockups plus opening storyboards
for **Regular, Silver and Gold**, including Gold while it is disabled at launch.
Show the three together at mobile and desktop sizes, so their differences and
shared FLUT identity can be assessed. Keep the source assets and previews with
the implementation; this work is part of the feature, not a later polish task.

Each type needs its own pack artwork and opening animation. Use distinguishable
materials, composition or motifs as well as colour, with distinct opening
choreography. A shared component and reveal flow can drive all three designs;
separate designs do not require three separate animation systems. Choose the
specific visual direction during this step using the existing game's style.
Do not imply that every card is Silver/Gold or that a Special is included.

Carry the pack identity consistently from shop tile through confirmation,
opening and results. Use its stored type/title and an explicit visual mapping,
never the price, display order or a revealed card's rarity to choose its design.
Preserve historical opening identity when prices or availability change.

Reuse the existing in-app animation and persisted reveal machinery. Include
keyboard operation, reduced-motion alternatives, a skip path and safe reload
or replay of paid results. Motion presents server-selected cards and never
selects them or triggers another payment. Verify each type on mobile and
desktop, including low-tier companion cards and duplicate results.

## Pack language across the game

Inventory pack references before editing copy: home offers and calls to action,
shop, confirmation, opening and results, FAQ/help, welcome or starter flows,
activity, notifications, messages, errors, empty states and admin. Check server
text and tests as well as visible components. A global replacement would miss
different meanings and can incorrectly turn the separate starter grant into a
shop pack.

Use **packs** for the category and **Regular pack**, **Silver pack** or
**Gold pack** when the offer or opening is specific. Display the chosen pack's
live price and its exact guarantee. Home shortcuts must identify their offer
or lead to the pack choice; they must not present one price as the price of all
packs. Historical receipts retain their pack identity and actual price paid.
Remove assumptions about one pack type and static prices, including the FAQ.
Keep “at least one” explicit wherever a premium's contents are explained.

## Specials and rollout

Keep the initial packs Live-only. Groundmasters and other frozen editions are
the more natural future scarcity chase once active players' Live tiers settle.
Their issuance, supply cap, roll, discard multiplier and Midweek effect belong
to [#222](https://github.com/VibeTrunk/kut/issues/222) and its own decisions.

Do not add a Special roll incidentally to this change. An eventual Special
must not replace a required qualifying card with a card below its floor.
Its frozen tier is authoritative, and its supply cap must survive concurrent
opens. Audit receipt, cap and window behaviour alongside the economy.

The old 1%-per-slot idea is a proposal, not a live rule. Equal per-slot rolls
with three-card packs give the same Special chance per pack but half/one-third
the chance per coin in Silver/Gold. Decide that tradeoff explicitly before
activation; do not imply that a dearer pack is better for every Special chase.
Recalculate expected payout including Specials before choosing those odds.

Implementation should record the prices, **at least one** promise and admin
balancing policy in an ADR and update PRODUCT; this document does not change
either. A shared guarantee implementation can support both tiers. It needs:

1. Inspect the existing shop, opening flow and pack references. Produce the
   three pack design mockups and animation storyboards described above, then
   use those concrete designs for the implementation.
2. One migration in its own PR, with database tests: preserve price quotes,
   replay-safe results, wallet locking, atomic debit/mint and server-only RNG.
   Empty qualifying pools must fail without a charge, never weaken the promise.
3. A stored opening-time guarantee/tier receipt. Live result views currently
   follow changing ratings; a card falling a tier later must not look like an
   opening that broke its guarantee. Keep showing the current Live card too.
4. Guarantee-aware SQL pack health and advisory suggestions, the audited admin
   settings form, all three pack designs/animations and the full copy inventory.
   Test that economic warnings permit valid manual settings and purchases;
   ordinary active-state, price-quote and guarantee checks must still hold.
   Adding pack definitions alone would still use today's undifferentiated draws.
   Keep existing clients/schema compatible during catalogue-first rollout.
5. Update ADR/PRODUCT and run the appropriate database, unit and browser checks,
   including visual verification, reduced motion and existing-schema compatibility.
   Respect the repo's separate database/RPC PR boundary rather than stacking a
   migration on a frontend branch. Hosted application stays an owner action.
6. Refresh the production aggregates at launch, then after two and four weeks.
   Check uptake, empty wallets, duplicates, collection coverage, market sales,
   actual coin flows and each pack's current expected discard return.

Use the existing 75% target / above-80% warning / 95% critical return thresholds
as review signals, with prominent warnings for nonnegative expected discard ROI
or a broken value ladder. Changes to prices and availability remain manual.
No deployment, migration,
publication or game-rule change is authorized by this research.

## Reproduce and limits

```powershell
node scripts/analyze-pack-tiers.mjs scripts/research/pack-roster-2026-10-15.json 1500
```

The harness compares independent slots and the conditional final draw using
exact probabilities, including their different duplicate/uniqueness behaviour.
It is research code outside the application. Tests check hand-calculated cases
and parity with the existing display curves; SQL remains authoritative.
The [aggregate SQL](../scripts/research/pack-tier-economy.sql) is SELECT-only,
was checked locally and was run against production by the owner. Financial
and collection export files remain in ignored local evidence; there are no
names, photos or account IDs in the fixture or this proposal.

Not measured: future pack demand, account-level missing-card combinations,
causal effects on market prices or Midweek wins, and Special issuance economics.
These are the practical limits of the price recommendation, not reasons to
delay a modest, monitored guarantee tier.
