-- Public MP3 bucket for fixed TTS voice preview samples.
-- Object uploads are performed by trusted server-side scripts with the service role key.

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
