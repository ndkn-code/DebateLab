-- Bind every AI Coach conversation to one product. This migration also repairs
-- schema drift: the application and migration 018 already read context_type and
-- context_id, but the original chat_conversations table never declared them.

alter table public.chat_conversations
  add column if not exists context_type text,
  add column if not exists context_id uuid,
  add column if not exists product_context text,
  add column if not exists initial_request_id uuid;

update public.chat_conversations
set product_context = case
  when lower(coalesce(context_type, '')) like 'ielts%' then 'ielts'
  else 'debate'
end
where product_context is null;

alter table public.chat_conversations
  alter column product_context set default 'debate',
  alter column product_context set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.chat_conversations'::regclass
      and conname = 'chat_conversations_product_context_check'
  ) then
    alter table public.chat_conversations
      add constraint chat_conversations_product_context_check
      check (product_context in ('debate', 'ielts'));
  end if;
end;
$$;

create index if not exists chat_conversations_user_product_updated_idx
  on public.chat_conversations(user_id, product_context, updated_at desc);

-- Existing Debate clients persist their own messages. IELTS structured cards
-- are different: only the trusted completion RPC may persist them, otherwise a
-- learner could forge assistant/teacher-looking metadata through the REST API.
drop policy if exists "Users can insert own messages" on public.chat_messages;
create policy "Users can insert own Debate messages"
  on public.chat_messages for insert
  with check (
    exists (
      select 1
      from public.chat_conversations c
      where c.id = conversation_id
        and c.user_id = auth.uid()
        and c.product_context = 'debate'
    )
  );

create or replace function private.validate_chat_conversation_product_context()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and (
    old.product_context is distinct from new.product_context
    or old.context_type is distinct from new.context_type
    or old.context_id is distinct from new.context_id
    or old.initial_request_id is distinct from new.initial_request_id
  ) then
    raise exception 'Coach conversation context is immutable';
  end if;

  if new.product_context = 'ielts' and new.context_type not in (
    'ielts-coach',
    'ielts-home',
    'ielts-study-plan'
  ) then
    raise exception 'IELTS conversations require an explicit IELTS context type';
  end if;

  if new.product_context = 'ielts' and new.context_id is not null then
    raise exception 'Entity-scoped IELTS coach contexts are not supported yet';
  end if;

  if new.product_context = 'debate'
    and lower(coalesce(new.context_type, '')) like 'ielts%'
  then
    raise exception 'Debate conversations cannot use an IELTS context type';
  end if;

  return new;
end;
$$;

drop trigger if exists chat_conversations_validate_product_context
  on public.chat_conversations;
create trigger chat_conversations_validate_product_context
before insert or update of product_context, context_type, context_id, initial_request_id
on public.chat_conversations
for each row execute function private.validate_chat_conversation_product_context();

-- The no-argument call remains backwards compatible and now defaults to
-- Debate. IELTS callers must request their product explicitly.
drop function if exists public.get_chat_sidebar_payload();
create function public.get_chat_sidebar_payload(
  p_product_context text default 'debate'
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid;
begin
  select auth.uid() into v_user_id;

  if v_user_id is null then
    return '[]'::jsonb;
  end if;

  if p_product_context not in ('debate', 'ielts') then
    raise exception 'Unsupported coach product context';
  end if;

  return coalesce(
    (
      select jsonb_agg(
        to_jsonb(c) || jsonb_build_object('preview', p.preview)
        order by c.updated_at desc
      )
      from (
        select
          id,
          user_id,
          title,
          product_context,
          context_type,
          context_id,
          created_at,
          updated_at
        from public.chat_conversations
        where user_id = v_user_id
          and product_context = p_product_context
        order by updated_at desc
        limit 30
      ) c
      left join lateral (
        select
          case
            when length(normalized.content) > 88
              then substring(normalized.content from 1 for 85) || '...'
            else normalized.content
          end as preview
        from (
          select trim(regexp_replace(cm.content, '\s+', ' ', 'g')) as content
          from public.chat_messages cm
          where cm.conversation_id = c.id
          order by cm.created_at desc
          limit 1
        ) normalized
      ) p on true
    ),
    '[]'::jsonb
  );
end;
$$;

revoke all on function public.get_chat_sidebar_payload(text) from public, anon;
grant execute on function public.get_chat_sidebar_payload(text) to authenticated;

create unique index if not exists chat_conversations_user_initial_request_idx
  on public.chat_conversations(user_id, initial_request_id)
  where initial_request_id is not null;

create or replace function public.ensure_ielts_coach_conversation(
  p_client_request_id uuid,
  p_context_type text,
  p_context_id uuid default null,
  p_title text default 'New IELTS conversation'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_id uuid;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if p_context_type not in (
    'ielts-coach', 'ielts-home', 'ielts-study-plan'
  ) then
    raise exception 'Unsupported IELTS coach context';
  end if;
  if p_context_id is not null then
    raise exception 'Entity-scoped IELTS coach contexts are not supported yet';
  end if;

  insert into public.chat_conversations (
    user_id, title, product_context, context_type, context_id,
    initial_request_id
  ) values (
    v_user_id, left(coalesce(nullif(trim(p_title), ''), 'New IELTS conversation'), 120),
    'ielts', p_context_type, p_context_id, p_client_request_id
  )
  on conflict do nothing
  returning id into v_id;

  if v_id is null then
    select id into v_id
    from public.chat_conversations
    where user_id = v_user_id
      and initial_request_id = p_client_request_id
      and product_context = 'ielts'
      and context_type = p_context_type
      and context_id is not distinct from p_context_id;
  end if;
  if v_id is null then raise exception 'Coach request identity mismatch'; end if;
  return v_id;
end;
$$;

revoke all on function public.ensure_ielts_coach_conversation(uuid, text, uuid, text) from public, anon;
grant execute on function public.ensure_ielts_coach_conversation(uuid, text, uuid, text) to authenticated;

-- Synchronous coaching still needs durable request identity. This small ledger
-- provides bounded stale-lease recovery without introducing another model path.
create table if not exists public.ai_coach_turns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid not null references public.chat_conversations(id) on delete cascade,
  product_context text not null check (product_context in ('debate', 'ielts')),
  client_request_id uuid not null,
  request_hash text not null,
  status text not null default 'queued'
    check (status in ('queued', 'running', 'completed', 'failed')),
  attempt_count integer not null default 0 check (attempt_count between 0 and 2),
  lease_expires_at timestamptz,
  claim_token uuid,
  user_message_id uuid references public.chat_messages(id) on delete set null,
  assistant_message_id uuid references public.chat_messages(id) on delete set null,
  response_text text,
  response_metadata jsonb not null default '{}'::jsonb,
  error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (user_id, client_request_id)
);

create index if not exists ai_coach_turns_user_status_updated_idx
  on public.ai_coach_turns(user_id, product_context, status, updated_at desc);

alter table public.ai_coach_turns enable row level security;
drop policy if exists "Users can view own AI coach turns" on public.ai_coach_turns;
create policy "Users can view own AI coach turns"
  on public.ai_coach_turns for select
  using (auth.uid() = user_id);

revoke all on table public.ai_coach_turns from public, anon, authenticated;

create or replace function public.claim_ai_coach_turn(
  p_user_id uuid,
  p_conversation_id uuid,
  p_client_request_id uuid,
  p_product_context text,
  p_request_hash text,
  p_lease_seconds integer default 90
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_turn public.ai_coach_turns%rowtype;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Trusted server role required';
  end if;
  if p_product_context not in ('debate', 'ielts') then
    raise exception 'Unsupported coach product context';
  end if;
  if not exists (
    select 1 from public.chat_conversations c
    where c.id = p_conversation_id
      and c.user_id = p_user_id
      and c.product_context = p_product_context
  ) then
    raise exception 'Conversation not found';
  end if;

  insert into public.ai_coach_turns (
    user_id, conversation_id, product_context, client_request_id, request_hash
  ) values (
    p_user_id, p_conversation_id, p_product_context, p_client_request_id,
    p_request_hash
  ) on conflict (user_id, client_request_id) do nothing;

  select * into v_turn
  from public.ai_coach_turns t
  where t.user_id = p_user_id
    and t.client_request_id = p_client_request_id
  for update;

  if v_turn.conversation_id <> p_conversation_id
    or v_turn.product_context <> p_product_context
    or v_turn.request_hash <> p_request_hash
  then
    raise exception 'Coach request identity mismatch';
  end if;

  if v_turn.status = 'completed' then
    return jsonb_build_object(
      'outcome', 'completed',
      'turnId', v_turn.id,
      'responseText', v_turn.response_text,
      'responseMetadata', v_turn.response_metadata,
      'assistantMessageId', v_turn.assistant_message_id,
      'attemptCount', v_turn.attempt_count
    );
  end if;
  if v_turn.status = 'running' and v_turn.lease_expires_at > now() then
    return jsonb_build_object(
      'outcome', 'lease_active',
      'turnId', v_turn.id,
      'attemptCount', v_turn.attempt_count,
      'claimToken', v_turn.claim_token
    );
  end if;
  if v_turn.attempt_count >= 2 then
    return jsonb_build_object(
      'outcome', 'exhausted',
      'turnId', v_turn.id,
      'attemptCount', v_turn.attempt_count,
      'errorCode', coalesce(v_turn.error_code, 'IELTS_COACH_RETRY_EXHAUSTED')
    );
  end if;

  update public.ai_coach_turns
  set status = 'running',
      attempt_count = attempt_count + 1,
      lease_expires_at = now() + make_interval(secs => greatest(10, least(p_lease_seconds, 120))),
      claim_token = gen_random_uuid(),
      error_code = null,
      updated_at = now()
  where id = v_turn.id
  returning * into v_turn;

  return jsonb_build_object(
    'outcome', 'claimed',
    'turnId', v_turn.id,
    'attemptCount', v_turn.attempt_count,
    'claimToken', v_turn.claim_token
  );
end;
$$;

create or replace function public.complete_ai_coach_turn(
  p_user_id uuid,
  p_turn_id uuid,
  p_claim_token uuid,
  p_attempt_count integer,
  p_user_message text,
  p_assistant_message text,
  p_response_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_turn public.ai_coach_turns%rowtype;
  v_user_message_id uuid;
  v_assistant_message_id uuid;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Trusted server role required';
  end if;
  select * into v_turn
  from public.ai_coach_turns t
  where t.id = p_turn_id
    and t.user_id = p_user_id
    and t.status = 'running'
    and t.claim_token = p_claim_token
    and t.attempt_count = p_attempt_count
  for update;

  if not found then raise exception 'Coach turn claim is stale'; end if;
  if char_length(trim(p_user_message)) = 0 or char_length(trim(p_assistant_message)) = 0 then
    raise exception 'Coach messages cannot be empty';
  end if;

  insert into public.chat_messages (conversation_id, role, content)
  values (v_turn.conversation_id, 'user', trim(p_user_message))
  returning id into v_user_message_id;
  insert into public.chat_messages (conversation_id, role, content, metadata)
  values (
    v_turn.conversation_id,
    'assistant',
    p_assistant_message,
    coalesce(p_response_metadata, '{}'::jsonb)
  ) returning id into v_assistant_message_id;

  update public.chat_conversations
  set message_count = message_count + 2,
      last_message_at = now(),
      updated_at = now()
  where id = v_turn.conversation_id;

  update public.ai_coach_turns
  set status = 'completed',
      lease_expires_at = null,
      claim_token = null,
      user_message_id = v_user_message_id,
      assistant_message_id = v_assistant_message_id,
      response_text = p_assistant_message,
      response_metadata = coalesce(p_response_metadata, '{}'::jsonb),
      error_code = null,
      completed_at = now(),
      updated_at = now()
  where id = v_turn.id;

  return jsonb_build_object(
    'outcome', 'completed',
    'turnId', v_turn.id,
    'assistantMessageId', v_assistant_message_id
  );
end;
$$;

create or replace function public.fail_ai_coach_turn(
  p_user_id uuid,
  p_turn_id uuid,
  p_claim_token uuid,
  p_attempt_count integer,
  p_error_code text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Trusted server role required';
  end if;
  update public.ai_coach_turns
  set status = 'failed',
      lease_expires_at = null,
      claim_token = null,
      error_code = left(coalesce(p_error_code, 'IELTS_COACH_FAILED'), 120),
      updated_at = now()
  where id = p_turn_id
    and user_id = p_user_id
    and status = 'running'
    and claim_token = p_claim_token
    and attempt_count = p_attempt_count;
  if not found then raise exception 'Coach turn not found or not running'; end if;
end;
$$;

revoke all on function public.claim_ai_coach_turn(uuid, uuid, uuid, text, text, integer) from public, anon, authenticated;
revoke all on function public.complete_ai_coach_turn(uuid, uuid, uuid, integer, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.fail_ai_coach_turn(uuid, uuid, uuid, integer, text) from public, anon, authenticated;
grant execute on function public.claim_ai_coach_turn(uuid, uuid, uuid, text, text, integer) to service_role;
grant execute on function public.complete_ai_coach_turn(uuid, uuid, uuid, integer, text, text, jsonb) to service_role;
grant execute on function public.fail_ai_coach_turn(uuid, uuid, uuid, integer, text) to service_role;
