-- Open the teacher workspace for active IELTS classes without widening access
-- to Debate or Public Speaking classes. Existing explicit flag decisions win;
-- the seed and trigger only create a flag when none exists.
insert into public.lms_pilot_flags (
  club_id,
  class_id,
  feature_key,
  enabled,
  enabled_at,
  metadata
)
select
  c.club_id,
  c.id,
  'teacher_workspace_v2',
  true,
  now(),
  jsonb_build_object(
    'rollout', 'ielts_teacher_workspace_global_v1',
    'scope', 'ielts_class_only'
  )
from public.classes as c
where c.program_type = 'ielts'
  and c.status = 'active'
  and c.club_id is not null
on conflict on constraint lms_pilot_flags_club_id_class_id_feature_key_key
do nothing;

create or replace function private.seed_ielts_teacher_workspace_flag()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.program_type = 'ielts'
    and new.status = 'active'
    and new.club_id is not null then
    insert into public.lms_pilot_flags (
      club_id,
      class_id,
      feature_key,
      enabled,
      enabled_at,
      metadata
    ) values (
      new.club_id,
      new.id,
      'teacher_workspace_v2',
      true,
      now(),
      jsonb_build_object(
        'rollout', 'ielts_teacher_workspace_global_v1',
        'scope', 'ielts_class_only'
      )
    ) on conflict on constraint lms_pilot_flags_club_id_class_id_feature_key_key
      do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists seed_ielts_teacher_workspace_flag on public.classes;
create trigger seed_ielts_teacher_workspace_flag
  after insert on public.classes
  for each row
  when (
    new.program_type = 'ielts'
    and new.status = 'active'
    and new.club_id is not null
  )
  execute function private.seed_ielts_teacher_workspace_flag();

revoke all on function private.seed_ielts_teacher_workspace_flag()
  from public, anon, authenticated;
