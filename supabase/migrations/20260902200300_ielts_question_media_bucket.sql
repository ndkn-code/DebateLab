-- Public image bucket for IELTS question stimulus: diagram / map / plan
-- figures and Writing Task 1 visuals.  Objects are written only by the
-- service role (admin authoring action + fixture importer); anyone may read,
-- matching the listening-audio bucket.  Images carry no answer keys.

begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'ielts-question-media',
  'ielts-question-media',
  true,
  5242880,
  array['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp']
)
on conflict (id) do update
  set public = true,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "IELTS question media public read" on storage.objects;
create policy "IELTS question media public read" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'ielts-question-media');

drop policy if exists "IELTS question media service write" on storage.objects;
create policy "IELTS question media service write" on storage.objects
  for all to service_role
  using (bucket_id = 'ielts-question-media')
  with check (bucket_id = 'ielts-question-media');

commit;
