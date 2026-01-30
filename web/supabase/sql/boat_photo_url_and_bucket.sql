-- Boat photo: add photo_url to boats and a public bucket for boat photos.
-- Run in Supabase SQL Editor after boatmatey_setup.sql.
-- Required for boat photos to save when signed in (avoids localStorage quota errors).

-- 1) Add photo_url to boats
alter table public.boats
  add column if not exists photo_url text null;

comment on column public.boats.photo_url is 'Public URL of the boat photo (e.g. from boat-photos bucket)';

-- 2) Public bucket for boat photos (so we can store a permanent public URL in boats.photo_url)
insert into storage.buckets (id, name, public)
values ('boat-photos', 'boat-photos', true)
on conflict (id) do update set public = true;

-- 3) Policies: authenticated users can upload/update/delete their own path; anyone can read (public bucket)
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'boat_photos_select'
  ) then
    create policy boat_photos_select
      on storage.objects for select
      using (bucket_id = 'boat-photos');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'boat_photos_insert_own'
  ) then
    create policy boat_photos_insert_own
      on storage.objects for insert
      with check (
        bucket_id = 'boat-photos'
        and auth.role() = 'authenticated'
        and split_part(name, '/', 1) = auth.uid()::text
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'boat_photos_update_own'
  ) then
    create policy boat_photos_update_own
      on storage.objects for update
      using (
        bucket_id = 'boat-photos'
        and auth.role() = 'authenticated'
        and split_part(name, '/', 1) = auth.uid()::text
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'boat_photos_delete_own'
  ) then
    create policy boat_photos_delete_own
      on storage.objects for delete
      using (
        bucket_id = 'boat-photos'
        and auth.role() = 'authenticated'
        and split_part(name, '/', 1) = auth.uid()::text
      );
  end if;
end $$;
