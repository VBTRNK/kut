-- ADR-162: fixed fourth slot, repeatable nominee, one outright winner, no backfill.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path to extensions,kut,public;
select no_plan();

-- One linked reporter per player; no keeper role or card archetype is required.
insert into auth.users(id,email,aud,role,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select ('64000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
  'safe-hands-'||n||'@example.test','authenticated','authenticated','{}','{}',now(),now()
from generate_series(1,7) n;
insert into kut.players(id,slug,display_name,archetype)
select ('64000000-0000-4000-8000-'||lpad((n+10)::text,12,'0'))::uuid,
  'safe-hands-'||n,'Safe Hands '||n,'all_rounder' from generate_series(1,7) n;
insert into kut.profiles(id,display_name,role,player_id)
select ('64000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'Safe Hands '||n,
  case when n=1 then 'admin' else 'user' end,
  ('64000000-0000-4000-8000-'||lpad((n+10)::text,12,'0'))::uuid
from generate_series(1,7) n;
update kut.seasons set is_active=false where is_active;
insert into kut.seasons(id,name,starts_on,is_active)
values('64000000-0000-4000-8000-000000000040','Safe Hands test',current_date-14,true);
update kut.season_rating_rules set v2_starts_week=date_trunc('week',current_date)::date
where season_id='64000000-0000-4000-8000-000000000040';

insert into kut.match_sessions(id,season_id,session_date,session_type,status,created_by)
values('64000000-0000-4000-8000-000000000041','64000000-0000-4000-8000-000000000040',current_date,'other','draft','64000000-0000-4000-8000-000000000001');
insert into kut.attendance(session_id,player_id,goals)
select '64000000-0000-4000-8000-000000000041',id,0 from kut.players where slug like 'safe-hands-%';
set local role authenticated;
set local request.jwt.claim.sub='64000000-0000-4000-8000-000000000001';
select kut.publish_session('64000000-0000-4000-8000-000000000041');
reset role;

select is((select rules_version from kut.session_surveys where session_id='64000000-0000-4000-8000-000000000041'),3,'newly opened surveys use the new ballot version');
select is((select cardinality(category_ids) from kut.session_surveys where session_id='64000000-0000-4000-8000-000000000041'),4,'three rotating categories plus a fourth slot');
select is((select category_ids[4] from kut.session_surveys where session_id='64000000-0000-4000-8000-000000000041'),'10000000-0000-4000-8000-000000000008'::uuid,'Safe Hands is always last');
select is((select count(distinct category) from kut.session_surveys,unnest(category_ids[1:3]) category where session_id='64000000-0000-4000-8000-000000000041'),3::bigint,'three different ordinary categories remain');

-- Local transaction helpers keep every submission on the public RPC path.
create function public.sh_ballot(p_keeper integer,p_regular integer default 0) returns jsonb
language sql stable as $$
  select jsonb_object_agg(category::text,
    case when (ordinal=4 and p_keeper>0) or (ordinal=1 and p_regular>0)
      then to_jsonb('64000000-0000-4000-8000-'||lpad((10+case when ordinal=4 then p_keeper else p_regular end)::text,12,'0'))
      else 'null'::jsonb end)
  from unnest((select category_ids from kut.session_surveys where session_id='64000000-0000-4000-8000-000000000041')) with ordinality picked(category,ordinal)
$$;
create function public.sh_submit(p_nominator integer,p_keeper integer,p_regular integer default 0) returns jsonb
language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub','64000000-0000-4000-8000-'||lpad(p_nominator::text,12,'0'),true);
  return kut.submit_session_report('64000000-0000-4000-8000-000000000041',0,public.sh_ballot(p_keeper,p_regular),
    coalesce((select revision from kut.session_reports where session_id='64000000-0000-4000-8000-000000000041' and player_id=('64000000-0000-4000-8000-'||lpad((p_nominator+10)::text,12,'0'))::uuid),0),gen_random_uuid(),'submit');
end $$;

set local role authenticated;
select lives_ok($$select public.sh_submit(2,1,1)$$,'Safe Hands may repeat a regular nominee through the RPC');
select is((select count(*) from kut.session_kudos where session_id='64000000-0000-4000-8000-000000000041' and nominator_player_id='64000000-0000-4000-8000-000000000012'),2::bigint,'both nominations are stored');
select throws_ok($$select public.sh_submit(2,2)$$,'22023',null,'self nomination is forbidden');
select throws_ok($$select kut.submit_session_report('64000000-0000-4000-8000-000000000041',0,
  public.sh_ballot(1,1)||jsonb_build_object((select category_ids[2]::text from kut.session_surveys where session_id='64000000-0000-4000-8000-000000000041'),'64000000-0000-4000-8000-000000000011'),1,gen_random_uuid(),'submit')$$,
  '22023',null,'the three regular nominees must still differ');
select throws_ok($$select kut.submit_session_report('64000000-0000-4000-8000-000000000041',0,
  public.sh_ballot(1)-'10000000-0000-4000-8000-000000000008',1,gen_random_uuid(),'submit')$$,
  '22023',null,'unanswered Safe Hands is not an explicit Skip');
select throws_ok($$select kut.submit_session_report('64000000-0000-4000-8000-000000000041',0,
  public.sh_ballot(1)||jsonb_build_object('10000000-0000-4000-8000-000000000008','64000000-0000-4000-8000-000000000099'),1,gen_random_uuid(),'submit')$$,
  '22023',null,'nominee must attend the session');
select throws_ok($$select kut.submit_session_report('64000000-0000-4000-8000-000000000041',0,
  public.sh_ballot(1)||'{"10000000-0000-4000-8000-000000000099":null}'::jsonb,1,gen_random_uuid(),'submit')$$,
  '22023',null,'categories outside the stored ballot are rejected');
select public.sh_submit(2,1,1);
select is((select count(*) from kut.session_report_rewards where session_id='64000000-0000-4000-8000-000000000041'),1::bigint,'edits still pay 50 coins only once');
select public.sh_submit(3,1,1);
reset role;

select kut._finalize_one_session('64000000-0000-4000-8000-000000000041');
select is((select kudos_form from kut.session_report_results where session_id='64000000-0000-4000-8000-000000000041' and player_id='64000000-0000-4000-8000-000000000011'),0::numeric,'two reporters cannot clear the participation gate');
update kut.session_surveys set status='open',finalized_at=null where session_id='64000000-0000-4000-8000-000000000041';
set local role authenticated;
select lives_ok($$select public.sh_submit(1,0)$$,'an explicit zero and four Skips form a complete submission');
reset role;
select kut._finalize_one_session('64000000-0000-4000-8000-000000000041');
select is((select kudos_form from kut.session_report_results where session_id='64000000-0000-4000-8000-000000000041' and player_id='64000000-0000-4000-8000-000000000011'),0::numeric,'an all-Skip reporter does not count towards the kudos participation gate');
update kut.session_surveys set status='open',finalized_at=null where session_id='64000000-0000-4000-8000-000000000041';
set local role authenticated;
select public.sh_submit(4,1);
reset role;
select kut._finalize_one_session('64000000-0000-4000-8000-000000000041');
select is((select kudos_form from kut.session_report_results where session_id='64000000-0000-4000-8000-000000000041' and player_id='64000000-0000-4000-8000-000000000011'),1.5::numeric,'Safe Hands and one regular award use the ordinary two-category ladder');
select is((select count(*) from kut.session_report_results where session_id='64000000-0000-4000-8000-000000000041' and '10000000-0000-4000-8000-000000000008'::uuid=any(qualified_category_ids)),1::bigint,'there is exactly one Safe Hands winner across the session');
select matches((select body from kut.user_notifications where reference_id='64000000-0000-4000-8000-000000000041' and user_id='64000000-0000-4000-8000-000000000001' and event_type='kudos_awarded'),'Safe Hands','the normal award notice names Safe Hands');
create temporary table sh_results as select player_id,goal_form,kudos_form,session_input,qualified_category_ids
from kut.session_report_results where session_id='64000000-0000-4000-8000-000000000041';
select kut._finalize_one_session('64000000-0000-4000-8000-000000000041');
select results_eq('select player_id,goal_form,kudos_form,session_input,qualified_category_ids from kut.session_report_results where session_id=''64000000-0000-4000-8000-000000000041'' order by player_id',
  'select * from sh_results order by player_id','re-finalization reconstructs the same scores from history');

-- A second keeper with two nominations still loses to the leader with three.
update kut.session_surveys set status='open',finalized_at=null where session_id='64000000-0000-4000-8000-000000000041';
set local role authenticated;
select public.sh_submit(5,2);
select public.sh_submit(6,2);
reset role;
select kut._finalize_one_session('64000000-0000-4000-8000-000000000041');
select ok(not (select '10000000-0000-4000-8000-000000000008'::uuid=any(qualified_category_ids) from kut.session_report_results where session_id='64000000-0000-4000-8000-000000000041' and player_id='64000000-0000-4000-8000-000000000012'),'a runner-up with two nominations receives no Safe Hands award');
update kut.session_surveys set status='open',finalized_at=null where session_id='64000000-0000-4000-8000-000000000041';
set local role authenticated;
select public.sh_submit(7,2);
reset role;
select kut._finalize_one_session('64000000-0000-4000-8000-000000000041');
select is((select count(*) from kut.session_report_results where session_id='64000000-0000-4000-8000-000000000041' and '10000000-0000-4000-8000-000000000008'::uuid=any(qualified_category_ids)),0::bigint,'tied leaders receive no award');

-- Drafts neither decide the winner nor supply the turnout minimum.
update kut.session_reports set status='draft',submitted_at=null where session_id='64000000-0000-4000-8000-000000000041' and player_id='64000000-0000-4000-8000-000000000017';
select kut._finalize_one_session('64000000-0000-4000-8000-000000000041');
select ok((select '10000000-0000-4000-8000-000000000008'::uuid=any(qualified_category_ids) from kut.session_report_results where session_id='64000000-0000-4000-8000-000000000041' and player_id='64000000-0000-4000-8000-000000000011'),'a draft nomination cannot create a tie');

-- Safe Hands alone is 1; two nominations and a regular-only third reporter qualify.
delete from kut.session_kudos where session_id='64000000-0000-4000-8000-000000000041';
insert into kut.session_kudos(session_id,nominator_player_id,category_id,recipient_player_id) values
('64000000-0000-4000-8000-000000000041','64000000-0000-4000-8000-000000000012','10000000-0000-4000-8000-000000000008','64000000-0000-4000-8000-000000000011'),
('64000000-0000-4000-8000-000000000041','64000000-0000-4000-8000-000000000013','10000000-0000-4000-8000-000000000008','64000000-0000-4000-8000-000000000011');
insert into kut.session_kudos(session_id,nominator_player_id,category_id,recipient_player_id)
select session_id,'64000000-0000-4000-8000-000000000014',category_ids[1],'64000000-0000-4000-8000-000000000012'
from kut.session_surveys where session_id='64000000-0000-4000-8000-000000000041';
select kut._finalize_one_session('64000000-0000-4000-8000-000000000041');
select is((select kudos_form from kut.session_report_results where session_id='64000000-0000-4000-8000-000000000041' and player_id='64000000-0000-4000-8000-000000000011'),1::numeric,'Safe Hands alone gives the ordinary one-category input');
delete from kut.session_kudos where session_id='64000000-0000-4000-8000-000000000041' and nominator_player_id='64000000-0000-4000-8000-000000000013';
insert into kut.session_kudos(session_id,nominator_player_id,category_id,recipient_player_id)
select session_id,'64000000-0000-4000-8000-000000000013',category_ids[1],'64000000-0000-4000-8000-000000000012'
from kut.session_surveys where session_id='64000000-0000-4000-8000-000000000041';
select kut._finalize_one_session('64000000-0000-4000-8000-000000000041');
select ok(not (select '10000000-0000-4000-8000-000000000008'::uuid=any(qualified_category_ids) from kut.session_report_results where session_id='64000000-0000-4000-8000-000000000041' and player_id='64000000-0000-4000-8000-000000000011'),'one nomination cannot win despite sufficient turnout');

-- Two nominators per regular category, keeping each ballot's regular picks unique.
delete from kut.session_kudos where session_id='64000000-0000-4000-8000-000000000041';
update kut.session_reports set status='submitted',submitted_at=now() where session_id='64000000-0000-4000-8000-000000000041';
insert into kut.session_kudos(session_id,nominator_player_id,category_id,recipient_player_id)
select s.session_id,('64000000-0000-4000-8000-'||lpad((n+10)::text,12,'0'))::uuid,
  s.category_ids[((n-2)/2)+1],'64000000-0000-4000-8000-000000000011'
from kut.session_surveys s cross join generate_series(2,7) n where s.session_id='64000000-0000-4000-8000-000000000041';
insert into kut.session_kudos(session_id,nominator_player_id,category_id,recipient_player_id)
select s.session_id,('64000000-0000-4000-8000-'||lpad((n+10)::text,12,'0'))::uuid,
  s.category_ids[4],'64000000-0000-4000-8000-000000000011'
from kut.session_surveys s cross join generate_series(2,3) n where s.session_id='64000000-0000-4000-8000-000000000041';
select kut._finalize_one_session('64000000-0000-4000-8000-000000000041');
select is((select kudos_form from kut.session_report_results where session_id='64000000-0000-4000-8000-000000000041' and player_id='64000000-0000-4000-8000-000000000011'),2::numeric,'four recognised categories still cap kudos at two');
update kut.session_reports set goals=99 where session_id='64000000-0000-4000-8000-000000000041' and player_id='64000000-0000-4000-8000-000000000011';
select kut._finalize_one_session('64000000-0000-4000-8000-000000000041');
select is((select session_input from kut.session_report_results where session_id='64000000-0000-4000-8000-000000000041' and player_id='64000000-0000-4000-8000-000000000011'),3.5::numeric,'G+A and kudos retain the 3.5 session input cap');

-- Simulate a legacy ballot snapshot. Re-finalization must not invent Safe Hands.
update kut.session_surveys set category_ids=category_ids[1:3],rules_version=2,status='open',finalized_at=null
where session_id='64000000-0000-4000-8000-000000000041';
set local role authenticated;
set local request.jwt.claim.sub='64000000-0000-4000-8000-000000000002';
select throws_ok($$select kut.submit_session_report('64000000-0000-4000-8000-000000000041',0,
  public.sh_ballot(0)||'{"10000000-0000-4000-8000-000000000008":"64000000-0000-4000-8000-000000000011"}'::jsonb,
  (select revision from kut.session_reports where session_id='64000000-0000-4000-8000-000000000041' and player_id='64000000-0000-4000-8000-000000000012'),gen_random_uuid(),'submit')$$,
  '22023',null,'an old open report cannot gain a keeper nomination');
select lives_ok($$select public.sh_submit(2,0,1)$$,'the old three-slot ballot remains submittable');
reset role;
select kut._finalize_one_session('64000000-0000-4000-8000-000000000041');
select is((select cardinality(qualified_category_ids) from kut.session_report_results where session_id='64000000-0000-4000-8000-000000000041' and player_id='64000000-0000-4000-8000-000000000011'),3,'legacy results recognise only their original categories');
select ok(not has_function_privilege('authenticated','kut._finalize_one_session(uuid)','execute'),'members still cannot finalize directly');

select * from finish();
rollback;
