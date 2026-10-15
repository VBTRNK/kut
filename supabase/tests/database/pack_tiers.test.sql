-- ADR-164 / #223 S1: Regular, Silver and Gold packs on one canonical draw.
-- Isolated pools: every existing Player is set inactive inside this
-- transaction. Pool A reproduces the 15 October roster fixture
-- (scripts/research/pack-roster-2026-10-15.json); pool B is small enough to
-- exercise the conditional last card. setseed makes the draws repeatable.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path to extensions,kut,public;
select no_plan();

-- Fixture -------------------------------------------------------------------
insert into auth.users(id,email,aud,role,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select ('65000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'pack-tiers-'||n||'@example.test',
  'authenticated','authenticated','{}','{}',now(),now()
from generate_series(1,4) n;
insert into kut.profiles(id,display_name,role) values
  ('65000000-0000-4000-8000-000000000001','Pack Tier Admin','admin'),
  ('65000000-0000-4000-8000-000000000002','Pack Tier Member','user'),
  ('65000000-0000-4000-8000-000000000003','Pack Tier Second','user'),
  ('65000000-0000-4000-8000-000000000004','Pack Tier Super','superadmin');
insert into kut.wallets(user_id,balance) values
  ('65000000-0000-4000-8000-000000000001',1000),
  ('65000000-0000-4000-8000-000000000002',1000000),
  ('65000000-0000-4000-8000-000000000003',499),
  ('65000000-0000-4000-8000-000000000004',100000)
on conflict (user_id) do update set balance = excluded.balance;

update kut.players set is_active = false where is_active;
update kut.seasons set is_active = false where is_active;
insert into kut.seasons(id,name,starts_on,is_active)
values('65000000-0000-4000-8000-000000000010','Pack tiers test',current_date-7,true);

create temp table fixture_roster(pool text, n integer, ovr integer, tier text) on commit drop;
insert into fixture_roster
select 'a', ordinality, split_part(entry,':',1)::integer, split_part(entry,':',2)
from unnest(string_to_array(
  '79:holo,76:holo,75:holo,75:holo,74:holo,74:holo,72:holo,72:holo,71:holo,70:holo,70:holo,69:gold,67:gold,65:gold,63:gold,63:gold,63:gold,61:gold,60:gold,60:gold,59:silver,58:silver,54:silver,48:bronze,47:bronze,44:bronze,43:bronze,43:bronze,42:bronze,42:bronze,41:bronze,41:bronze,40:bronze,37:common,37:common,37:common',
  ',')) with ordinality entry;
insert into fixture_roster values ('b',1,37,'common'),('b',2,37,'common'),('b',3,55,'silver'),('b',4,62,'gold');

insert into kut.players(id,slug,display_name,archetype,is_active)
select ('65000000-0000-4000-8000-'||case pool when 'a' then '1' else '2' end||lpad(n::text,11,'0'))::uuid,
  'pack-tiers-'||pool||'-'||n,'Pack Tiers '||upper(pool)||n,'all_rounder',pool='a'
from fixture_roster;
insert into kut.card_editions(player_id,edition_type,title,is_live)
select id,'live','Live','true'::boolean from kut.players where slug like 'pack-tiers-%';
insert into kut.player_season_state(player_id,season_id,activity_score,form_score,live_ovr,pac,sho,pas,dri,def,phy,rarity_tier)
select player.id,'65000000-0000-4000-8000-000000000010',0,0,roster.ovr,roster.ovr,roster.ovr,roster.ovr,roster.ovr,roster.ovr,roster.ovr,roster.tier
from fixture_roster roster
join kut.players player on player.slug = 'pack-tiers-'||roster.pool||'-'||roster.n;

-- Definitions, policy and grants ---------------------------------------------
select results_eq(
  $$select slug,title,price,cards_per_pack,is_active,min_tier from kut.pack_definitions order by price$$,
  $$values ('tfh-pack'::text,'Regular pack'::text,250::bigint,3,true,null::text),
           ('tfh-silver-pack','Silver pack',500,3,false,'silver'),
           ('tfh-gold-pack','Gold pack',750,3,false,'gold')$$,
  'fixed Regular, Silver and Gold definitions; Silver and Gold start off');
select has_function('kut','open_pack',array['text','bigint','uuid'],'the purchase signature is unchanged');
select is((select count(*) from kut.pack_openings where pack_title is null or pack_slug is null),0::bigint,
  'every existing opening carries its recorded slug and title');
select is((select revision from kut.pack_settings_changes order by revision desc limit 1),1::bigint,
  'the seeded configuration is revision 1');
select throws_ok($$update kut.pack_definitions set is_active=false where slug='tfh-pack'$$,'23514',null,
  'Regular cannot be switched off');
select is((select count(*) from pg_policy where polrelid='kut.pack_definitions'::regclass and polcmd='*'),0::bigint,
  'no ALL policy remains on pack definitions');

set local role authenticated;
set local request.jwt.claim.sub = '65000000-0000-4000-8000-000000000001';
select throws_ok($$update kut.pack_definitions set price=1 where slug='tfh-pack'$$,'42501',null,
  'an admin cannot write pack definitions directly');
select throws_ok($$insert into kut.pack_settings_changes(revision,after) values (99,'{}')$$,'42501',null,
  'an admin cannot write the settings audit directly');
select throws_ok($$select * from kut.pack_draw_pool()$$,'42501',null,'the draw pool is internal');
select is((select count(*) from kut.pack_economy_health),3::bigint,'health lists every pack, inactive ones too');
reset role;

-- Parity with the research harness on pool A ------------------------------------
select set_config('request.jwt.claim.sub','65000000-0000-4000-8000-000000000001',true);
create temp table parity on commit drop as
select m.*, s.suggested_price, s.suggestion_state
from kut.pack_metrics() m join kut.pack_price_suggestions() s using (slug);
create temp table expected(slug text, discard numeric, c2 numeric, c3 numeric, c4 numeric, e2 numeric, e3 numeric, e4 numeric, suggested bigint) on commit drop;
insert into expected values
  ('tfh-pack',147.98248686514887,0.510526463447854,0.34851072284909357,0.1111904575988587,0.6357267950963221,0.3992994746059545,0.11558669001751314,250),
  ('tfh-silver-pack',206.02272163988403,1,0.6559486466339167,0.2001856460628838,1.1252003316484596,0.706737398390774,0.20458187848153817,500),
  ('tfh-gold-pack',245.84874889330067,1,1,0.2997794588793833,1.2279897743244101,1.0507887517568633,0.30417569129803773,750);
select is((select count(*) from parity p join expected e using (slug)
  where abs(p.expected_discard_per_pack-e.discard) < 1e-9
    and abs(p.chance_silver_plus-e.c2) < 1e-9 and abs(p.chance_gold_plus-e.c3) < 1e-9 and abs(p.chance_holo_plus-e.c4) < 1e-9
    and abs(p.expected_silver_plus-e.e2) < 1e-9 and abs(p.expected_gold_plus-e.e3) < 1e-9 and abs(p.expected_holo_plus-e.e4) < 1e-9
    and p.expected_elite = 0 and p.chance_elite = 0),
  3::bigint,'SQL expectations match the research harness for all three packs');
select results_eq($$select slug,suggested_price,suggestion_state from parity order by price$$,
  $$values ('tfh-pack'::text,250::bigint,'suggested'::text),('tfh-silver-pack',500,'suggested'),('tfh-gold-pack',750,'suggested')$$,
  'suggestions reproduce 250 / 500 / 750 (75% return, 10% value margin, round up 25)');
select results_eq($$select slug,eligible_count,qualifying_count from parity order by price$$,
  $$values ('tfh-pack'::text,36,36),('tfh-silver-pack',36,23),('tfh-gold-pack',36,20)$$,
  'pool and qualifying counts');
select ok((select abs(expected_discard_per_slot*3-expected_discard_per_pack) < 1e-9 from parity where slug='tfh-pack'),
  'Regular per pack is three base draws');
select is((select expected_discard_per_pack from kut.pack_economy_health where slug='tfh-silver-pack'),206.02::numeric,
  'the health view reports the guarantee-aware pack value');
select is((select kut._pack_round_up_25(250.0000000001)),250::bigint,'an exact multiple does not tip up on rounding noise');
select is((select kut._pack_round_up_25(250.01)),275::bigint,'anything above a multiple rounds up');

-- Pool B: the conditional last card ------------------------------------------------
update kut.players set is_active = (slug like 'pack-tiers-b-%') where slug like 'pack-tiers-%';
select is((select kut.admin_apply_pack_settings(1,250,500,750,true,true)->>'status'),'applied','an admin switches Silver and Gold on');
select setseed(0.25);
set local role authenticated;
set local request.jwt.claim.sub = '65000000-0000-4000-8000-000000000002';
do $$ begin
  for i in 1..300 loop perform kut.open_pack('tfh-pack',250,gen_random_uuid()); end loop;
  for i in 1..300 loop perform kut.open_pack('tfh-silver-pack',500,gen_random_uuid()); end loop;
  for i in 1..100 loop perform kut.open_pack('tfh-gold-pack',750,gen_random_uuid()); end loop;
end $$;
reset role;

create temp table drawn on commit drop as
select opening.id, opening.pack_slug, opening.min_tier, opening.price_paid, result.slot, result.opened_tier,
  kut.pack_tier_rank(result.opened_tier) as tier_rank, result.floor_draw, edition.player_id, edition.id as edition_id
from kut.pack_openings opening
join kut.pack_opening_cards result on result.opening_id = opening.id
join kut.user_cards card on card.id = result.card_id
join kut.card_editions edition on edition.id = card.edition_id
where opening.user_id = '65000000-0000-4000-8000-000000000002';

select results_eq($$select pack_slug,count(distinct id),count(*) from drawn group by pack_slug order by pack_slug$$,
  $$values ('tfh-gold-pack'::text,100::bigint,300::bigint),('tfh-pack',300,900),('tfh-silver-pack',300,900)$$,
  'every opening has three cards');
select is((select count(*) from (select id from drawn where min_tier is not null group by id, min_tier
  having max(tier_rank) < kut.pack_tier_rank(min_tier)) missed),0::bigint,'every Silver and Gold pack meets its floor');
select is((select count(*) from drawn where floor_draw and (slot <> 3 or min_tier is null)),0::bigint,
  'only a premium pack''s last card can be restricted');
select is((select count(*) from drawn last where last.slot = 3 and last.min_tier is not null
  and last.floor_draw <> (not exists (select 1 from drawn earlier where earlier.id = last.id and earlier.slot < 3
    and earlier.tier_rank >= kut.pack_tier_rank(last.min_tier)))),0::bigint,
  'the last card is restricted exactly when the first two missed the floor');
select ok((select count(*) filter (where floor_draw) > 0 and count(*) filter (where not floor_draw) > 0
  from drawn where pack_slug='tfh-silver-pack' and slot=3),'Silver packs include needed and already-met guarantees');
select ok((select avg((opened_tier='silver')::integer) between 0.62 and 0.80 from drawn where floor_draw and pack_slug='tfh-silver-pack'),
  'a restricted draw keeps relative weights (Silver 30 : Gold 12)');
select ok((select avg((opened_tier='common')::integer) between 0.79 and 0.86 from drawn where pack_slug='tfh-pack'),
  'Regular draws keep the weights (two Commons hold 200 of 242)');
select is((select count(*) from drawn where floor_draw and pack_slug='tfh-gold-pack' and opened_tier <> 'gold'),0::bigint,
  'a Gold restriction draws only Gold+');
select ok(exists(select 1 from drawn where pack_slug='tfh-silver-pack' group by id having count(distinct player_id) < 3),
  'duplicates stay possible in premium packs');
select ok(exists(select 1 from drawn where pack_slug='tfh-silver-pack' and opened_tier='common'),
  'low companion cards stay possible in premium packs');
select is((select sum(-amount) from kut.wallet_ledger where user_id='65000000-0000-4000-8000-000000000002' and reason='pack_purchase'),
  300*250+300*500+100*750::numeric,'each opening is debited its own price once');
select is((select sum(minted_count)::bigint from kut.card_editions edition join kut.players player on player.id=edition.player_id
  where player.slug like 'pack-tiers-b-%'),2100::bigint,'every card minted matches a debited slot');

-- Receipts: opening-time tier beside the current Live card ----------------------
update kut.player_season_state set rarity_tier='bronze', live_ovr=45
where player_id='65000000-0000-4000-8000-200000000004';
set local role authenticated;
set local request.jwt.claim.sub = '65000000-0000-4000-8000-000000000002';
select ok((select bool_and(rarity_tier='bronze' and opened_tier='gold' and opened_ovr=62 and ovr=45)
  from kut.my_pack_opening_results where player_id='65000000-0000-4000-8000-200000000004'),
  'a receipt keeps the drawn tier/OVR while the card shows its current Live tier');
select is((select count(distinct opening_id) from kut.my_pack_opening_results where pack_title='Gold pack' and min_tier='gold'),100::bigint,
  'members read their own receipts with pack name and floor');
reset role;

-- Legacy receipt: recorded title, no invented evidence.
insert into kut.pack_openings(id,user_id,pack_id,price_paid,idempotency_key,pack_slug,pack_title)
select '65000000-0000-4000-8000-000000000050','65000000-0000-4000-8000-000000000002',id,175,gen_random_uuid(),'tfh-pack','TFH Pack'
from kut.pack_definitions where slug='tfh-pack';
insert into kut.user_cards(id,edition_id,owner_id,source)
select '65000000-0000-4000-8000-000000000051',id,'65000000-0000-4000-8000-000000000002','pack'
from kut.card_editions where player_id='65000000-0000-4000-8000-200000000001';
insert into kut.pack_opening_cards(opening_id,slot,card_id)
values('65000000-0000-4000-8000-000000000050',1,'65000000-0000-4000-8000-000000000051');
set local role authenticated;
set local request.jwt.claim.sub = '65000000-0000-4000-8000-000000000002';
select results_eq($$select pack_title,price_paid,min_tier,opened_tier,floor_draw from kut.my_pack_opening_results
  where opening_id='65000000-0000-4000-8000-000000000050'$$,
  $$values ('TFH Pack'::text,175::bigint,null::text,null::text,false)$$,
  'a legacy receipt keeps its title and price, with unknown opening tier');
reset role;

-- Quotes, availability and replay after edits -------------------------------------
select set_config('request.jwt.claim.sub','65000000-0000-4000-8000-000000000002',true);
select is(kut.open_pack('tfh-silver-pack',500,'65000000-0000-4000-8000-000000000060')->>'already_processed','false','a Silver pack opens at its quote');
select set_config('request.jwt.claim.sub','65000000-0000-4000-8000-000000000001',true);
select is((select kut.admin_apply_pack_settings(2,250,600,750,false,true)->>'revision'),'3','an admin reprices and switches Silver off');
select set_config('request.jwt.claim.sub','65000000-0000-4000-8000-000000000002',true);
create temp table balance_before on commit drop as
select balance from kut.wallets where user_id='65000000-0000-4000-8000-000000000002';
select is(kut.open_pack('tfh-silver-pack',500,'65000000-0000-4000-8000-000000000060'),
  jsonb_build_object('opening_id',(select id from kut.pack_openings where idempotency_key='65000000-0000-4000-8000-000000000060'),
    'price_paid',500,'already_processed',true,'price_changed',false),
  'a replay after repricing and switching off returns the saved opening and its paid price');
select throws_ok($$select kut.open_pack('tfh-silver-pack',600,gen_random_uuid())$$,'P0002','active pack not found',
  'a switched-off pack cannot be bought from a loaded form');
select is(kut.open_pack('tfh-gold-pack',500,gen_random_uuid()),
  '{"already_processed":false,"price_changed":true,"current_price":750}'::jsonb,'a stale quote returns the current price');
select is((select balance from kut.wallets where user_id='65000000-0000-4000-8000-000000000002'),(select balance from balance_before),
  'replay, a switched-off pack and a stale quote debit nothing');
set local role authenticated;
set local request.jwt.claim.sub = '65000000-0000-4000-8000-000000000002';
select results_eq($$select distinct pack_title,price_paid,min_tier from kut.my_pack_opening_results
  where opening_id=(select id from kut.pack_openings where idempotency_key='65000000-0000-4000-8000-000000000060')$$,
  $$values ('Silver pack'::text,500::bigint,'silver'::text)$$,
  'a member still reads a receipt for a pack that is now off');
select results_eq($$select slug,price,min_tier from kut.active_pack_offers order by price$$,
  $$values ('tfh-pack'::text,250::bigint,null::text),('tfh-gold-pack',750,'gold')$$,
  'members see only offers that are on, with their floor');
select is((select count(*) from kut.pack_settings_changes),0::bigint,'members cannot read the settings audit');
select is((select count(*) from kut.pack_metrics()),0::bigint,'members get no pack metrics');
select is((select count(*) from kut.pack_price_suggestions()),0::bigint,'members get no suggestions');
select throws_ok($$select kut.admin_pack_economy()$$,'42501',null,'members cannot read the admin economy');
select throws_ok($$select kut.admin_apply_pack_settings(3,250,500,750,true,true)$$,'42501',null,'members cannot apply settings');
reset role;
select set_config('request.jwt.claim.sub','',true);
select throws_ok($$select kut.admin_apply_pack_settings(3,250,500,750,true,true)$$,'42501',null,'no caller, no settings');

-- Settings: bounds, conflicts, audit and manual overrides -----------------------------
select set_config('request.jwt.claim.sub','65000000-0000-4000-8000-000000000001',true);
select throws_ok($$select kut.admin_apply_pack_settings(3,0,500,750,true,true)$$,'22023',null,'a zero price is rejected');
select throws_ok($$select kut.admin_apply_pack_settings(3,250,1000001,750,true,true)$$,'22023',null,'prices are bounded');
select throws_ok($$select kut.admin_apply_pack_settings(3,250,500,750,null,true)$$,'22023',null,'toggles are required');
select is(kut.admin_apply_pack_settings(2,250,500,750,true,true)->>'status','conflict','a stale revision is a conflict');
select is((select price from kut.pack_definitions where slug='tfh-silver-pack'),600::bigint,'a conflict changes nothing');
select is(kut.admin_apply_pack_settings(3,250,600,750,false,true)->>'status','unchanged','an identical submission is unchanged');
select is((select max(revision) from kut.pack_settings_changes),3::bigint,'conflicts and no-ops write no audit');
select results_eq($$select changed_by, before->'tfh-silver-pack', after->'tfh-silver-pack' from kut.pack_settings_changes where revision=3$$,
  $$values ('65000000-0000-4000-8000-000000000001'::uuid,'{"price":500,"is_active":true}'::jsonb,'{"price":600,"is_active":false}'::jsonb)$$,
  'the audit records who changed what, before and after');

create function public.pack_tiers_fail_audit() returns trigger language plpgsql as $$
begin raise exception 'audit unavailable'; end $$;
create trigger pack_tiers_fail_audit before insert on kut.pack_settings_changes
  for each row execute function public.pack_tiers_fail_audit();
select throws_ok($$select kut.admin_apply_pack_settings(3,300,700,800,true,true)$$,'P0001','audit unavailable',
  'a failed audit write fails the save');
select results_eq($$select price,is_active from kut.pack_definitions order by slug$$,
  $$values (750::bigint,true),(250,true),(600,false)$$,'and leaves every price and toggle as it was');
drop trigger pack_tiers_fail_audit on kut.pack_settings_changes;

-- Economic warnings never block: a Regular price far below its discard value saves and sells.
select is(kut.admin_apply_pack_settings(3,50,600,750,false,true)->>'status','applied','a high-return manual price saves');
select set_config('request.jwt.claim.sub','65000000-0000-4000-8000-000000000003',true);
select ok((kut.open_pack('tfh-pack',50,gen_random_uuid())->>'opening_id') is not null,'and can be bought');
select set_config('request.jwt.claim.sub','65000000-0000-4000-8000-000000000001',true);
select ok((select expected_discard_return_ratio > 1 from kut.pack_economy_health where slug='tfh-pack'),
  'health shows the return above 100% without changing anything');
select is(kut.admin_apply_pack_settings(4,250,500,750,true,true)->>'status','applied','prices restored');

-- Empty guarantee pools fail without a charge ------------------------------------------
update kut.players set is_active=false where id='65000000-0000-4000-8000-200000000004';
select set_config('request.jwt.claim.sub','65000000-0000-4000-8000-000000000001',true);
select results_eq($$select qualifying_count, expected_discard_per_pack, chance_gold_plus from kut.pack_metrics() where slug='tfh-gold-pack'$$,
  $$values (0, null::numeric, null::numeric)$$,'a Gold pack without Gold+ Players has no expectations');
select is((select suggestion_state from kut.pack_price_suggestions() where slug='tfh-gold-pack'),'unavailable','and no suggestion');
select set_config('request.jwt.claim.sub','65000000-0000-4000-8000-000000000002',true);
create temp table before_empty on commit drop as
select (select balance from kut.wallets where user_id='65000000-0000-4000-8000-000000000002') balance,
  (select count(*) from kut.pack_openings where user_id='65000000-0000-4000-8000-000000000002') openings,
  (select count(*) from kut.wallet_ledger where user_id='65000000-0000-4000-8000-000000000002') ledger,
  (select sum(minted_count) from kut.card_editions) minted;
select throws_ok($$select kut.open_pack('tfh-gold-pack',750,gen_random_uuid())$$,'P0002','pack guarantee cannot be met',
  'an empty Gold pool cannot be bought');
update kut.players set is_active=false where slug like 'pack-tiers-%';
select throws_ok($$select kut.open_pack('tfh-pack',250,gen_random_uuid())$$,'P0002','no eligible Live editions are available',
  'an empty Live pool cannot be bought');
select is((select row(balance,openings,ledger,minted)::text from before_empty),
  (select row((select balance from kut.wallets where user_id='65000000-0000-4000-8000-000000000002'),
    (select count(*) from kut.pack_openings where user_id='65000000-0000-4000-8000-000000000002'),
    (select count(*) from kut.wallet_ledger where user_id='65000000-0000-4000-8000-000000000002'),
    (select sum(minted_count) from kut.card_editions))::text),
  'failed openings leave no debit, ledger, opening or mint');
select set_config('request.jwt.claim.sub','65000000-0000-4000-8000-000000000001',true);
select is((select count(*) from kut.pack_metrics() where expected_discard_per_pack is null and eligible_count=0),3::bigint,
  'an empty pool makes every pack unavailable');
update kut.players set is_active = (slug like 'pack-tiers-b-%') where slug like 'pack-tiers-%';

-- Admin economy snapshot ------------------------------------------------------------
select set_config('request.jwt.claim.sub','65000000-0000-4000-8000-000000000004',true);
select ok((kut.open_pack('tfh-silver-pack',500,gen_random_uuid())->>'opening_id') is not null,'a superadmin opening (outside the cohort)');
select set_config('request.jwt.claim.sub','65000000-0000-4000-8000-000000000001',true);
create temp table economy on commit drop as select kut.admin_pack_economy() as data;
select is((select array_agg(key order by key) from economy, jsonb_object_keys(data) key),
  array['cohort','flows','measured_at','packs','revision','usage'],'the snapshot has its sections');
select is((select jsonb_array_length(data->'packs') from economy),3,'every pack, on or off');
select ok((select bool_and(p ? 'suggested_price' and p ? 'chance_elite' and p ? 'qualifying_count') from economy, jsonb_array_elements(data->'packs') p),
  'pack rows carry metrics and suggestions');
select results_eq($$select (u->>'price_paid')::bigint,(u->>'openings_28d')::bigint from economy, jsonb_array_elements(data->'usage') u
  where u->>'slug'='tfh-silver-pack' order by 1$$,
  $$values (500::bigint,301::bigint)$$,'usage groups by recorded pack and price paid, without the superadmin');
select is((select (u->>'openings_28d')::bigint from economy, jsonb_array_elements(data->'usage') u
  where u->>'slug'='tfh-pack' and u->>'title'='Regular pack' and u->>'price_paid'='50'),1::bigint,'a manual price shows as its own usage row');
select ok((select (u->>'openings_28d')::bigint >= 300 from economy, jsonb_array_elements(data->'usage') u
  where u->>'slug'='tfh-pack' and u->>'title'='Regular pack' and u->>'price_paid'='250'),'Regular openings at 250 are grouped together');
select is((select (data->'cohort'->>'members')::bigint from economy),
  (select count(*) from kut.profiles where not is_disabled and role <> 'superadmin'),'the cohort is enabled non-superadmin profiles');
select is((select jsonb_array_length(data->'cohort'->'balances')::bigint from economy),
  (select (data->'cohort'->>'members')::bigint from economy),'one anonymous balance per cohort member');
select ok((select (data->'flows'->'packs'->>'net_28d')::numeric <= -(300*250+301*500+100*750+50) from economy),'pack spend is a signed sink');
select is((select array_agg(key order by key) from economy, jsonb_object_keys(data->'flows') key),
  array['admin_adjustments','discards','market_tax','packs','rewards_and_grants'],'five flow groups, always present; transfers are not flows');
insert into kut.wallet_ledger(user_id,amount,reason)
select '65000000-0000-4000-8000-000000000002',amount,reason
from (values (250,'attendance_reward'),(40,'discard'),(-5,'market_tax'),(100,'market_sale'),(-20,'market_buy'),
  (-50,'trade_escrow'),(50,'trade_unescrow'),(30,'admin_correction')) entry(amount,reason);
create temp table economy_after on commit drop as select kut.admin_pack_economy() as data;
select results_eq($$select key, (later.data->'flows'->key->>'net_7d')::bigint - (earlier.data->'flows'->key->>'net_7d')::bigint
  from economy earlier, economy_after later, jsonb_object_keys(later.data->'flows') key order by key$$,
  $$values ('admin_adjustments'::text,30::bigint),('discards',40),('market_tax',-5),('packs',0),('rewards_and_grants',250)$$,
  'rewards, discards and tax are flows; market and escrow transfers are not');
select is((select data->'revision'->>'changed_by_name' from economy),'Pack Tier Admin','the revision names who applied it');
select is((select (data->'revision'->>'revision')::bigint from economy),5::bigint,'and its number');

-- Activity and old-client column order ----------------------------------------------
set local role service_role;
select is((select array_agg(distinct pack_title order by pack_title) from kut.activity_feed where kind='pack' and actor_name='Pack Tier Member'),
  array['Gold pack','Regular pack','Silver pack','TFH Pack'],'pack activity carries the recorded pack name');
select is((select count(*) from kut.activity_feed where kind<>'pack' and (pack_slug is not null or pack_title is not null)),0::bigint,
  'other activity has no pack identity');
reset role;
select is((select array_agg(column_name::text order by ordinal_position) from information_schema.columns where table_schema='kut' and table_name='active_pack_offers'),
  array['slug','title','price','cards_per_pack','min_tier'],'offers only gain min_tier, at the end');
select is((select array_agg(column_name::text order by ordinal_position) from information_schema.columns where table_schema='kut' and table_name='pack_economy_health'),
  array['slug','title','price','cards_per_pack','eligible_live_count','expected_discard_per_slot','expected_discard_per_pack','expected_discard_return_ratio',
    'total_coin_supply','total_pack_openings','total_card_copies','total_burned_cards','is_active','min_tier','qualifying_count'],
  'health keeps its columns and appends three');
select is((select array_agg(column_name::text order by ordinal_position) from information_schema.columns where table_schema='kut' and table_name='activity_feed'),
  array['kind','ts','actor_name','counterparty_name','card_name','amount','session_date','session_type','offered_card_names','pack_slug','pack_title'],
  'activity appends pack identity');
select is((select array_agg(column_name::text order by ordinal_position) from information_schema.columns where table_schema='kut' and table_name='my_pack_opening_results'),
  array['opening_id','opened_at','price_paid','pack_slug','pack_title','slot','card_id','display_name','archetype','ovr','pac','sho','pas','dri','def','phy',
    'rarity_tier','photo_path','player_id','is_live','min_tier','opened_tier','opened_ovr','floor_draw'],
  'results keep their columns and append the opening evidence');

select * from finish();
rollback;
