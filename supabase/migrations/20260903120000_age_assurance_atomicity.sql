-- Aikido 618498534 / 618498651: bind age assurance and guardian consent
-- transitions to the authenticated actor and make token consumption atomic.

create table if not exists public.age_assurance_audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null references public.profiles(id) on delete restrict,
  target_user_id uuid not null references public.profiles(id) on delete cascade,
  event_type text not null check (event_type = 'admin_reset'),
  reason text not null check (char_length(trim(reason)) between 3 and 500),
  previous_state jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.age_assurance_audit_events enable row level security;

drop policy if exists "Admins can read age assurance audit events"
  on public.age_assurance_audit_events;
create policy "Admins can read age assurance audit events"
  on public.age_assurance_audit_events for select to authenticated
  using (private.is_admin((select auth.uid())));

revoke all on table public.age_assurance_audit_events from public, anon, authenticated;
grant select on table public.age_assurance_audit_events to authenticated;
grant all on table public.age_assurance_audit_events to service_role;

create or replace function public.submit_age_assurance(
  p_age_band text,
  p_guardian_email text default null,
  p_token_hash text default null,
  p_expires_at timestamptz default null,
  p_consent_version text default '2026-08-30'
) returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_existing public.user_age_assurance%rowtype;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if p_age_band not in ('adult', 'minor') then raise exception 'INVALID_AGE_BAND'; end if;

  select * into v_existing
    from public.user_age_assurance
   where user_id = v_uid
   for update;

  if found and v_existing.age_band is distinct from p_age_band then
    raise exception 'AGE_ASSURANCE_LOCKED';
  end if;

  if p_age_band = 'adult' then
    if found then return v_existing.consent_status; end if;
    insert into public.user_age_assurance (
      user_id, age_band, consent_status, consent_version, guardian_acted_at
    ) values (
      v_uid, 'adult', 'adult_attested', p_consent_version, now()
    );
    return 'adult_attested';
  end if;

  if p_guardian_email is null or trim(p_guardian_email) = ''
     or p_token_hash is null or char_length(p_token_hash) <> 64
     or p_expires_at is null or p_expires_at <= now() then
    raise exception 'INVALID_GUARDIAN_REQUEST';
  end if;

  if found and v_existing.consent_status = 'guardian_granted' then
    return 'guardian_granted';
  end if;

  insert into public.user_age_assurance (
    user_id, age_band, consent_status, consent_version, guardian_email,
    verification_token_hash, verification_expires_at, guardian_acted_at,
    updated_at
  ) values (
    v_uid, 'minor', 'guardian_pending', p_consent_version,
    lower(trim(p_guardian_email)), p_token_hash, p_expires_at, null, now()
  )
  on conflict (user_id) do update set
    guardian_email = excluded.guardian_email,
    consent_status = 'guardian_pending',
    consent_version = excluded.consent_version,
    verification_token_hash = excluded.verification_token_hash,
    verification_expires_at = excluded.verification_expires_at,
    guardian_acted_at = null,
    updated_at = now()
  where public.user_age_assurance.age_band = 'minor'
    and public.user_age_assurance.consent_status <> 'guardian_granted';

  return 'guardian_pending';
end;
$$;

create or replace function public.consume_guardian_consent_token(
  p_token_hash text,
  p_decision text
) returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
begin
  if p_decision not in ('grant', 'decline') then raise exception 'INVALID_DECISION'; end if;

  update public.user_age_assurance
     set consent_status = case p_decision
       when 'grant' then 'guardian_granted'
       else 'guardian_declined'
     end,
         guardian_acted_at = now(),
         verification_token_hash = null,
         verification_expires_at = null,
         updated_at = now()
   where verification_token_hash = p_token_hash
     and consent_status = 'guardian_pending'
     and verification_expires_at > now()
  returning consent_status into v_status;

  if v_status is null then raise exception 'INVALID_OR_EXPIRED_TOKEN'; end if;
  return v_status;
end;
$$;

create or replace function public.reset_age_assurance_as_admin(
  p_target_user_id uuid,
  p_reason text
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_previous public.user_age_assurance%rowtype;
begin
  if v_actor is null or not private.is_admin(v_actor) then raise exception 'FORBIDDEN'; end if;
  if char_length(trim(coalesce(p_reason, ''))) not between 3 and 500 then
    raise exception 'INVALID_REASON';
  end if;

  select * into v_previous
    from public.user_age_assurance
   where user_id = p_target_user_id
   for update;
  if not found then raise exception 'AGE_ASSURANCE_NOT_FOUND'; end if;

  insert into public.age_assurance_audit_events (
    actor_user_id, target_user_id, event_type, reason, previous_state
  ) values (
    v_actor, p_target_user_id, 'admin_reset', trim(p_reason), to_jsonb(v_previous)
  );
  delete from public.user_age_assurance where user_id = p_target_user_id;
end;
$$;

revoke execute on function public.submit_age_assurance(text, text, text, timestamptz, text)
  from public, anon;
grant execute on function public.submit_age_assurance(text, text, text, timestamptz, text)
  to authenticated;

revoke execute on function public.consume_guardian_consent_token(text, text)
  from public, anon, authenticated;
grant execute on function public.consume_guardian_consent_token(text, text)
  to service_role;

revoke execute on function public.reset_age_assurance_as_admin(uuid, text)
  from public, anon;
grant execute on function public.reset_age_assurance_as_admin(uuid, text)
  to authenticated;
