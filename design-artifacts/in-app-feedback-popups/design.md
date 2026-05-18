# In-App Feedback Popups

## Goal
Create a first-party feedback/intercept system for DebateLab that collects immediate user sentiment while preserving the student’s practice flow.

## Reference Notes
- Lumist’s feedback dialog uses a focused modal, clear rating controls, optional text feedback, and a lightweight reward moment.
- Lumist stores templates separately from responses and enforces one-time reward idempotency for the `lumi_favor` prompt.
- DebateLab should keep the same product-grade directness but use its calmer blue-led design system.
- Final QA should include Image Capture or Browser screenshots for the student popup, thank-you state, and admin builder.

## Color Profile
- Primary: `#4D86F7`
- Primary Dark: `#3E78EC`
- Primary Light: `#A9C6FB`
- Background: `#F7FAFE`
- Surface: `#FFFFFF`
- Surface Alt: `#F1F6FD`
- Border: `#DEE8F8`
- Heading: `#0B1424`
- Text: `#415069`
- Muted: `#718096`
- Success: `#34C759`
- Warning: `#F5B942`
- Error: `#EF6A6A`

## Components
- Student popup: modal with eyebrow, localized title/body, short question stack, submit button, Later, and Don’t ask again.
- Thank-you state: centered reward confirmation with `+50 Credits`.
- Admin campaigns: table-like list with status, delivery mode, responses, rating, and actions.
- Admin builder: bilingual copy fields, ordered question editor, bilingual preview, and publish/save controls.
- Admin analytics: response count, rating distribution, recent responses, and cron health.

## Delivery Rules
- “Send now” means next safe page opportunity, not an interrupt inside a live session.
- Suppressed routes: auth, onboarding, admin, and live practice session pages.
- Surveys respect popup preferences, daily/weekly caps, and one submission per campaign by default.

## Screenshot Checklist
- Student popup, desktop.
- Student popup, mobile.
- Thank-you reward state.
- Admin campaign list.
- Admin builder with English/Vietnamese preview.
- Responses and Cron/Health tabs.

## Captures
- Browser QA admin campaigns: `design-artifacts/in-app-feedback-popups/admin-campaigns-browser-qa.png`
- Browser QA admin builder: `design-artifacts/in-app-feedback-popups/admin-builder-browser-qa.png`
- Computer Use reference capture: Chrome session state was captured while reviewing the local/reference browser surface.

## QA Notes
- Browser verified the admin page loads through the protected admin route with the new Feedback Popups nav item.
- Browser verified Campaigns, Builder, Responses, Analytics, and Cron/Health tabs are reachable with no console errors.
- Browser verified the builder renders bilingual English/Vietnamese copy previews and the fixed `50 Credits` reward messaging.
- Live student popup submission was not exercised in Browser because local dev auth credentials are not configured in `.env.local`; API/unit coverage verifies survey validation, eligibility, and reward idempotency.
