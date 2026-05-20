# Smart Popup Notification Pattern

## Selected Reference
The approved direction is the compact Duolingo-style popup: blurred app backdrop, white rounded modal, small celebration cluster, short direct copy, two practical facts, one tactile blue CTA, quiet secondary actions.

This is the default architecture for DebateLab smart popups moving forward. Use it for feature nudges, feedback surveys, reward confirmations, and lightweight product notifications.

## Anatomy
1. Blurred/dimmed app backdrop.
2. Compact modal frame: `560px` to `620px` desktop, `92vw` mobile, `24px` to `28px` radius.
3. Reachable circular close button in the top-right corner.
4. Small celebration cluster: check, star, target, chart, gift, clock, book, chat, or flame icons.
5. Plain blue eyebrow text.
6. Action-first title, one line when possible.
7. One-sentence body copy.
8. One or two fact chips.
9. Full-width tactile blue CTA.
10. Quiet secondary action and quiet suppression link.

## Do
- Use code-native icon clusters instead of heavy generated art for v1.
- Write titles as the next action: `Drill rebuttal for 10 minutes.`
- Use metadata facts instead of explanatory paragraphs: `Weakest skill`, `63/100`, `10 min`, `+50 Credits`.
- Keep `Don't show again` visually quieter than `Later`.
- Keep surveys short and reward-forward.
- Localize all copy and check Vietnamese strings in Browser.
- Store final Browser QA screenshots in `design-artifacts/smart-popups/browser-qa/`.

## Don't
- Do not use a large square hero image in the modal header.
- Do not use pill eyebrows such as `Coach tip` unless the pill is essential to a non-popup surface.
- Do not write long body copy or multi-paragraph explanations.
- Do not stack nested cards inside the modal.
- Do not let the primary CTA scroll below the fold on feature nudges.
- Do not introduce new generated art directions without imagegen exploration using the selected reference image.

## Copy Formulas
Feature nudge:
- Eyebrow: `Next best step`
- Title: `Drill {skillFocus} for {durationMinutes} minutes.`
- Body: `Fastest improvement from your recent rounds.`
- Facts: `{weakestSkill}`, `{lastScore}/100`
- CTA: `Start {skillFocus} drill`

Feedback survey:
- Eyebrow: `Quick feedback`
- Title: `How is DebateLab feeling?`
- Body: `Three quick answers help us improve your next practice.`
- Facts: `+{rewardCredits} Credits`, `{durationMinutes} min`
- CTA: `Share feedback`

Thank-you:
- Eyebrow: `Feedback received`
- Title: `Thanks for the feedback.`
- Body: `Your reward has been added to your balance.`
- Fact: `+{rewardCredits} Credits`
- CTA: `Done`

## Supported Fact Icons
Use only these fact icon keys for campaign metadata:
- `target`
- `chart`
- `clock`
- `gift`
- `book`
- `chat`
- `flame`

## Imagegen Prompt Template
Use this before introducing a future visual direction that needs artwork:

```text
Use case: ui-mockup. Asset type: DebateLab smart popup notification direction.
Primary request: compact Duolingo-style modal for a debate learning app, blue-led brand,
small celebration cluster, no large hero image, short action-first title, one sentence body,
two metadata fact chips, tactile blue CTA, quiet Later and Don't show again actions.
Reference: selected compact notification screenshot from design-artifacts/smart-popups.
Output: clean web UI mockup, not a marketing hero, not a mascot-heavy card.
```

If production art is later approved, export it as `.webp` under `public/images/smart-popups/` and preserve fixed responsive dimensions.

## QA Checklist
- Browser viewports: `390x844`, `768x1024`, `1280x720`, `1440x900`, `1728x1117`, `2560x1440`.
- States: weakest-skill English/Vietnamese, first-practice, resume-streak, course, ask-coach, feedback survey English/Vietnamese, thank-you reward state.
- DOM checks: no horizontal overflow, modal height inside viewport, CTA visible for feature nudges, close button reachable, fact chips do not overflow.
- Localization checks: Vietnamese title, body, facts, CTA, `Later`, and `Don't show again` fit without clipping.
- Interaction checks: close, Later, Don't show again, CTA route, survey required validation, survey submit, thank-you reward.
- Data checks: campaign copy and fact metadata exist in Supabase; no schema or RLS changes; impression, dismissal, click, and survey events still write.
