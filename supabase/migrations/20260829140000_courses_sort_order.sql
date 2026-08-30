begin;

-- The IELTS learn path and admin course ordering both consume this column.
-- It existed in the checked-in type overlay but had never been represented by
-- a migration, which made a clean local database diverge from application code.
alter table public.courses
  add column if not exists sort_order integer not null default 0;

create index if not exists courses_subject_published_sort_idx
  on public.courses (subject, is_published, sort_order, created_at);

commit;
