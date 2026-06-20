-- WS-3.1 — IELTS Writing scorer: persist the scorer transparency envelope.
--
-- Additive + inert for debate. `writing_responses` is an IELTS table whose RLS
-- + policies were created in 20260618205215_ielts_data_model.sql; adding a
-- column does not change isolation. The numeric per-criterion bands keep living
-- in their typed numeric(2,1) columns; this jsonb column holds only *feedback*
-- (per-criterion rationales, the overall summary, and the Vietnamese-language
-- explanation) — not scores — so the typed-score-columns quality gate is
-- respected (docs/ielts/data-access.md §5).

alter table public.writing_responses
  add column if not exists criteria_feedback jsonb not null default '{}'::jsonb;

comment on column public.writing_responses.criteria_feedback is
  'WS-3.1 AI scorer transparency envelope: { summary, vietnameseSummary, criteria: { <criterion>: { band, rationale } } }. Numeric bands also live in the typed *_band columns.';
