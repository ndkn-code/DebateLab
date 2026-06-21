-- =============================================================================
-- WS-6.0.1 — IELTS subskill dictionary
-- =============================================================================
-- Adds the stable IELTS subskill taxonomy chosen in Phase 6:
--   * Reading/Listening: Cambridge-style question-type skills.
--   * Writing/Speaking: IELTS band-descriptor criteria.
--   * Cross-cutting micro-skills represented per IELTS skill.
--
-- `key` is the cross-track contract, e.g. `reading:matching_headings`.
-- The opaque uuid `id` lets future UI/admin tooling address rows without
-- coupling route params to the semantic key.
--
-- RLS: dictionary rows are reference data. Authenticated learners can read
-- active rows; admins can manage all rows. No anon grant.
-- =============================================================================

begin;

create table if not exists public.ielts_subskills (
  id uuid primary key default gen_random_uuid(),
  skill public.ielts_skill not null,
  key text not null unique,
  label_en text not null,
  label_vi text not null,
  kind text not null check (kind in ('question_type', 'band_criterion', 'micro_skill', 'strategy')),
  question_type public.ielts_question_type,
  description_en text,
  description_vi text,
  tags text[] not null default '{}',
  sort_order integer not null default 0 check (sort_order >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ielts_subskills_key_format_check
    check (key ~ '^(listening|reading|writing|speaking):[a-z0-9_]+$'),
  constraint ielts_subskills_key_matches_skill_check
    check (
      (skill = 'listening' and key like 'listening:%')
      or (skill = 'reading' and key like 'reading:%')
      or (skill = 'writing' and key like 'writing:%')
      or (skill = 'speaking' and key like 'speaking:%')
    ),
  constraint ielts_subskills_question_type_kind_check
    check (
      (kind = 'question_type' and question_type is not null)
      or (kind <> 'question_type')
    )
);

comment on table public.ielts_subskills is
  'IELTS adaptive-learning subskill dictionary. Stable `skill:key` rows feed prediction, study planning, and Learn mode.';

comment on column public.ielts_subskills.key is
  'Stable subskill contract key, e.g. reading:matching_headings. Not an enum so teachers can extend the taxonomy.';

comment on column public.ielts_subskills.kind is
  'Taxonomy bucket: Cambridge question type, IELTS band criterion, cross-cutting micro-skill, or strategy.';

comment on column public.ielts_subskills.question_type is
  'Optional bridge to the existing IELTS item-bank question type enum for Reading/Listening subskills.';

create index if not exists ielts_subskills_skill_sort_idx
  on public.ielts_subskills (skill, sort_order, key)
  where is_active;

create index if not exists ielts_subskills_kind_idx
  on public.ielts_subskills (kind);

alter table public.ielts_subskills enable row level security;

drop policy if exists "IELTS subskills are viewable by authenticated users"
  on public.ielts_subskills;
create policy "IELTS subskills are viewable by authenticated users"
  on public.ielts_subskills
  for select
  to authenticated
  using (is_active or private.is_admin((select auth.uid())));

drop policy if exists "Admins manage IELTS subskills"
  on public.ielts_subskills;
create policy "Admins manage IELTS subskills"
  on public.ielts_subskills
  for all
  to authenticated
  using (private.is_admin((select auth.uid())))
  with check (private.is_admin((select auth.uid())));

revoke all on table public.ielts_subskills from anon, authenticated;
grant select, insert, update, delete on table public.ielts_subskills to authenticated;
grant all on table public.ielts_subskills to service_role;

insert into public.ielts_subskills (
  skill,
  key,
  label_en,
  label_vi,
  kind,
  question_type,
  description_en,
  description_vi,
  tags,
  sort_order
) values
  -- Reading: Cambridge question-type skills.
  ('reading', 'reading:matching_headings', 'Matching headings', 'Ghép tiêu đề đoạn', 'question_type', 'matching_headings',
    'Identify each paragraph''s main idea and match it to a heading.',
    'Xác định ý chính của từng đoạn và ghép với tiêu đề phù hợp.',
    array['cambridge', 'main_idea'], 10),
  ('reading', 'reading:matching_information', 'Matching information', 'Ghép thông tin', 'question_type', 'matching_information',
    'Locate specific facts, examples, reasons, or explanations across paragraphs.',
    'Tìm đúng dữ kiện, ví dụ, lý do hoặc phần giải thích trong các đoạn.',
    array['cambridge', 'locating'], 20),
  ('reading', 'reading:matching_features', 'Matching features', 'Ghép đặc điểm', 'question_type', 'matching_features',
    'Match statements to people, places, dates, theories, or other features.',
    'Ghép nhận định với người, địa điểm, mốc thời gian, lý thuyết hoặc đặc điểm liên quan.',
    array['cambridge', 'locating'], 30),
  ('reading', 'reading:true_false_notgiven', 'True / False / Not Given', 'Đúng / Sai / Không có thông tin', 'question_type', 'true_false_notgiven',
    'Verify claims against the passage without over-inferring.',
    'Đối chiếu nhận định với bài đọc và tránh suy luận quá mức.',
    array['cambridge', 'claim_verification'], 40),
  ('reading', 'reading:yes_no_notgiven', 'Yes / No / Not Given', 'Có / Không / Không có thông tin', 'question_type', 'yes_no_notgiven',
    'Evaluate whether a claim matches the writer''s views or claims.',
    'Đánh giá nhận định có khớp với quan điểm hoặc lập luận của tác giả không.',
    array['cambridge', 'claim_verification'], 50),
  ('reading', 'reading:mcq_single', 'Single-answer multiple choice', 'Trắc nghiệm một đáp án', 'question_type', 'mcq_single',
    'Choose the best answer while eliminating distractors.',
    'Chọn đáp án đúng nhất và loại trừ phương án gây nhiễu.',
    array['cambridge', 'distractors'], 60),
  ('reading', 'reading:mcq_multi', 'Multiple-answer multiple choice', 'Trắc nghiệm nhiều đáp án', 'question_type', 'mcq_multi',
    'Select all correct options without being trapped by partial matches.',
    'Chọn đủ các đáp án đúng mà không bị mắc bẫy bởi thông tin khớp một phần.',
    array['cambridge', 'distractors'], 70),
  ('reading', 'reading:sentence_completion', 'Sentence completion', 'Hoàn thành câu', 'question_type', 'sentence_completion',
    'Complete sentences with grammatically and contextually valid words from the passage.',
    'Hoàn thành câu bằng từ đúng ngữ pháp và đúng ngữ cảnh trong bài đọc.',
    array['cambridge', 'completion'], 80),
  ('reading', 'reading:summary_completion', 'Summary completion', 'Hoàn thành tóm tắt', 'question_type', 'summary_completion',
    'Track a summarized idea and fill gaps using passage evidence.',
    'Theo dõi phần tóm tắt và điền chỗ trống dựa trên bằng chứng trong bài.',
    array['cambridge', 'completion'], 90),
  ('reading', 'reading:note_table_form_flowchart_completion', 'Notes / table / flowchart completion', 'Hoàn thành ghi chú / bảng / sơ đồ quy trình', 'question_type', 'note_table_form_flowchart_completion',
    'Use structure and labels to complete compact information displays.',
    'Dựa vào cấu trúc và nhãn để hoàn thành thông tin dạng ghi chú, bảng hoặc sơ đồ.',
    array['cambridge', 'completion'], 100),
  ('reading', 'reading:short_answer', 'Short answer', 'Trả lời ngắn', 'question_type', 'short_answer',
    'Answer directly with concise words from the passage under a word limit.',
    'Trả lời trực tiếp, ngắn gọn bằng từ trong bài và đúng giới hạn từ.',
    array['cambridge', 'completion'], 110),
  ('reading', 'reading:diagram_label', 'Diagram labelling', 'Ghi nhãn sơ đồ', 'question_type', 'diagram_label',
    'Map passage details onto parts of a diagram.',
    'Liên kết chi tiết trong bài đọc với các phần của sơ đồ.',
    array['cambridge', 'visual'], 120),
  ('reading', 'reading:skim_main_idea', 'Skimming for main idea', 'Đọc lướt tìm ý chính', 'strategy', null,
    'Quickly identify a paragraph or passage''s controlling idea.',
    'Nhanh chóng nhận diện ý chính chi phối một đoạn hoặc toàn bài.',
    array['strategy', 'main_idea'], 130),
  ('reading', 'reading:scan_specific_detail', 'Scanning for detail', 'Đọc quét tìm chi tiết', 'strategy', null,
    'Find names, numbers, dates, and exact details efficiently.',
    'Tìm tên riêng, số liệu, ngày tháng và chi tiết chính xác một cách hiệu quả.',
    array['strategy', 'locating'], 140),
  ('reading', 'reading:paraphrase_recognition', 'Paraphrase recognition', 'Nhận diện diễn đạt tương đương', 'micro_skill', null,
    'Recognize when the passage restates the same meaning with different wording.',
    'Nhận ra khi bài đọc diễn đạt cùng một ý bằng cách dùng từ khác.',
    array['micro', 'paraphrase'], 150),

  -- Listening: Cambridge question-type skills plus audio-specific micro-skills.
  ('listening', 'listening:mcq_single', 'Single-answer multiple choice', 'Trắc nghiệm một đáp án', 'question_type', 'mcq_single',
    'Choose the best answer while tracking distractors in audio.',
    'Chọn đáp án đúng nhất trong khi theo dõi bẫy gây nhiễu trong bài nghe.',
    array['cambridge', 'distractors'], 210),
  ('listening', 'listening:mcq_multi', 'Multiple-answer multiple choice', 'Trắc nghiệm nhiều đáp án', 'question_type', 'mcq_multi',
    'Select all correct options from a moving audio context.',
    'Chọn đủ các đáp án đúng trong ngữ cảnh nghe đang diễn ra.',
    array['cambridge', 'distractors'], 220),
  ('listening', 'listening:matching_features', 'Matching', 'Ghép nối thông tin', 'question_type', 'matching_features',
    'Match speakers, options, places, or features from the recording.',
    'Ghép người nói, lựa chọn, địa điểm hoặc đặc điểm dựa trên bài nghe.',
    array['cambridge', 'matching'], 230),
  ('listening', 'listening:sentence_completion', 'Sentence completion', 'Hoàn thành câu', 'question_type', 'sentence_completion',
    'Complete sentences using words heard in the recording.',
    'Hoàn thành câu bằng từ nghe được trong bài.',
    array['cambridge', 'completion'], 240),
  ('listening', 'listening:summary_completion', 'Summary completion', 'Hoàn thành tóm tắt', 'question_type', 'summary_completion',
    'Follow summarized audio meaning and fill missing words.',
    'Theo dõi ý tóm tắt của bài nghe và điền từ còn thiếu.',
    array['cambridge', 'completion'], 250),
  ('listening', 'listening:note_table_form_flowchart_completion', 'Notes / table / form / flowchart completion', 'Hoàn thành ghi chú / bảng / biểu mẫu / sơ đồ quy trình', 'question_type', 'note_table_form_flowchart_completion',
    'Listen for structured information in forms, notes, tables, and flowcharts.',
    'Nghe thông tin có cấu trúc trong biểu mẫu, ghi chú, bảng và sơ đồ quy trình.',
    array['cambridge', 'completion'], 260),
  ('listening', 'listening:short_answer', 'Short answer', 'Trả lời ngắn', 'question_type', 'short_answer',
    'Answer directly with concise words heard in the recording.',
    'Trả lời trực tiếp, ngắn gọn bằng từ nghe được trong bài.',
    array['cambridge', 'completion'], 270),
  ('listening', 'listening:map_plan_label', 'Map / plan labelling', 'Ghi nhãn bản đồ / sơ đồ mặt bằng', 'question_type', 'map_plan_label',
    'Track spatial language and label a map or plan.',
    'Theo dõi ngôn ngữ chỉ vị trí và ghi nhãn bản đồ hoặc sơ đồ mặt bằng.',
    array['cambridge', 'spatial'], 280),
  ('listening', 'listening:diagram_label', 'Diagram labelling', 'Ghi nhãn sơ đồ', 'question_type', 'diagram_label',
    'Map audio details onto labelled parts of a diagram.',
    'Liên kết chi tiết nghe được với các phần được đánh dấu trong sơ đồ.',
    array['cambridge', 'visual'], 290),
  ('listening', 'listening:numbers_dates_names', 'Numbers, dates, and names', 'Số, ngày tháng và tên riêng', 'micro_skill', null,
    'Accurately decode spelling, numbers, dates, times, and proper names.',
    'Nghe chính xác đánh vần, số, ngày giờ và tên riêng.',
    array['micro', 'decoding'], 300),
  ('listening', 'listening:distractor_repair', 'Distractor repair', 'Sửa bẫy gây nhiễu', 'micro_skill', null,
    'Notice corrections, negations, and changed answers in the recording.',
    'Nhận ra phần sửa lại, phủ định và đáp án bị thay đổi trong bài nghe.',
    array['micro', 'distractors'], 310),
  ('listening', 'listening:signpost_prediction', 'Signpost prediction', 'Dự đoán theo tín hiệu chuyển ý', 'strategy', null,
    'Use discourse markers to predict what information comes next.',
    'Dùng dấu hiệu chuyển ý để dự đoán thông tin sắp xuất hiện.',
    array['strategy', 'prediction'], 320),

  -- Writing: IELTS band criteria plus task-specific micro-skills.
  ('writing', 'writing:task_achievement_task1', 'Task Achievement (Task 1)', 'Hoàn thành yêu cầu bài (Task 1)', 'band_criterion', 'writing_task1_academic',
    'Select, report, and compare key features clearly for Task 1.',
    'Chọn, mô tả và so sánh đặc điểm chính một cách rõ ràng trong Task 1.',
    array['band_descriptor', 'task1'], 410),
  ('writing', 'writing:task_response_task2', 'Task Response (Task 2)', 'Trả lời yêu cầu đề (Task 2)', 'band_criterion', 'writing_task2_essay',
    'Answer all parts of the prompt with a relevant position and developed ideas.',
    'Trả lời đầy đủ các phần của đề với lập trường phù hợp và ý tưởng được phát triển.',
    array['band_descriptor', 'task2'], 420),
  ('writing', 'writing:coherence_cohesion', 'Coherence and Cohesion', 'Mạch lạc và liên kết', 'band_criterion', 'writing_task2_essay',
    'Organize ideas logically with effective paragraphing and cohesive devices.',
    'Sắp xếp ý logic với đoạn văn rõ ràng và phương tiện liên kết hiệu quả.',
    array['band_descriptor'], 430),
  ('writing', 'writing:lexical_resource', 'Lexical Resource', 'Nguồn từ vựng', 'band_criterion', 'writing_task2_essay',
    'Use precise, flexible vocabulary with appropriate collocation and word form.',
    'Dùng từ vựng chính xác, linh hoạt, đúng kết hợp từ và dạng từ.',
    array['band_descriptor', 'vocabulary'], 440),
  ('writing', 'writing:grammar_range_accuracy', 'Grammatical Range and Accuracy', 'Độ đa dạng và chính xác ngữ pháp', 'band_criterion', 'writing_task2_essay',
    'Use varied sentence structures accurately and control errors.',
    'Dùng cấu trúc câu đa dạng, chính xác và kiểm soát lỗi.',
    array['band_descriptor', 'grammar'], 450),
  ('writing', 'writing:position_development', 'Position and idea development', 'Phát triển lập trường và ý tưởng', 'micro_skill', null,
    'Make the central position clear and support it with specific, relevant development.',
    'Làm rõ lập trường chính và hỗ trợ bằng phần phát triển cụ thể, liên quan.',
    array['micro', 'task2'], 460),
  ('writing', 'writing:overview_selection', 'Overview selection', 'Chọn thông tin tổng quan', 'micro_skill', null,
    'Choose the most important trends, contrasts, and stages for a Task 1 overview.',
    'Chọn xu hướng, tương phản và giai đoạn quan trọng nhất cho phần tổng quan Task 1.',
    array['micro', 'task1'], 470),
  ('writing', 'writing:collocation_precision', 'Collocation precision', 'Độ chính xác của kết hợp từ', 'micro_skill', null,
    'Improve natural academic word combinations and reduce awkward phrasing.',
    'Cải thiện cách kết hợp từ học thuật tự nhiên và giảm diễn đạt gượng.',
    array['micro', 'vocabulary'], 480),
  ('writing', 'writing:paraphrase_transform', 'Paraphrase transformation', 'Chuyển đổi diễn đạt tương đương', 'micro_skill', null,
    'Rewrite prompts or ideas accurately without changing meaning.',
    'Viết lại đề hoặc ý một cách chính xác mà không đổi nghĩa.',
    array['micro', 'paraphrase'], 490),

  -- Speaking: IELTS band criteria plus fluency/pronunciation micro-skills.
  ('speaking', 'speaking:fluency_coherence', 'Fluency and Coherence', 'Độ trôi chảy và mạch lạc', 'band_criterion', 'speaking_part2_cuecard',
    'Speak at length with logical flow, repair strategies, and minimal hesitation.',
    'Nói đủ dài với mạch ý logic, biết tự sửa và ít ngập ngừng.',
    array['band_descriptor', 'fluency'], 510),
  ('speaking', 'speaking:lexical_resource', 'Lexical Resource', 'Nguồn từ vựng', 'band_criterion', 'speaking_part2_cuecard',
    'Use flexible topic vocabulary, idiomatic language, and precise word choice.',
    'Dùng từ vựng chủ đề linh hoạt, diễn đạt tự nhiên và lựa chọn từ chính xác.',
    array['band_descriptor', 'vocabulary'], 520),
  ('speaking', 'speaking:grammar_range_accuracy', 'Grammatical Range and Accuracy', 'Độ đa dạng và chính xác ngữ pháp', 'band_criterion', 'speaking_part2_cuecard',
    'Use varied spoken grammar accurately enough to support meaning.',
    'Dùng ngữ pháp nói đa dạng và đủ chính xác để truyền đạt ý.',
    array['band_descriptor', 'grammar'], 530),
  ('speaking', 'speaking:pronunciation', 'Pronunciation', 'Phát âm', 'band_criterion', 'speaking_part2_cuecard',
    'Control sounds, stress, rhythm, and intonation so speech is easy to understand.',
    'Kiểm soát âm, trọng âm, nhịp điệu và ngữ điệu để người nghe dễ hiểu.',
    array['band_descriptor', 'pronunciation'], 540),
  ('speaking', 'speaking:extend_answer', 'Extending answers', 'Mở rộng câu trả lời', 'micro_skill', null,
    'Add reasons, examples, contrast, and detail without drifting off topic.',
    'Thêm lý do, ví dụ, đối chiếu và chi tiết mà không lạc đề.',
    array['micro', 'fluency'], 550),
  ('speaking', 'speaking:pronunciation_minimal_pairs', 'Minimal-pair pronunciation', 'Phát âm cặp âm dễ nhầm', 'micro_skill', null,
    'Train high-impact sound contrasts for Vietnamese-first learners.',
    'Luyện các cặp âm dễ nhầm có tác động lớn với người học Việt Nam.',
    array['micro', 'pronunciation', 'vn_first'], 560),
  ('speaking', 'speaking:discourse_markers', 'Discourse markers', 'Từ nối khi nói', 'micro_skill', null,
    'Use natural signposting to connect ideas in spoken answers.',
    'Dùng tín hiệu chuyển ý tự nhiên để nối các ý trong câu trả lời nói.',
    array['micro', 'coherence'], 570),
  ('speaking', 'speaking:part2_structure', 'Part 2 long-turn structure', 'Cấu trúc bài nói Part 2', 'strategy', null,
    'Organize a cue-card answer with setup, details, story, and reflection.',
    'Sắp xếp câu trả lời cue card với mở ý, chi tiết, câu chuyện và nhận xét.',
    array['strategy', 'part2'], 580)
on conflict (key) do update set
  skill = excluded.skill,
  label_en = excluded.label_en,
  label_vi = excluded.label_vi,
  kind = excluded.kind,
  question_type = excluded.question_type,
  description_en = excluded.description_en,
  description_vi = excluded.description_vi,
  tags = excluded.tags,
  sort_order = excluded.sort_order,
  is_active = true,
  updated_at = now();

commit;
