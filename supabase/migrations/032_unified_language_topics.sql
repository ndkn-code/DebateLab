-- Unified app/practice language and bilingual practice topic metadata.

create table if not exists public.practice_topics (
  topic_key text primary key,
  category_key text not null check (
    category_key in (
      'education',
      'technology',
      'society',
      'environment',
      'ethics',
      'vietnam'
    )
  ),
  difficulty text not null check (
    difficulty in ('beginner', 'intermediate', 'advanced')
  ),
  display_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.practice_topic_translations (
  topic_key text not null references public.practice_topics(topic_key) on delete cascade,
  language text not null check (language in ('en', 'vi')),
  title text not null,
  context text,
  suggested_points jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (topic_key, language)
);

create table if not exists public.practice_topic_category_translations (
  category_key text not null check (
    category_key in (
      'education',
      'technology',
      'society',
      'environment',
      'ethics',
      'vietnam'
    )
  ),
  language text not null check (language in ('en', 'vi')),
  label text not null,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (category_key, language)
);

alter table public.practice_topics enable row level security;
alter table public.practice_topic_translations enable row level security;
alter table public.practice_topic_category_translations enable row level security;

drop policy if exists "Authenticated users can read practice topics"
  on public.practice_topics;
create policy "Authenticated users can read practice topics"
  on public.practice_topics
  for select
  to authenticated
  using (true);

drop policy if exists "Authenticated users can read practice topic translations"
  on public.practice_topic_translations;
create policy "Authenticated users can read practice topic translations"
  on public.practice_topic_translations
  for select
  to authenticated
  using (true);

drop policy if exists "Authenticated users can read practice category translations"
  on public.practice_topic_category_translations;
create policy "Authenticated users can read practice category translations"
  on public.practice_topic_category_translations
  for select
  to authenticated
  using (true);

grant select on table public.practice_topics to authenticated;
grant select on table public.practice_topic_translations to authenticated;
grant select on table public.practice_topic_category_translations to authenticated;

insert into public.practice_topic_category_translations (
  category_key,
  language,
  label,
  display_order
)
values
  ('education', 'en', 'Education & School Life', 1),
  ('education', 'vi', 'Giáo Dục & Đời Sống', 1),
  ('technology', 'en', 'Technology & Social Media', 2),
  ('technology', 'vi', 'Công Nghệ & Mạng Xã Hội', 2),
  ('society', 'en', 'Society & Culture', 3),
  ('society', 'vi', 'Xã Hội & Văn Hóa', 3),
  ('environment', 'en', 'Environment & Sustainability', 4),
  ('environment', 'vi', 'Môi Trường & Bền Vững', 4),
  ('ethics', 'en', 'Ethics & Philosophy', 5),
  ('ethics', 'vi', 'Đạo Đức & Triết Học', 5),
  ('vietnam', 'en', 'Vietnam-Specific Issues', 6),
  ('vietnam', 'vi', 'Vấn Đề Việt Nam', 6)
on conflict (category_key, language) do update
set label = excluded.label,
    display_order = excluded.display_order,
    updated_at = now();

insert into public.practice_topics (
  topic_key,
  category_key,
  difficulty,
  display_order
)
values
  ('edu-01', 'education', 'beginner', 1),
  ('edu-02', 'education', 'intermediate', 2),
  ('edu-03', 'education', 'advanced', 3),
  ('edu-04', 'education', 'beginner', 4),
  ('edu-05', 'education', 'intermediate', 5),
  ('edu-06', 'education', 'beginner', 6),
  ('tech-01', 'technology', 'beginner', 7),
  ('tech-02', 'technology', 'advanced', 8),
  ('tech-03', 'technology', 'beginner', 9),
  ('tech-04', 'technology', 'intermediate', 10),
  ('tech-05', 'technology', 'intermediate', 11),
  ('tech-06', 'technology', 'advanced', 12),
  ('soc-01', 'society', 'intermediate', 13),
  ('soc-02', 'society', 'intermediate', 14),
  ('soc-03', 'society', 'beginner', 15),
  ('soc-04', 'society', 'intermediate', 16),
  ('soc-05', 'society', 'beginner', 17),
  ('soc-06', 'society', 'advanced', 18),
  ('env-01', 'environment', 'advanced', 19),
  ('env-02', 'environment', 'beginner', 20),
  ('env-03', 'environment', 'beginner', 21),
  ('env-04', 'environment', 'advanced', 22),
  ('env-05', 'environment', 'intermediate', 23),
  ('eth-01', 'ethics', 'advanced', 24),
  ('eth-02', 'ethics', 'intermediate', 25),
  ('eth-03', 'ethics', 'intermediate', 26),
  ('eth-04', 'ethics', 'advanced', 27),
  ('eth-05', 'ethics', 'intermediate', 28),
  ('vn-01', 'vietnam', 'intermediate', 29),
  ('vn-02', 'vietnam', 'beginner', 30),
  ('vn-03', 'vietnam', 'advanced', 31),
  ('vn-04', 'vietnam', 'beginner', 32),
  ('vn-05', 'vietnam', 'intermediate', 33)
on conflict (topic_key) do update
set category_key = excluded.category_key,
    difficulty = excluded.difficulty,
    display_order = excluded.display_order,
    updated_at = now();

insert into public.practice_topic_translations (
  topic_key,
  language,
  title,
  context
)
values
  ('edu-01', 'en', $$Homework should be abolished in high schools$$, $$Many educators debate whether homework improves learning outcomes or simply adds unnecessary stress to students' lives.$$),
  ('edu-01', 'vi', $$Nên bãi bỏ bài tập về nhà ở bậc trung học$$, $$Nhiều nhà giáo dục tranh luận liệu bài tập về nhà có thật sự cải thiện kết quả học tập hay chỉ tạo thêm căng thẳng không cần thiết cho học sinh.$$),
  ('edu-02', 'en', $$Online learning is more effective than traditional classroom learning$$, $$The COVID-19 pandemic accelerated the adoption of online learning, sparking debate about its long-term effectiveness compared to in-person education.$$),
  ('edu-02', 'vi', $$Học trực tuyến hiệu quả hơn học trong lớp truyền thống$$, $$Đại dịch COVID-19 thúc đẩy học trực tuyến, làm dấy lên tranh luận về hiệu quả lâu dài của nó so với giáo dục trực tiếp.$$),
  ('edu-03', 'en', $$Students should be allowed to use AI tools for schoolwork$$, $$With the rise of ChatGPT and similar AI tools, schools worldwide are grappling with whether to embrace or restrict AI in academic settings.$$),
  ('edu-03', 'vi', $$Học sinh nên được phép dùng công cụ AI cho bài tập$$, $$Sự xuất hiện của ChatGPT và các công cụ AI tương tự khiến trường học trên thế giới phải cân nhắc nên chấp nhận hay hạn chế AI trong học tập.$$),
  ('edu-04', 'en', $$Gap years should be encouraged before university$$, $$Gap years between high school and university are common in Western countries but remain unusual in many Asian education systems.$$),
  ('edu-04', 'vi', $$Nên khuyến khích học sinh gap year trước đại học$$, $$Gap year giữa trung học và đại học phổ biến ở nhiều nước phương Tây nhưng vẫn chưa quen thuộc trong nhiều hệ thống giáo dục châu Á.$$),
  ('edu-05', 'en', $$Standardized testing should be replaced with project-based assessment$$, $$Critics argue standardized tests measure memorization rather than real understanding, while supporters value their objectivity and scalability.$$),
  ('edu-05', 'vi', $$Nên thay thế thi chuẩn hóa bằng đánh giá theo dự án$$, $$Người phản đối cho rằng bài thi chuẩn hóa đo khả năng ghi nhớ hơn là hiểu sâu, trong khi người ủng hộ đánh giá cao tính khách quan và khả năng so sánh.$$),
  ('edu-06', 'en', $$Schools should teach financial literacy as a mandatory subject$$, $$Many young adults struggle with personal finance, leading to calls for schools to include financial education in their core curriculum.$$),
  ('edu-06', 'vi', $$Trường học nên dạy tài chính cá nhân như môn bắt buộc$$, $$Nhiều người trẻ gặp khó khăn với tài chính cá nhân, dẫn đến lời kêu gọi đưa giáo dục tài chính vào chương trình chính khóa.$$),
  ('tech-01', 'en', $$Social media does more harm than good for teenagers$$, $$Research links heavy social media use to rising rates of anxiety, depression, and cyberbullying among teenagers worldwide.$$),
  ('tech-01', 'vi', $$Mạng xã hội gây hại nhiều hơn lợi cho thanh thiếu niên$$, $$Nghiên cứu liên hệ việc dùng mạng xã hội nhiều với lo âu, trầm cảm và bắt nạt mạng ngày càng tăng ở thanh thiếu niên trên toàn cầu.$$),
  ('tech-02', 'en', $$Artificial intelligence will replace most human jobs$$, $$AI automation is transforming industries from manufacturing to creative work, raising questions about the future of human employment.$$),
  ('tech-02', 'vi', $$Trí tuệ nhân tạo sẽ thay thế phần lớn công việc của con người$$, $$Tự động hóa bằng AI đang thay đổi các ngành từ sản xuất đến sáng tạo, đặt ra câu hỏi về tương lai việc làm của con người.$$),
  ('tech-03', 'en', $$Smartphones should be banned in schools$$, $$Several countries have implemented smartphone bans in schools, citing improved focus and social interaction among students.$$),
  ('tech-03', 'vi', $$Nên cấm điện thoại thông minh trong trường học$$, $$Một số quốc gia đã cấm điện thoại trong trường, với lý do cải thiện sự tập trung và tương tác xã hội của học sinh.$$),
  ('tech-04', 'en', $$The government should regulate social media platforms$$, $$Governments worldwide are debating how to regulate tech companies to protect users while preserving innovation and free speech.$$),
  ('tech-04', 'vi', $$Chính phủ nên quản lý các nền tảng mạng xã hội$$, $$Các chính phủ đang tranh luận cách quản lý công ty công nghệ để bảo vệ người dùng mà vẫn giữ đổi mới và tự do ngôn luận.$$),
  ('tech-05', 'en', $$Technology is making people less creative$$, $$While technology provides powerful creative tools, critics argue it promotes consumption over creation and homogenizes culture.$$),
  ('tech-05', 'vi', $$Công nghệ đang làm con người kém sáng tạo hơn$$, $$Dù công nghệ cung cấp công cụ sáng tạo mạnh mẽ, nhiều người cho rằng nó khuyến khích tiêu thụ hơn sáng tạo và làm văn hóa trở nên đồng dạng.$$),
  ('tech-06', 'en', $$Online privacy is more important than national security$$, $$Governments argue that surveillance programs are necessary for security, while privacy advocates warn of overreach and abuse of power.$$),
  ('tech-06', 'vi', $$Quyền riêng tư trực tuyến quan trọng hơn an ninh quốc gia$$, $$Chính phủ cho rằng chương trình giám sát cần thiết cho an ninh, trong khi người bảo vệ quyền riêng tư cảnh báo nguy cơ lạm quyền.$$),
  ('soc-01', 'en', $$The voting age should be lowered to 16$$, $$Several countries and cities have lowered the voting age to 16, arguing that teenagers are informed enough to participate in democracy.$$),
  ('soc-01', 'vi', $$Nên hạ tuổi bầu cử xuống 16$$, $$Một số quốc gia và thành phố đã hạ tuổi bầu cử xuống 16, cho rằng thanh thiếu niên đủ hiểu biết để tham gia dân chủ.$$),
  ('soc-02', 'en', $$Fast fashion should be banned$$, $$Fast fashion brands produce cheap, trendy clothing at enormous environmental and human cost, with millions of tons of textile waste generated annually.$$),
  ('soc-02', 'vi', $$Nên cấm thời trang nhanh$$, $$Các thương hiệu thời trang nhanh sản xuất quần áo rẻ và theo xu hướng với chi phí môi trường và nhân quyền rất lớn, tạo ra hàng triệu tấn rác dệt may mỗi năm.$$),
  ('soc-03', 'en', $$Public transportation should be free$$, $$Some cities have experimented with free public transit to reduce car usage, lower emissions, and improve access for low-income residents.$$),
  ('soc-03', 'vi', $$Giao thông công cộng nên miễn phí$$, $$Một số thành phố thử miễn phí giao thông công cộng để giảm dùng xe cá nhân, giảm phát thải và tăng khả năng tiếp cận cho người thu nhập thấp.$$),
  ('soc-04', 'en', $$Animal testing should be completely banned$$, $$Over 100 million animals are used in laboratory testing annually for medical research, cosmetics, and product safety.$$),
  ('soc-04', 'vi', $$Nên cấm hoàn toàn thử nghiệm trên động vật$$, $$Mỗi năm hơn 100 triệu động vật được dùng trong phòng thí nghiệm cho nghiên cứu y khoa, mỹ phẩm và an toàn sản phẩm.$$),
  ('soc-05', 'en', $$Community service should be mandatory for graduation$$, $$Some schools require students to complete community service hours before graduating, aiming to build civic responsibility and empathy.$$),
  ('soc-05', 'vi', $$Phục vụ cộng đồng nên là điều kiện bắt buộc để tốt nghiệp$$, $$Một số trường yêu cầu học sinh hoàn thành giờ phục vụ cộng đồng trước khi tốt nghiệp nhằm xây dựng trách nhiệm công dân và sự đồng cảm.$$),
  ('soc-06', 'en', $$Cancel culture does more harm than good$$, $$Cancel culture refers to the practice of withdrawing support from public figures who have done or said something objectionable, often via social media campaigns.$$),
  ('soc-06', 'vi', $$Văn hóa tẩy chay gây hại nhiều hơn lợi$$, $$Văn hóa tẩy chay là việc rút lại ủng hộ đối với người nổi tiếng hoặc nhân vật công chúng vì lời nói hay hành động bị cho là sai trái, thường qua chiến dịch mạng xã hội.$$),
  ('env-01', 'en', $$Nuclear energy is the best solution to climate change$$, $$Nuclear power produces minimal carbon emissions but raises concerns about safety, waste disposal, and the risk of catastrophic accidents.$$),
  ('env-01', 'vi', $$Năng lượng hạt nhân là giải pháp tốt nhất cho biến đổi khí hậu$$, $$Điện hạt nhân tạo rất ít phát thải carbon nhưng gây lo ngại về an toàn, xử lý chất thải và nguy cơ tai nạn thảm khốc.$$),
  ('env-02', 'en', $$Individual actions can make a significant impact on climate change$$, $$While corporations produce the majority of emissions, individuals are encouraged to reduce their carbon footprint through lifestyle changes.$$),
  ('env-02', 'vi', $$Hành động cá nhân có thể tạo tác động đáng kể đến biến đổi khí hậu$$, $$Dù doanh nghiệp tạo phần lớn phát thải, cá nhân vẫn được khuyến khích giảm dấu chân carbon thông qua thay đổi lối sống.$$),
  ('env-03', 'en', $$Plastic should be completely banned$$, $$Over 300 million tons of plastic are produced annually, with much of it ending up in oceans and landfills, taking centuries to decompose.$$),
  ('env-03', 'vi', $$Nên cấm hoàn toàn nhựa$$, $$Hơn 300 triệu tấn nhựa được sản xuất mỗi năm, phần lớn kết thúc ở đại dương và bãi rác, mất hàng thế kỷ để phân hủy.$$),
  ('env-04', 'en', $$Developed countries should pay climate reparations to developing nations$$, $$Developing nations bear the worst effects of climate change despite contributing the least to historical emissions, sparking calls for climate justice.$$),
  ('env-04', 'vi', $$Các nước phát triển nên bồi thường khí hậu cho các nước đang phát triển$$, $$Các nước đang phát triển chịu tác động nặng nhất của biến đổi khí hậu dù đóng góp ít nhất vào phát thải lịch sử, làm dấy lên yêu cầu công lý khí hậu.$$),
  ('env-05', 'en', $$Electric vehicles should be mandatory by 2035$$, $$Several countries have announced plans to ban new internal combustion engine vehicle sales by 2035, pushing for full EV adoption.$$),
  ('env-05', 'vi', $$Xe điện nên trở thành bắt buộc vào năm 2035$$, $$Một số quốc gia đã công bố kế hoạch cấm bán xe động cơ đốt trong mới vào năm 2035, thúc đẩy chuyển đổi hoàn toàn sang xe điện.$$),
  ('eth-01', 'en', $$The ends justify the means$$, $$This classic philosophical debate pits consequentialism against deontological ethics, asking whether outcomes alone determine the morality of actions.$$),
  ('eth-01', 'vi', $$Mục đích biện minh cho phương tiện$$, $$Cuộc tranh luận triết học kinh điển này đặt chủ nghĩa hệ quả đối lập với đạo đức bổn phận, hỏi liệu kết quả có quyết định toàn bộ tính đạo đức của hành động hay không.$$),
  ('eth-02', 'en', $$Freedom of speech should have no limits$$, $$Free speech is considered a fundamental right, but debates continue about whether hate speech, misinformation, and incitement should be restricted.$$),
  ('eth-02', 'vi', $$Tự do ngôn luận không nên có bất kỳ giới hạn nào$$, $$Tự do ngôn luận được xem là quyền cơ bản, nhưng tranh luận vẫn tiếp diễn về việc có nên hạn chế ngôn từ thù ghét, tin giả và kích động hay không.$$),
  ('eth-03', 'en', $$It is ethical to eat meat$$, $$The ethics of meat consumption are debated from perspectives of animal welfare, environmental impact, cultural traditions, and nutritional needs.$$),
  ('eth-03', 'vi', $$Ăn thịt là có đạo đức$$, $$Đạo đức của việc ăn thịt được tranh luận từ góc độ phúc lợi động vật, tác động môi trường, truyền thống văn hóa và nhu cầu dinh dưỡng.$$),
  ('eth-04', 'en', $$Censorship is never justified in a democracy$$, $$Democracies value free expression but often restrict content related to national security, public safety, or vulnerable populations.$$),
  ('eth-04', 'vi', $$Kiểm duyệt không bao giờ chính đáng trong nền dân chủ$$, $$Dân chủ coi trọng tự do biểu đạt nhưng vẫn thường hạn chế nội dung liên quan đến an ninh quốc gia, an toàn công cộng hoặc nhóm dễ bị tổn thương.$$),
  ('eth-05', 'en', $$Civil disobedience is a valid form of protest$$, $$From Gandhi to Martin Luther King Jr., civil disobedience has been used to challenge unjust laws, but critics argue it undermines the rule of law.$$),
  ('eth-05', 'vi', $$Bất tuân dân sự là một hình thức phản đối hợp lệ$$, $$Từ Gandhi đến Martin Luther King Jr., bất tuân dân sự được dùng để thách thức luật bất công, nhưng người phản đối cho rằng nó làm suy yếu pháp quyền.$$),
  ('vn-01', 'en', $$Vietnam should adopt a 4-day work week$$, $$Several countries are trialing 4-day work weeks with positive results, but Vietnam's developing economy raises questions about whether it's practical.$$),
  ('vn-01', 'vi', $$Việt Nam nên áp dụng tuần làm việc 4 ngày$$, $$Một số quốc gia đang thử tuần làm việc 4 ngày với kết quả tích cực, nhưng nền kinh tế đang phát triển của Việt Nam đặt ra câu hỏi về tính thực tế.$$),
  ('vn-02', 'en', $$Vietnamese students face too much academic pressure$$, $$Vietnamese students often attend multiple tutoring classes outside school hours, with intense pressure to perform well on national exams.$$),
  ('vn-02', 'vi', $$Học sinh Việt Nam chịu quá nhiều áp lực học tập$$, $$Học sinh Việt Nam thường học thêm nhiều lớp ngoài giờ, với áp lực lớn để đạt kết quả cao trong các kỳ thi quốc gia.$$),
  ('vn-03', 'en', $$English should become a second official language in Vietnam$$, $$Vietnam has invested heavily in English education, with English being taught from primary school, but it lacks official language status.$$),
  ('vn-03', 'vi', $$Tiếng Anh nên trở thành ngôn ngữ chính thức thứ hai ở Việt Nam$$, $$Việt Nam đầu tư mạnh vào giáo dục tiếng Anh, dạy tiếng Anh từ tiểu học, nhưng tiếng Anh chưa có địa vị ngôn ngữ chính thức.$$),
  ('vn-04', 'en', $$Vietnam's education system focuses too much on memorization$$, $$While Vietnam performs well on international tests, critics argue the education system prioritizes rote learning over critical thinking and creativity.$$),
  ('vn-04', 'vi', $$Hệ thống giáo dục Việt Nam quá chú trọng học thuộc$$, $$Dù Việt Nam đạt kết quả tốt trong các bài kiểm tra quốc tế, nhiều người cho rằng hệ thống giáo dục ưu tiên học vẹt hơn tư duy phản biện và sáng tạo.$$),
  ('vn-05', 'en', $$Tourism does more harm than good to Vietnamese culture$$, $$Vietnam's tourism industry has grown rapidly, bringing economic benefits but also concerns about cultural commodification and environmental damage.$$),
  ('vn-05', 'vi', $$Du lịch gây hại nhiều hơn lợi cho văn hóa Việt Nam$$, $$Ngành du lịch Việt Nam phát triển nhanh, mang lại lợi ích kinh tế nhưng cũng gây lo ngại về thương mại hóa văn hóa và tổn hại môi trường.$$
)
on conflict (topic_key, language) do update
set title = excluded.title,
    context = excluded.context,
    updated_at = now();

alter table public.debate_sessions
  add column if not exists practice_topic_key text,
  add column if not exists topic_category_key text;

alter table public.practice_session_drafts
  add column if not exists practice_topic_key text,
  add column if not exists topic_category_key text;

alter table public.debate_duels
  add column if not exists practice_topic_key text,
  add column if not exists topic_category_key text;

alter table public.debate_duel_matchmaking_tickets
  add column if not exists topic_category_key text;

update public.debate_sessions sessions
set practice_topic_key = translations.topic_key
from public.practice_topic_translations translations
where sessions.practice_topic_key is null
  and lower(sessions.topic_title) = lower(translations.title);

update public.practice_session_drafts drafts
set practice_topic_key = translations.topic_key
from public.practice_topic_translations translations
where drafts.practice_topic_key is null
  and lower(drafts.topic_title) = lower(translations.title);

update public.practice_session_drafts drafts
set practice_topic_key = drafts.topic_id
where drafts.practice_topic_key is null
  and exists (
    select 1
    from public.practice_topics topics
    where topics.topic_key = drafts.topic_id
  );

update public.debate_duels duels
set practice_topic_key = translations.topic_key
from public.practice_topic_translations translations
where duels.practice_topic_key is null
  and lower(duels.topic_title) = lower(translations.title);

update public.debate_sessions sessions
set topic_category_key = categories.category_key
from public.practice_topic_category_translations categories
where sessions.topic_category_key is null
  and lower(sessions.topic_category) = lower(categories.label);

update public.practice_session_drafts drafts
set topic_category_key = categories.category_key
from public.practice_topic_category_translations categories
where drafts.topic_category_key is null
  and lower(drafts.topic_category) = lower(categories.label);

update public.debate_duels duels
set topic_category_key = categories.category_key
from public.practice_topic_category_translations categories
where duels.topic_category_key is null
  and lower(duels.topic_category) = lower(categories.label);

update public.debate_duel_matchmaking_tickets tickets
set topic_category_key = categories.category_key
from public.practice_topic_category_translations categories
where tickets.topic_category_key is null
  and lower(tickets.topic_category) = lower(categories.label);

update public.debate_duel_matchmaking_tickets
set topic_category_key = 'education'
where topic_category_key is null;

alter table public.debate_duel_matchmaking_tickets
  alter column topic_category_key set default 'education',
  alter column topic_category_key set not null;

create index if not exists idx_debate_sessions_user_topic_key_created
  on public.debate_sessions(user_id, practice_topic_key, created_at desc);

create index if not exists idx_practice_session_drafts_user_topic_key
  on public.practice_session_drafts(user_id, practice_topic_key);

create index if not exists idx_debate_duels_topic_key_created
  on public.debate_duels(practice_topic_key, created_at desc);

create index if not exists idx_duel_matchmaking_language_category_key_queue
  on public.debate_duel_matchmaking_tickets(
    practice_language,
    topic_category_key,
    topic_difficulty,
    prep_time_seconds,
    opening_time_seconds,
    rebuttal_time_seconds,
    created_at
  )
  where status = 'queued';

with normalized_profiles as (
  select
    id,
    case
      when preferences ->> 'preferred_locale' in ('en', 'vi') then preferences ->> 'preferred_locale'
      when preferences ->> 'practice_language' in ('en', 'vi') then preferences ->> 'practice_language'
      else 'vi'
    end as language
  from public.profiles
)
update public.profiles profiles
set preferences = jsonb_set(
  jsonb_set(
    coalesce(profiles.preferences, '{}'::jsonb),
    '{preferred_locale}',
    to_jsonb(normalized_profiles.language),
    true
  ),
  '{practice_language}',
  to_jsonb(normalized_profiles.language),
  true
)
from normalized_profiles
where profiles.id = normalized_profiles.id
  and (
    profiles.preferences ->> 'preferred_locale' is distinct from normalized_profiles.language
    or profiles.preferences ->> 'practice_language' is distinct from normalized_profiles.language
  );

drop function if exists public.enter_debate_duel_matchmaking(
  uuid, text, text, text, text, text, integer, integer, integer
);

drop function if exists public.enter_debate_duel_matchmaking(
  uuid, text, text, text, text, integer, integer, integer
);

create or replace function public.enter_debate_duel_matchmaking(
  p_actor_user_id uuid,
  p_topic_category text,
  p_topic_category_key text,
  p_practice_topic_key text,
  p_topic_difficulty text,
  p_topic_title text,
  p_topic_description text,
  p_practice_language text default 'en',
  p_prep_time_seconds integer default 120,
  p_opening_time_seconds integer default 180,
  p_rebuttal_time_seconds integer default 120
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ticket public.debate_duel_matchmaking_tickets%rowtype;
  v_opponent public.debate_duel_matchmaking_tickets%rowtype;
  v_share_code text;
  v_duel_id uuid;
  v_actor_profile public.profiles%rowtype;
  v_opponent_profile public.profiles%rowtype;
  v_actor_role text;
  v_opponent_role text;
  v_practice_language text := coalesce(p_practice_language, 'en');
  v_topic_category_key text := coalesce(nullif(p_topic_category_key, ''), 'education');
begin
  if auth.uid() is null or auth.uid() <> p_actor_user_id then
    raise exception 'FORBIDDEN';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_actor_user_id::text));

  if p_topic_difficulty not in ('beginner', 'intermediate', 'advanced') then
    raise exception 'INVALID_DIFFICULTY';
  end if;

  if v_practice_language not in ('en', 'vi') then
    v_practice_language := 'en';
  end if;

  if v_topic_category_key not in (
    'education',
    'technology',
    'society',
    'environment',
    'ethics',
    'vietnam'
  ) then
    v_topic_category_key := 'education';
  end if;

  update public.debate_duel_matchmaking_tickets
  set status = 'expired',
      updated_at = now()
  where status = 'queued'
    and expires_at <= now();

  select * into v_ticket
  from public.debate_duel_matchmaking_tickets
  where user_id = p_actor_user_id
    and status = 'queued'
    and expires_at > now()
  for update;

  if found then
    update public.debate_duel_matchmaking_tickets
    set topic_category = p_topic_category,
        topic_category_key = v_topic_category_key,
        topic_difficulty = p_topic_difficulty,
        practice_language = v_practice_language,
        prep_time_seconds = p_prep_time_seconds,
        opening_time_seconds = p_opening_time_seconds,
        rebuttal_time_seconds = p_rebuttal_time_seconds,
        expires_at = now() + interval '10 minutes',
        updated_at = now()
    where id = v_ticket.id
    returning * into v_ticket;
  else
    insert into public.debate_duel_matchmaking_tickets (
      user_id,
      topic_category,
      topic_category_key,
      topic_difficulty,
      practice_language,
      prep_time_seconds,
      opening_time_seconds,
      rebuttal_time_seconds
    )
    values (
      p_actor_user_id,
      p_topic_category,
      v_topic_category_key,
      p_topic_difficulty,
      v_practice_language,
      p_prep_time_seconds,
      p_opening_time_seconds,
      p_rebuttal_time_seconds
    )
    returning * into v_ticket;
  end if;

  select * into v_opponent
  from public.debate_duel_matchmaking_tickets
  where status = 'queued'
    and id <> v_ticket.id
    and user_id <> p_actor_user_id
    and expires_at > now()
    and topic_category_key = v_ticket.topic_category_key
    and topic_difficulty = v_ticket.topic_difficulty
    and practice_language = v_ticket.practice_language
    and prep_time_seconds = v_ticket.prep_time_seconds
    and opening_time_seconds = v_ticket.opening_time_seconds
    and rebuttal_time_seconds = v_ticket.rebuttal_time_seconds
  order by created_at asc
  for update skip locked
  limit 1;

  if not found then
    return v_ticket.id;
  end if;

  v_share_code := public.generate_duel_share_code();

  insert into public.debate_duels (
    share_code,
    creator_id,
    practice_topic_key,
    topic_title,
    topic_category,
    topic_category_key,
    topic_difficulty,
    topic_description,
    practice_language,
    prep_time_seconds,
    opening_time_seconds,
    rebuttal_time_seconds,
    entry_cost,
    side_assignment_mode,
    duel_kind,
    rated
  )
  values (
    v_share_code,
    p_actor_user_id,
    p_practice_topic_key,
    p_topic_title,
    p_topic_category,
    v_topic_category_key,
    p_topic_difficulty,
    p_topic_description,
    v_ticket.practice_language,
    v_ticket.prep_time_seconds,
    v_ticket.opening_time_seconds,
    v_ticket.rebuttal_time_seconds,
    200,
    'random',
    'matchmaking',
    true
  )
  returning id into v_duel_id;

  if (ascii(substr(md5(v_ticket.id::text || v_opponent.id::text), 1, 1)) % 2) = 0 then
    v_actor_role := 'proposition';
  else
    v_actor_role := 'opposition';
  end if;
  v_opponent_role := case when v_actor_role = 'proposition' then 'opposition' else 'proposition' end;

  select * into v_actor_profile from public.profiles where id = p_actor_user_id;
  select * into v_opponent_profile from public.profiles where id = v_opponent.user_id;

  insert into public.debate_duel_participants (
    duel_id,
    user_id,
    role,
    display_name_snapshot,
    avatar_url_snapshot
  )
  values
    (
      v_duel_id,
      p_actor_user_id,
      v_actor_role,
      coalesce(v_actor_profile.display_name, 'Debater'),
      v_actor_profile.avatar_url
    ),
    (
      v_duel_id,
      v_opponent.user_id,
      v_opponent_role,
      coalesce(v_opponent_profile.display_name, 'Debater'),
      v_opponent_profile.avatar_url
    );

  update public.debate_duel_matchmaking_tickets
  set status = 'matched',
      matched_duel_id = v_duel_id,
      matched_ticket_id = v_opponent.id,
      matched_at = now(),
      updated_at = now()
  where id = v_ticket.id;

  update public.debate_duel_matchmaking_tickets
  set status = 'matched',
      matched_duel_id = v_duel_id,
      matched_ticket_id = v_ticket.id,
      matched_at = now(),
      updated_at = now()
  where id = v_opponent.id;

  return v_ticket.id;
end;
$$;

revoke execute on function public.enter_debate_duel_matchmaking(
  uuid, text, text, text, text, text, text, text, integer, integer, integer
) from public;
revoke execute on function public.enter_debate_duel_matchmaking(
  uuid, text, text, text, text, text, text, text, integer, integer, integer
) from anon;
grant execute on function public.enter_debate_duel_matchmaking(
  uuid, text, text, text, text, text, text, text, integer, integer, integer
) to authenticated, service_role;
