begin;
select plan(35);
select has_table('public', 'lms_operation_receipts', 'live LMS operations have idempotency receipts');
select has_table('public', 'lms_operation_audit_events', 'live LMS operations have immutable audit events');
select has_function('public', 'teacher_workspace_reschedule', ARRAY['uuid','date','date','time without time zone','time without time zone','text','timestamp with time zone','text'], 'schedule reschedule RPC exists');
select has_function('public', 'teacher_workspace_set_occurrence_state', ARRAY['uuid','text','timestamp with time zone','text'], 'occurrence state RPC exists');
select has_function('public', 'teacher_workspace_plan_lesson', ARRAY['jsonb'], 'lesson planning RPC exists');
select has_function('public', 'teacher_workspace_publish_assignment', ARRAY['uuid','timestamp with time zone','text'], 'assignment publication RPC exists');
select has_function('public', 'teacher_workspace_correct_attendance', ARRAY['uuid','uuid','text','text','text'], 'attendance correction RPC exists');
select has_function('public', 'teacher_workspace_publish_announcement', ARRAY['jsonb'], 'announcement RPC exists');
select has_function('public', 'load_student_lms_week', ARRAY['uuid','date','date'], 'subject-neutral student week RPC exists');
select has_function('public', 'mark_lms_notification_read', ARRAY['uuid'], 'notification read RPC exists');
select has_function('public', 'teacher_workspace_grade_homework', ARRAY['uuid','numeric','numeric','text','jsonb','timestamp with time zone','text'], 'gradebook update RPC exists');
select has_function('public', 'teacher_workspace_place_material', ARRAY['jsonb'], 'material placement RPC exists');
select has_function('public', 'teacher_workspace_publish_material', ARRAY['uuid','uuid','text'], 'material publication RPC exists');
select has_function('public', 'load_student_lms_week', ARRAY['uuid','date','date'], 'student week includes subject-neutral contract');
select has_trigger('public', 'lms_operation_audit_events', 'lms_operation_audit_immutable', 'audit mutation is denied');
select has_function('public', 'head_teacher_override_publish_ielts_review', ARRAY['uuid','text','text'], 'head teacher emergency publish RPC exists');
select has_function('public', 'head_teacher_override_return_ielts_review', ARRAY['uuid','text','text','text'], 'head teacher emergency return RPC exists');
select has_function('public', 'load_teacher_review_queue_v2', ARRAY['uuid','timestamp with time zone','integer'], 'union review queue exists');
select has_function('public', 'load_teacher_review_queue_v2', ARRAY['uuid','timestamp with time zone','uuid','integer'], 'deterministic review queue cursor exists');
select has_function('private', 'lms_head_teacher_review_override', ARRAY['uuid','uuid'], 'review override helper exists');
select has_trigger('public', 'lms_operation_audit_events', 'lms_operation_audit_immutable', 'operation audit is immutable');
select ok(position('SCHEDULE_NOT_IN_CLASS' in pg_get_functiondef('public.teacher_workspace_plan_lesson(jsonb)'::regprocedure)) > 0, 'lesson planning validates exact schedule');
select ok(position('LESSON_NOT_IN_COURSE' in pg_get_functiondef('public.teacher_workspace_plan_lesson(jsonb)'::regprocedure)) > 0, 'lesson planning validates course lesson boundary');
select ok(position('ACTIVITY_NOT_IN_COURSE' in pg_get_functiondef('public.teacher_workspace_plan_lesson(jsonb)'::regprocedure)) > 0, 'lesson planning validates course activity boundary');
select ok(position('INVALID_PLAN_TIME' in pg_get_functiondef('public.teacher_workspace_plan_lesson(jsonb)'::regprocedure)) > 0, 'lesson planning validates time range');
select ok(position('c.teacher_user_id = p_user_id' in pg_get_functiondef('private.is_assigned_class_teacher(uuid,uuid)'::regprocedure)) > 0, 'review teacher must be class lead');
select ok(position('head_teacher' in pg_get_functiondef('private.is_assigned_class_teacher(uuid,uuid)'::regprocedure)) > 0
  and position('teacher' in pg_get_functiondef('private.is_assigned_class_teacher(uuid,uuid)'::regprocedure)) > 0
  and position('coach' in pg_get_functiondef('private.is_assigned_class_teacher(uuid,uuid)'::regprocedure)) > 0,
  'review teacher requires active academic organization role');

-- The organization RPCs are re-bound by the live-operations migration after
-- head_teacher capability helpers are installed. These executable catalog
-- checks prevent a later migration from silently regressing to org-admin-only
-- guards or broadening a non-academic operation.
select ok(position('organization_can_academic_admin' in pg_get_functiondef('public.create_organization_class_transaction(uuid,uuid,text,text,text,text,text,text,date,date,text,text,integer,text,uuid)'::regprocedure)) > 0, 'class creation uses academic capability');
select ok(position('organization_can_academic_admin' in pg_get_functiondef('public.assign_organization_teacher_transaction(uuid,uuid,uuid,text,text,uuid)'::regprocedure)) > 0, 'teacher assignment uses academic capability');
select ok(position('role in (''teacher'', ''coach'', ''head_teacher'')' in pg_get_functiondef('public.assign_organization_teacher_transaction(uuid,uuid,uuid,text,text,uuid)'::regprocedure)) > 0, 'teacher assignment accepts only active academic roles');
select ok(position('organization_can_academic_admin' in pg_get_functiondef('public.assign_organization_course_transaction(uuid,uuid,uuid,text,text,uuid)'::regprocedure)) > 0, 'course assignment uses academic capability');
select ok(position('club_id is null or club_id = p_organization_id' in pg_get_functiondef('public.assign_organization_course_transaction(uuid,uuid,uuid,text,text,uuid)'::regprocedure)) > 0, 'course assignment is organization scoped');
select ok(position('is_published = true' in pg_get_functiondef('public.assign_organization_course_transaction(uuid,uuid,uuid,text,text,uuid)'::regprocedure)) > 0, 'global course assignment requires publication');
select ok(position('organization_can_academic_admin' in pg_get_functiondef('public.assign_organization_material_transaction(uuid,uuid,uuid,text,uuid)'::regprocedure)) > 0, 'material assignment uses academic capability');
select ok(position('processing_status = ''ready''' in pg_get_functiondef('public.assign_organization_material_transaction(uuid,uuid,uuid,text,uuid)'::regprocedure)) > 0, 'material assignment requires ready version');
select * from finish();
rollback;
