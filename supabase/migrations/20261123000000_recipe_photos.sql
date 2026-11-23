-- Recipe photos: an ordered list of URLs per recipe (the first is the cover),
-- and a storage bucket for photos people upload.

alter table public.recipes add column photos text[] not null default '{}';
update public.recipes set photos = array[image_url] where image_url is not null and photos = '{}';

-- Public bucket: photos are served by URL so they load fast and work in shared
-- cookbooks. File names are random, so they can't be guessed or listed.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('recipe-photos', 'recipe-photos', true, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- Each user may only write inside their own folder: <user id>/<file>.
create policy "recipe photos upload own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'recipe-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "recipe photos update own" on storage.objects for update to authenticated
  using (bucket_id = 'recipe-photos' and owner = auth.uid());
create policy "recipe photos delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'recipe-photos' and owner = auth.uid());
