-- Data-only refresh for Duolingo-style compact smart popup notifications.
-- No schema, RLS, or grant changes.

update public.smart_popup_campaigns
set copy_en = $json$
  {
    "eyebrow": "Start strong",
    "title": "Start with a 10-minute speaking drill.",
    "body": "One short round unlocks real feedback.",
    "ctaLabel": "Start practice",
    "dismissLabel": "Later",
    "dontShowLabel": "Don't show again",
    "alt": "Compact DebateLab first practice notification"
  }
  $json$::jsonb,
    copy_vi = $json$
  {
    "eyebrow": "Bắt đầu nhẹ nhàng",
    "title": "Bắt đầu với một bài nói 10 phút.",
    "body": "Một lượt ngắn sẽ mở khóa phản hồi thật.",
    "ctaLabel": "Bắt đầu luyện tập",
    "dismissLabel": "Để sau",
    "dontShowLabel": "Đừng hiện lại",
    "alt": "Thông báo luyện tập đầu tiên của DebateLab"
  }
  $json$::jsonb,
    metadata = coalesce(metadata, '{}'::jsonb) || $json$
  {
    "notificationPattern": "duolingo_compact_v1",
    "factStrategy": "duration_feedback",
    "durationMinutes": 10,
    "facts": {
      "en": [
        { "icon": "clock", "label": "Time", "value": "{durationMinutes} min" },
        { "icon": "chart", "label": "Unlocks", "value": "Feedback" }
      ],
      "vi": [
        { "icon": "clock", "label": "Thời gian", "value": "{durationMinutes} phút" },
        { "icon": "chart", "label": "Mở khóa", "value": "Phản hồi" }
      ]
    }
  }
  $json$::jsonb,
    updated_at = now()
where key = 'first-practice';

update public.smart_popup_campaigns
set copy_en = $json$
  {
    "eyebrow": "Keep the streak",
    "title": "Keep your rhythm with one quick round.",
    "body": "Ten focused minutes keeps the habit alive.",
    "ctaLabel": "Resume practice",
    "dismissLabel": "Later",
    "dontShowLabel": "Don't show again",
    "alt": "Compact DebateLab streak notification"
  }
  $json$::jsonb,
    copy_vi = $json$
  {
    "eyebrow": "Giữ nhịp học",
    "title": "Giữ nhịp với một vòng ngắn.",
    "body": "Mười phút tập trung giúp thói quen không bị đứt quãng.",
    "ctaLabel": "Tiếp tục luyện tập",
    "dismissLabel": "Để sau",
    "dontShowLabel": "Đừng hiện lại",
    "alt": "Thông báo giữ chuỗi luyện tập của DebateLab"
  }
  $json$::jsonb,
    metadata = coalesce(metadata, '{}'::jsonb) || $json$
  {
    "notificationPattern": "duolingo_compact_v1",
    "factStrategy": "streak_duration",
    "durationMinutes": 10,
    "facts": {
      "en": [
        { "icon": "flame", "label": "Streak", "value": "Keep it alive" },
        { "icon": "clock", "label": "Time", "value": "{durationMinutes} min" }
      ],
      "vi": [
        { "icon": "flame", "label": "Chuỗi ngày", "value": "Giữ nhịp" },
        { "icon": "clock", "label": "Thời gian", "value": "{durationMinutes} phút" }
      ]
    }
  }
  $json$::jsonb,
    updated_at = now()
where key = 'resume-streak';

update public.smart_popup_campaigns
set copy_en = $json$
  {
    "eyebrow": "Next best step",
    "title": "Drill {skillFocus} for 10 minutes.",
    "body": "Fastest improvement from your recent rounds.",
    "ctaLabel": "Start {skillFocus} drill",
    "dismissLabel": "Later",
    "dontShowLabel": "Don't show again",
    "alt": "Compact DebateLab skill recommendation"
  }
  $json$::jsonb,
    copy_vi = $json$
  {
    "eyebrow": "Bước tiếp theo",
    "title": "Luyện {skillFocus} trong 10 phút.",
    "body": "Đây là điểm cải thiện nhanh nhất từ các vòng gần đây.",
    "ctaLabel": "Bắt đầu luyện {skillFocus}",
    "dismissLabel": "Để sau",
    "dontShowLabel": "Đừng hiện lại",
    "alt": "Thông báo đề xuất kỹ năng của DebateLab"
  }
  $json$::jsonb,
    metadata = coalesce(metadata, '{}'::jsonb) || $json$
  {
    "notificationPattern": "duolingo_compact_v1",
    "factStrategy": "weakest_skill_score",
    "durationMinutes": 10,
    "facts": {
      "en": [
        { "icon": "target", "label": "Weakest skill", "value": "{skillFocus}" },
        { "icon": "chart", "label": "Last score", "value": "{lastScore}/100" }
      ],
      "vi": [
        { "icon": "target", "label": "Kỹ năng yếu nhất", "value": "{skillFocus}" },
        { "icon": "chart", "label": "Điểm gần nhất", "value": "{lastScore}/100" }
      ]
    }
  }
  $json$::jsonb,
    updated_at = now()
where key = 'weakest-skill';

update public.smart_popup_campaigns
set copy_en = $json$
  {
    "eyebrow": "Guided step",
    "title": "Turn feedback into a guided lesson.",
    "body": "One course step gives your next round a clearer plan.",
    "ctaLabel": "Open courses",
    "dismissLabel": "Later",
    "dontShowLabel": "Don't show again",
    "alt": "Compact DebateLab course notification"
  }
  $json$::jsonb,
    copy_vi = $json$
  {
    "eyebrow": "Bước có hướng dẫn",
    "title": "Biến phản hồi thành một bài học.",
    "body": "Một bước trong khóa học giúp vòng tiếp theo rõ ràng hơn.",
    "ctaLabel": "Mở khóa học",
    "dismissLabel": "Để sau",
    "dontShowLabel": "Đừng hiện lại",
    "alt": "Thông báo khóa học của DebateLab"
  }
  $json$::jsonb,
    metadata = coalesce(metadata, '{}'::jsonb) || $json$
  {
    "notificationPattern": "duolingo_compact_v1",
    "factStrategy": "course_duration",
    "durationMinutes": 12,
    "facts": {
      "en": [
        { "icon": "book", "label": "Course", "value": "Guided lesson" },
        { "icon": "clock", "label": "Time", "value": "{durationMinutes} min" }
      ],
      "vi": [
        { "icon": "book", "label": "Khóa học", "value": "Bài có hướng dẫn" },
        { "icon": "clock", "label": "Thời gian", "value": "{durationMinutes} phút" }
      ]
    }
  }
  $json$::jsonb,
    updated_at = now()
where key = 'try-courses';

update public.smart_popup_campaigns
set copy_en = $json$
  {
    "eyebrow": "Coach help",
    "title": "Ask AI Coach before your next round.",
    "body": "Turn a messy idea into a sharper argument.",
    "ctaLabel": "Ask AI Coach",
    "dismissLabel": "Later",
    "dontShowLabel": "Don't show again",
    "alt": "Compact DebateLab AI Coach notification"
  }
  $json$::jsonb,
    copy_vi = $json$
  {
    "eyebrow": "Trợ giúp từ AI Coach",
    "title": "Hỏi AI Coach trước vòng tiếp theo.",
    "body": "Biến ý tưởng rối thành một luận điểm sắc hơn.",
    "ctaLabel": "Hỏi AI Coach",
    "dismissLabel": "Để sau",
    "dontShowLabel": "Đừng hiện lại",
    "alt": "Thông báo AI Coach của DebateLab"
  }
  $json$::jsonb,
    metadata = coalesce(metadata, '{}'::jsonb) || $json$
  {
    "notificationPattern": "duolingo_compact_v1",
    "factStrategy": "coach_quick_help",
    "durationMinutes": 2,
    "facts": {
      "en": [
        { "icon": "chat", "label": "AI Coach", "value": "Quick help" },
        { "icon": "clock", "label": "Time", "value": "{durationMinutes} min" }
      ],
      "vi": [
        { "icon": "chat", "label": "AI Coach", "value": "Gợi ý nhanh" },
        { "icon": "clock", "label": "Thời gian", "value": "{durationMinutes} phút" }
      ]
    }
  }
  $json$::jsonb,
    updated_at = now()
where key = 'ask-coach';

update public.smart_popup_campaigns
set copy_en = $json$
  {
    "eyebrow": "Quick feedback",
    "title": "How is DebateLab feeling?",
    "body": "Three quick answers help us improve your next practice.",
    "ctaLabel": "Share feedback",
    "dismissLabel": "Later",
    "dontShowLabel": "Don't ask again",
    "alt": "Compact DebateLab feedback prompt"
  }
  $json$::jsonb,
    copy_vi = $json$
  {
    "eyebrow": "Góp ý nhanh",
    "title": "Bạn thấy DebateLab thế nào?",
    "body": "Ba câu trả lời nhanh giúp tụi mình cải thiện lần luyện tiếp theo.",
    "ctaLabel": "Gửi góp ý",
    "dismissLabel": "Để sau",
    "dontShowLabel": "Đừng hỏi lại",
    "alt": "Hộp góp ý ngắn của DebateLab"
  }
  $json$::jsonb,
    metadata = coalesce(metadata, '{}'::jsonb) || $json$
  {
    "notificationPattern": "duolingo_compact_v1",
    "factStrategy": "reward_time",
    "durationMinutes": 2,
    "facts": {
      "en": [
        { "icon": "gift", "label": "Reward", "value": "+{rewardCredits} Credits" },
        { "icon": "clock", "label": "Time", "value": "{durationMinutes} min" }
      ],
      "vi": [
        { "icon": "gift", "label": "Phần thưởng", "value": "+{rewardCredits} Credits" },
        { "icon": "clock", "label": "Thời gian", "value": "{durationMinutes} phút" }
      ]
    }
  }
  $json$::jsonb,
    updated_at = now()
where key = 'app-experience-feedback';

update public.smart_popup_survey_versions
set thank_you_copy = $json$
  {
    "en": {
      "title": "Thanks for the feedback.",
      "body": "Your reward has been added to your balance."
    },
    "vi": {
      "title": "Cảm ơn bạn đã góp ý.",
      "body": "Phần thưởng đã được cộng vào tài khoản của bạn."
    }
  }
  $json$::jsonb
where campaign_key = 'app-experience-feedback'
  and version = 1;
