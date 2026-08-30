-- Shared LMS materials: tenant-safe, versioned teaching content for IELTS,
-- debate, and public speaking. This migration is additive and deliberately
-- leaves the legacy lms_resources model in place for compatibility.
begin;

create table if not exists public.lms_materials (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  scope_class_id uuid references public.classes(id) on delete restrict,
  program_type text not null check (program_type in ('ielts', 'debate', 'public_speaking')),
  title text not null check (length(btrim(title)) between 1 and 240),
  description text,
  material_kind text not null check (material_kind in ('link', 'file', 'document', 'audio', 'video', 'text')),
  url text,
  document jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  rights_basis text not null default 'unknown'
    check (rights_basis in ('original', 'commercial_license', 'open_license', 'internal_adaptation', 'unknown')),
  rights_provenance text,
  rights_holder text,
  rights_license text,
  rights_approved_by uuid references public.profiles(id) on delete set null,
  rights_approved_at timestamptz,
  rights_review_note text,
  published_at timestamptz,
  archived_at timestamptz,
  created_by uuid not null references public.profiles(id) on delete restrict,
  updated_by uuid references public.profiles(id) on delete set null,
  source_resource_id uuid references public.lms_resources(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((material_kind = 'link' and url ~* '^https://') or (material_kind <> 'link' and url is null)),
  check (jsonb_typeof(document) = 'object'),
  check (status <> 'published' or published_at is not null),
  check (status <> 'published' or (
    rights_basis <> 'unknown'
    and length(btrim(coalesce(rights_provenance, ''))) > 0
    and rights_approved_by is not null
    and rights_approved_at is not null
  ))
);

create table if not exists public.lms_material_versions (
  id uuid primary key default gen_random_uuid(),
  material_id uuid not null references public.lms_materials(id) on delete restrict,
  version_number integer not null check (version_number > 0),
  idempotency_key text not null default gen_random_uuid()::text,
  processing_status text not null default 'uploading'
    check (processing_status in ('uploading', 'queued', 'scanning', 'converting', 'ready', 'rejected', 'failed')),
  ingest_bucket text,
  ingest_path text,
  original_bucket text,
  original_path text,
  source_file_name text,
  source_mime_type text,
  detected_mime_type text,
  size_bytes bigint check (size_bytes is null or size_bytes >= 0),
  sha256 text check (sha256 is null or sha256 ~ '^[0-9a-f]{64}$'),
  processing_attempts integer not null default 0 check (processing_attempts >= 0),
  lease_token text,
  lease_expires_at timestamptz,
  error_code text,
  error_message text,
  native_document jsonb not null default '{}'::jsonb check (jsonb_typeof(native_document) = 'object'),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (material_id, version_number),
  unique (idempotency_key)
);

create table if not exists public.lms_material_renditions (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.lms_material_versions(id) on delete restrict,
  rendition_kind text not null check (rendition_kind in ('original', 'pdf_preview', 'page_image', 'thumbnail', 'image_preview', 'audio_stream')),
  processing_status text not null default 'queued'
    check (processing_status in ('uploading', 'queued', 'scanning', 'converting', 'ready', 'rejected', 'failed')),
  bucket_id text not null check (bucket_id in ('lms-material-originals', 'lms-material-previews')),
  storage_path text not null check (length(btrim(storage_path)) > 0),
  mime_type text,
  size_bytes bigint check (size_bytes is null or size_bytes >= 0),
  sha256 text check (sha256 is null or sha256 ~ '^[0-9a-f]{64}$'),
  page_number integer check (page_number is null or page_number > 0),
  sort_order integer not null default 0 check (sort_order >= 0),
  watermark_learner_label text,
  watermark_class_label text,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  unique (version_id, rendition_kind, storage_path),
  check ((rendition_kind = 'original' and bucket_id = 'lms-material-originals') or (rendition_kind <> 'original' and bucket_id = 'lms-material-previews'))
);

create table if not exists public.lms_material_placements (
  id uuid primary key default gen_random_uuid(),
  material_id uuid not null references public.lms_materials(id) on delete restrict,
  version_id uuid not null references public.lms_material_versions(id) on delete restrict,
  club_id uuid not null references public.clubs(id) on delete cascade,
  target_type text not null check (target_type in ('class', 'course', 'occurrence', 'assignment')),
  class_id uuid references public.classes(id) on delete cascade,
  course_id uuid references public.courses(id) on delete cascade,
  occurrence_id uuid references public.lms_lesson_occurrences(id) on delete cascade,
  assignment_id uuid references public.club_assignments(id) on delete cascade,
  order_index integer not null default 0 check (order_index >= 0),
  required boolean not null default false,
  audience_mode text not null default 'all' check (audience_mode in ('all', 'selected')),
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'published', 'withdrawn')),
  release_at timestamptz,
  expires_at timestamptz,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((target_type = 'class' and class_id is not null and course_id is null and occurrence_id is null and assignment_id is null)
    or (target_type = 'course' and class_id is null and course_id is not null and occurrence_id is null and assignment_id is null)
    or (target_type = 'occurrence' and class_id is null and course_id is null and occurrence_id is not null and assignment_id is null)
    or (target_type = 'assignment' and class_id is null and course_id is null and occurrence_id is null and assignment_id is not null)),
  check (expires_at is null or release_at is null or expires_at > release_at)
  ,check (status <> 'scheduled' or release_at is not null)
);

create table if not exists public.lms_material_audiences (
  id uuid not null default gen_random_uuid(),
  material_id uuid not null references public.lms_materials(id) on delete restrict,
  placement_id uuid not null references public.lms_material_placements(id) on delete restrict,
  class_id uuid not null references public.classes(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'revoked')),
  added_by uuid not null references public.profiles(id) on delete restrict,
  added_at timestamptz not null default now(),
  revoked_at timestamptz,
  primary key (id),
  unique (placement_id, user_id)
);

create table if not exists public.lms_material_unlock_rules (
  id uuid primary key default gen_random_uuid(),
  material_id uuid not null references public.lms_materials(id) on delete restrict,
  placement_id uuid not null references public.lms_material_placements(id) on delete restrict,
  rule_kind text not null check (rule_kind in ('lesson_completed', 'assignment_submitted', 'minimum_score')),
  occurrence_id uuid references public.lms_lesson_occurrences(id) on delete restrict,
  assignment_id uuid references public.club_assignments(id) on delete restrict,
  minimum_score numeric(5,2) check (minimum_score is null or (minimum_score >= 0 and minimum_score <= 100)),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  check ((rule_kind = 'lesson_completed' and occurrence_id is not null and assignment_id is null and minimum_score is null)
    or (rule_kind = 'assignment_submitted' and occurrence_id is null and assignment_id is not null and minimum_score is null)
    or (rule_kind = 'minimum_score' and occurrence_id is null and assignment_id is not null and minimum_score is not null))
);

create table if not exists public.lms_material_rights_approvals (
  id uuid primary key default gen_random_uuid(),
  material_id uuid not null references public.lms_materials(id) on delete restrict,
  version_id uuid not null references public.lms_material_versions(id) on delete restrict,
  decision text not null check (decision in ('approved', 'rejected', 'revoked')),
  basis text not null check (basis in ('original', 'commercial_license', 'open_license', 'internal_adaptation')),
  provenance text not null check (length(btrim(provenance)) between 1 and 4000),
  rights_holder text,
  license_name text,
  evidence_url text,
  evidence_note text,
  expires_at timestamptz,
  reviewer_id uuid not null references public.profiles(id) on delete restrict,
  reviewed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.lms_material_audit_events (
  id uuid primary key default gen_random_uuid(),
  material_id uuid not null,
  entity_type text not null check (entity_type in ('material', 'version', 'rendition', 'placement', 'audience', 'unlock_rule', 'rights_approval')),
  entity_id uuid not null,
  action text not null check (action in ('created', 'updated', 'published', 'withdrawn', 'archived', 'deleted', 'rights_approved', 'rights_rejected', 'rights_revoked', 'processing_failed')),
  actor_id uuid references public.profiles(id) on delete set null,
  reason text,
  before_state jsonb,
  after_state jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists lms_material_source_resource_uidx
  on public.lms_materials(source_resource_id) where source_resource_id is not null;
create unique index if not exists lms_material_rendition_page_uidx on public.lms_material_renditions(version_id, rendition_kind, coalesce(page_number, 0), storage_path);
create unique index if not exists lms_material_placement_target_uidx on public.lms_material_placements(
  material_id, target_type, coalesce(class_id, course_id, occurrence_id, assignment_id, '00000000-0000-0000-0000-000000000000'::uuid)
);
create index if not exists lms_material_placements_class_idx on public.lms_material_placements(class_id, status, release_at);
create index if not exists lms_material_placements_course_idx on public.lms_material_placements(course_id, status, release_at);
create index if not exists lms_material_placements_occurrence_idx on public.lms_material_placements(occurrence_id, status);
create index if not exists lms_material_placements_assignment_idx on public.lms_material_placements(assignment_id, status);
create index if not exists lms_material_audiences_user_idx on public.lms_material_audiences(user_id, class_id, status);
create index if not exists lms_material_unlock_rules_placement_idx on public.lms_material_unlock_rules(placement_id, rule_kind);
create index if not exists lms_material_audit_material_idx on public.lms_material_audit_events(material_id, created_at desc, id desc);

create or replace function private.can_manage_lms_material_club(p_club_id uuid, p_user_id uuid)
returns boolean language sql stable security definer set search_path = public, private as $$
  select p_user_id is not null and (
    private.is_admin(p_user_id)
    or exists (select 1 from public.club_memberships cm where cm.club_id = p_club_id and cm.user_id = p_user_id and cm.role = 'owner' and cm.status = 'active')
  );
$$;

create or replace function private.can_manage_lms_material(p_material_id uuid, p_user_id uuid)
returns boolean language sql stable security definer set search_path = public, private as $$
  select p_user_id is not null and exists (
    select 1 from public.lms_materials m
    where m.id = p_material_id and (
      private.can_manage_lms_material_club(m.club_id, p_user_id)
      or (m.scope_class_id is not null and private.can_manage_class(m.scope_class_id, p_user_id))
      or exists (
        select 1 from public.lms_material_placements p
        where p.material_id = m.id and (
          (p.class_id is not null and private.can_manage_class(p.class_id, p_user_id))
          or (p.occurrence_id is not null and private.can_manage_lms_occurrence(p.occurrence_id, p_user_id))
          or (p.assignment_id is not null and exists (select 1 from public.club_assignments a where a.id = p.assignment_id and a.class_id is not null and private.can_manage_class(a.class_id, p_user_id)))
          or (p.course_id is not null and exists (select 1 from public.class_course_assignments cca join public.classes c on c.id = cca.class_id where cca.course_id = p.course_id and c.club_id = m.club_id and private.can_manage_class(c.id, p_user_id)))
        )
      )
    )
  );
$$;

create or replace function private.lms_material_placement_unlocks_satisfied(p_placement_id uuid, p_user_id uuid)
returns boolean language sql stable security definer set search_path = public, private as $$
  select p_user_id is not null and not exists (
    select 1 from public.lms_material_unlock_rules r
    where r.placement_id = p_placement_id
      and not (
        (r.rule_kind = 'lesson_completed' and exists (
          select 1 from public.lms_lesson_occurrences o
          join public.class_memberships cm on cm.class_id = o.class_id and cm.user_id = p_user_id and cm.member_role = 'student'
            and (cm.status = 'active' or (cm.joined_at <= o.starts_at and (cm.removed_at is null or cm.removed_at >= o.starts_at)))
          where o.id = r.occurrence_id and o.status = 'completed' and o.published_at is not null
        ))
        or (r.rule_kind = 'assignment_submitted' and exists (
          select 1 from public.club_assignment_submissions s
          where s.assignment_id = r.assignment_id and s.user_id = p_user_id and s.submitted_at is not null
            and (coalesce(s.submission_state, 'submitted') in ('submitted', 'graded') or s.status in ('submitted', 'reviewed'))
        ))
        or (r.rule_kind = 'minimum_score' and (
          exists (select 1 from public.club_assignment_submissions s where s.assignment_id = r.assignment_id and s.user_id = p_user_id and s.grade_status in ('graded', 'returned') and s.score is not null and s.score >= r.minimum_score)
          or exists (select 1 from public.ielts_attempts a join public.ielts_effective_attempt_scores e on e.attempt_id = a.id where a.assignment_id = r.assignment_id and a.user_id = p_user_id and e.overall_band is not null and e.overall_is_provisional = false and e.overall_band >= r.minimum_score)
        ))
      )
  );
$$;

create or replace function private.can_manage_lms_material_placement(p_placement_id uuid, p_user_id uuid)
returns boolean language sql stable security definer set search_path = public, private as $$
  select p_user_id is not null and exists (
    select 1
    from public.lms_material_placements p
    join public.lms_materials m on m.id = p.material_id and m.club_id = p.club_id
    where p.id = p_placement_id and (
      private.can_manage_lms_material_club(m.club_id, p_user_id)
      or (p.target_type = 'class' and private.can_manage_class(p.class_id, p_user_id))
      or (p.target_type = 'occurrence' and private.can_manage_lms_occurrence(p.occurrence_id, p_user_id))
      or (p.target_type = 'assignment' and exists (
        select 1 from public.club_assignments a
        where a.id = p.assignment_id and a.class_id is not null
          and private.can_manage_class(a.class_id, p_user_id)
      ))
    )
  );
$$;

create or replace function private.lms_material_version_rights_approved(p_version_id uuid)
returns boolean language sql stable security definer set search_path = public, private as $$
  select exists (
    select 1
    from public.lms_material_rights_approvals approved
    where approved.version_id = p_version_id
      and approved.decision = 'approved'
      and (approved.expires_at is null or approved.expires_at > now())
      and not exists (
        select 1 from public.lms_material_rights_approvals later
        where later.version_id = approved.version_id
          and later.reviewed_at > approved.reviewed_at
          and later.decision in ('rejected', 'revoked')
      )
  );
$$;

create or replace function private.can_read_lms_material(p_material_id uuid, p_user_id uuid)
returns boolean language sql stable security definer set search_path = public, private as $$
  select p_user_id is not null and exists (
    select 1 from public.lms_materials m
    where m.id = p_material_id and (
      private.can_manage_lms_material(m.id, p_user_id)
      or (
        m.status = 'published'
        and exists (
          select 1 from public.lms_material_placements p
          where p.material_id = m.id and p.status = 'published'
            and (p.release_at is null or p.release_at <= now())
            and (p.expires_at is null or p.expires_at > now())
            and private.lms_material_placement_unlocks_satisfied(p.id, p_user_id)
            and (p.audience_mode = 'all' or exists (select 1 from public.lms_material_audiences audience where audience.placement_id = p.id and audience.user_id = p_user_id and audience.status = 'active'))
            and (
              (p.target_type = 'class' and exists (select 1 from public.class_memberships cm join public.classes c on c.id = cm.class_id where cm.class_id = p.class_id and c.club_id = m.club_id and c.program_type = m.program_type and cm.user_id = p_user_id and cm.member_role = 'student' and cm.status = 'active'))
              or (p.target_type = 'course' and exists (select 1 from public.class_course_assignments cca join public.classes c on c.id = cca.class_id join public.class_memberships cm on cm.class_id = c.id and cm.user_id = p_user_id and cm.member_role = 'student' and cm.status = 'active' where cca.course_id = p.course_id and c.club_id = m.club_id and c.program_type = m.program_type))
              or (p.target_type = 'occurrence' and exists (select 1 from public.lms_lesson_occurrences o join public.class_memberships cm on cm.class_id = o.class_id and cm.user_id = p_user_id and cm.member_role = 'student' and cm.status = 'active' where o.id = p.occurrence_id and o.club_id = m.club_id and o.published_at is not null and o.status <> 'cancelled'))
              or (p.target_type = 'assignment' and exists (select 1 from public.club_assignments a join public.class_memberships cm on cm.class_id = a.class_id and cm.user_id = p_user_id and cm.member_role = 'student' and cm.status = 'active' join public.classes c on c.id = a.class_id where a.id = p.assignment_id and a.status = 'active' and a.club_id = m.club_id and c.program_type = m.program_type))
            )
        )
      )
    )
  );
$$;

create or replace function private.can_read_lms_material_storage(p_material_id uuid, p_rendition_kind text, p_user_id uuid)
returns boolean language sql stable security definer set search_path = public, private as $$
  select p_rendition_kind in ('pdf_preview', 'page_image', 'thumbnail', 'image_preview', 'audio_stream') and private.can_read_lms_material(p_material_id, p_user_id);
$$;

create or replace function public.can_access_lms_material_preview(
  p_placement_id uuid,
  p_version_id uuid,
  p_rendition_id uuid
)
returns boolean language sql stable security definer set search_path = public, private as $$
  select exists (
    select 1
    from public.lms_material_placements p
    join public.lms_materials m on m.id = p.material_id
    join public.lms_material_versions v on v.id = p.version_id and v.id = p_version_id
    join public.lms_material_renditions r on r.id = p_rendition_id and r.version_id = v.id
    where p.id = p_placement_id
      and r.rendition_kind <> 'original'
      and r.bucket_id = 'lms-material-previews'
      and r.processing_status = 'ready'
      and v.processing_status = 'ready'
      and private.lms_material_version_rights_approved(v.id)
      and p.status = 'published' and m.status = 'published'
      and (p.release_at is null or p.release_at <= now())
      and (p.expires_at is null or p.expires_at > now())
      and private.lms_material_placement_unlocks_satisfied(p.id, auth.uid())
        and (p.audience_mode = 'all' or exists (select 1 from public.lms_material_audiences a where a.placement_id = p.id and a.user_id = auth.uid() and a.status = 'active'))
        and ((p.target_type = 'class' and exists (select 1 from public.class_memberships cm where cm.class_id = p.class_id and cm.user_id = auth.uid() and cm.member_role = 'student' and cm.status = 'active'))
          or (p.target_type = 'course' and exists (select 1 from public.class_course_assignments cca join public.class_memberships cm on cm.class_id = cca.class_id where cca.course_id = p.course_id and cm.user_id = auth.uid() and cm.member_role = 'student' and cm.status = 'active'))
          or (p.target_type = 'occurrence' and exists (select 1 from public.lms_lesson_occurrences o join public.class_memberships cm on cm.class_id = o.class_id where o.id = p.occurrence_id and o.published_at is not null and o.status <> 'cancelled' and cm.user_id = auth.uid() and cm.member_role = 'student' and cm.status = 'active'))
          or (p.target_type = 'assignment' and exists (select 1 from public.club_assignments a join public.class_memberships cm on cm.class_id = a.class_id where a.id = p.assignment_id and cm.user_id = auth.uid() and cm.member_role = 'student' and cm.status = 'active')))
  );
$$;

create or replace function private.validate_lms_material_placement()
returns trigger language plpgsql security definer set search_path = public, private as $$
declare m record; target_club uuid; target_program text;
begin
  select club_id, program_type into m from public.lms_materials where id = new.material_id;
  if not found or m.club_id <> new.club_id then raise exception 'LMS_MATERIAL_PLACEMENT_CLUB_MISMATCH'; end if;
  if not exists (select 1 from public.lms_material_versions v where v.id = new.version_id and v.material_id = new.material_id) then raise exception 'LMS_MATERIAL_VERSION_MISMATCH'; end if;
  if new.class_id is not null then select club_id, program_type into target_club, target_program from public.classes where id = new.class_id; end if;
  if new.target_type = 'class' and (target_club is null or target_club <> new.club_id or target_program <> m.program_type) then raise exception 'LMS_MATERIAL_CLASS_SCOPE_MISMATCH'; end if;
  if new.target_type = 'course' and not exists (select 1 from public.class_course_assignments cca join public.classes c on c.id = cca.class_id where cca.course_id = new.course_id and c.club_id = new.club_id and c.program_type = m.program_type) then raise exception 'LMS_MATERIAL_COURSE_SCOPE_MISMATCH'; end if;
  if new.target_type = 'occurrence' and not exists (select 1 from public.lms_lesson_occurrences o join public.classes c on c.id = o.class_id where o.id = new.occurrence_id and o.club_id = new.club_id and c.program_type = m.program_type) then raise exception 'LMS_MATERIAL_OCCURRENCE_SCOPE_MISMATCH'; end if;
  if new.target_type = 'assignment' and not exists (select 1 from public.club_assignments a join public.classes c on c.id = a.class_id where a.id = new.assignment_id and a.club_id = new.club_id and c.program_type = m.program_type) then raise exception 'LMS_MATERIAL_ASSIGNMENT_SCOPE_MISMATCH'; end if;
  return new;
end;
$$;

create or replace function private.validate_lms_material_scope()
returns trigger language plpgsql security definer set search_path = public, private as $$
begin
  if new.scope_class_id is not null and not exists (
    select 1 from public.classes c
    where c.id = new.scope_class_id and c.club_id = new.club_id
      and c.program_type = new.program_type
  ) then raise exception 'LMS_MATERIAL_CLASS_SCOPE_MISMATCH'; end if;
  return new;
end;
$$;

create or replace function private.validate_lms_material_audience()
returns trigger language plpgsql security definer set search_path = public, private as $$
begin
  if not exists (
    select 1
    from public.lms_material_placements p
    join public.lms_materials m on m.id = p.material_id
    join public.classes c on c.id = new.class_id
    where p.id = new.placement_id and p.material_id = new.material_id
      and m.club_id = c.club_id and m.program_type = c.program_type
      and ((p.target_type = 'class' and p.class_id = new.class_id)
        or (p.target_type = 'course' and exists (select 1 from public.class_course_assignments cca where cca.class_id = new.class_id and cca.course_id = p.course_id))
        or (p.target_type = 'occurrence' and exists (select 1 from public.lms_lesson_occurrences o where o.id = p.occurrence_id and o.class_id = new.class_id))
        or (p.target_type = 'assignment' and exists (select 1 from public.club_assignments a where a.id = p.assignment_id and a.class_id = new.class_id)))
  )
    or not exists (select 1 from public.class_memberships cm where cm.class_id = new.class_id and cm.user_id = new.user_id and cm.member_role = 'student' and cm.status = 'active') then
    raise exception 'LMS_MATERIAL_AUDIENCE_SCOPE_MISMATCH';
  end if;
  return new;
end;
$$;

create or replace function private.validate_lms_material_unlock_rule()
returns trigger language plpgsql security definer set search_path = public, private as $$
declare material_club uuid; material_program text; placement_class uuid; prerequisite_class uuid;
begin
  select m.club_id, m.program_type,
    case p.target_type when 'class' then p.class_id
      when 'occurrence' then (select o.class_id from public.lms_lesson_occurrences o where o.id = p.occurrence_id)
      when 'assignment' then (select a.class_id from public.club_assignments a where a.id = p.assignment_id)
      else null end
  into material_club, material_program, placement_class
  from public.lms_materials m join public.lms_material_placements p on p.material_id = m.id
  where m.id = new.material_id and p.id = new.placement_id;
  if not found then raise exception 'LMS_MATERIAL_NOT_FOUND'; end if;
  if placement_class is null then raise exception 'LMS_MATERIAL_UNLOCK_REQUIRES_EXACT_CLASS'; end if;
  if new.occurrence_id is not null then select o.class_id into prerequisite_class from public.lms_lesson_occurrences o where o.id = new.occurrence_id and o.club_id = material_club; end if;
  if new.assignment_id is not null then select a.class_id into prerequisite_class from public.club_assignments a where a.id = new.assignment_id and a.club_id = material_club; end if;
  if prerequisite_class is distinct from placement_class
    or not exists (select 1 from public.classes c where c.id = placement_class and c.club_id = material_club and c.program_type = material_program) then
    raise exception 'LMS_MATERIAL_UNLOCK_CLASS_SCOPE_MISMATCH';
  end if;
  return new;
end;
$$;

create or replace function private.enforce_lms_material_publish_rights()
returns trigger language plpgsql security definer set search_path = public, private as $$
begin
  if new.status = 'published' then
    if new.published_at is null then new.published_at := now(); end if;
    if not exists (
      select 1
      from public.lms_material_placements p
      join public.lms_material_versions v on v.id = p.version_id and v.material_id = new.id
      where p.material_id = new.id and p.status = 'published'
        and v.processing_status = 'ready'
        and private.lms_material_version_rights_approved(v.id)
        and exists (
          select 1 from public.lms_material_renditions r
          where r.version_id = v.id and r.rendition_kind <> 'original'
            and r.bucket_id = 'lms-material-previews' and r.processing_status = 'ready'
        )
    ) then raise exception 'LMS_MATERIAL_PUBLISH_REQUIREMENTS_NOT_MET'; end if;
  end if;
  return new;
end;
$$;

create or replace function private.validate_lms_material_version_file()
returns trigger language plpgsql security definer set search_path = public, private as $$
begin
  if new.processing_status = 'ready' then
    if new.detected_mime_type is null or new.size_bytes is null or new.sha256 is null then raise exception 'LMS_MATERIAL_VERSION_INCOMPLETE'; end if;
    if new.detected_mime_type like 'audio/%' and new.size_bytes > 104857600 then raise exception 'LMS_MATERIAL_AUDIO_TOO_LARGE'; end if;
    if new.detected_mime_type not like 'audio/%' and new.size_bytes > 26214400 then raise exception 'LMS_MATERIAL_FILE_TOO_LARGE'; end if;
  end if;
  return new;
end;
$$;

create or replace function private.validate_lms_material_version_ready()
returns trigger language plpgsql security definer set search_path = public, private as $$
begin
  if exists (select 1 from public.lms_material_versions v where v.id = new.id and v.processing_status = 'ready')
    and not exists (select 1 from public.lms_material_renditions r where r.version_id = new.id and r.rendition_kind <> 'original' and r.bucket_id = 'lms-material-previews' and r.processing_status = 'ready') then
    raise exception 'LMS_MATERIAL_PREVIEW_RENDITION_REQUIRED';
  end if;
  return new;
end;
$$;

create or replace function private.validate_lms_material_rights_scope()
returns trigger language plpgsql security definer set search_path = public, private as $$
begin
  if not exists (select 1 from public.lms_material_versions v where v.id = new.version_id and v.material_id = new.material_id) then raise exception 'LMS_MATERIAL_RIGHTS_VERSION_MISMATCH'; end if;
  return new;
end;
$$;

create or replace function private.audit_lms_material_change()
returns trigger language plpgsql security definer set search_path = public, private as $$
declare material_key uuid; entity_key uuid; action_key text; actor_key uuid; decision_key text; version_key uuid;
begin
  entity_key := case when tg_op = 'DELETE' then old.id else new.id end;
  if tg_table_name = 'lms_materials' then
    material_key := entity_key;
  elsif tg_table_name = 'lms_material_renditions' then
    version_key := case when tg_op = 'DELETE' then old.version_id else new.version_id end;
    select material_id into material_key from public.lms_material_versions where id = version_key;
  else
    material_key := case when tg_op = 'DELETE' then old.material_id else new.material_id end;
  end if;
  action_key := case tg_op when 'INSERT' then 'created' when 'UPDATE' then 'updated' else 'deleted' end;
  if tg_table_name = 'lms_material_rights_approvals' then
    decision_key := case when tg_op = 'DELETE' then old.decision else new.decision end;
    action_key := case when decision_key = 'approved' then 'rights_approved' when decision_key = 'rejected' then 'rights_rejected' else 'rights_revoked' end;
  end if;
  actor_key := auth.uid();
  insert into public.lms_material_audit_events(material_id, entity_type, entity_id, action, actor_id, before_state, after_state)
  values (material_key, case tg_table_name when 'lms_materials' then 'material' when 'lms_material_versions' then 'version' when 'lms_material_renditions' then 'rendition' when 'lms_material_placements' then 'placement' when 'lms_material_audiences' then 'audience' when 'lms_material_unlock_rules' then 'unlock_rule' else 'rights_approval' end, entity_key, action_key, actor_key,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end);
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists lms_material_placement_scope on public.lms_material_placements;
create trigger lms_material_placement_scope before insert or update on public.lms_material_placements for each row execute function private.validate_lms_material_placement();
drop trigger if exists lms_material_scope on public.lms_materials;
create trigger lms_material_scope before insert or update on public.lms_materials for each row execute function private.validate_lms_material_scope();
drop trigger if exists lms_material_audience_scope on public.lms_material_audiences;
create trigger lms_material_audience_scope before insert or update on public.lms_material_audiences for each row execute function private.validate_lms_material_audience();
drop trigger if exists lms_material_unlock_scope on public.lms_material_unlock_rules;
create trigger lms_material_unlock_scope before insert or update on public.lms_material_unlock_rules for each row execute function private.validate_lms_material_unlock_rule();
drop trigger if exists lms_material_publish_rights on public.lms_materials;
create trigger lms_material_publish_rights before insert or update on public.lms_materials for each row execute function private.enforce_lms_material_publish_rights();
drop trigger if exists lms_material_version_file on public.lms_material_versions;
create trigger lms_material_version_file before insert or update on public.lms_material_versions for each row execute function private.validate_lms_material_version_file();
drop trigger if exists lms_material_version_ready on public.lms_material_versions;
create constraint trigger lms_material_version_ready after insert or update on public.lms_material_versions deferrable initially deferred for each row execute function private.validate_lms_material_version_ready();
drop trigger if exists lms_material_rights_scope on public.lms_material_rights_approvals;
create trigger lms_material_rights_scope before insert or update on public.lms_material_rights_approvals for each row execute function private.validate_lms_material_rights_scope();

drop trigger if exists lms_material_audit on public.lms_materials;
create trigger lms_material_audit after insert or update or delete on public.lms_materials for each row execute function private.audit_lms_material_change();
drop trigger if exists lms_material_version_audit on public.lms_material_versions;
create trigger lms_material_version_audit after insert or update or delete on public.lms_material_versions for each row execute function private.audit_lms_material_change();
drop trigger if exists lms_material_rendition_audit on public.lms_material_renditions;
create trigger lms_material_rendition_audit after insert or update or delete on public.lms_material_renditions for each row execute function private.audit_lms_material_change();
drop trigger if exists lms_material_placement_audit on public.lms_material_placements;
create trigger lms_material_placement_audit after insert or update or delete on public.lms_material_placements for each row execute function private.audit_lms_material_change();
drop trigger if exists lms_material_audience_audit on public.lms_material_audiences;
create trigger lms_material_audience_audit after insert or update or delete on public.lms_material_audiences for each row execute function private.audit_lms_material_change();
drop trigger if exists lms_material_unlock_audit on public.lms_material_unlock_rules;
create trigger lms_material_unlock_audit after insert or update or delete on public.lms_material_unlock_rules for each row execute function private.audit_lms_material_change();
drop trigger if exists lms_material_rights_audit on public.lms_material_rights_approvals;
create trigger lms_material_rights_audit after insert or update or delete on public.lms_material_rights_approvals for each row execute function private.audit_lms_material_change();

-- Legacy resource compatibility: explicit legacy assignments become exact
-- placements. Unscoped legacy resources are imported but not made visible to
-- learners until a manager creates a placement in the new model.
insert into public.lms_materials (
  club_id, program_type, title, description, material_kind, url, status,
  rights_basis, rights_provenance, rights_holder,
  rights_license, rights_approved_by, rights_approved_at, published_at,
  created_by, source_resource_id
)
select r.club_id, 'ielts', r.title, r.description, r.kind, r.url,
  'draft',
  'unknown', null, null, null, null, null, null,
  r.created_by, r.id
from public.lms_resources r
where r.club_id is not null and r.created_by is not null
on conflict do nothing;

insert into public.lms_material_versions(material_id, version_number, processing_status, original_bucket, original_path, source_mime_type, detected_mime_type, size_bytes, sha256, error_code, error_message, created_by)
select m.id, 1, 'failed', case when r.storage_path is null then null else 'lms-resources' end, r.storage_path, r.mime_type, r.mime_type, r.size_bytes, null, 'LEGACY_UNVERIFIED', 'Legacy resource requires revalidation before publishing.', m.created_by
from public.lms_materials m join public.lms_resources r on r.id = m.source_resource_id
where not exists (select 1 from public.lms_material_versions v where v.material_id = m.id);

insert into public.lms_material_placements(material_id, version_id, club_id, target_type, class_id, course_id, status, created_by)
select m.id, v.id, m.club_id, 'class', ra.class_id, null,
  'draft', m.created_by
from public.lms_resource_assignments ra
join public.lms_materials m on m.source_resource_id = ra.resource_id
join public.lms_material_versions v on v.material_id = m.id and v.version_number = 1
where ra.class_id is not null
on conflict do nothing;
insert into public.lms_material_placements(material_id, version_id, club_id, target_type, course_id, status, created_by)
select m.id, v.id, m.club_id, 'course', ra.course_id,
  'draft', m.created_by
from public.lms_resource_assignments ra
join public.lms_materials m on m.source_resource_id = ra.resource_id
join public.lms_material_versions v on v.material_id = m.id and v.version_number = 1
where ra.course_id is not null
on conflict do nothing;

alter table public.lms_materials enable row level security;
alter table public.lms_material_versions enable row level security;
alter table public.lms_material_renditions enable row level security;
alter table public.lms_material_placements enable row level security;
alter table public.lms_material_audiences enable row level security;
alter table public.lms_material_unlock_rules enable row level security;
alter table public.lms_material_rights_approvals enable row level security;
alter table public.lms_material_audit_events enable row level security;

create policy "LMS material scoped reads" on public.lms_materials for select to authenticated using (private.can_read_lms_material(id, auth.uid()));
create policy "LMS material manager writes" on public.lms_materials for all to authenticated using (private.can_manage_lms_material(id, auth.uid())) with check (private.can_manage_lms_material(id, auth.uid()) or private.can_manage_lms_material_club(club_id, auth.uid()));
create policy "LMS material version manager reads" on public.lms_material_versions for select to authenticated using (private.can_manage_lms_material(material_id, auth.uid()));
create policy "LMS material placement scoped reads" on public.lms_material_placements for select to authenticated using (private.can_read_lms_material(material_id, auth.uid()));
create policy "LMS material placement manager writes" on public.lms_material_placements for all to authenticated using (private.can_manage_lms_material(material_id, auth.uid())) with check (private.can_manage_lms_material(material_id, auth.uid()));
create policy "LMS material audience own or manager reads" on public.lms_material_audiences for select to authenticated using (user_id = auth.uid() or private.can_manage_lms_material(material_id, auth.uid()));
create policy "LMS material audience manager writes" on public.lms_material_audiences for all to authenticated using (private.can_manage_lms_material(material_id, auth.uid())) with check (private.can_manage_lms_material(material_id, auth.uid()));
create policy "LMS material unlock manager reads" on public.lms_material_unlock_rules for select to authenticated using (private.can_manage_lms_material(material_id, auth.uid()));
create policy "LMS material unlock manager writes" on public.lms_material_unlock_rules for all to authenticated using (private.can_manage_lms_material(material_id, auth.uid())) with check (private.can_manage_lms_material(material_id, auth.uid()));
create policy "LMS material rights manager reads" on public.lms_material_rights_approvals for select to authenticated using (private.can_manage_lms_material(material_id, auth.uid()));
create policy "LMS material audit manager reads" on public.lms_material_audit_events for select to authenticated using (private.can_manage_lms_material(material_id, auth.uid()));

revoke all on public.lms_materials, public.lms_material_versions, public.lms_material_renditions,
  public.lms_material_placements, public.lms_material_audiences,
  public.lms_material_unlock_rules, public.lms_material_rights_approvals,
  public.lms_material_audit_events from authenticated;
grant select on public.lms_materials, public.lms_material_versions, public.lms_material_renditions,
  public.lms_material_placements, public.lms_material_audiences,
  public.lms_material_unlock_rules, public.lms_material_rights_approvals,
  public.lms_material_audit_events to service_role;
grant all on public.lms_materials, public.lms_material_versions, public.lms_material_renditions, public.lms_material_placements, public.lms_material_audiences, public.lms_material_unlock_rules, public.lms_material_rights_approvals to service_role;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values
  ('lms-material-ingest', 'lms-material-ingest', false, 104857600, array['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation','text/plain','image/png','image/jpeg','image/webp','audio/mpeg','audio/mp4','audio/wav','audio/x-wav']),
  ('lms-material-originals', 'lms-material-originals', false, 104857600, array['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation','text/plain','image/png','image/jpeg','image/webp','audio/mpeg','audio/mp4','audio/wav','audio/x-wav']),
  ('lms-material-previews', 'lms-material-previews', false, 104857600, array['application/pdf','text/plain','image/png','image/jpeg','image/webp','audio/mpeg','audio/mp4','audio/wav','audio/x-wav'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create or replace function private.can_manage_lms_material_storage(p_bucket_id text, p_path text, p_user_id uuid)
returns boolean language sql stable security definer set search_path = public, private as $$
  select p_bucket_id = 'lms-material-ingest'
    and p_path ~* '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}/[A-Za-z0-9._-]{1,160}$'
    and split_part(p_path, '/', 3)::uuid = p_user_id
    and private.can_manage_lms_material(split_part(p_path, '/', 2)::uuid, p_user_id)
    and exists (select 1 from public.lms_materials m join public.lms_material_versions v on v.material_id = m.id where m.id = split_part(p_path, '/', 2)::uuid and m.club_id = split_part(p_path, '/', 1)::uuid and m.status = 'draft' and v.id = split_part(p_path, '/', 4)::uuid and v.ingest_bucket = p_bucket_id and v.ingest_path = p_path and v.processing_status in ('uploading', 'failed') and v.created_by = p_user_id);
$$;

create policy "LMS material ingest manager upload" on storage.objects for insert to authenticated with check (
  bucket_id = 'lms-material-ingest' and name ~* '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}/[A-Za-z0-9._-]{1,160}$'
  and private.can_manage_lms_material_storage(bucket_id, name, auth.uid())
);
create policy "LMS material ingest manager read" on storage.objects for select to authenticated using (
  bucket_id = 'lms-material-ingest' and private.can_manage_lms_material_storage(bucket_id, name, auth.uid())
);
drop policy if exists "LMS material preview learner read" on storage.objects;
create policy "LMS material originals service only" on storage.objects for select to service_role using (bucket_id = 'lms-material-originals');
create policy "LMS material previews service write" on storage.objects for all to service_role using (bucket_id = 'lms-material-previews') with check (bucket_id = 'lms-material-previews');
create policy "LMS material originals service write" on storage.objects for all to service_role using (bucket_id = 'lms-material-originals') with check (bucket_id = 'lms-material-originals');

create or replace function public.load_lms_materials_for_user(
  p_class_id uuid,
  p_from date,
  p_to date
)
returns table(
  placement_id uuid, material_id uuid, version_id uuid, title text,
  description text, target_type text, course_id uuid, class_id uuid,
  occurrence_id uuid, assignment_id uuid, placement_status text,
  release_at timestamptz, expires_at timestamptz, required boolean,
  order_index integer, processing_status text, preview_rendition_id uuid,
  preview_kind text, preview_mime_type text, page_count integer,
  page_number integer, watermark_learner_label text, watermark_class_label text,
  native_document jsonb, access_state text, lock_reasons text[]
)
language sql stable security definer set search_path = public, private as $$
  select p.id, m.id, p.version_id, m.title, m.description, p.target_type,
    p.course_id, p.class_id, p.occurrence_id, p.assignment_id, p.status,
    p.release_at, p.expires_at, p.required, p.order_index, v.processing_status,
    preview.id, preview.rendition_kind, preview.mime_type,
    nullif((preview.metadata ->> 'pageCount'), '')::integer, preview.page_number,
    coalesce(nullif(btrim(profile.display_name), ''), 'Learner'), c.title,
    case when v.processing_status = 'ready' and private.lms_material_version_rights_approved(v.id)
      and (p.release_at is null or p.release_at <= now()) and (p.expires_at is null or p.expires_at > now())
      and private.lms_material_placement_unlocks_satisfied(p.id, auth.uid()) then v.native_document else null end,
    case when v.processing_status <> 'ready' or preview.id is null then 'processing'
      when p.release_at is not null and p.release_at > now() then 'locked'
      when p.expires_at is not null and p.expires_at <= now() then 'locked'
      when not private.lms_material_version_rights_approved(v.id) then 'locked'
      when not private.lms_material_placement_unlocks_satisfied(p.id, auth.uid()) then 'locked'
      else 'available' end,
    array_remove(array[
      case when v.processing_status <> 'ready' or preview.id is null then 'processing' end,
      case when p.release_at is not null and p.release_at > now() then 'not_released' end,
      case when p.expires_at is not null and p.expires_at <= now() then 'expired' end,
      case when not private.lms_material_version_rights_approved(v.id) then 'rights_not_approved' end,
      case when not private.lms_material_placement_unlocks_satisfied(p.id, auth.uid()) then 'unlock_requirements' end
    ]::text[], null)
  from public.lms_material_placements p
  join public.lms_materials m on m.id = p.material_id
  join public.lms_material_versions v on v.id = p.version_id
  join public.classes c on c.id = p_class_id and c.club_id = m.club_id and c.program_type = m.program_type
  left join public.profiles profile on profile.id = auth.uid()
  left join lateral (select r.* from public.lms_material_renditions r where r.version_id = v.id and r.rendition_kind <> 'original' and r.bucket_id = 'lms-material-previews' and r.processing_status = 'ready' order by r.sort_order, r.page_number nulls first, r.id limit 1) preview on true
  where p.status = 'published' and m.status = 'published'
    and (p.target_type = 'class' and p.class_id = p_class_id
      or p.target_type = 'course' and exists (select 1 from public.class_course_assignments cca where cca.class_id = p_class_id and cca.course_id = p.course_id)
      or p.target_type = 'occurrence' and exists (select 1 from public.lms_lesson_occurrences o where o.id = p.occurrence_id and o.class_id = p_class_id and o.published_at is not null and o.status <> 'cancelled' and (p_from is null or o.occurrence_date >= p_from) and (p_to is null or o.occurrence_date <= p_to))
      or p.target_type = 'assignment' and exists (select 1 from public.club_assignments a where a.id = p.assignment_id and a.class_id = p_class_id))
    and (private.can_manage_lms_material(m.id, auth.uid()) or (
      exists (select 1 from public.class_memberships cm where cm.class_id = p_class_id and cm.user_id = auth.uid() and cm.member_role = 'student' and cm.status = 'active')
      and (p.audience_mode = 'all' or exists (select 1 from public.lms_material_audiences audience where audience.placement_id = p.id and audience.class_id = p_class_id and audience.user_id = auth.uid() and audience.status = 'active'))
    ))
  order by p.release_at nulls first, p.occurrence_id nulls first, p.order_index, p.id;
$$;
revoke all on function public.load_lms_materials_for_user(uuid, date, date) from public, anon;
grant execute on function public.load_lms_materials_for_user(uuid, date, date) to authenticated;

create or replace function public.prepare_lms_material_upload(p_input jsonb)
returns jsonb language plpgsql security definer set search_path = public, private as $$
declare
  uid uuid := auth.uid(); c uuid := (p_input->>'clubId')::uuid; class_key uuid := coalesce(nullif(p_input->>'scopeClassId', ''), nullif(p_input->>'classId', ''))::uuid;
  material_key uuid; version_key uuid; idem text; filename text; safe_name text;
  mime text := nullif(btrim(p_input->>'mimeType'), ''); size_key bigint := (p_input->>'sizeBytes')::bigint; path text;
begin
  if uid is null or c is null then raise exception 'LMS_MATERIAL_UPLOAD_INPUT_INVALID'; end if;
  idem := 'lms-material:' || c::text || ':' || uid::text || ':' || coalesce(nullif(btrim(p_input->>'idempotencyKey'), ''), gen_random_uuid()::text);
  if class_key is null then
    if not private.can_manage_lms_material_club(c, uid) then raise exception 'FORBIDDEN'; end if;
    if nullif(p_input->>'programType', '') not in ('ielts', 'debate', 'public_speaking') then raise exception 'LMS_MATERIAL_PROGRAM_REQUIRED'; end if;
  elsif not exists (select 1 from public.classes cl where cl.id = class_key and cl.club_id = c and private.can_manage_class(cl.id, uid)) then
    raise exception 'FORBIDDEN';
  end if;
  if size_key is null or size_key <= 0 or size_key > 104857600 or mime is null then raise exception 'LMS_MATERIAL_FILE_INVALID'; end if;
  if mime not in ('application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'text/plain', 'image/png', 'image/jpeg', 'image/webp', 'audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/x-wav') then raise exception 'LMS_MATERIAL_MIME_INVALID'; end if;
  if mime not like 'audio/%' and size_key > 26214400 then raise exception 'LMS_MATERIAL_SIZE_INVALID'; end if;
  filename := coalesce(nullif(btrim(p_input->>'fileName'), ''), 'material.bin');
  safe_name := regexp_replace(regexp_replace(filename, '[^A-Za-z0-9._-]', '_', 'g'), '^\.+', '');
  safe_name := left(coalesce(nullif(safe_name, ''), 'material.bin'), 160);
  select v.id, v.material_id, v.ingest_path into version_key, material_key, path
  from public.lms_material_versions v where v.idempotency_key = idem;
  if version_key is not null then
    if not exists (
      select 1 from public.lms_material_versions v join public.lms_materials m on m.id = v.material_id
      where v.id = version_key and v.created_by = uid and m.club_id = c
        and v.source_mime_type = mime and v.size_bytes = size_key
    ) then raise exception 'LMS_MATERIAL_IDEMPOTENCY_CONFLICT'; end if;
    return jsonb_build_object('materialId', material_key, 'versionId', version_key, 'bucketId', 'lms-material-ingest', 'storagePath', path, 'mimeType', mime, 'sizeBytes', size_key);
  end if;
  material_key := gen_random_uuid(); version_key := gen_random_uuid();
  insert into public.lms_materials(id, club_id, scope_class_id, program_type, title, material_kind, status, created_by, updated_by)
  select material_key, c, class_key, cl.program_type, coalesce(nullif(btrim(p_input->>'title'), ''), safe_name),
    case when mime like 'audio/%' then 'audio' else 'file' end, 'draft', uid, uid
  from public.classes cl where cl.id = class_key
  union all
  select material_key, c, null, nullif(p_input->>'programType', ''), coalesce(nullif(btrim(p_input->>'title'), ''), safe_name),
    case when mime like 'audio/%' then 'audio' else 'file' end, 'draft', uid, uid
  where class_key is null;
  path := c::text || '/' || material_key::text || '/' || uid::text || '/' || version_key::text || '/' || safe_name;
  insert into public.lms_material_versions(id, material_id, version_number, idempotency_key, processing_status, ingest_bucket, ingest_path, source_file_name, source_mime_type, size_bytes, created_by)
  values (version_key, material_key, 1, idem, 'uploading', 'lms-material-ingest', path, safe_name, mime, size_key, uid);
  return jsonb_build_object('materialId', material_key, 'versionId', version_key, 'bucketId', 'lms-material-ingest', 'storagePath', path, 'mimeType', mime, 'sizeBytes', size_key);
end;
$$;

create or replace function public.lms_place_material(p_input jsonb)
returns jsonb language plpgsql security definer set search_path = public, private as $$
declare uid uuid := auth.uid(); mid uuid := (p_input->>'materialId')::uuid; vid uuid := (p_input->>'versionId')::uuid; typ text := p_input->>'targetType'; cid uuid := nullif(p_input->>'classId', '')::uuid; course_key uuid := nullif(p_input->>'courseId', '')::uuid; occurrence_key uuid := nullif(p_input->>'occurrenceId', '')::uuid; assignment_key uuid := nullif(p_input->>'assignmentId', '')::uuid; pid uuid := gen_random_uuid(); mclub uuid;
begin
  select club_id into mclub from public.lms_materials where id = mid;
  if uid is null or mclub is null or not exists (select 1 from public.lms_material_versions where id = vid and material_id = mid) then raise exception 'LMS_MATERIAL_INPUT_INVALID'; end if;
  if typ = 'class' and not exists (select 1 from public.classes c where c.id = cid and c.club_id = mclub and private.can_manage_class(c.id, uid)) then raise exception 'FORBIDDEN'; end if;
  if typ = 'course' and (not private.can_manage_lms_material_club(mclub, uid) or not exists (select 1 from public.class_course_assignments cca join public.classes c on c.id = cca.class_id where cca.course_id = course_key and c.club_id = mclub)) then raise exception 'FORBIDDEN'; end if;
  if typ = 'occurrence' and not exists (select 1 from public.lms_lesson_occurrences o where o.id = occurrence_key and private.can_manage_lms_occurrence(o.id, uid)) then raise exception 'FORBIDDEN'; end if;
  if typ = 'assignment' and not exists (select 1 from public.club_assignments a where a.id = assignment_key and a.class_id is not null and private.can_manage_class(a.class_id, uid)) then raise exception 'FORBIDDEN'; end if;
  if jsonb_array_length(coalesce(p_input->'audienceUserIds', '[]'::jsonb)) > 0 and typ <> 'class' then raise exception 'LMS_MATERIAL_AUDIENCE_REQUIRES_CLASS_TARGET'; end if;
  insert into public.lms_material_placements(id, material_id, version_id, club_id, target_type, class_id, course_id, occurrence_id, assignment_id, status, release_at, expires_at, order_index, required, audience_mode, created_by)
  values (pid, mid, vid, mclub, typ, cid, course_key, occurrence_key, assignment_key, coalesce(nullif(p_input->>'status', ''), 'draft'), nullif(p_input->>'releaseAt', '')::timestamptz, nullif(p_input->>'expiresAt', '')::timestamptz, coalesce((p_input->>'orderIndex')::integer, 0), coalesce((p_input->>'required')::boolean, false), case when jsonb_array_length(coalesce(p_input->'audienceUserIds', '[]'::jsonb)) > 0 then 'selected' else 'all' end, uid);
  insert into public.lms_material_audiences(material_id, placement_id, class_id, user_id, added_by)
  select mid, pid, cid, value::uuid, uid from jsonb_array_elements_text(coalesce(p_input->'audienceUserIds', '[]'::jsonb));
  insert into public.lms_material_unlock_rules(material_id, placement_id, rule_kind, occurrence_id, assignment_id, minimum_score, created_by)
  select mid, pid, coalesce(x->>'kind', x->>'ruleKind'), nullif(x->>'occurrenceId', '')::uuid, nullif(x->>'assignmentId', '')::uuid, nullif(x->>'minimumScore', '')::numeric, uid
  from jsonb_array_elements(coalesce(p_input->'rules', '[]'::jsonb)) x;
  return jsonb_build_object('placementId', pid, 'materialId', mid, 'versionId', vid);
end;
$$;

create or replace function public.lms_set_material_audience(p_placement_id uuid, p_class_id uuid, p_user_ids uuid[])
returns integer language plpgsql security definer set search_path = public, private as $$
declare uid uuid := auth.uid(); mid uuid; n integer;
begin
  select p.material_id into mid from public.lms_material_placements p
  where p.id = p_placement_id and (
    (p.target_type = 'class' and p.class_id = p_class_id)
    or (p.target_type = 'course' and exists (select 1 from public.class_course_assignments cca where cca.class_id = p_class_id and cca.course_id = p.course_id))
    or (p.target_type = 'occurrence' and exists (select 1 from public.lms_lesson_occurrences o where o.id = p.occurrence_id and o.class_id = p_class_id))
    or (p.target_type = 'assignment' and exists (select 1 from public.club_assignments a where a.id = p.assignment_id and a.class_id = p_class_id))
  );
  if mid is null or not private.can_manage_lms_material_placement(p_placement_id, uid) then raise exception 'FORBIDDEN'; end if;
  delete from public.lms_material_audiences where placement_id = p_placement_id;
  update public.lms_material_placements set audience_mode = 'selected', updated_at = now() where id = p_placement_id;
  insert into public.lms_material_audiences(material_id, placement_id, class_id, user_id, added_by)
  select mid, p_placement_id, p_class_id, user_key, uid from unnest(coalesce(p_user_ids, '{}'::uuid[])) user_key;
  get diagnostics n = row_count;
  return n;
end;
$$;

create or replace function public.lms_set_material_unlock_rules(p_placement_id uuid, p_rules jsonb)
returns integer language plpgsql security definer set search_path = public, private as $$
declare uid uuid := auth.uid(); mid uuid; n integer;
begin
  select material_id into mid from public.lms_material_placements where id = p_placement_id;
  if mid is null or not private.can_manage_lms_material_placement(p_placement_id, uid) then raise exception 'FORBIDDEN'; end if;
  delete from public.lms_material_unlock_rules where placement_id = p_placement_id;
  insert into public.lms_material_unlock_rules(material_id, placement_id, rule_kind, occurrence_id, assignment_id, minimum_score, created_by)
  select mid, p_placement_id, coalesce(x->>'kind', x->>'ruleKind'), nullif(x->>'occurrenceId', '')::uuid, nullif(x->>'assignmentId', '')::uuid, nullif(x->>'minimumScore', '')::numeric, uid
  from jsonb_array_elements(coalesce(p_rules, '[]'::jsonb)) x;
  get diagnostics n = row_count;
  return n;
end;
$$;

create or replace function public.lms_set_material_rights(p_material_id uuid, p_version_id uuid, p_rights jsonb)
returns boolean language plpgsql security definer set search_path = public, private as $$
declare uid uuid := auth.uid(); m public.lms_materials%rowtype; basis text := p_rights->>'basis'; provenance text := nullif(btrim(coalesce(p_rights->>'sourceUrl', p_rights->>'notes')), ''); now_key timestamptz := now();
begin
  select * into m from public.lms_materials where id = p_material_id;
  if not found or not exists (select 1 from public.lms_material_versions where id = p_version_id and material_id = p_material_id) then raise exception 'LMS_MATERIAL_INPUT_INVALID'; end if;
  if uid is null or basis not in ('original', 'commercial_license', 'open_license', 'internal_adaptation') then raise exception 'LMS_MATERIAL_RIGHTS_INVALID'; end if;
  if basis = 'original' and (m.created_by <> uid or not private.can_manage_lms_material(p_material_id, uid)) then raise exception 'RIGHTS_ORIGINAL_REQUIRES_CREATOR'; end if;
  if basis <> 'original' and not private.can_manage_lms_material_club(m.club_id, uid) then raise exception 'RIGHTS_APPROVAL_REQUIRES_OWNER'; end if;
  if p_rights->>'sourceUrl' is not null and p_rights->>'sourceUrl' !~* '^https://' then raise exception 'LMS_MATERIAL_HTTPS_REQUIRED'; end if;
  if p_rights->>'licenseUrl' is not null and p_rights->>'licenseUrl' !~* '^https://' then raise exception 'LMS_MATERIAL_HTTPS_REQUIRED'; end if;
  if provenance is null and basis = 'original' then provenance := 'Original work attested by creator.'; end if;
  if provenance is null then raise exception 'LMS_MATERIAL_PROVENANCE_REQUIRED'; end if;
  insert into public.lms_material_rights_approvals(material_id, version_id, decision, basis, provenance, rights_holder, license_name, evidence_url, evidence_note, expires_at, reviewer_id, reviewed_at)
  values (p_material_id, p_version_id, 'approved', basis, provenance, p_rights->>'rightsHolder', p_rights->>'licenseUrl', p_rights->>'sourceUrl', p_rights->>'notes', null, uid, now_key);
  update public.lms_materials set rights_basis = basis, rights_provenance = provenance, rights_holder = p_rights->>'rightsHolder', rights_license = p_rights->>'licenseUrl', rights_approved_by = uid, rights_approved_at = now_key, rights_review_note = p_rights->>'notes', updated_by = uid, updated_at = now_key where id = p_material_id;
  return true;
end;
$$;

create or replace function public.lms_publish_material(p_material_id uuid, p_placement_id uuid)
returns boolean language plpgsql security definer set search_path = public, private as $$
declare uid uuid := auth.uid();
begin
  if not exists (select 1 from public.lms_materials where id = p_material_id)
    or not private.can_manage_lms_material_placement(p_placement_id, uid) then raise exception 'FORBIDDEN'; end if;
  if not exists (select 1 from public.lms_material_placements p join public.lms_material_versions v on v.id = p.version_id where p.id = p_placement_id and p.material_id = p_material_id and v.processing_status = 'ready' and private.lms_material_version_rights_approved(v.id) and exists (select 1 from public.lms_material_renditions r where r.version_id = v.id and r.rendition_kind <> 'original' and r.bucket_id = 'lms-material-previews' and r.processing_status = 'ready')) then raise exception 'LMS_MATERIAL_NOT_READY'; end if;
  update public.lms_material_placements set status = 'published', updated_at = now() where id = p_placement_id and material_id = p_material_id;
  update public.lms_materials set status = 'published', published_at = coalesce(published_at, now()), updated_by = uid, updated_at = now() where id = p_material_id;
  return true;
end;
$$;

create or replace function public.lms_withdraw_material(p_placement_id uuid, p_reason text)
returns boolean language plpgsql security definer set search_path = public, private as $$
declare uid uuid := auth.uid(); mid uuid;
begin
  select material_id into mid from public.lms_material_placements where id = p_placement_id;
  if mid is null or not private.can_manage_lms_material_placement(p_placement_id, uid) or nullif(btrim(p_reason), '') is null then raise exception 'FORBIDDEN_OR_REASON_REQUIRED'; end if;
  update public.lms_material_placements set status = 'withdrawn', updated_at = now() where id = p_placement_id;
  insert into public.lms_material_audit_events(material_id, entity_type, entity_id, action, actor_id, reason, after_state) values (mid, 'placement', p_placement_id, 'withdrawn', uid, btrim(p_reason), jsonb_build_object('status', 'withdrawn'));
  return true;
end;
$$;

create or replace function public.lms_list_materials_manager(
  p_class_id uuid default null,
  p_course_id uuid default null,
  p_status text default null,
  p_cursor text default null,
  p_limit integer default 50
)
returns table(id uuid, version_id uuid, title text, description text, processing_status text, version_number integer, created_at timestamptz, updated_at timestamptz, placements jsonb)
language sql stable security definer set search_path = public, private as $$
  select m.id, v.id, m.title, m.description, v.processing_status, v.version_number, m.created_at, m.updated_at,
    coalesce((select jsonb_agg(to_jsonb(p) order by p.release_at nulls last, p.order_index, p.id) from public.lms_material_placements p where p.material_id = m.id and (p_status is null or p.status = p_status)
      and (p_class_id is null or p.class_id = p_class_id or exists (select 1 from public.lms_lesson_occurrences o where o.id = p.occurrence_id and o.class_id = p_class_id) or exists (select 1 from public.club_assignments a where a.id = p.assignment_id and a.class_id = p_class_id) or exists (select 1 from public.class_course_assignments cca where cca.class_id = p_class_id and cca.course_id = p.course_id))), '[]'::jsonb)
  from public.lms_materials m
  join lateral (select x.* from public.lms_material_versions x where x.material_id = m.id order by x.version_number desc, x.id desc limit 1) v on true
  where (p_cursor is null or (p_cursor ~ '^[-0-9TZ:.+]+$' and m.updated_at < p_cursor::timestamptz))
    and private.can_manage_lms_material(m.id, auth.uid())
    and (p_class_id is null or exists (select 1 from public.lms_material_placements p where p.material_id = m.id and (p.class_id = p_class_id or exists (select 1 from public.lms_lesson_occurrences o where o.id = p.occurrence_id and o.class_id = p_class_id) or exists (select 1 from public.club_assignments a where a.id = p.assignment_id and a.class_id = p_class_id) or exists (select 1 from public.class_course_assignments cca where cca.class_id = p_class_id and cca.course_id = p.course_id))) )
    and (p_course_id is null or exists (select 1 from public.lms_material_placements p where p.material_id = m.id and p.course_id = p_course_id))
  order by m.updated_at desc, m.id desc
  limit greatest(1, least(coalesce(p_limit, 50), 100));
$$;

revoke all on function public.can_access_lms_material_preview(uuid, uuid, uuid) from public, anon;
grant execute on function public.can_access_lms_material_preview(uuid, uuid, uuid) to authenticated;
revoke all on function public.prepare_lms_material_upload(jsonb) from public, anon;
grant execute on function public.prepare_lms_material_upload(jsonb) to authenticated;
revoke all on function public.lms_place_material(jsonb) from public, anon;
grant execute on function public.lms_place_material(jsonb) to authenticated;
revoke all on function public.lms_set_material_audience(uuid, uuid, uuid[]) from public, anon;
grant execute on function public.lms_set_material_audience(uuid, uuid, uuid[]) to authenticated;
revoke all on function public.lms_set_material_unlock_rules(uuid, jsonb) from public, anon;
grant execute on function public.lms_set_material_unlock_rules(uuid, jsonb) to authenticated;
revoke all on function public.lms_set_material_rights(uuid, uuid, jsonb) from public, anon;
grant execute on function public.lms_set_material_rights(uuid, uuid, jsonb) to authenticated;
revoke all on function public.lms_publish_material(uuid, uuid) from public, anon;
grant execute on function public.lms_publish_material(uuid, uuid) to authenticated;
revoke all on function public.lms_withdraw_material(uuid, text) from public, anon;
grant execute on function public.lms_withdraw_material(uuid, text) to authenticated;
revoke all on function public.lms_list_materials_manager(uuid, uuid, text, text, integer) from public, anon;
grant execute on function public.lms_list_materials_manager(uuid, uuid, text, text, integer) to authenticated;
revoke all on function private.can_manage_lms_material_club(uuid, uuid) from public, anon, authenticated;
revoke all on function private.can_manage_lms_material(uuid, uuid) from public, anon, authenticated;
revoke all on function private.can_manage_lms_material_placement(uuid, uuid) from public, anon, authenticated;
revoke all on function private.can_read_lms_material(uuid, uuid) from public, anon, authenticated;
revoke all on function private.can_read_lms_material_storage(uuid, text, uuid) from public, anon, authenticated;
revoke all on function private.can_manage_lms_material_storage(text, text, uuid) from public, anon, authenticated;
revoke all on function private.validate_lms_material_placement() from public, anon, authenticated;
revoke all on function private.validate_lms_material_audience() from public, anon, authenticated;
revoke all on function private.validate_lms_material_unlock_rule() from public, anon, authenticated;
revoke all on function private.enforce_lms_material_publish_rights() from public, anon, authenticated;
revoke all on function private.audit_lms_material_change() from public, anon, authenticated;
commit;
