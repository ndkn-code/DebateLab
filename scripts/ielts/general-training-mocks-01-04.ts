import type { Json } from "../../apps/web/src/types/supabase";
import type { IeltsQuestionType } from "../../apps/web/src/lib/api/ielts/question-schema";

export const GT_BATCH_KEY = "general-training-original-01-04";
export const GT_READING_BAND_CONVERSION_KEY = "general_training";

export const GT_READING_BAND_ROWS = [
  { band: 9, rawMin: 40, rawMax: 40 },
  { band: 8.5, rawMin: 39, rawMax: 39 },
  { band: 8, rawMin: 37, rawMax: 38 },
  { band: 7.5, rawMin: 36, rawMax: 36 },
  { band: 7, rawMin: 34, rawMax: 35 },
  { band: 6.5, rawMin: 32, rawMax: 33 },
  { band: 6, rawMin: 30, rawMax: 31 },
  { band: 5.5, rawMin: 27, rawMax: 29 },
  { band: 5, rawMin: 23, rawMax: 26 },
  { band: 4.5, rawMin: 19, rawMax: 22 },
  { band: 4, rawMin: 15, rawMax: 18 },
  { band: 3.5, rawMin: 12, rawMax: 14 },
  { band: 3, rawMin: 9, rawMax: 11 },
  { band: 2.5, rawMin: 6, rawMax: 8 },
  { band: 2, rawMin: 4, rawMax: 5 },
  { band: 1, rawMin: 1, rawMax: 3 },
  { band: 0, rawMin: 0, rawMax: 0 },
] as const;

export interface AuthoredPassage {
  importId: string;
  title: string;
  body: string;
  orderIndex: number;
  wordCount?: number;
  genre: string;
  metadata?: Record<string, Json>;
}

export interface AuthoredListeningSection {
  importId: string;
  sectionNumber: number;
  title: string;
  script: string;
  accent: "uk" | "us" | "aus" | "other";
  speakers: Array<{ name: string; accent: "uk" | "us" | "aus" | "other" }>;
  metadata?: Record<string, Json>;
}

export interface AuthoredQuestion {
  importId: string;
  skill: "listening" | "reading" | "writing" | "speaking";
  questionType: IeltsQuestionType;
  prompt: string;
  orderIndex: number;
  passageImportId?: string;
  sectionImportId?: string;
  groupKey?: string;
  groupInstructions?: string;
  options?: string[];
  maxPoints?: number;
  wordLimit?: number;
  metadata?: Record<string, Json>;
  correctAnswer?: string | string[] | Record<string, string | string[]>;
  acceptVariants?: string[] | Record<string, string[]>;
  explanationEn?: string;
  explanationVi?: string;
  modelAnswer?: string;
  examinerNotes?: Record<string, string>;
  support?: string | string[];
}

export interface GeneralTrainingMock {
  slug: string;
  title: string;
  description: string;
  passages: AuthoredPassage[];
  listeningSections: AuthoredListeningSection[];
  questions: AuthoredQuestion[];
}

function wc(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function passage(
  input: Omit<AuthoredPassage, "wordCount">,
): AuthoredPassage {
  return { ...input, wordCount: wc(input.body) };
}

function completion(
  importId: string,
  skill: "listening" | "reading",
  orderIndex: number,
  prompt: string,
  correctAnswer: string | Record<string, string | string[]>,
  params: {
    passageImportId?: string;
    sectionImportId?: string;
    groupKey?: string;
    groupInstructions?: string;
    type?: IeltsQuestionType;
    wordLimit?: number;
    acceptVariants?: string[] | Record<string, string[]>;
    support?: string | string[];
  },
): AuthoredQuestion {
  return {
    importId,
    skill,
    questionType: params.type ?? "sentence_completion",
    prompt,
    orderIndex,
    passageImportId: params.passageImportId,
    sectionImportId: params.sectionImportId,
    groupKey: params.groupKey,
    groupInstructions: params.groupInstructions,
    wordLimit: params.wordLimit ?? 2,
    maxPoints:
      typeof correctAnswer === "object" && !Array.isArray(correctAnswer)
        ? Object.keys(correctAnswer).length
        : 1,
    correctAnswer,
    acceptVariants: params.acceptVariants,
    support: params.support,
  };
}

function select(
  input: Omit<AuthoredQuestion, "maxPoints">,
): AuthoredQuestion {
  const correct = input.correctAnswer;
  return {
    ...input,
    maxPoints: Array.isArray(correct) ? correct.length : 1,
  };
}

function ws(
  input: Omit<AuthoredQuestion, "correctAnswer" | "maxPoints">,
): AuthoredQuestion {
  return { ...input, maxPoints: 0 };
}

function supportLine(support: string | string[] | undefined): string | null {
  if (Array.isArray(support)) return support.join(" / ");
  return support ?? null;
}

function isObjective(questionType: IeltsQuestionType): boolean {
  return !questionType.startsWith("writing_") && !questionType.startsWith("speaking_");
}

function withQuestionDefaults(mock: GeneralTrainingMock): GeneralTrainingMock {
  return {
    ...mock,
    passages: mock.passages.map((p) => ({
      ...p,
      metadata: {
        importId: p.importId,
        set: mock.slug,
        module: "general_training",
        sourceBook: "Original Authoring",
        ...(p.metadata ?? {}),
      },
    })),
    listeningSections: mock.listeningSections.map((s) => ({
      ...s,
      metadata: {
        importId: s.importId,
        set: mock.slug,
        module: "general_training",
        sourceBook: "Original Authoring",
        audioStatus: "pending_tts_backfill",
        ...(s.metadata ?? {}),
      },
    })),
    questions: mock.questions.map((q) => {
      const support = supportLine(q.support);
      return {
        ...q,
        explanationEn:
          q.explanationEn ??
          (isObjective(q.questionType) && support
            ? `The answer is supported by: ${support}`
            : undefined),
        explanationVi:
          q.explanationVi ??
          (isObjective(q.questionType) && support
            ? `Dap an duoc xac nhan boi chi tiet: ${support}`
            : undefined),
        metadata: {
          importId: q.importId,
          set: mock.slug,
          module: "general_training",
          sourceBook: "Original Authoring",
          difficulty: q.metadata?.difficulty ?? "medium",
          status: "in_qa",
          originality: "Original authoring; no publisher text used.",
          ...(q.metadata ?? {}),
        },
        examinerNotes: q.examinerNotes ?? {},
      };
    }),
  };
}

const mock01 = withQuestionDefaults({
  slug: "general-training-mock-01",
  title: "General Training Mock 01",
  description: "Original IELTS General Training full mock authored for Thinkfy QA.",
  passages: [
    passage({
      importId: "gt01-r-s1a",
      title: "Tool Library Membership Notice",
      genre: "social_notice",
      orderIndex: 0,
      metadata: { readingSection: 1 },
      body: `Riverside Tool Library

Members may borrow hand tools, garden tools and small decorating equipment for up to seven days. The annual household membership is 18 pounds. A refundable cash deposit is required for electrical items, and members must show a current photo ID when collecting them.

Tools can be reserved online until 6 p.m. the day before collection. Late returns are charged at 2 pounds per item per day. The library does not lend ladders, safety helmets or fuel-powered machines. Free Saturday workshops are open to members, but places must be booked separately because the workshop room holds only twelve people.`,
    }),
    passage({
      importId: "gt01-r-s1b",
      title: "Ferry Saver Ticket",
      genre: "advertisement",
      orderIndex: 1,
      metadata: { readingSection: 1 },
      body: `Harbour Ferry Saver

The weekend saver ticket gives unlimited travel between North Pier, Museum Quay and Willow Island on Saturdays and Sundays. It is valid from 9 a.m. until the final scheduled sailing at 8:40 p.m. Bikes are carried free, but passengers with bikes should board at the rear gate.

Tickets bought through the app are 10 percent cheaper than tickets bought from the pier office. Children under five travel free. The saver ticket is not accepted on private evening cruises or on the airport ferry. In bad weather, replacement buses leave from the blue shelter opposite North Pier.`,
    }),
    passage({
      importId: "gt01-r-s1c",
      title: "Community Centre Short Courses",
      genre: "schedule",
      orderIndex: 2,
      metadata: { readingSection: 1 },
      body: `Short Courses at Bracken Community Centre

Monday 18:30-20:00: Basic bicycle maintenance, Room 2, tutor Samir Patel.
Tuesday 10:00-12:00: Digital photos for beginners, Media Suite, tutor Helen Cho.
Wednesday 19:00-21:00: Family first aid, Hall B, tutor Nora Green.
Thursday 18:00-19:30: Budget cooking for one, Kitchen Studio, tutor Marta Silva.
Saturday 09:30-12:30: Introduction to upholstery, Craft Room, tutor Ellis Brown.

All courses run for four weeks. Fees include printed notes, but learners on the cooking course must bring two food containers each week. Refunds are available only if cancellation is made at least five working days before the first class.`,
    }),
    passage({
      importId: "gt01-r-s2a",
      title: "Courier Induction Notes",
      genre: "workplace_training",
      orderIndex: 3,
      metadata: { readingSection: 2 },
      body: `SwiftLane Couriers: Induction Notes

New riders complete a paid induction before their first shift. The morning session covers route planning, customer contact and the use of the handheld scanner. The afternoon session is practical: riders practise loading bags, locking bikes and reporting a missed delivery.

Uniform jackets are issued on the first day and must be returned if employment ends within three months. Riders provide their own waterproof trousers, but the company supplies lights, a helmet and a high-visibility backpack. Personal headphones must not be worn while riding.

The scanner records the time, address and delivery outcome. If a customer is not at home, riders should choose "card left" on the scanner and place the parcel in the depot return pouch. Parcels must never be left in a communal hallway unless the customer has given written permission in the app.

Breaks are unpaid but flexible. Riders working more than six hours should take at least thirty minutes away from the road. Any collision, dog bite or suspected theft must be reported to the shift controller before the rider continues.`,
    }),
    passage({
      importId: "gt01-r-s2b",
      title: "Remote Work Agreement",
      genre: "workplace_policy",
      orderIndex: 4,
      metadata: { readingSection: 2 },
      body: `Remote Work Agreement: Accounts Team

The accounts team may work from home on two fixed days each week after completing probation. The chosen days are agreed with the line manager for a three-month period and should not be changed informally with colleagues. Staff must be reachable by phone between 10 a.m. and 3 p.m., except during their scheduled lunch break.

Company laptops are encrypted and must not be used by family members. Paper documents containing client names should not be printed at home unless the finance director has approved a specific exception. When such documents are no longer needed, they must be brought back to the office for secure shredding.

Remote workers claim a monthly internet allowance of 15 pounds through payroll. The company does not pay for office furniture, but staff may borrow an adjustable chair after completing a workstation checklist. Anyone who regularly experiences back or wrist pain should request an assessment from Human Resources.`,
    }),
    passage({
      importId: "gt01-r-s3",
      title: "The Quiet Return of Repair Cafes",
      genre: "general_interest_article",
      orderIndex: 5,
      metadata: { readingSection: 3 },
      body: `A. On the first Saturday of every month, a queue forms outside a former bakery in Westport. People arrive with lamps, jackets, radios, toys and kitchen mixers. Some items look almost new; others are carried in cardboard boxes because a screw or spring has escaped. Inside, volunteers sit at long tables with sewing kits, soldering irons and trays of spare parts. The event is called a repair cafe, although the coffee is less important than the promise that a broken object is not automatically rubbish.

B. Repair cafes are not commercial workshops. Visitors remain with their belongings and, where possible, help with the repair. The aim is partly practical and partly educational. A volunteer may replace a plug in ten minutes, but she will also explain why the old one failed and how the owner can avoid the same problem. This shared process distinguishes repair cafes from ordinary service counters. Success is measured not only by the number of objects saved, but also by the confidence people gain.

C. The movement has grown because it answers several modern frustrations at once. Many household goods are cheaper to replace than to repair, yet people dislike throwing away something with a small fault. Manufacturers often seal products with unusual screws or glue, making home repair difficult. Local councils, meanwhile, face rising waste costs. A repair cafe cannot solve all these problems, but it creates a visible challenge to the habit of disposal.

D. Volunteers say the most difficult part is managing expectations. A cafe may have skilled people, but it cannot stock every part or repair dangerous equipment. Organisers usually refuse petrol tools, microwaves and items that show signs of unsafe wiring. Visitors are told that repairs are attempted, not guaranteed. This rule prevents disappointment and protects the informal character of the event.

E. The social value of repair cafes is often overlooked. Retired engineers, students, parents and recent migrants work side by side. People who might not join a club are willing to spend an afternoon mending a toaster. Conversations begin around practical problems and often continue after the item is fixed. In towns where public spaces have become increasingly commercial, a free table with tools can feel surprisingly generous.

F. Critics argue that repair cafes may let manufacturers avoid responsibility, because volunteers patch up products that should have been designed better. Organisers usually agree that stronger right-to-repair laws are needed. However, they reject the idea that community repair is merely a distraction. Each successful repair makes the design problem easier to see. It turns a private annoyance into public evidence.

G. The future of repair cafes may depend on whether they can remain welcoming as they become more organised. Some networks are introducing booking systems, data collection and training certificates. These changes help councils fund the work and help volunteers share knowledge safely. Yet the charm of a repair cafe lies in its open-endedness: someone arrives with a broken object, and a small group of strangers decides that it is worth trying.`,
    }),
  ],
  listeningSections: [
    {
      importId: "gt01-l-s1",
      sectionNumber: 1,
      title: "Booking a community hall",
      accent: "uk",
      speakers: [
        { name: "Lena", accent: "uk" },
        { name: "Manager", accent: "uk" },
      ],
      script: `Manager: Good morning, Bracken Community Halls. This is Martin speaking.

Lena: Hello. My name is Lena Ortiz. I am calling about hiring a room for a charity dinner.

Manager: Certainly, Ms Ortiz. Which date did you have in mind?

Lena: Saturday the eighteenth of September. I know that is a busy month, so I can move by a week if necessary.

Manager: Let me check. The main hall is already taken that evening, but the Garden Room is free. It seats ninety at round tables.

Lena: That should work. We expect eighty-six guests, including a few volunteers who will eat later.

Manager: Fine. Will you need catering through us?

Lena: Yes, please. Most people will have the standard hot buffet, but fourteen guests have asked for vegetarian meals. I first wrote down forty, but that was the total number of people who replied early. Fourteen is the vegetarian number.

Manager: I will note fourteen. The hire deposit is one hundred and twenty pounds, payable when the booking form is returned.

Lena: Can I pay that next Monday?

Manager: Monday is possible, but if we have not received it by Friday we release the room. So Friday is the actual deadline.

Lena: Understood. Does the room have sound equipment?

Manager: A basic microphone, yes. For your slide show, you will also have use of the ceiling projector. You need to bring your own laptop.

Lena: Good. Some guests will drive. How late is the car park open?

Manager: The hall closes at midnight, but the car park gate is locked at eleven p.m. We announce that during evening events.

Lena: Finally, should I confirm the menu by phone?

Manager: Send final numbers and menu choices by email, please. That avoids mistakes.`,
    },
    {
      importId: "gt01-l-s2",
      sectionNumber: 2,
      title: "Riverside market orientation",
      accent: "aus",
      speakers: [{ name: "Guide", accent: "aus" }],
      script: `Guide: Welcome to the Riverside Makers Market. I will give you a quick orientation before the gates open.

If you entered through the coach drop-off area, you are standing beside the north gate. That is also where visitors with pre-paid tickets should scan their codes. The old stone arch by the bridge is exit only today, because we need to keep the path clear for emergency vehicles.

The first row of stalls is for food. The bakery is on your left, and beside it is the herb stall. The herb stall is easy to find because the owner has a green canvas roof and a display of mint plants at the front. The pottery stalls are not in this row. They are in the old mill courtyard, where there is more shade.

At eleven o'clock a brass band will play near the river steps. Yesterday I said the folk singers would open the programme, but they have moved to the afternoon. The children's craft tent is behind the information desk, not beside the stage, so parents can collect name labels there.

There is one cash machine. It is just before the bridge arch, next to the bicycle racks. It sometimes runs out by lunchtime, so we encourage card payment where possible. Visitor parking is not here at the market. Please use the college car park on Alder Road; the school car park is reserved for stallholders.

If a child becomes separated from an adult, bring the child to the information desk. Do not take them to the stage, even if an announcement is being made. The market closes at four thirty. Finally, please remind visitors to use reusable bags. Stallholders have paper bags, but supplies are limited.`,
    },
    {
      importId: "gt01-l-s3",
      sectionNumber: 3,
      title: "Planning a workplace wellbeing project",
      accent: "us",
      speakers: [
        { name: "Mina", accent: "us" },
        { name: "Joel", accent: "uk" },
        { name: "Priya", accent: "aus" },
      ],
      script: `Mina: We need to decide how to divide the wellbeing project before Friday's tutorial. I can analyse the staff survey because I used the same software last term.

Joel: Good. I thought I might do the interviews, but my schedule is messy. Priya, you said you enjoy talking to people.

Priya: I do, and I can run the interviews. I will keep them to fifteen minutes. Joel, could you handle the literature review?

Joel: Yes. I have already found articles about flexible hours and shared kitchens. I will also check whether any of them discuss small companies, because our case study only has thirty-two employees.

Mina: For the presentation, we should avoid saying that free fruit caused the lower absence rate. The manager introduced fruit and a new rota at the same time, so the evidence is mixed.

Priya: Exactly. We can say employees liked the fruit, but the rota probably made the bigger difference. People mentioned predictable shifts again and again.

Joel: What about the gym discount? It sounds impressive.

Mina: The data says only five people used it. We should treat it as unpopular, not as a major benefit.

Priya: The manager wants recommendations. I suggest keeping the rota, replacing the gym discount with a walking group, and improving the break room. The interviews show people want somewhere quiet.

Joel: I like the walking group because it costs nothing. For the break room, we should say start with better lighting, not new furniture. Lighting was the most common complaint.

Mina: And our limitation? We did not survey night-shift staff. That matters because they use the building differently.

Priya: Good point. I will mention that in the final slide.`,
    },
    {
      importId: "gt01-l-s4",
      sectionNumber: 4,
      title: "Urban seed libraries",
      accent: "uk",
      speakers: [{ name: "Lecturer", accent: "uk" }],
      script: `Lecturer: Today's lecture looks at urban seed libraries. A seed library is a collection of seeds that gardeners can borrow, grow and later return. The idea is not new; farming communities have shared seed for centuries. What is new is the appearance of seed libraries in city libraries, apartment blocks and schools.

The first benefit is genetic diversity. Commercial packets often contain a narrow range of popular varieties. When gardeners save seed from plants that survive local conditions, they gradually build a stock that suits their neighbourhood. This can be useful in cities, where heat, shade and poor soil vary from street to street.

A second benefit is education. Seed libraries teach people the full plant cycle, not just the moment when a seedling is bought from a shop. Borrowers learn when to collect seed, how to dry it and why labels matter. Some libraries run workshops on pollination, because seed from cross-pollinated plants may not grow true to type.

There are challenges. Seeds need cool, dry storage. If moisture enters the envelopes, germination rates fall. Volunteers also need a simple record system. Without records, a library cannot tell whether a returned tomato seed came from a healthy plant or from fruit bought at a supermarket.

Successful projects usually begin with easy crops such as beans, lettuce and calendula. These produce visible seed and do not require specialist equipment. Carrots and pumpkins are harder for beginners because they cross with related plants or take more space.

Urban seed libraries are small, but they change how people see food. A packet of seed becomes a local story: who grew it, what weather it survived and which neighbour will try it next season.`,
    },
  ],
  questions: [
    completion("gt01-lq01", "listening", 0, "Caller name: __BLANK_0__.", "Lena Ortiz", { sectionImportId: "gt01-l-s1", type: "note_table_form_flowchart_completion", wordLimit: 2, support: "My name is Lena Ortiz" }),
    completion("gt01-lq02", "listening", 1, "Event date: __BLANK_0__.", "18 September", { sectionImportId: "gt01-l-s1", type: "note_table_form_flowchart_completion", wordLimit: 2, acceptVariants: ["eighteenth September", "18th September"], support: "Saturday the eighteenth of September" }),
    completion("gt01-lq03", "listening", 2, "Room booked: __BLANK_0__.", "Garden Room", { sectionImportId: "gt01-l-s1", type: "note_table_form_flowchart_completion", wordLimit: 2, support: "the Garden Room is free" }),
    completion("gt01-lq04", "listening", 3, "Expected number of guests: __BLANK_0__.", "86", { sectionImportId: "gt01-l-s1", type: "note_table_form_flowchart_completion", wordLimit: 1, acceptVariants: ["eighty-six"], support: "We expect eighty-six guests" }),
    completion("gt01-lq05", "listening", 4, "Vegetarian meals required: __BLANK_0__.", "14", { sectionImportId: "gt01-l-s1", type: "note_table_form_flowchart_completion", wordLimit: 1, acceptVariants: ["fourteen"], support: "Fourteen is the vegetarian number" }),
    completion("gt01-lq06", "listening", 5, "Deposit: __BLANK_0__ pounds.", "120", { sectionImportId: "gt01-l-s1", type: "note_table_form_flowchart_completion", wordLimit: 1, acceptVariants: ["one hundred and twenty"], support: "one hundred and twenty pounds" }),
    completion("gt01-lq07", "listening", 6, "Deposit deadline: __BLANK_0__.", "Friday", { sectionImportId: "gt01-l-s1", type: "note_table_form_flowchart_completion", wordLimit: 1, support: "Friday is the actual deadline" }),
    completion("gt01-lq08", "listening", 7, "Slide equipment provided: __BLANK_0__.", "projector", { sectionImportId: "gt01-l-s1", type: "note_table_form_flowchart_completion", wordLimit: 1, support: "use of the ceiling projector" }),
    completion("gt01-lq09", "listening", 8, "Car park gate is locked at __BLANK_0__.", "11 pm", { sectionImportId: "gt01-l-s1", type: "note_table_form_flowchart_completion", wordLimit: 2, acceptVariants: ["eleven pm", "11 p.m."], support: "locked at eleven p.m." }),
    completion("gt01-lq10", "listening", 9, "Final numbers should be sent by __BLANK_0__.", "email", { sectionImportId: "gt01-l-s1", type: "note_table_form_flowchart_completion", wordLimit: 1, support: "Send final numbers and menu choices by email" }),

    completion("gt01-lq11", "listening", 10, "Pre-paid tickets are scanned at the __BLANK_0__.", "north gate", { sectionImportId: "gt01-l-s2", type: "map_plan_label", wordLimit: 2, support: "beside the north gate" }),
    completion("gt01-lq12", "listening", 11, "The bridge arch is used as an __BLANK_0__ today.", "exit", { sectionImportId: "gt01-l-s2", type: "map_plan_label", wordLimit: 1, support: "is exit only today" }),
    completion("gt01-lq13", "listening", 12, "The herb stall has a __BLANK_0__ roof.", "green canvas", { sectionImportId: "gt01-l-s2", type: "map_plan_label", wordLimit: 2, support: "a green canvas roof" }),
    completion("gt01-lq14", "listening", 13, "Pottery stalls are in the __BLANK_0__.", "old mill courtyard", { sectionImportId: "gt01-l-s2", type: "map_plan_label", wordLimit: 3, support: "in the old mill courtyard" }),
    completion("gt01-lq15", "listening", 14, "At 11:00, visitors can hear a __BLANK_0__.", "brass band", { sectionImportId: "gt01-l-s2", type: "short_answer", wordLimit: 2, support: "a brass band will play" }),
    completion("gt01-lq16", "listening", 15, "The children's craft tent is behind the __BLANK_0__.", "information desk", { sectionImportId: "gt01-l-s2", type: "map_plan_label", wordLimit: 2, support: "behind the information desk" }),
    completion("gt01-lq17", "listening", 16, "The cash machine is next to the __BLANK_0__.", "bicycle racks", { sectionImportId: "gt01-l-s2", type: "map_plan_label", wordLimit: 2, support: "next to the bicycle racks" }),
    completion("gt01-lq18", "listening", 17, "Visitors should park at the __BLANK_0__ car park.", "college", { sectionImportId: "gt01-l-s2", type: "short_answer", wordLimit: 1, support: "use the college car park" }),
    completion("gt01-lq19", "listening", 18, "Lost children should be taken to the __BLANK_0__.", "information desk", { sectionImportId: "gt01-l-s2", type: "short_answer", wordLimit: 2, support: "bring the child to the information desk" }),
    completion("gt01-lq20", "listening", 19, "The market closes at __BLANK_0__.", "4:30", { sectionImportId: "gt01-l-s2", type: "short_answer", wordLimit: 1, acceptVariants: ["four thirty", "4.30"], support: "closes at four thirty" }),

    select({ importId: "gt01-lq21", skill: "listening", questionType: "matching_features", orderIndex: 20, sectionImportId: "gt01-l-s3", groupKey: "gt01-l-s3-roles", groupInstructions: "Match each task with the student responsible.", prompt: "Analyse the staff survey", options: ["Mina", "Joel", "Priya"], metadata: { items: [{ id: "0", text: "Analyse the staff survey" }] }, correctAnswer: { "0": "0" }, support: "I can analyse the staff survey" }),
    select({ importId: "gt01-lq22", skill: "listening", questionType: "matching_features", orderIndex: 21, sectionImportId: "gt01-l-s3", groupKey: "gt01-l-s3-roles", groupInstructions: "Match each task with the student responsible.", prompt: "Run the interviews", options: ["Mina", "Joel", "Priya"], metadata: { items: [{ id: "0", text: "Run the interviews" }] }, correctAnswer: { "0": "2" }, support: "I can run the interviews" }),
    select({ importId: "gt01-lq23", skill: "listening", questionType: "matching_features", orderIndex: 22, sectionImportId: "gt01-l-s3", groupKey: "gt01-l-s3-roles", groupInstructions: "Match each task with the student responsible.", prompt: "Write the literature review", options: ["Mina", "Joel", "Priya"], metadata: { items: [{ id: "0", text: "Write the literature review" }] }, correctAnswer: { "0": "1" }, support: "could you handle the literature review? / Yes" }),
    select({ importId: "gt01-lq24", skill: "listening", questionType: "mcq_single", orderIndex: 23, sectionImportId: "gt01-l-s3", prompt: "Why should the students be careful about the free fruit?", options: ["It was too expensive to continue.", "It was introduced with another change.", "Most workers disliked it."], correctAnswer: "1", support: "introduced fruit and a new rota at the same time" }),
    select({ importId: "gt01-lq25", skill: "listening", questionType: "mcq_single", orderIndex: 24, sectionImportId: "gt01-l-s3", prompt: "Which change probably reduced absence most?", options: ["The new rota", "The gym discount", "The free fruit"], correctAnswer: "0", support: "the rota probably made the bigger difference" }),
    completion("gt01-lq26", "listening", 25, "Only __BLANK_0__ people used the gym discount.", "five", { sectionImportId: "gt01-l-s3", type: "sentence_completion", wordLimit: 1, acceptVariants: ["5"], support: "only five people used it" }),
    completion("gt01-lq27", "listening", 26, "Priya suggests replacing the gym discount with a __BLANK_0__.", "walking group", { sectionImportId: "gt01-l-s3", type: "sentence_completion", wordLimit: 2, support: "replacing the gym discount with a walking group" }),
    completion("gt01-lq28", "listening", 27, "For the break room, Joel says the first improvement should be better __BLANK_0__.", "lighting", { sectionImportId: "gt01-l-s3", type: "sentence_completion", wordLimit: 1, support: "start with better lighting" }),
    completion("gt01-lq29", "listening", 28, "The project did not include __BLANK_0__ staff.", "night-shift", { sectionImportId: "gt01-l-s3", type: "sentence_completion", wordLimit: 1, acceptVariants: ["night shift"], support: "did not survey night-shift staff" }),
    select({ importId: "gt01-lq30", skill: "listening", questionType: "mcq_single", orderIndex: 29, sectionImportId: "gt01-l-s3", prompt: "What will Priya add to the final slide?", options: ["A limitation of the research", "A new interview question", "A cost estimate"], correctAnswer: "0", support: "I will mention that in the final slide" }),

    completion("gt01-lq31", "listening", 30, "Seed libraries let gardeners borrow and later __BLANK_0__ seeds.", "return", { sectionImportId: "gt01-l-s4", type: "summary_completion", wordLimit: 1, support: "borrow, grow and later return" }),
    completion("gt01-lq32", "listening", 31, "Saving seed locally can improve genetic __BLANK_0__.", "diversity", { sectionImportId: "gt01-l-s4", type: "summary_completion", wordLimit: 1, support: "The first benefit is genetic diversity" }),
    completion("gt01-lq33", "listening", 32, "City growing conditions vary from street to street because of heat, shade and poor __BLANK_0__.", "soil", { sectionImportId: "gt01-l-s4", type: "summary_completion", wordLimit: 1, support: "heat, shade and poor soil" }),
    completion("gt01-lq34", "listening", 33, "Workshops may teach borrowers about __BLANK_0__.", "pollination", { sectionImportId: "gt01-l-s4", type: "summary_completion", wordLimit: 1, support: "workshops on pollination" }),
    completion("gt01-lq35", "listening", 34, "Seeds must be kept in cool, dry __BLANK_0__.", "storage", { sectionImportId: "gt01-l-s4", type: "summary_completion", wordLimit: 1, support: "Seeds need cool, dry storage" }),
    completion("gt01-lq36", "listening", 35, "Moisture reduces germination __BLANK_0__.", "rates", { sectionImportId: "gt01-l-s4", type: "summary_completion", wordLimit: 1, support: "germination rates fall" }),
    completion("gt01-lq37", "listening", 36, "Volunteers need a simple record __BLANK_0__.", "system", { sectionImportId: "gt01-l-s4", type: "summary_completion", wordLimit: 1, support: "a simple record system" }),
    completion("gt01-lq38", "listening", 37, "Good beginner crops include beans, lettuce and __BLANK_0__.", "calendula", { sectionImportId: "gt01-l-s4", type: "summary_completion", wordLimit: 1, support: "beans, lettuce and calendula" }),
    completion("gt01-lq39", "listening", 38, "__BLANK_0__ are harder for beginners because they cross with related plants.", "Carrots", { sectionImportId: "gt01-l-s4", type: "summary_completion", wordLimit: 1, support: "Carrots and pumpkins are harder" }),
    completion("gt01-lq40", "listening", 39, "A packet of seed becomes a local __BLANK_0__.", "story", { sectionImportId: "gt01-l-s4", type: "summary_completion", wordLimit: 1, support: "becomes a local story" }),

    select({ importId: "gt01-rq01", skill: "reading", questionType: "true_false_notgiven", orderIndex: 0, passageImportId: "gt01-r-s1a", prompt: "Members can borrow electrical tools without paying a deposit.", correctAnswer: "FALSE", support: "A refundable cash deposit is required for electrical items" }),
    completion("gt01-rq02", "reading", 1, "Tools may be borrowed for up to __BLANK_0__ days.", "seven", { passageImportId: "gt01-r-s1a", type: "sentence_completion", wordLimit: 1, acceptVariants: ["7"], support: "for up to seven days" }),
    completion("gt01-rq03", "reading", 2, "Online reservations must be made by __BLANK_0__ the day before collection.", "6 p.m.", { passageImportId: "gt01-r-s1a", type: "sentence_completion", wordLimit: 2, acceptVariants: ["6 pm", "six p.m.", "six pm"], support: "until 6 p.m. the day before collection" }),
    select({ importId: "gt01-rq04", skill: "reading", questionType: "true_false_notgiven", orderIndex: 3, passageImportId: "gt01-r-s1a", prompt: "The tool library lends fuel-powered machines.", correctAnswer: "FALSE", support: "does not lend ladders, safety helmets or fuel-powered machines" }),
    completion("gt01-rq05", "reading", 4, "The workshop room can hold only __BLANK_0__ people.", "twelve", { passageImportId: "gt01-r-s1a", type: "short_answer", wordLimit: 1, acceptVariants: ["12"], support: "holds only twelve people" }),
    completion("gt01-rq06", "reading", 5, "The ferry saver ticket is valid on __BLANK_0__ and Sundays.", "Saturdays", { passageImportId: "gt01-r-s1b", type: "sentence_completion", wordLimit: 1, support: "on Saturdays and Sundays" }),
    completion("gt01-rq07", "reading", 6, "Passengers with bikes should use the __BLANK_0__ gate.", "rear", { passageImportId: "gt01-r-s1b", type: "sentence_completion", wordLimit: 1, support: "board at the rear gate" }),
    select({ importId: "gt01-rq08", skill: "reading", questionType: "mcq_single", orderIndex: 7, passageImportId: "gt01-r-s1b", prompt: "Where is the cheapest place to buy the weekend saver ticket?", options: ["The app", "The pier office", "The airport ferry"], correctAnswer: "0", support: "Tickets bought through the app are 10 percent cheaper" }),
    select({ importId: "gt01-rq09", skill: "reading", questionType: "true_false_notgiven", orderIndex: 8, passageImportId: "gt01-r-s1b", prompt: "The saver ticket can be used on private evening cruises.", correctAnswer: "FALSE", support: "not accepted on private evening cruises" }),
    completion("gt01-rq10", "reading", 9, "Replacement buses leave from the __BLANK_0__ opposite North Pier.", "blue shelter", { passageImportId: "gt01-r-s1b", type: "sentence_completion", wordLimit: 2, support: "from the blue shelter opposite North Pier" }),
    select({ importId: "gt01-rq11", skill: "reading", questionType: "matching_features", orderIndex: 10, passageImportId: "gt01-r-s1c", groupKey: "gt01-r-s1c-courses", groupInstructions: "Match each detail with the correct course.", prompt: "Learners must bring containers.", options: ["Bicycle maintenance", "Digital photos", "Family first aid", "Budget cooking", "Upholstery"], metadata: { items: [{ id: "0", text: "Learners must bring containers." }] }, correctAnswer: { "0": "3" }, support: "learners on the cooking course must bring two food containers" }),
    select({ importId: "gt01-rq12", skill: "reading", questionType: "matching_features", orderIndex: 11, passageImportId: "gt01-r-s1c", groupKey: "gt01-r-s1c-courses", groupInstructions: "Match each detail with the correct course.", prompt: "The class is held in the Media Suite.", options: ["Bicycle maintenance", "Digital photos", "Family first aid", "Budget cooking", "Upholstery"], metadata: { items: [{ id: "0", text: "The class is held in the Media Suite." }] }, correctAnswer: { "0": "1" }, support: "Digital photos for beginners, Media Suite" }),
    select({ importId: "gt01-rq13", skill: "reading", questionType: "mcq_single", orderIndex: 12, passageImportId: "gt01-r-s1c", prompt: "Which course takes place on Wednesday evening?", options: ["Family first aid", "Basic bicycle maintenance", "Introduction to upholstery"], correctAnswer: "0", support: "Wednesday 19:00-21:00: Family first aid" }),
    completion("gt01-rq14", "reading", 13, "Refund requests must be made at least __BLANK_0__ working days before the first class.", "five", { passageImportId: "gt01-r-s1c", type: "sentence_completion", wordLimit: 1, acceptVariants: ["5"], support: "at least five working days before the first class" }),

    select({ importId: "gt01-rq15", skill: "reading", questionType: "true_false_notgiven", orderIndex: 14, passageImportId: "gt01-r-s2a", prompt: "New riders are paid for attending induction.", correctAnswer: "TRUE", support: "complete a paid induction" }),
    completion("gt01-rq16", "reading", 15, "The morning session includes route planning and use of the handheld __BLANK_0__.", "scanner", { passageImportId: "gt01-r-s2a", type: "sentence_completion", wordLimit: 1, support: "use of the handheld scanner" }),
    completion("gt01-rq17", "reading", 16, "Uniform jackets must be returned if employment ends within __BLANK_0__ months.", "three", { passageImportId: "gt01-r-s2a", type: "sentence_completion", wordLimit: 1, acceptVariants: ["3"], support: "within three months" }),
    select({ importId: "gt01-rq18", skill: "reading", questionType: "matching_information", orderIndex: 17, passageImportId: "gt01-r-s2a", prompt: "Which item must riders provide themselves?", options: ["Helmet", "Waterproof trousers", "High-visibility backpack"], metadata: { items: [{ id: "0", text: "Item supplied by riders" }] }, correctAnswer: { "0": "1" }, support: "Riders provide their own waterproof trousers" }),
    completion("gt01-rq19", "reading", 18, "If a customer is absent, the parcel should go in the depot __BLANK_0__ pouch.", "return", { passageImportId: "gt01-r-s2a", type: "sentence_completion", wordLimit: 1, support: "depot return pouch" }),
    select({ importId: "gt01-rq20", skill: "reading", questionType: "true_false_notgiven", orderIndex: 19, passageImportId: "gt01-r-s2a", prompt: "Riders may leave parcels in communal hallways whenever the building has one.", correctAnswer: "FALSE", support: "must never be left in a communal hallway unless the customer has given written permission" }),
    completion("gt01-rq21", "reading", 20, "Riders working more than six hours should take at least __BLANK_0__ minutes away from the road.", "thirty", { passageImportId: "gt01-r-s2a", type: "sentence_completion", wordLimit: 1, acceptVariants: ["30"], support: "at least thirty minutes away from the road" }),
    select({ importId: "gt01-rq22", skill: "reading", questionType: "true_false_notgiven", orderIndex: 21, passageImportId: "gt01-r-s2b", prompt: "Accounts staff can choose different home-working days each week without approval.", correctAnswer: "FALSE", support: "should not be changed informally with colleagues" }),
    completion("gt01-rq23", "reading", 22, "Remote staff must be reachable by phone between 10 a.m. and __BLANK_0__.", "3 p.m.", { passageImportId: "gt01-r-s2b", type: "sentence_completion", wordLimit: 2, acceptVariants: ["3 pm", "three p.m.", "three pm"], support: "between 10 a.m. and 3 p.m." }),
    select({ importId: "gt01-rq24", skill: "reading", questionType: "true_false_notgiven", orderIndex: 23, passageImportId: "gt01-r-s2b", prompt: "Family members may use company laptops if they stay at home.", correctAnswer: "FALSE", support: "must not be used by family members" }),
    completion("gt01-rq25", "reading", 24, "Client documents printed at home must be returned for secure __BLANK_0__.", "shredding", { passageImportId: "gt01-r-s2b", type: "sentence_completion", wordLimit: 1, support: "brought back to the office for secure shredding" }),
    completion("gt01-rq26", "reading", 25, "The internet allowance is __BLANK_0__ pounds per month.", "15", { passageImportId: "gt01-r-s2b", type: "short_answer", wordLimit: 1, acceptVariants: ["fifteen"], support: "monthly internet allowance of 15 pounds" }),
    completion("gt01-rq27", "reading", 26, "Staff may borrow an adjustable chair after completing a workstation __BLANK_0__.", "checklist", { passageImportId: "gt01-r-s2b", type: "sentence_completion", wordLimit: 1, support: "after completing a workstation checklist" }),

    select({ importId: "gt01-rq28", skill: "reading", questionType: "matching_headings", orderIndex: 27, passageImportId: "gt01-r-s3", prompt: "Paragraph A", options: ["A monthly meeting for broken belongings", "The limits of volunteer repair", "A legal solution", "Hidden social benefits"], metadata: { items: [{ id: "0", text: "Paragraph A" }] }, correctAnswer: { "0": "0" }, support: "a queue forms outside a former bakery / repair cafe" }),
    select({ importId: "gt01-rq29", skill: "reading", questionType: "matching_headings", orderIndex: 28, passageImportId: "gt01-r-s3", prompt: "Paragraph D", options: ["Why visitors must help", "The limits of volunteer repair", "A commercial workshop", "Collecting repair data"], metadata: { items: [{ id: "0", text: "Paragraph D" }] }, correctAnswer: { "0": "1" }, support: "cannot stock every part or repair dangerous equipment" }),
    select({ importId: "gt01-rq30", skill: "reading", questionType: "matching_headings", orderIndex: 29, passageImportId: "gt01-r-s3", prompt: "Paragraph E", options: ["Hidden social benefits", "Better product design", "The cost of spare parts", "A booking problem"], metadata: { items: [{ id: "0", text: "Paragraph E" }] }, correctAnswer: { "0": "0" }, support: "The social value of repair cafes is often overlooked" }),
    select({ importId: "gt01-rq31", skill: "reading", questionType: "matching_information", orderIndex: 30, passageImportId: "gt01-r-s3", prompt: "Which paragraph mentions unusual screws and glue?", options: ["B", "C", "D", "F"], metadata: { items: [{ id: "0", text: "unusual screws and glue" }] }, correctAnswer: { "0": "1" }, support: "Manufacturers often seal products with unusual screws or glue" }),
    select({ importId: "gt01-rq32", skill: "reading", questionType: "matching_information", orderIndex: 31, passageImportId: "gt01-r-s3", prompt: "Which paragraph says visitors stay with their objects?", options: ["A", "B", "E", "G"], metadata: { items: [{ id: "0", text: "visitors stay with their objects" }] }, correctAnswer: { "0": "1" }, support: "Visitors remain with their belongings" }),
    completion("gt01-rq33", "reading", 32, "Repair cafes measure success partly by the confidence people __BLANK_0__.", "gain", { passageImportId: "gt01-r-s3", type: "summary_completion", wordLimit: 1, support: "the confidence people gain" }),
    completion("gt01-rq34", "reading", 33, "Local councils face rising waste __BLANK_0__.", "costs", { passageImportId: "gt01-r-s3", type: "summary_completion", wordLimit: 1, support: "rising waste costs" }),
    select({ importId: "gt01-rq35", skill: "reading", questionType: "true_false_notgiven", orderIndex: 34, passageImportId: "gt01-r-s3", prompt: "Repair cafes usually guarantee that every item will be fixed.", correctAnswer: "FALSE", support: "repairs are attempted, not guaranteed" }),
    completion("gt01-rq36", "reading", 35, "Organisers usually agree that stronger right-to-repair __BLANK_0__ are needed.", "laws", { passageImportId: "gt01-r-s3", type: "sentence_completion", wordLimit: 1, support: "stronger right-to-repair laws are needed" }),
    select({ importId: "gt01-rq37", skill: "reading", questionType: "mcq_single", orderIndex: 36, passageImportId: "gt01-r-s3", prompt: "What does the writer suggest about repair cafes and manufacturers?", options: ["They hide design problems.", "They can make design problems more visible.", "They should replace consumer law."], correctAnswer: "1", support: "makes the design problem easier to see" }),
    completion("gt01-rq38", "reading", 37, "Some networks are adding booking systems, data collection and training __BLANK_0__.", "certificates", { passageImportId: "gt01-r-s3", type: "sentence_completion", wordLimit: 1, support: "training certificates" }),
    select({ importId: "gt01-rq39", skill: "reading", questionType: "mcq_single", orderIndex: 38, passageImportId: "gt01-r-s3", prompt: "What quality does the writer say gives repair cafes their charm?", options: ["Their low prices", "Their open-endedness", "Their professional advertising"], correctAnswer: "1", support: "the charm of a repair cafe lies in its open-endedness" }),
    completion("gt01-rq40", "reading", 39, "At a repair cafe, strangers decide that a broken object is worth __BLANK_0__.", "trying", { passageImportId: "gt01-r-s3", type: "sentence_completion", wordLimit: 1, support: "it is worth trying" }),

    ws({ importId: "gt01-wq01", skill: "writing", questionType: "writing_task1_general", orderIndex: 0, prompt: "You recently moved into a rented flat. A repair promised by the landlord has not been completed. Write a letter to your landlord. In your letter, describe the problem, explain how it is affecting you, and say what action you would like the landlord to take. Write at least 150 words. Register: semi-formal.", modelAnswer: `Dear Mr Harris,

I am writing about the kitchen window in Flat 3B, which you agreed to repair before I moved in on 1 May. Unfortunately, the frame still does not close properly, and there is now a visible gap along the lower edge.

This is causing two problems. First, the flat becomes very cold in the evening, so I have had to keep the heating on for longer than expected. Second, rain came through the gap during last week's storm and damaged a small section of the wooden sill. I am worried that the problem will become more expensive if it is left until winter.

Could you please arrange for a contractor to inspect and repair the window this week? I am available after 4 p.m. on Tuesday and Thursday, or all morning on Saturday. If those times are inconvenient, please let me know and I will try to adjust my schedule.

Yours sincerely,
Lena Ortiz`, examinerNotes: { task: "Clearly covers the problem, effect and requested action in a suitable semi-formal register.", coherence: "Logical paragraphing and smooth sequencing.", lexical: "Precise everyday lexis such as visible gap, wooden sill and contractor.", grammar: "Flexible complex sentences with accurate punctuation." }, metadata: { register: "semi-formal", wordMin: 150 } }),
    ws({ importId: "gt01-wq02", skill: "writing", questionType: "writing_task2_essay", orderIndex: 1, prompt: "Some people think public libraries are no longer necessary because information is available online. Others believe libraries still play an important role in society. Discuss both views and give your own opinion. Write at least 250 words.", modelAnswer: `It is sometimes argued that public libraries have lost their purpose now that most factual information can be found online. While the internet has certainly changed how people read and research, I believe libraries remain important because they provide trusted guidance, shared space and equal access.

Those who see libraries as unnecessary have a reasonable point. A person with a phone can search for news, instructions, academic articles and entertainment within seconds. Digital material is also easier to update than printed books, which is useful in fields such as health, law and technology. For busy workers or rural residents, online resources may be more convenient than travelling to a building with limited opening hours.

However, this argument assumes that access to information is the same as the ability to use it well. Libraries help people navigate sources, avoid misinformation and discover material they would not have found through an algorithm. They also serve people who cannot afford reliable internet, quiet study space or expensive subscriptions. In many communities, libraries host language classes, job-search support, children's reading sessions and local history projects. These functions are social as much as informational.

In my view, libraries should not try to compete with the internet as warehouses of facts. Instead, they should combine digital access with human support and inclusive public space. A modern library may lend e-books and teach online research, but it also gives citizens somewhere safe, calm and non-commercial to learn. For that reason, public libraries are still necessary, although their role is evolving.`, examinerNotes: { task: "Fully addresses both views and presents a clear, nuanced opinion.", coherence: "Balanced four-paragraph structure with clear progression.", lexical: "Wide precise range: trusted guidance, misinformation, non-commercial.", grammar: "Strong control of complex clauses and contrast structures." }, metadata: { wordMin: 250 } }),
    ws({ importId: "gt01-sq01", skill: "speaking", questionType: "speaking_part1", orderIndex: 0, prompt: "Part 1: Let's talk about local services. What services are useful near your home? How often do you use them? Is there any service you would like to improve?", modelAnswer: "A strong answer gives specific local examples, extends each response naturally, and uses everyday collocations such as postal counter, health clinic and public transport link.", examinerNotes: { fluency: "Answers are extended without sounding memorised.", lexical: "Uses precise local-service vocabulary.", grammar: "Mixes present simple, conditionals and comparisons accurately.", pronunciation: "Clear chunking and natural sentence stress." }, metadata: { topic: "local services" } }),
    ws({ importId: "gt01-sq02", skill: "speaking", questionType: "speaking_part2_cuecard", orderIndex: 1, prompt: "Describe a community event you enjoyed. You should say what the event was, where it was held, who was there, and explain why you enjoyed it.", options: ["what the event was", "where it was held", "who was there", "why you enjoyed it"], modelAnswer: "A band-9 response might describe a repair cafe or local market, organise the story chronologically, and explain both personal enjoyment and wider community value.", examinerNotes: { fluency: "Sustains a two-minute turn with clear signposting.", lexical: "Uses descriptive phrases for atmosphere and participation.", grammar: "Uses past narrative forms accurately.", pronunciation: "Varied intonation supports storytelling." }, metadata: { topic: "community event" } }),
    ws({ importId: "gt01-sq03", skill: "speaking", questionType: "speaking_part3", orderIndex: 2, prompt: "Part 3: Why do some community events become popular? Should local governments fund free events? How can events help people who are new to an area?", modelAnswer: "A strong answer considers affordability, identity and social connection, then qualifies the role of government funding with examples.", examinerNotes: { fluency: "Develops abstract ideas with examples.", lexical: "Uses topic lexis such as civic identity, inclusion and public funding.", grammar: "Accurate complex comparisons and concessive clauses.", pronunciation: "Maintains intelligibility across longer turns." }, metadata: { topic: "community events" } }),
  ],
});

const mock02 = withQuestionDefaults({
  slug: "general-training-mock-02",
  title: "General Training Mock 02",
  description: "Original IELTS General Training full mock authored for Thinkfy QA.",
  passages: [
    passage({
      importId: "gt02-r-s1a",
      title: "Recycling Centre Notice",
      genre: "public_notice",
      orderIndex: 0,
      metadata: { readingSection: 1 },
      body: `Mill Road Recycling Centre

The centre accepts household paper, glass, metal, cardboard, small electrical items and clean cooking oil. Paint is accepted only on the first Saturday of each month. Building rubble, car tyres and medical waste are not accepted.

Residents must show a council tax bill or driving licence at the gate. Vans higher than two metres need a free permit, requested online at least twenty-four hours before the visit. The reuse shop is open Wednesday to Sunday and sells furniture, books and bicycles that have passed a safety check.

During school holidays the centre closes at 6 p.m. instead of 5 p.m. Staff cannot help unload heavy items, so visitors should bring another adult if needed.`,
    }),
    passage({
      importId: "gt02-r-s1b",
      title: "Sports Club Membership",
      genre: "advertisement",
      orderIndex: 1,
      metadata: { readingSection: 1 },
      body: `Oakfield Sports Club

New members who join before 30 April pay no joining fee. The standard monthly membership includes the gym, outdoor tennis courts and weekday fitness classes. Swimming costs extra because the pool belongs to the school next door.

Junior members must be linked to an adult account. Off-peak members may enter before 4 p.m. on weekdays and after 1 p.m. on Sundays, but not on Saturday mornings. Towels can be hired at reception for 1 pound. Members may freeze their account once a year for medical reasons by providing a doctor's note.`,
    }),
    passage({
      importId: "gt02-r-s1c",
      title: "Library Laptop Loan Rules",
      genre: "rules",
      orderIndex: 2,
      metadata: { readingSection: 1 },
      body: `City Library Laptop Loans

Library members aged sixteen or over may borrow a laptop for use inside the building. Loans last three hours and cannot be renewed if another member is waiting. Borrowers leave their library card at the service desk and collect it when the laptop is returned.

Files saved on the laptop are deleted automatically after each session, so users should save work to their own cloud account or memory stick. Printing is available from every laptop, but payment must be made at the self-service kiosk before collection. Food and drinks are not allowed at laptop desks.`,
    }),
    passage({
      importId: "gt02-r-s2a",
      title: "Housekeeping Team Handbook",
      genre: "workplace_handbook",
      orderIndex: 3,
      metadata: { readingSection: 2 },
      body: `Cedar Court Hotel: Housekeeping Team Handbook

Room attendants receive their daily room list from the supervisor at 8:15 a.m. The list shows departures, stayovers and rooms requiring special cleaning. Departure rooms should be cleaned before stayovers unless the supervisor gives a different instruction. Guests who display a "do not disturb" sign must not be called before 11 a.m.

Each trolley should carry enough linen for eight rooms. Chemicals must remain in labelled bottles; staff must never mix products in an attempt to remove a stain. If a bottle leaks, place it in the yellow tray and tell the supervisor immediately.

Lost property found in a room is placed in a clear bag with the room number, date and staff initials. Valuable items such as jewellery or passports go directly to the duty manager, not to the housekeeping office. Food left in a room is discarded unless it is sealed and clearly labelled with a guest name.

At the end of the shift, attendants return master keys to the locked cabinet. A missing key is treated as a security incident, even if it is later found in a uniform pocket.`,
    }),
    passage({
      importId: "gt02-r-s2b",
      title: "Incident Reporting Procedure",
      genre: "workplace_policy",
      orderIndex: 4,
      metadata: { readingSection: 2 },
      body: `Incident Reporting Procedure

All employees must report accidents, near misses and property damage before the end of the shift. A near miss is an event that could have caused harm, such as a box falling from a shelf without hitting anyone. Reporting near misses helps the safety team prevent future injuries.

Minor incidents are entered on the online form by the employee involved. Serious incidents, including head injuries, fires, chemical spills and any event involving a visitor, must also be reported by phone to the duty manager. Photographs may be attached to the form, but staff should not photograph injured people unless the safety officer requests it.

The safety team reviews reports every Monday. Employees are not blamed for honest reporting, but late or deliberately false reports may lead to disciplinary action. Temporary staff follow the same procedure as permanent staff.`,
    }),
    passage({
      importId: "gt02-r-s3",
      title: "Why Small Museums Matter",
      genre: "general_interest_article",
      orderIndex: 5,
      metadata: { readingSection: 3 },
      body: `A. Large national museums attract the headlines, but small museums often hold the objects through which people understand their own streets. A bus ticket machine, a school photograph or a fisherman's notebook may not look important to outsiders. In the town where it was used, however, it can open a conversation about work, childhood, migration or the sea. Small museums preserve these modest objects before they disappear into attics or skips.

B. Their greatest strength is local trust. Residents are more likely to donate material to a museum run by people they recognise. Curators in small museums often know the families behind the objects, so they can record memories that would be lost in a larger institution. A donated shop sign is not just a sign; it may carry stories about who painted it, why the shop closed and how the street changed.

C. Small museums also make history less intimidating. Visitors who feel overwhelmed by grand galleries may be willing to ask questions in a two-room museum above a library. Volunteers can adjust a tour to suit a school group, a retired visitor or someone researching a family name. This flexibility is difficult in a crowded national museum with timed tickets and fixed routes.

D. Money is the constant problem. Many small museums depend on grants, seasonal ticket sales and unpaid labour. Heating a historic building can cost more than mounting an exhibition. Digital catalogues are useful, but scanning objects and clearing copyright takes time. When funding is short, the public may see only reduced opening hours, not the conservation work that continues behind closed doors.

E. Some critics argue that every town cannot keep its own museum and that collections should be merged into regional centres. This could improve storage and professional care. Yet merging collections can also strip objects of context. A lifeboat bell displayed in a distant city may be technically safer, but it no longer rings in the imagination of the harbour community that remembers it.

F. The most successful small museums are not nostalgic storehouses. They connect old objects to present questions. A display about a closed factory can lead to debate about new employment; an exhibition on migration can invite recent arrivals to add their own stories. In this way, local museums can become civic spaces rather than cupboards of the past.

G. Small museums need support, but not pity. Their scale allows them to move quickly, listen closely and experiment with partnerships. If national museums show a country's broad narrative, small museums show how that narrative landed in ordinary lives. Without them, history would be larger, cleaner and much less personal.`,
    }),
  ],
  listeningSections: [
    {
      importId: "gt02-l-s1",
      sectionNumber: 1,
      title: "Travel clinic appointment",
      accent: "us",
      speakers: [
        { name: "Receptionist", accent: "us" },
        { name: "Nadia", accent: "us" },
      ],
      script: `Receptionist: Good afternoon, Eastside Travel Clinic.

Nadia: Hello. I need an appointment before a work trip. My name is Nadia Chen.

Receptionist: Thank you, Ms Chen. Where are you travelling?

Nadia: To Thailand. I leave on the tenth of June, so I hope I am not too late.

Receptionist: We can see you on Tuesday the fourth of June. The nurse has a free slot at nine fifteen.

Nadia: That is fine. I first thought I could come at nine fifty, but nine fifteen is better.

Receptionist: What is the purpose of the trip?

Nadia: I will attend a training course for my company. It is mostly in Bangkok, but there is one factory visit outside the city.

Receptionist: The nurse will discuss food safety and mosquito protection. Depending on your route, she may prescribe malaria tablets. Please bring your passport and any vaccination record you have.

Nadia: I have the passport, but I am not sure about the record.

Receptionist: Bring the passport at least. The consultation fee is forty-five dollars. If tablets are needed, the pharmacy charges separately.

Nadia: Can you send a receipt to my work email?

Receptionist: Yes. We normally print one, but an email receipt is fine.

Nadia: Where is the clinic entrance? I know the medical centre has two doors.

Receptionist: Use the Green Street entrance. The car park entrance is for the dental practice.

Nadia: Great. Which nurse will I see?

Receptionist: Nurse Patel.`,
    },
    {
      importId: "gt02-l-s2",
      sectionNumber: 2,
      title: "Museum volunteer briefing",
      accent: "uk",
      speakers: [{ name: "Coordinator", accent: "uk" }],
      script: `Coordinator: Welcome to the city museum volunteer team. Before visitors arrive, I will explain the building and your first morning.

Please leave coats and bags in the staff lockers, which are behind the education room. Do not use the cupboards in the cafe corridor; those belong to the catering company. After that, collect your volunteer badge from the front desk. The badge must be visible whenever you are in a public area.

At ten o'clock we expect a school group of thirty pupils. They will begin in the sculpture court, where the teacher will divide them into smaller groups. Two volunteers should stand near the stairs because children sometimes try to go up to the closed balcony. Another volunteer will help at the audio guide desk. The audio guides are free today because the second-floor gallery is partly closed.

Tea and coffee are in the staff room. Lunch is not provided, but you may use the microwave. The public cafe gives volunteers a ten percent discount if you show your badge.

If the fire alarm sounds, guide visitors through the nearest exit and meet by the fountain in Market Square. Do not return to collect personal belongings. If someone asks about lost property, send them to the front desk, not the shop.

Finally, please remember that volunteers answer general questions but should not give valuations. If a visitor brings an object and asks what it is worth, take their contact details for the curator.`,
    },
    {
      importId: "gt02-l-s3",
      sectionNumber: 3,
      title: "Food waste app discussion",
      accent: "aus",
      speakers: [
        { name: "Amara", accent: "aus" },
        { name: "Ben", accent: "uk" },
        { name: "Leo", accent: "us" },
      ],
      script: `Amara: Our app proposal is due next week. We need to agree what problem we are solving. I think the main issue is that students forget what food they already have.

Ben: Yes, but the tutor said an app should change behaviour, not just list groceries. What about reminders before food expires?

Leo: I can build a prototype for expiry reminders. Users enter the date, and the app sends a message two days before.

Amara: Good. I will design the survey because we need evidence from students before we finalise features.

Ben: Then I will look at competitors. There are recipe apps and discount apps, but few combine storage reminders with sharing.

Leo: Sharing is tricky. If students give away food, we need safety rules. Maybe only sealed food can be shared.

Amara: Agreed. For open food, the app can suggest recipes instead. The tutor will like that because it avoids risk.

Ben: We also need a name. I liked Pantry Pal, but it already exists.

Leo: What about Shelf Life?

Amara: Clear, but maybe too serious. We can decide later.

Ben: For the presentation, the strongest statistic is from the campus waste audit: cooked rice and salad were the most common items in the bin.

Leo: I thought bread was first.

Ben: Bread was third. Rice and salad were higher because they spoil quickly after lunch service.

Amara: Our limitation is that we are surveying only students in halls, not students in private flats.

Leo: Right. I will mention that when I demonstrate the prototype.`,
    },
    {
      importId: "gt02-l-s4",
      sectionNumber: 4,
      title: "Street trees and urban cooling",
      accent: "uk",
      speakers: [{ name: "Lecturer", accent: "uk" }],
      script: `Lecturer: This lecture considers how street trees cool cities. The most obvious effect is shade. A parked car or pavement under a tree receives less direct sun, so its surface temperature is lower. But shade is only part of the story.

Trees also cool air through transpiration. Water moves from the roots to the leaves and then evaporates. This process uses heat energy, which can reduce the temperature around the tree. The effect is strongest when trees are healthy and have enough soil volume to support deep roots.

Species choice matters. A fast-growing tree may give shade quickly, but if its branches break easily it can become expensive to maintain. City planners often prefer a mix of species. Diversity reduces the risk that one disease will remove an entire avenue, as happened in many places with elm trees.

Planting location is just as important. A tree placed too close to underground pipes may be removed after a few years. Trees on narrow pavements can block wheelchairs or pushchairs if the pit is poorly designed. Successful schemes plan space above and below ground.

There is also a social dimension. Wealthier streets often have more mature trees, while hotter, poorer neighbourhoods have fewer. Planting programmes therefore need community consultation, not just technical maps. Residents can explain where shade is most needed, for example near bus stops, playgrounds and walking routes to schools.

Street trees are not a complete answer to heatwaves, but they are visible, popular and long-lasting infrastructure when cared for properly.`,
    },
  ],
  questions: [
    completion("gt02-lq01", "listening", 0, "Name: Nadia __BLANK_0__.", "Chen", { sectionImportId: "gt02-l-s1", type: "note_table_form_flowchart_completion", wordLimit: 1, support: "My name is Nadia Chen" }),
    completion("gt02-lq02", "listening", 1, "Destination: __BLANK_0__.", "Thailand", { sectionImportId: "gt02-l-s1", type: "note_table_form_flowchart_completion", wordLimit: 1, support: "To Thailand" }),
    completion("gt02-lq03", "listening", 2, "Departure date: __BLANK_0__ June.", "10", { sectionImportId: "gt02-l-s1", type: "note_table_form_flowchart_completion", wordLimit: 1, acceptVariants: ["tenth"], support: "I leave on the tenth of June" }),
    completion("gt02-lq04", "listening", 3, "Appointment date: __BLANK_0__ June.", "4", { sectionImportId: "gt02-l-s1", type: "note_table_form_flowchart_completion", wordLimit: 1, acceptVariants: ["fourth"], support: "Tuesday the fourth of June" }),
    completion("gt02-lq05", "listening", 4, "Appointment time: __BLANK_0__.", "9:15", { sectionImportId: "gt02-l-s1", type: "note_table_form_flowchart_completion", wordLimit: 1, acceptVariants: ["nine fifteen"], support: "at nine fifteen" }),
    completion("gt02-lq06", "listening", 5, "Main purpose of travel: a company __BLANK_0__ course.", "training", { sectionImportId: "gt02-l-s1", type: "note_table_form_flowchart_completion", wordLimit: 1, support: "a training course for my company" }),
    completion("gt02-lq07", "listening", 6, "The nurse may prescribe malaria __BLANK_0__.", "tablets", { sectionImportId: "gt02-l-s1", type: "note_table_form_flowchart_completion", wordLimit: 1, support: "may prescribe malaria tablets" }),
    completion("gt02-lq08", "listening", 7, "Nadia must bring her __BLANK_0__.", "passport", { sectionImportId: "gt02-l-s1", type: "note_table_form_flowchart_completion", wordLimit: 1, support: "Please bring your passport" }),
    completion("gt02-lq09", "listening", 8, "Consultation fee: __BLANK_0__ dollars.", "45", { sectionImportId: "gt02-l-s1", type: "note_table_form_flowchart_completion", wordLimit: 1, acceptVariants: ["forty-five"], support: "fee is forty-five dollars" }),
    completion("gt02-lq10", "listening", 9, "Clinic entrance: __BLANK_0__ Street.", "Green", { sectionImportId: "gt02-l-s1", type: "note_table_form_flowchart_completion", wordLimit: 1, support: "Use the Green Street entrance" }),

    completion("gt02-lq11", "listening", 10, "Staff lockers are behind the __BLANK_0__ room.", "education", { sectionImportId: "gt02-l-s2", type: "short_answer", wordLimit: 1, support: "behind the education room" }),
    completion("gt02-lq12", "listening", 11, "Volunteers collect their badges from the __BLANK_0__.", "front desk", { sectionImportId: "gt02-l-s2", type: "short_answer", wordLimit: 2, support: "collect your volunteer badge from the front desk" }),
    completion("gt02-lq13", "listening", 12, "A school group will begin in the __BLANK_0__ court.", "sculpture", { sectionImportId: "gt02-l-s2", type: "short_answer", wordLimit: 1, support: "begin in the sculpture court" }),
    completion("gt02-lq14", "listening", 13, "Two volunteers should stand near the __BLANK_0__.", "stairs", { sectionImportId: "gt02-l-s2", type: "short_answer", wordLimit: 1, support: "stand near the stairs" }),
    completion("gt02-lq15", "listening", 14, "Audio guides are free because the second-floor gallery is partly __BLANK_0__.", "closed", { sectionImportId: "gt02-l-s2", type: "sentence_completion", wordLimit: 1, support: "gallery is partly closed" }),
    completion("gt02-lq16", "listening", 15, "Volunteers may use the staff-room __BLANK_0__.", "microwave", { sectionImportId: "gt02-l-s2", type: "short_answer", wordLimit: 1, support: "you may use the microwave" }),
    completion("gt02-lq17", "listening", 16, "The cafe discount is __BLANK_0__ percent.", "10", { sectionImportId: "gt02-l-s2", type: "short_answer", wordLimit: 1, acceptVariants: ["ten"], support: "a ten percent discount" }),
    completion("gt02-lq18", "listening", 17, "In a fire alarm, volunteers meet by the __BLANK_0__.", "fountain", { sectionImportId: "gt02-l-s2", type: "short_answer", wordLimit: 1, support: "meet by the fountain" }),
    completion("gt02-lq19", "listening", 18, "Lost property queries should go to the __BLANK_0__.", "front desk", { sectionImportId: "gt02-l-s2", type: "short_answer", wordLimit: 2, support: "send them to the front desk" }),
    completion("gt02-lq20", "listening", 19, "Volunteers must not give __BLANK_0__.", "valuations", { sectionImportId: "gt02-l-s2", type: "short_answer", wordLimit: 1, support: "should not give valuations" }),

    select({ importId: "gt02-lq21", skill: "listening", questionType: "matching_features", orderIndex: 20, sectionImportId: "gt02-l-s3", groupKey: "gt02-l-s3-tasks", groupInstructions: "Match each task with the student.", prompt: "Build the expiry-reminder prototype", options: ["Amara", "Ben", "Leo"], metadata: { items: [{ id: "0", text: "Build the expiry-reminder prototype" }] }, correctAnswer: { "0": "2" }, support: "I can build a prototype for expiry reminders" }),
    select({ importId: "gt02-lq22", skill: "listening", questionType: "matching_features", orderIndex: 21, sectionImportId: "gt02-l-s3", groupKey: "gt02-l-s3-tasks", groupInstructions: "Match each task with the student.", prompt: "Design the survey", options: ["Amara", "Ben", "Leo"], metadata: { items: [{ id: "0", text: "Design the survey" }] }, correctAnswer: { "0": "0" }, support: "I will design the survey" }),
    select({ importId: "gt02-lq23", skill: "listening", questionType: "matching_features", orderIndex: 22, sectionImportId: "gt02-l-s3", groupKey: "gt02-l-s3-tasks", groupInstructions: "Match each task with the student.", prompt: "Research competitor apps", options: ["Amara", "Ben", "Leo"], metadata: { items: [{ id: "0", text: "Research competitor apps" }] }, correctAnswer: { "0": "1" }, support: "I will look at competitors" }),
    select({ importId: "gt02-lq24", skill: "listening", questionType: "mcq_single", orderIndex: 23, sectionImportId: "gt02-l-s3", prompt: "What does Ben say the app needs to do?", options: ["Change behaviour", "Sell discounted food", "Replace the tutor's survey"], correctAnswer: "0", support: "an app should change behaviour" }),
    completion("gt02-lq25", "listening", 24, "The app sends a reminder __BLANK_0__ days before food expires.", "two", { sectionImportId: "gt02-l-s3", type: "sentence_completion", wordLimit: 1, acceptVariants: ["2"], support: "two days before" }),
    completion("gt02-lq26", "listening", 25, "Students should share only __BLANK_0__ food.", "sealed", { sectionImportId: "gt02-l-s3", type: "sentence_completion", wordLimit: 1, support: "only sealed food can be shared" }),
    select({ importId: "gt02-lq27", skill: "listening", questionType: "mcq_single", orderIndex: 26, sectionImportId: "gt02-l-s3", prompt: "What name is rejected because it already exists?", options: ["Shelf Life", "Pantry Pal", "Waste Watch"], correctAnswer: "1", support: "I liked Pantry Pal, but it already exists" }),
    completion("gt02-lq28", "listening", 27, "In the waste audit, cooked rice and __BLANK_0__ were most common.", "salad", { sectionImportId: "gt02-l-s3", type: "sentence_completion", wordLimit: 1, support: "cooked rice and salad were the most common" }),
    completion("gt02-lq29", "listening", 28, "The survey excludes students in private __BLANK_0__.", "flats", { sectionImportId: "gt02-l-s3", type: "sentence_completion", wordLimit: 1, support: "not students in private flats" }),
    select({ importId: "gt02-lq30", skill: "listening", questionType: "mcq_single", orderIndex: 29, sectionImportId: "gt02-l-s3", prompt: "When will Leo mention the study limitation?", options: ["During the prototype demonstration", "Before the survey", "At the start of the competitor review"], correctAnswer: "0", support: "I will mention that when I demonstrate the prototype" }),

    completion("gt02-lq31", "listening", 30, "The most obvious cooling effect of trees is __BLANK_0__.", "shade", { sectionImportId: "gt02-l-s4", type: "summary_completion", wordLimit: 1, support: "most obvious effect is shade" }),
    completion("gt02-lq32", "listening", 31, "Trees cool air through __BLANK_0__.", "transpiration", { sectionImportId: "gt02-l-s4", type: "summary_completion", wordLimit: 1, support: "cool air through transpiration" }),
    completion("gt02-lq33", "listening", 32, "The cooling effect is strongest when roots have enough soil __BLANK_0__.", "volume", { sectionImportId: "gt02-l-s4", type: "summary_completion", wordLimit: 1, support: "enough soil volume" }),
    completion("gt02-lq34", "listening", 33, "A fast-growing tree may be expensive to __BLANK_0__.", "maintain", { sectionImportId: "gt02-l-s4", type: "summary_completion", wordLimit: 1, support: "expensive to maintain" }),
    completion("gt02-lq35", "listening", 34, "Species diversity reduces the risk from one __BLANK_0__.", "disease", { sectionImportId: "gt02-l-s4", type: "summary_completion", wordLimit: 1, support: "one disease" }),
    completion("gt02-lq36", "listening", 35, "Trees may be removed if they are too close to underground __BLANK_0__.", "pipes", { sectionImportId: "gt02-l-s4", type: "summary_completion", wordLimit: 1, support: "too close to underground pipes" }),
    completion("gt02-lq37", "listening", 36, "Poorly designed tree pits can block wheelchairs or __BLANK_0__.", "pushchairs", { sectionImportId: "gt02-l-s4", type: "summary_completion", wordLimit: 1, support: "block wheelchairs or pushchairs" }),
    completion("gt02-lq38", "listening", 37, "Planting programmes need community __BLANK_0__.", "consultation", { sectionImportId: "gt02-l-s4", type: "summary_completion", wordLimit: 1, support: "need community consultation" }),
    completion("gt02-lq39", "listening", 38, "Residents may identify shade needs near bus stops and __BLANK_0__.", "playgrounds", { sectionImportId: "gt02-l-s4", type: "summary_completion", wordLimit: 1, support: "near bus stops, playgrounds" }),
    completion("gt02-lq40", "listening", 39, "Street trees are long-lasting __BLANK_0__ when cared for properly.", "infrastructure", { sectionImportId: "gt02-l-s4", type: "summary_completion", wordLimit: 1, support: "long-lasting infrastructure" }),

    completion("gt02-rq01", "reading", 0, "Paint is accepted on the first __BLANK_0__ of each month.", "Saturday", { passageImportId: "gt02-r-s1a", type: "sentence_completion", wordLimit: 1, support: "first Saturday of each month" }),
    select({ importId: "gt02-rq02", skill: "reading", questionType: "true_false_notgiven", orderIndex: 1, passageImportId: "gt02-r-s1a", prompt: "The recycling centre accepts car tyres.", correctAnswer: "FALSE", support: "car tyres and medical waste are not accepted" }),
    completion("gt02-rq03", "reading", 2, "Vans over two metres require a free __BLANK_0__.", "permit", { passageImportId: "gt02-r-s1a", type: "sentence_completion", wordLimit: 1, support: "need a free permit" }),
    completion("gt02-rq04", "reading", 3, "The reuse shop sells items that have passed a safety __BLANK_0__.", "check", { passageImportId: "gt02-r-s1a", type: "sentence_completion", wordLimit: 1, support: "passed a safety check" }),
    select({ importId: "gt02-rq05", skill: "reading", questionType: "true_false_notgiven", orderIndex: 4, passageImportId: "gt02-r-s1a", prompt: "Staff can help visitors unload heavy items.", correctAnswer: "FALSE", support: "Staff cannot help unload heavy items" }),
    completion("gt02-rq06", "reading", 5, "New sports-club members avoid the joining fee if they join before __BLANK_0__.", "30 April", { passageImportId: "gt02-r-s1b", type: "sentence_completion", wordLimit: 2, support: "join before 30 April" }),
    select({ importId: "gt02-rq07", skill: "reading", questionType: "mcq_single", orderIndex: 6, passageImportId: "gt02-r-s1b", prompt: "Which facility costs extra?", options: ["Gym", "Swimming", "Outdoor tennis"], correctAnswer: "1", support: "Swimming costs extra" }),
    completion("gt02-rq08", "reading", 7, "Junior members must be linked to an __BLANK_0__ account.", "adult", { passageImportId: "gt02-r-s1b", type: "sentence_completion", wordLimit: 1, support: "linked to an adult account" }),
    select({ importId: "gt02-rq09", skill: "reading", questionType: "true_false_notgiven", orderIndex: 8, passageImportId: "gt02-r-s1b", prompt: "Off-peak members may enter on Saturday mornings.", correctAnswer: "FALSE", support: "but not on Saturday mornings" }),
    completion("gt02-rq10", "reading", 9, "Members need a doctor's note to freeze an account for medical __BLANK_0__.", "reasons", { passageImportId: "gt02-r-s1b", type: "sentence_completion", wordLimit: 1, support: "for medical reasons by providing a doctor's note" }),
    completion("gt02-rq11", "reading", 10, "Laptop loans last __BLANK_0__ hours.", "three", { passageImportId: "gt02-r-s1c", type: "sentence_completion", wordLimit: 1, acceptVariants: ["3"], support: "Loans last three hours" }),
    select({ importId: "gt02-rq12", skill: "reading", questionType: "true_false_notgiven", orderIndex: 11, passageImportId: "gt02-r-s1c", prompt: "Files are kept on the laptop for the next user.", correctAnswer: "FALSE", support: "Files saved on the laptop are deleted automatically" }),
    completion("gt02-rq13", "reading", 12, "Printing must be paid for at the self-service __BLANK_0__.", "kiosk", { passageImportId: "gt02-r-s1c", type: "short_answer", wordLimit: 1, support: "payment must be made at the self-service kiosk" }),
    select({ importId: "gt02-rq14", skill: "reading", questionType: "true_false_notgiven", orderIndex: 13, passageImportId: "gt02-r-s1c", prompt: "Food is allowed at laptop desks if drinks are covered.", correctAnswer: "FALSE", support: "Food and drinks are not allowed" }),

    completion("gt02-rq15", "reading", 14, "Room attendants receive their room list at __BLANK_0__ a.m.", "8:15", { passageImportId: "gt02-r-s2a", type: "sentence_completion", wordLimit: 1, support: "at 8:15 a.m." }),
    completion("gt02-rq16", "reading", 15, "Departure rooms should usually be cleaned before __BLANK_0__.", "stayovers", { passageImportId: "gt02-r-s2a", type: "sentence_completion", wordLimit: 1, support: "before stayovers" }),
    select({ importId: "gt02-rq17", skill: "reading", questionType: "true_false_notgiven", orderIndex: 16, passageImportId: "gt02-r-s2a", prompt: "Guests with a 'do not disturb' sign may be called at 10:30 a.m.", correctAnswer: "FALSE", support: "must not be called before 11 a.m." }),
    completion("gt02-rq18", "reading", 17, "Each trolley should carry linen for __BLANK_0__ rooms.", "eight", { passageImportId: "gt02-r-s2a", type: "sentence_completion", wordLimit: 1, acceptVariants: ["8"], support: "linen for eight rooms" }),
    completion("gt02-rq19", "reading", 18, "Leaking chemical bottles go in the __BLANK_0__ tray.", "yellow", { passageImportId: "gt02-r-s2a", type: "sentence_completion", wordLimit: 1, support: "place it in the yellow tray" }),
    completion("gt02-rq20", "reading", 19, "Lost property is placed in a clear __BLANK_0__.", "bag", { passageImportId: "gt02-r-s2a", type: "sentence_completion", wordLimit: 1, support: "placed in a clear bag" }),
    select({ importId: "gt02-rq21", skill: "reading", questionType: "matching_features", orderIndex: 20, passageImportId: "gt02-r-s2a", groupKey: "gt02-r-s2a-valuables", groupInstructions: "Choose the correct destination.", prompt: "Passports found in rooms", options: ["Housekeeping office", "Duty manager", "Guest fridge"], metadata: { items: [{ id: "0", text: "Passports found in rooms" }] }, correctAnswer: { "0": "1" }, support: "passports go directly to the duty manager" }),
    completion("gt02-rq22", "reading", 21, "A missing master key is treated as a security __BLANK_0__.", "incident", { passageImportId: "gt02-r-s2a", type: "sentence_completion", wordLimit: 1, support: "treated as a security incident" }),
    completion("gt02-rq23", "reading", 22, "All accidents and near misses must be reported before the end of the __BLANK_0__.", "shift", { passageImportId: "gt02-r-s2b", type: "sentence_completion", wordLimit: 1, support: "before the end of the shift" }),
    completion("gt02-rq24", "reading", 23, "Near-miss reporting helps prevent future __BLANK_0__.", "injuries", { passageImportId: "gt02-r-s2b", type: "sentence_completion", wordLimit: 1, support: "prevent future injuries" }),
    select({ importId: "gt02-rq25", skill: "reading", questionType: "mcq_single", orderIndex: 24, passageImportId: "gt02-r-s2b", prompt: "Which incident must be reported by phone to the duty manager?", options: ["A minor scratch to paintwork", "A chemical spill", "A late online form"], correctAnswer: "1", support: "chemical spills and any event involving a visitor, must also be reported by phone to the duty manager" }),
    select({ importId: "gt02-rq26", skill: "reading", questionType: "true_false_notgiven", orderIndex: 25, passageImportId: "gt02-r-s2b", prompt: "Staff should usually photograph injured people for the report.", correctAnswer: "FALSE", support: "should not photograph injured people unless the safety officer requests it" }),
    completion("gt02-rq27", "reading", 26, "The safety team reviews reports every __BLANK_0__.", "Monday", { passageImportId: "gt02-r-s2b", type: "sentence_completion", wordLimit: 1, support: "reviews reports every Monday" }),

    select({ importId: "gt02-rq28", skill: "reading", questionType: "matching_headings", orderIndex: 27, passageImportId: "gt02-r-s3", prompt: "Paragraph B", options: ["Financial pressure", "Local trust and memory", "A national story", "Technology in museums"], metadata: { items: [{ id: "0", text: "Paragraph B" }] }, correctAnswer: { "0": "1" }, support: "Their greatest strength is local trust" }),
    select({ importId: "gt02-rq29", skill: "reading", questionType: "matching_headings", orderIndex: 28, passageImportId: "gt02-r-s3", prompt: "Paragraph D", options: ["Financial pressure", "A flexible tour", "Objects without context", "School visits"], metadata: { items: [{ id: "0", text: "Paragraph D" }] }, correctAnswer: { "0": "0" }, support: "Money is the constant problem" }),
    select({ importId: "gt02-rq30", skill: "reading", questionType: "matching_headings", orderIndex: 29, passageImportId: "gt02-r-s3", prompt: "Paragraph F", options: ["Civic spaces, not storehouses", "The case for merging", "The cost of heating", "Donation problems"], metadata: { items: [{ id: "0", text: "Paragraph F" }] }, correctAnswer: { "0": "0" }, support: "become civic spaces rather than cupboards of the past" }),
    select({ importId: "gt02-rq31", skill: "reading", questionType: "matching_information", orderIndex: 30, passageImportId: "gt02-r-s3", prompt: "Which paragraph mentions a bus ticket machine?", options: ["A", "C", "E", "G"], metadata: { items: [{ id: "0", text: "bus ticket machine" }] }, correctAnswer: { "0": "0" }, support: "A bus ticket machine" }),
    select({ importId: "gt02-rq32", skill: "reading", questionType: "matching_information", orderIndex: 31, passageImportId: "gt02-r-s3", prompt: "Which paragraph discusses scanning objects?", options: ["B", "D", "F", "G"], metadata: { items: [{ id: "0", text: "scanning objects" }] }, correctAnswer: { "0": "1" }, support: "scanning objects and clearing copyright" }),
    completion("gt02-rq33", "reading", 32, "Small museums preserve modest objects before they disappear into attics or __BLANK_0__.", "skips", { passageImportId: "gt02-r-s3", type: "summary_completion", wordLimit: 1, support: "attics or skips" }),
    completion("gt02-rq34", "reading", 33, "A donated shop sign may carry stories about how the street __BLANK_0__.", "changed", { passageImportId: "gt02-r-s3", type: "summary_completion", wordLimit: 1, support: "how the street changed" }),
    select({ importId: "gt02-rq35", skill: "reading", questionType: "true_false_notgiven", orderIndex: 34, passageImportId: "gt02-r-s3", prompt: "Small museums can adjust tours for different visitors.", correctAnswer: "TRUE", support: "Volunteers can adjust a tour to suit a school group" }),
    completion("gt02-rq36", "reading", 35, "Heating a historic building can cost more than mounting an __BLANK_0__.", "exhibition", { passageImportId: "gt02-r-s3", type: "sentence_completion", wordLimit: 1, support: "cost more than mounting an exhibition" }),
    select({ importId: "gt02-rq37", skill: "reading", questionType: "mcq_single", orderIndex: 36, passageImportId: "gt02-r-s3", prompt: "What possible benefit of merging collections is mentioned?", options: ["Improved storage and care", "More local donations", "Longer opening hours"], correctAnswer: "0", support: "could improve storage and professional care" }),
    completion("gt02-rq38", "reading", 37, "Merging collections can strip objects of __BLANK_0__.", "context", { passageImportId: "gt02-r-s3", type: "sentence_completion", wordLimit: 1, support: "strip objects of context" }),
    completion("gt02-rq39", "reading", 38, "An exhibition on migration can invite recent arrivals to add their own __BLANK_0__.", "stories", { passageImportId: "gt02-r-s3", type: "sentence_completion", wordLimit: 1, support: "add their own stories" }),
    select({ importId: "gt02-rq40", skill: "reading", questionType: "mcq_single", orderIndex: 39, passageImportId: "gt02-r-s3", prompt: "What is the writer's overall view of small museums?", options: ["They are less useful than national museums.", "They make history personal and locally meaningful.", "They should become storage centres."], correctAnswer: "1", support: "show how that narrative landed in ordinary lives" }),

    ws({ importId: "gt02-wq01", skill: "writing", questionType: "writing_task1_general", orderIndex: 0, prompt: "You have moved to a new city for work. Write a letter to a friend. In your letter, describe your new home, explain what you like about the city, and invite your friend to visit. Write at least 150 words. Register: informal.", modelAnswer: `Dear Maya,

I finally moved into my new place last weekend, and I think you would love it. The flat is small but bright, with a little balcony that looks over a row of maple trees. I had to buy a desk that folds against the wall, but otherwise it already feels comfortable.

The city has surprised me in a good way. My office is only fifteen minutes away by tram, and there is a food market near the station every Thursday. People seem friendly without being too nosy, which suits me perfectly. I have also found a riverside path where I can run after work, although I am still getting lost on the way back.

You should come for a weekend when your project calms down. I can give you the sofa bed, and we could visit the old cinema I told you about. Let me know which dates might work.

Love,
Nadia`, examinerNotes: { task: "Warm informal letter covers home, city and invitation clearly.", coherence: "Natural paragraphing and progression.", lexical: "Good informal range: bright, folds against the wall, suits me.", grammar: "Accurate variety of clauses and modals." }, metadata: { register: "informal", wordMin: 150 } }),
    ws({ importId: "gt02-wq02", skill: "writing", questionType: "writing_task2_essay", orderIndex: 1, prompt: "Some people believe children should help with household tasks from a young age, while others think childhood should be free from such responsibilities. Discuss both views and give your own opinion. Write at least 250 words.", modelAnswer: `Whether children should do household chores is a question of balance. Some adults worry that responsibilities at home reduce children's freedom, but I believe age-appropriate tasks are valuable when they do not become excessive.

On the one hand, childhood should not feel like unpaid domestic labour. Young children need time to play, rest, read and build friendships. If parents demand too much, chores can interfere with homework or create resentment, especially when tasks are divided unfairly between boys and girls. In families under financial pressure, there is also a risk that older children are expected to act like substitute adults, which can harm their education.

On the other hand, simple household tasks teach practical competence and consideration for others. A child who sets the table, feeds a pet or puts laundry away learns that a home is maintained by shared effort. These habits can build independence and confidence. Chores also give parents a chance to teach planning and responsibility in a concrete way, rather than only through lectures.

In my opinion, children should help at home, but the tasks should match their age and should not dominate their free time. A five-year-old can tidy toys; a teenager can cook a basic meal or clean a bathroom. The aim is not to make children carry adult burdens, but to help them become capable members of a household. Used sensibly, chores support childhood rather than take it away.`, examinerNotes: { task: "Discusses both sides fully and gives a clear balanced opinion.", coherence: "Clear progression from caution to benefits to position.", lexical: "Precise topic vocabulary: age-appropriate, resentment, shared effort.", grammar: "Flexible complex forms with strong control." }, metadata: { wordMin: 250 } }),
    ws({ importId: "gt02-sq01", skill: "speaking", questionType: "speaking_part1", orderIndex: 0, prompt: "Part 1: Let's talk about cooking. Do you enjoy cooking? Who usually cooks in your home? What food would you like to learn to make?", modelAnswer: "A strong response gives personal examples, uses food-preparation vocabulary and explains preferences rather than listing foods.", examinerNotes: { fluency: "Natural, extended answers.", lexical: "Range for ingredients, methods and taste.", grammar: "Accurate present habits and future intentions.", pronunciation: "Clear word stress on food vocabulary." }, metadata: { topic: "cooking" } }),
    ws({ importId: "gt02-sq02", skill: "speaking", questionType: "speaking_part2_cuecard", orderIndex: 1, prompt: "Describe a journey that took longer than expected. You should say where you were going, why it took longer, what you did during the delay, and explain how you felt in the end.", options: ["where you were going", "why it took longer", "what you did during the delay", "how you felt"], modelAnswer: "A band-9 answer would narrate the delay clearly, include feelings that change over time, and use cohesive phrases such as at first, eventually and looking back.", examinerNotes: { fluency: "Sustains narrative detail.", lexical: "Uses transport and emotion vocabulary flexibly.", grammar: "Strong past-tense control.", pronunciation: "Intonation marks the stages of the story." }, metadata: { topic: "journeys" } }),
    ws({ importId: "gt02-sq03", skill: "speaking", questionType: "speaking_part3", orderIndex: 2, prompt: "Part 3: Why do people sometimes prefer travelling slowly? How has technology changed travel planning? Should governments invest more in public transport?", modelAnswer: "A strong answer compares convenience, cost and environmental impact, while giving concrete examples from trains, buses and travel apps.", examinerNotes: { fluency: "Develops abstract comparisons smoothly.", lexical: "Uses planning and transport lexis accurately.", grammar: "Controls conditionals and comparative structures.", pronunciation: "Clear rhythm in longer arguments." }, metadata: { topic: "travel" } }),
  ],
});

const mock03 = withQuestionDefaults({
  slug: "general-training-mock-03",
  title: "General Training Mock 03",
  description: "Original IELTS General Training full mock authored for Thinkfy QA.",
  passages: [
    passage({
      importId: "gt03-r-s1a",
      title: "Apartment Building Notice",
      genre: "notice",
      orderIndex: 0,
      metadata: { readingSection: 1 },
      body: `Notice to Residents: Larch House

The lift will be serviced on Monday between 9 a.m. and 1 p.m. During this time, residents should use the stairs. Anyone who cannot use the stairs should contact the building manager by Friday so that a temporary ground-floor workspace can be arranged.

Balcony planters must be secured before windy weather. Items left in corridors will be removed because they block emergency access. The bicycle room will be cleaned next Wednesday; bikes without a blue resident sticker may be moved to the outdoor rack. Replacement stickers are available from the manager's office for 2 pounds.`,
    }),
    passage({
      importId: "gt03-r-s1b",
      title: "Swimming Pool Timetable",
      genre: "schedule",
      orderIndex: 1,
      metadata: { readingSection: 1 },
      body: `Meadow Pool Timetable

Lane swimming: Monday to Friday, 6:30-8:30 a.m.; Tuesday and Thursday, 8:00-9:30 p.m.
Family swim: Saturday, 10:00 a.m.-1:00 p.m.; Sunday, 2:00-5:00 p.m.
Aqua fitness: Monday and Wednesday, 12:15-1:00 p.m.
Quiet swim: Friday, 3:00-4:00 p.m. for adults who prefer low-noise sessions.

Children under eight must be accompanied in the water by an adult. Lockers take a refundable 1-pound coin. The cafe is closed during evening sessions. Spectators may sit in the viewing gallery, but outdoor shoes must be covered with overshoes from reception.`,
    }),
    passage({
      importId: "gt03-r-s1c",
      title: "Volunteer Gardeners Wanted",
      genre: "advertisement",
      orderIndex: 2,
      metadata: { readingSection: 1 },
      body: `Volunteer Gardeners Wanted

The Southbank Clinic garden needs volunteers on Friday mornings from March to October. Tasks include watering raised beds, sweeping paths, planting herbs and chatting with patients who use the garden. No gardening experience is required; a lead volunteer explains the tasks each week.

Volunteers must be over eighteen and able to commit to at least two mornings per month. Gloves and tools are provided, but volunteers should wear closed shoes. A free bus pass is available after the first month. To apply, complete the short form at reception and attend a thirty-minute safety briefing.`,
    }),
    passage({
      importId: "gt03-r-s2a",
      title: "Cafe Shift Rules",
      genre: "workplace_rules",
      orderIndex: 3,
      metadata: { readingSection: 2 },
      body: `Harbour Bean Cafe: Shift Rules

Staff should arrive ten minutes before the shift begins and sign in on the tablet near the office door. Aprons are kept in labelled drawers and must not be taken home. Long hair must be tied back before entering the food preparation area.

The opening barista checks the grinder, fills the milk fridge and records the temperature of the cake display. If the display is above five degrees Celsius, cakes should not be sold until the supervisor has checked them. The closing barista cleans the steam wand, empties the knock box and switches off the espresso machine after the final backflush.

Breaks are recorded on the tablet. Staff working more than five hours receive a paid fifteen-minute break and an unpaid meal break. Drinks are free during breaks, but food is charged at half price. Staff discounts cannot be used for friends.

Customer complaints should be handled calmly. If a refund is requested, call the supervisor; do not remove cash from the till without approval. Any allergy question must be answered using the printed ingredient folder, not from memory.`,
    }),
    passage({
      importId: "gt03-r-s2b",
      title: "Training Feedback Process",
      genre: "workplace_training",
      orderIndex: 4,
      metadata: { readingSection: 2 },
      body: `Training Feedback Process

After every internal training session, employees receive an online feedback form. The form asks about the trainer, materials, timing and immediate usefulness of the session. It should be completed within forty-eight hours while the details are still fresh.

Managers see a summary of scores for their department, but individual names are removed unless the employee agrees to be contacted. Comments that mention a health and safety risk are forwarded to the training manager within one working day. Requests for new courses are reviewed at the end of each quarter.

Employees who miss a compulsory session must book a catch-up within two weeks. If the training was missed because of annual leave, no explanation is needed. If it was missed without approval, the line manager is notified automatically.`,
    }),
    passage({
      importId: "gt03-r-s3",
      title: "The Rise of Community Science",
      genre: "general_interest_article",
      orderIndex: 5,
      metadata: { readingSection: 3 },
      body: `A. Community science, sometimes called citizen science, invites ordinary people to collect information that researchers could not gather alone. Volunteers count birds, photograph insects, test river water or record the brightness of the night sky. The work may look simple, but thousands of small observations can reveal patterns across a country or even a continent.

B. The approach has become more powerful because of mobile technology. A phone can record location, time and a photograph in one action. Apps can guide volunteers through identification questions and warn them when a record seems unusual. This does not remove the need for expert checking, but it reduces common errors and speeds up the flow of data.

C. Community science also changes the relationship between researchers and the public. People who collect data often become more interested in the issue being studied. A person who measures air quality outside a school may start asking why traffic is heavy there. In this way, a data project can become a doorway into local decision-making.

D. Quality control remains the central challenge. Volunteers vary in experience, and some species or measurements are difficult. Successful projects provide clear instructions, training videos and feedback. Many use repeated observations, so one mistaken record does not distort the whole picture. Scientists must design tasks that are useful without pretending that every volunteer is a specialist.

E. There are ethical questions too. Projects should not treat communities merely as cheap labour. Participants deserve to know how their data will be used and whether it may influence policy. In areas affected by pollution or flooding, researchers should share results in accessible language, not only in academic journals.

F. Schools have embraced community science because it combines outdoor activity with real evidence. Students may monitor pollinators in the playground or compare temperatures in shaded and unshaded areas. The fact that their results enter a wider database can make science feel less like an exercise and more like participation.

G. The future of community science will depend on trust. Good projects respect local knowledge, protect personal data and admit uncertainty. When these conditions are met, community science can produce valuable research while giving people a stronger voice in the places where they live.`,
    }),
  ],
  listeningSections: [
    {
      importId: "gt03-l-s1",
      sectionNumber: 1,
      title: "Bike repair course enrolment",
      accent: "uk",
      speakers: [
        { name: "Assistant", accent: "uk" },
        { name: "Owen", accent: "uk" },
      ],
      script: `Assistant: Cycle Hub workshops. How can I help?

Owen: I would like to enrol on the beginner bike repair course. My name is Owen Miller.

Assistant: Certainly. The next course starts on Saturday the twelfth of July. It runs for four Saturdays.

Owen: Good. Where is it held?

Assistant: At the old railway workshop on King Street. Some people go to our shop by mistake, but the course is not there.

Owen: What time does it begin?

Assistant: Ten thirty. We ask people to arrive at ten fifteen on the first day to collect name labels.

Owen: And the fee?

Assistant: Sixty-five pounds. That includes use of tools and a small parts kit.

Owen: Do I need to bring anything?

Assistant: Bring a notebook. You can bring your own bike for the final session, but not for the first three.

Owen: I am a complete beginner.

Assistant: That is fine. The course is designed for beginners, especially commuters who want to fix punctures and adjust brakes.

Owen: Can I pay by card?

Assistant: Yes, card payment is easiest. Once payment is received, we send a confirmation text.

Owen: Who teaches the course?

Assistant: Aisha Khan. She is one of our mechanics and also leads the women's cycling group.`,
    },
    {
      importId: "gt03-l-s2",
      sectionNumber: 2,
      title: "Park volunteer briefing",
      accent: "aus",
      speakers: [{ name: "Ranger", accent: "aus" }],
      script: `Ranger: Thanks for volunteering at Brook Park today. We will spend the morning clearing litter from the stream path and planting native grasses near the pond.

Please sign the attendance sheet on the picnic table before you collect equipment. Gloves are in the green crate, litter pickers are in the long black box, and first-aid kits are with the team leaders. Do not take tools from the maintenance shed; those are for council staff only.

We will work in three groups. Group A starts by the stream bridge and moves north. Group B works around the pond edge, but only in the marked area because the bank is soft. Group C checks the playground and the benches near the cafe.

If you find sharp objects, do not pick them up. Call a team leader, who will use the red container. If you see nesting birds, move away quietly and report the location. We are avoiding the east reed bed today for that reason.

There is a break at eleven fifteen. Water is provided, but please use your own bottle. The public toilets are beside the cafe. We finish at one o'clock, and volunteers who stay until the end can take home a packet of wildflower seeds.`,
    },
    {
      importId: "gt03-l-s3",
      sectionNumber: 3,
      title: "Remote learning presentation",
      accent: "us",
      speakers: [
        { name: "Clara", accent: "us" },
        { name: "Mateo", accent: "us" },
        { name: "Ruth", accent: "uk" },
      ],
      script: `Clara: Our presentation is about remote learning after the pandemic. We need to avoid making it just personal opinion.

Mateo: I can summarise the student survey. The strongest result is that recorded lectures helped students who worked part-time.

Ruth: I will compare the two platforms the university used. The old platform was stable but hard to navigate, while the new one has better discussion boards.

Clara: Then I will handle the teacher interviews. Most teachers liked the flexibility but said online group work was harder to supervise.

Mateo: Should we recommend keeping all lectures online?

Ruth: Not all. The evidence supports a blended model. Practical classes and first-year seminars should be in person.

Clara: We also need to mention digital access. Some students had poor internet at home.

Mateo: The library loaned laptops, but not routers. That is a weakness.

Ruth: For visuals, I can make a chart showing satisfaction by year group.

Clara: Good. First-year students were the least satisfied, weren't they?

Mateo: Yes, because they had not formed study groups yet. Final-year students were more positive.

Ruth: Our conclusion should be that remote learning is useful as a support, not as a complete replacement.

Clara: Agreed. I will write that final sentence.`,
    },
    {
      importId: "gt03-l-s4",
      sectionNumber: 4,
      title: "Coastal wetlands",
      accent: "uk",
      speakers: [{ name: "Lecturer", accent: "uk" }],
      script: `Lecturer: Coastal wetlands are areas where land and sea meet in a shifting boundary. They include salt marshes, mangroves and mudflats. For a long time, many were drained for farming or building, but attitudes have changed.

One reason is flood protection. Wetlands absorb wave energy before it reaches sea walls or houses. A wide marsh can reduce the height and force of storm water. This protection is not instant; plants need time to establish roots that hold sediment.

Wetlands are also nurseries for fish. Young fish hide among roots and shallow channels where larger predators cannot easily follow. Birds feed on the insects and shellfish found in the mud. As a result, a wetland that looks empty at low tide may support a complex food web.

Restoration projects often begin by removing old embankments. This allows tides to return and deposit sediment naturally. Engineers may cut channels to guide the first flows, but after that the site should develop with limited interference.

There can be conflict. Farmers may worry about losing productive land, and walkers may dislike temporary mud or restricted paths. Good projects involve local people early and explain the long-term benefits, including carbon storage. Wetland soils can trap large amounts of carbon if they remain wet.

The main lesson is that coastal defence is not only concrete. In many places, giving space back to water is safer than trying to hold every line fixed.`,
    },
  ],
  questions: [
    completion("gt03-lq01", "listening", 0, "Course participant: Owen __BLANK_0__.", "Miller", { sectionImportId: "gt03-l-s1", type: "note_table_form_flowchart_completion", wordLimit: 1, support: "My name is Owen Miller" }),
    completion("gt03-lq02", "listening", 1, "Course starts: __BLANK_0__ July.", "12", { sectionImportId: "gt03-l-s1", type: "note_table_form_flowchart_completion", wordLimit: 1, acceptVariants: ["twelfth"], support: "twelfth of July" }),
    completion("gt03-lq03", "listening", 2, "Course length: four __BLANK_0__.", "Saturdays", { sectionImportId: "gt03-l-s1", type: "note_table_form_flowchart_completion", wordLimit: 1, support: "runs for four Saturdays" }),
    completion("gt03-lq04", "listening", 3, "Venue: old railway __BLANK_0__.", "workshop", { sectionImportId: "gt03-l-s1", type: "note_table_form_flowchart_completion", wordLimit: 1, support: "old railway workshop" }),
    completion("gt03-lq05", "listening", 4, "First-day arrival time: __BLANK_0__.", "10:15", { sectionImportId: "gt03-l-s1", type: "note_table_form_flowchart_completion", wordLimit: 1, acceptVariants: ["ten fifteen"], support: "arrive at ten fifteen" }),
    completion("gt03-lq06", "listening", 5, "Fee: __BLANK_0__ pounds.", "65", { sectionImportId: "gt03-l-s1", type: "note_table_form_flowchart_completion", wordLimit: 1, acceptVariants: ["sixty-five"], support: "Sixty-five pounds" }),
    completion("gt03-lq07", "listening", 6, "Students should bring a __BLANK_0__.", "notebook", { sectionImportId: "gt03-l-s1", type: "note_table_form_flowchart_completion", wordLimit: 1, support: "Bring a notebook" }),
    completion("gt03-lq08", "listening", 7, "The course is designed for __BLANK_0__.", "beginners", { sectionImportId: "gt03-l-s1", type: "note_table_form_flowchart_completion", wordLimit: 1, support: "designed for beginners" }),
    completion("gt03-lq09", "listening", 8, "Confirmation is sent by __BLANK_0__.", "text", { sectionImportId: "gt03-l-s1", type: "note_table_form_flowchart_completion", wordLimit: 1, support: "send a confirmation text" }),
    completion("gt03-lq10", "listening", 9, "Instructor: Aisha __BLANK_0__.", "Khan", { sectionImportId: "gt03-l-s1", type: "note_table_form_flowchart_completion", wordLimit: 1, support: "Aisha Khan" }),

    completion("gt03-lq11", "listening", 10, "Volunteers will clear litter from the stream __BLANK_0__.", "path", { sectionImportId: "gt03-l-s2", type: "short_answer", wordLimit: 1, support: "stream path" }),
    completion("gt03-lq12", "listening", 11, "Native grasses will be planted near the __BLANK_0__.", "pond", { sectionImportId: "gt03-l-s2", type: "short_answer", wordLimit: 1, support: "near the pond" }),
    completion("gt03-lq13", "listening", 12, "The attendance sheet is on the __BLANK_0__ table.", "picnic", { sectionImportId: "gt03-l-s2", type: "short_answer", wordLimit: 1, support: "on the picnic table" }),
    completion("gt03-lq14", "listening", 13, "Gloves are in the __BLANK_0__ crate.", "green", { sectionImportId: "gt03-l-s2", type: "short_answer", wordLimit: 1, support: "Gloves are in the green crate" }),
    completion("gt03-lq15", "listening", 14, "Group A starts by the stream __BLANK_0__.", "bridge", { sectionImportId: "gt03-l-s2", type: "short_answer", wordLimit: 1, support: "starts by the stream bridge" }),
    completion("gt03-lq16", "listening", 15, "Group C checks benches near the __BLANK_0__.", "cafe", { sectionImportId: "gt03-l-s2", type: "short_answer", wordLimit: 1, support: "benches near the cafe" }),
    completion("gt03-lq17", "listening", 16, "Sharp objects go in the __BLANK_0__ container.", "red", { sectionImportId: "gt03-l-s2", type: "short_answer", wordLimit: 1, support: "use the red container" }),
    completion("gt03-lq18", "listening", 17, "Volunteers should avoid the east __BLANK_0__ bed.", "reed", { sectionImportId: "gt03-l-s2", type: "short_answer", wordLimit: 1, support: "avoiding the east reed bed" }),
    completion("gt03-lq19", "listening", 18, "The break is at __BLANK_0__.", "11:15", { sectionImportId: "gt03-l-s2", type: "short_answer", wordLimit: 1, acceptVariants: ["eleven fifteen"], support: "break at eleven fifteen" }),
    completion("gt03-lq20", "listening", 19, "Volunteers who stay to the end receive wildflower __BLANK_0__.", "seeds", { sectionImportId: "gt03-l-s2", type: "short_answer", wordLimit: 1, support: "wildflower seeds" }),

    select({ importId: "gt03-lq21", skill: "listening", questionType: "matching_features", orderIndex: 20, sectionImportId: "gt03-l-s3", groupKey: "gt03-l-s3-tasks", groupInstructions: "Match each task with the student.", prompt: "Summarise the student survey", options: ["Clara", "Mateo", "Ruth"], metadata: { items: [{ id: "0", text: "Summarise the student survey" }] }, correctAnswer: { "0": "1" }, support: "I can summarise the student survey" }),
    select({ importId: "gt03-lq22", skill: "listening", questionType: "matching_features", orderIndex: 21, sectionImportId: "gt03-l-s3", groupKey: "gt03-l-s3-tasks", groupInstructions: "Match each task with the student.", prompt: "Compare the two platforms", options: ["Clara", "Mateo", "Ruth"], metadata: { items: [{ id: "0", text: "Compare the two platforms" }] }, correctAnswer: { "0": "2" }, support: "I will compare the two platforms" }),
    select({ importId: "gt03-lq23", skill: "listening", questionType: "matching_features", orderIndex: 22, sectionImportId: "gt03-l-s3", groupKey: "gt03-l-s3-tasks", groupInstructions: "Match each task with the student.", prompt: "Handle the teacher interviews", options: ["Clara", "Mateo", "Ruth"], metadata: { items: [{ id: "0", text: "Handle the teacher interviews" }] }, correctAnswer: { "0": "0" }, support: "I will handle the teacher interviews" }),
    completion("gt03-lq24", "listening", 23, "Recorded lectures helped students who worked __BLANK_0__.", "part-time", { sectionImportId: "gt03-l-s3", type: "sentence_completion", wordLimit: 1, acceptVariants: ["part time"], support: "students who worked part-time" }),
    completion("gt03-lq25", "listening", 24, "Online group work was harder to __BLANK_0__.", "supervise", { sectionImportId: "gt03-l-s3", type: "sentence_completion", wordLimit: 1, support: "harder to supervise" }),
    select({ importId: "gt03-lq26", skill: "listening", questionType: "mcq_single", orderIndex: 25, sectionImportId: "gt03-l-s3", prompt: "What model do the students support?", options: ["Fully online teaching", "A blended model", "Only in-person lectures"], correctAnswer: "1", support: "The evidence supports a blended model" }),
    completion("gt03-lq27", "listening", 26, "The library loaned laptops but not __BLANK_0__.", "routers", { sectionImportId: "gt03-l-s3", type: "sentence_completion", wordLimit: 1, support: "but not routers" }),
    completion("gt03-lq28", "listening", 27, "Ruth will make a chart by year __BLANK_0__.", "group", { sectionImportId: "gt03-l-s3", type: "sentence_completion", wordLimit: 1, support: "by year group" }),
    completion("gt03-lq29", "listening", 28, "__BLANK_0__ students were least satisfied.", "First-year", { sectionImportId: "gt03-l-s3", type: "sentence_completion", wordLimit: 1, acceptVariants: ["First year"], support: "First-year students were the least satisfied" }),
    select({ importId: "gt03-lq30", skill: "listening", questionType: "mcq_single", orderIndex: 29, sectionImportId: "gt03-l-s3", prompt: "What final point do they agree on?", options: ["Remote learning is a support, not a replacement.", "Remote learning should end.", "Remote learning only suits final-year students."], correctAnswer: "0", support: "useful as a support, not as a complete replacement" }),

    completion("gt03-lq31", "listening", 30, "Coastal wetlands include salt marshes, mangroves and __BLANK_0__.", "mudflats", { sectionImportId: "gt03-l-s4", type: "summary_completion", wordLimit: 1, support: "salt marshes, mangroves and mudflats" }),
    completion("gt03-lq32", "listening", 31, "Wetlands absorb wave __BLANK_0__.", "energy", { sectionImportId: "gt03-l-s4", type: "summary_completion", wordLimit: 1, support: "absorb wave energy" }),
    completion("gt03-lq33", "listening", 32, "Plants need time to establish __BLANK_0__.", "roots", { sectionImportId: "gt03-l-s4", type: "summary_completion", wordLimit: 1, support: "establish roots" }),
    completion("gt03-lq34", "listening", 33, "Wetlands act as nurseries for __BLANK_0__.", "fish", { sectionImportId: "gt03-l-s4", type: "summary_completion", wordLimit: 1, support: "nurseries for fish" }),
    completion("gt03-lq35", "listening", 34, "Birds feed on insects and __BLANK_0__ in the mud.", "shellfish", { sectionImportId: "gt03-l-s4", type: "summary_completion", wordLimit: 1, support: "insects and shellfish" }),
    completion("gt03-lq36", "listening", 35, "Restoration often begins by removing old __BLANK_0__.", "embankments", { sectionImportId: "gt03-l-s4", type: "summary_completion", wordLimit: 1, support: "removing old embankments" }),
    completion("gt03-lq37", "listening", 36, "Engineers may cut __BLANK_0__ to guide first flows.", "channels", { sectionImportId: "gt03-l-s4", type: "summary_completion", wordLimit: 1, support: "cut channels" }),
    completion("gt03-lq38", "listening", 37, "Farmers may worry about losing productive __BLANK_0__.", "land", { sectionImportId: "gt03-l-s4", type: "summary_completion", wordLimit: 1, support: "losing productive land" }),
    completion("gt03-lq39", "listening", 38, "Wetland soils can trap large amounts of __BLANK_0__.", "carbon", { sectionImportId: "gt03-l-s4", type: "summary_completion", wordLimit: 1, support: "large amounts of carbon" }),
    completion("gt03-lq40", "listening", 39, "The lecture says coastal defence is not only __BLANK_0__.", "concrete", { sectionImportId: "gt03-l-s4", type: "summary_completion", wordLimit: 1, support: "not only concrete" }),

    completion("gt03-rq01", "reading", 0, "The lift will be serviced on __BLANK_0__.", "Monday", { passageImportId: "gt03-r-s1a", type: "sentence_completion", wordLimit: 1, support: "serviced on Monday" }),
    completion("gt03-rq02", "reading", 1, "Residents who cannot use stairs should contact the manager by __BLANK_0__.", "Friday", { passageImportId: "gt03-r-s1a", type: "sentence_completion", wordLimit: 1, support: "by Friday" }),
    select({ importId: "gt03-rq03", skill: "reading", questionType: "true_false_notgiven", orderIndex: 2, passageImportId: "gt03-r-s1a", prompt: "Items may be stored in corridors if they are small.", correctAnswer: "FALSE", support: "Items left in corridors will be removed" }),
    completion("gt03-rq04", "reading", 3, "Bikes without a blue resident sticker may be moved to the outdoor __BLANK_0__.", "rack", { passageImportId: "gt03-r-s1a", type: "sentence_completion", wordLimit: 1, support: "outdoor rack" }),
    completion("gt03-rq05", "reading", 4, "Replacement bike stickers cost __BLANK_0__ pounds.", "2", { passageImportId: "gt03-r-s1a", type: "short_answer", wordLimit: 1, acceptVariants: ["two"], support: "for 2 pounds" }),
    completion("gt03-rq06", "reading", 5, "Weekday lane swimming starts at __BLANK_0__ a.m.", "6:30", { passageImportId: "gt03-r-s1b", type: "sentence_completion", wordLimit: 1, acceptVariants: ["six thirty"], support: "6:30-8:30 a.m." }),
    completion("gt03-rq07", "reading", 6, "Quiet swim is for adults who prefer low-noise __BLANK_0__.", "sessions", { passageImportId: "gt03-r-s1b", type: "sentence_completion", wordLimit: 1, support: "low-noise sessions" }),
    select({ importId: "gt03-rq08", skill: "reading", questionType: "true_false_notgiven", orderIndex: 7, passageImportId: "gt03-r-s1b", prompt: "Children under eight must have an adult in the water.", correctAnswer: "TRUE", support: "must be accompanied in the water by an adult" }),
    completion("gt03-rq09", "reading", 8, "Lockers take a refundable __BLANK_0__-pound coin.", "1", { passageImportId: "gt03-r-s1b", type: "sentence_completion", wordLimit: 1, acceptVariants: ["one"], support: "refundable 1-pound coin" }),
    select({ importId: "gt03-rq10", skill: "reading", questionType: "true_false_notgiven", orderIndex: 9, passageImportId: "gt03-r-s1b", prompt: "The cafe is open during evening swimming sessions.", correctAnswer: "FALSE", support: "The cafe is closed during evening sessions" }),
    completion("gt03-rq11", "reading", 10, "The clinic garden needs volunteers on Friday __BLANK_0__.", "mornings", { passageImportId: "gt03-r-s1c", type: "sentence_completion", wordLimit: 1, support: "Friday mornings" }),
    select({ importId: "gt03-rq12", skill: "reading", questionType: "matching_features", orderIndex: 11, passageImportId: "gt03-r-s1c", prompt: "Volunteer task mentioned in the advertisement", options: ["Painting walls", "Planting herbs", "Driving patients"], metadata: { items: [{ id: "0", text: "Volunteer task mentioned in the advertisement" }] }, correctAnswer: { "0": "1" }, support: "planting herbs" }),
    completion("gt03-rq13", "reading", 12, "Volunteers must commit to at least __BLANK_0__ mornings each month.", "two", { passageImportId: "gt03-r-s1c", type: "sentence_completion", wordLimit: 1, acceptVariants: ["2"], support: "at least two mornings per month" }),
    completion("gt03-rq14", "reading", 13, "Applicants attend a thirty-minute safety __BLANK_0__.", "briefing", { passageImportId: "gt03-r-s1c", type: "sentence_completion", wordLimit: 1, support: "thirty-minute safety briefing" }),

    completion("gt03-rq15", "reading", 14, "Cafe staff sign in on the __BLANK_0__.", "tablet", { passageImportId: "gt03-r-s2a", type: "sentence_completion", wordLimit: 1, support: "sign in on the tablet" }),
    select({ importId: "gt03-rq16", skill: "reading", questionType: "true_false_notgiven", orderIndex: 15, passageImportId: "gt03-r-s2a", prompt: "Aprons may be taken home after a shift.", correctAnswer: "FALSE", support: "must not be taken home" }),
    completion("gt03-rq17", "reading", 16, "The opening barista records the temperature of the cake __BLANK_0__.", "display", { passageImportId: "gt03-r-s2a", type: "sentence_completion", wordLimit: 1, support: "temperature of the cake display" }),
    completion("gt03-rq18", "reading", 17, "Cakes should not be sold if the display is above __BLANK_0__ degrees Celsius.", "five", { passageImportId: "gt03-r-s2a", type: "sentence_completion", wordLimit: 1, acceptVariants: ["5"], support: "above five degrees Celsius" }),
    completion("gt03-rq19", "reading", 18, "The closing barista switches off the espresso machine after the final __BLANK_0__.", "backflush", { passageImportId: "gt03-r-s2a", type: "sentence_completion", wordLimit: 1, support: "after the final backflush" }),
    completion("gt03-rq20", "reading", 19, "Staff working more than five hours get a paid __BLANK_0__-minute break.", "15", { passageImportId: "gt03-r-s2a", type: "sentence_completion", wordLimit: 1, acceptVariants: ["fifteen"], support: "paid fifteen-minute break" }),
    select({ importId: "gt03-rq21", skill: "reading", questionType: "true_false_notgiven", orderIndex: 20, passageImportId: "gt03-r-s2a", prompt: "Staff discounts can be used for friends.", correctAnswer: "FALSE", support: "Staff discounts cannot be used for friends" }),
    completion("gt03-rq22", "reading", 21, "Allergy questions must be answered using the printed ingredient __BLANK_0__.", "folder", { passageImportId: "gt03-r-s2a", type: "sentence_completion", wordLimit: 1, support: "printed ingredient folder" }),
    completion("gt03-rq23", "reading", 22, "Feedback forms should be completed within __BLANK_0__ hours.", "forty-eight", { passageImportId: "gt03-r-s2b", type: "sentence_completion", wordLimit: 1, acceptVariants: ["48"], support: "within forty-eight hours" }),
    select({ importId: "gt03-rq24", skill: "reading", questionType: "true_false_notgiven", orderIndex: 23, passageImportId: "gt03-r-s2b", prompt: "Managers normally see individual employee names in feedback results.", correctAnswer: "FALSE", support: "individual names are removed" }),
    completion("gt03-rq25", "reading", 24, "Health and safety risk comments are sent within one working __BLANK_0__.", "day", { passageImportId: "gt03-r-s2b", type: "sentence_completion", wordLimit: 1, support: "within one working day" }),
    completion("gt03-rq26", "reading", 25, "Requests for new courses are reviewed at the end of each __BLANK_0__.", "quarter", { passageImportId: "gt03-r-s2b", type: "sentence_completion", wordLimit: 1, support: "end of each quarter" }),
    completion("gt03-rq27", "reading", 26, "A missed compulsory session must be rebooked within __BLANK_0__ weeks.", "two", { passageImportId: "gt03-r-s2b", type: "sentence_completion", wordLimit: 1, acceptVariants: ["2"], support: "within two weeks" }),

    select({ importId: "gt03-rq28", skill: "reading", questionType: "matching_headings", orderIndex: 27, passageImportId: "gt03-r-s3", prompt: "Paragraph B", options: ["Technology improves data collection", "A new name for science", "A school activity", "A funding problem"], metadata: { items: [{ id: "0", text: "Paragraph B" }] }, correctAnswer: { "0": "0" }, support: "mobile technology" }),
    select({ importId: "gt03-rq29", skill: "reading", questionType: "matching_headings", orderIndex: 28, passageImportId: "gt03-r-s3", prompt: "Paragraph D", options: ["The importance of quality control", "Ethical questions", "A national pattern", "The value of birds"], metadata: { items: [{ id: "0", text: "Paragraph D" }] }, correctAnswer: { "0": "0" }, support: "Quality control remains the central challenge" }),
    select({ importId: "gt03-rq30", skill: "reading", questionType: "matching_headings", orderIndex: 29, passageImportId: "gt03-r-s3", prompt: "Paragraph F", options: ["Schools and real evidence", "Privacy concerns", "Expert checking", "River testing"], metadata: { items: [{ id: "0", text: "Paragraph F" }] }, correctAnswer: { "0": "0" }, support: "Schools have embraced community science" }),
    select({ importId: "gt03-rq31", skill: "reading", questionType: "matching_information", orderIndex: 30, passageImportId: "gt03-r-s3", prompt: "Which paragraph mentions night-sky brightness?", options: ["A", "B", "E", "G"], metadata: { items: [{ id: "0", text: "night-sky brightness" }] }, correctAnswer: { "0": "0" }, support: "brightness of the night sky" }),
    select({ importId: "gt03-rq32", skill: "reading", questionType: "matching_information", orderIndex: 31, passageImportId: "gt03-r-s3", prompt: "Which paragraph says participants should know how data will be used?", options: ["C", "D", "E", "F"], metadata: { items: [{ id: "0", text: "data use" }] }, correctAnswer: { "0": "2" }, support: "know how their data will be used" }),
    completion("gt03-rq33", "reading", 32, "Thousands of small observations can reveal __BLANK_0__.", "patterns", { passageImportId: "gt03-r-s3", type: "summary_completion", wordLimit: 1, support: "reveal patterns" }),
    completion("gt03-rq34", "reading", 33, "Apps can warn volunteers when a record seems __BLANK_0__.", "unusual", { passageImportId: "gt03-r-s3", type: "summary_completion", wordLimit: 1, support: "seems unusual" }),
    completion("gt03-rq35", "reading", 34, "A person measuring air quality may start asking why traffic is __BLANK_0__.", "heavy", { passageImportId: "gt03-r-s3", type: "sentence_completion", wordLimit: 1, support: "why traffic is heavy" }),
    select({ importId: "gt03-rq36", skill: "reading", questionType: "true_false_notgiven", orderIndex: 35, passageImportId: "gt03-r-s3", prompt: "Community science removes the need for expert checking.", correctAnswer: "FALSE", support: "does not remove the need for expert checking" }),
    completion("gt03-rq37", "reading", 36, "Good projects provide instructions, training videos and __BLANK_0__.", "feedback", { passageImportId: "gt03-r-s3", type: "sentence_completion", wordLimit: 1, support: "clear instructions, training videos and feedback" }),
    completion("gt03-rq38", "reading", 37, "Researchers should share results in accessible __BLANK_0__.", "language", { passageImportId: "gt03-r-s3", type: "sentence_completion", wordLimit: 1, support: "accessible language" }),
    select({ importId: "gt03-rq39", skill: "reading", questionType: "mcq_single", orderIndex: 38, passageImportId: "gt03-r-s3", prompt: "Why can school community-science projects feel motivating?", options: ["Results enter a wider database.", "They always win prizes.", "They replace all classroom teaching."], correctAnswer: "0", support: "results enter a wider database" }),
    completion("gt03-rq40", "reading", 39, "The future of community science will depend on __BLANK_0__.", "trust", { passageImportId: "gt03-r-s3", type: "sentence_completion", wordLimit: 1, support: "depend on trust" }),

    ws({ importId: "gt03-wq01", skill: "writing", questionType: "writing_task1_general", orderIndex: 0, prompt: "A bus route near your home has recently changed, and the new timetable is causing problems. Write a letter to the local council. In your letter, explain what has changed, describe the problems it causes, and suggest a solution. Write at least 150 words. Register: formal.", modelAnswer: `Dear Sir or Madam,

I am writing to express concern about the recent changes to bus route 42, which serves the Larch House area. Until last month, the first bus towards the city centre arrived at 6:40 a.m. The new timetable has moved this service to 7:15 a.m. and removed the stop outside Meadow Pool.

These changes are causing difficulty for residents who start work early. Several people in my building now have to walk twenty minutes to the station or pay for taxis. The removal of the pool stop is also inconvenient for older residents because the next nearest stop is at the top of a steep hill.

I would be grateful if the council could review the morning timetable and restore at least one early service before 7 a.m. If this is not possible, a smaller shuttle bus during peak hours would help many residents.

Yours faithfully,
Owen Miller`, examinerNotes: { task: "Fully addresses change, problem and solution in formal register.", coherence: "Clear purpose and paragraphing.", lexical: "Precise transport lexis: timetable, route, shuttle bus.", grammar: "Accurate complex sentences and polite request forms." }, metadata: { register: "formal", wordMin: 150 } }),
    ws({ importId: "gt03-wq02", skill: "writing", questionType: "writing_task2_essay", orderIndex: 1, prompt: "In many jobs, working from home has become common. Do the advantages of this trend outweigh the disadvantages? Give reasons for your answer and include relevant examples. Write at least 250 words.", modelAnswer: `Working from home is now a normal arrangement in many occupations. Although it can create problems for communication and boundaries, I believe its advantages generally outweigh its disadvantages when organisations manage it carefully.

The clearest benefit is flexibility. Employees can save commuting time and arrange focused tasks around their most productive hours. This can improve wellbeing, especially for people with caring responsibilities or long journeys to work. Employers may also benefit from lower office costs and a wider recruitment pool, since they are not limited to applicants who live near the workplace. In addition, fewer daily commutes can reduce congestion and emissions.

However, remote work is not ideal for every person or task. New employees may learn more slowly if they cannot observe experienced colleagues. Informal conversations, which often solve small problems quickly, are harder to recreate online. Some workers also find that home becomes associated with work, making it difficult to switch off. These disadvantages can damage morale if managers simply move office routines onto video calls.

In my view, the best solution is a hybrid model. Teams can meet in person for training, planning and social connection, while individual tasks can be done remotely. Employers should provide clear expectations, equipment and regular check-ins without monitoring staff excessively. Under these conditions, home working offers more benefits than drawbacks because it gives people autonomy while preserving essential collaboration.`, examinerNotes: { task: "Clear position with developed advantages, disadvantages and solution.", coherence: "Logical sequencing and cohesive contrast.", lexical: "Strong range: autonomy, recruitment pool, monitoring.", grammar: "Accurate conditionals, relative clauses and concession." }, metadata: { wordMin: 250 } }),
    ws({ importId: "gt03-sq01", skill: "speaking", questionType: "speaking_part1", orderIndex: 0, prompt: "Part 1: Let's talk about technology. What technology do you use every day? Has technology made your life easier? Is there any device you dislike using?", modelAnswer: "A strong response gives concrete devices and tasks, then evaluates convenience with examples.", examinerNotes: { fluency: "Answers flow naturally with reasons.", lexical: "Accurate everyday technology vocabulary.", grammar: "Uses present perfect and comparison well.", pronunciation: "Clear stress in multi-syllable technology terms." }, metadata: { topic: "technology" } }),
    ws({ importId: "gt03-sq02", skill: "speaking", questionType: "speaking_part2_cuecard", orderIndex: 1, prompt: "Describe a book or article that taught you something useful. You should say what it was about, when you read it, what you learned, and explain why it was useful.", options: ["what it was about", "when you read it", "what you learned", "why it was useful"], modelAnswer: "A band-9 response would summarise the text briefly, focus on the practical lesson, and connect it to a real change in behaviour.", examinerNotes: { fluency: "Well-paced long turn with clear structure.", lexical: "Uses learning and reading vocabulary flexibly.", grammar: "Accurate past and present perfect forms.", pronunciation: "Good pausing around key points." }, metadata: { topic: "reading" } }),
    ws({ importId: "gt03-sq03", skill: "speaking", questionType: "speaking_part3", orderIndex: 2, prompt: "Part 3: Why do people enjoy learning practical skills? Should schools teach more skills outside academic subjects? How can adults keep learning after they leave school?", modelAnswer: "A strong answer weighs confidence, employability and personal interest, with examples from schools, workplaces and online courses.", examinerNotes: { fluency: "Develops abstract ideas with examples.", lexical: "Uses lexis for education and lifelong learning.", grammar: "Accurate modals and conditional structures.", pronunciation: "Natural emphasis in opinion statements." }, metadata: { topic: "lifelong learning" } }),
  ],
});

const mock04 = withQuestionDefaults({
  slug: "general-training-mock-04",
  title: "General Training Mock 04",
  description: "Original IELTS General Training full mock authored for Thinkfy QA.",
  passages: [
    passage({
      importId: "gt04-r-s1a",
      title: "Phone Repair Warranty",
      genre: "warranty",
      orderIndex: 0,
      metadata: { readingSection: 1 },
      body: `QuickFix Phone Repair Warranty

Repairs to screens and charging ports are covered for ninety days. The warranty covers the part fitted by QuickFix and the labour used to fit it. It does not cover new damage, water damage, software faults or accessories such as cases and cables.

Customers must bring the original receipt. If a fault is confirmed, the phone will be repaired again free of charge. Refunds are offered only when the same repair has failed twice. Warranty checks usually take one working day, but phones sent to the central workshop may take up to five working days.

Opening hours are Monday to Saturday, 9 a.m. to 6 p.m. The shop is closed on public holidays.`,
    }),
    passage({
      importId: "gt04-r-s1b",
      title: "Evening Class Brochure",
      genre: "brochure",
      orderIndex: 1,
      metadata: { readingSection: 1 },
      body: `Autumn Evening Classes

Creative writing: Mondays, 7-9 p.m., Library Room 1. Bring a notebook.
Spanish for travel: Tuesdays, 6:30-8 p.m., Language Lab. No previous study needed.
Home budgeting: Wednesdays, 7-8:30 p.m., Room 4. Calculator provided.
Ceramics: Thursdays, 6-9 p.m., Art Studio. Materials cost 20 pounds extra.
Guitar basics: Fridays, 6:30-7:30 p.m., Music Room. Students must bring their own guitar.

All courses last six weeks. The enrolment desk is open from 5 p.m. on weekdays. Places are confirmed only after payment. A course may be cancelled if fewer than eight students enrol.`,
    }),
    passage({
      importId: "gt04-r-s1c",
      title: "Lost Property Rules",
      genre: "rules",
      orderIndex: 2,
      metadata: { readingSection: 1 },
      body: `Station Lost Property

Items found on trains are taken to the main station office after the final service each day. Umbrellas, hats and books are kept for four weeks. Bank cards are kept for twenty-four hours and then destroyed. Passports and driving licences are handed to the police every Friday.

To claim an item, describe it clearly and show photo identification. A storage fee of 3 pounds is charged for bags and suitcases. Unclaimed bicycles are held for three months and may then be donated to a local charity.`,
    }),
    passage({
      importId: "gt04-r-s2a",
      title: "Warehouse Safety Memo",
      genre: "workplace_memo",
      orderIndex: 3,
      metadata: { readingSection: 2 },
      body: `Warehouse Safety Memo

From 1 June, all warehouse staff must wear safety shoes in the loading area. Trainers, sandals and open-backed shoes are not permitted. Visitors who enter the loading area will be given temporary overshoes at reception.

Forklift routes are marked with yellow lines. Pedestrians should use the green walkways and cross only at zebra crossings. Do not step over a moving conveyor or reach into a machine to remove stuck packaging. Press the red stop button and call a supervisor.

Manual lifting should be avoided where a trolley or pallet truck is available. If a load is awkward, ask for help rather than twisting while carrying it. Any back strain, even a minor one, must be recorded in the first-aid log before the end of the shift.

The new cardboard baler may be used only by staff who have completed the short training module. The baler key is kept by the shift supervisor. Loose plastic wrap should go in the clear recycling sacks, not in the baler.`,
    }),
    passage({
      importId: "gt04-r-s2b",
      title: "Annual Leave Policy",
      genre: "workplace_policy",
      orderIndex: 4,
      metadata: { readingSection: 2 },
      body: `Annual Leave Policy

Full-time employees receive twenty-five days of paid annual leave each calendar year, plus public holidays. Part-time employees receive a pro-rata allowance based on contracted hours. Leave should be requested through the staff portal at least four weeks in advance.

Managers approve requests according to staffing levels and the order in which requests are received. No more than two people from the same team may be on leave at the same time unless the department head agrees. Leave during the final week of December is restricted because of stocktaking.

Employees may carry over up to five unused days into the next calendar year. Carried-over days must be used by 31 March. Payment instead of leave is not normally allowed except when employment ends. If an employee becomes ill during annual leave, the days may be reclassified as sickness absence if a medical certificate is provided.`,
    }),
    passage({
      importId: "gt04-r-s3",
      title: "What Makes a City Walkable?",
      genre: "general_interest_article",
      orderIndex: 5,
      metadata: { readingSection: 3 },
      body: `A. A walkable city is not simply a city with pavements. It is a place where walking feels useful, safe and pleasant enough to become an ordinary choice. People walk when destinations are close, crossings are convenient and streets offer enough interest to make the journey feel shorter than it is.

B. Distance is the first ingredient. A neighbourhood may have beautiful streets, but if every shop, school and clinic is several kilometres away, most people will drive. Mixed-use planning helps because homes, services and workplaces are not separated into distant zones. The corner shop and the small park matter more than a dramatic boulevard if they are part of daily life.

C. Safety is equally important. Wide pavements, good lighting and slower traffic all encourage walking. So do crossings that give people enough time to cross without rushing. For older residents, parents with prams and people with disabilities, a missing dropped kerb can turn a short walk into an impossible journey.

D. Comfort affects decisions more than planners sometimes admit. Trees provide shade and shelter; benches allow people to rest; public toilets make longer walks realistic. In hot climates, a route without shade may be technically walkable but practically avoided for much of the day. In cold or wet places, wind protection and drainage can matter just as much.

E. Walkability also depends on what happens at ground level. Blank walls, car parks and long fences make a street feel empty. Windows, doorways, small shops and front gardens create signs of life. People are more willing to walk where there are other people, not because every street must be busy, but because activity creates a sense of informal safety.

F. Some cities try to improve walkability with isolated beautification projects. A new plaza or painted crossing can help, but only if it connects to a wider network. If the route to the plaza still requires crossing a dangerous road, the improvement is mainly decorative. Walkability is a system, not a single attractive spot.

G. The benefits extend beyond transport. Walking supports local shops, increases casual social contact and improves public health. It can also make a city fairer, because not everyone can drive or afford frequent taxis. A truly walkable city gives people options: the freedom to choose a slower, cheaper and often more enjoyable way to move.`,
    }),
  ],
  listeningSections: [
    {
      importId: "gt04-l-s1",
      sectionNumber: 1,
      title: "Joining a gym",
      accent: "uk",
      speakers: [
        { name: "Adviser", accent: "uk" },
        { name: "Sam", accent: "uk" },
      ],
      script: `Adviser: Good afternoon, Peak Gym. How can I help?

Sam: Hi. I am interested in joining. My name is Sam Rivera.

Adviser: Great. Are you looking at full membership or off-peak?

Sam: Off-peak, I think. I work evenings, so daytime access is enough.

Adviser: Off-peak membership allows entry from six a.m. to four p.m. Monday to Friday, and after two p.m. at weekends.

Sam: That sounds right. How much is it?

Adviser: Thirty-two pounds per month. There is normally a joining fee of twenty pounds, but we are waiving it this week.

Sam: Good. Do classes cost extra?

Adviser: Most classes are included. The only exception is small-group boxing because it uses an external coach.

Sam: I am more interested in yoga.

Adviser: Yoga is included, but you need to book because the studio holds only eighteen people.

Sam: Can I try the gym first?

Adviser: Yes. We offer a free trial pass for one day. Bring photo ID and a towel. We provide lockers, but you need a padlock.

Sam: Is there parking?

Adviser: Two hours free in the supermarket car park next door. After that, charges apply.

Sam: Who should I ask for when I come in?

Adviser: Ask for Daniel at reception. He will show you around.`,
    },
    {
      importId: "gt04-l-s2",
      sectionNumber: 2,
      title: "Guided town walk",
      accent: "uk",
      speakers: [{ name: "Guide", accent: "uk" }],
      script: `Guide: Welcome to the Old Town walking tour. We will be out for about ninety minutes and finish at the riverside gardens.

Our first stop is the clock tower. It was built as part of the market hall, but only the tower remains. Please stay on this side of the road until I signal, because buses turn sharply around the corner.

After the clock tower, we walk through Bakers Lane. The smell of bread is gone now, but the narrow houses show where the bakers lived above their ovens. Halfway along the lane, look up at the blue sign for number 14. That was the first public reading room in the town.

Next we visit the old fire station. It is now a theatre, so we cannot go inside during rehearsal, but you can see the original red doors. Across the square is the drinking fountain donated by a local doctor.

There are public toilets beside the theatre. We will have a short stop there. Please note that the souvenir shop near the square is closed today, so postcards are available only at the visitor centre.

The final part of the walk follows the river path to the gardens. The path can be muddy after rain. If anyone prefers a paved route, tell me during the toilet stop and I will point out the alternative street route.`,
    },
    {
      importId: "gt04-l-s3",
      sectionNumber: 3,
      title: "Work placement report",
      accent: "aus",
      speakers: [
        { name: "Hannah", accent: "aus" },
        { name: "Ibrahim", accent: "uk" },
        { name: "Tutor", accent: "aus" },
      ],
      script: `Tutor: Tell me how your work placement report is developing.

Hannah: We both worked at the community radio station, but in different roles. I observed the production desk.

Ibrahim: And I helped the events team organise a live broadcast from the library.

Tutor: Good. What skill did each of you learn?

Hannah: For me, editing audio quickly. I had used editing software before, but not with a deadline ten minutes away.

Ibrahim: I learned more about risk planning. The library event needed cables taped down and a backup internet connection.

Tutor: What surprised you?

Hannah: How much preparation goes into a short interview. The presenter had written twice as many questions as she needed.

Ibrahim: I was surprised by the audience. I expected mostly older listeners, but many teenagers sent messages during the broadcast.

Tutor: Any criticism of the placement?

Hannah: The first morning was confusing because nobody explained the schedule.

Ibrahim: Yes, an induction sheet would help. But the staff were generous once we knew who to ask.

Tutor: Your recommendation?

Hannah: Future students should receive a contact person before they arrive.

Ibrahim: And the college should ask the station for a simple timetable.`,
    },
    {
      importId: "gt04-l-s4",
      sectionNumber: 4,
      title: "Reusable packaging systems",
      accent: "us",
      speakers: [{ name: "Lecturer", accent: "us" }],
      script: `Lecturer: Reusable packaging systems are appearing in supermarkets, cafes and delivery services. Instead of throwing away a container after one use, customers return it to be washed and used again.

The environmental benefit depends on repeated use. A strong container may require more material to produce than a disposable one, so it must complete enough cycles to repay that initial impact. Transport also matters. If empty containers are carried long distances for washing, the benefit can disappear.

Deposit systems encourage returns. Customers pay a small deposit when they take the container and get it back when they return it. Digital systems may use an app instead of cash, recording each container with a code. This helps companies track losses and washing dates.

Hygiene is central. Containers must be washed at the right temperature and inspected for cracks. A scratched container can hold bacteria and should be removed from circulation. Clear instructions are needed so customers do not try to wash containers at home and return them as clean.

Convenience is another challenge. Return points must be easy to find, ideally near places where people already shop or commute. If returning a cup requires a special trip, many people will not do it.

The most promising schemes are shared by several businesses. A customer can borrow a container from one cafe and return it at another. This network approach makes reuse feel normal rather than like a special favour to one shop.`,
    },
  ],
  questions: [
    completion("gt04-lq01", "listening", 0, "New member: Sam __BLANK_0__.", "Rivera", { sectionImportId: "gt04-l-s1", type: "note_table_form_flowchart_completion", wordLimit: 1, support: "My name is Sam Rivera" }),
    completion("gt04-lq02", "listening", 1, "Sam wants __BLANK_0__ membership.", "off-peak", { sectionImportId: "gt04-l-s1", type: "note_table_form_flowchart_completion", wordLimit: 1, acceptVariants: ["off peak"], support: "Off-peak, I think" }),
    completion("gt04-lq03", "listening", 2, "Weekday off-peak access ends at __BLANK_0__ p.m.", "4", { sectionImportId: "gt04-l-s1", type: "note_table_form_flowchart_completion", wordLimit: 1, acceptVariants: ["four"], support: "to four p.m." }),
    completion("gt04-lq04", "listening", 3, "Monthly cost: __BLANK_0__ pounds.", "32", { sectionImportId: "gt04-l-s1", type: "note_table_form_flowchart_completion", wordLimit: 1, acceptVariants: ["thirty-two"], support: "Thirty-two pounds per month" }),
    completion("gt04-lq05", "listening", 4, "The joining fee is being __BLANK_0__ this week.", "waived", { sectionImportId: "gt04-l-s1", type: "note_table_form_flowchart_completion", wordLimit: 1, support: "waiving it this week" }),
    completion("gt04-lq06", "listening", 5, "Small-group __BLANK_0__ costs extra.", "boxing", { sectionImportId: "gt04-l-s1", type: "note_table_form_flowchart_completion", wordLimit: 1, support: "small-group boxing" }),
    completion("gt04-lq07", "listening", 6, "The yoga studio holds only __BLANK_0__ people.", "18", { sectionImportId: "gt04-l-s1", type: "note_table_form_flowchart_completion", wordLimit: 1, acceptVariants: ["eighteen"], support: "holds only eighteen people" }),
    completion("gt04-lq08", "listening", 7, "For a trial pass, Sam should bring photo ID and a __BLANK_0__.", "towel", { sectionImportId: "gt04-l-s1", type: "note_table_form_flowchart_completion", wordLimit: 1, support: "photo ID and a towel" }),
    completion("gt04-lq09", "listening", 8, "Members need a __BLANK_0__ for lockers.", "padlock", { sectionImportId: "gt04-l-s1", type: "note_table_form_flowchart_completion", wordLimit: 1, support: "you need a padlock" }),
    completion("gt04-lq10", "listening", 9, "At reception, Sam should ask for __BLANK_0__.", "Daniel", { sectionImportId: "gt04-l-s1", type: "note_table_form_flowchart_completion", wordLimit: 1, support: "Ask for Daniel" }),

    completion("gt04-lq11", "listening", 10, "The walking tour lasts about __BLANK_0__ minutes.", "90", { sectionImportId: "gt04-l-s2", type: "short_answer", wordLimit: 1, acceptVariants: ["ninety"], support: "about ninety minutes" }),
    completion("gt04-lq12", "listening", 11, "The tour finishes at the riverside __BLANK_0__.", "gardens", { sectionImportId: "gt04-l-s2", type: "short_answer", wordLimit: 1, support: "finish at the riverside gardens" }),
    completion("gt04-lq13", "listening", 12, "The clock tower was part of the market __BLANK_0__.", "hall", { sectionImportId: "gt04-l-s2", type: "short_answer", wordLimit: 1, support: "part of the market hall" }),
    completion("gt04-lq14", "listening", 13, "In Bakers Lane, number 14 was the first public __BLANK_0__ room.", "reading", { sectionImportId: "gt04-l-s2", type: "short_answer", wordLimit: 1, support: "first public reading room" }),
    completion("gt04-lq15", "listening", 14, "The old fire station is now a __BLANK_0__.", "theatre", { sectionImportId: "gt04-l-s2", type: "short_answer", wordLimit: 1, support: "It is now a theatre" }),
    completion("gt04-lq16", "listening", 15, "The drinking fountain was donated by a local __BLANK_0__.", "doctor", { sectionImportId: "gt04-l-s2", type: "short_answer", wordLimit: 1, support: "donated by a local doctor" }),
    completion("gt04-lq17", "listening", 16, "Public toilets are beside the __BLANK_0__.", "theatre", { sectionImportId: "gt04-l-s2", type: "short_answer", wordLimit: 1, support: "toilets beside the theatre" }),
    completion("gt04-lq18", "listening", 17, "Postcards are available only at the visitor __BLANK_0__.", "centre", { sectionImportId: "gt04-l-s2", type: "short_answer", wordLimit: 1, support: "only at the visitor centre" }),
    completion("gt04-lq19", "listening", 18, "The river path can be __BLANK_0__ after rain.", "muddy", { sectionImportId: "gt04-l-s2", type: "short_answer", wordLimit: 1, support: "can be muddy after rain" }),
    completion("gt04-lq20", "listening", 19, "A paved alternative follows a street __BLANK_0__.", "route", { sectionImportId: "gt04-l-s2", type: "short_answer", wordLimit: 1, support: "alternative street route" }),

    select({ importId: "gt04-lq21", skill: "listening", questionType: "matching_features", orderIndex: 20, sectionImportId: "gt04-l-s3", groupKey: "gt04-l-s3-roles", groupInstructions: "Match each placement task with the student.", prompt: "Observed the production desk", options: ["Hannah", "Ibrahim"], metadata: { items: [{ id: "0", text: "Observed the production desk" }] }, correctAnswer: { "0": "0" }, support: "I observed the production desk" }),
    select({ importId: "gt04-lq22", skill: "listening", questionType: "matching_features", orderIndex: 21, sectionImportId: "gt04-l-s3", groupKey: "gt04-l-s3-roles", groupInstructions: "Match each placement task with the student.", prompt: "Organised a live broadcast", options: ["Hannah", "Ibrahim"], metadata: { items: [{ id: "0", text: "Organised a live broadcast" }] }, correctAnswer: { "0": "1" }, support: "organise a live broadcast" }),
    completion("gt04-lq23", "listening", 22, "Hannah learned to edit __BLANK_0__ quickly.", "audio", { sectionImportId: "gt04-l-s3", type: "sentence_completion", wordLimit: 1, support: "editing audio quickly" }),
    completion("gt04-lq24", "listening", 23, "Ibrahim learned about risk __BLANK_0__.", "planning", { sectionImportId: "gt04-l-s3", type: "sentence_completion", wordLimit: 1, support: "risk planning" }),
    completion("gt04-lq25", "listening", 24, "The library event needed a backup internet __BLANK_0__.", "connection", { sectionImportId: "gt04-l-s3", type: "sentence_completion", wordLimit: 1, support: "backup internet connection" }),
    completion("gt04-lq26", "listening", 25, "The presenter had written twice as many __BLANK_0__ as needed.", "questions", { sectionImportId: "gt04-l-s3", type: "sentence_completion", wordLimit: 1, support: "twice as many questions" }),
    completion("gt04-lq27", "listening", 26, "Many __BLANK_0__ sent messages during the broadcast.", "teenagers", { sectionImportId: "gt04-l-s3", type: "sentence_completion", wordLimit: 1, support: "many teenagers sent messages" }),
    completion("gt04-lq28", "listening", 27, "The first morning was confusing because nobody explained the __BLANK_0__.", "schedule", { sectionImportId: "gt04-l-s3", type: "sentence_completion", wordLimit: 1, support: "nobody explained the schedule" }),
    completion("gt04-lq29", "listening", 28, "Future students should receive a contact __BLANK_0__ before arrival.", "person", { sectionImportId: "gt04-l-s3", type: "sentence_completion", wordLimit: 1, support: "receive a contact person" }),
    completion("gt04-lq30", "listening", 29, "The college should ask for a simple __BLANK_0__.", "timetable", { sectionImportId: "gt04-l-s3", type: "sentence_completion", wordLimit: 1, support: "simple timetable" }),

    completion("gt04-lq31", "listening", 30, "Reusable packaging is washed and used __BLANK_0__.", "again", { sectionImportId: "gt04-l-s4", type: "summary_completion", wordLimit: 1, support: "washed and used again" }),
    completion("gt04-lq32", "listening", 31, "The environmental benefit depends on repeated __BLANK_0__.", "use", { sectionImportId: "gt04-l-s4", type: "summary_completion", wordLimit: 1, support: "depends on repeated use" }),
    completion("gt04-lq33", "listening", 32, "Empty containers carried long distances for washing can remove the __BLANK_0__.", "benefit", { sectionImportId: "gt04-l-s4", type: "summary_completion", wordLimit: 1, support: "the benefit can disappear" }),
    completion("gt04-lq34", "listening", 33, "__BLANK_0__ systems encourage returns.", "Deposit", { sectionImportId: "gt04-l-s4", type: "summary_completion", wordLimit: 1, support: "Deposit systems encourage returns" }),
    completion("gt04-lq35", "listening", 34, "Digital systems may record each container with a __BLANK_0__.", "code", { sectionImportId: "gt04-l-s4", type: "summary_completion", wordLimit: 1, support: "with a code" }),
    completion("gt04-lq36", "listening", 35, "Containers must be inspected for __BLANK_0__.", "cracks", { sectionImportId: "gt04-l-s4", type: "summary_completion", wordLimit: 1, support: "inspected for cracks" }),
    completion("gt04-lq37", "listening", 36, "A scratched container can hold __BLANK_0__.", "bacteria", { sectionImportId: "gt04-l-s4", type: "summary_completion", wordLimit: 1, support: "can hold bacteria" }),
    completion("gt04-lq38", "listening", 37, "Return points should be easy to __BLANK_0__.", "find", { sectionImportId: "gt04-l-s4", type: "summary_completion", wordLimit: 1, support: "easy to find" }),
    completion("gt04-lq39", "listening", 38, "Returning a cup should not require a special __BLANK_0__.", "trip", { sectionImportId: "gt04-l-s4", type: "summary_completion", wordLimit: 1, support: "requires a special trip" }),
    completion("gt04-lq40", "listening", 39, "The most promising schemes are shared by several __BLANK_0__.", "businesses", { sectionImportId: "gt04-l-s4", type: "summary_completion", wordLimit: 1, support: "shared by several businesses" }),

    completion("gt04-rq01", "reading", 0, "Screen and charging-port repairs are covered for __BLANK_0__ days.", "ninety", { passageImportId: "gt04-r-s1a", type: "sentence_completion", wordLimit: 1, acceptVariants: ["90"], support: "covered for ninety days" }),
    select({ importId: "gt04-rq02", skill: "reading", questionType: "true_false_notgiven", orderIndex: 1, passageImportId: "gt04-r-s1a", prompt: "The warranty covers water damage.", correctAnswer: "FALSE", support: "It does not cover new damage, water damage" }),
    completion("gt04-rq03", "reading", 2, "Customers must bring the original __BLANK_0__.", "receipt", { passageImportId: "gt04-r-s1a", type: "sentence_completion", wordLimit: 1, support: "bring the original receipt" }),
    completion("gt04-rq04", "reading", 3, "Refunds are offered only after the same repair has failed __BLANK_0__.", "twice", { passageImportId: "gt04-r-s1a", type: "sentence_completion", wordLimit: 1, support: "failed twice" }),
    completion("gt04-rq05", "reading", 4, "Phones sent to the central workshop may take up to __BLANK_0__ working days.", "five", { passageImportId: "gt04-r-s1a", type: "sentence_completion", wordLimit: 1, acceptVariants: ["5"], support: "up to five working days" }),
    select({ importId: "gt04-rq06", skill: "reading", questionType: "matching_features", orderIndex: 5, passageImportId: "gt04-r-s1b", groupKey: "gt04-r-s1b-classes", groupInstructions: "Match each detail with the correct class.", prompt: "Students need their own instrument.", options: ["Creative writing", "Spanish", "Home budgeting", "Ceramics", "Guitar basics"], metadata: { items: [{ id: "0", text: "Students need their own instrument." }] }, correctAnswer: { "0": "4" }, support: "Students must bring their own guitar" }),
    select({ importId: "gt04-rq07", skill: "reading", questionType: "matching_features", orderIndex: 6, passageImportId: "gt04-r-s1b", groupKey: "gt04-r-s1b-classes", groupInstructions: "Match each detail with the correct class.", prompt: "There is an extra materials fee.", options: ["Creative writing", "Spanish", "Home budgeting", "Ceramics", "Guitar basics"], metadata: { items: [{ id: "0", text: "There is an extra materials fee." }] }, correctAnswer: { "0": "3" }, support: "Materials cost 20 pounds extra" }),
    completion("gt04-rq08", "reading", 7, "All evening courses last __BLANK_0__ weeks.", "six", { passageImportId: "gt04-r-s1b", type: "sentence_completion", wordLimit: 1, acceptVariants: ["6"], support: "All courses last six weeks" }),
    completion("gt04-rq09", "reading", 8, "A course may be cancelled if fewer than __BLANK_0__ students enrol.", "eight", { passageImportId: "gt04-r-s1b", type: "sentence_completion", wordLimit: 1, acceptVariants: ["8"], support: "fewer than eight students" }),
    completion("gt04-rq10", "reading", 9, "Lost items are moved to the main station office after the final __BLANK_0__.", "service", { passageImportId: "gt04-r-s1c", type: "sentence_completion", wordLimit: 1, support: "after the final service" }),
    completion("gt04-rq11", "reading", 10, "Bank cards are kept for __BLANK_0__ hours.", "twenty-four", { passageImportId: "gt04-r-s1c", type: "sentence_completion", wordLimit: 1, acceptVariants: ["24"], support: "kept for twenty-four hours" }),
    completion("gt04-rq12", "reading", 11, "Passports are handed to the police every __BLANK_0__.", "Friday", { passageImportId: "gt04-r-s1c", type: "sentence_completion", wordLimit: 1, support: "every Friday" }),
    completion("gt04-rq13", "reading", 12, "The storage fee for bags and suitcases is __BLANK_0__ pounds.", "3", { passageImportId: "gt04-r-s1c", type: "short_answer", wordLimit: 1, acceptVariants: ["three"], support: "3 pounds" }),
    completion("gt04-rq14", "reading", 13, "Unclaimed bicycles may be donated to a local __BLANK_0__.", "charity", { passageImportId: "gt04-r-s1c", type: "sentence_completion", wordLimit: 1, support: "donated to a local charity" }),

    completion("gt04-rq15", "reading", 14, "Warehouse safety shoes are required from __BLANK_0__ June.", "1", { passageImportId: "gt04-r-s2a", type: "sentence_completion", wordLimit: 1, support: "From 1 June" }),
    completion("gt04-rq16", "reading", 15, "Forklift routes are marked with __BLANK_0__ lines.", "yellow", { passageImportId: "gt04-r-s2a", type: "sentence_completion", wordLimit: 1, support: "marked with yellow lines" }),
    completion("gt04-rq17", "reading", 16, "Pedestrians should use the green __BLANK_0__.", "walkways", { passageImportId: "gt04-r-s2a", type: "sentence_completion", wordLimit: 1, support: "green walkways" }),
    completion("gt04-rq18", "reading", 17, "To remove stuck packaging, staff should press the red stop __BLANK_0__.", "button", { passageImportId: "gt04-r-s2a", type: "sentence_completion", wordLimit: 1, support: "Press the red stop button" }),
    select({ importId: "gt04-rq19", skill: "reading", questionType: "true_false_notgiven", orderIndex: 18, passageImportId: "gt04-r-s2a", prompt: "Staff should twist while carrying awkward loads.", correctAnswer: "FALSE", support: "ask for help rather than twisting" }),
    completion("gt04-rq20", "reading", 19, "Any back strain must be recorded in the first-aid __BLANK_0__.", "log", { passageImportId: "gt04-r-s2a", type: "sentence_completion", wordLimit: 1, support: "first-aid log" }),
    select({ importId: "gt04-rq21", skill: "reading", questionType: "true_false_notgiven", orderIndex: 20, passageImportId: "gt04-r-s2a", prompt: "All staff may use the cardboard baler without training.", correctAnswer: "FALSE", support: "only by staff who have completed the short training module" }),
    completion("gt04-rq22", "reading", 21, "Loose plastic wrap goes in clear recycling __BLANK_0__.", "sacks", { passageImportId: "gt04-r-s2a", type: "sentence_completion", wordLimit: 1, support: "clear recycling sacks" }),
    completion("gt04-rq23", "reading", 22, "Full-time employees receive __BLANK_0__ days of annual leave.", "twenty-five", { passageImportId: "gt04-r-s2b", type: "sentence_completion", wordLimit: 1, acceptVariants: ["25"], support: "twenty-five days" }),
    completion("gt04-rq24", "reading", 23, "Leave should be requested at least four __BLANK_0__ in advance.", "weeks", { passageImportId: "gt04-r-s2b", type: "sentence_completion", wordLimit: 1, support: "at least four weeks" }),
    completion("gt04-rq25", "reading", 24, "No more than __BLANK_0__ people from the same team may be on leave.", "two", { passageImportId: "gt04-r-s2b", type: "sentence_completion", wordLimit: 1, acceptVariants: ["2"], support: "No more than two people" }),
    completion("gt04-rq26", "reading", 25, "Leave during the final week of December is restricted because of __BLANK_0__.", "stocktaking", { passageImportId: "gt04-r-s2b", type: "sentence_completion", wordLimit: 1, support: "because of stocktaking" }),
    completion("gt04-rq27", "reading", 26, "Carried-over days must be used by __BLANK_0__ March.", "31", { passageImportId: "gt04-r-s2b", type: "sentence_completion", wordLimit: 1, support: "by 31 March" }),

    select({ importId: "gt04-rq28", skill: "reading", questionType: "matching_headings", orderIndex: 27, passageImportId: "gt04-r-s3", prompt: "Paragraph B", options: ["The role of nearby destinations", "Public health benefits", "A problem with benches", "Decorative projects"], metadata: { items: [{ id: "0", text: "Paragraph B" }] }, correctAnswer: { "0": "0" }, support: "Distance is the first ingredient" }),
    select({ importId: "gt04-rq29", skill: "reading", questionType: "matching_headings", orderIndex: 28, passageImportId: "gt04-r-s3", prompt: "Paragraph D", options: ["Comfort and climate", "Traffic speed", "Local shops", "National policy"], metadata: { items: [{ id: "0", text: "Paragraph D" }] }, correctAnswer: { "0": "0" }, support: "Comfort affects decisions" }),
    select({ importId: "gt04-rq30", skill: "reading", questionType: "matching_headings", orderIndex: 29, passageImportId: "gt04-r-s3", prompt: "Paragraph F", options: ["A system, not one attractive spot", "The importance of toilets", "Why people drive", "How pavements are built"], metadata: { items: [{ id: "0", text: "Paragraph F" }] }, correctAnswer: { "0": "0" }, support: "Walkability is a system" }),
    select({ importId: "gt04-rq31", skill: "reading", questionType: "matching_information", orderIndex: 30, passageImportId: "gt04-r-s3", prompt: "Which paragraph mentions dropped kerbs?", options: ["A", "C", "E", "G"], metadata: { items: [{ id: "0", text: "dropped kerbs" }] }, correctAnswer: { "0": "1" }, support: "a missing dropped kerb" }),
    select({ importId: "gt04-rq32", skill: "reading", questionType: "matching_information", orderIndex: 31, passageImportId: "gt04-r-s3", prompt: "Which paragraph mentions blank walls?", options: ["B", "D", "E", "F"], metadata: { items: [{ id: "0", text: "blank walls" }] }, correctAnswer: { "0": "2" }, support: "Blank walls, car parks and long fences" }),
    completion("gt04-rq33", "reading", 32, "Walking feels useful, safe and __BLANK_0__ enough to become ordinary.", "pleasant", { passageImportId: "gt04-r-s3", type: "summary_completion", wordLimit: 1, support: "safe and pleasant" }),
    completion("gt04-rq34", "reading", 33, "Mixed-use planning prevents services and workplaces being separated into distant __BLANK_0__.", "zones", { passageImportId: "gt04-r-s3", type: "summary_completion", wordLimit: 1, support: "distant zones" }),
    completion("gt04-rq35", "reading", 34, "Crossings should give people enough time to cross without __BLANK_0__.", "rushing", { passageImportId: "gt04-r-s3", type: "sentence_completion", wordLimit: 1, support: "without rushing" }),
    completion("gt04-rq36", "reading", 35, "In cold or wet places, wind protection and __BLANK_0__ matter.", "drainage", { passageImportId: "gt04-r-s3", type: "sentence_completion", wordLimit: 1, support: "wind protection and drainage" }),
    select({ importId: "gt04-rq37", skill: "reading", questionType: "true_false_notgiven", orderIndex: 36, passageImportId: "gt04-r-s3", prompt: "Activity at ground level can make streets feel safer.", correctAnswer: "TRUE", support: "activity creates a sense of informal safety" }),
    select({ importId: "gt04-rq38", skill: "reading", questionType: "mcq_single", orderIndex: 37, passageImportId: "gt04-r-s3", prompt: "Why might a new plaza fail to improve walkability?", options: ["It may not connect to a wider network.", "It is always too expensive.", "It removes all shops."], correctAnswer: "0", support: "only if it connects to a wider network" }),
    completion("gt04-rq39", "reading", 38, "Walking increases casual social __BLANK_0__.", "contact", { passageImportId: "gt04-r-s3", type: "sentence_completion", wordLimit: 1, support: "casual social contact" }),
    select({ importId: "gt04-rq40", skill: "reading", questionType: "mcq_single", orderIndex: 39, passageImportId: "gt04-r-s3", prompt: "What is the writer's main point about walkable cities?", options: ["They give people more transport choices.", "They depend mainly on beautiful plazas.", "They work only in wealthy districts."], correctAnswer: "0", support: "gives people options" }),

    ws({ importId: "gt04-wq01", skill: "writing", questionType: "writing_task1_general", orderIndex: 0, prompt: "You are organising a small event at work and want a colleague from another department to attend. Write a letter to your colleague. In your letter, explain what the event is, say why you would like them to attend, and give details of the time and place. Write at least 150 words. Register: semi-formal.", modelAnswer: `Dear Priya,

I hope you are well. I am writing to invite you to a small staff event that our team is organising next month. It is an informal lunchtime session where colleagues will share practical ideas for reducing waste in the office.

I immediately thought of you because your department has already introduced the reusable cup scheme, and several people have mentioned how smoothly it works. It would be extremely helpful if you could spend five minutes explaining what made the scheme successful and what problems you had to solve at the beginning. Your experience would make the discussion much more practical.

The event will take place on Thursday 14 August from 12:30 to 1:30 p.m. in Meeting Room 3. Lunch will be provided, and there is no need to prepare slides unless you would like to bring one example or photo.

Please let me know if you are able to come.

Best regards,
Sam`, examinerNotes: { task: "Clear invitation with purpose, reason and details in semi-formal register.", coherence: "Well-organised with polite progression.", lexical: "Natural workplace lexis: informal lunchtime session, reusable cup scheme.", grammar: "Accurate request and conditional structures." }, metadata: { register: "semi-formal", wordMin: 150 } }),
    ws({ importId: "gt04-wq02", skill: "writing", questionType: "writing_task2_essay", orderIndex: 1, prompt: "Online shopping is becoming more popular, while many local shops are closing. Is this a positive or negative development? Give reasons for your answer and include examples. Write at least 250 words.", modelAnswer: `The growth of online shopping has changed the way people buy almost everything, from groceries to electronics. Although it brings convenience and choice, I think the decline of local shops is a largely negative development unless communities find ways to protect essential high-street services.

Online shopping has obvious advantages. Customers can compare prices quickly, read reviews and order items that may not be available nearby. This is especially useful for people with limited mobility or those living in rural areas. Online stores can also operate with lower overheads, which may reduce prices. For busy families, home delivery saves time that would otherwise be spent travelling between shops.

However, when local shops close, towns lose more than places to buy goods. Small shops provide employment, personal service and informal social contact, particularly for older residents. A high street with empty units feels less safe and less attractive, which can reduce footfall further. Local businesses also tend to circulate money within the area by using nearby suppliers and services, whereas large online platforms may send profits elsewhere.

In my view, online shopping is positive as an additional option but negative when it replaces local shopping completely. Councils can help by making town centres easier to reach, supporting markets and allowing mixed uses in empty buildings. Consumers also have a role: buying some goods locally, even if not everything, helps maintain choice. A healthy retail future should combine digital convenience with lively local streets.`, examinerNotes: { task: "Directly answers the positive/negative question with a balanced position.", coherence: "Clear contrast and solution-focused conclusion.", lexical: "Strong topic range: overheads, high street, footfall, platforms.", grammar: "Accurate complex clauses and concessive structures." }, metadata: { wordMin: 250 } }),
    ws({ importId: "gt04-sq01", skill: "speaking", questionType: "speaking_part1", orderIndex: 0, prompt: "Part 1: Let's talk about music. What kind of music do you like? Do you prefer listening alone or with others? Did you learn music at school?", modelAnswer: "A strong response gives clear preferences, reasons and short examples from daily life or school.", examinerNotes: { fluency: "Answers extend beyond yes/no.", lexical: "Uses music vocabulary accurately.", grammar: "Controls preference structures and past habits.", pronunciation: "Natural stress in names of genres and instruments." }, metadata: { topic: "music" } }),
    ws({ importId: "gt04-sq02", skill: "speaking", questionType: "speaking_part2_cuecard", orderIndex: 1, prompt: "Describe a time when you helped someone. You should say who you helped, what the problem was, what you did, and explain how you felt afterwards.", options: ["who you helped", "what the problem was", "what you did", "how you felt afterwards"], modelAnswer: "A band-9 response would tell a specific story, show the steps taken, and reflect on the emotional result without exaggeration.", examinerNotes: { fluency: "Sustains narrative with reflection.", lexical: "Uses helpfulness and problem-solving lexis.", grammar: "Accurate past narrative and result clauses.", pronunciation: "Clear pausing supports the story." }, metadata: { topic: "helping" } }),
    ws({ importId: "gt04-sq03", skill: "speaking", questionType: "speaking_part3", orderIndex: 2, prompt: "Part 3: Why do people help strangers? Should schools encourage volunteering? How might communities change if fewer people helped each other?", modelAnswer: "A strong answer explores empathy, social trust and civic responsibility, with balanced examples from schools and neighbourhoods.", examinerNotes: { fluency: "Develops abstract social ideas fluently.", lexical: "Uses lexis such as empathy, volunteering and social trust.", grammar: "Strong control of hypothetical structures.", pronunciation: "Intelligible and expressive in longer answers." }, metadata: { topic: "community support" } }),
  ],
});

export const GENERAL_TRAINING_MOCKS = [mock01, mock02, mock03, mock04] as const;
