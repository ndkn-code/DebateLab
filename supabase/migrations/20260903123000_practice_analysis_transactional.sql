-- Make practice analysis creation and Credit reservation one authenticated,
-- idempotent transaction.  The API never writes these rows directly.

alter table public.orb_transactions
  drop constraint if exists orb_transactions_type_check;

alter table public.orb_transactions
  add constraint orb_transactions_type_check
  check (type in (
    'signup_bonus', 'referral_reward', 'referral_bonus',
    'practice_quick', 'practice_full', 'practice_speaking',
    'practice_debate', 'practice_refund', 'duel_entry',
    'admin_grant', 'duel_refund'
  ));

create unique index if not exists idx_orb_transactions_practice_charge_reference
  on public.orb_transactions(user_id, reference_id, type)
  where type in ('practice_speaking', 'practice_debate') and reference_id is not null;

alter table public.practice_attempts
  add column if not exists client_attempt_alias uuid;

create unique index if not exists practice_attempts_user_client_alias_key
  on public.practice_attempts(user_id, client_attempt_alias)
  where client_attempt_alias is not null;

create or replace function private.enforce_practice_draft_server_clock()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.created_at := now();
    new.session_started_at := now();
  else
    new.created_at := old.created_at;
    new.session_started_at := old.session_started_at;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists practice_session_drafts_server_clock
  on public.practice_session_drafts;
create trigger practice_session_drafts_server_clock
before insert or update on public.practice_session_drafts
for each row execute function private.enforce_practice_draft_server_clock();

drop policy if exists "Users can insert own practice attempts" on public.practice_attempts;
drop policy if exists "Users can insert own analysis jobs" on public.analysis_jobs;

create or replace function public.begin_practice_analysis(
  p_attempt_id uuid,
  p_job_id uuid,
  p_user_id uuid,
  p_attempt jsonb,
  p_job jsonb,
  p_cost integer,
  p_charge_type text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attempt public.practice_attempts%rowtype;
  v_job public.analysis_jobs%rowtype;
  v_balance integer;
begin
  -- This RPC is service-role only. The API authenticates the request and
  -- supplies the verified user id; direct browser execution is revoked.
  if auth.role() is distinct from 'service_role' then raise exception 'Not authorized'; end if;
  if p_cost not in (100, 200) or p_charge_type not in ('practice_speaking', 'practice_debate') then
    raise exception 'Invalid practice charge';
  end if;
  if p_attempt->>'id' is distinct from p_attempt_id::text
     or p_attempt->>'user_id' is distinct from p_user_id::text
     or p_attempt->>'status' is distinct from 'submitted'
     or p_job->>'id' is distinct from p_job_id::text
     or p_job->>'attempt_id' is distinct from p_attempt_id::text
     or p_job->>'user_id' is distinct from p_user_id::text
     or p_job->>'status' is distinct from 'queued'
     or (p_attempt->>'practice_track' = 'speaking') is distinct from (p_cost = 100 and p_charge_type = 'practice_speaking')
     or (p_attempt->>'practice_track' = 'debate') is distinct from (p_cost = 200 and p_charge_type = 'practice_debate') then
    raise exception 'Invalid server-authored practice payload';
  end if;

  select * into v_attempt from public.practice_attempts
    where user_id = p_user_id
      and (
        id = p_attempt_id
        or (
          nullif(p_attempt->>'client_attempt_alias', '') is not null
          and client_attempt_alias = (p_attempt->>'client_attempt_alias')::uuid
        )
      )
    order by (id = p_attempt_id) desc
    limit 1
    for update;
  if found then
    select * into v_job from public.analysis_jobs where attempt_id = v_attempt.id and user_id = p_user_id limit 1;
    if not found then raise exception 'Practice attempt has no analysis job'; end if;
    return jsonb_build_object('attempt', to_jsonb(v_attempt), 'job', to_jsonb(v_job), 'charged', true, 'balance', null);
  end if;

  update public.profiles
    set orb_balance = orb_balance - p_cost
    where id = p_user_id and orb_balance >= p_cost
    returning orb_balance into v_balance;
  if not found then raise exception 'Insufficient Credits'; end if;

  insert into public.orb_transactions(user_id, amount, type, reference_id, balance_after)
    values (p_user_id, -p_cost, p_charge_type, p_attempt_id, v_balance);

  insert into public.practice_attempts
    select * from jsonb_populate_record(null::public.practice_attempts, p_attempt)
    returning * into v_attempt;
  insert into public.analysis_jobs
    select * from jsonb_populate_record(null::public.analysis_jobs, p_job)
    returning * into v_job;

  return jsonb_build_object('attempt', to_jsonb(v_attempt), 'job', to_jsonb(v_job), 'charged', true, 'balance', v_balance);
exception
  when unique_violation then
    select * into v_attempt from public.practice_attempts
      where user_id = p_user_id
        and (id = p_attempt_id or client_attempt_alias = nullif(p_attempt->>'client_attempt_alias', '')::uuid)
      order by (id = p_attempt_id) desc limit 1;
    select * into v_job from public.analysis_jobs where attempt_id = v_attempt.id and user_id = p_user_id limit 1;
    if v_attempt.id is not null and v_job.id is not null then
      select balance_after into v_balance from public.orb_transactions
        where user_id = p_user_id and reference_id = p_attempt_id and type = p_charge_type limit 1;
      return jsonb_build_object('attempt', to_jsonb(v_attempt), 'job', to_jsonb(v_job), 'charged', true, 'balance', v_balance);
    end if;
    raise;
end;
$$;

revoke all on function public.begin_practice_analysis(uuid, uuid, uuid, jsonb, jsonb, integer, text) from public, anon, authenticated;
grant execute on function public.begin_practice_analysis(uuid, uuid, uuid, jsonb, jsonb, integer, text) to service_role;

create or replace function public.refund_practice_analysis(p_attempt_id uuid, p_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid;
  v_amount integer;
  v_balance integer;
begin
  select user_id, case when practice_track = 'speaking' then 100 else 200 end
    into v_user, v_amount from public.practice_attempts where id = p_attempt_id for update;
  if v_user is null or v_user <> p_user_id or auth.role() is distinct from 'service_role' then
    raise exception 'Not authorized';
  end if;
  if exists (select 1 from public.orb_transactions where reference_id = p_attempt_id and type = 'practice_refund') then
    select balance_after into v_balance from public.orb_transactions where reference_id = p_attempt_id and type = 'practice_refund' limit 1;
    return v_balance;
  end if;
  select orb_balance + v_amount into v_balance from public.profiles where id = v_user for update;
  update public.profiles set orb_balance = v_balance where id = v_user;
  insert into public.orb_transactions(user_id, amount, type, reference_id, balance_after)
    values (v_user, v_amount, 'practice_refund', p_attempt_id, v_balance);
  update public.practice_attempts set status = 'failed', error_code = 'queue_failed', updated_at = now() where id = p_attempt_id;
  return v_balance;
end;
$$;

revoke all on function public.refund_practice_analysis(uuid, uuid) from public, anon, authenticated;
grant execute on function public.refund_practice_analysis(uuid, uuid) to service_role;
