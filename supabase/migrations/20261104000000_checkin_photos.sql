-- Tally: private storage for weekly check-in photos.
-- Run once in the Supabase SQL editor (safe to re-run).
-- Files live at checkins/<user id>/<date>-<pose>-<id>.jpg; each person can only read, add or remove files in their own folder.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('checkins', 'checkins', false, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "checkin photos: read own" on storage.objects;
create policy "checkin photos: read own" on storage.objects for select to authenticated
  using (bucket_id = 'checkins' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "checkin photos: add own" on storage.objects;
create policy "checkin photos: add own" on storage.objects for insert to authenticated
  with check (bucket_id = 'checkins' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "checkin photos: replace own" on storage.objects;
create policy "checkin photos: replace own" on storage.objects for update to authenticated
  using (bucket_id = 'checkins' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'checkins' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "checkin photos: delete own" on storage.objects;
create policy "checkin photos: delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'checkins' and (storage.foldername(name))[1] = auth.uid()::text);
