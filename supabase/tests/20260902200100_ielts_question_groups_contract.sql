-- Run after 20260902200300_ielts_question_media_bucket.sql.
begin;

select plan(12);

select has_table('public', 'ielts_question_groups', 'Question groups table exists');
select has_column('public', 'ielts_question_groups', 'stimulus', 'Groups carry a stimulus payload');
select has_column('public', 'ielts_question_groups', 'any_order', 'Groups carry the IN ANY ORDER flag');
select col_is_unique('public', 'ielts_question_groups', array['test_id', 'group_key'], 'One group per key per test');

select ok(
  (select relrowsecurity from pg_class where oid = 'public.ielts_question_groups'::regclass),
  'RLS is enabled on question groups'
);
select ok(
  exists (
    select 1 from pg_policies
     where schemaname = 'public' and tablename = 'ielts_question_groups'
       and policyname = 'IELTS question groups are viewable when published'
  ),
  'Learners read groups only for published tests'
);

select has_table('public', 'ielts_attempt_question_group_blueprints', 'Attempt group snapshot table exists');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.ielts_attempt_question_group_blueprints'::regclass),
  'RLS is enabled on attempt group snapshots'
);
select ok(
  exists (
    select 1 from pg_trigger
     where tgrelid = 'public.ielts_attempt_question_group_blueprints'::regclass
       and tgname = 'ielts_attempt_group_blueprint_immutable'
  ),
  'Attempt group snapshots are append-only'
);
select ok(
  position('ielts_attempt_question_group_blueprints' in lower(pg_get_functiondef(
    'public.ielts_create_attempt_with_blueprint(uuid,uuid,public.ielts_module,integer,jsonb,uuid,uuid,uuid)'::regprocedure
  ))) > 0,
  'Attempt creation freezes referenced groups'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.ielts_create_attempt_with_blueprint(uuid,uuid,public.ielts_module,integer,jsonb,uuid,uuid,uuid)',
    'execute'
  ),
  'Attempt creation stays service-role only'
);

select ok(
  exists (select 1 from storage.buckets where id = 'ielts-question-media' and public),
  'Question media bucket is public-read'
);

select * from finish();
rollback;
