-- IELTS skill-drill bank v1.
--
-- Builds the first B2C Reading/Listening drill bank from the four published
-- Academic mocks. The bank is derived, not newly authored: every drill question
-- is a cloned source question + key with source provenance in metadata.

select pg_advisory_xact_lock(hashtext('ielts_skill_drill_bank_v1'));

create temporary table ielts_drill_bank_tags on commit drop as
with source_ranked as (
  select
    q.id,
    count(*) over (partition by q.skill, q.question_type) as type_count,
    ntile(3) over (
      partition by q.skill, q.question_type
      order by t.slug, q.order_index, q.id
    ) as difficulty_tile
  from public.ielts_questions q
  join public.ielts_tests t on t.id = q.test_id
  where t.status = 'published'
    and t.kind = 'full_mock'
    and t.module = 'academic'
    and q.skill in ('listening', 'reading')
),
published_questions as (
  select
    q.id,
    q.skill,
    q.question_type,
    q.metadata,
    sr.type_count,
    sr.difficulty_tile
  from public.ielts_questions q
  join public.ielts_tests t on t.id = q.test_id
  left join source_ranked sr on sr.id = q.id
  where t.status = 'published'
),
first_tags as (
  select
    p.id,
    tag.value as first_tag
  from published_questions p
  left join lateral (
    select value
    from jsonb_array_elements_text(
      case
        when jsonb_typeof(p.metadata -> 'subskill_tags') = 'array'
          then p.metadata -> 'subskill_tags'
        else '[]'::jsonb
      end
    ) with ordinality tags(value, ordinality)
    order by ordinality
    limit 1
  ) tag on true
),
normalized as (
  select
    p.id,
    case
      when p.skill in ('listening', 'reading') then p.skill::text || ':' || p.question_type::text
      when ft.first_tag is not null and length(btrim(ft.first_tag)) > 0 then ft.first_tag
      else p.skill::text || ':' || p.question_type::text
    end as subskill_key,
    case
      when p.type_count >= 15 and p.difficulty_tile = 1 then 'easy'
      when p.type_count >= 15 and p.difficulty_tile = 2 then 'medium'
      when p.type_count >= 15 and p.difficulty_tile = 3 then 'hard'
      when p.metadata ->> 'difficulty' in ('easy', 'medium', 'hard')
        then p.metadata ->> 'difficulty'
      when p.metadata ->> 'difficulty' in ('medium-hard', 'hard-medium')
        then 'hard'
      else 'medium'
    end as difficulty,
    case
      when p.skill in ('listening', 'reading')
        then jsonb_build_array(p.skill::text || ':' || p.question_type::text)
      when jsonb_typeof(p.metadata -> 'subskill_tags') = 'array'
        and jsonb_array_length(p.metadata -> 'subskill_tags') > 0
        then p.metadata -> 'subskill_tags'
      else jsonb_build_array(p.skill::text || ':' || p.question_type::text)
    end as subskill_tags
  from published_questions p
  left join first_tags ft on ft.id = p.id
)
select
  id,
  subskill_key,
  difficulty,
  case difficulty
    when 'easy' then 5.5
    when 'hard' then 7.5
    else 6.5
  end::numeric as difficulty_band_hint,
  subskill_tags
from normalized;

update public.ielts_questions q
set
  metadata = q.metadata || jsonb_build_object(
    'subskill_key', tags.subskill_key,
    'subskill_tags', tags.subskill_tags,
    'difficulty', tags.difficulty,
    'difficulty_band_hint', tags.difficulty_band_hint
  ),
  updated_at = now()
from ielts_drill_bank_tags tags
where tags.id = q.id;

create temporary table ielts_drill_bank_items on commit drop as
with source_questions as (
  select
    q.id as source_question_id,
    q.test_id as source_test_id,
    t.slug as source_test_slug,
    t.module,
    q.passage_id as source_passage_id,
    q.listening_section_id as source_listening_section_id,
    q.skill,
    q.question_type,
    q.order_index as source_order_index,
    q.group_key,
    q.group_instructions,
    q.prompt,
    q.options,
    q.max_points,
    q.word_limit,
    q.visual,
    q.metadata,
    q.metadata ->> 'subskill_key' as subskill_key,
    q.metadata ->> 'difficulty' as difficulty,
    ((q.metadata ->> 'difficulty_band_hint')::numeric) as difficulty_band_hint
  from public.ielts_questions q
  join public.ielts_tests t on t.id = q.test_id
  where t.status = 'published'
    and t.kind = 'full_mock'
    and t.module = 'academic'
    and q.skill in ('listening', 'reading')
),
typed as (
  select
    *,
    count(*) over (partition by skill, question_type) as type_count
  from source_questions
),
eligible as (
  select
    *,
    count(*) over (partition by skill, question_type, difficulty) as difficulty_count,
    row_number() over (
      partition by skill, question_type, difficulty
      order by source_test_slug, source_order_index, source_question_id
    ) as difficulty_rn
  from typed
  where type_count >= 5
    and (
      type_count >= 15
      or question_type in ('mcq_multi', 'sentence_completion')
    )
),
chunked_base as (
  select
    *,
    ceil(difficulty_count / 10.0)::integer as chunk_count
  from eligible
),
chunked as (
  select
    *,
    floor(((difficulty_rn - 1) * chunk_count)::numeric / difficulty_count)::integer + 1
      as chunk_index
  from chunked_base
),
slugs as (
  select
    *,
    'ielts-drill-'
      || skill::text
      || '-'
      || replace(question_type::text, '_', '-')
      || '-'
      || difficulty
      || case when chunk_count > 1 then '-set-' || chunk_index::text else '' end
      as drill_slug
  from chunked
)
select
  md5('ielts_skill_drill_bank_v1:test:' || drill_slug)::uuid as drill_test_id,
  drill_slug,
  source_question_id,
  source_test_id,
  source_test_slug,
  module,
  source_passage_id,
  source_listening_section_id,
  skill,
  question_type,
  source_order_index,
  group_key,
  group_instructions,
  prompt,
  options,
  max_points,
  word_limit,
  visual,
  metadata,
  subskill_key,
  difficulty,
  difficulty_band_hint,
  chunk_index,
  chunk_count,
  row_number() over (
    partition by drill_slug
    order by source_test_slug, source_order_index, source_question_id
  ) - 1 as drill_order_index
from slugs;

create temporary table ielts_drill_bank_tests on commit drop as
select
  drill_test_id,
  drill_slug,
  module,
  skill,
  question_type,
  subskill_key,
  difficulty,
  difficulty_band_hint,
  chunk_index,
  chunk_count,
  count(*) as question_count,
  array_agg(source_question_id order by drill_order_index) as source_question_ids,
  array_agg(distinct source_test_id order by source_test_id) as source_test_ids,
  array_agg(distinct source_test_slug order by source_test_slug) as source_test_slugs
from ielts_drill_bank_items
group by
  drill_test_id,
  drill_slug,
  module,
  skill,
  question_type,
  subskill_key,
  difficulty,
  difficulty_band_hint,
  chunk_index,
  chunk_count;

delete from public.ielts_question_keys k
using public.ielts_questions q
join public.ielts_tests t on t.id = q.test_id
where k.question_id = q.id
  and t.metadata ->> 'generated_by' = 'ielts_skill_drill_bank_v1';

delete from public.ielts_questions q
using public.ielts_tests t
where q.test_id = t.id
  and t.metadata ->> 'generated_by' = 'ielts_skill_drill_bank_v1';

delete from public.listening_sections ls
using public.ielts_tests t
where ls.test_id = t.id
  and t.metadata ->> 'generated_by' = 'ielts_skill_drill_bank_v1';

delete from public.passages p
using public.ielts_tests t
where p.test_id = t.id
  and t.metadata ->> 'generated_by' = 'ielts_skill_drill_bank_v1';

delete from public.audio_assets a
using public.ielts_tests t
where a.test_id = t.id
  and t.metadata ->> 'generated_by' = 'ielts_skill_drill_bank_v1';

delete from public.ielts_tests t
where t.metadata ->> 'generated_by' = 'ielts_skill_drill_bank_v1'
  and not exists (
    select 1
    from ielts_drill_bank_tests planned
    where planned.drill_test_id = t.id
  );

insert into public.ielts_tests (
  id,
  slug,
  title,
  kind,
  module,
  skill,
  status,
  version,
  time_limit_seconds,
  description,
  published_at,
  metadata,
  created_at,
  updated_at
)
select
  drill_test_id,
  drill_slug,
  case skill
    when 'listening' then 'Listening'
    when 'reading' then 'Reading'
    else initcap(skill::text)
  end
  || ' · '
  || case question_type
    when 'matching_headings' then 'Matching Headings'
    when 'matching_information' then 'Matching Information'
    when 'matching_features' then 'Matching Features'
    when 'true_false_notgiven' then 'True / False / Not Given'
    when 'yes_no_notgiven' then 'Yes / No / Not Given'
    when 'mcq_single' then 'Single-Answer Multiple Choice'
    when 'mcq_multi' then 'Multiple-Answer Multiple Choice'
    when 'sentence_completion' then 'Sentence Completion'
    when 'summary_completion' then 'Summary Completion'
    when 'note_table_form_flowchart_completion' then 'Notes / Table / Form / Flowchart Completion'
    when 'short_answer' then 'Short Answer'
    when 'diagram_label' then 'Diagram Labelling'
    when 'map_plan_label' then 'Map / Plan Labelling'
    else initcap(replace(question_type::text, '_', ' '))
  end
  || ' · '
  || initcap(difficulty)
  || case when chunk_count > 1 then ' · Set ' || chunk_index::text else '' end,
  'drill',
  module,
  skill,
  'published',
  1,
  greatest(300, question_count::integer * case
    when question_type in ('matching_headings', 'matching_information', 'matching_features', 'mcq_multi') then 90
    when question_type in ('sentence_completion', 'summary_completion', 'note_table_form_flowchart_completion', 'diagram_label', 'map_plan_label') then 75
    else 60
  end),
  'Focused IELTS ' || skill::text || ' drill derived from published mock questions.',
  now(),
  jsonb_build_object(
    'generated_by', 'ielts_skill_drill_bank_v1',
    'generated_kind', 'b2c_skill_drill',
    'drill_bank_version', '2026-07-08',
    'provenance', 'derived-from-mock',
    'source', 'published_academic_mocks_v1',
    'band_conversion_key', 'default',
    'scoring_path', 'objective_grading_v1',
    'subskill_key', subskill_key,
    'subskill_tags', jsonb_build_array(subskill_key),
    'question_type', question_type::text,
    'question_types', jsonb_build_array(question_type::text),
    'difficulty', difficulty,
    'difficulty_band_hint', difficulty_band_hint,
    'question_count', question_count,
    'chunk_index', chunk_index,
    'chunk_count', chunk_count,
    'source_test_ids', to_jsonb(source_test_ids),
    'source_test_slugs', to_jsonb(source_test_slugs),
    'source_question_ids', to_jsonb(source_question_ids)
  ),
  now(),
  now()
from ielts_drill_bank_tests
on conflict (id) do update set
  slug = excluded.slug,
  title = excluded.title,
  kind = excluded.kind,
  module = excluded.module,
  skill = excluded.skill,
  status = excluded.status,
  version = excluded.version,
  time_limit_seconds = excluded.time_limit_seconds,
  description = excluded.description,
  published_at = coalesce(public.ielts_tests.published_at, excluded.published_at),
  metadata = excluded.metadata,
  updated_at = excluded.updated_at;

create temporary table ielts_drill_bank_passage_map on commit drop as
with source_passages as (
  select
    i.drill_test_id,
    i.drill_slug,
    i.source_passage_id,
    min(i.drill_order_index) as first_drill_order_index
  from ielts_drill_bank_items i
  where i.source_passage_id is not null
  group by i.drill_test_id, i.drill_slug, i.source_passage_id
)
select
  drill_test_id,
  drill_slug,
  source_passage_id,
  md5('ielts_skill_drill_bank_v1:passage:' || drill_slug || ':' || source_passage_id::text)::uuid
    as passage_id,
  row_number() over (
    partition by drill_slug
    order by first_drill_order_index, source_passage_id
  ) - 1 as passage_order_index
from source_passages;

insert into public.passages (
  id,
  test_id,
  order_index,
  title,
  body,
  word_count,
  genre,
  metadata,
  created_at,
  updated_at
)
select
  m.passage_id,
  m.drill_test_id,
  m.passage_order_index,
  p.title,
  p.body,
  p.word_count,
  p.genre,
  p.metadata || jsonb_build_object(
    'source_passage_id', p.id,
    'source_test_id', p.test_id,
    'generated_by', 'ielts_skill_drill_bank_v1',
    'provenance', 'derived-from-mock'
  ),
  now(),
  now()
from ielts_drill_bank_passage_map m
join public.passages p on p.id = m.source_passage_id
on conflict (id) do update set
  test_id = excluded.test_id,
  order_index = excluded.order_index,
  title = excluded.title,
  body = excluded.body,
  word_count = excluded.word_count,
  genre = excluded.genre,
  metadata = excluded.metadata,
  updated_at = excluded.updated_at;

create temporary table ielts_drill_bank_listening_map on commit drop as
with source_sections as (
  select
    i.drill_test_id,
    i.drill_slug,
    i.source_listening_section_id,
    min(i.drill_order_index) as first_drill_order_index
  from ielts_drill_bank_items i
  where i.source_listening_section_id is not null
  group by i.drill_test_id, i.drill_slug, i.source_listening_section_id
),
numbered_sections as (
  select
    drill_test_id,
    drill_slug,
    source_listening_section_id,
    md5('ielts_skill_drill_bank_v1:listening:' || drill_slug || ':' || source_listening_section_id::text)::uuid
      as listening_section_id,
    row_number() over (
      partition by drill_slug
      order by first_drill_order_index, source_listening_section_id
    ) as section_number
  from source_sections
)
select
  drill_test_id,
  drill_slug,
  source_listening_section_id,
  listening_section_id,
  section_number,
  section_number - 1 as listening_order_index
from numbered_sections;

create temporary table ielts_drill_bank_audio_map on commit drop as
select distinct
  lm.drill_test_id,
  lm.drill_slug,
  ls.audio_asset_id as source_audio_asset_id,
  md5('ielts_skill_drill_bank_v1:audio:' || lm.drill_slug || ':' || ls.audio_asset_id::text)::uuid
    as audio_asset_id
from ielts_drill_bank_listening_map lm
join public.listening_sections ls on ls.id = lm.source_listening_section_id
where ls.audio_asset_id is not null;

insert into public.audio_assets (
  id,
  test_id,
  kind,
  script,
  voice,
  accent,
  tts_provider,
  storage_path,
  duration_seconds,
  status,
  version,
  metadata,
  created_at,
  updated_at
)
select
  m.audio_asset_id,
  m.drill_test_id,
  a.kind,
  a.script,
  a.voice,
  a.accent,
  a.tts_provider,
  a.storage_path,
  a.duration_seconds,
  a.status,
  a.version,
  a.metadata || jsonb_build_object(
    'source_audio_asset_id', a.id,
    'source_test_id', a.test_id,
    'generated_by', 'ielts_skill_drill_bank_v1',
    'provenance', 'derived-from-mock'
  ),
  now(),
  now()
from ielts_drill_bank_audio_map m
join public.audio_assets a on a.id = m.source_audio_asset_id
on conflict (id) do update set
  test_id = excluded.test_id,
  kind = excluded.kind,
  script = excluded.script,
  voice = excluded.voice,
  accent = excluded.accent,
  tts_provider = excluded.tts_provider,
  storage_path = excluded.storage_path,
  duration_seconds = excluded.duration_seconds,
  status = excluded.status,
  version = excluded.version,
  metadata = excluded.metadata,
  updated_at = excluded.updated_at;

insert into public.listening_sections (
  id,
  test_id,
  section_number,
  order_index,
  title,
  script,
  accent,
  audio_asset_id,
  speakers,
  metadata,
  created_at,
  updated_at
)
select
  lm.listening_section_id,
  lm.drill_test_id,
  lm.section_number,
  lm.listening_order_index,
  ls.title,
  ls.script,
  ls.accent,
  am.audio_asset_id,
  ls.speakers,
  ls.metadata || jsonb_build_object(
    'source_listening_section_id', ls.id,
    'source_test_id', ls.test_id,
    'generated_by', 'ielts_skill_drill_bank_v1',
    'provenance', 'derived-from-mock'
  ),
  now(),
  now()
from ielts_drill_bank_listening_map lm
join public.listening_sections ls on ls.id = lm.source_listening_section_id
left join ielts_drill_bank_audio_map am
  on am.drill_slug = lm.drill_slug
  and am.source_audio_asset_id = ls.audio_asset_id
on conflict (id) do update set
  test_id = excluded.test_id,
  section_number = excluded.section_number,
  order_index = excluded.order_index,
  title = excluded.title,
  script = excluded.script,
  accent = excluded.accent,
  audio_asset_id = excluded.audio_asset_id,
  speakers = excluded.speakers,
  metadata = excluded.metadata,
  updated_at = excluded.updated_at;

insert into public.ielts_questions (
  id,
  test_id,
  passage_id,
  listening_section_id,
  skill,
  question_type,
  order_index,
  group_key,
  group_instructions,
  prompt,
  options,
  max_points,
  word_limit,
  visual,
  metadata,
  created_at,
  updated_at
)
select
  md5('ielts_skill_drill_bank_v1:question:' || i.drill_slug || ':' || i.source_question_id::text)::uuid,
  i.drill_test_id,
  pm.passage_id,
  lm.listening_section_id,
  i.skill,
  i.question_type,
  i.drill_order_index,
  i.group_key,
  i.group_instructions,
  i.prompt,
  i.options,
  i.max_points,
  i.word_limit,
  i.visual,
  i.metadata || jsonb_build_object(
    'source_question_id', i.source_question_id,
    'source_test_id', i.source_test_id,
    'source_test_slug', i.source_test_slug,
    'generated_by', 'ielts_skill_drill_bank_v1',
    'generated_kind', 'b2c_skill_drill',
    'provenance', 'derived-from-mock',
    'drill_slug', i.drill_slug,
    'subskill_key', i.subskill_key,
    'subskill_tags', jsonb_build_array(i.subskill_key),
    'difficulty', i.difficulty,
    'difficulty_band_hint', i.difficulty_band_hint
  ),
  now(),
  now()
from ielts_drill_bank_items i
left join ielts_drill_bank_passage_map pm
  on pm.drill_slug = i.drill_slug
  and pm.source_passage_id = i.source_passage_id
left join ielts_drill_bank_listening_map lm
  on lm.drill_slug = i.drill_slug
  and lm.source_listening_section_id = i.source_listening_section_id
on conflict (id) do update set
  test_id = excluded.test_id,
  passage_id = excluded.passage_id,
  listening_section_id = excluded.listening_section_id,
  skill = excluded.skill,
  question_type = excluded.question_type,
  order_index = excluded.order_index,
  group_key = excluded.group_key,
  group_instructions = excluded.group_instructions,
  prompt = excluded.prompt,
  options = excluded.options,
  max_points = excluded.max_points,
  word_limit = excluded.word_limit,
  visual = excluded.visual,
  metadata = excluded.metadata,
  updated_at = excluded.updated_at;

insert into public.ielts_question_keys (
  question_id,
  correct_answer,
  accept_variants,
  explanation_en,
  explanation_vi,
  model_answer,
  examiner_notes,
  created_at,
  updated_at
)
select
  md5('ielts_skill_drill_bank_v1:question:' || i.drill_slug || ':' || i.source_question_id::text)::uuid,
  k.correct_answer,
  k.accept_variants,
  k.explanation_en,
  k.explanation_vi,
  k.model_answer,
  k.examiner_notes,
  now(),
  now()
from ielts_drill_bank_items i
join public.ielts_question_keys k on k.question_id = i.source_question_id
on conflict (question_id) do update set
  correct_answer = excluded.correct_answer,
  accept_variants = excluded.accept_variants,
  explanation_en = excluded.explanation_en,
  explanation_vi = excluded.explanation_vi,
  model_answer = excluded.model_answer,
  examiner_notes = excluded.examiner_notes,
  updated_at = excluded.updated_at;

do $$
declare
  missing_tag_count integer;
  bad_difficulty_count integer;
  bad_drill_size_count integer;
  missing_key_count integer;
  oversized_listening_count integer;
begin
  select count(*)
  into missing_tag_count
  from public.ielts_questions q
  join public.ielts_tests t on t.id = q.test_id
  where t.status = 'published'
    and (
      q.metadata ->> 'subskill_key' is null
      or jsonb_typeof(q.metadata -> 'subskill_tags') <> 'array'
      or jsonb_array_length(q.metadata -> 'subskill_tags') = 0
    );

  if missing_tag_count <> 0 then
    raise exception 'IELTS drill bank: % published questions missing subskill metadata', missing_tag_count;
  end if;

  select count(*)
  into bad_difficulty_count
  from public.ielts_questions q
  join public.ielts_tests t on t.id = q.test_id
  where t.status = 'published'
    and (
      q.metadata ->> 'difficulty' not in ('easy', 'medium', 'hard')
      or not (q.metadata ? 'difficulty_band_hint')
    );

  if bad_difficulty_count <> 0 then
    raise exception 'IELTS drill bank: % published questions missing normalized difficulty metadata', bad_difficulty_count;
  end if;

  select count(*)
  into bad_drill_size_count
  from (
    select t.id, count(q.id) as question_count
    from public.ielts_tests t
    left join public.ielts_questions q on q.test_id = t.id
    where t.metadata ->> 'generated_by' = 'ielts_skill_drill_bank_v1'
    group by t.id
    having count(q.id) < 5 or count(q.id) > 10
  ) bad_sizes;

  if bad_drill_size_count <> 0 then
    raise exception 'IELTS drill bank: % generated drills outside 5-10 question size', bad_drill_size_count;
  end if;

  select count(*)
  into missing_key_count
  from public.ielts_questions q
  join public.ielts_tests t on t.id = q.test_id
  left join public.ielts_question_keys k on k.question_id = q.id
  where t.metadata ->> 'generated_by' = 'ielts_skill_drill_bank_v1'
    and k.question_id is null;

  if missing_key_count <> 0 then
    raise exception 'IELTS drill bank: % generated drill questions missing keys', missing_key_count;
  end if;

  select count(*)
  into oversized_listening_count
  from (
    select test_id, count(*) as section_count
    from public.listening_sections ls
    join public.ielts_tests t on t.id = ls.test_id
    where t.metadata ->> 'generated_by' = 'ielts_skill_drill_bank_v1'
    group by test_id
    having count(*) > 4
  ) oversized;

  if oversized_listening_count <> 0 then
    raise exception 'IELTS drill bank: % generated listening drills exceed 4 sections', oversized_listening_count;
  end if;
end $$;
