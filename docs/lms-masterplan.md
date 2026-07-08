# Thinkfy LMS — feature-parity + polish masterplan

## TL;DR
Thinkfy's LMS **scaffolding is built and freshly polished** — the teacher *dashboards* (users,
courses, modules, classes, clubs, attendance, analytics) and content authoring (IELTS
questions/tests/lessons/explanations) are at parity-or-better with Lumist's LEARNING + CONTENT
sections, on the IELTS polish bar. BUT two things are missing:
1. **The homework loop itself is NOT wired** — assign → student-submit → grade → feedback, with file
   upload. Verified 2026-07: `createClubAssignment` (admin-clubs.ts:732) and `saveCoachReview` (:948)
   have **zero callers**; there's no student-submit UI, no file upload, no grading UI. This is the **#1
   gap** and the thing the co-founder needs to actually run a class (the "port Lumist's homework UX" piece).
2. The **Growth & Support** commercial layer (mostly deferrable — see Wave 3).

So "match Lumist" = **build the homework loop first**, then close ~8 Growth/content gaps, natively on the
spine (Club OS + courses + IELTS content model + billing + design system). Do **not** fork Lumist (§1).

Audience: a PM (Claude) session driving Codex. Each workstream below is scoped to ~one Codex session.

## 1. Why native (not a wholesale fork) — but DO port pieces
(Founder is a Lumist **co-founder**, so IP access is fine — forking is *allowed*; it's just the wrong *architecture*.)
1. Wrong domain — Lumist is SAT-shaped (Verbal/Math, DigitSAT); IELTS/debate data models don't map.
2. A wholesale fork fragments the one unified app (debate + IELTS sharing users/auth/billing/subject-axis/design) into two diverging codebases.
3. We already own the hard part — the spine. The gap is a handful of admin surfaces + the homework loop, not the model.
4. A fork ships Lumist's design; re-theming the whole thing ≈ building native.

**But DO surgically port proven, domain-agnostic interaction pieces** — chiefly the **student test-taking UX**: passage highlighting, answer elimination, flag + question-navigator, pre-test guide, review-before-submit, passage/MCQ split layout. Re-express them on our `MockTestPlayer`/`QuestionHost` + design tokens, plugging into our native IELTS data/scoring. Never port: data models, SAT scoring, Prisma, `[slug]` routing, RLS-off tables, world-readable buckets. This "mock-flow finish" is a distinct **IELTS-experience** workstream (student side) — tracked with the IELTS polish roadmap, separate from this LMS teacher-ops doc.

## 2. Current state vs the Lumist admin sidebar (audit)
| Lumist feature | Status | Evidence |
|---|---|---|
| Analytics | HAVE | `/dashboard/admin/overview` (OverviewDashboard), ai-quality, prediction-quality, user analytics — ChartKit-polished |
| Users | HAVE | `/dashboard/admin/users` (UserAccessDashboard) — roles/plans/entitlements/grants |
| Courses | HAVE | `/dashboard/admin/courses` (CRUD, publish gating, CreateCourseWizard, CourseEditor) |
| Classes | HAVE | `/dashboard/admin/classes/[id]` (ClassDetailDashboard, 1365 ln): overview/students/courses/schedule/attendance |
| Clubs (Club OS) | HAVE | `/dashboard/admin/clubs/[id]` (ClubDetailDashboard, 1588 ln): assignments, skill analytics, roster, schedule |
| Modules | HAVE | `course_modules` + ModuleItem (nested in CourseEditor; no top-nav) |
| **Homework loop** (assign→submit→grade→feedback) | **GAP** | `createClubAssignment`/`saveCoachReview` exist with **zero callers**; no student-submit UI, no file upload, no grading UI. Dashboards display around it but the transaction isn't wired. (IELTS-mock assignment IS wired via `assignIeltsMockToClass`.) |
| Questions | HAVE (IELTS) | `admin/ielts` QuestionForm/QuestionPanel/ImportPanel; `ielts_questions`+`_keys`. No unified cross-subject bank |
| Tests/mocks | HAVE (IELTS) | `admin/ielts/[testId]` (IeltsTestEditor + Listening/Passage + VersionHistory + band-conversions) |
| Lessons | HAVE | LessonBuilder (markdown + video/YouTube), `lesson` activity type |
| Explanations | HAVE (embedded) | `ielts_question_keys.explanation_en/_vi` + model_answer/examiner_notes; edited inline in QuestionForm |
| Emails | PARTIAL | `/dashboard/admin/emails` (templates + deliverability monitor + Resend webhook). NO campaigns/broadcast/audiences |
| Question Reports | PARTIAL (UI-only gap) | `support_issue_reports` table w/ triage statuses + admin RLS + queue index + Tally ingest. **No admin triage UI** |
| Affiliates/referrals | PARTIAL | referral data + user flows (`/join/[code]`, credits). NO admin surface; NO affiliate/payout model |
| Store/catalog | PARTIAL | billing rails (subscriptions, payment_transactions, Stripe/ZaloPay/RevenueCat). Plans are hardcoded enums; NO catalog table/UI |
| Vocabulary | PARTIAL (data-model gap) | per-activity FlashcardBuilder only; NO reusable vocab/word-bank table |
| Maintenance mode | GAP | no settings/flag table or middleware gate (they've been hand-toggling maintenance middleware) |
| Resource Library | GAP | corpus studio is a debate RAG corpus, not a student resource/file library |
| Discount codes | GAP | no promo/coupon table or checkout hook |

## 3. Gap classification
- **UI-only** (data model already exists → fast): Question Reports triage, Referrals admin view, standalone Explanations review surface.
- **Data-model** (needs migration): Maintenance mode, Vocabulary bank, Resource Library, Discount codes, Store/catalog, Affiliate program.
- **Mixed**: Email campaigns (small campaign/audience model + UI over the existing template/Resend layer).

## 4. Workstreams (sequenced)

### Wave 0 — Homework loop (THE teacher-ops gap; build FIRST)
The dashboards are polished, but the assign→submit→grade→feedback transaction is NOT wired.
- **WS-L0 · Homework loop.** Small schema delta (per the 2026-06-23 audit): file-config cols on
  `club_assignments`, grade-lifecycle cols on `club_assignment_submissions`, a new
  `assignment_submission_files` table + a **private** RLS'd bucket. Wire the existing
  `createClubAssignment`/`saveCoachReview` into three UIs: (a) teacher **assign** flow from
  ClassDetailDashboard/ClubDetailDashboard; (b) student **submit** surface (text + file upload);
  (c) coach **grade/feedback** UI (grade + rubric + comments → returned to the student). Reference
  Lumist's submission/grading UX, re-expressed in our stack. Do NOT inherit Prisma, `[slug]` routing,
  SAT coupling, or world-readable buckets. This is the co-founder's blocker to running classes.

### Admin layouts — reference, don't port
Match Lumist's admin *look* (KPI donuts, filter-chip browsers, sortable student tables) but **build native** on our ChartKit + design system. Admin dashboards/tables are cheap native, we already have most (ClassDetailDashboard, IeltsTestEditor, CourseEditor), and Lumist's admin code is SAT/Prisma-coupled — porting drags coupling in for UI we'd re-theme anyway. Code-porting is reserved for the student test-taking *interaction engines* (highlighting etc.), NOT admin layouts. Confirmed-existing (polish to match, don't build): class overview (add avg-score + on-time KPI donuts to the existing dashboard), tests, course structure.

### Wave 1 — Ops & quick wins (do now: cheap, high-value)
- **WS-L1.5 · Question Bank browser** (UI-mostly, over existing `ielts_questions`). The one genuine admin *build* Lumist's Questions view surfaces: a standalone, browsable, filterable bank — search + type/difficulty/tag/subject filters + card list + "in bank" toggle + view-detail (per-test authoring exists; a cross-cutting bank does not). Doubles as content-ops for curating the bank you're producing. Reference Lumist's layout; build native.
- **WS-L1 · Question Reports triage UI** (UI-only). Build `/dashboard/admin/reports` over `support_issue_reports` (statuses new/triaged/in_progress/resolved/closed already exist w/ admin RLS + `(status, submitted_at desc)` index). List + detail + status dropdown + assignee/notes. Add to AdminSidebar under "Growth & Support". No migration.
- **WS-L2 · Referrals admin view** (UI-only). Read-only dashboard over `profiles.referral_code`/`referred_by` + the referral-credit ledger: who referred whom, credits granted, top referrers. No migration.
- **WS-L3 · Maintenance mode** (data-model). A `app_settings`/feature-flag row + middleware gate + an admin toggle (scope: whole app or per-subject). Replaces the manual maintenance-middleware toggling that's been happening during risky deploys.

### Wave 2 — Content & engagement (align with the content push)
- **WS-L4 · Vocabulary bank** (data-model). A reusable `vocab_items`/word-bank table (term, definition, example, IELTS band/topic tags, EN/VI) + admin CRUD + wire FlashcardBuilder/`ielts_vocab_collocation` to pull from it instead of per-activity duplication.
- **WS-L5 · Resource Library** (data-model). A student-facing `resources` table (file/link, title, subject/tag, access_level) + admin upload/curate + a student library surface. Reuse Supabase storage + access gating.
- **WS-L6 · Email campaigns** (mixed). A `email_campaigns`/audience-segment model on top of the existing template + Resend layer; admin compose → segment → schedule/send → results. Reuse EmailTemplateEditor.

### Wave 3 — Monetization (DEFER until Thinkfy actually charges)
Premature for a free, pre-launch, admin-gated product. Build when the paid flip is on the roadmap.
- **WS-L7 · Store / product catalog** — a `products`/`plans` catalog table + admin store UI; billing rails already exist.
- **WS-L8 · Discount codes** — `discount_codes` table + checkout integration + admin CRUD + redemption tracking.
- **WS-L9 · Affiliate program** — partner/payout model extending referrals + admin tracking/payout UI.

## 5. Cross-cutting (every workstream)
- **Polish bar**: design-system tokens + ChartKit + the motion kit (AnimatedNumber/Shimmer/SuccessCheck) — match the IELTS/Club OS surfaces. Mind the opacity-token dark-mode gotcha; verify light + dark + mobile.
- **Gates**: all 8 (typecheck:web/shared, lint:web 0 errors, audit:design-system, ci:checks, npm test, coverage:critical, selftest) + a real-browser before/after.
- **Nav**: register each surface in `components/admin/AdminSidebar.tsx` under the matching section.
- **Access**: admin-gated + RLS; new tables get RLS from day one (run get_advisors after DDL).
- **Worktree-per-card**; serialize any that touch shared design tokens/palette (avoid the coral-vs-P3 collision).

## 6. Sequencing rationale
Teacher-ops (the expensive LMS core) is done, so the smart order is: **Wave 1** (2 are UI-only, 1 small — real ops value now) → **Wave 2** (supports the content you're producing) → **Wave 3** (only when monetizing). Do NOT let the commercial layer displace the #1 user-ready gap, which is **content** (Academic mocks, General Training, a real drill bank) — see `docs/ielts-masterplan.md` and the content plan.

## 7. Card template (PM expands each WS)
```
<WS-id> · <feature>. Branch off origin/main in a worktree. Native on Thinkfy's spine; Lumist = reference.
DATA: <new table + RLS, or "UI-only over <table>">.
BUILD: <route under dashboard/admin/**, components, actions/API>; register in AdminSidebar.
POLISH: design-system + ChartKit + motion kit; light+dark+mobile.
VERIFY: 8 gates + audit:design-system + real-browser before/after screenshots.
```
