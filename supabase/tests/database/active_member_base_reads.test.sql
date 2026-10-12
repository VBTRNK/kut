-- #286: populated direct reads, inherited invoker reads and photo RLS.
-- Synthetic fixtures only; every mutation rolls back on the local test stack.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path to extensions, kut, public;
select plan(212);

select is((select count(*)::int from pg_policies where schemaname='kut'
  and policyname='active membership required for reads' and permissive='RESTRICTIVE'
  and cmd='SELECT' and roles=array['authenticated']::name[]),31,
  'all 31 affected tables have restrictive authenticated SELECT gates');
select is((select count(*)::int from pg_policies p where p.schemaname='kut'
  and p.tablename <> 'profiles' and p.permissive='PERMISSIVE' and p.cmd in ('SELECT','ALL')
  and 'authenticated'=any(p.roles) and p.qual not in ('kut.is_admin()','is_admin()')
  and p.qual not like '%is_active_member%'
  and not exists(select 1 from pg_policies gate where gate.schemaname=p.schemaname
    and gate.tablename=p.tablename and gate.permissive='RESTRICTIVE'
    and gate.cmd='SELECT' and gate.qual like '%is_active_member%')),0,
  'no other permissive member read policy bypasses membership');
select ok((select not public from storage.buckets where id='player-photos'),
  'the player-photo bucket remains private');
select ok((select bool_and(reloptions @> array['security_invoker=false','security_barrier=true'])
  from pg_class where oid in ('kut.public_live_ratings'::regclass,
    'kut.chronicle_session_reports'::regclass,'kut.active_market_listings'::regclass)),
  'member-wide definer projections retain owner rights and barriers');

create temporary table read_members(id uuid primary key, slug text);
insert into read_members values
('00000286-0000-4000-8000-0000000000a1','privacy-active'),
('00000286-0000-4000-8000-0000000000c1','privacy-disabled');
insert into auth.users(id,email,aud,role,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select id,slug || '@example.test','authenticated','authenticated','{}','{}',now(),now()
from read_members;
insert into auth.users(id,email,aud,role,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('00000286-0000-4000-8000-0000000000d1','privacy-other-tool@example.test','authenticated','authenticated','{}','{}',now(),now()),
('00000286-0000-4000-8000-0000000000e1','privacy-admin@example.test','authenticated','authenticated','{}','{}',now(),now());
insert into kut.players(id,slug,display_name) select id,slug,slug from read_members;
insert into kut.profiles(id,display_name,role,player_id,username)
select id,slug,'user',id,replace(slug,'-','_') from read_members;
insert into kut.profiles(id,display_name,role,username) values
('00000286-0000-4000-8000-0000000000e1','Privacy Admin','admin','privacy_admin');

update kut.seasons set is_active=false where is_active;
insert into kut.seasons(id,name,starts_on,is_active) values
('00000286-0000-4000-8000-000000000200','Privacy Test Season',current_date-14,true);
update kut.season_rating_rules set v2_starts_week=date_trunc('week',current_date)::date
where season_id='00000286-0000-4000-8000-000000000200';
insert into kut.player_season_state(player_id,season_id,activity_score,form_score,live_ovr,pac,sho,pas,dri,def,phy,rarity_tier,last_week_start)
select id,'00000286-0000-4000-8000-000000000200',50,0,60,60,60,60,60,60,60,'gold',date_trunc('week',current_date)::date
from read_members;
insert into kut.card_editions(id,player_id,edition_type,title,is_live)
select id,id,'live',slug,true from read_members;
insert into kut.user_cards(id,edition_id,owner_id,source) select id,id,id,'pack' from read_members;
insert into kut.wallets(user_id,balance) select id,500 from read_members;
insert into kut.wallet_ledger(id,user_id,amount,reason) select id,id,50,'admin_grant' from read_members;
insert into kut.user_notifications(id,user_id,event_type,title,body)
select id,id,'admin_notice','Privacy fixture','Synthetic test notification' from read_members;

insert into kut.match_sessions(id,season_id,session_date,session_type,status,published_at,rating_rules_version) values
('00000286-0000-4000-8000-000000000701','00000286-0000-4000-8000-000000000200',current_date,'other','published',now(),2),
('00000286-0000-4000-8000-000000000702','00000286-0000-4000-8000-000000000200',current_date+1,'other','draft',null,2);
insert into kut.attendance(session_id,player_id)
select '00000286-0000-4000-8000-000000000701',id from read_members;
insert into kut.attendance_rewards(session_id,player_id,user_id,ledger_id)
select '00000286-0000-4000-8000-000000000701',id,id,id from read_members
on conflict do nothing;
insert into kut.bibs_rewards(session_id,player_id,user_id,ledger_id)
select '00000286-0000-4000-8000-000000000701',id,id,id from read_members;
insert into kut.kudos_categories(id,slug,title,description) values
('00000286-0000-4000-8000-000000000901','privacy-category','Privacy Category','Synthetic category');
insert into kut.session_surveys(session_id,status,opened_at,closes_at,category_ids,selection_seed,finalized_at) values
('00000286-0000-4000-8000-000000000701','finalized',now()-interval '25 hours',now()-interval '1 hour',
 array['10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','00000286-0000-4000-8000-000000000901']::uuid[],gen_random_uuid(),now());
insert into kut.session_survey_eligibility(session_id,player_id,user_id)
select '00000286-0000-4000-8000-000000000701',id,id from read_members;
insert into kut.session_reports(session_id,player_id,submitted_by,goals,status,submitted_at)
select '00000286-0000-4000-8000-000000000701',id,id,1,'submitted',now() from read_members;
insert into kut.session_kudos(session_id,nominator_player_id,category_id,recipient_player_id)
select '00000286-0000-4000-8000-000000000701',a.id,'00000286-0000-4000-8000-000000000901',b.id
from read_members a join read_members b on a.id<>b.id;
insert into kut.session_report_requests(user_id,idempotency_key,session_id,result)
select id,id,'00000286-0000-4000-8000-000000000701','{}' from read_members;
insert into kut.session_report_rewards(session_id,player_id,user_id,amount,ledger_id)
select '00000286-0000-4000-8000-000000000701',id,id,50,id from read_members;
insert into kut.session_report_results(session_id,player_id,effective_goals,goal_form,kudos_form,session_input)
select '00000286-0000-4000-8000-000000000701',id,1,1,0,1 from read_members;

insert into kut.pack_definitions(id,slug,title,price,cards_per_pack,is_active) values
('00000286-0000-4000-8000-000000000801','privacy-pack','Privacy Pack',250,1,true),
('00000286-0000-4000-8000-000000000802','privacy-inactive','Privacy Inactive',250,1,false);
insert into kut.pack_openings(id,user_id,pack_id,price_paid,idempotency_key)
select id,id,'00000286-0000-4000-8000-000000000801',250,id from read_members;
insert into kut.pack_opening_cards(opening_id,slot,card_id) select id,1,id from read_members;
insert into kut.market_listings(id,card_id,seller_id,price) select id,id,id,100 from read_members;
insert into kut.market_sales(id,listing_id,card_id,edition_id,seller_id,buyer_id,sale_price,tax_amount,seller_receipt,buyer_idempotency_key)
select a.id,a.id,a.id,a.id,a.id,b.id,100,5,95,a.id from read_members a join read_members b on a.id<>b.id;
insert into kut.trade_offers(id,listing_id,proposer_id,seller_id,offered_coins,proposer_idempotency_key)
select a.id,a.id,b.id,a.id,50,a.id from read_members a join read_members b on a.id<>b.id;
insert into kut.trade_offer_cards(offer_id,card_id)
select a.id,b.id from read_members a join read_members b on a.id<>b.id;
insert into kut.card_wants(user_id,edition_id) select id,id from read_members;
insert into kut.trade_availability(card_id,owner_id) select id,id from read_members;
insert into kut.injury_periods(id,player_id,started_on) select id,id,current_date from read_members;
insert into kut.injury_check_ins(player_id,week_start,period_id,user_id,amount,ledger_id)
select id,date_trunc('week',current_date)::date,id,id,100,id from read_members;

insert into storage.objects(bucket_id,name) values
('player-photos','players/00000286-0000-4000-8000-0000000000a1/profile.webp');
insert into storage.buckets(id,name,public) values ('privacy-other-tool','privacy-other-tool',false);
insert into storage.objects(bucket_id,name) values ('privacy-other-tool','private.webp');

-- Every affected base table has real rows, including the soon-disabled owner's.
create temporary table read_cases(relation text, predicate text, member_count int, admin_count int, service_count int);
insert into read_cases values
('players',$q$id::text like '00000286-%'$q$,2,2,2),
('seasons',$q$id::text like '00000286-%'$q$,1,1,1),
('match_sessions',$q$id::text like '00000286-%'$q$,1,2,2),
('attendance',$q$player_id::text like '00000286-%'$q$,2,2,2),
('player_season_state',$q$player_id::text like '00000286-%'$q$,2,2,2),
('card_editions',$q$id::text like '00000286-%'$q$,2,2,2),
('user_cards',$q$id::text like '00000286-%'$q$,1,2,2),
('wallets',$q$user_id::text like '00000286-%'$q$,1,2,2),
('wallet_ledger',$q$id::text like '00000286-%'$q$,1,2,2),
('attendance_rewards',$q$player_id::text like '00000286-%'$q$,1,2,2),
('pack_definitions',$q$id::text like '00000286-%'$q$,1,2,2),
('pack_openings',$q$id::text like '00000286-%'$q$,1,2,2),
('pack_opening_cards',$q$card_id::text like '00000286-%'$q$,1,2,2),
('market_listings',$q$id::text like '00000286-%'$q$,2,2,2),
('market_sales',$q$id::text like '00000286-%'$q$,2,2,2),
('user_notifications',$q$id::text like '00000286-%'$q$,1,0,2),
('player_rating_snapshots',$q$player_id::text like '00000286-%'$q$,2,2,2),
('bibs_rewards',$q$player_id::text like '00000286-%'$q$,1,2,2),
('trade_offers',$q$id::text like '00000286-%'$q$,2,2,2),
('trade_offer_cards',$q$card_id::text like '00000286-%'$q$,2,2,2),
('card_wants',$q$user_id::text like '00000286-%'$q$,1,2,2),
('trade_availability',$q$owner_id::text like '00000286-%'$q$,1,2,2),
('kudos_categories',$q$id::text like '00000286-%'$q$,1,1,1),
('session_surveys',$q$session_id::text like '00000286-%'$q$,1,1,1),
('session_survey_eligibility',$q$player_id::text like '00000286-%'$q$,1,2,2),
('session_reports',$q$player_id::text like '00000286-%'$q$,1,2,2),
('session_kudos',$q$nominator_player_id::text like '00000286-%'$q$,1,2,2),
('session_report_requests',$q$user_id::text like '00000286-%'$q$,1,2,2),
('session_report_rewards',$q$player_id::text like '00000286-%'$q$,1,2,2),
('session_report_results',$q$player_id::text like '00000286-%'$q$,2,2,2),
('injury_check_ins',$q$player_id::text like '00000286-%'$q$,1,2,2),
('player_directory',$q$id::text like '00000286-%'$q$,2,2,2),
('published_sessions',$q$id::text like '00000286-%'$q$,1,1,1),
('player_rating_breakdown',$q$player_id::text like '00000286-%'$q$,2,2,2),
('player_form_contributions',$q$player_id::text like '00000286-%'$q$,2,2,2),
('chronicle_session_reports',$q$player_id::text like '00000286-%'$q$,2,2,2),
('public_live_ratings',$q$id::text like '00000286-%'$q$,2,2,2),
('active_pack_offers',$q$slug like 'privacy-%'$q$,1,1,1),
('my_collection_cards',$q$card_id::text like '00000286-%'$q$,1,0,0),
('storage.objects',$q$bucket_id='player-photos' and name='players/00000286-0000-4000-8000-0000000000a1/profile.webp'$q$,1,1,1);
grant select on read_cases to authenticated, service_role;

create function pg_temp.check_reads(persona text) returns setof text language plpgsql as $$
declare v_case record; v_count int; v_expected int;
begin
  for v_case in select * from pg_temp.read_cases loop
    execute format('select count(*)::int from %s where %s',
      case when v_case.relation='storage.objects' then v_case.relation else 'kut.' || quote_ident(v_case.relation) end,
      v_case.predicate) into v_count;
    v_expected := case persona when 'member' then v_case.member_count
      when 'admin' then v_case.admin_count when 'service' then v_case.service_count else 0 end;
    return next is(v_count,v_expected,persona || ' reads expected rows from ' || v_case.relation);
  end loop;
end $$;

set local role authenticated;
set local request.jwt.claim.sub='00000286-0000-4000-8000-0000000000d1';
select * from pg_temp.check_reads('profileless');
set local request.jwt.claim.sub='00000286-0000-4000-8000-0000000000a1';
select * from pg_temp.check_reads('member');

-- Prove C's fixtures were readable before disabling; then deny the same rows.
set local request.jwt.claim.sub='00000286-0000-4000-8000-0000000000c1';
select is((select count(*)::int from kut.wallets where user_id=auth.uid()),1,'C owns a readable wallet before disable');
reset role;
update kut.profiles set is_disabled=true where id='00000286-0000-4000-8000-0000000000c1';
set local role authenticated;
select * from pg_temp.check_reads('disabled');
select is((select count(*)::int from kut.profiles where id=auth.uid() and is_disabled),1,
  'disabled caller can still read own status for login');
set local request.jwt.claim.sub='00000286-0000-4000-8000-0000000000e1';
select * from pg_temp.check_reads('admin');
select is((select count(*)::int from storage.objects where bucket_id='privacy-other-tool'),0,
  'FLUT membership does not grant another tool''s photos');

-- A non-participating member still sees finalized results (KB-013), not ballots.
reset role;
update kut.profiles set role='user' where id='00000286-0000-4000-8000-0000000000e1';
set local role authenticated;
select is((select count(*)::int from kut.session_surveys where session_id='00000286-0000-4000-8000-000000000701'),0,
  'a bystander cannot read the attendee-only survey');
select is((select count(*)::int from kut.session_report_results where session_id='00000286-0000-4000-8000-000000000701'),2,
  'a bystander still reads finalized base results');
select is((select count(*)::int from kut.chronicle_session_reports where session_id='00000286-0000-4000-8000-000000000701'),2,
  'a bystander still reads the definer Chronicle results');
select is((select count(*)::int from kut.session_kudos where session_id='00000286-0000-4000-8000-000000000701'),0,
  'a bystander cannot read private ballots');

reset role;
set local role anon;
select is((select count(*)::int from storage.objects where bucket_id='player-photos'),0,'anon cannot read player photos');
reset role;
select set_config('request.jwt.claim.sub','',true);
set local role service_role;
-- Test bare SET ROLE too: no JWT role claim is needed for the service bypass.
select * from pg_temp.check_reads('service');
reset role;
select * from finish();
rollback;
