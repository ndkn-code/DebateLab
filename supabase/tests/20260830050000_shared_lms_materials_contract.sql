-- Shared LMS materials contract and isolation checks.
begin;
select plan(21);

select has_table('public', 'lms_materials', 'versioned shared materials table exists');
select has_table('public', 'lms_material_versions', 'material versions table exists');
select has_table('public', 'lms_material_renditions', 'material renditions table exists');
select has_table('public', 'lms_material_placements', 'exact placement table exists');
select has_table('public', 'lms_material_audiences', 'selected audience table exists');
select has_table('public', 'lms_material_unlock_rules', 'AND unlock rule table exists');
select ok(to_regprocedure('public.lms_review_material_content(uuid,uuid,text,text)') is not null, 'content review RPC exists');
select ok(exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'lms_material_versions' and column_name = 'content_review_status'), 'versioned content review status exists');
select ok(exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'lms_material_placements' and column_name = 'source_assignment_id'), 'placement compatibility column exists');

do $$
begin
  if not exists (select 1 from pg_class where oid = 'public.lms_materials'::regclass and relrowsecurity) then
    raise exception 'lms_materials RLS is disabled';
  end if;
  if not exists (select 1 from pg_class where oid = 'public.lms_material_renditions'::regclass and relrowsecurity) then
    raise exception 'lms_material_renditions RLS is disabled';
  end if;
  if has_table_privilege('authenticated', 'public.lms_material_versions', 'select') then
    raise exception 'authenticated clients must not read version/original paths directly';
  end if;
  if has_table_privilege('authenticated', 'public.lms_material_renditions', 'select') then
    raise exception 'authenticated clients must use preview access RPC, not rendition paths';
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.lms_material_placements'::regclass
      and contype = 'c'
      and lower(pg_get_constraintdef(oid)) like '%class%'
      and lower(pg_get_constraintdef(oid)) like '%occurrence%'
      and lower(pg_get_constraintdef(oid)) like '%assignment%'
  ) then
    raise exception 'placement target enum is not exact class/course/occurrence/assignment';
  end if;
  if to_regprocedure('public.load_lms_materials_for_user(uuid,date,date)') is null
     or to_regprocedure('public.can_access_lms_material_preview(uuid,uuid,uuid)') is null then
    raise exception 'stable learner material read contract is missing';
  end if;
  if exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'LMS material preview learner read') then
    raise exception 'learners must not read preview storage paths directly';
  end if;
end;
$$;

select pass('shared LMS material authorization and storage contract is satisfied');

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
values
  ('10000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'materials-owner@example.test', 'x', now(), now(), now(), '{}', '{}'),
  ('10000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'materials-a@example.test', 'x', now(), now(), now(), '{}', '{}'),
  ('10000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'materials-b@example.test', 'x', now(), now(), now(), '{}', '{}');

update public.profiles set role = case when id = '10000000-0000-0000-0000-000000000001' then 'teacher' else 'student' end,
  display_name = case id when '10000000-0000-0000-0000-000000000002' then 'Learner A' else 'Learner B' end
where id::text like '10000000-0000-0000-0000-%';

insert into public.clubs (id, code, name, owner_user_id, status) values
  ('10000000-0000-0000-0000-000000000101', 'MAT-A', 'Materials A', '10000000-0000-0000-0000-000000000001', 'active'),
  ('10000000-0000-0000-0000-000000000102', 'MAT-B', 'Materials B', null, 'active');
insert into public.club_memberships (club_id, user_id, role, status, joined_at) values
  ('10000000-0000-0000-0000-000000000101', '10000000-0000-0000-0000-000000000001', 'owner', 'active', now());
insert into public.classes (id, club_id, code, title, status, grade_level, program_type, created_by) values
  ('10000000-0000-0000-0000-000000000201', '10000000-0000-0000-0000-000000000101', 'MAT-A1', 'Materials Class A', 'active', 'Band 5-6', 'ielts', '10000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000202', '10000000-0000-0000-0000-000000000102', 'MAT-B1', 'Materials Class B', 'active', 'Band 5-6', 'ielts', '10000000-0000-0000-0000-000000000001');
insert into public.class_memberships (class_id, user_id, member_role, status, joined_at, created_by) values
  ('10000000-0000-0000-0000-000000000201', '10000000-0000-0000-0000-000000000002', 'student', 'active', now(), '10000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000202', '10000000-0000-0000-0000-000000000003', 'student', 'active', now(), '10000000-0000-0000-0000-000000000001');

insert into public.lms_materials (id, club_id, scope_class_id, program_type, title, material_kind, status, rights_basis, rights_provenance, rights_approved_by, rights_approved_at, created_by)
values ('10000000-0000-0000-0000-000000000301', '10000000-0000-0000-0000-000000000101', '10000000-0000-0000-0000-000000000201', 'ielts', 'Published handout', 'file', 'draft', 'original', 'Original work attested by creator.', '10000000-0000-0000-0000-000000000001', now(), '10000000-0000-0000-0000-000000000001');
insert into public.lms_material_versions (id, material_id, version_number, processing_status, content_review_status, detected_mime_type, size_bytes, sha256, source_file_name, created_by)
values ('10000000-0000-0000-0000-000000000401', '10000000-0000-0000-0000-000000000301', 1, 'uploading', 'approved', 'application/pdf', 100, repeat('a', 64), 'handout.pdf', '10000000-0000-0000-0000-000000000001');
insert into public.lms_material_renditions (id, version_id, rendition_kind, processing_status, bucket_id, storage_path, mime_type, size_bytes, sha256)
values ('10000000-0000-0000-0000-000000000501', '10000000-0000-0000-0000-000000000401', 'pdf_preview', 'ready', 'lms-material-previews', '10000000-0000-0000-0000-000000000301/10000000-0000-0000-0000-000000000401/preview.pdf', 'application/pdf', 100, repeat('b', 64));
update public.lms_material_versions set processing_status = 'ready' where id = '10000000-0000-0000-0000-000000000401';
insert into public.lms_material_rights_approvals (material_id, version_id, decision, basis, provenance, reviewer_id)
values ('10000000-0000-0000-0000-000000000301', '10000000-0000-0000-0000-000000000401', 'approved', 'original', 'Original work attested by creator.', '10000000-0000-0000-0000-000000000001');
insert into public.lms_material_placements (id, material_id, version_id, club_id, target_type, class_id, status, created_by)
values ('10000000-0000-0000-0000-000000000601', '10000000-0000-0000-0000-000000000301', '10000000-0000-0000-0000-000000000401', '10000000-0000-0000-0000-000000000101', 'class', '10000000-0000-0000-0000-000000000201', 'published', '10000000-0000-0000-0000-000000000001');
update public.lms_materials set status = 'published', published_at = now() where id = '10000000-0000-0000-0000-000000000301';

set local role authenticated;
set local request.jwt.claim.sub = '10000000-0000-0000-0000-000000000001';
select ok(public.lms_review_material_content('10000000-0000-0000-0000-000000000301', '10000000-0000-0000-0000-000000000401', 'rejected', 'Preview needs correction.'), 'authorized manager may reject a converted version');
set local role postgres;
select is((select content_review_status from public.lms_material_versions where id = '10000000-0000-0000-0000-000000000401'), 'rejected', 'content review decision is stored on the exact version');
set local role authenticated;
set local request.jwt.claim.sub = '10000000-0000-0000-0000-000000000001';
select ok(public.lms_review_material_content('10000000-0000-0000-0000-000000000301', '10000000-0000-0000-0000-000000000401', 'approved', 'Corrected preview reviewed.'), 'authorized manager may approve the exact converted version');

set local request.jwt.claim.sub = '10000000-0000-0000-0000-000000000002';
select is((select count(*)::integer from public.load_lms_materials_for_user('10000000-0000-0000-0000-000000000201', current_date - 7, current_date + 7)), 1, 'active exact-class learner receives published material metadata');
select ok(public.can_access_lms_material_preview('10000000-0000-0000-0000-000000000601', '10000000-0000-0000-0000-000000000401', '10000000-0000-0000-0000-000000000501'), 'active exact-class learner may request the pinned sanitized preview');
select throws_ok($$ select count(*) from public.lms_material_renditions $$, '42501', null, 'authenticated learner cannot read rendition paths directly');
select throws_ok($$ select count(*) from storage.objects where bucket_id = 'lms-material-previews' $$, '42501', null, 'authenticated learner cannot enumerate preview objects');

set local request.jwt.claim.sub = '10000000-0000-0000-0000-000000000003';
select is((select count(*)::integer from public.load_lms_materials_for_user('10000000-0000-0000-0000-000000000201', current_date - 7, current_date + 7)), 0, 'other-organization learner cannot read Class A material metadata');
select is(public.can_access_lms_material_preview('10000000-0000-0000-0000-000000000601', '10000000-0000-0000-0000-000000000401', '10000000-0000-0000-0000-000000000501'), false, 'other-organization learner cannot authorize the preview');

set local role postgres;
update public.class_memberships set status = 'removed', removed_at = now() where class_id = '10000000-0000-0000-0000-000000000201' and user_id = '10000000-0000-0000-0000-000000000002';
set local role authenticated;
set local request.jwt.claim.sub = '10000000-0000-0000-0000-000000000002';
select is((select count(*)::integer from public.load_lms_materials_for_user('10000000-0000-0000-0000-000000000201', current_date - 7, current_date + 7)), 0, 'removed learner loses material metadata');
select is(public.can_access_lms_material_preview('10000000-0000-0000-0000-000000000601', '10000000-0000-0000-0000-000000000401', '10000000-0000-0000-0000-000000000501'), false, 'removed learner loses preview authorization');
rollback;
