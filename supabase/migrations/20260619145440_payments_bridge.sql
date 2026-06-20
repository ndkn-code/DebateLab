-- WS-4.1 Payments: provider→subscription webhook bridge + idempotency + metering.
-- Faithfully ports Lumist's payment scar-tissue into DebateLab's stack (typed
-- supabase-js, no Prisma, no god-files). DebateLab already has subscriptions /
-- user_feature_usage / orb_transactions / referrals (migration 013) with RLS — this
-- adds the PROVIDER bridge + idempotency, writing into the existing entitlement gate.
-- House idiom: gen_random_uuid(), private.is_admin(auth.uid()), security definer
-- functions with `set search_path = ''` and fully-qualified public.* refs.
-- Validated in isolation on postgres:17 (6 idempotency scenarios + 20-way concurrency).

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Extend public.subscriptions (additive, nullable — the gate entitlements.ts
--    reads via select(*) and ignores unknown columns, so this is risk-free).
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.subscriptions
  add column if not exists provider text
    check (provider in ('stripe', 'zalopay', 'revenuecat', 'manual')),
  add column if not exists provider_customer_id text,
  add column if not exists provider_subscription_id text,
  add column if not exists billing_cycle text
    check (billing_cycle in ('monthly', 'three_months', 'six_months', 'yearly', 'custom')),
  add column if not exists amount_paid numeric(12, 2),
  add column if not exists currency text,
  add column if not exists last_webhook_event_at timestamptz;  -- out-of-order guard

create index if not exists idx_subscriptions_provider_sub
  on public.subscriptions(provider, provider_subscription_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. payment_webhook_events — unified dedup ledger (all providers).
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.payment_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('stripe', 'zalopay', 'revenuecat')),
  event_id text not null,
  event_type text not null,
  status text not null default 'pending'
    check (status in ('pending', 'processed', 'error', 'skipped')),
  payload jsonb not null default '{}'::jsonb,
  error text,
  user_id uuid references public.profiles(id) on delete set null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (provider, event_id)
);
create index if not exists idx_payment_webhook_events_status
  on public.payment_webhook_events(provider, status);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. payment_transactions — insert-first idempotency CLAIM + receipt + ZaloPay
--    order. `processed` is Lumist's webhookProcessed; the unique key is the lock.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.payment_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null check (provider in ('stripe', 'zalopay', 'revenuecat', 'manual')),
  idempotency_key text not null,           -- stripe: sub_<id>/renewal_<invoice>; zalopay: app_trans_id
  provider_ref text,                       -- stripe sub/invoice id, zalopay zp_trans_id, rc txn id
  kind text not null default 'activation'
    check (kind in ('checkout', 'activation', 'renewal', 'order')),
  amount numeric(12, 2),
  currency text not null default 'USD',
  status text not null default 'pending'
    check (status in ('pending', 'success', 'failed', 'refunded')),
  subscription_id uuid references public.subscriptions(id) on delete set null,
  plan_type text check (plan_type in ('free', 'premium', 'enterprise')),
  billing_cycle text,
  processed boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, idempotency_key)
);
create index if not exists idx_payment_transactions_user
  on public.payment_transactions(user_id, created_at desc);
create index if not exists idx_payment_transactions_status
  on public.payment_transactions(provider, status);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. revenuecat_customer_mappings — app_user_id/alias → canonical user (scaffold;
--    completed when mobile IAP ships per "web rails first").
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.revenuecat_customer_mappings (
  id uuid primary key default gen_random_uuid(),
  app_user_id text not null unique,
  canonical_user_id uuid references public.profiles(id) on delete set null,
  is_anonymous boolean not null default false,
  aliases jsonb not null default '[]'::jsonb,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_rc_mappings_canonical
  on public.revenuecat_customer_mappings(canonical_user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. RLS + policies on every new table (writes happen via the SECURITY DEFINER
--    functions below / the service-role client, both of which bypass RLS).
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.payment_webhook_events enable row level security;
alter table public.payment_transactions enable row level security;
alter table public.revenuecat_customer_mappings enable row level security;

drop policy if exists "Admins can view payment webhook events" on public.payment_webhook_events;
create policy "Admins can view payment webhook events"
  on public.payment_webhook_events for select
  using (private.is_admin(auth.uid()));

drop policy if exists "Admins can manage payment webhook events" on public.payment_webhook_events;
create policy "Admins can manage payment webhook events"
  on public.payment_webhook_events for all
  using (private.is_admin(auth.uid()))
  with check (private.is_admin(auth.uid()));

drop policy if exists "Users can view own payment transactions" on public.payment_transactions;
create policy "Users can view own payment transactions"
  on public.payment_transactions for select
  using (auth.uid() = user_id or private.is_admin(auth.uid()));

drop policy if exists "Admins can manage payment transactions" on public.payment_transactions;
create policy "Admins can manage payment transactions"
  on public.payment_transactions for all
  using (private.is_admin(auth.uid()))
  with check (private.is_admin(auth.uid()));

drop policy if exists "Users can view own rc mapping" on public.revenuecat_customer_mappings;
create policy "Users can view own rc mapping"
  on public.revenuecat_customer_mappings for select
  using (auth.uid() = canonical_user_id or private.is_admin(auth.uid()));

drop policy if exists "Admins can manage rc mappings" on public.revenuecat_customer_mappings;
create policy "Admins can manage rc mappings"
  on public.revenuecat_customer_mappings for all
  using (private.is_admin(auth.uid()))
  with check (private.is_admin(auth.uid()));

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Atomic functions (the idempotency scar-tissue, in SQL for true atomicity).
-- ─────────────────────────────────────────────────────────────────────────────

-- 6a. Insert-first claim. Returns 'claimed' | 'duplicate_done' | 'in_flight'
--     (Lumist: count==1 own / count==0+processed no-op / count==0+!processed retry).
create or replace function public.claim_payment_transaction(
  p_provider text,
  p_idempotency_key text,
  p_user_id uuid,
  p_kind text,
  p_amount numeric,
  p_currency text,
  p_plan_type text,
  p_billing_cycle text,
  p_provider_ref text,
  p_metadata jsonb
) returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_processed boolean;
begin
  insert into public.payment_transactions (
    user_id, provider, idempotency_key, provider_ref, kind, amount, currency,
    status, plan_type, billing_cycle, processed, metadata
  ) values (
    p_user_id, p_provider, p_idempotency_key, p_provider_ref, coalesce(p_kind, 'activation'),
    p_amount, coalesce(p_currency, 'USD'), 'pending', p_plan_type, p_billing_cycle, false,
    coalesce(p_metadata, '{}'::jsonb)
  )
  on conflict (provider, idempotency_key) do nothing;

  if found then
    return 'claimed';
  end if;

  select processed into v_processed
  from public.payment_transactions
  where provider = p_provider and idempotency_key = p_idempotency_key;

  if v_processed then
    return 'duplicate_done';
  end if;
  return 'in_flight';
end;
$$;

-- 6b. Finalize a claim (mark processed, link subscription, set status).
create or replace function public.finalize_payment_transaction(
  p_provider text,
  p_idempotency_key text,
  p_status text,
  p_subscription_id uuid,
  p_provider_ref text
) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.payment_transactions set
    status = coalesce(p_status, status),
    subscription_id = coalesce(p_subscription_id, subscription_id),
    provider_ref = coalesce(p_provider_ref, provider_ref),
    processed = true,
    updated_at = now()
  where provider = p_provider and idempotency_key = p_idempotency_key;
end;
$$;

-- 6c. Release a claim for retry (ZaloPay compensating rollback on grant failure).
create or replace function public.release_payment_transaction(
  p_provider text,
  p_idempotency_key text
) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.payment_transactions set
    status = 'pending', processed = false, updated_at = now()
  where provider = p_provider and idempotency_key = p_idempotency_key;
end;
$$;

-- 6d. Webhook-event dedup ledger: record (returns 'new'|'duplicate') + mark.
create or replace function public.record_payment_webhook_event(
  p_provider text,
  p_event_id text,
  p_event_type text,
  p_payload jsonb,
  p_user_id uuid
) returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.payment_webhook_events (provider, event_id, event_type, payload, user_id, status)
  values (p_provider, p_event_id, p_event_type, coalesce(p_payload, '{}'::jsonb), p_user_id, 'pending')
  on conflict (provider, event_id) do nothing;
  if found then
    return 'new';
  end if;
  return 'duplicate';
end;
$$;

create or replace function public.mark_payment_webhook_event(
  p_provider text,
  p_event_id text,
  p_status text,
  p_error text
) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.payment_webhook_events set
    status = p_status,
    error = p_error,
    processed_at = case when p_status in ('processed', 'skipped', 'error') then now() else processed_at end
  where provider = p_provider and event_id = p_event_id;
end;
$$;

-- 6e. Apply a provider event to the entitlement gate (subscriptions) with a
--     per-user advisory lock + out-of-order guard + supersede-on-activation.
--     Status/plan are pre-mapped to DebateLab values in TS (testable) before call.
create or replace function public.apply_subscription_from_webhook(
  p_user_id uuid,
  p_provider text,
  p_provider_subscription_id text,
  p_provider_customer_id text,
  p_plan_type text,
  p_status text,
  p_current_period_start timestamptz,
  p_current_period_end timestamptz,
  p_trial_end_date timestamptz,
  p_cancel_at_period_end boolean,
  p_billing_cycle text,
  p_amount_paid numeric,
  p_currency text,
  p_event_at timestamptz
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_last timestamptz;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  select id, last_webhook_event_at into v_id, v_last
  from public.subscriptions
  where user_id = p_user_id
    and provider = p_provider
    and provider_subscription_id is not distinct from p_provider_subscription_id
  order by created_at desc
  limit 1;

  if v_id is not null then
    -- out-of-order: drop an event older than the last one we applied.
    if v_last is not null and p_event_at is not null and p_event_at < v_last then
      return v_id;
    end if;
    update public.subscriptions set
      plan_type = p_plan_type,
      status = p_status,
      current_period_start = coalesce(p_current_period_start, current_period_start),
      current_period_end = coalesce(p_current_period_end, current_period_end),
      trial_end_date = coalesce(p_trial_end_date, trial_end_date),
      cancel_at_period_end = coalesce(p_cancel_at_period_end, cancel_at_period_end),
      billing_cycle = coalesce(p_billing_cycle, billing_cycle),
      amount_paid = coalesce(p_amount_paid, amount_paid),
      currency = coalesce(p_currency, currency),
      provider_customer_id = coalesce(p_provider_customer_id, provider_customer_id),
      cancelled_at = case when p_status = 'cancelled' then now() else cancelled_at end,
      ended_at = case when p_status in ('cancelled', 'expired')
                      then coalesce(ended_at, now()) else ended_at end,
      last_webhook_event_at = greatest(coalesce(v_last, p_event_at), p_event_at),
      updated_at = now()
    where id = v_id;
    return v_id;
  end if;

  -- new subscription: supersede prior active/trial rows when activating.
  if p_status in ('active', 'trial') then
    update public.subscriptions set
      status = 'expired', ended_at = coalesce(ended_at, now()), updated_at = now()
    where user_id = p_user_id and status in ('active', 'trial');
  end if;

  insert into public.subscriptions (
    user_id, plan_type, status, current_period_start, current_period_end,
    trial_end_date, cancel_at_period_end, provider, provider_customer_id,
    provider_subscription_id, billing_cycle, amount_paid, currency, last_webhook_event_at
  ) values (
    p_user_id, p_plan_type, p_status, p_current_period_start, p_current_period_end,
    p_trial_end_date, coalesce(p_cancel_at_period_end, false), p_provider, p_provider_customer_id,
    p_provider_subscription_id, p_billing_cycle, p_amount_paid, p_currency, p_event_at
  )
  returning id into v_id;
  return v_id;
end;
$$;

-- 6f. Atomic metering (improves on Lumist's non-atomic generic check+increment).
--     Returns (allowed, used_count, limit_count). FOR UPDATE serializes bursts.
create or replace function public.increment_feature_usage(
  p_user_id uuid,
  p_feature text,
  p_period_start timestamptz,
  p_period_end timestamptz,
  p_amount integer,
  p_limit integer
) returns table (allowed boolean, used_count integer, limit_count integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_used integer;
begin
  insert into public.user_feature_usage (
    user_id, feature_name, period_start, period_end, used_count, limit_count, last_used_at
  ) values (
    p_user_id, p_feature, p_period_start, p_period_end, 0, p_limit, now()
  )
  on conflict (user_id, feature_name, period_start) do nothing;

  select uf.used_count into v_used
  from public.user_feature_usage uf
  where uf.user_id = p_user_id and uf.feature_name = p_feature and uf.period_start = p_period_start
  for update;

  if p_limit is not null and v_used + p_amount > p_limit then
    return query select false, v_used, p_limit;
    return;
  end if;

  update public.user_feature_usage uf set
    used_count = uf.used_count + p_amount,
    limit_count = coalesce(p_limit, uf.limit_count),
    last_used_at = now(),
    updated_at = now()
  where uf.user_id = p_user_id and uf.feature_name = p_feature and uf.period_start = p_period_start
  returning uf.used_count into v_used;

  return query select true, v_used, p_limit;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. Grants — these privileged SECURITY DEFINER functions are service-role ONLY.
--    Revoke the implicit PUBLIC execute so anon/authenticated cannot grant
--    entitlements or meter usage directly; the webhook/server client is service-role.
-- ─────────────────────────────────────────────────────────────────────────────
revoke execute on function public.claim_payment_transaction(text, text, uuid, text, numeric, text, text, text, text, jsonb) from public, anon, authenticated;
revoke execute on function public.finalize_payment_transaction(text, text, text, uuid, text) from public, anon, authenticated;
revoke execute on function public.release_payment_transaction(text, text) from public, anon, authenticated;
revoke execute on function public.record_payment_webhook_event(text, text, text, jsonb, uuid) from public, anon, authenticated;
revoke execute on function public.mark_payment_webhook_event(text, text, text, text) from public, anon, authenticated;
revoke execute on function public.apply_subscription_from_webhook(uuid, text, text, text, text, text, timestamptz, timestamptz, timestamptz, boolean, text, numeric, text, timestamptz) from public, anon, authenticated;
revoke execute on function public.increment_feature_usage(uuid, text, timestamptz, timestamptz, integer, integer) from public, anon, authenticated;

grant execute on function public.claim_payment_transaction(text, text, uuid, text, numeric, text, text, text, text, jsonb) to service_role;
grant execute on function public.finalize_payment_transaction(text, text, text, uuid, text) to service_role;
grant execute on function public.release_payment_transaction(text, text) to service_role;
grant execute on function public.record_payment_webhook_event(text, text, text, jsonb, uuid) to service_role;
grant execute on function public.mark_payment_webhook_event(text, text, text, text) to service_role;
grant execute on function public.apply_subscription_from_webhook(uuid, text, text, text, text, text, timestamptz, timestamptz, timestamptz, boolean, text, numeric, text, timestamptz) to service_role;
grant execute on function public.increment_feature_usage(uuid, text, timestamptz, timestamptz, integer, integer) to service_role;
