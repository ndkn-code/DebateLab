-- Align the app-experience feedback survey with Thinkfy branding and compact CTA reward copy.

update public.smart_popup_campaigns
set copy_en = coalesce(copy_en, '{}'::jsonb) || $json$
  {
    "eyebrow": "Quick feedback",
    "title": "How is Thinkfy feeling?",
    "body": "Three quick answers help us improve your next practice.",
    "ctaLabel": "Submit",
    "dismissLabel": "Later",
    "dontShowLabel": "Don't ask again",
    "alt": "Compact Thinkfy feedback prompt"
  }
  $json$::jsonb,
    copy_vi = coalesce(copy_vi, '{}'::jsonb) || $json$
  {
    "eyebrow": "Góp ý nhanh",
    "title": "Bạn thấy Thinkfy thế nào?",
    "body": "Ba câu trả lời nhanh giúp tụi mình cải thiện lần luyện tiếp theo.",
    "ctaLabel": "Gửi",
    "dismissLabel": "Để sau",
    "dontShowLabel": "Đừng hỏi lại",
    "alt": "Hộp góp ý ngắn của Thinkfy"
  }
  $json$::jsonb,
    metadata = (coalesce(metadata, '{}'::jsonb) - 'facts') || $json$
  {
    "notificationPattern": "duolingo_compact_v1",
    "factStrategy": "cta_reward",
    "durationMinutes": null
  }
  $json$::jsonb,
    updated_at = now()
where key = 'app-experience-feedback';

update public.smart_popup_survey_versions
set questions = $json$
  [
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
  ]
  $json$::jsonb,
    thank_you_copy = $json$
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
  $json$::jsonb,
    published_at = now()
where campaign_key = 'app-experience-feedback'
  and version = 1;
