-- Point revamped popup campaigns at scenario-specific mascot artwork.
-- The renderer falls back to an on-brand mascot scene if an asset is missing,
-- so this is safe to apply before the new WebP files are deployed.

update public.smart_popup_campaigns
set image_path = '/images/smart-popups/feature-announcement.webp',
    updated_at = now()
where key = 'popup-revamp-feature-announcement';

update public.smart_popup_campaigns
set image_path = '/images/smart-popups/reminder-bell.webp',
    updated_at = now()
where key = 'reminder-email-opt-in';

update public.smart_popup_campaigns
set image_path = '/images/smart-popups/feedback-survey.webp',
    updated_at = now()
where campaign_type = 'feedback_survey';
