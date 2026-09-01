-- Restore authenticated uploads to the shared practice-audio bucket.
--
-- The LMS material ingest policy calls this SECURITY DEFINER helper while
-- evaluating INSERT policies on storage.objects. PostgreSQL may evaluate that
-- helper even when another policy ultimately authorizes a different bucket,
-- so authenticated users need EXECUTE on the predicate used by the policy.
-- The function returns only a scoped boolean and still verifies auth.uid(),
-- the draft material, club, version, path, and manager relationship.

begin;

grant execute on function private.can_manage_lms_material_storage(text, text, uuid)
  to authenticated;

-- IELTS Speaking records WAV PCM 16 kHz mono in the browser. Preserve every
-- existing MIME type while adding the two common WAV labels expected from web
-- and mobile clients.
insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'practice-audio',
  'practice-audio',
  false,
  26214400,
  array[
    'audio/webm',
    'audio/webm;codecs=opus',
    'audio/mp4',
    'audio/m4a',
    'audio/x-m4a',
    'audio/aac',
    'audio/wav',
    'audio/x-wav'
  ]
)
on conflict (id) do update
set allowed_mime_types = (
  select array_agg(distinct mime order by mime)
  from unnest(
    coalesce(storage.buckets.allowed_mime_types, '{}'::text[])
      || excluded.allowed_mime_types
  ) as mime
);

commit;
