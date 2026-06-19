-- WS-0.2 — Subject axis on engine content.
--
-- Adds `subject` (debate | ielts) to the course content container so the
-- activity/course engine can be scoped by subject, orthogonally to the EN/VI
-- locale axis. Additive and backfilled to 'debate', so all existing (debate)
-- content and behavior is byte-identical. Mirrors the existing text + CHECK
-- idiom already used by `difficulty` / `visibility` on this table.
--
-- RLS: `public.courses` already enables row level security with policies
-- ("Anyone can view published courses", "Admins can manage courses"), so a new
-- column inherits them — no policy change is required, and the rls-coverage gate
-- is unaffected (this adds no table). `subject` is a typed text column with a
-- CHECK constraint, not a `json`/`jsonb` blob.

alter table public.courses
  add column if not exists subject text not null default 'debate'
    check (subject in ('debate', 'ielts'));

comment on column public.courses.subject is
  'Content subject axis (debate | ielts), orthogonal to the EN/VI locale. WS-0.2.';
