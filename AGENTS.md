# Thinkfy — agent contract

Read this before you touch anything. It is deliberately short; it routes you to the
real documents and lists the rules that must hold even if you read nothing else.

## The repo

npm workspaces (no Turbo). Two products on one codebase, both bilingual (EN/VI):
**Thinkfy Debate** (`/dashboard`, live practice, coach) and **Thinkfy IELTS** (`/ielts`,
mocks, study plan, scorers). IELTS is admin-gated pre-launch — see Gotchas.

- `apps/web` — the Next.js app (App Router, `[locale]` segment, Tailwind v4).
- `packages/shared` — design tokens, subject axis, cross-platform contracts.
- `services/` — out-of-band workers (LMS material pipeline, GCP grading).
- `scripts/` — CI checks, audits, migration and ops harnesses.
- `supabase/migrations` — schema. Production is a live Supabase project.

## Orchestration

Default working mode: **you are the orchestrator.** Plan, decide, reconcile, and verify
yourself; delegate bounded implementation and research to workers.

**Routing.** Orchestrator stays on the strong tier at high reasoning effort. Workers run on
the cheap tier. Codex worker definitions live in `.codex/agents/` — spawn them **by name**
(`implementer`, `scout`). Do not pass a cheap model in the spawn call's `model` field and do
not set `default_subagent_model`: Multi-Agent V2 rejects models tagged `v1`, and the spawn
falls back to the expensive tier silently. If workers report as Sol or Terra, the pin has
broken — stop and fix it before running a long fan-out. In Claude Code the equivalents are
`Explore` for research and `general-purpose` for bounded implementation.

**Delegate:** independent implementation slices, repetitive transformations across many
files, read-only search and research, test runs, first-pass review.
**Keep:** architecture, cross-cutting design, any decision where the right answer is
uncertain, reconciliation between workers, and final verification. A worker is never the last
thing that ran before you report done.

**Fan-out costs more total tokens, not fewer.** A multi-agent run consumes more tokens than
the same work in one thread; what it buys is parallelism and cheap-tier routing. Treat every
spawn as a purchase:

- Do not spawn for work you would finish in two or three tool calls.
- One worker per genuinely independent slice. If two slices touch the same files, do it
  yourself — assume workers share your working tree, so give them disjoint paths.
- Cap concurrency around four unless the work is embarrassingly parallel.
- Brief each worker self-contained — goal, files, constraints, what to return. They cannot
  see your context, and a vague brief costs a full re-run.
- Demand summaries, diffs, and `file:line`. Never accept raw file dumps or full test logs.
- Do not read a large file you are about to hand off, and do not re-read what a worker
  already reported. Read the excerpt, delegate the rest.

## Read before you write

| Doing this | Read first |
|---|---|
| Any UI work | `design.md` |
| Marketing, landing, public pages | `design-marketing.md` |
| Matching a reference — screenshot, site, competitor app | `design-reference-adoption.md`, **before writing code** |
| Charts, dashboards, analytics | `design.md` §Chart System |
| Animation, transitions | `design.md` §Motion System |
| Schema changes | Gotchas below, then `supabase/migrations` for precedent |

**Design posture — settled, see design.md §Posture.** Product style is the *calm SaaS canvas*:
cool neutral field, near-black ink, one saturated accent, Inter throughout, hierarchy from
contrast and spacing rather than color or ornament. Reference family: arcade.software.

Product surfaces are warm in *behavior*, restrained in *appearance* — celebration is earned at
the moment it lands, not ambient. Public marketing surfaces drop the warmth entirely for
editorial restraint. Never mix the two registers on one surface.

Every product surface is one of two densities (design.md §Surface Modes): **workbench**
(calendar, gradebook, review queue, question bank, mock player, admin — data-first, rows over
cards, no celebration) or **momentum** (home, results, study plan, onboarding, completion —
one dominant action, room around it, warmth lands here). Say which one you are building.

**Palette values are mid-migration** — the style is settled but the tokens are not. See
`docs/design-system-followups.md` before changing any color value.

## Non-negotiables

These hold everywhere in `apps/web/src` and `packages/shared/src`. Most are CI-enforced;
all of them are review-blocking.

1. **No raw color.** No `#hex`, no `rgba()`, no `bg-blue-500`. Use the semantic roles from
   `packages/shared/src/design-system/tokens.ts` (`primary`, `on-surface`, `outline-variant`,
   `surface-container-low`, `reward`, `chart-1..7`, …).
2. **No ad-hoc type.** No `text-[14px]`, `tracking-[…]`, `leading-[…]`, `font-[…]`, or
   hardcoded `font-family`. Use the `type-*` utilities or the primitives in
   `components/ui/typography.tsx`.
3. **No `/opacity` on a theme token.** `text-on-surface/70` bakes the light-mode literal and
   breaks dark mode. Use a solid token, or `opacity-*` on the element.
4. **A token that does not exist gets added, not inlined.** New values go in
   `tokens.ts` **and** `globals.css` — see the dual-source gotcha below.
5. **No native `<select>`, `<input type="date">`, or unstyled input in product UI.** Use
   `select.tsx`, `dropdown-menu.tsx`, `popover.tsx`. Browser-drawn controls are the loudest
   unfinished signal in an interface.
6. **Icons only from `@/components/ui/icons`.** Never import `lucide-react` or
   `@phosphor-icons/react` directly; `components/ui/product-icon.tsx` is the only exception.
7. **Charts only from `@/components/charts`.** One engine (vendored bklit/Visx). Do not add
   a charting library.
8. **Both themes, both locales.** Light and dark, English and Vietnamese, before you call
   anything done. Vietnamese strings run longer than English — check that buttons, nav rows, and chips still fit.
9. **No horizontal document overflow.** `document.documentElement.scrollWidth <= clientWidth`
   at 1280×720, 1440×900, 768×1024, 390×844. Overflow scrolls inside a panel, never the page.
10. **One dominant CTA per surface.** `variant="primary"` for it (`default` is a legacy alias), `outline` for secondary,
   `ghost` for utilities, `destructive` only for destruction, `reward` only for XP/streaks.
11. **Use `PageContainer`** (`components/shared/product-layout.tsx`) for product pages —
    `focused` / `standard` / `wide` / `data`. No ad-hoc `max-w-[1400px]`.

## Gates

Run before claiming any UI work is done. Do not report success on red.

```bash
npm run audit:design-system && npm run test:design-system && npm run lint && npm run typecheck -w @thinkfy/web
```

Touched scoring, IELTS, LMS, or payments? Run that area's suite too (`npm run test:ielts-*`,
`test:lms-*`, `test:payments`, …; `npm test` runs everything and is slow).

## Gotchas

Each of these cost real debugging time. They are not theoretical.

**Tokens are dual-source.** Color roles render from *both* `tokens.ts` (emitted as inline
critical CSS by `ThinkfyThemeVariables`, wins for `var()`) and the `@theme inline` block in
`globals.css` (used for Tailwind's literal fallbacks). Change a value in one and the two
diverge silently. Edit both.

**Migrations run in one transaction.** Enable RLS and finish DDL *before* any backfill DML in
the same file — a deferred constraint trigger makes a later `ALTER TABLE` fail with
PostgreSQL 55006 (pending trigger events). Likewise you cannot add an enum value and use it
in the same transaction; split it into two migrations.

**`npm run db:types` has no token here.** Regenerate types through the Supabase MCP and
splice the result into `apps/web/src/types/supabase.ts` rather than running the CLI.

**Supabase MCP:** use the project-scoped `supabase-debatelab` server, not an account-level
cloud one.

**Deploying is manual.** Production is thinkfy.net via `npx vercel --prod`. Pushing to `main`
does **not** deploy. Never assume a merge shipped.

**IELTS is admin-gated.** Access is flag-OR-admin via `apps/web/src/lib/ielts/access.ts`, so
deploying IELTS work does not make it public. Do not "fix" the gate.

**`tsx` + `server-only` imports** need `--conditions=react-server` (see the existing scripts
in `package.json` for the pattern).

## Conventions

- **One worktree per unit of work.** Parallel agents in one checkout collide on git HEAD.
  Verify your branch before every commit, and stage by explicit path — never `git add -A`.
- **One writer per card.** If a card is assigned to another session, do not edit its files.
- Conventional commits (`feat(web):`, `fix(ielts):`, `docs:`). Branch, don't commit to `main`.
- Never commit secrets. `.env.local` stays local.

## Never

- Add a Vercel serverless function — see `docs/no-new-vercel-functions.md`.
- Add a second icon library, chart library, or animation library.
- Introduce a parallel theme, token system, or `components.json` design preset.
- Weaken RLS, or query with the service-role key without an explicit ownership check.
- Reproduce copyrighted exam content. IELTS material is originally authored; Cambridge books
  are a difficulty *reference*, never a source.
