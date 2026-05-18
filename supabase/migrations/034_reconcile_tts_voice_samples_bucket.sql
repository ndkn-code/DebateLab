-- Reconcile the TTS voice sample storage setup after the bucket was created
-- out-of-band from Supabase's migration ledger.
--
-- This is intentionally narrow and idempotent:
-- - keep the existing public MP3 preview bucket configured as expected
-- - allow read access only for objects in that bucket
-- - do not grant uploads, updates, deletes, or touch existing objects

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'tts-voice-samples',
  'tts-voice-samples',
  true,
  1048576,
  array['audio/mpeg', 'audio/mp3']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "TTS voice samples are publicly readable" on storage.objects;

create policy "TTS voice samples are publicly readable"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'tts-voice-samples');
