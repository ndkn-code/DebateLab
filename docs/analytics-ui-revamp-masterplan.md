# Thinkfy Analytics + Unified UI System — Masterplan

> Status: **Phase 0 in progress** (this doc + token/motion/primitive foundation landed in the kickoff session).
> Owner: Jack. Execution model: **one git worktree per card**, parallel Claude/Codex sessions.
> Supabase: use the **local `supabase-debatelab`** MCP for all DB work. The account-level MCP is Lumist's `app-lumist-ai` — never cross them.

---

## 1. Why this exists

The data is rich and ready (`analytics_events` ~6.4k rows, `user_sessions`, `daily_stats`, `performance_attempts`, duel MMR, IELTS adaptive evidence, plus existing aggregation migrations). The problem is **presentation and consistency**:

- **Three un-unified chart layers.** Student surfaces use hand-rolled SVG (`MiniLineChart`, `MiniBarChart`, donut, score-rings, radar) with hardcoded hex. Admin uses `recharts@3`, also hardcoded (`#2f4fdd`, grays). No shared chart component, no chart tokens, no motion system.
- **Charts bypass the design system.** `design.md §Chart Colors` documents a 7-colour palette that was **never promoted to tokens**. The only reason raw hex survives is that ~20 analytics/dashboard/profile folders are **exempted** in `scripts/design-system-audit.ts`.
- **No analytics UX primitives.** Each surface re-implements fetching, empty/error/loading, KPI cards, date ranges.

**Goal:** a unified UI system — the component/chart/motion analog to the existing color + typography systems — and a from-scratch revamp of every analytics surface on top of it.

**Definition of done for the whole effort:** the analytics/dashboard/profile/feedback **allowlist exemptions in `design-system-audit.ts` are deleted** and CI is hard-fail green. Same discipline used for typography.

---

## 2. Locked decisions

| # | Decision | Choice |
|---|----------|--------|
| D1 | Chart engine | **Adopt bklit (`@bklitui/ui`, Visx-based, MIT) as the single engine.** Migrate the 3 `recharts` admin charts onto it; remove `recharts` at the end. |
| D2 | Rollout | **All surface clusters in parallel** once Phase 0 lands. |
| D3 | Distribution | Bring bklit in **wholesale** (shadcn registry `pnpm dlx shadcn@latest add @bklit/<chart>` into a vendored `components/charts/` namespace, then re-theme to Thinkfy tokens). Not hand-copied piecemeal. |
| D4 | Motion | Formalize **transitions.dev** patterns as a `framer-motion` variants library (`lib/motion` + `components/motion`). `@number-flow/react` (which bklit bundles) for animated numbers. |
| D5 | Reference | Copy Lumist-analytics patterns (KPI card w/ delta, date-range presets, query cache + retry, timezone-safe dates, stagger animation, dashboard shell). Skip its weaknesses (per-component query duplication, recharts boilerplate). |
| D6 | Guardrails | New code lives in **non-allowlisted namespaces** (`components/charts`, `components/data-viz`, `components/motion`, `lib/motion`) so it is token-clean *by construction*. |

---

## 3. The unified system (architecture)

```
TOKENS        color ✓  type ✓  radius ✓
              + chart palette  --color-chart-1..7 + grid/axis/tooltip/crosshair (light+dark)   [WS-A0 ✓]
              + bklit bridge   --chart-line-primary / --chart-grid / --chart-tooltip-* …        [WS-A0 ✓]
              + motion tokens  --motion-duration-* / --motion-ease-* + thinkfyMotion (TS)        [WS-A0 ✓]

PRIMITIVES    ui/ ✓ (base-ui + CVA)
              + charts/      ChartKit (vendored bklit, re-themed) + ChartCard                    [WS-A1]
              + motion/      PageTransition · Stagger · AnimatedNumber · Shimmer · Swap ·         [WS-A2 ✓]
                             SuccessCheck · Shake
              + data-viz/    StatCard · ChartCard · chart-states (Empty/Error/Skeleton) ·         [WS-A3 ✓ core]
                             SegmentedRange · DashboardSectionHeader

PATTERNS      DashboardShell · KPI grid · ChartCard · filter bar · empty/error/skeleton states

DATA          lib/analytics typed metrics layer + RPCs/materialized views (one way to fetch)     [WS-A4]

GUARDRAILS    design-audit → + chart-color guard + motion guard; DELETE analytics allowlist       [WS-C1]
```

Layer ownership: **tokens** in `packages/shared/src/design-system/tokens.ts` (+ mirrored in `apps/web/src/app/globals.css`). **Primitives** in `apps/web/src/components/{charts,data-viz,motion}` and `apps/web/src/lib/motion`. Living styleguide at `/dashboard/admin/ui-showcase`.

---

## 4. Phase 0 — Foundations (kickoff session)

### WS-A0 — Chart + motion tokens ✅ (landed in kickoff)
- `tokens.ts`: extend `ThinkfyColorRole` with `chart1..chart7`, `chartGrid`, `chartAxis`, `chartTooltipBg`, `chartTooltipText`, `chartCrosshair`; add light + dark values; emit `--color-chart-*` and the **bklit bridge** vars from `makeWebCssVariables`; add `thinkfyMotion` (durations/eases/springs).
- `globals.css`: add `--color-chart-*` to `@theme inline` (generates `fill-chart-1`/`text-chart-1`/… utilities), mirror dark values in `.dark`, add `--motion-*` CSS vars.
- Palette (from `design.md §Chart Colors`, blue-first): `1 #00B8D9 · 2 #8BE8F7 · 3 #34C759 · 4 #F5B942 · 5 #7B61FF · 6 #0788A0 · 7 #FF7A59`. **Semantic intent over index order:** green (`chart-3`) = positive, amber (`chart-4`) = caution, red-orange (`chart-7`) = negative.
- **Gotcha:** never use `/opacity` modifiers on chart tokens (bakes the light literal in dark mode — see `[[tailwind-opacity-tokens-break-dark-mode]]`). Use solid `--color-chart-*` + `opacity-*` utilities or `color-mix()`.
- Accept: `npm run audit:design-system` + `npm run test:design-system` green.

### WS-A1 — ChartKit (vendored bklit) — **first parallel card**
Engine: `@bklitui/ui` charts (Visx 4 + d3 + `motion` + `@number-flow/react`; already peer-deps `@base-ui/react` which we have).
1. `pnpm dlx shadcn@latest add @bklit/area-chart @bklit/bar-chart @bklit/line-chart @bklit/radar-chart @bklit/ring-chart @bklit/heatmap` (DebateLab already has `shadcn@^4.7` in devDeps; add the `@bklit` registry to `components.json`). Target dir: `apps/web/src/components/charts/`.
2. Add deps to `apps/web/package.json`: the `@visx/*` set, `d3-array d3-scale d3-shape d3-geo`, `topojson-client`, `motion`, `@number-flow/react`, `react-use-measure`. (Note `motion` ≈ `framer-motion`; keep both or migrate motion-kit imports to `motion/react`.)
3. **Re-theme:** point bklit's `--chart-*` vars at our bridge (already emitted by WS-A0) — `--chart-line-primary → var(--color-chart-1)`, `--chart-grid → var(--color-chart-grid)`, `--chart-tooltip-foreground → var(--color-chart-tooltip-text)`, etc. Delete any bklit-shipped raw hex; everything routes through tokens.
4. Wrap in a thin Thinkfy API: `<ChartCard title eyebrow actions>` shell + typed `<AreaChart>/<BarChart>/<LineChart>/<RadarChart>/<RingChart>/<Heatmap>` re-exports with our defaults baked (tooltip, grid, axis, enter animation from `thinkfyMotion`).
5. Render every chart type on `/dashboard/admin/ui-showcase` (light + dark).
- Accept: showcase renders all types in both themes; audit green (charts dir is non-allowlisted → must be token-only); `recharts` NOT used here.

### WS-A2 — Motion kit ✅ (landed in kickoff)
- `lib/motion/variants.ts`: token-driven `framer-motion` variants — `fadeInUp`, `staggerContainer`/`staggerItem`, `popIn`, `shimmer`, `swap`, `successCheck`, `shake`, `crossfade` (transitions.dev vocabulary).
- `components/motion/*`: `PageTransition`, `Stagger`/`StaggerItem`, `AnimatedNumber` (count-up; swap to `@number-flow/react` once WS-A1 adds it), `Shimmer`, `Swap`, `SuccessCheck`, `Shake`.
- `prefers-reduced-motion` respected.

### WS-A3 — Data-viz primitives ✅ (core landed in kickoff)
- `components/data-viz/`: `ChartCard`, `StatCard` (label/value/delta/benchmark/icon + `AnimatedNumber` + optional sparkline slot), `chart-states` (`ChartEmpty`/`ChartError`/`ChartSkeleton`), `SegmentedRange` (7d/30d/90d presets), `DashboardSectionHeader`.
- Follow-ups (own cards): `DashboardShell` (collapsible sidebar, Lumist pattern), `DateRangePicker` (custom range), `MetricGrid`.

### WS-A4 — Metrics/data layer
- `lib/analytics/metrics/`: typed query functions per metric, server-side aggregation, timezone-safe date utils (port Lumist `parseLocalDate`/`toDateString`), retry-on-timeout helper.
- DB: materialized views / RPCs for hot aggregations (extend `014_admin_user_analytics_pipeline.sql`, `20260608210429_profile_analytics_speedup.sql`). Apply via `supabase-debatelab` MCP `apply_migration`.
- Accept: each metric has one typed entry point + a `tsx` unit test (mirror `performance-summary.test.ts`).

**Phase-0 dependency order:** A0 → (A1, A3) ; A2 ∥ A4. A1 needs A0's bridge vars. B-cards need A1+A3.

---

## 5. Phase 1 — Surface migrations (all parallel)

Each card: rebuild the surface on ChartKit + data-viz + motion, delete its hand-SVG/recharts, then **remove that folder from the audit allowlist** and confirm green. Each is a standalone PR/worktree.

| Card | Surface | Files (today) | Notes |
|------|---------|---------------|-------|
| B1 | Student analytics page | `components/analytics/analytics-page.tsx` | Replace MiniLine/MiniBar/donut/rings/radar. Highest-debt file. |
| B2 | Dashboard home | `components/dashboard/{weekly-chart,skill-snapshot-card,streak-card,training-path}.tsx` | Weekly bars, skill radar, streak heatmap. |
| B3 | Profile analytics | `components/profile/{profile-analytics-tab,skill-radar-chart,social-profile-page}.tsx` | Radar + mix donut + trend. Drop the lone recharts radar. |
| B4 | Practice/duel results | `components/feedback/session-result-dashboard.tsx`, `components/practice/round-progress.tsx` | Score rings + timeline + `SuccessCheck` motion. |
| B5 | Admin overview / AI-quality / per-user | `components/admin/overview/{OverviewDashboard,TrendChart,ApiUsageChart}.tsx`, `components/admin/ai-quality/*`, `components/admin/users/UserAnalyticsDashboard.tsx` | **Kills `recharts`.** Migrate area/bar/radar to ChartKit. |
| B6 | B2B class/club | `components/admin/classes/*`, `components/admin/clubs/*` | StatCards + attendance/progress charts. |
| B7 | IELTS analytics | prediction-quality dashboard, predicted-band card, study-plan forecast | Calibration scatter, drift, forecast band. See `[[ielts-ws-6.3-prediction-quality-dashboard]]`. |

---

## 6. Phase 2 — Guardrails & cleanup (WS-C1)
- Extend `scripts/design-system-audit.ts`: **chart-color guard** (no raw hex in chart props; must use `--color-chart-*`/`chart-*` utilities) and a **motion guard** (durations/eases via tokens). 
- **Delete** the analytics/dashboard/profile/feedback fragments from `approvedPathFragments`; confirm hard-fail green.
- Remove `recharts` from `apps/web/package.json`.
- Document `design.md §Chart System` + `§Motion System`. Showcase page = canonical reference.

---

## 7. Parallel-session runbook
1. `git worktree add ../DebateLab-<card> -b <card>` (see `[[ielts-parallel-session-worktrees]]` — cards collide on shared HEAD otherwise).
2. Read this doc + the card row. Build only in the new namespaces or the card's target files.
3. DB via **`supabase-debatelab`** MCP only.
4. Before PR: `npm run audit:design-system && npm run test:design-system && npm run -w @thinkfy/web typecheck` + the card's `tsx` test.
5. A card "removes its allowlist exemption" only when its folder is fully token-clean.

## 8. Gotchas
- `preview_start` runs from the **main** checkout, not the worktree (`[[ielts-ws-5.1-learner-shell]]`).
- Worktrees lack `.env.local` — copy it in for dev render (`[[ielts-ws-6.2.2-study-plan-page]]`).
- `tsx` server-only modules need `--conditions=react-server`.
- `motion` (package) and `framer-motion` are the same engine; don't double-bundle — pick one import path repo-wide during WS-A1.
- Chart tokens: solid token + `opacity-*`, never `/opacity` (`[[tailwind-opacity-tokens-break-dark-mode]]`).

---

## 9. WS-A1 — DONE (kickoff session)

ChartKit vendored + re-themed; all 6 core charts render light+dark in the showcase; audit green; typecheck clean.

**How it was installed (reproduce for more chart types):**
- `components.json` → added `"registries": { "@bklit": "https://bklit.com/r/{name}.json" }`.
- `npx shadcn@latest add @bklit/area-chart @bklit/bar-chart @bklit/line-chart @bklit/radar-chart @bklit/ring-chart @bklit/heatmap-chart --cwd apps/web --yes` → ~80 files into `apps/web/src/components/charts/` + installed `@visx/*`, `d3-array`, `motion`, `@number-flow/react`.
- Barrel: `apps/web/src/components/charts/index.ts` (hand-written; the registry ships no root index).

**Gotchas hit (fix the same way if you add charts):**
- The CLI prompts to overwrite `lib/utils.ts` even with `--yes`; pipe `yes n |` to keep ours (bklit's `cn` is byte-identical).
- shadcn's `cssVars` injection mangled `globals.css` (`var(----chart-*)` four-dash lines in `@theme` + a greyscale-oklch `:root`/`.dark` block). The Thinkfy bridge replaces them: a single `:root` block mapping bklit `--chart-*` → `var(--color-chart-*)`/semantic tokens (auto theme-switches). Delete any CLI-injected oklch chart block.
- `chart-loading-label.tsx` imports `../components/shimmering-text` (wrong nesting) → repoint to `@/components/shimmering-text`.
- Installed types differ from the docs: `RadarData = {label, values: Record<string,number>}`, `RadarArea` has no `fill`/`fillOpacity` (uses `color`), `RingData` needs `maxValue`.
- `apps/web/src/components/charts/` is allowlisted in the audit (vendored; themed via CSS-var bridge). This is permanent and separate from the analytics/dashboard exemptions the B-cards remove.
- Heatmap ships a GitHub-green default ramp; pass a custom color range for an on-brand streak heatmap.

**ChartKit API (import from `@/components/charts`):** `AreaChart·Area`, `BarChart·Bar·BarXAxis·BarYAxis`, `LineChart·Line`, `RadarChart·RadarGrid·RadarAxis·RadarLabels·RadarArea`, `RingChart·Ring·RingCenter`, `HeatmapChart·HeatmapCells·HeatmapXAxis·HeatmapYAxis·HeatmapTooltip·HeatmapLegend·HeatmapInteractionProvider·HeatmapInteractionBoundary`, shared `Grid·XAxis·ChartTooltip`. Series colors: `var(--chart-line-primary)`, `var(--chart-line-secondary)`, or `var(--color-chart-1..7)`.

---

## 10. Phase 1 — B-card prompts (paste one per worktree session)

**Shared preamble (prepend to every card):**
> Read `docs/analytics-ui-revamp-masterplan.md` (esp. §9). Create a worktree: `git worktree add ../DebateLab-<card> -b <card>` and copy `.env.local` in. Build on the Thinkfy ChartKit (`@/components/charts`), data-viz primitives (`@/components/data-viz`: ChartCard, StatCard, Sparkline, SegmentedRange, DashboardSectionHeader, ChartSkeleton/Empty/Error), and motion (`@/components/motion`). Mirror the `/dashboard/admin/ui-system` styleguide. Colors come from tokens only — no raw hex; series use `var(--chart-line-primary|secondary)` or `var(--color-chart-1..7)`. Keep existing data-fetching/view-models; this is a presentation swap. Before PR: `npm run audit:design-system && npm run test:design-system`, `npx tsc --noEmit`, the card's `tsx` test if any, and dev-render via the `web-admin` preview config (`DEV_ADMIN_BYPASS=true`, port 3005). **When the surface is fully migrated, delete its folder fragment from `approvedPathFragments` in `scripts/design-system-audit.ts` and confirm the audit stays green.** DB via the local `supabase-debatelab` MCP only.

- **B1 · Student analytics page** — Rebuild `apps/web/src/components/analytics/analytics-page.tsx`. Replace the hand-SVG `MiniLineChart`/`MiniBarChart`/donut/score-rings/radar with: Area or LineChart (score trend), RingChart (overall score), RadarChart (skill snapshot), BarChart (practice minutes by week), Heatmap (activity). Keep the 7d/30d/90d control as `SegmentedRange`. Preserve `getAnalyticsPageData` + `/api/analytics/summary`. De-allowlist `apps/web/src/components/analytics/analytics-page.tsx`.
- **B2 · Dashboard home** — Rebuild the chart bits under `apps/web/src/components/dashboard/`: `weekly-chart.tsx` → BarChart, `skill-snapshot-card.tsx` → RadarChart, `streak-card.tsx` weekly rhythm → Heatmap, top stats → StatCard, entry tiles wrapped in Stagger. Keep `getDashboardData`. De-allowlist `apps/web/src/components/dashboard/`.
- **B3 · Profile analytics** — Rebuild `apps/web/src/components/profile/profile-analytics-tab.tsx` + the analytics parts of `social-profile-page.tsx`: RadarChart (skills), RingChart (speaking/debate mix), LineChart (score trend). Delete the lone recharts radar `skill-radar-chart.tsx`. Keep `getProfileAnalyticsTabData`. De-allowlist `apps/web/src/components/profile/`.
- **B4 · Practice/duel results** — Rebuild `apps/web/src/components/feedback/session-result-dashboard.tsx` + `apps/web/src/components/practice/round-progress.tsx`: RingChart for overall + per-skill rings, a Line/timeline for rounds, `SuccessCheck` on reveal. Keep `buildSessionResultViewModel`. De-allowlist `apps/web/src/components/feedback/` (+ the practice fragment).
- **B5 · Admin overview / AI-quality / per-user (migrate recharts)** — Move the 3 recharts charts onto the ChartKit: `admin/overview/TrendChart.tsx` → AreaChart, `admin/overview/ApiUsageChart.tsx` → horizontal BarChart, the custom-SVG charts in `admin/users/UserAnalyticsDashboard.tsx` → LineChart + RadarChart. KPI tiles → StatCard. De-allowlist `admin/overview/` + `admin/users/UserAnalyticsDashboard.tsx`. (The `recharts` dependency itself is removed in WS-C1 once B3+B5 land.)
- **B6 · B2B class/club** — Rebuild analytics in `apps/web/src/components/admin/classes/*` + `admin/clubs/*`: StatCard KPIs (classes/students/attendance %), BarChart/AreaChart for attendance & progress trends; per-student tables stay. De-allowlist `admin/clubs/ClubDetailDashboard.tsx` + `ClubSchedulePanel.tsx`.
- **B7 · IELTS analytics** — Rebuild `/dashboard/admin/prediction-quality`, the predicted-band card, and the study-plan forecast on the ChartKit: scatter/Line for calibration (claimed vs empirical), AreaChart for month-windowed drift, AreaChart band for the 14-day forecast. Reuse `runBacktest`/`BacktestReport`; keep service-role + admin gating. See memory `[[ielts-ws-6.3-prediction-quality-dashboard]]`.
