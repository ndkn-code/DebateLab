-- Execute only against a disposable database. Every fixture is rolled back.
\set ON_ERROR_STOP on
begin;
create function pg_temp.qid(n integer) returns uuid language sql immutable as $$select ('00000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid$$;
create function pg_temp.expect_error(q text, expected text) returns void language plpgsql as $$
declare caught text;
begin
  begin execute q; exception when others then caught:=sqlerrm; end;
  if caught is null or caught not like '%'||expected||'%' then raise exception 'Expected %, got % for %',expected,coalesce(caught,'SUCCESS'),q; end if;
end $$;
create function pg_temp.assert_true(v boolean, label text) returns void language plpgsql as $$begin if v is distinct from true then raise exception 'Assertion failed: %',label; end if; end$$;
insert into auth.users(id,aud,role,email,raw_user_meta_data) select pg_temp.qid(n),'authenticated','authenticated','qi-'||n||'@example.test',jsonb_build_object('display_name','QI '||n) from generate_series(1,7)n;
insert into public.profiles(id,display_name) select pg_temp.qid(n),'QI '||n from generate_series(1,7)n on conflict(id) do nothing;
insert into public.clubs(id,code,name,owner_user_id) values(pg_temp.qid(11),'QI-A','QA A',pg_temp.qid(1)),(pg_temp.qid(12),'QI-B','QA B',pg_temp.qid(3));
insert into public.club_memberships(club_id,user_id,role,status) values
(pg_temp.qid(11),pg_temp.qid(1),'owner','active'),(pg_temp.qid(11),pg_temp.qid(2),'teacher','active'),
(pg_temp.qid(12),pg_temp.qid(3),'owner','active'),(pg_temp.qid(11),pg_temp.qid(4),'teacher','removed'),
(pg_temp.qid(11),pg_temp.qid(5),'head_teacher','active'),(pg_temp.qid(11),pg_temp.qid(6),'admin','active'),(pg_temp.qid(11),pg_temp.qid(7),'student','active');
insert into public.lms_materials(id,club_id,program_type,title,material_kind,created_by) select pg_temp.qid(100+n),pg_temp.qid(11),'ielts','QA PDF '||n,'file',pg_temp.qid(2) from generate_series(1,4)n;
insert into public.lms_material_versions(id,material_id,version_number,created_by,purpose,source_mime_type,source_file_name,size_bytes,processing_status) select pg_temp.qid(200+n),pg_temp.qid(100+n),1,pg_temp.qid(2),'question_import','application/pdf','original-'||n||'.pdf',100,'queued' from generate_series(1,4)n;
insert into public.question_import_batches(id,club_id,created_by,title,status,copyright_attested,copyright_attestation_version,copyright_attestation_locale,copyright_attested_at,copyright_attested_by) select pg_temp.qid(300+n),pg_temp.qid(11),pg_temp.qid(2),'QA batch '||n,'queued',true,'2026-09-04.v1','en',now(),pg_temp.qid(2) from generate_series(1,4)n;
insert into public.question_import_batch_documents(id,batch_id,club_id,material_id,version_id,source_file_name,sha256) select pg_temp.qid(400+n),pg_temp.qid(300+n),pg_temp.qid(11),pg_temp.qid(100+n),pg_temp.qid(200+n),'original-'||n||'.pdf',repeat('a',64) from generate_series(1,4)n;

-- Actual worker quota transitions: duplicate claims, concurrency cap, refund retry and rollover.
set local request.jwt.claim.role='service_role';
select public.claim_question_import_provider_job(pg_temp.qid(301),pg_temp.qid(401),2,0,'question-import:'||pg_temp.qid(301)||':'||pg_temp.qid(401));
select public.claim_question_import_provider_job(pg_temp.qid(301),pg_temp.qid(401),2,0,'question-import:'||pg_temp.qid(301)||':'||pg_temp.qid(401));
select public.claim_question_import_provider_job(pg_temp.qid(302),pg_temp.qid(402),1,0,'question-import:'||pg_temp.qid(302)||':'||pg_temp.qid(402));
select pg_temp.expect_error(format('select public.claim_question_import_provider_job(%L,%L,1,0,%L)',pg_temp.qid(303),pg_temp.qid(403),'question-import:'||pg_temp.qid(303)||':'||pg_temp.qid(403)),'IMPORT_QUOTA_EXCEEDED');
select public.release_question_import_worker_quota(pg_temp.qid(11),'question-import:'||pg_temp.qid(302)||':'||pg_temp.qid(402));
select public.claim_question_import_provider_job(pg_temp.qid(302),pg_temp.qid(402),1,0,'question-import:'||pg_temp.qid(302)||':'||pg_temp.qid(402));
select pg_temp.assert_true((select count(*)=1 from public.organization_question_import_usage where reservation_key='question-import:'||pg_temp.qid(302)||':'||pg_temp.qid(402)),'released retry reuses one ledger row');
update public.organization_question_import_usage set bucket_month=(date_trunc('month',current_date)-interval '1 month')::date where reservation_key='question-import:'||pg_temp.qid(301)||':'||pg_temp.qid(401);
select pg_temp.expect_error(format('select public.claim_question_import_provider_job(%L,%L,1,0,%L)',pg_temp.qid(303),pg_temp.qid(403),'question-import:'||pg_temp.qid(303)||':'||pg_temp.qid(403)),'IMPORT_QUOTA_EXCEEDED');
select pg_temp.expect_error(format('select public.persist_question_import_result(%L,%L,%L,%L,%L,2)',pg_temp.qid(301),pg_temp.qid(401),'failed','{"items":[]}','{}'),'IMPORT_INPUT_INVALID');
select public.persist_question_import_result(pg_temp.qid(301),pg_temp.qid(401),'completed','{"items":[{"question_type":"mcq_single","skill":"reading","prompt":"Choose A or B.","options":["A","B"],"suggested_answer":"B","stimulus":{"kind":"passage","text":"Original passage","answerKey":"secret"}},{"question_type":"writing_task2_essay","skill":"writing","prompt":"Discuss original urban gardens."}]}','{"credits":12}',2);
select pg_temp.assert_true((select count(*)=1 from public.organization_question_import_usage where kind='consumed' and bucket_month<date_trunc('month',current_date)::date),'completion reconciles original reservation month');
select pg_temp.assert_true((select count(*)=2 from public.question_import_draft_items where batch_id=pg_temp.qid(301) and status='draft'),'all types require review');
select pg_temp.assert_true((select bool_and(not(payload ? 'suggested_answer') and not(payload->'stimulus' ? 'answerKey')) from public.question_import_draft_items where batch_id=pg_temp.qid(301)),'nested provider keys stripped');
select public.persist_question_import_result(pg_temp.qid(301),pg_temp.qid(401),'completed','{"items":[]}','{}',2);
select pg_temp.assert_true((select count(*)=2 from public.question_import_draft_items where batch_id=pg_temp.qid(301)),'duplicate delivery creates no drafts');
-- Same collection receives a second independent batch.
select public.persist_question_import_result(pg_temp.qid(302),pg_temp.qid(402),'completed','{"items":[{"question_type":"short_answer","skill":"reading","prompt":"Name the original plant.","answer":"mint"}]}','{}',1);

set local role authenticated;
set local request.jwt.claim.role='authenticated';
select set_config('request.jwt.claim.sub',pg_temp.qid(2)::text,true);
select pg_temp.expect_error(format('select public.release_question_import_quota(%L,%L)',pg_temp.qid(11),'question-import:'||pg_temp.qid(301)||':'||pg_temp.qid(401)),'permission denied');
select pg_temp.expect_error(format('select public.submit_question_import(%L)',pg_temp.qid(301)),'IMPORT_REVIEW_INCOMPLETE');
select pg_temp.expect_error(format('select public.confirm_question_import_answer(%L,%L)',(select id from public.question_import_draft_items where batch_id=pg_temp.qid(301) and ordinal=1),'{"answer":""}'),'IMPORT_ANSWER_REQUIRED');
select public.confirm_question_import_answer(id,'{"answer":"B"}') from public.question_import_draft_items where batch_id=pg_temp.qid(301) and ordinal=1;
select public.save_question_import_draft(id,payload,'accepted',null) from public.question_import_draft_items where batch_id=pg_temp.qid(301);
select public.confirm_question_import_answer(id,'{"answer":"mint"}') from public.question_import_draft_items where batch_id=pg_temp.qid(302);
select public.save_question_import_draft(id,payload,'accepted',null) from public.question_import_draft_items where batch_id=pg_temp.qid(302);
select public.submit_question_import(pg_temp.qid(301));
select public.submit_question_import(pg_temp.qid(302));
select pg_temp.assert_true((select count(*)=0 from public.question_import_draft_keys),'teacher loses draft key access after submission');
select set_config('request.jwt.claim.sub',pg_temp.qid(4)::text,true);
select pg_temp.assert_true((select count(*)=0 from public.question_import_draft_items),'removed teacher sees no drafts');
select set_config('request.jwt.claim.sub',pg_temp.qid(3)::text,true);
select pg_temp.assert_true((select count(*)=0 from public.question_import_batches),'other organisation sees no batches');
select pg_temp.expect_error(format('select public.mark_question_import_source_action(%L,%L,%L)',pg_temp.qid(301),'quarantined','test'),'FORBIDDEN');
select set_config('request.jwt.claim.sub',pg_temp.qid(1)::text,true);
select public.create_question_bank_collection(pg_temp.qid(11),'QA bank','loose_items','academic') as collection_id \gset
select pg_temp.expect_error(format('select public.publish_question_import_items(%L,%L,ARRAY[%L::uuid],%L)',pg_temp.qid(301),:'collection_id',pg_temp.qid(999),'forged'),'IMPORT_ITEM_SCOPE_MISMATCH');
select public.publish_question_import_items(pg_temp.qid(301),:'collection_id',array(select id from public.question_import_draft_items where batch_id=pg_temp.qid(301) and ordinal=1),'part-one');
select pg_temp.assert_true((select status='submitted' from public.question_import_batches where id=pg_temp.qid(301)),'partial publication leaves remaining items submitted');
select public.publish_question_import_items(pg_temp.qid(301),:'collection_id',array(select id from public.question_import_draft_items where batch_id=pg_temp.qid(301) and ordinal=2),'part-two');
select public.publish_question_import_items(pg_temp.qid(301),:'collection_id',array(select id from public.question_import_draft_items where batch_id=pg_temp.qid(301) and ordinal=2),'part-two');
select pg_temp.assert_true((select count(*)=2 from public.question_bank_items),'final publication replay is idempotent');
select public.publish_question_import_items(pg_temp.qid(302),:'collection_id',array(select id from public.question_import_draft_items where batch_id=pg_temp.qid(302)),'batch-two');
select set_config('request.jwt.claim.sub',pg_temp.qid(2)::text,true);
select pg_temp.assert_true((select count(*)=0 from public.question_bank_keys),'ordinary teacher cannot read bank keys');
select pg_temp.assert_true((select count(*)=3 from public.question_bank_items),'ordinary teacher can read published items');
select pg_temp.expect_error(format('select public.publish_question_import_items(%L,%L,ARRAY[%L::uuid],%L)',pg_temp.qid(301),:'collection_id',pg_temp.qid(999),'teacher-forged'),'FORBIDDEN');
select set_config('request.jwt.claim.sub',pg_temp.qid(5)::text,true);
select public.mark_question_import_source_action(pg_temp.qid(301),'quarantined','rights review');
select pg_temp.assert_true((select count(*)=1 from public.question_bank_items),'quarantine hides only target batch items, including from leads');
select pg_temp.assert_true((select count(*)=0 from public.question_bank_stimuli),'quarantine hides stimulus answer-bearing source too');
select public.mark_question_import_source_action(pg_temp.qid(301),'restored','review resolved');
select pg_temp.assert_true((select status='completed' from public.question_import_batches where id=pg_temp.qid(301)),'restoration retains exact completed state');
select pg_temp.assert_true((select count(*)=3 from public.question_bank_items),'restored items reappear');
select set_config('request.jwt.claim.sub',pg_temp.qid(6)::text,true);
select public.mark_question_import_source_action(pg_temp.qid(301),'deleted','final removal');
select pg_temp.expect_error(format('select public.mark_question_import_source_action(%L,%L,%L)',pg_temp.qid(301),'restored','invalid'),'IMPORT_DELETION_FINAL');
select pg_temp.assert_true((select count(*)=1 from public.question_bank_items),'deletion preserves other batch');
select set_config('request.jwt.claim.sub',pg_temp.qid(7)::text,true);
select pg_temp.assert_true((select count(*)=0 from public.question_bank_items),'student cannot read bank');
reset role;
set local request.jwt.claim.role='service_role';
select pg_temp.expect_error(format('select public.claim_question_import_provider_job(%L,%L,2,0,%L)',pg_temp.qid(301),pg_temp.qid(401),'question-import:'||pg_temp.qid(301)||':'||pg_temp.qid(401)),'IMPORT_INPUT_INVALID');
select pg_temp.expect_error(format('select public.persist_question_import_result(%L,%L,%L,%L,%L,2)',pg_temp.qid(301),pg_temp.qid(401),'completed','{"items":[]}','{}'),'IMPORT_INPUT_INVALID');
select pg_temp.assert_true((select count(*)=3 from public.question_import_compliance_events where batch_id=pg_temp.qid(301)),'lifecycle audit survives deletion');
rollback;
