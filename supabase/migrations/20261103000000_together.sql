-- Tally: share routines in chat + work out together live
-- Run once in the Supabase SQL editor (safe to re-run).

-- 1) A chat message can carry a routine card ("Save to my routines")
alter table public.messages add column if not exists routine jsonb
  check (routine is null or pg_column_size(routine) < 32000);

-- 2) Live group sessions: everyone follows the same routine and logs their own numbers
create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  routine jsonb not null check (pg_column_size(routine) < 64000),
  clock jsonb not null default '{}'::jsonb check (pg_column_size(clock) < 2000),  -- host's interval/round clock
  status text not null default 'open' check (status in ('open','ended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.session_members (
  session_id uuid not null references public.sessions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'invited' check (status in ('invited','joined','left','done')),
  progress jsonb not null default '{}'::jsonb check (pg_column_size(progress) < 16000),  -- sets each person has done
  updated_at timestamptz not null default now(),
  primary key (session_id, user_id)
);
create index if not exists session_members_user on public.session_members (user_id);
alter table public.sessions enable row level security;
alter table public.session_members enable row level security;

create or replace function public.in_session(sid uuid, uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from session_members where session_id = sid and user_id = uid);
$$;

drop policy if exists "members see session" on public.sessions;
create policy "members see session" on public.sessions for select to authenticated
  using (public.in_session(id, auth.uid()));
drop policy if exists "host updates session" on public.sessions;
create policy "host updates session" on public.sessions for update to authenticated
  using (host_id = auth.uid()) with check (host_id = auth.uid());
drop policy if exists "members see each other" on public.session_members;
create policy "members see each other" on public.session_members for select to authenticated
  using (public.in_session(session_id, auth.uid()));
drop policy if exists "update own membership" on public.session_members;
create policy "update own membership" on public.session_members for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Start a session with friends (host joins automatically)
create or replace function public.start_session(r jsonb, invitees uuid[])
returns uuid language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); sid uuid; f uuid;
begin
  if me is null then raise exception 'Not signed in'; end if;
  if invitees is null or array_length(invitees, 1) is null then raise exception 'Pick at least one friend'; end if;
  if array_length(invitees, 1) > 19 then raise exception 'Up to 20 people per session'; end if;
  foreach f in array invitees loop
    if f <> me and not are_friends(me, f) then raise exception 'You can only invite friends'; end if;
  end loop;
  insert into sessions(host_id, routine) values (me, r) returning id into sid;
  insert into session_members(session_id, user_id, status) values (sid, me, 'joined');
  insert into session_members(session_id, user_id)
    select sid, x from unnest(invitees) x where x <> me on conflict do nothing;
  return sid;
end $$;
grant execute on function public.start_session(jsonb, uuid[]) to authenticated;

-- People in the same session can see each other's name/emoji (invitees may not all be friends)
drop policy if exists "see session companions" on public.profiles;
create policy "see session companions" on public.profiles for select to authenticated
  using (exists (select 1 from public.session_members a join public.session_members b using (session_id)
                 where a.user_id = auth.uid() and b.user_id = profiles.id));

-- Live updates
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'sessions') then
      alter publication supabase_realtime add table public.sessions;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'session_members') then
      alter publication supabase_realtime add table public.session_members;
    end if;
  end if;
end $$;
