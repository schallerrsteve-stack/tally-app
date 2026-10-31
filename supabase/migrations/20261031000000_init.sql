-- Tally: initial schema
-- Private data sync + social (friends by email invite, chat, achievements feed, shared stats, challenges)
-- Every table has row-level security. Nothing is readable without a policy that allows it.

create extension if not exists citext;

-- ============ PROFILES ============
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Tally user' check (char_length(display_name) between 1 and 40),
  avatar_emoji text not null default '🙂' check (char_length(avatar_emoji) <= 8),
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

-- ============ FRIENDSHIPS ============
create table public.friendships (
  user_a uuid not null references public.profiles(id) on delete cascade,
  user_b uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_a, user_b),
  check (user_a < user_b)
);
alter table public.friendships enable row level security;
create index on public.friendships (user_b);

create or replace function public.are_friends(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from friendships where user_a = least(a,b) and user_b = greatest(a,b));
$$;

create or replace function public.add_friendship(a uuid, b uuid)
returns void language sql security definer set search_path = public as $$
  insert into friendships(user_a, user_b) values (least(a,b), greatest(a,b)) on conflict do nothing;
$$;
revoke execute on function public.add_friendship(uuid, uuid) from public, anon, authenticated;

create policy "see own friendships" on public.friendships for select to authenticated
  using (auth.uid() in (user_a, user_b));
create policy "unfriend" on public.friendships for delete to authenticated
  using (auth.uid() in (user_a, user_b));

create policy "see self and friends" on public.profiles for select to authenticated
  using (id = auth.uid() or public.are_friends(id, auth.uid()));
create policy "edit own profile" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- ============ INVITES (by email) ============
create table public.invites (
  id uuid primary key default gen_random_uuid(),
  inviter_id uuid not null references public.profiles(id) on delete cascade,
  email citext not null check (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  status text not null default 'pending' check (status in ('pending','accepted','declined','revoked')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  unique (inviter_id, email)
);
alter table public.invites enable row level security;
create index on public.invites (email) where status = 'pending';

create policy "inviter sees sent invites" on public.invites for select to authenticated
  using (inviter_id = auth.uid());
create policy "invitee sees invites to their email" on public.invites for select to authenticated
  using (email = (auth.jwt() ->> 'email')::citext);
create policy "send invites" on public.invites for insert to authenticated
  with check (inviter_id = auth.uid() and status = 'pending' and email <> (auth.jwt() ->> 'email')::citext);
create policy "revoke own invites" on public.invites for update to authenticated
  using (inviter_id = auth.uid()) with check (inviter_id = auth.uid() and status = 'revoked');

create policy "see people who invited me" on public.profiles for select to authenticated
  using (exists (select 1 from public.invites i where i.inviter_id = profiles.id and i.status = 'pending'
                 and i.email = (auth.jwt() ->> 'email')::citext));

-- Invitee answers an invite addressed to their verified email
create or replace function public.respond_to_invite(invite_id uuid, accept boolean)
returns void language plpgsql security definer set search_path = public as $$
declare inv invites;
begin
  select * into inv from invites where id = invite_id and status = 'pending'
    and email = (auth.jwt() ->> 'email')::citext for update;
  if not found then raise exception 'Invite not found'; end if;
  update invites set status = case when accept then 'accepted' else 'declined' end, responded_at = now() where id = invite_id;
  if accept then perform add_friendship(inv.inviter_id, auth.uid()); end if;
end $$;
grant execute on function public.respond_to_invite(uuid, boolean) to authenticated;

-- New account: create profile, and auto-accept invites to that email (they signed up because of one)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare inv record;
begin
  insert into profiles(id, display_name)
  values (new.id, coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), split_part(new.email, '@', 1)))
  on conflict do nothing;
  for inv in select * from invites where email = new.email::citext and status = 'pending' loop
    update invites set status = 'accepted', responded_at = now() where id = inv.id;
    perform add_friendship(inv.inviter_id, new.id);
  end loop;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============ PRIVATE DATA SYNC ============
-- Mirrors the app's document model: 'profile', 'custom', 'weights', 'routines', 'exercises', 'd-YYYY-MM-DD', 'wk-YYYY-MM'
create table public.user_docs (
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  key text not null check (key ~ '^[A-Za-z0-9_.:-]{1,64}$'),
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);
alter table public.user_docs enable row level security;
create policy "owner only" on public.user_docs for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and pg_column_size(data) < 512000);

-- ============ CHAT ============
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  is_group boolean not null default false,
  title text check (char_length(title) <= 60),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now()
);
create table public.conversation_members (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  last_read_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);
create index on public.conversation_members (user_id);
create table public.messages (
  id bigint generated always as identity primary key,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  body text not null check (char_length(body) between 1 and 4000),
  achievement_id uuid,  -- optional: a shared achievement card
  created_at timestamptz not null default now()
);
create index on public.messages (conversation_id, created_at desc);
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;

create or replace function public.is_member(conv uuid, uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from conversation_members where conversation_id = conv and user_id = uid);
$$;

create policy "members read conversation" on public.conversations for select to authenticated
  using (public.is_member(id, auth.uid()));
create policy "members rename group" on public.conversations for update to authenticated
  using (is_group and public.is_member(id, auth.uid())) with check (is_group);
create policy "members see members" on public.conversation_members for select to authenticated
  using (public.is_member(conversation_id, auth.uid()));
create policy "mark read / leave" on public.conversation_members for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "leave conversation" on public.conversation_members for delete to authenticated
  using (user_id = auth.uid());
create policy "members read messages" on public.messages for select to authenticated
  using (public.is_member(conversation_id, auth.uid()));
create policy "members send messages" on public.messages for insert to authenticated
  with check (sender_id = auth.uid() and public.is_member(conversation_id, auth.uid()));
create policy "delete own messages" on public.messages for delete to authenticated
  using (sender_id = auth.uid());

create or replace function public.touch_conversation() returns trigger
language plpgsql security definer set search_path = public as $$
begin update conversations set last_message_at = new.created_at where id = new.conversation_id; return new; end $$;
create trigger on_message after insert on public.messages for each row execute function public.touch_conversation();

-- Start a 1:1 chat (reuses an existing one) or a group chat; everyone must be your friend
create or replace function public.start_conversation(member_ids uuid[], group_title text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); others uuid[]; conv uuid; m uuid;
begin
  if me is null then raise exception 'Not signed in'; end if;
  select array_agg(distinct x) into others from unnest(member_ids) x where x <> me;
  if others is null or array_length(others,1) = 0 then raise exception 'Pick at least one friend'; end if;
  if array_length(others,1) > 49 then raise exception 'Groups are limited to 50 people'; end if;
  foreach m in array others loop
    if not are_friends(me, m) then raise exception 'You can only message friends'; end if;
  end loop;
  if array_length(others,1) = 1 and group_title is null then
    select c.id into conv from conversations c
      where not c.is_group and is_member(c.id, me) and is_member(c.id, others[1])
        and (select count(*) from conversation_members cm where cm.conversation_id = c.id) = 2
      limit 1;
    if conv is not null then return conv; end if;
  end if;
  insert into conversations(is_group, title, created_by)
    values (array_length(others,1) > 1 or group_title is not null, group_title, me) returning id into conv;
  insert into conversation_members(conversation_id, user_id) select conv, x from unnest(others || me) x;
  return conv;
end $$;
grant execute on function public.start_conversation(uuid[], text) to authenticated;

-- ============ ACHIEVEMENTS FEED ============
create table public.achievements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  kind text not null check (kind in ('pr','streak','workout','weight_goal','logging_streak','challenge','custom')),
  title text not null check (char_length(title) between 1 and 120),
  detail jsonb not null default '{}'::jsonb check (pg_column_size(detail) < 8000),
  visibility text not null default 'friends' check (visibility in ('friends','private')),
  created_at timestamptz not null default now()
);
create index on public.achievements (user_id, created_at desc);
alter table public.achievements enable row level security;
create policy "own achievements" on public.achievements for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "friends see shared achievements" on public.achievements for select to authenticated
  using (visibility = 'friends' and public.are_friends(user_id, auth.uid()));
alter table public.messages add constraint messages_achievement_fk
  foreign key (achievement_id) references public.achievements(id) on delete set null;

create table public.reactions (
  achievement_id uuid not null references public.achievements(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  emoji text not null check (emoji in ('👏','🔥','💪','🎉','❤️')),
  created_at timestamptz not null default now(),
  primary key (achievement_id, user_id, emoji)
);
alter table public.reactions enable row level security;
create or replace function public.can_see_achievement(aid uuid, uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from achievements a where a.id = aid
    and (a.user_id = uid or (a.visibility = 'friends' and are_friends(a.user_id, uid))));
$$;
create policy "see reactions" on public.reactions for select to authenticated
  using (public.can_see_achievement(achievement_id, auth.uid()));
create policy "react" on public.reactions for insert to authenticated
  with check (user_id = auth.uid() and public.can_see_achievement(achievement_id, auth.uid()));
create policy "unreact" on public.reactions for delete to authenticated using (user_id = auth.uid());

-- ============ SHARED PROGRESS STATS ============
-- The app writes only what the user chose to share (e.g. weight trend, logging streak, weekly workouts) — never the diary.
create table public.shared_stats (
  user_id uuid primary key references public.profiles(id) on delete cascade default auth.uid(),
  share_weight boolean not null default false,
  share_nutrition boolean not null default false,
  share_workouts boolean not null default true,
  stats jsonb not null default '{}'::jsonb check (pg_column_size(stats) < 32000),
  updated_at timestamptz not null default now()
);
alter table public.shared_stats enable row level security;
create policy "own stats" on public.shared_stats for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "friends read stats" on public.shared_stats for select to authenticated
  using (public.are_friends(user_id, auth.uid()));

-- ============ CHALLENGES ============
create table public.challenges (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  title text not null check (char_length(title) between 1 and 80),
  metric text not null check (metric in ('workouts','active_minutes','logging_days','workout_days')),
  start_date date not null,
  end_date date not null,
  created_at timestamptz not null default now(),
  check (end_date >= start_date and end_date - start_date <= 366)
);
create table public.challenge_participants (
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'invited' check (status in ('invited','joined','left')),
  score numeric not null default 0 check (score >= 0),
  updated_at timestamptz not null default now(),
  primary key (challenge_id, user_id)
);
alter table public.challenges enable row level security;
alter table public.challenge_participants enable row level security;
create or replace function public.in_challenge(cid uuid, uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from challenge_participants where challenge_id = cid and user_id = uid);
$$;
create policy "participants see challenge" on public.challenges for select to authenticated
  using (public.in_challenge(id, auth.uid()));
create policy "creator edits challenge" on public.challenges for update to authenticated
  using (created_by = auth.uid()) with check (created_by = auth.uid());
create policy "creator deletes challenge" on public.challenges for delete to authenticated
  using (created_by = auth.uid());
create policy "participants see leaderboard" on public.challenge_participants for select to authenticated
  using (public.in_challenge(challenge_id, auth.uid()));
create policy "update own entry" on public.challenge_participants for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.create_challenge(t text, m text, s date, e date, invitees uuid[])
returns uuid language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); cid uuid; f uuid;
begin
  if me is null then raise exception 'Not signed in'; end if;
  foreach f in array coalesce(invitees, '{}') loop
    if f <> me and not are_friends(me, f) then raise exception 'You can only invite friends'; end if;
  end loop;
  insert into challenges(created_by, title, metric, start_date, end_date) values (me, t, m, s, e) returning id into cid;
  insert into challenge_participants(challenge_id, user_id, status) values (cid, me, 'joined');
  insert into challenge_participants(challenge_id, user_id)
    select cid, x from unnest(coalesce(invitees, '{}')) x where x <> me on conflict do nothing;
  return cid;
end $$;
grant execute on function public.create_challenge(text, text, date, date, uuid[]) to authenticated;


-- People who share a chat or challenge can see each other's name/emoji
create policy "see chat and challenge companions" on public.profiles for select to authenticated
  using (exists (select 1 from public.conversation_members a join public.conversation_members b using (conversation_id)
                 where a.user_id = auth.uid() and b.user_id = profiles.id)
      or exists (select 1 from public.challenge_participants a join public.challenge_participants b using (challenge_id)
                 where a.user_id = auth.uid() and b.user_id = profiles.id));

-- ============ REALTIME ============
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.messages, public.achievements, public.reactions, public.challenge_participants;
  end if;
end $$;
