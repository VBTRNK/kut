-- Midweek Madness 3.0, S2 (20261020000000): club names in the Midweek views.
-- VBTRNK/kut#262; ADR-145.
--
-- The four views that name a member append the club: the name set in Settings,
-- trimmed, or "<display name>'s Club" when it is null or blank, exactly as
-- kut.club_value_leaderboard does. A bye has no second club. The champion's
-- club shows exactly when the champion does. Gates, definer and security
-- barrier are unchanged (the other midweek_* files test each gate in full).
--
-- Every profile outside this file is opted out a year ago, so the field is
-- exactly M1-M7, seven active members with one card each: seven entrants, a
-- bye in round 1, three rounds (the final at lock + 35 min).
--
--   TL  locked 36 minutes ago  -> the final kicked off a minute ago
--   TC  locked 3 hours ago     -> complete
-- A is disabled.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path to extensions,kut,public;

select plan(26);

-- ---------------------------------------------------------------------------
-- Shape and options
-- ---------------------------------------------------------------------------
select has_column('kut','midweek_matches_public','side_0_club','matches carry side 0''s club');
select has_column('kut','midweek_matches_public','side_1_club','and side 1''s');
select has_column('kut','midweek_draw_public','side_0_club','the draw carries side 0''s club');
select has_column('kut','midweek_draw_public','side_1_club','and side 1''s');
select has_column('kut','midweek_entries_public','club_name','entries carry the manager''s club');
select has_column('kut','midweek_tournaments_public','champion_club','tournaments carry the champion''s club');
select is((select count(*)::int from pg_class where relnamespace = 'kut'::regnamespace
  and relname in ('midweek_matches_public','midweek_draw_public','midweek_entries_public','midweek_tournaments_public')
  and reloptions @> array['security_invoker=false','security_barrier=true']),4,
  'all four stay definer views with a security barrier (never security_invoker, KB-013)');

-- ---------------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------------
insert into kut.midweek_opt_outs(user_id, opted_out_at)
select id, now() - interval '1 year' from kut.profiles
on conflict (user_id) do update set opted_out_at = excluded.opted_out_at;
update kut.seasons set is_active = false where is_active;
insert into kut.seasons(id,name,starts_on,is_active) values
('00000145-0000-4000-8000-0000000000f0','MW Club Test',date '2024-12-02',true);

insert into auth.users(id,email,aud,role,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select ('00000145-0000-4000-8000-00000000000' || n)::uuid, 'mw145-' || n || '@example.test','authenticated','authenticated','{}','{}',now(),now()
from unnest(array['1','2','3','4','5','6','7','a']) n;
-- M1 set a club, M2 a blank one, M3 only spaces, M4 none, M5 one with spaces
-- around it; M6, M7 and A set none.
insert into kut.profiles(id,display_name,role,username,is_disabled,club_name)
select ('00000145-0000-4000-8000-00000000000' || n)::uuid, 'MW145 ' || n, 'user', 'mw145_' || n, n = 'a',
  case n when '1' then 'Stijnfeld United' when '2' then '' when '3' then '   ' when '5' then '  Padded FC  ' end
from unnest(array['1','2','3','4','5','6','7','a']) n;
insert into kut.players(id,slug,display_name,archetype)
select ('00000145-0000-4000-8000-00000000010' || n)::uuid, 'mw145-player-' || n, 'MW145 Player ' || n,
  (array['goalkeeper','finisher','speedster','playmaker','defender','all_rounder','all_rounder'])[n]
from generate_series(1,7) n;
insert into kut.player_season_state(player_id,season_id,activity_score,form_score,live_ovr,pac,sho,pas,dri,def,phy,rarity_tier)
select ('00000145-0000-4000-8000-00000000010' || n)::uuid, '00000145-0000-4000-8000-0000000000f0', 50, 0,
  60, 50, 50, 50, 50, 50, 50, 'silver'
from generate_series(1,7) n;
insert into kut.card_editions(id,player_id,edition_type,title,is_live)
select ('00000145-0000-4000-8000-00000000020' || n)::uuid, ('00000145-0000-4000-8000-00000000010' || n)::uuid, 'live', 'MW145 Live ' || n, true
from generate_series(1,7) n;
insert into kut.user_cards(id,edition_id,owner_id,source)
select ('00000145-0000-4000-8000-00000000030' || n)::uuid, ('00000145-0000-4000-8000-00000000020' || n)::uuid,
  ('00000145-0000-4000-8000-00000000000' || n)::uuid, 'pack'
from generate_series(1,7) n;
-- A published session every week, so no week is a club break.
insert into kut.match_sessions(id,season_id,session_date,session_type,status,published_at)
select ('00000145-0000-4000-8000-0000000007' || lpad(n::text,2,'0'))::uuid, '00000145-0000-4000-8000-0000000000f0',
  date '2025-01-01' + 7 * n, 'other', 'published', now()
from generate_series(1,20) n;

-- Week w is seed s; created open, then moved to its lock.
insert into kut.midweek_tournaments(id,week_start,lock_at,seed_hash,schedule_version)
select ('00000145-0000-4000-8000-0000000005' || s)::uuid, date '2025-01-06' + 7 * w, now() + interval '1 day',
  encode(sha256(decode(repeat(s, 32),'hex')),'hex'), 2
from (values ('0a', 1), ('0c', 2)) t(s, w);
insert into kut.midweek_tournament_secrets(tournament_id,seed)
select ('00000145-0000-4000-8000-0000000005' || s)::uuid, repeat(s, 32)
from unnest(array['0a','0c']) s;
update kut.midweek_tournaments t set lock_at = now() - o
from (values ('0a', interval '36 minutes'), ('0c', interval '3 hours')) x(s, o)
where t.id = ('00000145-0000-4000-8000-0000000005' || x.s)::uuid;

set local role service_role; set local request.jwt.claim.role = 'service_role';
select kut.run_midweek_due(10);
reset role; select set_config('request.jwt.claim.role','',true);
select results_eq($q$select status::text, rounds::int from kut.midweek_tournaments
  where id::text like '00000145-%' order by lock_at$q$,
  $q$values ('complete'::text, 3), ('simulated'::text, 3)$q$,
  'TC is complete and TL is drawn, both three rounds');
select ok((select count(*) = 1 and bool_and(side_1_user_id is null) from kut.midweek_matches
  where tournament_id = '00000145-0000-4000-8000-00000000050a' and round = 1 and bye),
  'round 1 has a bye');

-- The expected club of every member in this file.
create temporary table mw145_expected(user_id uuid primary key, club text) on commit drop;
insert into mw145_expected values
  ('00000145-0000-4000-8000-000000000001','Stijnfeld United'),
  ('00000145-0000-4000-8000-000000000002','MW145 2''s Club'),
  ('00000145-0000-4000-8000-000000000003','MW145 3''s Club'),
  ('00000145-0000-4000-8000-000000000004','MW145 4''s Club'),
  ('00000145-0000-4000-8000-000000000005','Padded FC'),
  ('00000145-0000-4000-8000-000000000006','MW145 6''s Club'),
  ('00000145-0000-4000-8000-000000000007','MW145 7''s Club');
grant select on mw145_expected to authenticated;

-- ---------------------------------------------------------------------------
-- As an ordinary member
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claim.sub','00000145-0000-4000-8000-000000000001',true);

-- Entries: one club per manager, each case.
select is((select string_agg(distinct club_name, ',') from kut.midweek_entries_public
  where user_id = '00000145-0000-4000-8000-000000000001'),'Stijnfeld United','a set club name shows as set');
select is((select string_agg(distinct club_name, ',') from kut.midweek_entries_public
  where user_id = '00000145-0000-4000-8000-000000000002'),'MW145 2''s Club','a blank one falls back to the default');
select is((select string_agg(distinct club_name, ',') from kut.midweek_entries_public
  where user_id = '00000145-0000-4000-8000-000000000003'),'MW145 3''s Club','so does one of only spaces');
select is((select string_agg(distinct club_name, ',') from kut.midweek_entries_public
  where user_id = '00000145-0000-4000-8000-000000000004'),'MW145 4''s Club','and a null one');
select is((select string_agg(distinct club_name, ',') from kut.midweek_entries_public
  where user_id = '00000145-0000-4000-8000-000000000005'),'Padded FC','a padded one shows trimmed');
select is((select count(*)::int from kut.midweek_entries_public e
  join mw145_expected x on x.user_id = e.user_id
  where e.tournament_id::text like '00000145-%' and e.club_name is distinct from x.club),0,
  'every entry row carries its manager''s club');
select is((select count(*)::int from kut.midweek_entries_public e where e.tournament_id::text like '00000145-%'
  and e.manager_name is distinct from 'MW145 ' || right(e.user_id::text, 1)),0,
  'and still the account name beside it');

-- The draw and the matches: both sides, a bye has no second club.
select is((select count(*)::int from kut.midweek_draw_public d
  left join mw145_expected x0 on x0.user_id = d.side_0_user_id
  left join mw145_expected x1 on x1.user_id = d.side_1_user_id
  where d.tournament_id::text like '00000145-%'
    and (d.side_0_club is distinct from x0.club or d.side_1_club is distinct from x1.club)),0,
  'the draw names each side''s club');
select ok((select count(*) = 2 and bool_and(side_1_club is null and side_0_club is not null) from kut.midweek_draw_public
  where tournament_id::text like '00000145-%' and bye),'and no second club on a bye');
select is((select count(*)::int from kut.midweek_matches_public m
  left join mw145_expected x0 on x0.user_id = m.side_0_user_id
  left join mw145_expected x1 on x1.user_id = m.side_1_user_id
  where m.tournament_id::text like '00000145-%'
    and (m.side_0_club is distinct from x0.club or m.side_1_club is distinct from x1.club)),0,
  'every match names each side''s club');
select ok((select bool_and(side_1_club is null) from kut.midweek_matches_public
  where tournament_id::text like '00000145-%' and bye),'with no second club on a bye');
select results_eq($q$select in_play, winner_side is null, side_0_club is not null and side_1_club is not null
  from kut.midweek_matches_public where tournament_id = '00000145-0000-4000-8000-00000000050a' and round = 3$q$,
  $q$values (true, true, true)$q$,'a final in play names both clubs and still no winner');

-- The champion's club, with the champion.
select results_eq($q$select champion_user_id, champion_name, champion_club from kut.midweek_tournaments_public
  where tournament_id = '00000145-0000-4000-8000-00000000050a'$q$,
  $q$values (null::uuid, null::text, null::text)$q$,'while the final plays, no champion and no club');
select ok((select t.champion_club = x.club from kut.midweek_tournaments_public t
  join mw145_expected x on x.user_id = t.champion_user_id
  where t.tournament_id = '00000145-0000-4000-8000-00000000050c'),
  'once the final has ended the champion''s club is named');

-- A disabled member reads none of it; anon cannot read.
select set_config('request.jwt.claim.sub','00000145-0000-4000-8000-00000000000a',true);
select is((select (select count(*) from kut.midweek_matches_public) + (select count(*) from kut.midweek_draw_public)
  + (select count(*) from kut.midweek_entries_public) + (select count(*) from kut.midweek_tournaments_public))::int,0,
  'a disabled member reads no club');
reset role;
select set_config('request.jwt.claim.sub','',true);
set local role anon;
select throws_ok($q$select side_0_club from kut.midweek_matches_public$q$,'42501',NULL,'anon cannot read the matches');
select throws_ok($q$select club_name from kut.midweek_entries_public$q$,'42501',NULL,'nor the entries');
reset role;

select * from finish();
rollback;
