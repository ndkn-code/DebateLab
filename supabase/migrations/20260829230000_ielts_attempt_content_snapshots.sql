-- Complete the immutable IELTS attempt content snapshot.
--
-- The question blueprint already freezes the learner-facing question fields.
-- This migration also freezes the linked Reading/Listening stimulus and the
-- explanatory answer-key fields used by post-attempt review.  These columns
-- deliberately contain copies rather than mutable foreign-key lookups.

begin;

alter table public.ielts_attempt_question_blueprints
  add column if not exists source_title text,
  add column if not exists source_body text,
  add column if not exists source_audio_asset_id uuid,
  add column if not exists source_audio_storage_path text,
  add column if not exists source_audio_version integer,
  add column if not exists source_audio_status text;

alter table public.ielts_attempt_question_keys
  add column if not exists explanation_en text,
  add column if not exists explanation_vi text,
  add column if not exists model_answer text,
  add column if not exists examiner_notes text;

-- New blueprint rows snapshot their linked stimulus in the same transaction as
-- attempt creation.  No learner-facing path reads the source tables here.
create or replace function private.populate_ielts_attempt_blueprint_source()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_passage public.passages%rowtype;
  v_listening public.listening_sections%rowtype;
  v_audio public.audio_assets%rowtype;
begin
  if new.passage_id is not null then
    select * into v_passage from public.passages where id = new.passage_id;
    if found then
      new.source_title := v_passage.title;
      new.source_body := v_passage.body;
    end if;
  elsif new.listening_section_id is not null then
    select * into v_listening
      from public.listening_sections
     where id = new.listening_section_id;
    if found then
      new.source_title := v_listening.title;
      new.source_body := v_listening.script;
      new.source_audio_asset_id := v_listening.audio_asset_id;
      if v_listening.audio_asset_id is not null then
        select * into v_audio from public.audio_assets where id = v_listening.audio_asset_id;
        if found then
          new.source_audio_storage_path := v_audio.storage_path;
          new.source_audio_version := v_audio.version;
          new.source_audio_status := v_audio.status::text;
        end if;
      end if;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists ielts_attempt_blueprint_source_snapshot
  on public.ielts_attempt_question_blueprints;
create trigger ielts_attempt_blueprint_source_snapshot
before insert on public.ielts_attempt_question_blueprints
for each row execute function private.populate_ielts_attempt_blueprint_source();

create or replace function private.populate_ielts_attempt_key_explanations()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_key public.ielts_question_keys%rowtype;
begin
  select * into v_key from public.ielts_question_keys where question_id = new.question_id;
  if found then
    new.explanation_en := v_key.explanation_en;
    new.explanation_vi := v_key.explanation_vi;
    new.model_answer := v_key.model_answer;
    new.examiner_notes := v_key.examiner_notes;
  end if;
  return new;
end;
$$;

drop trigger if exists ielts_attempt_key_explanations_snapshot
  on public.ielts_attempt_question_keys;
create trigger ielts_attempt_key_explanations_snapshot
before insert on public.ielts_attempt_question_keys
for each row execute function private.populate_ielts_attempt_key_explanations();

-- Existing attempts were frozen by the preceding security migration.  Populate
-- the newly-added fields once, temporarily bypassing the append-only trigger
-- inside this transaction; subsequent updates remain prohibited.
drop trigger if exists ielts_attempt_blueprint_immutable
  on public.ielts_attempt_question_blueprints;
update public.ielts_attempt_question_blueprints b
   set source_title = p.title,
       source_body = p.body
  from public.passages p
 where b.passage_id = p.id
   and b.source_body is null;
update public.ielts_attempt_question_blueprints b
   set source_title = l.title,
       source_body = l.script,
       source_audio_asset_id = l.audio_asset_id,
       source_audio_storage_path = a.storage_path,
       source_audio_version = a.version,
       source_audio_status = a.status::text
  from public.listening_sections l
  left join public.audio_assets a on a.id = l.audio_asset_id
 where b.listening_section_id = l.id
   and b.source_body is null;
create trigger ielts_attempt_blueprint_immutable
before update or delete on public.ielts_attempt_question_blueprints
for each row execute function private.prevent_ielts_attempt_blueprint_mutation();

drop trigger if exists ielts_attempt_question_keys_immutable
  on public.ielts_attempt_question_keys;
update public.ielts_attempt_question_keys k
   set explanation_en = q.explanation_en,
       explanation_vi = q.explanation_vi,
       model_answer = q.model_answer,
       examiner_notes = q.examiner_notes
  from public.ielts_question_keys q
 where k.question_id = q.question_id
   and k.explanation_en is null
   and k.explanation_vi is null
   and k.model_answer is null
   and k.examiner_notes is null;
create trigger ielts_attempt_question_keys_immutable
before update or delete on public.ielts_attempt_question_keys
for each row execute function private.prevent_ielts_attempt_blueprint_mutation();

commit;
