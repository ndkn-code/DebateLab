-- Adds runtime practice language support for English and Vietnamese sessions.

alter table public.debate_sessions
  add column if not exists practice_language text default 'en';

update public.debate_sessions
set practice_language = 'en'
where practice_language is null
   or practice_language not in ('en', 'vi');

alter table public.debate_sessions
  alter column practice_language set default 'en',
  alter column practice_language set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'debate_sessions_practice_language_check'
      and conrelid = 'public.debate_sessions'::regclass
  ) then
    alter table public.debate_sessions
      add constraint debate_sessions_practice_language_check
      check (practice_language in ('en', 'vi'));
  end if;
end $$;

alter table public.practice_session_drafts
  add column if not exists practice_language text default 'en';

update public.practice_session_drafts
set practice_language = 'en'
where practice_language is null
   or practice_language not in ('en', 'vi');

alter table public.practice_session_drafts
  alter column practice_language set default 'en',
  alter column practice_language set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'practice_session_drafts_practice_language_check'
      and conrelid = 'public.practice_session_drafts'::regclass
  ) then
    alter table public.practice_session_drafts
      add constraint practice_session_drafts_practice_language_check
      check (practice_language in ('en', 'vi'));
  end if;
end $$;

alter table public.debate_duels
  add column if not exists practice_language text default 'en';

update public.debate_duels
set practice_language = 'en'
where practice_language is null
   or practice_language not in ('en', 'vi');

alter table public.debate_duels
  alter column practice_language set default 'en',
  alter column practice_language set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'debate_duels_practice_language_check'
      and conrelid = 'public.debate_duels'::regclass
  ) then
    alter table public.debate_duels
      add constraint debate_duels_practice_language_check
      check (practice_language in ('en', 'vi'));
  end if;
end $$;

alter table public.debate_duel_matchmaking_tickets
  add column if not exists practice_language text default 'en';

update public.debate_duel_matchmaking_tickets
set practice_language = 'en'
where practice_language is null
   or practice_language not in ('en', 'vi');

alter table public.debate_duel_matchmaking_tickets
  alter column practice_language set default 'en',
  alter column practice_language set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'debate_duel_matchmaking_tickets_practice_language_check'
      and conrelid = 'public.debate_duel_matchmaking_tickets'::regclass
  ) then
    alter table public.debate_duel_matchmaking_tickets
      add constraint debate_duel_matchmaking_tickets_practice_language_check
      check (practice_language in ('en', 'vi'));
  end if;
end $$;

create index if not exists idx_debate_sessions_user_language_created
  on public.debate_sessions(user_id, practice_language, created_at desc);

create index if not exists idx_debate_duels_language_created
  on public.debate_duels(practice_language, created_at desc);

create index if not exists idx_duel_matchmaking_language_queue
  on public.debate_duel_matchmaking_tickets(
    practice_language,
    topic_category,
    topic_difficulty,
    prep_time_seconds,
    opening_time_seconds,
    rebuttal_time_seconds,
    created_at
  )
  where status = 'queued';

drop function if exists public.enter_debate_duel_matchmaking(
  uuid, text, text, text, text, integer, integer, integer
);

create or replace function public.enter_debate_duel_matchmaking(
  p_actor_user_id uuid,
  p_topic_category text,
  p_topic_difficulty text,
  p_topic_title text,
  p_topic_description text,
  p_practice_language text default 'en',
  p_prep_time_seconds integer default 120,
  p_opening_time_seconds integer default 180,
  p_rebuttal_time_seconds integer default 120
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ticket public.debate_duel_matchmaking_tickets%rowtype;
  v_opponent public.debate_duel_matchmaking_tickets%rowtype;
  v_share_code text;
  v_duel_id uuid;
  v_actor_profile public.profiles%rowtype;
  v_opponent_profile public.profiles%rowtype;
  v_actor_role text;
  v_opponent_role text;
  v_practice_language text := coalesce(p_practice_language, 'en');
begin
  if auth.uid() is null or auth.uid() <> p_actor_user_id then
    raise exception 'FORBIDDEN';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_actor_user_id::text));

  if p_topic_difficulty not in ('beginner', 'intermediate', 'advanced') then
    raise exception 'INVALID_DIFFICULTY';
  end if;

  if v_practice_language not in ('en', 'vi') then
    v_practice_language := 'en';
  end if;

  update public.debate_duel_matchmaking_tickets
  set status = 'expired',
      updated_at = now()
  where status = 'queued'
    and expires_at <= now();

  select * into v_ticket
  from public.debate_duel_matchmaking_tickets
  where user_id = p_actor_user_id
    and status = 'queued'
    and expires_at > now()
  for update;

  if found then
    update public.debate_duel_matchmaking_tickets
    set topic_category = p_topic_category,
        topic_difficulty = p_topic_difficulty,
        practice_language = v_practice_language,
        prep_time_seconds = p_prep_time_seconds,
        opening_time_seconds = p_opening_time_seconds,
        rebuttal_time_seconds = p_rebuttal_time_seconds,
        expires_at = now() + interval '10 minutes',
        updated_at = now()
    where id = v_ticket.id
    returning * into v_ticket;
  else
    insert into public.debate_duel_matchmaking_tickets (
      user_id,
      topic_category,
      topic_difficulty,
      practice_language,
      prep_time_seconds,
      opening_time_seconds,
      rebuttal_time_seconds
    )
    values (
      p_actor_user_id,
      p_topic_category,
      p_topic_difficulty,
      v_practice_language,
      p_prep_time_seconds,
      p_opening_time_seconds,
      p_rebuttal_time_seconds
    )
    returning * into v_ticket;
  end if;

  select * into v_opponent
  from public.debate_duel_matchmaking_tickets
  where status = 'queued'
    and id <> v_ticket.id
    and user_id <> p_actor_user_id
    and expires_at > now()
    and topic_category = v_ticket.topic_category
    and topic_difficulty = v_ticket.topic_difficulty
    and practice_language = v_ticket.practice_language
    and prep_time_seconds = v_ticket.prep_time_seconds
    and opening_time_seconds = v_ticket.opening_time_seconds
    and rebuttal_time_seconds = v_ticket.rebuttal_time_seconds
  order by created_at asc
  for update skip locked
  limit 1;

  if not found then
    return v_ticket.id;
  end if;

  v_share_code := public.generate_duel_share_code();

  insert into public.debate_duels (
    share_code,
    creator_id,
    topic_title,
    topic_category,
    topic_difficulty,
    topic_description,
    practice_language,
    prep_time_seconds,
    opening_time_seconds,
    rebuttal_time_seconds,
    entry_cost,
    side_assignment_mode,
    duel_kind,
    rated
  )
  values (
    v_share_code,
    p_actor_user_id,
    p_topic_title,
    p_topic_category,
    p_topic_difficulty,
    p_topic_description,
    v_ticket.practice_language,
    v_ticket.prep_time_seconds,
    v_ticket.opening_time_seconds,
    v_ticket.rebuttal_time_seconds,
    200,
    'random',
    'matchmaking',
    true
  )
  returning id into v_duel_id;

  if (ascii(substr(md5(v_ticket.id::text || v_opponent.id::text), 1, 1)) % 2) = 0 then
    v_actor_role := 'proposition';
  else
    v_actor_role := 'opposition';
  end if;
  v_opponent_role := case when v_actor_role = 'proposition' then 'opposition' else 'proposition' end;

  select * into v_actor_profile from public.profiles where id = p_actor_user_id;
  select * into v_opponent_profile from public.profiles where id = v_opponent.user_id;

  insert into public.debate_duel_participants (
    duel_id,
    user_id,
    role,
    display_name_snapshot,
    avatar_url_snapshot
  )
  values
    (
      v_duel_id,
      p_actor_user_id,
      v_actor_role,
      coalesce(v_actor_profile.display_name, 'Debater'),
      v_actor_profile.avatar_url
    ),
    (
      v_duel_id,
      v_opponent.user_id,
      v_opponent_role,
      coalesce(v_opponent_profile.display_name, 'Debater'),
      v_opponent_profile.avatar_url
    );

  update public.debate_duel_matchmaking_tickets
  set status = 'matched',
      matched_duel_id = v_duel_id,
      matched_ticket_id = v_opponent.id,
      matched_at = now(),
      updated_at = now()
  where id = v_ticket.id;

  update public.debate_duel_matchmaking_tickets
  set status = 'matched',
      matched_duel_id = v_duel_id,
      matched_ticket_id = v_ticket.id,
      matched_at = now(),
      updated_at = now()
  where id = v_opponent.id;

  return v_ticket.id;
end;
$$;

revoke execute on function public.enter_debate_duel_matchmaking(
  uuid, text, text, text, text, text, integer, integer, integer
) from public;
revoke execute on function public.enter_debate_duel_matchmaking(
  uuid, text, text, text, text, text, integer, integer, integer
) from anon;
grant execute on function public.enter_debate_duel_matchmaking(
  uuid, text, text, text, text, text, integer, integer, integer
) to authenticated, service_role;
