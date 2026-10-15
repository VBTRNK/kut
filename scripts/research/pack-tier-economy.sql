-- Issue #223: run in the PRODUCTION Supabase SQL Editor as the owner.
-- SELECT-only, one consistent snapshot, no RPCs or hosted changes.
-- Returns anonymous aggregates only: no names, IDs, emails or individual rows.
-- Cohort: enabled non-superadmin profiles. Counts include admins and newcomers.
-- Collection tiers and sale tiers are CURRENT Live tiers, not tiers at acquisition.
begin isolation level repeatable read read only;
set local statement_timeout = '20s';

with
cohort as (
  select id from kut.profiles where not is_disabled and role <> 'superadmin'
),
live_pool as (
  select e.id, e.player_id,
    coalesce(s.live_ovr, 30) as ovr,
    coalesce(s.rarity_tier, 'common') as tier,
    coalesce(s.activity_score, 0) as activity,
    coalesce(s.form_score, 0) as form,
    s.last_rebuilt_at
  from kut.card_editions e
  join kut.players p on p.id = e.player_id
  left join kut.seasons season on season.is_active
  left join kut.player_season_state s on s.player_id = p.id and s.season_id = season.id
  where e.is_live and e.edition_type = 'live' and p.is_active and p.is_collectible
),
roster_groups as (
  select ovr, tier, count(*) as players from live_pool group by ovr, tier
),
member_stats as (
  select c.id, coalesce(w.balance, 0) as balance,
    count(uc.edition_id) as eligible_live_copies,
    count(distinct uc.edition_id) as distinct_live_players,
    count(distinct uc.edition_id) filter (where e.tier in ('gold', 'holo', 'elite')) as gold_plus,
    count(distinct uc.edition_id) filter (where e.tier in ('holo', 'elite')) as holo_plus
  from cohort c
  left join kut.wallets w on w.user_id = c.id
  left join (kut.user_cards uc join live_pool e on e.id = uc.edition_id)
    on uc.owner_id = c.id and uc.burned_at is null
  group by c.id, w.balance
),
periods(days) as (values (7), (28)),
flows as (
  select p.days, l.reason, count(*) as entries,
    count(distinct l.user_id) as members,
    sum(greatest(l.amount, 0)) as credits,
    -sum(least(l.amount, 0)) as debits,
    sum(l.amount) as net
  from periods p
  join kut.wallet_ledger l on l.created_at >= now() - make_interval(days => p.days)
  join cohort c on c.id = l.user_id
  group by p.days, l.reason
),
pack_activity as (
  select p.days, d.slug, o.price_paid, count(*) as openings,
    count(distinct o.user_id) as buyers, sum(o.price_paid) as gross_spend
  from periods p
  join kut.pack_openings o on o.created_at >= now() - make_interval(days => p.days)
  join cohort c on c.id = o.user_id
  join kut.pack_definitions d on d.id = o.pack_id
  group by p.days, d.slug, o.price_paid
),
coverage as (
  select metric, value, count(*) as members
  from member_stats
  cross join lateral (values
    ('distinct_live_players', distinct_live_players),
    ('distinct_gold_plus', gold_plus), ('distinct_holo_plus', holo_plus)
  ) m(metric, value)
  group by metric, value
),
rating_history as (
  select s.week_start, s.rarity_tier as tier, count(*) as players
  from kut.player_rating_snapshots s
  join live_pool e on e.player_id = s.player_id
  join kut.seasons season on season.id = s.season_id and season.is_active
  group by s.week_start, s.rarity_tier
),
market as (
  select p.days, e.tier as current_tier, count(*) as sales,
    percentile_cont(0.5) within group (order by sale.sale_price) as median_price,
    sum(sale.sale_price) as turnover, sum(sale.tax_amount) as tax_burn
  from periods p
  join kut.market_sales sale on sale.sold_at >= now() - make_interval(days => p.days)
  join live_pool e on e.id = sale.edition_id
  join cohort buyer on buyer.id = sale.buyer_id
  join cohort seller on seller.id = sale.seller_id
  group by p.days, e.tier
)
select jsonb_pretty(jsonb_build_object(
  'captured_at', now(),
  'scope', 'Enabled non-superadmin members; current eligible Live editions; no personal rows',
  'roster_players', (select count(*) from live_pool),
  'latest_rating_rebuild', (select max(last_rebuilt_at) from live_pool),
  'roster', (select coalesce(jsonb_agg(to_jsonb(r) order by ovr desc), '[]'::jsonb) from roster_groups r),
  'rating_state_by_tier', (select coalesce(jsonb_agg(to_jsonb(r) order by tier), '[]'::jsonb) from (
    select tier, count(*) as players, round(avg(activity), 2) as mean_activity,
      round(avg(form), 2) as mean_form from live_pool group by tier
  ) r),
  'active_packs', (select coalesce(jsonb_agg(to_jsonb(p) order by price), '[]'::jsonb) from (
    select slug, price, cards_per_pack from kut.pack_definitions where is_active
  ) p),
  'members', (select count(*) from cohort),
  'wallets', (select jsonb_build_object(
    'liquid_coins', coalesce(sum(balance), 0),
    'median', percentile_cont(0.5) within group (order by balance),
    'p25', percentile_cont(0.25) within group (order by balance),
    'p75', percentile_cont(0.75) within group (order by balance)
  ) from member_stats),
  'affordability', (select jsonb_agg(to_jsonb(a) order by price) from (
    select prices.price, count(*) filter (where m.balance >= prices.price) as can_afford
    from (values (250), (500), (600), (750), (800), (1000), (1250), (1500)) prices(price)
    left join member_stats m on true group by prices.price
  ) a),
  'coin_flows', (select coalesce(jsonb_agg(to_jsonb(f) order by days, reason), '[]'::jsonb) from flows f),
  'pack_activity', (select coalesce(jsonb_agg(to_jsonb(p) order by days, slug, price_paid), '[]'::jsonb) from pack_activity p),
  'collection_coverage_histograms', (select coalesce(jsonb_agg(to_jsonb(c) order by metric, value), '[]'::jsonb) from coverage c),
  'duplicate_live_copies', (select coalesce(sum(eligible_live_copies - distinct_live_players), 0) from member_stats),
  'rating_history', (select coalesce(jsonb_agg(to_jsonb(h) order by week_start, tier), '[]'::jsonb) from rating_history h),
  'market_sales', (select coalesce(jsonb_agg(to_jsonb(m) order by days, current_tier), '[]'::jsonb) from market m)
)) as pack_tier_research;

rollback;
