# Learner home: truthful next step

Surface: momentum. Scope: learner home only; shared navigation is excluded.

## Reference extraction before implementation

Accepted Lumist screenshots 22 (empty plan) and 26 (today's plan), inspected at
1494×981 CSS-pixel capture size, show one central setup action before a plan exists
and named, directly actionable task rows after setup. The result's main task panel
is roughly 780px wide, with a 240px supporting summary. Rows carry a task title and
small right-aligned metadata/chevron. The empty screen uses a single heading,
one explanatory sentence and one action; progress is not fabricated in this panel.
The application canvas has a 220px sidebar. Thinkfy keeps its own shared sidebar.
Screenshot 24 of Thinkfy at the same capture size shows three competing practice
starts and an imbalance claim despite no sessions. We remove that contradiction.

Additional research: [Babbel learner home](https://mobbin.com/screens/d29cda65-34e4-456d-967f-fac1cc16a541)
(Mobbin search, 2026-09-05) visibly gives a named lesson and one Start lesson
button, then explains that course progress appears after learning starts. Adopt
that separation of action from unmeasured progress. Do not adopt its imagery,
carousel or brand. Teachable's empty curriculum and Gusto's empty courses were
also inspected; their central empty-state patterns add less to this task.

## Native mapping and composition

- Keep PageContainer size=data, 16/24px padding and 16px gaps, one flexible main
  column and 312px support column at xl; stack at smaller breakpoints.
- Hero earns the first position: plain objective, one full explanatory sentence,
  duration and practice type. One primary Button linked to the existing practice
  destination. No score metric for a generic starter, no implied weakness.
- Existing Card surfaces/semantic roles: background canvas, surface content,
  on-surface ink, on-surface-variant supporting ink, outline-variant dividers,
  primary only for the main action. No new tokens.
- Use type-heading-lg for the action heading, type-body-sm for explanation,
  type-label/type-caption for metadata. Copy wraps instead of truncating meaning.
- Existing Button, Link and registered icons cover every control. Use
  rounded-control (12px) for controls; keep existing dashboard panel geometry.
- Welcome becomes a quiet dismissible line; preserve its persisted dismissal.
  Empty recent activity explains when entries appear without another primary CTA.
  Alternative destinations remain quiet links/rows.
- Unavailable sources show a localized explanation and outline Retry control.
  Refresh preserves the existing surface and usable source content. Unknown
  values do not render measured zero or empty-history claims.
- Keep valid goals, scores, authored titles, and course routes. No added setup
  wizard, social/referral prompt, mascot celebration, palette, or new library.

## Source adaptation and verification

Lumist code provenance and precise adapted behavior are recorded below after
source inspection. QA will use the production loader/components with explicitly
mocked local evidence because live authentication currently times out. Local QA
must not be represented as live production verification.

### Adapted source

Lumist local source commit `73875b1267cb3a6e36a82af2cd1469285a57e9e1`:
`features/ai-tutor/utils/today-plan-state.ts:66–132` selects a next action through
explicit task-availability conditions; `features/dashboard/components/cards/LearningLessonCard.tsx:466–495`
routes the primary action through the selected task; `features/ai-tutor/components/WeeklyTaskView.tsx:2216–2232`
selects empty explanation from context. This is an authorized partial behavioral
adaptation of the user's local app source, not vendored code or a new dependency.
Thinkfy uses its existing recommendation keys and routes, with source availability
as the extra prerequisite. The home composition keeps the one selected action
prominent and secondary task rows quiet. Deliberately changed: rejected reads stay
unavailable, unlike Lumist's today-tasks service catch path that returns zero tasks.
No branding, exam content, raw styling, social prompts or reward mechanics copied.

### Verification, 2026-09-05

Base: `origin/main` at `53e107cb`; isolated branch `codex/learner-home-trust`.
Ego task space **73**, local server **3073**, verified marker
`data-qa-tree="a535-learner-home-trust"` in the rendered document. The QA shell
uses a 220px placeholder for shared navigation; this task does not verify or
change the shared sidebar/protected shell.

- Actual loader tests: genuine empty; failed RPC and all fallback sources;
  independently rejected queries; error-with-data ignored; valid RPC fields
  preserved when siblings are malformed; partial session activity retained;
  retry recovery; explicit one-sided/equal/unknown track evidence; malformed rows.
- Actual component server rendering: EN and VI, empty and unavailable; exactly one
  primary action, localized welcome/history copy, correct retry/unknown states.
- Retry state tests: independently retained panels, partial → failed → recovered.
  Incoming failure remains visible even when last-known data is kept.
- Ego browser DOM matrix: **32/32** (EN/VI × light/dark × four sizes ×
  empty/unavailable). Sizes: 1280×720, 1440×900, 768×1024, 390×844. All had
  `scrollWidth <= clientWidth`, one prominent action, and the hero CTA fully in
  the first viewport. Unavailable had zero numeric progress bars. VI touched
  content and labels had no detected English UI terms from the regression list.
  The initial matrix assertion mistakenly rejected English labels in EN; the
  locale-specific assertion was corrected against the captured observations.
- Ego real Retry button: pending `aria-busy=true` retained the hero; failed retry
  retained known recommendation, activity, credits and lower-bound session count
  with `data-progress-freshness="last-known"` and a visible saved-data notice;
  successful retry removed the error and restored `20 / 20` minutes.
- Welcome: actual production component read/updated the synthetic profile through
  the local mock transport. Reload kept it dismissed; daily goal, locale and
  `fixture_marker` remained unchanged. A first harness attempt used a port
  excluded by the real CSP; the same-origin mock proxy corrected the harness
  without weakening CSP or modifying production persistence.

Evidence files (local, not production captures):
`qa-artifacts/learner-home/viewport-matrix.json` and
`qa-artifacts/learner-home/interaction-evidence.json`.

Final code checks passed after removing the temporary app routes:
`audit:design-system`, `test:design-system`, `lint` (12 existing warnings, zero
errors), and web `typecheck`. `test:dashboard` passed, including 15 new loader,
retention and rendered-composition tests; `test:skill-snapshot`,
`test:performance-summary`, and `test:student-read-model-rpcs` also passed.
The two local QA processes were stopped and Ego space 73 was closed. The final
header notification-size adjustment and alternative-title wrapping were covered
by the final code gates; the recorded browser matrix preceded these two edits.

**Limitations:** Ego `Page.captureScreenshot` repeatedly timed out (PNG/JPEG,
with/without viewport override, foreground/lifecycle activation). No final
screenshots were captured and no screenshot-based visual pass is claimed. Live
authentication and end-to-end practice/history destinations remain unverified;
all data scenarios above are explicitly mocked. The global toast provider's
English "Notifications alt+T" region is outside this home slice; the home header
uses the existing localized NotificationCenter. No shared navigation, auth,
scoring algorithms, profile persistence, production merge or deploy was changed.
