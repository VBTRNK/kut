-- Talents as named Midweek trialists (20261025000000, ADR-165, #246 S5).
--
-- At the lock, after the simulation, each trialist row gets a frozen display
-- name drawn from the visible Talents with its own seed tag, without repeats
-- within a squad. The engine never sees the names: the stored result is
-- exactly a fresh kut._mm_simulate of the same seed and field.
--
-- Every profile outside this file is opted out a year ago, and every other
-- Player's lifecycle is hidden, so the field is exactly M1-M4 and the pool is:
--   T1 Fenna L., T2 Jip S., T3 Merel D.   visible active Talents (the pool)
--   T4 Sven H.                            a Talent out of view
--   T5 Ina A.                             visible, but inactive
--   R1 Pim L.                             a Retired comeback, visible
-- M1, M3 and M4 own one card (four trialists each), M2 two (three trialists).
-- Week A locks before go-live, week B after it.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path to extensions,kut,public;

select plan(20);

-- ---------------------------------------------------------------------------
-- Shape and access
-- ---------------------------------------------------------------------------
select has_column('kut','midweek_entry_cards','trialist_name','an entry card stores a trialist''s name');
select col_is_null('kut','midweek_entry_cards','trialist_name','null for a card and every week before the rule');
select is((select attname::text from pg_attribute where attrelid = 'kut.midweek_entries_public'::regclass and attnum > 0
    order by attnum desc limit 1),
  'trialist_name', 'midweek_entries_public appends trialist_name after the existing columns');
select function_privs_are('kut','_mm_trialist_names',array['bytea','uuid','text[]'],'authenticated',array[]::text[],
  'members cannot run the draw');
select is((select pg_get_constraintdef(oid) from pg_constraint where conname = 'midweek_entry_cards_trialist_name_check'),
  'CHECK (((trialist_name IS NULL) OR trialist))', 'only a trialist row can carry a name');

-- ---------------------------------------------------------------------------
-- The draw
-- ---------------------------------------------------------------------------
select is(kut._mm_trialist_names(decode(repeat('7e',32),'hex'), '00000166-0000-4000-8000-000000000001', '{}'), '{}'::text[],
  'with no visible Talents every trialist stays anonymous');
select ok((select array(select unnest(drawn) order by 1) = array['a','b','c','d','e']
    and drawn = kut._mm_trialist_names(decode(repeat('7e',32),'hex'), '00000166-0000-4000-8000-000000000001',
      array['a','b','c','d','e'])
    from (select kut._mm_trialist_names(decode(repeat('7e',32),'hex'), '00000166-0000-4000-8000-000000000001',
      array['a','b','c','d','e']) as drawn) draw),
  'a draw is a repeat-free shuffle of the pool, the same for the same seed and entrant');

-- ---------------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------------
delete from kut.academy_go_live;
insert into kut.midweek_opt_outs(user_id, opted_out_at)
select id, now() - interval '1 year' from kut.profiles
on conflict (user_id) do update set opted_out_at = excluded.opted_out_at;
update kut.player_lifecycle set academy_visible = false;

update kut.seasons set is_active = false where is_active;
insert into kut.seasons(id,name,starts_on,is_active) values
  ('00000166-0000-4000-8000-0000000000f0','MW Named Trialists',date '2024-12-02',true);

insert into auth.users(id,email,aud,role,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select ('00000166-0000-4000-8000-00000000000' || n)::uuid, 'mw166-' || n || '@example.test','authenticated','authenticated','{}','{}',now(),now()
from generate_series(1,4) n;
insert into kut.profiles(id,display_name,role,username,is_disabled)
select ('00000166-0000-4000-8000-00000000000' || n)::uuid, 'MW166 M' || n, 'user', 'mw166_' || n, false
from generate_series(1,4) n;

-- Two First Team Players with Live cards.
insert into kut.players(id,slug,display_name,archetype)
select ('00000166-0000-4000-8000-00000000010' || n)::uuid, 'mw166-player-' || n, 'MW166 Player ' || n, 'all_rounder'
from generate_series(1,2) n;
insert into kut.player_season_state(player_id,season_id,activity_score,form_score,live_ovr,pac,sho,pas,dri,def,phy,rarity_tier)
select ('00000166-0000-4000-8000-00000000010' || n)::uuid, '00000166-0000-4000-8000-0000000000f0', 50, 0,
  60, 50, 50, 50, 50, 50, 50, 'silver'
from generate_series(1,2) n;
insert into kut.card_editions(id,player_id,edition_type,title,is_live)
select ('00000166-0000-4000-8000-00000000020' || n)::uuid, ('00000166-0000-4000-8000-00000000010' || n)::uuid, 'live', 'MW166 Live ' || n, true
from generate_series(1,2) n;
insert into kut.user_cards(id,edition_id,owner_id,source)
select ('00000166-0000-4000-8000-0000000003' || m || p)::uuid, ('00000166-0000-4000-8000-00000000020' || p)::uuid,
  ('00000166-0000-4000-8000-00000000000' || m)::uuid, 'pack'
from (values (1,1),(2,1),(2,2),(3,2),(4,1)) owned(m, p);

-- The Academy: Talents, one Retired comeback, and their stored lifecycle.
insert into kut.players(id,slug,display_name,archetype,is_active,is_collectible,lifecycle_stage)
select ('00000166-0000-4000-8000-00000000040' || n)::uuid, 'mw166-academy-' || n, name, 'all_rounder', active, false, stage
from (values (1,'Fenna L.',true,'talent'),(2,'Jip S.',true,'talent'),(3,'Merel D.',true,'talent'),
             (4,'Sven H.',true,'talent'),(5,'Ina A.',false,'talent'),(6,'Pim L.',true,'retired')) academy(n, name, active, stage);
insert into kut.player_lifecycle(player_id, progress, academy_visible)
select ('00000166-0000-4000-8000-00000000040' || n)::uuid, case when n = 4 then 1 else 2 end, n <> 4
from generate_series(1,6) n
on conflict (player_id) do update set progress = excluded.progress, academy_visible = excluded.academy_visible;

-- A published session before each week; weeks A and B, created open.
insert into kut.match_sessions(id,season_id,session_date,session_type,status,published_at) values
  ('00000166-0000-4000-8000-000000000701', '00000166-0000-4000-8000-0000000000f0', date '2025-01-29', 'other', 'published', now()),
  ('00000166-0000-4000-8000-000000000702', '00000166-0000-4000-8000-0000000000f0', date '2025-02-05', 'other', 'published', now());
insert into kut.midweek_tournaments(id,week_start,lock_at,seed_hash)
select ('00000166-0000-4000-8000-0000000005' || s)::uuid, week_start, now() + interval '1 hour',
  encode(sha256(decode(repeat(s, 32),'hex')),'hex')
from (values ('0a', date '2025-02-03'), ('0b', date '2025-02-10')) t(s, week_start);
insert into kut.midweek_tournament_secrets(tournament_id,seed)
select ('00000166-0000-4000-8000-0000000005' || s)::uuid, repeat(s, 32) from unnest(array['0a','0b']) s;

-- ---------------------------------------------------------------------------
-- Before go-live: anonymous trialists
-- ---------------------------------------------------------------------------
update kut.midweek_tournaments set lock_at = now() - interval '2 minutes' where id = '00000166-0000-4000-8000-00000000050a';
select is(kut._mm_lock_tournament('00000166-0000-4000-8000-00000000050a'), 'simulated', 'week A locks before go-live');
select results_eq($$ select count(*) filter (where trialist)::int, count(trialist_name)::int from kut.midweek_entry_cards
    where tournament_id = '00000166-0000-4000-8000-00000000050a' $$,
  $$ values (15, 0) $$, 'before go-live no trialist carries a name');

-- ---------------------------------------------------------------------------
-- After go-live: named trialists
-- ---------------------------------------------------------------------------
insert into kut.academy_go_live(week_start) values (kut._football_week());
update kut.midweek_tournaments set lock_at = now() - interval '1 minute' where id = '00000166-0000-4000-8000-00000000050b';
select is(kut._mm_lock_tournament('00000166-0000-4000-8000-00000000050b'), 'simulated', 'week B locks after go-live');

select is((select count(*)::int from kut.midweek_entry_cards
    where tournament_id = '00000166-0000-4000-8000-00000000050b' and not trialist and trialist_name is not null), 0,
  'a real card never carries a trialist name');
select results_eq($$ select user_id, count(*) filter (where trialist)::int, count(trialist_name)::int,
      count(distinct trialist_name)::int
    from kut.midweek_entry_cards where tournament_id = '00000166-0000-4000-8000-00000000050b'
    group by user_id order by user_id $$,
  $$ values ('00000166-0000-4000-8000-000000000001'::uuid, 4, 3, 3), ('00000166-0000-4000-8000-000000000002'::uuid, 3, 3, 3),
            ('00000166-0000-4000-8000-000000000003'::uuid, 4, 3, 3), ('00000166-0000-4000-8000-000000000004'::uuid, 4, 3, 3) $$,
  'each squad names as many trialists as there are visible Talents, without repeats; the rest stay anonymous');
select is((select array_agg(distinct trialist_name order by trialist_name) from kut.midweek_entry_cards
    where tournament_id = '00000166-0000-4000-8000-00000000050b' and trialist_name is not null),
  array['Fenna L.','Jip S.','Merel D.'],
  'names come only from active Talents in view: not one out of view, inactive or a Retired comeback');
select ok((select bool_and(named.slot < anonymous.slot) from kut.midweek_entry_cards named
    join kut.midweek_entry_cards anonymous on anonymous.tournament_id = named.tournament_id
      and anonymous.user_id = named.user_id and anonymous.trialist and anonymous.trialist_name is null
    where named.tournament_id = '00000166-0000-4000-8000-00000000050b' and named.trialist_name is not null),
  'the first trialist slots take the names, the last ones stay anonymous');
select ok((select count(distinct names) > 1 from (
    select string_agg(trialist_name, ',' order by slot) as names from kut.midweek_entry_cards
    where tournament_id = '00000166-0000-4000-8000-00000000050b' group by user_id) squads),
  'each squad draws its own order');

-- The unchanged-engine assertion: names change nothing the engine produced.
select is(
  (select md5(string_agg(concat_ws('|', user_id, slot, trialist, card_id, player_id, ovr, archetype, injured,
      ovr_factor_ppm, form_roll_ppm, pick_factor_ppm, fitness_ppm, handicap_ppm, power_ppm, att_ppm, mid_ppm, def_ppm),
      ',' order by user_id::text collate "C", slot))
    from kut.midweek_entry_cards where tournament_id = '00000166-0000-4000-8000-00000000050b'),
  (select md5(string_agg(concat_ws('|', entry->>'userId', card->>'slot', (card->>'trialist')::boolean, card->>'cardId',
      card->>'playerId', card->>'ovr', card->>'archetype', (card->>'injured')::boolean, card->>'ovrFactorPpm',
      card->>'formRollPpm', card->>'pickFactorPpm', card->>'fitnessPpm', card->>'handicapPpm', card->>'powerPpm',
      card#>>'{lines,attPpm}', card#>>'{lines,midPpm}', card#>>'{lines,defPpm}'),
      ',' order by entry->>'userId' collate "C", (card->>'slot')::int))
    from jsonb_array_elements(kut._mm_simulate(decode(repeat('0b',32),'hex'),
      kut._mm_field('00000166-0000-4000-8000-00000000050b',
        (select lock_at from kut.midweek_tournaments where id = '00000166-0000-4000-8000-00000000050b'))->'entrants')->'entries') entry,
      jsonb_array_elements(entry->'cards') card),
  'the stored five, trialists included, is exactly a fresh engine run of the same seed and field');
select is(
  (select md5(string_agg(concat_ws('|', round, pairing, side_0_goals, side_1_goals, winner_side), ',' order by round, pairing))
    from kut.midweek_matches where tournament_id = '00000166-0000-4000-8000-00000000050b' and not bye),
  (select md5(string_agg(concat_ws('|', played->>'round', played->>'pairing', played#>>'{outcome,goals,0}',
      played#>>'{outcome,goals,1}', played#>>'{outcome,winnerSide}'),
      ',' order by (played->>'round')::int, (played->>'pairing')::int))
    from jsonb_array_elements(kut._mm_simulate(decode(repeat('0b',32),'hex'),
      kut._mm_field('00000166-0000-4000-8000-00000000050b',
        (select lock_at from kut.midweek_tournaments where id = '00000166-0000-4000-8000-00000000050b'))->'entrants')->'matches') played),
  'and so is every result');

-- ---------------------------------------------------------------------------
-- Frozen, and what members read
-- ---------------------------------------------------------------------------
select throws_ok($$ update kut.midweek_entry_cards set trialist_name = 'Someone Else'
    where tournament_id = '00000166-0000-4000-8000-00000000050b' and trialist_name is not null $$,
  '55000', NULL, 'a stored name never changes');
update kut.players set display_name = 'Fenna Renamed' where id = '00000166-0000-4000-8000-000000000401';

set local role authenticated;
select set_config('request.jwt.claim.sub','00000166-0000-4000-8000-000000000001',true);
select results_eq($$ select count(*) filter (where trialist_name = 'Fenna L.')::int,
      count(*) filter (where trialist_name = 'Fenna Renamed')::int
    from kut.midweek_entries_public where tournament_id = '00000166-0000-4000-8000-00000000050b' $$,
  $$ values (4, 0) $$, 'members read the name as it was at the lock, even after a rename');
select is((select count(trialist_name)::int from kut.midweek_entries_public
    where tournament_id = '00000166-0000-4000-8000-00000000050a'), 0,
  'a week locked before go-live reads as anonymous trialists');
reset role;

select * from finish();
rollback;
