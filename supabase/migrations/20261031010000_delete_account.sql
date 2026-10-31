-- Lets a signed-in user permanently delete their own account and all their data (required by Google Play).
-- Everything they own is removed by the ON DELETE CASCADE rules on each table.
create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = public, auth as $$
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  delete from public.invites where email = (auth.jwt() ->> 'email')::citext;
  delete from auth.users where id = auth.uid();
end $$;
revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
