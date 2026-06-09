-- Data-only refresh for the Duolingo-style popup revamp.
-- Popup campaigns remain developer-defined; admin surfaces preview and monitor only.

update public.smart_popup_campaigns
set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'popupKind', 'practice_suggestion',
      'uiPattern', 'duolingo_simple_modal_v2'
    ),
    updated_at = now()
where key in (
  'first-practice',
  'resume-streak',
  'weakest-skill'
);

update public.smart_popup_campaigns
set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'popupKind', 'feature_announcement',
      'uiPattern', 'duolingo_simple_modal_v2'
    ),
    updated_at = now()
where key in (
  'try-courses',
  'ask-coach'
);

update public.smart_popup_campaigns
set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'popupKind', 'feedback_survey',
      'uiPattern', 'duolingo_simple_modal_v2'
    ),
    updated_at = now()
where campaign_type = 'feedback_survey';

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
values
  (
    'popup-revamp-feature-announcement',
    'dashboard',
    'active',
    'feature_nudge',
    'targeted',
    35,
    168,
    1,
    1,
    1,
    0,
    null,
    '/practice',
    '/images/smart-popups/popup-placeholder-v1.png',
    $json$
    {
      "eyebrow": "New in Thinkfy",
      "title": "Cleaner practice nudges are here.",
      "body": "We simplified in-app tips so each one gives you one useful next step.",
      "ctaLabel": "Try a practice round",
      "dismissLabel": "Later",
      "dontShowLabel": "Don't show again",
      "alt": "Blue Thinkfy star mascot holding a notification bell and cue card"
    }
    $json$::jsonb,
    $json$
    {
      "eyebrow": "Mới trong Thinkfy",
      "title": "Popup gợi ý đã gọn hơn.",
      "body": "Mỗi gợi ý giờ chỉ tập trung vào một bước hữu ích tiếp theo.",
      "ctaLabel": "Thử một vòng luyện tập",
      "dismissLabel": "Để sau",
      "dontShowLabel": "Đừng hiện lại",
      "alt": "Linh vật ngôi sao xanh của Thinkfy cầm chuông thông báo và thẻ gợi ý"
    }
    $json$::jsonb,
    $json$
    {
      "segments": ["active_user"],
      "minSessions": 1
    }
    $json$::jsonb,
    $json$
    {
      "popupKind": "feature_announcement",
      "uiPattern": "duolingo_simple_modal_v2",
      "notificationPattern": "duolingo_compact_v2",
      "durationMinutes": 10,
      "facts": {
        "en": [
          { "icon": "target", "label": "Focus", "value": "One step" },
          { "icon": "clock", "label": "Practice", "value": "{durationMinutes} min" }
        ],
        "vi": [
          { "icon": "target", "label": "Trọng tâm", "value": "Một bước" },
          { "icon": "clock", "label": "Luyện tập", "value": "{durationMinutes} phút" }
        ]
      }
    }
    $json$::jsonb
  ),
  (
    'reminder-email-opt-in',
    'dashboard',
    'active',
    'feature_nudge',
    'targeted',
    25,
    336,
    1,
    1,
    1,
    0,
    null,
    '/settings#notifications',
    '/images/smart-popups/popup-placeholder-v1.png',
    $json$
    {
      "eyebrow": "Stay on track",
      "title": "Want gentle practice reminders?",
      "body": "We can send only practice and streak reminder emails. Product updates stay off unless you enable them in Settings.",
      "ctaLabel": "Enable reminder emails",
      "dismissLabel": "Not now",
      "dontShowLabel": "Don't show again",
      "alt": "Blue Thinkfy star mascot holding a notification bell and cue card"
    }
    $json$::jsonb,
    $json$
    {
      "eyebrow": "Giữ nhịp luyện",
      "title": "Bạn muốn nhận nhắc luyện tập nhẹ nhàng?",
      "body": "Thinkfy chỉ bật email nhắc luyện tập và streak. Cập nhật sản phẩm vẫn tắt trừ khi bạn bật trong Cài đặt.",
      "ctaLabel": "Bật email nhắc luyện",
      "dismissLabel": "Không phải bây giờ",
      "dontShowLabel": "Đừng hiện lại",
      "alt": "Linh vật ngôi sao xanh của Thinkfy cầm chuông thông báo và thẻ gợi ý"
    }
    $json$::jsonb,
    $json$
    {
      "segments": ["active_user", "returning_user"],
      "minSessions": 1,
      "requiresReminderEmailOptIn": true
    }
    $json$::jsonb,
    $json$
    {
      "popupKind": "reminder_opt_in",
      "uiPattern": "duolingo_simple_modal_v2",
      "notificationPattern": "duolingo_compact_v2",
      "facts": {
        "en": [
          { "icon": "flame", "label": "Streak", "value": "Reminder only" },
          { "icon": "clock", "label": "Cadence", "value": "Gentle" }
        ],
        "vi": [
          { "icon": "flame", "label": "Streak", "value": "Chỉ nhắc nhở" },
          { "icon": "clock", "label": "Tần suất", "value": "Nhẹ nhàng" }
        ]
      }
    }
    $json$::jsonb
  )
on conflict (key) do update
set surface = excluded.surface,
    status = excluded.status,
    campaign_type = excluded.campaign_type,
    delivery_mode = excluded.delivery_mode,
    priority = excluded.priority,
    cooldown_hours = excluded.cooldown_hours,
    max_impressions_per_user = excluded.max_impressions_per_user,
    daily_cap_per_user = excluded.daily_cap_per_user,
    weekly_cap_per_user = excluded.weekly_cap_per_user,
    reward_credits = excluded.reward_credits,
    response_goal = excluded.response_goal,
    cta_href = excluded.cta_href,
    image_path = excluded.image_path,
    copy_en = excluded.copy_en,
    copy_vi = excluded.copy_vi,
    rules = excluded.rules,
    metadata = coalesce(public.smart_popup_campaigns.metadata, '{}'::jsonb) || excluded.metadata,
    updated_at = now();
