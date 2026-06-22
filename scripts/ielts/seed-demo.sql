-- ============================================================================
-- IELTS demo seed (ielts-demo-v1)
-- ----------------------------------------------------------------------------
-- Purpose: populate ONE coherent IELTS Academic mock + a Learn-mode course +
-- a believable learner trajectory (diagnostic attempt -> evidence -> skill
-- states -> predicted band -> study plan -> review queue), so the admin-gated
-- IELTS preview renders with real content before the co-founder authors the
-- real item bank.
--
-- Scope: GLOBAL content (the test + course) is shared; the LEARNER trajectory
-- is seeded for every current admin (profiles.role = 'admin') via a md5()-keyed
-- cross join, so it is populated whichever admin account you log in as.
--
-- Idempotent: cleanup-first by the `ielts-demo-v1` marker + fixed content IDs,
-- then re-insert. Safe to run repeatedly. Run via the Supabase MCP execute_sql
-- (service role) or psql. NOT a migration — demo data only.
--
-- Remove everything: re-run just the CLEANUP block below.
-- ============================================================================

-- ===========================================================================
-- CLEANUP (trajectory first — ielts_attempts RESTRICTs test deletion)
-- ===========================================================================
delete from ielts_study_plans      where explanation->>'seed' = 'ielts-demo-v1';
delete from ielts_review_items     where metadata->>'seed'    = 'ielts-demo-v1';
delete from ielts_adaptive_evidence where metadata->>'seed'   = 'ielts-demo-v1';
delete from ielts_skill_states     where explanation->>'seed' = 'ielts-demo-v1';
delete from activity_attempts      where responses->>'seed'   = 'ielts-demo-v1';
delete from ielts_attempts         where metadata->>'seed'    = 'ielts-demo-v1';
delete from clubs                  where id = '0de70000-0000-4000-a000-0000000aa001';
delete from courses                where id = '0de70000-0000-4000-a000-0000000e0001';
delete from ielts_tests            where id = '0de70000-0000-4000-a000-0000000a0001';

-- ===========================================================================
-- CONTENT: test container + listening sections + reading passage
-- ===========================================================================
insert into ielts_tests (id, slug, title, kind, module, status, version, time_limit_seconds, description, published_at, metadata)
values (
  '0de70000-0000-4000-a000-0000000a0001',
  'demo-academic-mock-1',
  'Demo Academic Mock 1',
  'full_mock', 'academic', 'published', 1, 10800,
  'Quick diagnostic mock for the IELTS Academic preview.',
  now(),
  '{"band_conversion_key":"default","seed":"ielts-demo-v1"}'::jsonb
);

insert into listening_sections (id, test_id, section_number, order_index, title, script, accent, speakers)
values
  ('0de70000-0000-4000-a000-0000000b0001', '0de70000-0000-4000-a000-0000000a0001', 1, 0,
   'Section 1: Library registration',
   'Librarian: Good morning, how can I help? Student: Hi, I would like to register for a library card. Librarian: Of course. We are open until eight in the evening on weekdays, and until five on Saturdays.',
   'uk', '[{"name":"Librarian","accent":"uk"},{"name":"Student","accent":"uk"}]'::jsonb),
  ('0de70000-0000-4000-a000-0000000b0002', '0de70000-0000-4000-a000-0000000a0001', 2, 1,
   'Section 2: Geography lecture',
   'Lecturer: Today we will look at how rivers shape the landscape over time. This introductory session is designed for first-year students, so do not worry if the terms are new.',
   'us', '[{"name":"Lecturer","accent":"us"}]'::jsonb);

insert into passages (id, test_id, order_index, title, body, word_count, genre)
values (
  '0de70000-0000-4000-a000-0000000c0001', '0de70000-0000-4000-a000-0000000a0001', 0,
  'The Origins of Tea',
  'Tea is among the most widely consumed beverages in the world today, second only to water. According to legend, tea was discovered in ancient China around 2737 BCE, when leaves from a wild bush drifted into water that the emperor Shen Nong was boiling. For many centuries, the Chinese valued tea less as a drink than as a herbal medicine, believing it could aid digestion and sharpen the mind. Only later did tea become an everyday social drink. Traders carried it along overland routes into Central Asia, and by the seventeenth century European merchants had introduced it to markets in the Netherlands and England. Britain in particular developed an enduring fondness for tea, and demand there reshaped global trade, encouraging the spread of tea cultivation to India and Sri Lanka under colonial rule.',
  140, 'informative'
);

-- ===========================================================================
-- CONTENT: questions (4 reading, 4 listening, 2 writing, 3 speaking)
-- ===========================================================================
insert into ielts_questions (id, test_id, passage_id, listening_section_id, skill, question_type, order_index, prompt, options, max_points, word_limit, metadata)
values
  -- Reading (passage-linked)
  ('0de70000-0000-4000-a000-0000000d0001','0de70000-0000-4000-a000-0000000a0001','0de70000-0000-4000-a000-0000000c0001',null,'reading','mcq_single',0,
   'According to the passage, tea was originally valued in China mainly as:',
   '[{"id":"a","text":"a social drink"},{"id":"b","text":"a form of medicine"},{"id":"c","text":"a trade currency"},{"id":"d","text":"a religious symbol"}]'::jsonb,1,null,
   '{"subskill_tags":["reading:mcq_single"]}'::jsonb),
  ('0de70000-0000-4000-a000-0000000d0002','0de70000-0000-4000-a000-0000000a0001','0de70000-0000-4000-a000-0000000c0001',null,'reading','true_false_notgiven',1,
   'Tea reached England before it reached the Netherlands.',
   '[{"id":"true","text":"True"},{"id":"false","text":"False"},{"id":"not_given","text":"Not Given"}]'::jsonb,1,null,
   '{"subskill_tags":["reading:true_false_notgiven"]}'::jsonb),
  ('0de70000-0000-4000-a000-0000000d0003','0de70000-0000-4000-a000-0000000a0001','0de70000-0000-4000-a000-0000000c0001',null,'reading','short_answer',2,
   'Besides India, in which country did tea cultivation spread under colonial rule?',
   '[]'::jsonb,1,2,
   '{"subskill_tags":["reading:short_answer"]}'::jsonb),
  ('0de70000-0000-4000-a000-0000000d0004','0de70000-0000-4000-a000-0000000a0001','0de70000-0000-4000-a000-0000000c0001',null,'reading','mcq_single',3,
   'Which option best describes the main idea of the passage?',
   '[{"id":"a","text":"The health benefits of tea"},{"id":"b","text":"How tea is grown"},{"id":"c","text":"The history and spread of tea"},{"id":"d","text":"The British tea ceremony"}]'::jsonb,1,null,
   '{"subskill_tags":["reading:matching_headings"]}'::jsonb),
  -- Listening (section-linked)
  ('0de70000-0000-4000-a000-0000000d0011','0de70000-0000-4000-a000-0000000a0001',null,'0de70000-0000-4000-a000-0000000b0001','listening','short_answer',0,
   'What is the student registering for?',
   '[]'::jsonb,1,3,
   '{"subskill_tags":["listening:short_answer"]}'::jsonb),
  ('0de70000-0000-4000-a000-0000000d0012','0de70000-0000-4000-a000-0000000a0001',null,'0de70000-0000-4000-a000-0000000b0001','listening','mcq_single',1,
   'Until what time is the library open on weekdays?',
   '[{"id":"a","text":"6 pm"},{"id":"b","text":"8 pm"},{"id":"c","text":"9 pm"}]'::jsonb,1,null,
   '{"subskill_tags":["listening:numbers_dates_names"]}'::jsonb),
  ('0de70000-0000-4000-a000-0000000d0013','0de70000-0000-4000-a000-0000000a0001',null,'0de70000-0000-4000-a000-0000000b0002','listening','short_answer',2,
   'What natural feature does the lecturer mainly discuss?',
   '[]'::jsonb,1,2,
   '{"subskill_tags":["listening:short_answer"]}'::jsonb),
  ('0de70000-0000-4000-a000-0000000d0014','0de70000-0000-4000-a000-0000000a0001',null,'0de70000-0000-4000-a000-0000000b0002','listening','mcq_single',3,
   'Who is the lecture primarily intended for?',
   '[{"id":"a","text":"First-year students"},{"id":"b","text":"Postgraduate researchers"},{"id":"c","text":"Visiting tourists"}]'::jsonb,1,null,
   '{"subskill_tags":["listening:mcq_single"]}'::jsonb),
  -- Writing
  ('0de70000-0000-4000-a000-0000000d0021','0de70000-0000-4000-a000-0000000a0001',null,null,'writing','writing_task1_academic',0,
   'The chart below shows the number of international students enrolling in three universities between 2010 and 2020. Summarise the information by selecting and reporting the main features, and make comparisons where relevant. Write at least 150 words.',
   '[]'::jsonb,1,150,
   '{"subskill_tags":["writing:task_achievement_task1"]}'::jsonb),
  ('0de70000-0000-4000-a000-0000000d0022','0de70000-0000-4000-a000-0000000a0001',null,null,'writing','writing_task2_essay',1,
   'Some people believe universities should focus only on academic subjects, while others think they should also teach practical life skills. Discuss both views and give your own opinion. Write at least 250 words.',
   '[]'::jsonb,1,250,
   '{"subskill_tags":["writing:task_response_task2"]}'::jsonb),
  -- Speaking
  ('0de70000-0000-4000-a000-0000000d0031','0de70000-0000-4000-a000-0000000a0001',null,null,'speaking','speaking_part1',0,
   'Let us talk about where you live. Do you live in a house or an apartment? What do you like most about it?',
   '[]'::jsonb,1,null,
   '{"subskill_tags":["speaking:fluency_coherence"]}'::jsonb),
  ('0de70000-0000-4000-a000-0000000d0032','0de70000-0000-4000-a000-0000000a0001',null,null,'speaking','speaking_part2_cuecard',1,
   'Describe a skill you would like to learn.',
   '[]'::jsonb,1,null,
   '{"subskill_tags":["speaking:part2_structure"],"cueCardBullets":["What the skill is","Why you want to learn it","How you would learn it","How it would help you"]}'::jsonb),
  ('0de70000-0000-4000-a000-0000000d0033','0de70000-0000-4000-a000-0000000a0001',null,null,'speaking','speaking_part3',2,
   'Let us discuss skills and learning more generally. Why do some people find it harder to learn new skills as they get older?',
   '[]'::jsonb,1,null,
   '{"subskill_tags":["speaking:fluency_coherence"]}'::jsonb);

-- ===========================================================================
-- CONTENT: answer keys (objective questions only)
-- ===========================================================================
insert into ielts_question_keys (question_id, correct_answer, accept_variants, explanation_en, explanation_vi)
values
  ('0de70000-0000-4000-a000-0000000d0001','{"0":"b"}'::jsonb,'{}'::jsonb,
   'The passage states the Chinese valued tea as a herbal medicine.','Bài đọc nói người Trung Quốc xem trà như một loại thảo dược.'),
  ('0de70000-0000-4000-a000-0000000d0002','{"0":"not_given"}'::jsonb,'{}'::jsonb,
   'The passage lists the Netherlands and England together without saying which came first.','Bài đọc nêu Hà Lan và Anh cùng nhau, không nói nơi nào trước.'),
  ('0de70000-0000-4000-a000-0000000d0003','{"0":"Sri Lanka"}'::jsonb,'{"0":["Sri Lanka","sri lanka"]}'::jsonb,
   'The final sentence names India and Sri Lanka.','Câu cuối nhắc đến Ấn Độ và Sri Lanka.'),
  ('0de70000-0000-4000-a000-0000000d0004','{"0":"c"}'::jsonb,'{}'::jsonb,
   'The passage traces the history and global spread of tea.','Bài đọc kể lịch sử và sự lan rộng của trà.'),
  ('0de70000-0000-4000-a000-0000000d0011','{"0":"library card"}'::jsonb,'{"0":["library card","a library card"]}'::jsonb,
   'The student asks to register for a library card.','Sinh viên muốn đăng ký thẻ thư viện.'),
  ('0de70000-0000-4000-a000-0000000d0012','{"0":"b"}'::jsonb,'{}'::jsonb,
   'The librarian says they are open until eight on weekdays.','Thủ thư nói mở cửa đến 8 giờ tối các ngày trong tuần.'),
  ('0de70000-0000-4000-a000-0000000d0013','{"0":"rivers"}'::jsonb,'{"0":["rivers","river"]}'::jsonb,
   'The lecturer discusses how rivers shape the landscape.','Giảng viên nói về cách sông định hình cảnh quan.'),
  ('0de70000-0000-4000-a000-0000000d0014','{"0":"a"}'::jsonb,'{}'::jsonb,
   'The session is designed for first-year students.','Buổi học dành cho sinh viên năm nhất.');

-- ===========================================================================
-- CONTENT: Learn-mode course -> 3 units -> 5 micro-activities
-- ===========================================================================
insert into courses (id, title, slug, description, category, subject, difficulty, estimated_hours, is_published)
values (
  '0de70000-0000-4000-a000-0000000e0001',
  'IELTS Academic Learning Path',
  'ielts-academic-learn',
  'Targeted micro-lessons that build the subskills behind each IELTS band.',
  'critical_thinking', 'ielts', 'intermediate', 6, true
);

insert into course_modules (id, course_id, title, description, sort_order)
values
  ('0de70000-0000-4000-a000-0000000e0011','0de70000-0000-4000-a000-0000000e0001','Unit 1: Reading Strategies','Skimming, scanning, and paraphrase recognition.',0),
  ('0de70000-0000-4000-a000-0000000e0012','0de70000-0000-4000-a000-0000000e0001','Unit 2: Writing Skills','Lexical range and grammatical accuracy for Task 2.',1),
  ('0de70000-0000-4000-a000-0000000e0013','0de70000-0000-4000-a000-0000000e0001','Unit 3: Vocabulary Builder','High-value collocations for academic topics.',2);

insert into activities (id, module_id, activity_type, title, description, phase, order_index, duration_minutes, content)
values
  ('0de70000-0000-4000-a000-0000000f0001','0de70000-0000-4000-a000-0000000e0011','ielts_paraphrase_transform','Spot the paraphrase','Identify equivalent meanings expressed in different words.','learn',0,8,
   '{"activityType":"ielts_paraphrase_transform","instruction":{"en":"Choose the paraphrase that keeps the original meaning.","vi":"Chọn cách diễn đạt lại giữ nguyên nghĩa gốc."},"sources":[{"questionId":"0de70000-0000-4000-a000-0000000d0001","subskillKey":"reading:paraphrase_recognition","labelEn":"Synonym recognition","labelVi":"Nhận diện từ đồng nghĩa"}],"rendererTags":["paraphrase","reading"],"module":"academic","version":1}'::jsonb),
  ('0de70000-0000-4000-a000-0000000f0002','0de70000-0000-4000-a000-0000000e0011','ielts_gap_fill','Reading gap-fill','Complete sentences with the precise word from the passage.','practice',1,6,
   '{"activityType":"ielts_gap_fill","instruction":{"en":"Fill each gap using no more than two words.","vi":"Điền vào mỗi chỗ trống không quá hai từ."},"sources":[{"questionId":"0de70000-0000-4000-a000-0000000d0003","subskillKey":"reading:short_answer","labelEn":"Scan for detail","labelVi":"Quét tìm chi tiết"}],"rendererTags":["gap_fill","reading"],"module":"academic","version":1}'::jsonb),
  ('0de70000-0000-4000-a000-0000000f0003','0de70000-0000-4000-a000-0000000e0012','ielts_vocab_collocation','Task 2 collocations','Pair academic nouns with their strongest verbs and adjectives.','learn',0,8,
   '{"activityType":"ielts_vocab_collocation","instruction":{"en":"Match each word with its strongest collocation.","vi":"Ghép mỗi từ với collocation mạnh nhất."},"sources":[{"questionId":"0de70000-0000-4000-a000-0000000d0022","subskillKey":"writing:collocation_precision","labelEn":"Academic collocations","labelVi":"Collocation học thuật"}],"rendererTags":["collocation","writing"],"module":"academic","version":1}'::jsonb),
  ('0de70000-0000-4000-a000-0000000f0004','0de70000-0000-4000-a000-0000000e0012','ielts_gap_fill','Complex sentence gap-fill','Practise subordinating conjunctions in academic sentences.','practice',1,6,
   '{"activityType":"ielts_gap_fill","instruction":{"en":"Complete each sentence with the correct linking word.","vi":"Hoàn thành mỗi câu với từ nối đúng."},"sources":[{"questionId":"0de70000-0000-4000-a000-0000000d0022","subskillKey":"writing:grammar_range_accuracy","labelEn":"Complex sentences","labelVi":"Câu phức"}],"rendererTags":["gap_fill","writing"],"module":"academic","version":1}'::jsonb),
  ('0de70000-0000-4000-a000-0000000f0005','0de70000-0000-4000-a000-0000000e0013','ielts_vocab_collocation','Topic vocabulary: education','Build a bank of education-topic collocations.','learn',0,7,
   '{"activityType":"ielts_vocab_collocation","instruction":{"en":"Group the collocations under the right topic.","vi":"Nhóm các collocation theo đúng chủ đề."},"sources":[{"questionId":"0de70000-0000-4000-a000-0000000d0022","subskillKey":"writing:lexical_resource","labelEn":"Education vocabulary","labelVi":"Từ vựng giáo dục"}],"rendererTags":["collocation","vocabulary"],"module":"academic","version":1}'::jsonb);

-- ===========================================================================
-- B2B FIXTURE: a demo teaching center + ONE enrolled admin, so the B2B course
-- (Learn) path is previewable. contact.tuandat@gmail.com (Tuấn) = enrolled/B2B;
-- ndkn.work@gmail.com (Jensen) stays B2C (the practice-only prep app).
-- ===========================================================================
insert into clubs (id, code, name, status, metadata)
values ('0de70000-0000-4000-a000-0000000aa001','DEMO-IELTS-CENTER','Demo IELTS Center','active','{"seed":"ielts-demo-v1"}'::jsonb)
on conflict (id) do nothing;

insert into club_memberships (id, club_id, user_id, role, status, metadata)
select '0de70000-0000-4000-a000-0000000ab001','0de70000-0000-4000-a000-0000000aa001', p.id, 'student', 'active', '{"seed":"ielts-demo-v1"}'::jsonb
from profiles p
join auth.users u on u.id = p.id
where u.email = 'contact.tuandat@gmail.com'
on conflict (id) do nothing;

-- ===========================================================================
-- TRAJECTORY (per admin): completed diagnostic attempt
-- ===========================================================================
insert into ielts_attempts (id, user_id, test_id, status, module, attempt_number, started_at, submitted_at, completed_at, metadata)
select
  md5('ielts-demo:attempt:'||a.user_id::text)::uuid, a.user_id,
  '0de70000-0000-4000-a000-0000000a0001', 'completed', 'academic', 1,
  now() - interval '2 days', now() - interval '2 days' + interval '3 hours', now() - interval '2 days' + interval '3 hours',
  '{"seed":"ielts-demo-v1"}'::jsonb
from (select id as user_id from profiles where role = 'admin') a
on conflict (id) do nothing;

-- TRAJECTORY (per admin): graded objective responses (6 correct, 2 incorrect)
insert into ielts_question_responses (id, attempt_id, user_id, question_id, response, is_correct, awarded_points, graded_at)
select
  md5('ielts-demo:resp:'||a.user_id::text||':'||r.qid)::uuid,
  md5('ielts-demo:attempt:'||a.user_id::text)::uuid,
  a.user_id, r.qid::uuid, r.response::jsonb, r.is_correct, r.points, now() - interval '2 days' + interval '3 hours'
from (select id as user_id from profiles where role = 'admin') a
cross join (values
  ('0de70000-0000-4000-a000-0000000d0001','{"values":{"0":"b"}}',true,1),
  ('0de70000-0000-4000-a000-0000000d0002','{"values":{"0":"false"}}',false,0),
  ('0de70000-0000-4000-a000-0000000d0003','{"values":{"0":"Sri Lanka"}}',true,1),
  ('0de70000-0000-4000-a000-0000000d0004','{"values":{"0":"c"}}',true,1),
  ('0de70000-0000-4000-a000-0000000d0011','{"values":{"0":"library card"}}',true,1),
  ('0de70000-0000-4000-a000-0000000d0012','{"values":{"0":"a"}}',false,0),
  ('0de70000-0000-4000-a000-0000000d0013','{"values":{"0":"rivers"}}',true,1),
  ('0de70000-0000-4000-a000-0000000d0014','{"values":{"0":"a"}}',true,1)
) as r(qid, response, is_correct, points)
on conflict (id) do nothing;

-- TRAJECTORY (per admin): per-skill + overall bands
insert into attempt_band_scores (id, attempt_id, user_id, listening_raw, reading_raw, listening_band, reading_band, writing_band, speaking_band, overall_band, computed_at)
select
  md5('ielts-demo:bands:'||a.user_id::text)::uuid,
  md5('ielts-demo:attempt:'||a.user_id::text)::uuid,
  a.user_id, 28, 24, 6.5, 6.0, 5.5, 6.0, 6.0, now() - interval '2 days' + interval '3 hours'
from (select id as user_id from profiles where role = 'admin') a
on conflict (id) do nothing;

-- ===========================================================================
-- TRAJECTORY (per admin): adaptive evidence ledger
-- ===========================================================================
insert into ielts_adaptive_evidence (id, user_id, subskill_key, skill, module, evidence_type, evidence_value, band_estimate, confidence, source_table, source_id, reason_en, reason_vi, metadata)
select
  md5('ielts-demo:ev:'||a.user_id::text||':'||e.subskill_key)::uuid,
  a.user_id, e.subskill_key, e.skill::ielts_skill, 'academic',
  e.evidence_type::ielts_adaptive_evidence_type, e.evidence_value, e.band_estimate, e.confidence,
  e.source_table, md5('ielts-demo:attempt:'||a.user_id::text)::uuid,
  e.reason_en, e.reason_vi, '{"seed":"ielts-demo-v1"}'::jsonb
from (select id as user_id from profiles where role = 'admin') a
cross join (values
  ('reading:matching_headings','reading','objective_response',0.50,5.5,0.80,'ielts_question_responses','Main-idea reading items were inconsistent.','Các câu hỏi ý chính phần đọc chưa ổn định.'),
  ('reading:true_false_notgiven','reading','objective_response',0.55,5.5,0.78,'ielts_question_responses','True/False/Not Given accuracy was mixed.','Độ chính xác True/False/Not Given còn lẫn lộn.'),
  ('reading:short_answer','reading','objective_response',0.60,6.0,0.80,'ielts_question_responses','Short-answer scanning was fairly reliable.','Kỹ năng quét tìm câu trả lời ngắn khá ổn.'),
  ('reading:paraphrase_recognition','reading','objective_response',0.50,5.5,0.70,'ielts_question_responses','Paraphrase recognition needs reinforcement.','Nhận diện diễn đạt lại cần củng cố.'),
  ('listening:short_answer','listening','objective_response',0.70,6.5,0.82,'ielts_question_responses','Listening short-answer was strong.','Câu trả lời ngắn phần nghe khá tốt.'),
  ('listening:mcq_single','listening','objective_response',0.65,6.5,0.80,'ielts_question_responses','Multiple-choice listening was reliable.','Trắc nghiệm phần nghe đáng tin cậy.'),
  ('listening:numbers_dates_names','listening','objective_response',0.60,6.0,0.75,'ielts_question_responses','One number/time detail was missed.','Bỏ lỡ một chi tiết số/thời gian.'),
  ('writing:task_response_task2','writing','writing_score',0.55,5.5,0.70,'writing_responses','Task 2 position was clear but underdeveloped.','Quan điểm Task 2 rõ nhưng chưa triển khai sâu.'),
  ('writing:coherence_cohesion','writing','writing_score',0.55,5.5,0.70,'writing_responses','Paragraphing was present but linking was repetitive.','Có chia đoạn nhưng liên kết còn lặp.'),
  ('writing:lexical_resource','writing','writing_score',0.50,5.5,0.68,'writing_responses','Vocabulary range was limited for the topic.','Vốn từ cho chủ đề còn hạn chế.'),
  ('writing:grammar_range_accuracy','writing','writing_score',0.55,5.5,0.70,'writing_responses','Complex sentences were attempted with some errors.','Có dùng câu phức nhưng còn vài lỗi.'),
  ('speaking:fluency_coherence','speaking','speaking_score',0.60,6.0,0.72,'speaking_responses','Speech was mostly fluent with occasional hesitation.','Nói khá trôi chảy, đôi lúc ngập ngừng.'),
  ('speaking:lexical_resource','speaking','speaking_score',0.60,6.0,0.70,'speaking_responses','Range was adequate for familiar topics.','Vốn từ đủ dùng cho chủ đề quen thuộc.'),
  ('speaking:pronunciation','speaking','speaking_score',0.65,6.5,0.74,'speaking_responses','Pronunciation was generally clear.','Phát âm nhìn chung rõ ràng.')
) as e(subskill_key, skill, evidence_type, evidence_value, band_estimate, confidence, source_table, reason_en, reason_vi)
on conflict (id) do nothing;

-- ===========================================================================
-- TRAJECTORY (per admin): derived skill states (mastery + weakness)
-- ===========================================================================
insert into ielts_skill_states (id, user_id, subskill_key, skill, module, mastery_score, band_estimate, confidence, weakness_weight, evidence_count, last_evidence_at, explanation)
select
  md5('ielts-demo:ss:'||a.user_id::text||':'||s.subskill_key)::uuid,
  a.user_id, s.subskill_key, s.skill::ielts_skill, 'academic',
  s.mastery, s.band_estimate, s.confidence, s.weakness, s.evidence_count, now() - interval '2 days' + interval '3 hours',
  jsonb_build_object('seed','ielts-demo-v1','label',s.label,'trend',s.trend)
from (select id as user_id from profiles where role = 'admin') a
cross join (values
  ('reading:matching_headings','reading',0.50,5.5,0.80,0.65,3,'Matching headings','down'),
  ('reading:true_false_notgiven','reading',0.55,5.5,0.78,0.55,3,'True / False / Not Given','stable'),
  ('reading:short_answer','reading',0.60,6.0,0.80,0.40,2,'Short answer','up'),
  ('reading:paraphrase_recognition','reading',0.50,5.5,0.70,0.60,2,'Paraphrase recognition','stable'),
  ('listening:short_answer','listening',0.70,6.5,0.82,0.25,2,'Listening short answer','up'),
  ('listening:mcq_single','listening',0.65,6.5,0.80,0.30,2,'Listening multiple choice','stable'),
  ('listening:numbers_dates_names','listening',0.60,6.0,0.75,0.35,2,'Numbers, dates & names','stable'),
  ('writing:task_response_task2','writing',0.52,5.5,0.70,0.70,2,'Task 2 task response','down'),
  ('writing:coherence_cohesion','writing',0.55,5.5,0.70,0.60,2,'Coherence & cohesion','stable'),
  ('writing:lexical_resource','writing',0.50,5.5,0.68,0.68,2,'Lexical resource','down'),
  ('writing:grammar_range_accuracy','writing',0.55,5.5,0.70,0.58,2,'Grammar range & accuracy','stable'),
  ('speaking:fluency_coherence','speaking',0.60,6.0,0.72,0.40,1,'Fluency & coherence','stable'),
  ('speaking:lexical_resource','speaking',0.60,6.0,0.70,0.42,1,'Speaking lexical resource','stable'),
  ('speaking:pronunciation','speaking',0.65,6.5,0.74,0.28,1,'Pronunciation','up')
) as s(subskill_key, skill, mastery, band_estimate, confidence, weakness, evidence_count, label, trend)
on conflict (id) do nothing;

-- ===========================================================================
-- TRAJECTORY (per admin): active study plan (target 7.0, predicted 6.0)
-- ===========================================================================
insert into ielts_study_plans (
  id, user_id, module, status, target_test_date, target_overall_band,
  target_listening_band, target_reading_band, target_writing_band, target_speaking_band,
  focus_skills, daily_minutes, study_days, timezone, feedback_language, plan_horizon_days,
  predicted_overall_band, predicted_listening_band, predicted_reading_band, predicted_writing_band, predicted_speaking_band,
  prediction_confidence, prediction_summary, explanation, next_reassessment_at
)
select
  md5('ielts-demo:plan:'||a.user_id::text)::uuid, a.user_id, 'academic', 'active', current_date + 56, 7.0,
  7.0, 7.0, 6.5, 7.0,
  array['writing','reading']::ielts_skill[], 30, array[1,2,3,4,5]::smallint[], 'Asia/Ho_Chi_Minh', 'en', 14,
  6.0, 6.5, 5.5, 5.5, 6.0,
  0.62,
  '{"seed":"ielts-demo-v1"}'::jsonb,
  jsonb_build_object('seed','ielts-demo-v1','daysUntilTest',56,'lessonDays',5,'headlineEn','Writing and Reading are holding your overall band back.','headlineVi','Viết và Đọc đang kéo điểm tổng của bạn xuống.'),
  now() + interval '7 days'
from (select id as user_id from profiles where role = 'admin') a
on conflict (id) do nothing;

-- ===========================================================================
-- TRAJECTORY (per admin): review queue (SM-2 new items)
-- ===========================================================================
insert into ielts_review_items (id, user_id, source_type, source_id, source_key, skill, focus_area, review_kind, question_id, prompt_en, prompt_vi, answer_en, answer_vi, algorithm, state, due_at, metadata)
select
  md5('ielts-demo:review:'||a.user_id::text||':'||rv.rkey)::uuid,
  a.user_id, rv.source_type, nullif(rv.question_id,'')::uuid, 'ielts-demo:'||rv.rkey,
  rv.skill::ielts_skill, rv.focus_area, rv.review_kind, nullif(rv.question_id,'')::uuid,
  rv.prompt_en, rv.prompt_vi, rv.answer_en, rv.answer_vi, 'sm2_v1', rv.state,
  now() + (rv.due_in_days || ' days')::interval, '{"seed":"ielts-demo-v1"}'::jsonb
from (select id as user_id from profiles where role = 'admin') a
cross join (values
  ('r_match','ielts_question','0de70000-0000-4000-a000-0000000d0004','reading','Matching headings','objective','Which option best captures the main idea of a passage about the history of tea?','Lựa chọn nào nắm bắt đúng ý chính của đoạn về lịch sử trà?','The history and spread of tea','Lịch sử và sự lan rộng của trà','new',1),
  ('l_note','ielts_question','0de70000-0000-4000-a000-0000000d0011','listening','Listening detail','objective','Complete the note: the student registered for a ______.','Hoàn thành ghi chú: sinh viên đăng ký một ______.','library card','thẻ thư viện','learning',0),
  ('w_lex','writing_response','','writing','Lexical resource','criterion_feedback','Recall three strong collocations to describe an upward trend in an essay.','Nhớ lại ba collocation mạnh để mô tả xu hướng tăng trong bài luận.','e.g. rise sharply, a steady increase, climb steadily','vd: rise sharply, a steady increase, climb steadily','new',2),
  ('s_pron','speaking_response','','speaking','Minimal pairs','criterion_feedback','Practise the contrast between think and sink, three times each.','Luyện cặp âm think và sink, mỗi từ ba lần.','think /θ/, sink /s/','think /θ/, sink /s/','new',3)
) as rv(rkey, source_type, question_id, skill, focus_area, review_kind, prompt_en, prompt_vi, answer_en, answer_vi, state, due_in_days)
on conflict (id) do nothing;

-- ===========================================================================
-- TRAJECTORY (per admin): study plan items (today + 14-day calendar)
-- ===========================================================================
insert into ielts_study_plan_items (
  id, plan_id, user_id, kind, status, scheduled_date, available_at,
  skill, focus_area, estimated_minutes, priority_score, source_weakness_keys,
  rationale_en, rationale_vi, metadata,
  activity_id, ielts_test_id, ielts_question_id, review_item_id
)
select
  md5('ielts-demo:item:'||a.user_id::text||':'||it.ikey)::uuid,
  md5('ielts-demo:plan:'||a.user_id::text)::uuid, a.user_id,
  it.kind::ielts_plan_item_kind, it.status::ielts_plan_item_status,
  current_date + it.day_offset,
  case when it.status = 'available' then now() else null end,
  it.skill::ielts_skill, it.focus_area, it.est_minutes, it.priority,
  string_to_array(it.weakness_keys, ','),
  it.rationale_en, it.rationale_vi,
  jsonb_build_object('seed','ielts-demo-v1','titleEn',it.title_en,'titleVi',it.title_vi),
  nullif(it.activity_id,'')::uuid,
  case when it.set_test then '0de70000-0000-4000-a000-0000000a0001'::uuid else null end,
  nullif(it.question_id,'')::uuid,
  case when it.review_key <> '' then md5('ielts-demo:review:'||a.user_id::text||':'||it.review_key)::uuid else null end
from (select id as user_id from profiles where role = 'admin') a
cross join (values
  ('d0_collo','writing_submission','available',0,'writing','Task 1 report writing',25,0.90,'writing:lexical_resource','Draft a Task 1 report to build the lexical range your essays are missing.','Viết một báo cáo Task 1 để mở rộng vốn từ còn thiếu.','Write a Task 1 report','Viết báo cáo Task 1','',false,'0de70000-0000-4000-a000-0000000d0021',''),
  ('d0_review','review','available',0,'reading','Matching headings',10,0.75,'reading:matching_headings','Spaced review reinforces weak main-idea reading.','Ôn tập cách quãng củng cố kỹ năng đọc ý chính còn yếu.','Review: Matching headings','Ôn tập: Ghép tiêu đề','',false,'','r_match'),
  ('d0_write','writing_submission','available',0,'writing','Task 2 essay',40,0.70,'writing:task_response_task2','Write and submit a full Task 2 essay for AI band feedback.','Viết và nộp một bài Task 2 hoàn chỉnh để nhận nhận xét band từ AI.','Write a Task 2 essay','Viết bài luận Task 2','',false,'0de70000-0000-4000-a000-0000000d0022',''),
  ('d1_para','skill_drill','scheduled',1,'reading','Paraphrase recognition',12,0.65,'reading:paraphrase_recognition','A short reading drill on the synonym spotting that matching questions rely on.','Một bài luyện đọc ngắn về nhận diện từ đồng nghĩa mà câu ghép cần đến.','Reading drill: paraphrase','Luyện đọc: diễn đạt lại','',true,'',''),
  ('d2_mock','mini_mock','scheduled',2,'reading','Reading section practice',20,0.60,'reading:matching_headings','A short reading set to track progress on weak question types.','Một bộ đọc ngắn để theo dõi tiến bộ ở dạng câu yếu.','Mini reading mock','Mini test đọc','',true,'',''),
  ('d2_lrev','review','scheduled',2,'listening','Listening detail',10,0.50,'listening:short_answer','Keep listening detail sharp with spaced recall.','Giữ kỹ năng nghe chi tiết bằng ôn tập cách quãng.','Review: Listening notes','Ôn tập: Ghi chú nghe','',false,'','l_note'),
  ('d3_gram','writing_submission','scheduled',3,'writing','Grammar range & accuracy',25,0.62,'writing:grammar_range_accuracy','Revisit a Task 2 essay, focusing on complex and accurate sentences.','Viết lại một bài Task 2, tập trung vào câu phức chính xác.','Revisit your Task 2 essay','Xem lại bài Task 2','',false,'0de70000-0000-4000-a000-0000000d0022',''),
  ('d4_speak','speaking_submission','scheduled',4,'speaking','Part 2 cue card',15,0.55,'speaking:fluency_coherence','Record a Part 2 answer for fluency and pronunciation feedback.','Ghi âm câu trả lời Part 2 để nhận nhận xét trôi chảy và phát âm.','Record a Part 2 answer','Ghi âm câu trả lời Part 2','',false,'0de70000-0000-4000-a000-0000000d0032',''),
  ('d5_wrev','review','scheduled',5,'writing','Lexical resource',10,0.48,'writing:lexical_resource','Lock in the collocations you reviewed earlier this week.','Ghi nhớ các collocation đã ôn đầu tuần.','Review: Collocations','Ôn tập: Collocation','',false,'','w_lex'),
  ('d7_full','full_mock','scheduled',7,'reading','Full practice mock',60,0.40,'reading:matching_headings','A full timed mock to re-measure your predicted band.','Một bài mock đầy đủ có tính giờ để đo lại band dự đoán.','Full mock test','Bài mock đầy đủ','',true,'','')
) as it(ikey, kind, status, day_offset, skill, focus_area, est_minutes, priority, weakness_keys, rationale_en, rationale_vi, title_en, title_vi, activity_id, set_test, question_id, review_key)
on conflict (id) do nothing;

-- ===========================================================================
-- TRAJECTORY (per admin): completed learn activities (path progress)
-- ===========================================================================
insert into activity_attempts (id, user_id, activity_id, started_at, completed_at, score, max_score, is_passed, attempt_number, time_spent_seconds, responses)
select
  md5('ielts-demo:actatt:'||a.user_id::text||':'||av.activity_id)::uuid,
  a.user_id, av.activity_id::uuid, now() - interval '1 day', now() - interval '1 day' + (av.secs || ' seconds')::interval,
  av.score, av.max_score, true, 1, av.secs, '{"seed":"ielts-demo-v1","answers":[]}'::jsonb
from (select id as user_id from profiles where role = 'admin') a
cross join (values
  ('0de70000-0000-4000-a000-0000000f0001',1,1,420),
  ('0de70000-0000-4000-a000-0000000f0003',4,5,480)
) as av(activity_id, score, max_score, secs)
on conflict (id) do nothing;
