-- Mobile practice feedback retries must not charge Credits twice for the same
-- client-generated attempt id.

create unique index if not exists idx_orb_transactions_mobile_practice_attempt_reference
  on public.orb_transactions(reference_id)
  where type in ('practice_speaking', 'practice_debate')
    and reference_id is not null;
