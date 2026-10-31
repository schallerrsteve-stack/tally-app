\set ON_ERROR_STOP 1
-- helpers (test only)
create or replace function pg_temp.as_user(e text) returns void language plpgsql as $$
declare u uuid; begin select id into u from auth.users where email=e;
perform set_config('request.jwt.claims', json_build_object('sub',u,'email',e,'role','authenticated')::text, false); end $$;
create table pg_temp.results(name text, ok boolean);
create or replace function pg_temp.check(n text, c boolean) returns void language sql as $$ insert into pg_temp.results values (n, c) $$;
grant all on pg_temp.results to authenticated;

-- Alice and Carol and Dave already have accounts
insert into auth.users(email) values ('alice@x.com'),('carol@x.com'),('dave@x.com');
select pg_temp.check('profiles auto-created', (select count(*) from profiles)=3);

-- Alice invites Bob (no account yet) and Carol (existing)
select pg_temp.as_user('alice@x.com'); set role authenticated;
insert into invites(inviter_id,email) select auth.uid(),'bob@x.com';
insert into invites(inviter_id,email) select auth.uid(),'carol@x.com';
do $$ begin begin insert into invites(inviter_id,email) select id,'dave@x.com' from auth.users where email='carol@x.com'; perform pg_temp.check('cannot invite as someone else', false);
exception when others then perform pg_temp.check('cannot invite as someone else', true); end; end $$;
reset role;

-- Bob signs up -> auto-friend with Alice
insert into auth.users(email) values ('bob@x.com');
select pg_temp.check('bob auto-friended alice', are_friends((select id from auth.users where email='alice@x.com'),(select id from auth.users where email='bob@x.com')));

-- Carol sees the invite and Alice's name, accepts
select pg_temp.as_user('carol@x.com'); set role authenticated;
select pg_temp.check('carol sees invite', (select count(*) from invites)=1);
select pg_temp.check('carol sees inviter profile', exists(select 1 from profiles where display_name='alice'));
select respond_to_invite((select id from invites limit 1), true);
select pg_temp.check('carol now friends with alice', (select count(*) from friendships)=1);
reset role;

-- Dave (stranger) cannot see anything of Alice
select pg_temp.as_user('alice@x.com'); set role authenticated;
insert into user_docs(key,data) values ('profile','{"age":30}');
insert into achievements(kind,title) values ('pr','Bench press PR 82 kg');
insert into achievements(kind,title,visibility) values ('custom','Private note','private');
insert into shared_stats(stats) values ('{"workouts_week":3}');
select start_conversation(array[(select id from profiles where display_name='bob')]) as c1 \gset
insert into messages(conversation_id, body) values (:'c1','Nice work!');
select pg_temp.check('1:1 reuse', start_conversation(array[(select id from profiles where display_name='bob')]) = :'c1');
select start_conversation(array[(select id from profiles where display_name='bob'),(select id from profiles where display_name='carol')],'Gym crew') as g1 \gset
insert into messages(conversation_id, body) values (:'g1','Hi crew');
select create_challenge('October workouts','workouts','2026-10-01','2026-10-31',array[(select id from profiles where display_name='bob')]) as ch \gset
reset role;

select pg_temp.as_user('dave@x.com'); set role authenticated;
select pg_temp.check('dave sees only self profile', (select count(*) from profiles)=1);
select pg_temp.check('dave no docs', (select count(*) from user_docs)=0);
select pg_temp.check('dave no achievements', (select count(*) from achievements)=0);
select pg_temp.check('dave no stats', (select count(*) from shared_stats)=0);
select pg_temp.check('dave no messages', (select count(*) from messages)=0);
select pg_temp.check('dave no challenges', (select count(*) from challenges)=0);
do $$ begin begin perform start_conversation(array[(select id from auth.users where email='alice@x.com')]); perform pg_temp.check('dave cannot message alice', false);
exception when others then perform pg_temp.check('dave cannot message alice', true); end; end $$;
do $$ begin begin insert into messages(conversation_id, body) select id,'spam' from conversations limit 1; perform pg_temp.check('dave cannot post into chats', (select count(*) from conversations)=0);
exception when others then perform pg_temp.check('dave cannot post into chats', true); end; end $$;
do $$ begin begin perform add_friendship((select id from auth.users where email='alice@x.com'), auth.uid()); perform pg_temp.check('dave cannot self-friend', false);
exception when others then perform pg_temp.check('dave cannot self-friend', true); end; end $$;
reset role;

-- Bob: sees Alice's shared things, not her private ones or her diary
select pg_temp.as_user('bob@x.com'); set role authenticated;
select pg_temp.check('bob cannot read alice docs', (select count(*) from user_docs)=0);
select pg_temp.check('bob sees friends-only achievement, not private', (select count(*) from achievements)=1);
insert into reactions(achievement_id, emoji) select id,'🔥' from achievements limit 1;
select pg_temp.check('bob sees stats', (select count(*) from shared_stats)=1);
select pg_temp.check('bob reads both chats', (select count(*) from messages)=2);
select pg_temp.check('bob sees carol via group chat', exists(select 1 from profiles where display_name='carol'));
update challenge_participants set status='joined', score=5 where user_id=auth.uid();
update challenge_participants set score=999 where user_id<>auth.uid();
select pg_temp.check('bob leaderboard visible', (select count(*) from challenge_participants)=2);
reset role;
select pg_temp.check('bob could not change alice score', (select score from challenge_participants cp join profiles p on p.id=cp.user_id where p.display_name='alice')=0);
select pg_temp.check('bob score saved', (select score from challenge_participants cp join profiles p on p.id=cp.user_id where p.display_name='bob')=5);

-- Carol: in group but not in 1:1
select pg_temp.as_user('carol@x.com'); set role authenticated;
select pg_temp.check('carol reads only group chat', (select count(*) from messages)=1);
do $$ begin begin insert into messages(conversation_id, body) values ((select conversation_id from messages limit 1), 'hey'); perform pg_temp.check('carol posts in group', true);
exception when others then perform pg_temp.check('carol posts in group', false); end; end $$;
reset role;

-- Unfriend: Bob loses Alice's achievements and stats
select pg_temp.as_user('bob@x.com'); set role authenticated;
delete from friendships;
select pg_temp.check('after unfriend: no achievements', (select count(*) from achievements)=0);
select pg_temp.check('after unfriend: no stats', (select count(*) from shared_stats)=0);
reset role;

select name, case when ok then 'PASS' else 'FAIL' end from pg_temp.results;
select count(*) filter (where not ok) as failures from pg_temp.results;
