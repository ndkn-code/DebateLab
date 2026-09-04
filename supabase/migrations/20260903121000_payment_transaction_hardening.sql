-- ZaloPay order binding and atomic settlement.
-- Provider callbacks may only settle an order created by our authenticated checkout.

create or replace function public.create_zalopay_payment_order(
  p_user_id uuid,
  p_app_trans_id text,
  p_amount numeric,
  p_currency text,
  p_plan_type text,
  p_billing_cycle text
) returns void
language plpgsql security definer set search_path = ''
as $$
declare v_existing public.payment_transactions;
begin
  if p_user_id is null or nullif(trim(p_app_trans_id), '') is null or p_amount is null or p_amount <= 0
     or p_currency is distinct from 'VND' or p_plan_type is distinct from 'premium'
     or p_billing_cycle not in ('monthly', 'three_months', 'yearly') then
    raise exception 'invalid ZaloPay order';
  end if;
  select * into v_existing from public.payment_transactions
    where provider = 'zalopay' and idempotency_key = p_app_trans_id for update;
  if found then
    if v_existing.user_id is distinct from p_user_id or v_existing.amount is distinct from p_amount
       or v_existing.currency is distinct from p_currency or v_existing.plan_type is distinct from p_plan_type
       or v_existing.billing_cycle is distinct from p_billing_cycle then
      raise exception 'ZaloPay order collision';
    end if;
    return;
  end if;
  insert into public.payment_transactions (user_id, provider, idempotency_key, kind, amount, currency, plan_type, billing_cycle, status, processed)
    values (p_user_id, 'zalopay', p_app_trans_id, 'order', p_amount, p_currency, p_plan_type, p_billing_cycle, 'pending', false);
end;
$$;

create or replace function public.fail_zalopay_payment_order(p_app_trans_id text) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  update public.payment_transactions set status = 'failed', updated_at = now()
    where provider = 'zalopay' and idempotency_key = p_app_trans_id and not processed;
end;
$$;

create or replace function public.settle_zalopay_payment(
  p_app_trans_id text,
  p_user_id uuid,
  p_amount numeric,
  p_currency text,
  p_billing_cycle text,
  p_provider_ref text
) returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_txn public.payment_transactions;
  v_sub uuid;
  v_start timestamptz;
  v_end timestamptz;
  v_existing_end timestamptz;
begin
  select * into v_txn from public.payment_transactions
    where provider = 'zalopay' and idempotency_key = p_app_trans_id for update;
  if not found then raise exception 'unknown ZaloPay order'; end if;
  if v_txn.processed then return 'duplicate'; end if;
  if v_txn.status is distinct from 'pending' or v_txn.user_id is distinct from p_user_id
     or v_txn.amount is distinct from p_amount or v_txn.currency is distinct from p_currency
     or v_txn.plan_type is distinct from 'premium' or v_txn.billing_cycle is distinct from p_billing_cycle then
    raise exception 'ZaloPay order mismatch';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(v_txn.user_id::text, 0));
  select max(current_period_end) into v_existing_end
  from public.subscriptions
  where user_id = v_txn.user_id
    and status in ('active', 'trial');
  v_start := greatest(v_txn.created_at, coalesce(v_existing_end, v_txn.created_at));
  if v_txn.billing_cycle not in ('monthly', 'three_months', 'yearly') then
    raise exception 'invalid billing cycle';
  end if;
  v_end := v_start + case v_txn.billing_cycle
    when 'monthly' then interval '1 month'
    when 'three_months' then interval '3 months'
    when 'yearly' then interval '1 year'
    else interval '0'
  end;
  v_sub := public.apply_subscription_from_webhook(
    v_txn.user_id, 'zalopay', null, null, 'premium', 'active', v_start, v_end,
    null, false, v_txn.billing_cycle, v_txn.amount, v_txn.currency, v_txn.created_at);
  update public.payment_transactions set status = 'success', processed = true,
    provider_ref = nullif(p_provider_ref, ''), subscription_id = v_sub, updated_at = now()
    where id = v_txn.id;
  return 'success';
end;
$$;

revoke execute on function public.create_zalopay_payment_order(uuid, text, numeric, text, text, text) from public, anon, authenticated;
revoke execute on function public.fail_zalopay_payment_order(text) from public, anon, authenticated;
revoke execute on function public.settle_zalopay_payment(text, uuid, numeric, text, text, text) from public, anon, authenticated;
grant execute on function public.create_zalopay_payment_order(uuid, text, numeric, text, text, text) to service_role;
grant execute on function public.fail_zalopay_payment_order(text) to service_role;
grant execute on function public.settle_zalopay_payment(text, uuid, numeric, text, text, text) to service_role;
