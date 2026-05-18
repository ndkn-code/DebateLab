-- Public buckets can serve files by URL without a storage.objects SELECT policy.
-- Drop the policy added during reconciliation so clients cannot list bucket objects.

drop policy if exists "TTS voice samples are publicly readable" on storage.objects;
