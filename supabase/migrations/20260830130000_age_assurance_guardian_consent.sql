create table if not exists public.user_age_assurance (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  age_band text not null check (age_band in ('adult', 'minor')),
  consent_status text not null check (
    consent_status in (
      'adult_attested',
      'guardian_pending',
      'guardian_granted',
      'guardian_declined'
    )
  ),
  consent_version text not null default '2026-08-30',
  guardian_email text,
  verification_token_hash text unique,
  verification_expires_at timestamptz,
  guardian_acted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint guardian_consent_fields_check check (
    (age_band = 'adult' and consent_status = 'adult_attested')
    or
    (age_band = 'minor' and guardian_email is not null)
  )
);

alter table public.user_age_assurance enable row level security;

drop policy if exists "Users can read own age assurance" on public.user_age_assurance;
create policy "Users can read own age assurance"
  on public.user_age_assurance for select
  using (auth.uid() = user_id);

comment on table public.user_age_assurance is
  'Minimal age-band assurance and guardian consent state. Full dates of birth are intentionally not collected.';

comment on column public.user_age_assurance.verification_token_hash is
  'SHA-256 hash only; the raw guardian verification token is never stored.';
