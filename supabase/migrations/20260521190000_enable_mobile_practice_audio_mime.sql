-- Allow Expo iOS practice recordings to upload to the existing private bucket.
-- Keep the owner-folder storage policies unchanged.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
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
    'audio/aac'
  ]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;
