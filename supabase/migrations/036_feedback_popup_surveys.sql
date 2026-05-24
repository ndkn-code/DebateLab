-- Feedback popup surveys, admin publishing metadata, and idempotent rewards.

alter table public.smart_popup_campaigns
  add column if not exists campaign_type text not null default 'feature_nudge',
  add column if not exists delivery_mode text not null default 'targeted',
  add column if not exists reward_credits integer not null default 0,
  add column if not exists response_goal integer,
  add column if not exists published_at timestamptz,
  add column if not exists published_by uuid references public.profiles(id) on delete set null,
  add column if not exists created_by uuid references public.profiles(id) on delete set null,
  add column if not exists updated_by uuid references public.profiles(id) on delete set null;

alter table public.smart_popup_campaigns
  drop constraint if exists smart_popup_campaigns_campaign_type_check;

alter table public.smart_popup_campaigns
  add constraint smart_popup_campaigns_campaign_type_check
  check (campaign_type in ('feature_nudge', 'feedback_survey'));

alter table public.smart_popup_campaigns
  drop constraint if exists smart_popup_campaigns_delivery_mode_check;

alter table public.smart_popup_campaigns
  add constraint smart_popup_campaigns_delivery_mode_check
  check (delivery_mode in ('targeted', 'send_now', 'scheduled'));

alter table public.smart_popup_campaigns
  drop constraint if exists smart_popup_campaigns_reward_credits_check;

alter table public.smart_popup_campaigns
  add constraint smart_popup_campaigns_reward_credits_check
  check (reward_credits >= 0 and reward_credits <= 1000);

alter table public.smart_popup_campaigns
  drop constraint if exists smart_popup_campaigns_response_goal_check;

alter table public.smart_popup_campaigns
  add constraint smart_popup_campaigns_response_goal_check
  check (response_goal is null or response_goal > 0);

alter table public.smart_popup_events
  drop constraint if exists smart_popup_events_event_type_check;

alter table public.smart_popup_events
  add constraint smart_popup_events_event_type_check
  check (
    event_type in (
      'impression',
      'dismissed',
      'cta_clicked',
      'dont_show_again',
      'survey_started',
      'survey_submitted',
      'survey_abandoned'
    )
  );

create table if not exists public.smart_popup_survey_versions (
  id uuid primary key default gen_random_uuid(),
  campaign_key text not null references public.smart_popup_campaigns(key) on delete cascade,
  version integer not null default 1 check (version > 0),
  questions jsonb not null default '[]'::jsonb,
  thank_you_copy jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  unique (campaign_key, version)
);

create table if not exists public.smart_popup_survey_responses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  campaign_key text not null references public.smart_popup_campaigns(key) on delete cascade,
  survey_version_id uuid not null references public.smart_popup_survey_versions(id) on delete restrict,
  impression_event_id uuid references public.smart_popup_events(id) on delete set null,
  submission_key text not null unique,
  locale text not null default 'en' check (locale in ('en', 'vi')),
  answers jsonb not null default '[]'::jsonb,
  context jsonb not null default '{}'::jsonb,
  reward_credits_awarded integer not null default 0 check (reward_credits_awarded >= 0),
  rewarded_at timestamptz,
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_smart_popup_campaigns_feedback
  on public.smart_popup_campaigns(campaign_type, delivery_mode, status, priority);

create index if not exists idx_smart_popup_survey_versions_campaign
  on public.smart_popup_survey_versions(campaign_key, version desc);

create index if not exists idx_smart_popup_survey_responses_campaign_time
  on public.smart_popup_survey_responses(campaign_key, submitted_at desc);

create index if not exists idx_smart_popup_survey_responses_user_time
  on public.smart_popup_survey_responses(user_id, submitted_at desc);

create unique index if not exists idx_smart_popup_survey_responses_impression
  on public.smart_popup_survey_responses(impression_event_id)
  where impression_event_id is not null;

alter table public.smart_popup_survey_versions enable row level security;
alter table public.smart_popup_survey_responses enable row level security;

drop policy if exists "Authenticated users can view popup survey versions" on public.smart_popup_survey_versions;
create policy "Authenticated users can view popup survey versions"
  on public.smart_popup_survey_versions for select
  using (
    auth.uid() is not null
    and exists (
      select 1
      from public.smart_popup_campaigns c
      where c.key = smart_popup_survey_versions.campaign_key
        and c.status = 'active'
        and c.campaign_type = 'feedback_survey'
        and (c.starts_at is null or c.starts_at <= now())
        and (c.ends_at is null or c.ends_at > now())
    )
  );

drop policy if exists "Admins can manage popup survey versions" on public.smart_popup_survey_versions;
create policy "Admins can manage popup survey versions"
  on public.smart_popup_survey_versions for all
  using (private.is_admin(auth.uid()))
  with check (private.is_admin(auth.uid()));

drop policy if exists "Admins can view popup survey responses" on public.smart_popup_survey_responses;
create policy "Admins can view popup survey responses"
  on public.smart_popup_survey_responses for select
  using (private.is_admin(auth.uid()));

drop policy if exists "Admins can manage popup survey responses" on public.smart_popup_survey_responses;
create policy "Admins can manage popup survey responses"
  on public.smart_popup_survey_responses for all
  using (private.is_admin(auth.uid()))
  with check (private.is_admin(auth.uid()));

grant select on public.smart_popup_survey_versions to authenticated;
grant select on public.smart_popup_survey_responses to authenticated;
grant all on public.smart_popup_campaigns to service_role;
grant all on public.smart_popup_events to service_role;
grant all on public.smart_popup_survey_versions to service_role;
grant all on public.smart_popup_survey_responses to service_role;

alter table public.orb_transactions
  drop constraint if exists orb_transactions_type_check;

alter table public.orb_transactions
  add constraint orb_transactions_type_check
  check (
    type in (
      'signup_bonus',
      'referral_reward',
      'referral_bonus',
      'practice_quick',
      'practice_full',
      'practice_speaking',
      'practice_debate',
      'admin_grant',
      'feedback_reward'
    )
  );

create unique index if not exists idx_orb_transactions_feedback_reward_reference
  on public.orb_transactions(reference_id)
  where type = 'feedback_reward' and reference_id is not null;

create or replace function public.grant_feedback_popup_reward(
  p_user_id uuid,
  p_response_id uuid,
  p_amount integer default 50
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_new_balance integer;
  v_rewarded_at timestamptz;
begin
  if p_amount <> 50 then
    raise exception 'INVALID_FEEDBACK_REWARD_AMOUNT';
  end if;

  select rewarded_at
  into v_rewarded_at
  from public.smart_popup_survey_responses
  where id = p_response_id
    and user_id = p_user_id
  for update;

  if not found then
    raise exception 'FEEDBACK_RESPONSE_NOT_FOUND';
  end if;

  if v_rewarded_at is not null then
    select orb_balance
    into v_new_balance
    from public.profiles
    where id = p_user_id;

    return coalesce(v_new_balance, 0);
  end if;

  update public.profiles
  set orb_balance = orb_balance + p_amount
  where id = p_user_id
  returning orb_balance into v_new_balance;

  if not found then
    raise exception 'USER_NOT_FOUND';
  end if;

  insert into public.orb_transactions (
    user_id,
    amount,
    type,
    reference_id,
    balance_after
  )
  values (
    p_user_id,
    p_amount,
    'feedback_reward',
    p_response_id,
    v_new_balance
  );

  update public.smart_popup_survey_responses
  set reward_credits_awarded = p_amount,
      rewarded_at = now()
  where id = p_response_id;

  return v_new_balance;
end;
$$;

revoke execute on function public.grant_feedback_popup_reward(uuid, uuid, integer) from public;
revoke execute on function public.grant_feedback_popup_reward(uuid, uuid, integer) from anon;
revoke execute on function public.grant_feedback_popup_reward(uuid, uuid, integer) from authenticated;
grant execute on function public.grant_feedback_popup_reward(uuid, uuid, integer) to service_role;

insert into public.smart_popup_campaigns (
  key,
  surface,
  status,
  campaign_type,
  delivery_mode,
  priority,
  cooldown_hours,
  max_impressions_per_user,
  daily_cap_per_user,
  weekly_cap_per_user,
  reward_credits,
  response_goal,
  cta_href,
  image_path,
  copy_en,
  copy_vi,
  rules,
  metadata
)
values (
  'app-experience-feedback',
  'global',
  'paused',
  'feedback_survey',
  'targeted',
  5,
  168,
  1,
  1,
  1,
  50,
  100,
  '/dashboard',
  '/images/smart-popups/ask-coach.webp',
  '{
    "eyebrow": "Quick feedback",
    "title": "How is Thinkfy feeling so far?",
    "body": "Answer a few quick questions so we can improve the app for your next practice.",
    "ctaLabel": "Submit",
    "dismissLabel": "Later",
    "dontShowLabel": "Don''t ask again",
    "alt": "Thinkfy feedback prompt"
  }'::jsonb,
  '{
    "eyebrow": "Góp ý nhanh",
    "title": "Bạn thấy Thinkfy thế nào?",
    "body": "Trả lời vài câu ngắn để tụi mình cải thiện trải nghiệm luyện tập tiếp theo.",
    "ctaLabel": "Gửi",
    "dismissLabel": "Để sau",
    "dontShowLabel": "Đừng hỏi lại",
    "alt": "Hộp góp ý Thinkfy"
  }'::jsonb,
  '{"segments":["active_user"],"minSessions":1,"maxSubmissionsPerUser":1}'::jsonb,
  '{"adminLabel":"Overall app experience pulse","source":"seed"}'::jsonb
)
on conflict (key) do update
set campaign_type = excluded.campaign_type,
    delivery_mode = excluded.delivery_mode,
    reward_credits = excluded.reward_credits,
    response_goal = excluded.response_goal,
    metadata = public.smart_popup_campaigns.metadata || excluded.metadata,
    updated_at = now();

insert into public.smart_popup_survey_versions (
  campaign_key,
  version,
  questions,
  thank_you_copy,
  published_at
)
values (
  'app-experience-feedback',
  1,
  '[
    {
      "id": "overall_rating",
      "type": "rating",
      "required": true,
      "min": 1,
      "max": 5,
      "label": {
        "en": "Overall, how useful is Thinkfy for your practice?",
        "vi": "Nhìn chung, Thinkfy hữu ích thế nào cho việc luyện tập của bạn?"
      },
      "minLabel": {
        "en": "Not useful",
        "vi": "Chưa hữu ích"
      },
      "maxLabel": {
        "en": "Very useful",
        "vi": "Rất hữu ích"
      }
    },
    {
      "id": "feature_focus",
      "type": "single_choice",
      "required": true,
      "label": {
        "en": "Which part should we improve first?",
        "vi": "Tụi mình nên cải thiện phần nào trước?"
      },
      "options": [
        { "id": "practice", "label": { "en": "Practice flow", "vi": "Luồng luyện tập" } },
        { "id": "feedback", "label": { "en": "AI feedback", "vi": "Feedback AI" } },
        { "id": "voice", "label": { "en": "Speech and voice", "vi": "Giọng nói và nhận diện" } },
        { "id": "navigation", "label": { "en": "Navigation", "vi": "Điều hướng" } }
      ]
    },
    {
      "id": "open_feedback",
      "type": "text",
      "required": false,
      "label": {
        "en": "What would make Thinkfy better for you?",
        "vi": "Điều gì sẽ làm Thinkfy tốt hơn cho bạn?"
      },
      "placeholder": {
        "en": "Share anything confusing, helpful, missing, or exciting.",
        "vi": "Chia sẻ điều gì khó hiểu, hữu ích, còn thiếu, hoặc làm bạn thích."
      }
    }
  ]'::jsonb,
  '{
    "en": {
      "title": "Thanks for the feedback",
      "body": "You earned 50 Credits. We will use this to make Thinkfy sharper."
    },
    "vi": {
      "title": "Cảm ơn bạn đã góp ý",
      "body": "Bạn đã nhận 50 Credits. Tụi mình sẽ dùng góp ý này để cải thiện Thinkfy."
    }
  }'::jsonb,
  now()
)
on conflict (campaign_key, version) do update
set questions = excluded.questions,
    thank_you_copy = excluded.thank_you_copy,
    published_at = excluded.published_at;
