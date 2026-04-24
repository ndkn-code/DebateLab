-- Update referral rewards from 300 Credits to 600 Credits for both users.
-- Keep qualification and crediting in one locked database path.

create or replace function public.adjust_orb_balance(
  p_user_id uuid,
  p_amount integer,
  p_type text,
  p_reference_id uuid default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_new_balance integer;
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    raise exception 'FORBIDDEN';
  end if;

  if (
    p_type = 'practice_speaking'
    and p_amount <> -100
  ) or (
    p_type = 'practice_debate'
    and p_amount <> -200
  ) or p_type not in ('practice_speaking', 'practice_debate') then
    raise exception 'INVALID_CREDIT_ADJUSTMENT';
  end if;

  update public.profiles
  set orb_balance = orb_balance + p_amount
  where id = p_user_id
    and orb_balance + p_amount >= 0
  returning orb_balance into v_new_balance;

  if not found then
    raise exception 'Unable to adjust balance for user %', p_user_id;
  end if;

  insert into public.orb_transactions (user_id, amount, type, reference_id, balance_after)
  values (p_user_id, p_amount, p_type, p_reference_id, v_new_balance);

  return v_new_balance;
end;
$$;

create or replace function public.credit_referral(p_referral_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  ref public.referrals%rowtype;
  referrer_count integer;
  referrer_balance integer;
  referee_balance integer;
begin
  select * into ref
  from public.referrals
  where id = p_referral_id and status = 'qualified'
  for update;

  if not found then
    return;
  end if;

  perform 1
  from public.profiles
  where id = ref.referrer_id
  for update;

  select count(*) into referrer_count
  from public.referrals
  where referrer_id = ref.referrer_id
    and status = 'credited';

  if referrer_count >= 20 then
    update public.referrals
    set status = 'rejected'
    where id = p_referral_id;
    return;
  end if;

  update public.profiles
  set orb_balance = orb_balance + 600
  where id = ref.referrer_id
  returning orb_balance into referrer_balance;

  if not found then
    raise exception 'Unable to credit referrer %', ref.referrer_id;
  end if;

  update public.profiles
  set orb_balance = orb_balance + 600
  where id = ref.referee_id
  returning orb_balance into referee_balance;

  if not found then
    raise exception 'Unable to credit referee %', ref.referee_id;
  end if;

  insert into public.orb_transactions (user_id, amount, type, reference_id, balance_after)
  values
    (ref.referrer_id, 600, 'referral_reward', p_referral_id, referrer_balance),
    (ref.referee_id, 600, 'referral_bonus', p_referral_id, referee_balance);

  update public.referrals
  set status = 'credited',
      referrer_orbs_awarded = 600,
      referee_orbs_awarded = 600,
      credited_at = now()
  where id = p_referral_id
    and status = 'qualified';
end;
$$;

create or replace function public.qualify_and_credit_referral(
  p_referee_id uuid,
  p_transcript_word_count integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  ref public.referrals%rowtype;
begin
  if p_transcript_word_count < 30 then
    return;
  end if;

  if auth.uid() is null or auth.uid() <> p_referee_id then
    raise exception 'FORBIDDEN';
  end if;

  select * into ref
  from public.referrals
  where referee_id = p_referee_id
    and status in ('pending', 'qualified')
  for update;

  if not found then
    return;
  end if;

  if ref.status = 'pending' then
    update public.referrals
    set status = 'qualified',
        qualified_at = coalesce(qualified_at, now())
    where id = ref.id
      and status = 'pending'
    returning * into ref;

    if not found then
      return;
    end if;
  end if;

  perform public.credit_referral(ref.id);
end;
$$;

revoke execute on function public.adjust_orb_balance(uuid, integer, text, uuid) from public;
revoke execute on function public.adjust_orb_balance(uuid, integer, text, uuid) from anon;
grant execute on function public.adjust_orb_balance(uuid, integer, text, uuid) to authenticated;

revoke execute on function public.credit_referral(uuid) from public;
revoke execute on function public.credit_referral(uuid) from anon;
revoke execute on function public.credit_referral(uuid) from authenticated;
grant execute on function public.credit_referral(uuid) to service_role;

revoke execute on function public.qualify_and_credit_referral(uuid, integer) from public;
revoke execute on function public.qualify_and_credit_referral(uuid, integer) from anon;
grant execute on function public.qualify_and_credit_referral(uuid, integer) to authenticated;
