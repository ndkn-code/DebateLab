-- ============================================================
-- Guided duel setup flow support
-- ============================================================

alter table public.debate_duels
  add column if not exists topic_difficulty text not null default 'beginner';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'debate_duels_topic_difficulty_check'
  ) then
    alter table public.debate_duels
      add constraint debate_duels_topic_difficulty_check
      check (topic_difficulty in ('beginner', 'intermediate', 'advanced'));
  end if;
end $$;

create or replace function public.join_debate_duel(
  p_share_code text,
  p_actor_user_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_duel public.debate_duels%rowtype;
  v_existing_participant public.debate_duel_participants%rowtype;
  v_creator_participant public.debate_duel_participants%rowtype;
  v_participant_count integer;
  v_join_role text;
  v_creator_role text;
  v_profile public.profiles%rowtype;
begin
  if auth.uid() is null or auth.uid() <> p_actor_user_id then
    raise exception 'FORBIDDEN';
  end if;

  select * into v_duel
  from public.debate_duels
  where share_code = upper(trim(p_share_code))
  for update;

  if not found then
    raise exception 'DUEL_NOT_FOUND';
  end if;

  if v_duel.status <> 'lobby' then
    raise exception 'DUEL_ALREADY_STARTED';
  end if;

  if v_duel.expires_at <= now() then
    update public.debate_duels
    set status = 'expired',
        current_phase = 'completed',
        updated_at = now()
    where id = v_duel.id;
    raise exception 'DUEL_EXPIRED';
  end if;

  select * into v_existing_participant
  from public.debate_duel_participants
  where duel_id = v_duel.id
    and user_id = p_actor_user_id
  for update;

  if found then
    return v_duel.id;
  end if;

  select count(*) into v_participant_count
  from public.debate_duel_participants
  where duel_id = v_duel.id;

  if v_participant_count >= 2 then
    raise exception 'DUEL_ROOM_FULL';
  end if;

  if v_duel.side_assignment_mode = 'choose' and v_duel.creator_side_preference is not null then
    v_join_role := case
      when v_duel.creator_side_preference = 'proposition' then 'opposition'
      else 'proposition'
    end;
  elsif v_participant_count = 1 then
    select * into v_creator_participant
    from public.debate_duel_participants
    where duel_id = v_duel.id
      and user_id = v_duel.creator_id
    for update;

    if v_creator_participant.role is not null then
      v_join_role := case
        when v_creator_participant.role = 'proposition' then 'opposition'
        else 'proposition'
      end;
    else
      if (ascii(substr(md5(v_duel.id::text), 1, 1)) % 2) = 0 then
        v_creator_role := 'proposition';
      else
        v_creator_role := 'opposition';
      end if;

      update public.debate_duel_participants
      set role = v_creator_role,
          updated_at = now()
      where id = v_creator_participant.id;

      v_join_role := case
        when v_creator_role = 'proposition' then 'opposition'
        else 'proposition'
      end;
    end if;
  else
    v_join_role := null;
  end if;

  select * into v_profile
  from public.profiles
  where id = p_actor_user_id;

  insert into public.debate_duel_participants (
    duel_id,
    user_id,
    role,
    display_name_snapshot,
    avatar_url_snapshot
  )
  values (
    v_duel.id,
    p_actor_user_id,
    v_join_role,
    coalesce(v_profile.display_name, 'Debater'),
    v_profile.avatar_url
  );

  return v_duel.id;
end;
$$;

revoke execute on function public.join_debate_duel(text, uuid) from public;
revoke execute on function public.join_debate_duel(text, uuid) from anon;
grant execute on function public.join_debate_duel(text, uuid) to authenticated, service_role;

create or replace function public.set_debate_duel_ready(
  p_share_code text,
  p_actor_user_id uuid,
  p_ready boolean
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_duel public.debate_duels%rowtype;
  v_participant public.debate_duel_participants%rowtype;
begin
  if auth.uid() is null or auth.uid() <> p_actor_user_id then
    raise exception 'FORBIDDEN';
  end if;

  select * into v_duel
  from public.debate_duels
  where share_code = upper(trim(p_share_code))
  for update;

  if not found then
    raise exception 'DUEL_NOT_FOUND';
  end if;

  if v_duel.status <> 'lobby' then
    raise exception 'DUEL_ALREADY_STARTED';
  end if;

  if v_duel.expires_at <= now() then
    update public.debate_duels
    set status = 'expired',
        current_phase = 'completed',
        updated_at = now()
    where id = v_duel.id;
    raise exception 'DUEL_EXPIRED';
  end if;

  select * into v_participant
  from public.debate_duel_participants
  where duel_id = v_duel.id
    and user_id = p_actor_user_id
  for update;

  if not found then
    raise exception 'DUEL_JOIN_REQUIRED';
  end if;

  update public.debate_duel_participants
  set ready_at = case when p_ready then now() else null end,
      updated_at = now()
  where id = v_participant.id;

  return v_duel.id;
end;
$$;

revoke execute on function public.set_debate_duel_ready(text, uuid, boolean) from public;
revoke execute on function public.set_debate_duel_ready(text, uuid, boolean) from anon;
grant execute on function public.set_debate_duel_ready(text, uuid, boolean) to authenticated, service_role;

create or replace function public.start_debate_duel(
  p_share_code text,
  p_actor_user_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_duel public.debate_duels%rowtype;
  v_participant_count integer;
  v_ready_count integer;
  v_creator_participant public.debate_duel_participants%rowtype;
  v_other_participant public.debate_duel_participants%rowtype;
  v_creator_role text;
  v_other_role text;
  v_creator_balance integer;
  v_other_balance integer;
begin
  if auth.uid() is null or auth.uid() <> p_actor_user_id then
    raise exception 'FORBIDDEN';
  end if;

  select * into v_duel
  from public.debate_duels
  where share_code = upper(trim(p_share_code))
  for update;

  if not found then
    raise exception 'DUEL_NOT_FOUND';
  end if;

  if v_duel.creator_id <> p_actor_user_id then
    raise exception 'DUEL_CREATOR_REQUIRED';
  end if;

  if v_duel.status <> 'lobby' then
    raise exception 'DUEL_ALREADY_STARTED';
  end if;

  if v_duel.expires_at <= now() then
    update public.debate_duels
    set status = 'expired',
        current_phase = 'completed',
        updated_at = now()
    where id = v_duel.id;
    raise exception 'DUEL_EXPIRED';
  end if;

  select count(*), count(ready_at)
  into v_participant_count, v_ready_count
  from public.debate_duel_participants
  where duel_id = v_duel.id;

  if v_participant_count <> 2 then
    raise exception 'DUEL_REQUIRES_TWO_PARTICIPANTS';
  end if;

  if v_ready_count <> 2 then
    raise exception 'DUEL_NOT_READY';
  end if;

  select *
  into v_creator_participant
  from public.debate_duel_participants
  where duel_id = v_duel.id
    and user_id = v_duel.creator_id
  limit 1;

  select *
  into v_other_participant
  from public.debate_duel_participants
  where duel_id = v_duel.id
    and user_id <> v_duel.creator_id
  limit 1;

  if v_creator_participant.role is not null and v_other_participant.role is not null then
    v_creator_role := v_creator_participant.role;
    v_other_role := v_other_participant.role;
  elsif v_duel.side_assignment_mode = 'choose' and v_duel.creator_side_preference is not null then
    v_creator_role := v_duel.creator_side_preference;
    v_other_role := case when v_creator_role = 'proposition' then 'opposition' else 'proposition' end;
  else
    if (ascii(substr(md5(v_duel.id::text), 1, 1)) % 2) = 0 then
      v_creator_role := 'proposition';
    else
      v_creator_role := 'opposition';
    end if;
    v_other_role := case when v_creator_role = 'proposition' then 'opposition' else 'proposition' end;
  end if;

  select orb_balance into v_creator_balance
  from public.profiles
  where id = v_creator_participant.user_id
  for update;

  select orb_balance into v_other_balance
  from public.profiles
  where id = v_other_participant.user_id
  for update;

  if coalesce(v_creator_balance, 0) < v_duel.entry_cost or coalesce(v_other_balance, 0) < v_duel.entry_cost then
    raise exception 'INSUFFICIENT_CREDITS';
  end if;

  update public.profiles
  set orb_balance = orb_balance - v_duel.entry_cost
  where id in (v_creator_participant.user_id, v_other_participant.user_id);

  insert into public.orb_transactions (user_id, amount, type, reference_id, balance_after)
  values
    (
      v_creator_participant.user_id,
      -v_duel.entry_cost,
      'duel_entry',
      v_duel.id,
      v_creator_balance - v_duel.entry_cost
    ),
    (
      v_other_participant.user_id,
      -v_duel.entry_cost,
      'duel_entry',
      v_duel.id,
      v_other_balance - v_duel.entry_cost
    );

  update public.debate_duel_participants
  set role = case
        when id = v_creator_participant.id then v_creator_role
        else v_other_role
      end,
      credits_charged_at = now(),
      updated_at = now()
  where duel_id = v_duel.id;

  update public.debate_duels
  set status = 'in_progress',
      current_phase = 'prep',
      phase_started_at = now(),
      started_at = now(),
      updated_at = now()
  where id = v_duel.id;

  return v_duel.id;
end;
$$;

revoke execute on function public.start_debate_duel(text, uuid) from public;
revoke execute on function public.start_debate_duel(text, uuid) from anon;
grant execute on function public.start_debate_duel(text, uuid) to authenticated, service_role;
