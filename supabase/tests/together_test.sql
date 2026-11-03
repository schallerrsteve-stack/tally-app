\set ON_ERROR_STOP 1
-- Tests for shared routines in chat and live group sessions. Run after the shim + all migrations.
create or replace function pg_temp.as_user(e text) returns void language plpgsql as $$
declare u uuid; begin select id into u from auth.users where email=e;
perform set_config('request.jwt.claims', json_build_object('sub',u,'email',e,'role','authenticated')::text, false); end $$;
create or replace function pg_temp.uid(e text) returns uuid language sql security definer as $$ select id from auth.users where email=e $$;
grant execute on function pg_temp.uid(text) to authenticated;
create table pg_temp.results(name text, ok boolean);
create or replace function pg_temp.check(n text, c boolean) returns void language sql as $$ insert into pg_temp.results values (n, c) $$;
grant all on pg_temp.results to authenticated;

-- Alice is friends with Bob and Carol; Bob and Carol aren't friends; Dave is a stranger
insert into auth.users(email) values ('alice@t.com'),('bob@t.com'),('carol@t.com'),('dave@t.com');
insert into friendships(user_a,user_b) select least(a,b),greatest(a,b) from (values
  (pg_temp.uid('alice@t.com'),pg_temp.uid('bob@t.com')),(pg_temp.uid('alice@t.com'),pg_temp.uid('carol@t.com'))) v(a,b);

-- Routine card in chat
select pg_temp.as_user('alice@t.com'); set role authenticated;
select start_conversation(array[pg_temp.uid('bob@t.com')], null) as conv \gset
insert into messages(conversation_id, body, routine) values (:'conv', 'Shared a routine: Push day', '{"name":"Push day","kind":"std","items":[{"ex":"bench","sets":4,"reps":8}]}');
reset role;
select pg_temp.as_user('bob@t.com'); set role authenticated;
select pg_temp.check('friend receives routine card', (select routine->>'name' from messages where routine is not null)='Push day');
reset role;
select pg_temp.as_user('dave@t.com'); set role authenticated;
select pg_temp.check('stranger cannot see routine card', (select count(*) from messages)=0);
reset role;

-- Start a session
select pg_temp.as_user('alice@t.com'); set role authenticated;
do $$ begin begin perform start_session('{"name":"x"}', array[pg_temp.uid('dave@t.com')]); perform pg_temp.check('cannot invite a stranger', false);
exception when others then perform pg_temp.check('cannot invite a stranger', true); end; end $$;
select start_session('{"name":"Push day","kind":"std","items":[]}', array[pg_temp.uid('bob@t.com'),pg_temp.uid('carol@t.com')]) as sid \gset
select pg_temp.check('host joined, two invited', (select count(*) filter (where status='joined') = 1 and count(*) filter (where status='invited') = 2 from session_members));
update sessions set clock='{"step":1,"paused":false}' where id=:'sid';
select pg_temp.check('host can set the clock', (select clock->>'step' from sessions where id=:'sid')='1');
do $$ begin begin insert into sessions(host_id, routine) values (auth.uid(), '{}'); perform pg_temp.check('direct insert blocked (use start_session)', false);
exception when others then perform pg_temp.check('direct insert blocked (use start_session)', true); end; end $$;
reset role;

-- Bob joins and logs progress; can't touch Carol's row or the clock
select pg_temp.as_user('bob@t.com'); set role authenticated;
select pg_temp.check('invitee sees the session', (select count(*) from sessions)=1);
select pg_temp.check('invitee sees all members', (select count(*) from session_members)=3);
update session_members set status='joined', progress='{"items":[{"ex":"bench","sets":[{"w":60,"r":8}]}]}' where user_id=auth.uid();
select pg_temp.check('invitee updates own progress', (select status from session_members where user_id=auth.uid())='joined');
update session_members set status='left' where user_id=pg_temp.uid('carol@t.com');
update sessions set clock='{"step":9}' where id=:'sid';
reset role;
select pg_temp.check('cannot change someone else''s membership', (select status from session_members where user_id=pg_temp.uid('carol@t.com'))='invited');
select pg_temp.check('only the host changes the clock', (select clock->>'step' from sessions where id=:'sid')='1');

-- Carol sees Bob's name through the session even though they aren't friends
select pg_temp.as_user('carol@t.com'); set role authenticated;
select pg_temp.check('session companions see each other''s profile', (select count(*) from profiles where id=pg_temp.uid('bob@t.com'))=1);
select pg_temp.check('partner progress visible', (select progress->'items'->0->>'ex' from session_members where user_id=pg_temp.uid('bob@t.com'))='bench');
reset role;

-- Dave sees nothing
select pg_temp.as_user('dave@t.com'); set role authenticated;
select pg_temp.check('stranger sees no sessions', (select count(*) from sessions)=0 and (select count(*) from session_members)=0);
reset role;

select name, case when ok then 'PASS' else 'FAIL' end from pg_temp.results;
select count(*) filter (where not ok) as failures from pg_temp.results;
