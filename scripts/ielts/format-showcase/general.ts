/**
 * Format-showcase General Training mock — original content.
 * Reading Section 1 (three short notices, 14 Q), Writing (letter + essay),
 * Speaking (three-part set). No Listening in this fixture.
 */
import type { AuthoredBankOption, AuthoredGroup, AuthoredPassage, AuthoredQuestion, AuthoredTest } from "./types";

/** Mirrors GT_READING_BAND_CONVERSION_KEY in scripts/ielts/general-training-mocks-01-04.ts. */
export const GT_BAND_CONVERSION_KEY = "general_training";

const NOTICE_A = `Meadowfield Leisure Centre – Pool Timetable

Monday to Friday
6.30–8.00 Early lane swimming (adults only)
8.00–9.30 School lessons – pool closed to the public
9.30–12.00 Public swimming
12.00–13.30 Lunchtime lane swimming
13.30–15.30 Public swimming
15.30–18.00 Lessons and club training – pool closed to the public
18.00–21.00 Public swimming (family session on Wednesdays)

Saturday and Sunday
Public swimming 8.00–17.00. Inflatable fun session on Sundays 14.00–16.00; children under eight must be accompanied in the water by an adult.

Lane swimming sessions require a valid membership card or a lane ticket bought at reception. The small pool is closed on Mondays for cleaning. During school holidays the timetable changes: see the notice board or the website for details.`;

const NOTICE_B = `Harbour View Apartments – Recycling Notice

From 1 April the building will use a three-bin system in the ground-floor bin store.

Blue bin: paper and card. Please flatten boxes. Pizza boxes with food on them go in the general waste.
Green bin: glass bottles and jars, rinsed and without lids.
Yellow bin: plastic bottles, tins and cans. Plastic bags and film are not accepted and will result in the whole bin being rejected by the council.

Food waste caddies are available free from the caretaker's office, and the caddy liners are also free.

Large items such as furniture and mattresses must not be left in the bin store. Contact the council's bulky waste service, which collects from the front gate on Thursdays for a small charge.

The bin store is locked between 10 p.m. and 7 a.m. Residents who want a key should ask the caretaker.`;

const NOTICE_C = `Northgate Adult Learning – Evening Class Enrolment

Enrolment for the spring term opens on Monday 12 January and closes when classes are full. You can enrol online, by telephone or in person at the Northgate office between 9 a.m. and 5 p.m. on weekdays.

Fees must be paid in full at enrolment. A 20 percent discount applies to learners over 65 and to anyone receiving a means-tested benefit; proof must be shown at the office within seven days of enrolling online.

Most classes run for ten weeks. If a class is cancelled by the centre, learners receive a full refund. If a learner withdraws after the first session, no refund is given, but the fee can be transferred to another course starting in the same term.

Materials for art and cookery classes are not included in the fee. A list of what to bring is sent by email one week before the first session.`;

const passages: AuthoredPassage[] = [
  { importId: "fsg-s1-a", orderIndex: 0, title: "Meadowfield Leisure Centre – Pool Timetable", body: NOTICE_A, genre: "timetable" },
  { importId: "fsg-s1-b", orderIndex: 1, title: "Harbour View Apartments – Recycling Notice", body: NOTICE_B, genre: "notice" },
  { importId: "fsg-s1-c", orderIndex: 2, title: "Northgate Adult Learning – Evening Class Enrolment", body: NOTICE_C, genre: "notice" },
];

const groups: AuthoredGroup[] = [
  {
    importId: "fsg-g-s1-info",
    groupKey: "g1-info",
    skill: "reading",
    orderIndex: 0,
    title: "Questions 1–7",
    instructions:
      "Look at the three notices, A–C, on the following pages. For which notice are the following statements true? Write the correct letter, A, B or C, next to Questions 1–7. NB You may use any letter more than once.",
    answerMode: "select",
    bankReuse: true,
    bank: [
      { id: "A", label: "A", text: "Meadowfield Leisure Centre – Pool Timetable" },
      { id: "B", label: "B", text: "Harbour View Apartments – Recycling Notice" },
      { id: "C", label: "C", text: "Northgate Adult Learning – Evening Class Enrolment" },
    ],
  },
  {
    importId: "fsg-g-s1-tfng",
    groupKey: "g1-tfng",
    skill: "reading",
    passageImportId: "fsg-s1-c",
    orderIndex: 1,
    title: "Questions 8–14",
    instructions:
      "Do the following statements agree with the information given in the Northgate Adult Learning notice? Write TRUE if the statement agrees with the information, FALSE if the statement contradicts the information, or NOT GIVEN if there is no information on this.",
    answerMode: "select",
  },
];

const TFNG_OPTIONS: AuthoredBankOption[] = [
  { id: "true", label: "TRUE", text: "TRUE" },
  { id: "false", label: "FALSE", text: "FALSE" },
  { id: "not_given", label: "NOT GIVEN", text: "NOT GIVEN" },
];

const infoRows = [
  [1, "Something is provided without charge.", "B", "fsg-s1-b", "Food waste caddies are available free", "The recycling notice says caddies and liners are free.", "Thông báo tái chế nói thùng rác thực phẩm và túi lót đều miễn phí."],
  [2, "There is a fee for a collection service.", "B", "fsg-s1-b", "collects from the front gate on Thursdays for a small charge", "The bulky waste service collects for a small charge.", "Dịch vụ thu gom rác cồng kềnh thu phí nhỏ."],
  [3, "Older people pay a reduced price.", "C", "fsg-s1-c", "A 20 percent discount applies to learners over 65", "Learners over 65 get a 20 percent discount.", "Học viên trên 65 tuổi được giảm 20 phần trăm."],
  [4, "Children must be supervised by an adult during one session.", "A", "fsg-s1-a", "children under eight must be accompanied in the water by an adult", "The inflatable session requires an adult with under-eights.", "Buổi chơi phao bơm hơi yêu cầu người lớn đi kèm trẻ dưới tám tuổi."],
  [5, "A facility is unavailable one day a week because of maintenance.", "A", "fsg-s1-a", "The small pool is closed on Mondays for cleaning", "The small pool closes on Mondays for cleaning.", "Bể nhỏ đóng cửa thứ Hai để vệ sinh."],
  [6, "Part of an item must be removed before it is recycled.", "B", "fsg-s1-b", "rinsed and without lids", "Glass must be recycled without lids.", "Đồ thuỷ tinh phải được tái chế không có nắp."],
  [7, "Information will be sent out shortly before something begins.", "C", "fsg-s1-c", "A list of what to bring is sent by email one week before the first session", "A list of materials is emailed a week before the first class.", "Danh sách vật dụng được gửi email một tuần trước buổi học đầu."],
] as const;

const tfngRows = [
  [8, "Enrolment closes on a fixed date.", "false", "closes when classes are full", "Enrolment closes when classes are full, not on a set date.", "Ghi danh kết thúc khi lớp đầy, không phải vào ngày cố định."],
  [9, "It is possible to enrol without visiting the office.", "true", "You can enrol online, by telephone or in person", "Online and telephone enrolment are both available.", "Có thể ghi danh trực tuyến hoặc qua điện thoại."],
  [10, "Learners over 65 pay less than the standard fee.", "true", "A 20 percent discount applies to learners over 65", "A 20 percent discount applies to over-65s.", "Người trên 65 tuổi được giảm 20 phần trăm."],
  [11, "Proof of a benefit must be shown before enrolling online.", "false", "proof must be shown at the office within seven days of enrolling online", "Proof is shown within seven days after enrolling online, not before.", "Bằng chứng được xuất trình trong vòng bảy ngày sau khi ghi danh trực tuyến, không phải trước."],
  [12, "Cancelled classes are normally rescheduled for a later date.", "not_given", "If a class is cancelled by the centre, learners receive a full refund", "The notice mentions refunds for cancelled classes but says nothing about rescheduling.", "Thông báo nói về hoàn tiền khi huỷ lớp nhưng không nói gì về việc dời lịch."],
  [13, "A learner who leaves a course after it has started can move the fee to a different course.", "true", "the fee can be transferred to another course starting in the same term", "The fee can be transferred to another course in the same term.", "Học phí có thể chuyển sang khoá khác trong cùng học kỳ."],
  [14, "Cookery classes take place in the centre's own kitchen.", "not_given", "Materials for art and cookery classes are not included in the fee", "Cookery classes are mentioned, but not where they are held.", "Lớp nấu ăn được nhắc đến nhưng không nói địa điểm tổ chức."],
] as const;

const readingQuestions: AuthoredQuestion[] = [
  ...infoRows.map(([n, prompt, key, passageImportId, support, en, vi]) => ({
    importId: `fsg-r-${String(n).padStart(2, "0")}`,
    skill: "reading" as const,
    questionType: "matching_information" as const,
    orderIndex: n - 1,
    passageImportId,
    groupKey: "g1-info",
    prompt,
    correctAnswer: key,
    support,
    explanationEn: en,
    explanationVi: vi,
  })),
  ...tfngRows.map(([n, prompt, key, support, en, vi]) => ({
    importId: `fsg-r-${String(n).padStart(2, "0")}`,
    skill: "reading" as const,
    questionType: "true_false_notgiven" as const,
    orderIndex: n - 1,
    passageImportId: "fsg-s1-c",
    groupKey: "g1-tfng",
    options: TFNG_OPTIONS,
    prompt,
    correctAnswer: key,
    support,
    explanationEn: en,
    explanationVi: vi,
  })),
];

const writingQuestions: AuthoredQuestion[] = [
  {
    importId: "fsg-w-1",
    skill: "writing",
    questionType: "writing_task1_general",
    orderIndex: 0,
    prompt:
      "Your neighbour is having building work done on their house, and the noise is causing you problems. Write a letter to your neighbour. In your letter: explain what the problem is, say how it is affecting you, and suggest what could be done about it. Write at least 150 words. You do NOT need to write any addresses. Begin your letter as follows: Dear ...,",
    wordLimit: 150,
    letter: {
      recipient: "your neighbour",
      register: "semi_formal",
      bullets: ["explain what the problem is", "say how it is affecting you", "suggest what could be done about it"],
    },
    explanationEn: "A semi-formal letter to someone you know slightly: polite, direct, and organised around the three bullets.",
    explanationVi: "Thư bán trang trọng gửi người bạn quen sơ: lịch sự, trực tiếp, và sắp xếp theo ba gạch đầu dòng.",
    modelAnswer:
      "Dear Mr Okafor,\n\nI hope the renovation is going well. I am writing because the building work on your house has started to cause some difficulties for us next door, and I wanted to raise it with you directly rather than through the council.\n\nThe main problem is the timing. On several mornings this week the drilling began before seven o'clock, and on Saturday it continued until after eight in the evening. The noise itself is expected with this kind of work, but the early starts are the real issue.\n\nMy wife works night shifts at the hospital and sleeps during the morning, so she has had almost no rest this week. I work from home, and it has been impossible to take calls in the front room, which faces your property.\n\nCould I suggest that the builders start no earlier than eight on weekdays and finish by six, with no work on Sundays? If you could also let us know in advance when the noisiest jobs, such as breaking up the drive, are planned, we could arrange to be out.\n\nThank you for your understanding, and please do come round if you would like to discuss this.\n\nBest wishes,\nDavid Lin",
    examinerNotes: {
      taskAchievement: "All three bullets are covered in separate, developed paragraphs; the purpose is stated at the start and the tone suits a neighbour.",
      coherenceCohesion: "Clear paragraphing; each paragraph moves from problem to effect to proposal, with natural linking.",
      lexicalResource: "Appropriate semi-formal register (raise it with you directly, cause some difficulties) without stiff formality.",
      grammaticalRange: "Accurate use of present perfect, modal requests (Could I suggest) and conditionals.",
    },
  },
  {
    importId: "fsg-w-2",
    skill: "writing",
    questionType: "writing_task2_essay",
    orderIndex: 1,
    prompt:
      "In many places, small local shops are closing because people prefer to buy from large online retailers. Do the advantages of this development outweigh the disadvantages? Give reasons for your answer and include any relevant examples from your own knowledge or experience. Write at least 250 words.",
    wordLimit: 250,
    explanationEn: "An advantages-versus-disadvantages essay: weigh both sides and state clearly which outweighs the other.",
    explanationVi: "Bài luận cân nhắc lợi và hại: xem xét cả hai mặt và nêu rõ mặt nào lớn hơn.",
    modelAnswer:
      "In towns across the world, familiar high-street shops are closing as customers move their spending to large online retailers. This shift brings genuine convenience, but I believe its disadvantages for communities are greater than its advantages.\n\nThe benefits are easy to see. Online shopping saves time, offers a far wider choice than any single shop can stock, and is often cheaper because large retailers buy in bulk. For people who live far from a town centre, or who find it hard to get about, the ability to order almost anything from home is a real improvement in their quality of life.\n\nHowever, the loss of local shops has costs that do not appear on a receipt. A street of empty units is not only unattractive; it removes the places where people meet by chance, and it takes jobs out of the area. Money spent in a local shop tends to stay local, paying wages and rent to people nearby, whereas money spent online largely leaves. There is also a practical loss: when a customer wants advice, a repair or a product they can examine before buying, no website can replace a knowledgeable shopkeeper.\n\nSome argue that this is simply progress and that shops must adapt or close. There is some truth in this, and the businesses that survive are often those that combine a shop with an online presence. Even so, the pace and scale of closures suggest that convenience alone is deciding the outcome, without much thought for what is lost.\n\nIn conclusion, although online retail brings real advantages, particularly for those who cannot easily reach a shop, I think the damage to local economies and community life outweighs them.",
    examinerNotes: {
      taskResponse: "A clear position is given and maintained; both sides are developed with specific examples and a counter-argument is acknowledged.",
      coherenceCohesion: "Logical paragraphing with a strong topic sentence in each; cohesion relies on reference and contrast rather than listing linkers.",
      lexicalResource: "Precise collocations (buy in bulk, empty units, knowledgeable shopkeeper) and idiomatic phrasing (do not appear on a receipt).",
      grammaticalRange: "Complex sentences with concession (although, even so), comparatives and cleft-free varied structures; accuracy is high.",
    },
  },
];

const SPEAKING_P1 = [
  ["Do you have any hobbies?", "Yes, I play the guitar, though not very well. I picked it up during a long summer when I had nothing to do, and it stuck. I mostly play at home in the evenings."],
  ["How did you become interested in this hobby?", "A friend lent me an old guitar and showed me three chords. That was enough to play a couple of songs I liked, and the feeling of actually making music, even badly, was addictive."],
  ["Is it a popular hobby in your country?", "Very. You see young people with guitars in parks and cafés everywhere, and there are lots of cheap instruments for sale. It is probably more common than learning the piano, which needs more space and money."],
  ["Do you think hobbies are important for adults?", "Definitely. Work fills most of the day, so having something you do purely because you enjoy it keeps you balanced. It is also one of the easiest ways to meet people outside your job."],
] as const;

const SPEAKING_P3 = [
  ["How has technology changed the way people spend their free time?", "Enormously. A lot of leisure has moved onto screens, whether that is streaming, gaming or scrolling, which is convenient but tends to be passive. At the same time, technology has made active hobbies easier to start, because you can learn almost anything from online videos."],
  ["Do you think people rely too much on their devices?", "For many people, yes. When a phone battery dies, some people genuinely cannot find their way home or remember a number. I do not think the devices themselves are the problem, but we have stopped practising skills that we used to have, and that leaves us vulnerable."],
  ["Should children be taught to use technology at school?", "They should be taught to use it critically, which is different from just using it. Most children can operate a tablet before they can read, so the school's job is to explain how information is produced, what is reliable, and when to put the device down."],
  ["What kinds of technology do you think will become common in the next twenty years?", "I expect things that are currently expensive, like home robots and electric vehicles, to become ordinary, in the way mobile phones did. I also think voice interfaces will replace a lot of typing. Whether that makes life better depends on how thoughtfully it is designed."],
] as const;

const speakingQuestions: AuthoredQuestion[] = [
  ...SPEAKING_P1.map(([prompt, model], i) => ({
    importId: `fsg-s-p1-${i + 1}`,
    skill: "speaking" as const,
    questionType: "speaking_part1" as const,
    orderIndex: i,
    prompt,
    explanationEn: "Part 1: a direct answer with one reason or short example.",
    explanationVi: "Phần 1: trả lời trực tiếp kèm một lý do hoặc ví dụ ngắn.",
    modelAnswer: model,
    examinerNotes: {
      fluencyCoherence: "Answers extend naturally without rambling.",
      lexicalResource: "Idiomatic but everyday language (picked it up, it stuck, addictive).",
      grammaticalRange: "Past simple and present forms mixed accurately.",
      pronunciation: "Clear consonant clusters and natural weak forms.",
    },
  })),
  {
    importId: "fsg-s-p2",
    skill: "speaking",
    questionType: "speaking_part2_cuecard",
    orderIndex: 4,
    prompt:
      "Describe a useful object that you own. You should say: what it is, how you got it, what you use it for, and explain why it is so useful to you.",
    cueCard: {
      topic: "Describe a useful object that you own.",
      bullets: ["what it is", "how you got it", "what you use it for"],
      closing: "and explain why it is so useful to you",
      prepSeconds: 60,
      speakSeconds: 120,
    },
    explanationEn: "Part 2: describe the object concretely, cover all bullets, and end with why it matters to you.",
    explanationVi: "Phần 2: mô tả đồ vật cụ thể, đề cập đủ các gạch đầu dòng, và kết bằng lý do nó quan trọng với bạn.",
    modelAnswer:
      "The object I want to describe is a small folding bicycle that I have owned for about three years. It is dark green, quite heavy for its size, and folds in half in about ten seconds. I bought it second-hand from a colleague who was moving abroad and could not take it with her; she sold it to me for far less than it was worth. I use it every working day. My flat is about four kilometres from the office, which is slightly too far to walk, and the buses are unreliable. So I cycle to the station, fold the bike, carry it onto the train, and cycle the last part at the other end. On weekends I sometimes take it on longer trips, because it fits in the boot of a friend's car. It is useful mainly because it removes the most annoying part of my day. I no longer wait for buses, and I do not have to worry about where to lock a bike, since it comes inside with me. It has also made me fitter without my really noticing, and it saves me a considerable amount of money every month.",
    examinerNotes: {
      fluencyCoherence: "Follows the cue card order; a clear beginning, middle and end within the time.",
      lexicalResource: "Precise object vocabulary (folds in half, boot, lock a bike) and evaluative language (removes the most annoying part).",
      grammaticalRange: "Present simple for habits, past for narrative, and relative and causal clauses used accurately.",
      pronunciation: "Sentence stress highlights key information (every working day, far less than it was worth).",
    },
  },
  ...SPEAKING_P3.map(([prompt, model], i) => ({
    importId: `fsg-s-p3-${i + 1}`,
    skill: "speaking" as const,
    questionType: "speaking_part3" as const,
    orderIndex: 5 + i,
    prompt,
    explanationEn: "Part 3: state a view, support it, and qualify it.",
    explanationVi: "Phần 3: nêu quan điểm, bảo vệ nó, và bổ sung điều kiện.",
    modelAnswer: model,
    examinerNotes: {
      fluencyCoherence: "Develops abstract ideas with examples and a balancing clause.",
      lexicalResource: "Topic-specific vocabulary (passive, critically, voice interfaces, vulnerable) used precisely.",
      grammaticalRange: "Conditionals, modals and complex subordination handled accurately.",
      pronunciation: "Intonation distinguishes contrast and concession.",
    },
  })),
];

export const FORMAT_SHOWCASE_GENERAL: AuthoredTest = {
  slug: "format-showcase-general",
  title: "Format Showcase — General Training",
  description:
    "Original IELTS General Training fixture covering Reading Section 1 (three notices), a semi-formal letter, a GT essay and a three-part Speaking set.",
  module: "general_training",
  kind: "full_mock",
  bandConversionKey: GT_BAND_CONVERSION_KEY,
  timeLimitSeconds: 10800,
  assets: [],
  passages,
  listeningSections: [],
  groups,
  questions: [...readingQuestions, ...writingQuestions, ...speakingQuestions],
};
