# Thinkfy IELTS — Exam-Mode revamp plan (make the mock feel like real CD-IELTS)

## TL;DR
The co-founder's verdict: the mock **"does not look like test-taking at all."** He's right — but not
because the interaction widgets are missing. B1/B2/B3 already landed **on main** (highlighting, answer
elimination, flag + question-navigator, review-before-submit, pre-test guide). What's missing is the
**gestalt**: the mock still renders **inside the dashboard shell** (sidebar visible, `max-w-5xl`), there's
**no note-taking**, highlighting is **passage-only** (not questions/answers), **Listening is freely
scrubbable** (no one-time audio gate), and **Writing Task 1 has no figure**. Fix = a **fullscreen exam
shell** + the four content gaps, with the **shell, motion, and interaction UX forked heavily from Lumist**
(`/Users/jacknguyen/Developer/app-lumist-ai`) and re-skinned to IELTS.

**Prereq (do first):** confirm prod actually has B1/B2/B3. `origin/main` = `80e9ad2e` (B3); prod promotion
is manual (pushing main ≠ deploy). If prod is behind, the co-founder may be reacting to *pre-widget* state
too. Promote main to prod, then re-judge.

## Verified current state (on `origin/main`, 2026-07-11)
| Area | State on main | File(s) |
|---|---|---|
| **Shell** | Renders in `ProtectedShell` + **Sidebar**, `max-w-5xl`. NOT fullscreen. | `ielts/mock/[slug]/page.tsx`; `protected-shell.tsx` (fullscreen `isPracticeSession` branch at :234 is the pattern to extend) |
| Highlighting | EXISTS (char-offset, selection-driven), **passage body only**, keyed `part.id`; persists localStorage per attempt | `PassageHighlighter.tsx`; `lib/stores/mockAnnotationsStore.ts` |
| Answer elimination | EXISTS (cross-out on MCQ), same store | `questions/ChoiceTile.tsx` |
| Note-taking | **MISSING** — store models `Highlight` only, no note text, no notes panel | — |
| Navigator / flag | EXISTS (palette) | `QuestionNavigator.tsx` |
| Review-before-submit | EXISTS (bottom-sheet/dialog) | `SectionReviewSheet.tsx`, `mock-flow-status.ts` |
| Pre-test guide | EXISTS (intro + reopenable dialog) | `MockPreTestGuide.tsx` |
| Timer | Per-**section**, buried in section header (not a global exam clock) | `SectionTimer.tsx`, `MockSectionView.tsx` |
| **Listening** | Bare `<audio controls>` — pause/seek/replay all allowed. **No gate.** | `ListeningAudioPlayer.tsx` |
| **Writing** | Bare `<textarea>`; renderer **ignores `question.visual`**; Task 1 has no figure | `questions/WritingTaskRenderer.tsx` |
| Registry gotcha | `adaptObjectiveRenderer` **drops `context`** → objective renderers can't see `attemptId` (B1 worked around via a questionId-keyed store) | `question-renderer-registry.tsx:82` |
| Visual types | **Two divergent `IeltsVisual`** — `lib/api/ielts/visual.ts` (`type`: image/table/chart/described) vs `lib/ielts/question-types/types.ts` (`kind`: image/table only). `chart`/`described` have **no render path** → silently vanish | both files |

## The design fork you own (blocking the skin of every card)
"Fork Lumist and make it look like IELTS" is ambiguous. Two readable intents:
- **A — Literal CD-IELTS**: mimic the real computer-delivered exam (the YouPass screenshots) — institutional
  gray/blue, boxed panels, numbered part strip, austere. Max test-day familiarity; off-brand vs Thinkfy.
- **B — Thinkfy-premium exam**: the CD-IELTS *structure* (fullscreen, top/bottom bars, split pane, highlight/
  note, part strip, one-time audio) skinned in our design system (coral/teal, Nunito, motion kit, rounded) —
  "as serious as IELTS, but clearly ours / Brilliant-grade." On-brand; slightly less identical to test day.
- **C — Both, via a mode toggle**: Thinkfy skin for practice + a switchable literal-CD-IELTS "exam simulation"
  skin. Best fidelity + brand; ~2× skin work.
**Recommendation: B** (structure of A, skin of ours) — matches the "delightful but grown-up" bar; a literal
"exam simulation" skin can be a later add. **Awaiting founder's call — it sets the POLISH section of E1/E6.**

## The revamp — sliced into cards
Foundational card first (E1); the rest sit inside it. Lumist fork targets are per-card. Every card: native on
our spine, Lumist = reference for shell/motion/interaction only (never its data layer / Prisma / SAT scoring).

### E1 · Fullscreen Exam Shell  ⟵ do first, everything nests inside
**Goal:** the mock takes over the viewport (no sidebar); a persistent **top bar** (test + section label,
**global timer**, tool cluster: highlight/note toggle, help "?", theme; pause where allowed) and **bottom
bar** (part/question-navigator trigger, prev/next, review/submit). Reorganizes the per-section header into
one exam chrome; moves the existing `QuestionNavigator` into the footer trigger.
- **Reuse OURS:** the `isPracticeSession` fullscreen branch (`protected-shell.tsx:234`) / `courses/[courseId]/
  activity/layout.tsx` ("full-screen, no sidebar") — add a `mock/` fullscreen layout or extend the shell gate.
- **Fork Lumist:** `ExamHeader.tsx` / `ExamFooter.tsx` (top/bottom chrome JSX), `components/ui/button.tsx`
  **CTA 3D press** (scope to exam — do NOT reskin the global shared Button), `dialog.tsx`/`sheet.tsx` Radix motion.
- **Closes:** "left menu should disappear"; "doesn't look like a test."
- **Touches:** `MockTestPlayer.tsx`, `MockSectionView.tsx`, mock route layout, `protected-shell.tsx`. **Hot files
  — this is the serialization anchor.** Includes the chosen visual skin (A/B/C).

### E2 · Exam motion & transitions (fold into E1 or fast-follow)
**Goal:** the polish Lumist *lacks* — smooth **question→question** and **section→section** transitions
(framer-motion `AnimatePresence`), a **"section complete"** interstitial, modal/panel slide-ins.
- **Reuse OURS:** the analytics **motion kit** (`AnimatedNumber`/`Shimmer`/`SuccessCheck`) already on main.
- **Fork Lumist:** the `animate-in fade-in zoom-in-95` popup pattern, `ExamEndedNotification` `animate-ping`
  completion pulse, `PauseResumeControl` blur veil.
- **Note:** Lumist hard-swaps questions/sections — these transitions are **net-new**, not a port.

### E3 · Note-taking + highlight on questions/answers
**Goal:** select text → floating popup with **Highlight + Note**; "Note" opens a side-panel editor (title +
textarea + delete, per the YouPass note panel). Extend highlight/note to the **questions & answers**, not just
the passage (co-founder: "note, highlight questions/answers").
- **Fork Lumist:** `VocabularyContextMenu.tsx` — the **floating selection popup** skeleton (portal +
  position-under-selection + `animate-in`); replace the vocab API with a note store. `HighlightControl.tsx`
  swatches optional.
- **Reuse OURS:** extend `mockAnnotationsStore` with `notes` alongside `highlights` (same per-attempt
  localStorage payload). For question/answer highlighting, key by `questionId` (mirror B1's questionId-keyed
  workaround for the `adaptObjectiveRenderer` context drop).
- **Touches:** `MockSectionView.tsx`, `PassageHighlighter.tsx`, `mockAnnotationsStore.ts`, question renderers.
  **Collides with E1** → sequence **after E1**.

### E4 · Listening exam-fidelity (one-time audio gate)
**Goal:** per listening part, a **"You'll hear this once — no pause or replay. Click Play to begin."** gate
(the YouPass splash). On Play: **chromeless** audio (no scrub/pause/replay), questions answerable during
playback, part locks/auto-advances on `ended`. Remove Pause/Resume for Listening. Fix the intro copy that
currently promises "you can pause."
- **Fork Lumist:** the **pause blur-veil** scaffolding + Timer **auto-submit** pattern (there's no audio in
  Lumist — the *gate/lock* UX is what's reusable).
- **Reuse OURS:** `ListeningAudioPlayer.tsx` (swap `controls` for a controlled element; block `seeking`).
- **Touches:** `ListeningAudioPlayer.tsx`, `MockSectionView.tsx`. Serialize with E3 (both touch MockSectionView).
- **Fidelity note:** real IELTS plays all 4 sections as one continuous clip; we're per-section (WS-1.3). Gate
  each section for now; continuous-play is a later fidelity nicety.

### E5 · Writing Task 1 visual (chart / figure)  ⟵ can run parallel to E1 (isolated files)
**Goal:** render `question.visual` in the Writing renderer (Task 1) beside the essay box (split panel).
Support **image** (+ hotspots, already modeled), **table**, and **chart** — and fix the two divergent
`IeltsVisual` types so `chart`/`described` stop silently vanishing.
- **Reuse OURS (big win):** render `chart` visuals with our own **ChartKit** (bklit/Visx) — no fork needed; we
  already own the charting engine. Fork Lumist's **split-panel** layout (stimulus left / entry right).
- **Data:** audit whether published `academic-mock-01..04` Task 1 questions have `visual` populated; author/
  backfill any missing (content-track follow-up — the RENDER support is this card).
- **Touches:** `WritingTaskRenderer.tsx`, the two `IeltsVisual` type files. **Serialize with content authoring**
  (shared visual types).

### E6 · CD-IELTS finish pass (visual-direction-dependent) — last
**Goal:** the literal finish once structure lands — numbered **part strip** at the bottom (per screenshot),
boxed question panels, note/highlight color, header icon set, empty/loading/skeleton states, light+dark+mobile.
Scope set by the A/B/C decision. Optional if E1 already lands at the chosen skin.

## Sequencing & serialization
```
Prereq: promote main→prod, sync this checkout, confirm B1/B2/B3 live.
E1 (shell) ───────────────► lands first (hot files: MockTestPlayer/MockSectionView/shell)
   ├─ E3 (note) ──► after E1        (MockSectionView)   ─┐ serialize E3→E4
   ├─ E4 (listening) ──► after E1   (MockSectionView)   ─┘
   └─ E2 (motion) ──► fold into E1 or fast-follow
E5 (writing visual) ──► parallel to E1 (isolated) but serialize w/ content authoring
E6 (finish) ──► last, after E1/E3/E4
```
**Single-writer rule:** the memory's hard lesson — *parallel IELTS visual work collides* (coral-vs-P3). The
mock player gets **one writer at a time**. This exam-mode track is the **IELTS-experience workstream** (student
side), driven by **this session**; the LMS PM session stays on **admin ops** (Question Reports / Referrals /
Question Bank) which don't touch the player. Do not let both sessions edit `MockSectionView`/`MockTestPlayer`
concurrently.

## Cross-cutting (every card)
- **Design-system safety:** scope the forked 3D button press + exam motion to the exam chrome — do **not**
  reskin the global shared `Button` (it changes the whole app). Mind the opacity-token dark-mode gotcha; verify
  light + dark + mobile. Tokens are dual-source (`tokens.ts` + `globals.css @theme`).
- **Gates:** all 8 (typecheck:web/shared, lint:web scoped-clean, audit:design-system, ci:checks, npm test,
  coverage:critical, selftest) + real-browser before/after (desktop + mobile + dark).
- **Worktree per card**; land as clean FF to origin/main.
- **Lumist = reference only** (read-only repo): fork shell/motion/interaction; never its data layer, Prisma,
  SAT scoring, `[slug]` routing, or world-readable buckets.

## Lumist fork map (from recon — the concrete "what to copy")
- **Fullscreen takeover:** `app/assessment/attempt/[attemptId]/page.tsx` + `globals.css` `exam-no-scroll` (but
  prefer OUR existing fullscreen pattern).
- **Shell:** `ExamHeader.tsx`, `ExamFooter.tsx`, `ExamInterface.tsx` (skeleton/state-machine as blueprint only).
- **Motion:** `components/ui/button.tsx` (3D press), `dialog.tsx`/`sheet.tsx` (Radix), the `animate-in` popup.
- **Highlight/note:** `HighlightableMarkdownRenderer.tsx` (`HighlightEngine`), `VocabularyContextMenu.tsx`
  (popup skeleton for the note feature — note itself is net-new).
- **Navigator/MCQ/review:** `QuestionNavigation.tsx`, `MultipleChoiceQuestion.tsx` (cross-out),
  `SectionReviewScreen.tsx` (+ mascot/chip pattern).
- **Writing:** `WrittenResponsePanel.tsx` (textarea + upload) + the split-panel branch in `ExamContent.tsx`.
- **Leave behind:** `ExamInterface` data layer, hooks (`useExamData`/`useTimerData`/`useTestMonitoring`),
  calculators, `recap/result/review` scoring, proctoring, `app/mock-test/*` + `ExamScreen.tsx` (red herrings).
```
```
