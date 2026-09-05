-- B3 · Roster import + export: club-scoped student records.
--
-- WHY A NEW TABLE, NOT `profiles`.
-- `profiles.id` is FK → `auth.users(id)` and rows are created only by the
-- `on_auth_user_created` trigger, so "import 150 students" cannot mean "insert
-- 150 profiles". More importantly `profiles` is a *consumer* profile: it is
-- read by public/social surfaces (`get_profile_public_data`,
-- `search_profile_discovery`, leaderboards) and dumped wholesale into a
-- user-downloadable JSON by `settings/export`. A minor's date of birth and a
-- parent's phone number must not land there.
--
-- ROSTER-FIRST, ACCOUNT-LATER. `student_records.user_id` is nullable: a centre
-- can enter 150 students with no email at all and print a roster and mark paper
-- attendance on day one. When a row carries an email, the existing invitation
-- rail (`club_invitations` → /join/club/[token] → `claimClubInvitation`) creates
-- the account and back-fills `user_id`.
--
-- SEAM FOR B5. B3 owns the student record. B5 owns the guardian as an *actor* —
-- its own `guardians` identity with a Zalo/login, `guardian_students` M2M,
-- consent state and a delivery log — back-filled from the guardian_* columns
-- here. `user_age_assurance.guardian_email` is a different fact (self-attested
-- COPPA) with different provenance; do not conflate them.
--
-- NOT APPLIED. Land, review, then apply. Production is live.
begin;

-- ---------------------------------------------------------------------------
-- Import batches. Created first: student_records references it.
-- ---------------------------------------------------------------------------
create table if not exists public.roster_import_batches (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  class_id uuid references public.classes(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  source_filename text,
  -- Batch-level replay guard: re-submitting the same confirmed import is a
  -- no-op rather than a second pass. Row-level idempotency is separate and
  -- comes from matching on email / student_code / phone.
  idempotency_key text,
  row_count integer not null default 0,
  created_count integer not null default 0,
  updated_count integer not null default 0,
  skipped_count integer not null default 0,
  invited_count integer not null default 0,
  error_count integer not null default 0,
  report jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Student records.
-- ---------------------------------------------------------------------------
create table if not exists public.student_records (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  -- Nullable on purpose. Null = on the roster, no Thinkfy account yet.
  user_id uuid references public.profiles(id) on delete set null,
  full_name text not null,
  student_code text,
  email text,
  date_of_birth date,
  phone text,
  guardian_name text,
  guardian_phone text,
  guardian_email text,
  notes text,
  status text not null default 'active'
    check (status in ('active', 'inactive', 'archived')),
  -- Set when the account invitation has been handed to the invitation rail.
  -- `user_id` stays null until the student actually claims it, so without this
  -- marker a resumable invitation run would re-send to the same people forever.
  invitation_sent_at timestamptz,
  import_batch_id uuid references public.roster_import_batches(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Class enrolment for a record that may have no account yet. Distinct from
-- `class_memberships`, which requires a `profiles` row: this is the paper
-- roster, and it collapses into a membership once `user_id` is linked.
-- ---------------------------------------------------------------------------
create table if not exists public.student_record_enrollments (
  id uuid primary key default gen_random_uuid(),
  student_record_id uuid not null references public.student_records(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  status text not null default 'active'
    check (status in ('active', 'removed')),
  enrolled_at timestamptz not null default now(),
  removed_at timestamptz,
  import_batch_id uuid references public.roster_import_batches(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_record_id, class_id)
);

-- ---------------------------------------------------------------------------
-- Indexes. These are the match-precedence lookups the importer runs per chunk:
-- email → student_code → phone → (name, date_of_birth).
-- ---------------------------------------------------------------------------
create index if not exists roster_import_batches_club_created_idx
  on public.roster_import_batches (club_id, created_at desc);
create unique index if not exists roster_import_batches_club_idempotency_idx
  on public.roster_import_batches (club_id, idempotency_key)
  where idempotency_key is not null;

create index if not exists student_records_club_email_idx
  on public.student_records (club_id, lower(email))
  where email is not null;
-- Student code IS unique per club: it is the centre's own primary key, and a
-- duplicate is always a data-entry error worth failing on.
create unique index if not exists student_records_club_code_idx
  on public.student_records (club_id, lower(student_code))
  where student_code is not null;
-- Email is deliberately NOT unique: siblings at a Vietnamese centre routinely
-- share a parent's address, and a unique constraint would reject a real roster.
-- Ambiguity is resolved in the importer, which reports `needs_review`.
create index if not exists student_records_club_phone_idx
  on public.student_records (club_id, phone)
  where phone is not null;
create index if not exists student_records_club_name_dob_idx
  on public.student_records (club_id, lower(full_name), date_of_birth);
create index if not exists student_records_user_idx
  on public.student_records (user_id)
  where user_id is not null;
create index if not exists student_records_batch_idx
  on public.student_records (import_batch_id)
  where import_batch_id is not null;
-- Drives the resumable invitation run: "records in this batch, with an email,
-- not yet invited". Partial so it stays small as batches accumulate.
create index if not exists student_records_pending_invite_idx
  on public.student_records (import_batch_id, created_at)
  where email is not null and user_id is null and invitation_sent_at is null;

create index if not exists student_record_enrollments_class_idx
  on public.student_record_enrollments (class_id, status);
create index if not exists student_record_enrollments_record_idx
  on public.student_record_enrollments (student_record_id);

-- ---------------------------------------------------------------------------
-- updated_at.
-- ---------------------------------------------------------------------------
create or replace function private.touch_student_record_updated_at()
returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists roster_import_batches_touch_updated_at on public.roster_import_batches;
create trigger roster_import_batches_touch_updated_at
before update on public.roster_import_batches
for each row execute function private.touch_student_record_updated_at();

drop trigger if exists student_records_touch_updated_at on public.student_records;
create trigger student_records_touch_updated_at
before update on public.student_records
for each row execute function private.touch_student_record_updated_at();

drop trigger if exists student_record_enrollments_touch_updated_at on public.student_record_enrollments;
create trigger student_record_enrollments_touch_updated_at
before update on public.student_record_enrollments
for each row execute function private.touch_student_record_updated_at();

-- ---------------------------------------------------------------------------
-- RLS. Every table, before any DML in this file (PG 55006).
--
-- Gated on `private.organization_can_manage_people` — platform admin, or an org
-- owner/admin/head_teacher. NOT `private.can_view_club`: an ordinary club
-- member is often another student, and these rows hold a minor's date of birth
-- and a parent's phone number.
-- ---------------------------------------------------------------------------
alter table public.roster_import_batches enable row level security;
alter table public.student_records enable row level security;
alter table public.student_record_enrollments enable row level security;

drop policy if exists "Managers read roster import batches" on public.roster_import_batches;
create policy "Managers read roster import batches"
  on public.roster_import_batches for select to authenticated
  using (private.organization_can_manage_people(club_id, (select auth.uid())));

drop policy if exists "Managers create roster import batches" on public.roster_import_batches;
create policy "Managers create roster import batches"
  on public.roster_import_batches for insert to authenticated
  with check (private.organization_can_manage_people(club_id, (select auth.uid())));

drop policy if exists "Managers update roster import batches" on public.roster_import_batches;
create policy "Managers update roster import batches"
  on public.roster_import_batches for update to authenticated
  using (private.organization_can_manage_people(club_id, (select auth.uid())))
  with check (private.organization_can_manage_people(club_id, (select auth.uid())));

drop policy if exists "Managers read club student records" on public.student_records;
create policy "Managers read club student records"
  on public.student_records for select to authenticated
  using (private.organization_can_manage_people(club_id, (select auth.uid())));

-- A linked student sees their own record and nothing else. Guardian access is
-- B5's problem, through its own identity — never by widening this policy.
drop policy if exists "Students read own student record" on public.student_records;
create policy "Students read own student record"
  on public.student_records for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Managers create club student records" on public.student_records;
create policy "Managers create club student records"
  on public.student_records for insert to authenticated
  with check (private.organization_can_manage_people(club_id, (select auth.uid())));

drop policy if exists "Managers update club student records" on public.student_records;
create policy "Managers update club student records"
  on public.student_records for update to authenticated
  using (private.organization_can_manage_people(club_id, (select auth.uid())))
  with check (private.organization_can_manage_people(club_id, (select auth.uid())));

drop policy if exists "Managers read student record enrollments" on public.student_record_enrollments;
create policy "Managers read student record enrollments"
  on public.student_record_enrollments for select to authenticated
  using (private.can_manage_class(class_id, (select auth.uid())));

drop policy if exists "Managers create student record enrollments" on public.student_record_enrollments;
create policy "Managers create student record enrollments"
  on public.student_record_enrollments for insert to authenticated
  with check (private.can_manage_class(class_id, (select auth.uid())));

drop policy if exists "Managers update student record enrollments" on public.student_record_enrollments;
create policy "Managers update student record enrollments"
  on public.student_record_enrollments for update to authenticated
  using (private.can_manage_class(class_id, (select auth.uid())))
  with check (private.can_manage_class(class_id, (select auth.uid())));

-- ---------------------------------------------------------------------------
-- Grants.
--
-- Writes go through RLS rather than a SECURITY DEFINER RPC, unlike
-- `20260902150000_organization_curriculum.sql`. That file is RPC-only because
-- its writes carry cross-row invariants (optimistic concurrency, audit). A
-- roster import is the opposite by design: per-row failure, never
-- all-or-nothing, so a row that fails must not roll back the batch around it.
-- The policies above are the whole authorization story.
--
-- DELETE is revoked everywhere. A student who leaves is `status='archived'`;
-- attendance and grade history must not be destroyed by a roster edit.
-- ---------------------------------------------------------------------------
grant select, insert, update on public.student_records, public.student_record_enrollments, public.roster_import_batches to authenticated;
revoke delete on public.student_records, public.student_record_enrollments, public.roster_import_batches from authenticated;
revoke all on public.student_records, public.student_record_enrollments, public.roster_import_batches from anon;

commit;
