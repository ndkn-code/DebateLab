# Admin UI Showcase Browser QA

Date: 2026-06-09
Local target: `http://localhost:3001/en/dashboard/admin/ui-showcase`
Mode: `DEV_ADMIN_BYPASS=true`

## Coverage

- Desktop `1440x900`: landing, prep, speaking recording, AI rebuttal done, AI rebuttal error, duel result clash map.
- Mobile `390x844`: landing, prep, speaking recording, feedback transcript.
- Extra mobile scrolled captures: prep preview, prep controls, speaking preview, speaking controls, feedback transcript preview.

## Results

- Horizontal overflow: none detected on all checked desktop and mobile routes.
- Deep links: stable for `surface`, `state`, and `tab` query params.
- Admin nav: desktop sidebar shows `UI Showcase`; mobile admin top bar is visible.
- Console errors: none reported by Browser after the final pass.
- Supabase coverage panel: reads only `status` values from `practice_attempts`, `analysis_jobs`, and `debate_duels`; no private content is rendered.
- Reference match pass: desktop shell uses the generated reference structure with a white workspace, compact toolbar, active Prep scenario first, fixed-height scenario rail, preview title/actions, and direct real-component preview rendering.
- Browser screenshot capture timed out during the final pass, so Browser was used for viewport/console/overflow checks and the cached headless shell was used only to save the final pixel artifact.

## Screenshots

- `desktop-reference-match-final.png`
- `desktop-landing.png`
- `desktop-prep.png`
- `desktop-speaking.png`
- `desktop-ai-rebuttal-done.png`
- `desktop-ai-rebuttal-error.png`
- `desktop-duel-result-clash.png`
- `mobile-landing.png`
- `mobile-prep.png`
- `mobile-speaking.png`
- `mobile-feedback-transcript.png`
- `mobile-prep-preview.png`
- `mobile-prep-controls.png`
- `mobile-speaking-preview.png`
- `mobile-speaking-controls.png`
- `mobile-feedback-transcript-preview.png`
