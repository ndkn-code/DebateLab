create or replace function public.save_class_attendance_transaction(
  p_class_id uuid,
  p_course_id uuid,
  p_session_date date,
  p_title text,
  p_notes text,
  p_records jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, private
as $$
declare
  uid uuid := auth.uid();
  v_session_id uuid;
  v_occurrence_id uuid;
  v_occurrence_ids uuid[];
  record_row record;
  record_user uuid;
  record_status text;
begin
  if uid is null or not private.can_manage_class(p_class_id, uid) then raise exception 'FORBIDDEN'; end if;
  if not exists (select 1 from public.classes where id = p_class_id) then raise exception 'CLASS_NOT_FOUND'; end if;
  if not exists (select 1 from public.class_course_assignments where class_id = p_class_id and course_id = p_course_id) then
    raise exception 'COURSE_NOT_ASSIGNED';
  end if;
  if coalesce(jsonb_array_length(p_records), 0) = 0 then raise exception 'ATTENDANCE_RECORDS_REQUIRED'; end if;
  if exists (
    select 1
    from (
      select value->>'userId' as user_id
      from jsonb_array_elements(p_records)
    ) rows
    group by user_id
    having count(*) > 1
  ) then
    raise exception 'DUPLICATE_ATTENDANCE_STUDENT';
  end if;

  select s.id, s.occurrence_id
    into v_session_id, v_occurrence_id
    from public.class_attendance_sessions s
   where s.class_id = p_class_id
     and s.course_id = p_course_id
     and s.session_date = p_session_date
   for update;

  if v_occurrence_id is null or not exists (
    select 1
      from public.lms_lesson_occurrences o
     where o.id = v_occurrence_id
       and o.class_id = p_class_id
       and o.course_id = p_course_id
       and o.occurrence_date = p_session_date
       and o.status <> 'cancelled'
  ) then
    select coalesce(array_agg(o.id order by o.starts_at, o.id), '{}'::uuid[])
      into v_occurrence_ids
      from public.lms_lesson_occurrences o
     where o.class_id = p_class_id
       and o.course_id = p_course_id
       and o.occurrence_date = p_session_date
       and o.status <> 'cancelled';
    if cardinality(v_occurrence_ids) = 0 then raise exception 'ATTENDANCE_OCCURRENCE_REQUIRED'; end if;
    if cardinality(v_occurrence_ids) > 1 then raise exception 'ATTENDANCE_OCCURRENCE_AMBIGUOUS'; end if;
    v_occurrence_id := v_occurrence_ids[1];
  end if;

  insert into public.class_attendance_sessions (
    class_id, course_id, occurrence_id, session_date, title, notes, taken_by, updated_at
  ) values (p_class_id, p_course_id, v_occurrence_id, p_session_date, p_title, p_notes, uid, now())
  on conflict (class_id, course_id, session_date) do update
    set occurrence_id = excluded.occurrence_id,
        title = excluded.title, notes = excluded.notes, taken_by = excluded.taken_by, updated_at = now()
  returning id into v_session_id;

  for record_row in
    select value->>'userId' as user_id, value->>'status' as status, value->>'notes' as notes
    from jsonb_array_elements(p_records)
  loop
    record_user := record_row.user_id::uuid;
    record_status := record_row.status;
    if record_status not in ('present', 'late', 'absent') then raise exception 'INVALID_ATTENDANCE_STATUS'; end if;
    if not exists (
      select 1 from public.class_memberships cm
      where cm.class_id = p_class_id and cm.user_id = record_user
        and cm.member_role = 'student'
        and cm.joined_at::date <= p_session_date
        and (
          cm.status = 'active'
          or (cm.status = 'removed' and cm.removed_at is not null and cm.removed_at::date >= p_session_date)
        )
    ) then raise exception 'ATTENDANCE_STUDENT_NOT_ACTIVE'; end if;
    insert into public.class_attendance_records (session_id, user_id, status, notes, updated_at)
    values (v_session_id, record_user, record_status, record_row.notes, now())
    on conflict (session_id, user_id) do update
      set status = excluded.status, notes = excluded.notes, updated_at = now();
    insert into public.class_attendance_correction_events (
      class_id, session_id, user_id, action, status, notes, recorded_by
    ) values (p_class_id, v_session_id, record_user, 'saved', record_status, record_row.notes, uid);
  end loop;
  perform private.write_class_operation_audit(uid, 'save_class_attendance', p_class_id,
    jsonb_build_object('course_id', p_course_id, 'session_date', p_session_date, 'records', jsonb_array_length(p_records)));
  return v_session_id;
end;
$$;

revoke all on function public.save_class_attendance_transaction(uuid, uuid, date, text, text, jsonb) from public;
grant execute on function public.save_class_attendance_transaction(uuid, uuid, date, text, text, jsonb) to authenticated;
