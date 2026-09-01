import type { KnowledgeCollectionKey } from "./collections";
import type {
  KnowledgeManifestItemInput,
  KnowledgeSourceInput,
} from "./ingestion";

export type IeltsKnowledgeQuestionRow = {
  id: string;
  skill: "writing" | "speaking";
  question_type: string;
  prompt: string;
  metadata: Record<string, unknown> | null;
  ielts_tests:
    | { slug: string; title: string; status: string }
    | Array<{ slug: string; title: string; status: string }>;
};

export type IeltsKnowledgeRecords = {
  sources: KnowledgeSourceInput[];
  items: KnowledgeManifestItemInput[];
};

type Band = 4 | 5 | 6 | 7 | 8 | 9;
type BandNote = {
  positive: string[];
  limiting: string[];
  distinction: string;
};

const BANDS = [4, 5, 6, 7, 8, 9] as const;

export const IELTS_OFFICIAL_SOURCE_URLS = {
  scoreSettingResources:
    "https://ielts.org/organisations/ielts-for-organisations/understanding-ielts-scoring/resources-for-setting-your-ielts-scores",
  writingDescriptors:
    "https://ielts.org/cdn/ielts-guides/ielts-writing-band-descriptors.pdf",
  writingCriteria:
    "https://ielts.org/cdn/ielts-guides/ielts-writing-key-assessment-criteria.pdf",
  writingAcademicExamples:
    "https://ielts.org/cdn/computer-delivered-sample-tests-academic-writing/ielts-academic-writing-example-responses-to-parts-1-and-2-with-band-scores-and-examiner-comments.pdf",
  writingGeneralExamples:
    "https://ielts.org/cdn/computer-delivered-sample-tests-general-training-writing/ielts-general-training-writing-example-responses-to-parts-1-and-2-with-band-scores-and-examiner-comments.pdf",
  speakingDescriptors:
    "https://ielts.org/cdn/ielts-guides/ielts-speaking-band-descriptors.pdf",
  speakingCriteria:
    "https://ielts.org/cdn/ielts-guides/ielts-speaking-key-assessment-criteria.pdf",
  speakingTasks:
    "https://ielts.org/cdn/ielts-sample-tests/ielts-speaking-sample-tasks-2023.pdf",
} as const;

type OfficialScoredExample = {
  externalKey: string;
  taskType: string;
  band: number;
  locator: string;
  sourceCanonicalUrl: string;
  metadata: Record<string, unknown>;
};

const WRITING_SCORED_EXAMPLES: OfficialScoredExample[] = [
  {
    externalKey: "official-academic-writing-task-1-response-1-band-6",
    taskType: "academic_task_1",
    band: 6,
    locator: "Sample Academic Writing Part 1, Candidate Response 1, Band 6",
    sourceCanonicalUrl: IELTS_OFFICIAL_SOURCE_URLS.writingAcademicExamples,
    metadata: { module: "academic", candidateLabel: "response_1" },
  },
  {
    externalKey: "official-academic-writing-task-1-response-2-band-4",
    taskType: "academic_task_1",
    band: 4,
    locator: "Sample Academic Writing Part 1, Candidate Response 2, Band 4",
    sourceCanonicalUrl: IELTS_OFFICIAL_SOURCE_URLS.writingAcademicExamples,
    metadata: { module: "academic", candidateLabel: "response_2" },
  },
  {
    externalKey: "official-academic-writing-task-2-response-1-band-5-5",
    taskType: "writing_task_2",
    band: 5.5,
    locator: "Sample Academic Writing Part 2, Candidate Response 1, Band 5.5",
    sourceCanonicalUrl: IELTS_OFFICIAL_SOURCE_URLS.writingAcademicExamples,
    metadata: { module: "academic", candidateLabel: "response_1" },
  },
  {
    externalKey: "official-academic-writing-task-2-response-2-band-7-5",
    taskType: "writing_task_2",
    band: 7.5,
    locator: "Sample Academic Writing Part 2, Candidate Response 2, Band 7.5",
    sourceCanonicalUrl: IELTS_OFFICIAL_SOURCE_URLS.writingAcademicExamples,
    metadata: { module: "academic", candidateLabel: "response_2" },
  },
  {
    externalKey: "official-general-writing-task-1-script-a-band-5-5",
    taskType: "general_training_task_1",
    band: 5.5,
    locator: "General Training Writing Sample Task 1, Sample Script A, Band 5.5",
    sourceCanonicalUrl: IELTS_OFFICIAL_SOURCE_URLS.writingGeneralExamples,
    metadata: { module: "general_training", candidateLabel: "script_a" },
  },
  {
    externalKey: "official-general-writing-task-2-script-a-band-5",
    taskType: "writing_task_2",
    band: 5,
    locator: "General Training Writing Sample Task 2, Sample Script A, Band 5",
    sourceCanonicalUrl: IELTS_OFFICIAL_SOURCE_URLS.writingGeneralExamples,
    metadata: { module: "general_training", candidateLabel: "script_a" },
  },
];

const SPEAKING_SCORED_EXAMPLES: OfficialScoredExample[] = [
  ["tina", "Vietnam", 5, "speaking_part_2", "Interests and hobbies"],
  ["katsuharu", "Japan", 5, "speaking_part_3", "Hobbies"],
  ["stephen", "China", 6, "speaking_part_3", "Hobbies"],
  ["maxim", "Russia", 6, "speaking_part_3", "Hobbies"],
  ["michal", "Poland", 6.5, "speaking_part_2", "A well-known person"],
  ["hendrik", "Germany", 7, "speaking_part_3", "Famous people"],
  ["aashish", "India", 7.5, "speaking_part_3", "Famous people"],
  ["monika", "Germany", 8, "speaking_part_3", "Famous people"],
  ["kopi", "Botswana", 8, "speaking_part_3", "Famous people"],
  ["kenn", "Singapore", 8.5, "speaking_part_3", "Famous people"],
  ["anuradha", "Malaysia", 9, "speaking_part_3", "Famous people"],
].map(([candidate, country, band, taskType, topic]) => ({
  externalKey: `official-speaking-${candidate}-band-${String(band).replace(".", "-")}`,
  taskType: String(taskType),
  band: Number(band),
  locator: `Band ${band} | ${String(candidate).charAt(0).toUpperCase()}${String(candidate).slice(1)}, ${country}; ${String(taskType).replace("speaking_part_", "Part ")}: ${topic}`,
  sourceCanonicalUrl: IELTS_OFFICIAL_SOURCE_URLS.scoreSettingResources,
  metadata: { candidateLabel: candidate, country, topic },
}));

const writingCoherence: Record<Band, BandNote> = {
  4: {
    positive: ["Some ideas are visible and basic linking is attempted."],
    limiting: [
      "There is no clear progression, and relationships between ideas are often unclear or repetitively marked.",
    ],
    distinction:
      "Unlike Band 3, some organisation and basic cohesive devices are visible, even though they do not yet create a coherent progression.",
  },
  5: {
    positive: [
      "An underlying organisation can be followed and the relationships between ideas are usually recoverable.",
    ],
    limiting: [
      "Progression is uneven; linking, referencing, or paragraphing can be repetitive, inaccurate, or incomplete.",
    ],
    distinction:
      "Band 5 has a recognisable organising logic; Band 4 does not sustain one.",
  },
  6: {
    positive: [
      "Information and ideas generally progress coherently, with cohesive devices working to some good effect.",
    ],
    limiting: [
      "Links can feel mechanical, and referencing, substitution, or paragraph focus may lack flexibility.",
    ],
    distinction:
      "Band 6 sustains a clear overall progression; Band 5 remains only partly logical or fluent.",
  },
  7: {
    positive: [
      "Ideas are logically organised with clear progression and generally effective paragraphing.",
      "A range of cohesive and referencing devices is used flexibly.",
    ],
    limiting: ["Minor overuse, underuse, or inaccurate linking may remain."],
    distinction:
      "Band 7 requires flexible organisation and cohesion, beyond the generally coherent but sometimes mechanical control at Band 6.",
  },
  8: {
    positive: [
      "The message is easy to follow, with logical sequencing, well-managed cohesion, and appropriate paragraphing.",
    ],
    limiting: ["Only occasional lapses in coherence or cohesion occur."],
    distinction:
      "Band 8 is consistently easy to follow; Band 7 may still show a few noticeable organisational or cohesive lapses.",
  },
  9: {
    positive: [
      "The message is effortless to follow, cohesion rarely draws attention, and paragraphing is skilfully controlled.",
    ],
    limiting: ["Any lapse is minimal and exceptional."],
    distinction:
      "Band 9 makes organisation and cohesion effectively invisible; Band 8 permits occasional noticeable lapses.",
  },
};

const writingLexical: Record<Band, BandNote> = {
  4: {
    positive: ["Some basic vocabulary communicates parts of the message."],
    limiting: [
      "Range is inadequate or repetitive, and word-choice, formation, or spelling errors may impede meaning.",
    ],
    distinction:
      "Band 4 has some usable basic vocabulary; Band 3 remains broadly inadequate and errors dominate.",
  },
  5: {
    positive: ["Simple vocabulary is minimally adequate and can be accurate."],
    limiting: [
      "Limited variation, frequent simplification, or word-choice and spelling problems can make reading difficult.",
    ],
    distinction:
      "Band 5 is minimally adequate for the task, while Band 4 is often inadequate or unrelated.",
  },
  6: {
    positive: [
      "Vocabulary is generally adequate and appropriate, and meaning remains clear.",
    ],
    limiting: [
      "Range or precision is restricted, with some spelling, formation, or appropriacy errors that do not block communication.",
    ],
    distinction:
      "Band 6 keeps meaning clear despite imprecision; Band 5's limited range can cause noticeable reader difficulty.",
  },
  7: {
    positive: [
      "Vocabulary supports flexibility and precision, including some less common language and awareness of style and collocation.",
    ],
    limiting: ["A few appropriacy, spelling, or formation errors remain."],
    distinction:
      "Band 7 shows flexible, sometimes less-common expression; Band 6 is generally adequate but restricted or imprecise.",
  },
  8: {
    positive: [
      "A wide resource is used fluently and flexibly for precise meaning, including skilful less-common or idiomatic choices.",
    ],
    limiting: ["Occasional inaccuracies have minimal effect on communication."],
    distinction:
      "Band 8 sustains wide and precise lexical control; Band 7 shows this only to a more limited degree.",
  },
  9: {
    positive: [
      "Vocabulary is wide, precise, natural, and sophisticated, with full flexibility for the task.",
    ],
    limiting: ["Spelling or word-formation errors are extremely rare."],
    distinction:
      "Band 9 combines full precision and natural control; Band 8 still allows occasional inaccuracies.",
  },
};

const writingGrammar: Record<Band, BandNote> = {
  4: {
    positive: ["Some simple structures are accurate."],
    limiting: [
      "Range is very limited, subordinate clauses are rare, and frequent grammar or punctuation errors may impede meaning.",
    ],
    distinction:
      "Band 4 provides some accurate simple forms; Band 3 errors prevent most meaning from coming through.",
  },
  5: {
    positive: [
      "Simple sentences show the greatest accuracy and some complex forms are attempted.",
    ],
    limiting: [
      "Structures are repetitive, complex attempts are often faulty, and errors can cause reader difficulty.",
    ],
    distinction:
      "Band 5 demonstrates limited sentence control; Band 4 remains dominated by a very narrow range and potentially meaning-blocking errors.",
  },
  6: {
    positive: ["A mix of simple and complex sentence forms is used."],
    limiting: [
      "Flexibility is limited and complex forms are less accurate, though errors rarely impede communication.",
    ],
    distinction:
      "Band 6 attempts a functional mix of sentence types without blocking meaning; Band 5 errors more often burden the reader.",
  },
  7: {
    positive: [
      "A variety of complex structures is used with some flexibility, and error-free sentences are frequent.",
    ],
    limiting: [
      "A few persistent errors remain but do not impede communication.",
    ],
    distinction:
      "Band 7 has frequent error-free sentences and flexible complex forms; Band 6 has limited flexibility and weaker complex-sentence accuracy.",
  },
  8: {
    positive: [
      "A wide range of structures is used flexibly and accurately, with most sentences error-free and punctuation well managed.",
    ],
    limiting: ["Occasional non-systematic errors have minimal impact."],
    distinction:
      "Band 8 makes accurate control the norm across a wide range; Band 7 still permits a few recurring errors.",
  },
  9: {
    positive: [
      "A wide structural range is used with full flexibility and control, with appropriate grammar and punctuation throughout.",
    ],
    limiting: ["Minor errors are extremely rare."],
    distinction:
      "Band 9 requires essentially complete control; Band 8 still permits occasional non-systematic errors.",
  },
};

const writingTask1: Record<Band, BandNote> = {
  4: {
    positive: [
      "The response attempts the task and includes some requested content.",
    ],
    limiting: [
      "Few key features may be selected, bullet points may be missing, or purpose, tone, accuracy, and format may be inappropriate.",
    ],
    distinction:
      "Band 4 makes a recognisable attempt; Band 3 substantially misunderstands or fails to address the requirements.",
  },
  5: {
    positive: [
      "The response generally addresses the task and presents its main requirements.",
    ],
    limiting: [
      "Key features or bullet points are not adequately developed, and detail, overview, purpose, tone, or format may be weak.",
    ],
    distinction:
      "Band 5 generally addresses the task; Band 4 covers only a limited or unreliable subset of its requirements.",
  },
  6: {
    positive: [
      "The response focuses on the requirements in an appropriate format and adequately covers selected features or all bullet points.",
    ],
    limiting: [
      "Overview, detail, tone, illustration, or accuracy may be incomplete, excessive, or inconsistent.",
    ],
    distinction:
      "Band 6 adequately covers the task with a usable overview or clear purpose; Band 5 leaves important coverage underdeveloped.",
  },
  7: {
    positive: [
      "Requirements are covered with relevant, accurate content, a clear overview or purpose, and appropriate format and tone.",
    ],
    limiting: [
      "Some selected features or bullet points could be extended more fully.",
    ],
    distinction:
      "Band 7 clearly highlights and organises the requirements; Band 6 may only adequately cover them and can contain incomplete detail.",
  },
  8: {
    positive: [
      "All requirements are covered appropriately, relevantly, and sufficiently, with skilful feature selection or well-extended bullet points.",
    ],
    limiting: ["Only occasional content omissions or lapses occur."],
    distinction:
      "Band 8 is consistently sufficient and skilful; Band 7 can leave some illustration or extension incomplete.",
  },
  9: {
    positive: ["Every task requirement is fully and appropriately satisfied."],
    limiting: ["Content lapses are extremely rare."],
    distinction:
      "Band 9 is fully complete and appropriate; Band 8 permits occasional omissions or lapses.",
  },
};

const writingTask2: Record<Band, BandNote> = {
  4: {
    positive: ["A position or some main ideas can be discerned."],
    limiting: [
      "The prompt is handled minimally or tangentially, with unclear, irrelevant, repetitive, or unsupported ideas.",
    ],
    distinction:
      "Band 4 contains a discernible response; Band 3 does not adequately address any part of the prompt.",
  },
  5: {
    positive: ["A position and some relevant main ideas are present."],
    limiting: [
      "Parts of the prompt remain incomplete, and development, clarity, relevance, or support is limited or repetitive.",
    ],
    distinction:
      "Band 5 addresses the prompt incompletely but recognisably; Band 4 may be minimal or tangential.",
  },
  6: {
    positive: [
      "The main parts of the prompt are addressed with a directly relevant position and relevant ideas.",
    ],
    limiting: [
      "Coverage can be uneven, conclusions unclear, or support insufficient, less relevant, or inadequately developed.",
    ],
    distinction:
      "Band 6 addresses the main prompt with relevant content; Band 5 leaves important parts incomplete or weakly developed.",
  },
  7: {
    positive: [
      "The main prompt is appropriately addressed through a clear, developed position and supported relevant ideas.",
    ],
    limiting: [
      "Support may occasionally over-generalise or lack focus and precision.",
    ],
    distinction:
      "Band 7 develops and supports a clear position; Band 6 can remain uneven, repetitive, or insufficiently justified.",
  },
  8: {
    positive: [
      "The prompt is sufficiently addressed through a clear, well-developed position and relevant, well-extended support.",
    ],
    limiting: ["Only occasional content omissions or lapses occur."],
    distinction:
      "Band 8 sustains well-extended and well-supported ideas; Band 7 can still lose focus or precision in support.",
  },
  9: {
    positive: [
      "The prompt is explored in depth through a fully developed direct position and fully extended, well-supported ideas.",
    ],
    limiting: ["Lapses in content or support are extremely rare."],
    distinction:
      "Band 9 is fully developed and in-depth; Band 8 permits occasional omissions or lapses.",
  },
};

const speakingFluency: Record<Band, BandNote> = {
  4: {
    positive: [
      "Simple sentences can be linked and some message is maintained.",
    ],
    limiting: [
      "Frequent pauses, slow delivery, repetition, or self-correction create noticeable coherence breakdowns.",
    ],
    distinction:
      "Band 4 can link some simple speech; Band 3 frequently cannot sustain or connect a basic message.",
  },
  5: {
    positive: ["Speech usually continues and simpler language can be fluent."],
    limiting: [
      "Continuation relies on repetition, correction, slow speech, or mid-sentence searching, especially with complex language.",
    ],
    distinction:
      "Band 5 usually keeps going despite effort; Band 4 cannot do so without noticeable pauses and breakdowns.",
  },
  6: {
    positive: [
      "The speaker is willing and able to produce longer turns and uses a range of discourse markers.",
    ],
    limiting: [
      "Hesitation, repetition, self-correction, or inappropriate linking can sometimes weaken coherence.",
    ],
    distinction:
      "Band 6 can sustain longer turns; Band 5 relies more heavily on repetition, correction, or slow delivery.",
  },
  7: {
    positive: [
      "Long turns are produced without noticeable effort and discourse markers and cohesive features are used flexibly.",
    ],
    limiting: [
      "Some mid-sentence hesitation or correction occurs but does not damage coherence.",
    ],
    distinction:
      "Band 7 sustains coherent long turns readily; Band 6 can lose coherence when searching or correcting.",
  },
  8: {
    positive: [
      "Speech is fluent with coherent, relevant topic development; most hesitation is about content rather than language.",
    ],
    limiting: [
      "Repetition, self-correction, or language-search hesitation is very occasional.",
    ],
    distinction:
      "Band 8 makes language-access hesitation rare; Band 7 may still show it without losing coherence.",
  },
  9: {
    positive: [
      "Speech is fully coherent and appropriately extended; hesitation is used only to plan content.",
    ],
    limiting: ["Repetition or self-correction is only very occasional."],
    distinction:
      "Band 9 removes language-search hesitation almost entirely; Band 8 may show it occasionally.",
  },
};

const speakingLexical: Record<Band, BandNote> = {
  4: {
    positive: ["Basic vocabulary conveys meaning on familiar topics."],
    limiting: [
      "Range is weak on unfamiliar topics, word-choice errors are frequent, and paraphrase is rare.",
    ],
    distinction:
      "Band 4 can discuss familiar topics with basic language; Band 3 is largely limited to simple personal information.",
  },
  5: {
    positive: [
      "Vocabulary is sufficient for familiar and unfamiliar topics, and paraphrase is attempted.",
    ],
    limiting: [
      "Flexibility is limited and paraphrase is not consistently successful.",
    ],
    distinction:
      "Band 5 can reach beyond familiar topics; Band 4 usually cannot do so reliably.",
  },
  6: {
    positive: [
      "Vocabulary supports discussion at length and paraphrase is generally successful.",
    ],
    limiting: [
      "Some inappropriate or imprecise choices occur, though meaning remains clear.",
    ],
    distinction:
      "Band 6 sustains topics at length with generally successful paraphrase; Band 5 remains less flexible.",
  },
  7: {
    positive: [
      "Vocabulary is flexible across varied topics, with some less-common language, style and collocation awareness, and effective paraphrase.",
    ],
    limiting: ["Some inappropriate choices or collocations remain."],
    distinction:
      "Band 7 uses vocabulary flexibly and shows less-common control; Band 6 is sufficient but may be imprecise.",
  },
  8: {
    positive: [
      "A wide resource is used readily and flexibly for precise meaning, with skilful less-common or idiomatic language and effective paraphrase.",
    ],
    limiting: ["Occasional word-choice or collocation inaccuracies remain."],
    distinction:
      "Band 8 sustains wide, precise control; Band 7 shows this less consistently.",
  },
  9: {
    positive: [
      "Vocabulary is totally flexible and precise, with sustained accurate idiomatic use.",
    ],
    limiting: ["No meaningful lexical limitation is evident."],
    distinction:
      "Band 9 sustains complete precision and idiomatic control; Band 8 permits occasional inaccuracies.",
  },
};

const speakingGrammar: Record<Band, BandNote> = {
  4: {
    positive: ["Some short basic sentences are accurate."],
    limiting: [
      "Turns and structures are repetitive, subordinate clauses are rare, and errors are frequent.",
    ],
    distinction:
      "Band 4 shows some accurate basic forms; Band 3 has numerous errors even in attempted basic sentences.",
  },
  5: {
    positive: [
      "Basic sentence forms are fairly well controlled and complex structures are attempted.",
    ],
    limiting: [
      "Complex forms are limited and almost always contain errors or require reformulation.",
    ],
    distinction:
      "Band 5 controls basic forms with some complex attempts; Band 4 remains short, repetitive, and structurally narrow.",
  },
  6: {
    positive: [
      "A mix of short and complex forms is produced, with errors rarely blocking communication.",
    ],
    limiting: [
      "Structural variety has limited flexibility and complex forms contain frequent errors.",
    ],
    distinction:
      "Band 6 uses a functional mix of forms without impeding meaning; Band 5's complex attempts are much less reliable.",
  },
  7: {
    positive: [
      "A range of structures is used flexibly, with frequent error-free sentences and effective simple and complex forms.",
    ],
    limiting: ["Some errors, including a few basic ones, remain."],
    distinction:
      "Band 7 uses complex structures effectively and often accurately; Band 6 remains less flexible and more error-prone.",
  },
  8: {
    positive: [
      "A wide structural range is used flexibly and most sentences are error-free.",
    ],
    limiting: ["Occasional non-systematic or residual basic errors occur."],
    distinction:
      "Band 8 makes accurate, wide-ranging control the norm; Band 7 still permits more noticeable errors.",
  },
  9: {
    positive: ["Structures are precise and accurate throughout."],
    limiting: [
      "Only natural slips comparable to native-speaker speech may occur.",
    ],
    distinction:
      "Band 9 is consistently precise; Band 8 permits occasional non-systematic errors.",
  },
};

const speakingPronunciation: Record<Band, BandNote> = {
  4: {
    positive: ["Some chunking and phonological features are acceptable."],
    limiting: [
      "Rhythm, stress, intonation, word sounds, or phonemes frequently reduce clarity and require listener effort.",
    ],
    distinction:
      "Band 4 provides meaningful stretches that can be understood with effort; Band 3 remains between very limited and only partly acceptable control.",
  },
  5: {
    positive: [
      "The speaker shows all Band 4 strengths and some features associated with Band 6.",
    ],
    limiting: [
      "Control and intelligibility are not yet stable enough to meet Band 6 throughout.",
    ],
    distinction:
      "Band 5 adds emerging Band 6 control to a Band 4 base, but does not sustain it.",
  },
  6: {
    positive: [
      "A range of features is used, chunking is generally appropriate, and speech is normally understandable without much effort.",
    ],
    limiting: [
      "Control varies; rhythm, stress, intonation, word sounds, or phonemes can occasionally reduce clarity.",
    ],
    distinction:
      "Band 6 is generally intelligible and uses a range of features; Band 5 only shows some of this control.",
  },
  7: {
    positive: [
      "The speaker has all Band 6 strengths and some of the sustained range and ease associated with Band 8.",
    ],
    limiting: [
      "Band 8-level rhythm, connected speech, and effortless clarity are not fully sustained.",
    ],
    distinction:
      "Band 7 extends a secure Band 6 base toward Band 8, but advanced control remains incomplete.",
  },
  8: {
    positive: [
      "A wide range of features, rhythm, stress, intonation, and connected speech is sustained, and speech is easy to understand.",
    ],
    limiting: [
      "Occasional lapses occur and accent may have a minimal effect on intelligibility.",
    ],
    distinction:
      "Band 8 sustains wide phonological control and easy intelligibility; Band 7 only shows some of these features.",
  },
  9: {
    positive: [
      "A full phonological range conveys precise or subtle meaning, connected speech is sustained, and understanding is effortless.",
    ],
    limiting: ["Accent has no effect on intelligibility."],
    distinction:
      "Band 9 is effortless and fully flexible; Band 8 permits occasional lapses and a minimal accent effect.",
  },
};

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

function testRecord(row: IeltsKnowledgeQuestionRow) {
  return Array.isArray(row.ielts_tests) ? row.ielts_tests[0] : row.ielts_tests;
}

export function collectionForIeltsSkill(
  skill: IeltsKnowledgeQuestionRow["skill"],
): KnowledgeCollectionKey {
  return skill === "writing" ? "ielts.writing" : "ielts.speaking";
}

export function buildIeltsMockKnowledgeRecords(params: {
  rows: IeltsKnowledgeQuestionRow[];
  collection: Extract<
    KnowledgeCollectionKey,
    "ielts.writing" | "ielts.speaking"
  >;
}): IeltsKnowledgeRecords {
  const sourcesByUrl = new Map<string, KnowledgeSourceInput>();
  const items: KnowledgeManifestItemInput[] = [];
  for (const row of params.rows) {
    if (collectionForIeltsSkill(row.skill) !== params.collection) continue;
    const test = testRecord(row);
    if (!test || test.status !== "published") continue;
    const sourceUrl = `https://thinkfy.net/en/ielts/mock/${encodeURIComponent(test.slug)}`;
    sourcesByUrl.set(sourceUrl, {
      canonicalUrl: sourceUrl,
      publisher: "DebateLab",
      title: test.title,
      authorityTier: "ai_derived",
      rightsStatus: "approved_for_derived_use",
      reviewStatus: "candidate",
      metadata: {
        synthetic: true,
        notOfficialIelts: true,
        sourceType: "debatelab_mock_question_bank",
      },
    });
    const metadata = row.metadata ?? {};
    for (const criterion of stringArray(metadata.coach_criteria)) {
      items.push({
        collection: params.collection,
        sourceCanonicalUrl: sourceUrl,
        itemType: "practice_prompt",
        criterion,
        taskType: row.question_type,
        permittedExcerpt: row.prompt,
        reviewStatus: "needs_review",
        usableFor: ["coaching"],
        insight: {
          skill: row.skill,
          taskType: row.question_type,
          criterion,
          responseSegment: row.prompt,
          positiveEvidence: [],
          limitingEvidence: [],
          sourceAuthority: "ai_derived",
        },
        metadata: {
          synthetic: true,
          notOfficialIelts: true,
          answerKeyAvailable: false,
          questionId: row.id,
          subskillTags: stringArray(metadata.subskill_tags),
        },
      });
    }
  }
  return { sources: [...sourcesByUrl.values()], items };
}

function officialSource(params: {
  canonicalUrl: string;
  title: string;
  captureKind: string;
}): KnowledgeSourceInput {
  return {
    canonicalUrl: params.canonicalUrl,
    publisher: "IELTS",
    title: params.title,
    authorityTier: "official",
    rightsStatus: "requires_review",
    reviewStatus: "candidate",
    metadata: {
      discoveryMethod: "exa",
      captureKind: params.captureKind,
      derivedOnly: true,
      fullResponseStored: false,
      requiresIndependentRightsReview: true,
    },
  };
}

function rubricItem(params: {
  collection: "ielts.writing" | "ielts.speaking";
  sourceCanonicalUrl: string;
  taskType: string;
  criterion: string;
  band: Band;
  note: BandNote;
  locator: string;
  rubricVersion: string;
}): KnowledgeManifestItemInput {
  return {
    collection: params.collection,
    sourceCanonicalUrl: params.sourceCanonicalUrl,
    itemType: "rubric_descriptor_candidate",
    criterion: params.criterion,
    bandMin: params.band,
    bandMax: params.band,
    taskType: params.taskType,
    sourceLocator: params.locator,
    reviewStatus: "needs_review",
    usableFor: ["grading", "coaching"],
    insight: {
      skill: params.collection === "ielts.writing" ? "writing" : "speaking",
      taskType: params.taskType,
      criterion: params.criterion,
      assignedBand: params.band,
      examinerRationale: params.note.positive.join(" "),
      positiveEvidence: params.note.positive,
      limitingEvidence: params.note.limiting,
      adjacentBandDistinction: params.note.distinction,
      sourceAuthority: "official",
    },
    metadata: {
      paraphrased: true,
      derivedOnly: true,
      fullResponseStored: false,
      rightsChecked: false,
      rubricVersion: params.rubricVersion,
      discoveredWith: "exa",
    },
  };
}

function scoredExampleLocatorItem(params: {
  collection: "ielts.writing" | "ielts.speaking";
  example: OfficialScoredExample;
}): KnowledgeManifestItemInput {
  const skill = params.collection === "ielts.writing" ? "writing" : "speaking";
  return {
    collection: params.collection,
    sourceCanonicalUrl: params.example.sourceCanonicalUrl,
    itemType: "scored_example_locator_candidate",
    criterion: "overall_performance",
    bandMin: params.example.band,
    bandMax: params.example.band,
    taskType: params.example.taskType,
    sourceLocator: params.example.locator,
    reviewStatus: "needs_review",
    usableFor: ["coaching", "explanation"],
    insight: {
      skill,
      taskType: params.example.taskType,
      criterion: "overall_performance",
      assignedBand: params.example.band,
      examinerRationale:
        "The official source publishes a response or transcript with examiner commentary across the four assessment criteria. Its numeric score is an overall band, not four criterion-level labels.",
      positiveEvidence: [],
      limitingEvidence: [],
      sourceAuthority: "official",
    },
    metadata: {
      ...params.example.metadata,
      externalKey: params.example.externalKey,
      paraphrased: true,
      derivedOnly: true,
      fullResponseStored: false,
      transcriptStored: false,
      permittedExcerptStored: false,
      rightsChecked: false,
      overallBandOnly: true,
      criterionScoresPublished: false,
      benchmarkEligible: false,
      retrievalClassification: "coaching_example_locator",
      discoveredWith: "exa",
    },
  };
}

function buildWritingScoredExampleItems() {
  return WRITING_SCORED_EXAMPLES.map((example) =>
    scoredExampleLocatorItem({ collection: "ielts.writing", example }),
  );
}

function buildSpeakingScoredExampleItems() {
  return SPEAKING_SCORED_EXAMPLES.map((example) =>
    scoredExampleLocatorItem({ collection: "ielts.speaking", example }),
  );
}

function writingDescriptorPage(band: Band) {
  if (band >= 7) return 1;
  if (band >= 5) return 2;
  return 3;
}

function speakingDescriptorPage(band: Band) {
  return band >= 7 ? 1 : 2;
}

function buildWritingOfficialItems() {
  const items: KnowledgeManifestItemInput[] = [];
  for (const taskType of [
    "academic_task_1",
    "general_training_task_1",
  ] as const) {
    for (const band of BANDS) {
      const page = writingDescriptorPage(band);
      for (const [criterion, notes] of [
        ["task_achievement", writingTask1],
        ["coherence_and_cohesion", writingCoherence],
        ["lexical_resource", writingLexical],
        ["grammatical_range_and_accuracy", writingGrammar],
      ] as const) {
        items.push(
          rubricItem({
            collection: "ielts.writing",
            sourceCanonicalUrl: IELTS_OFFICIAL_SOURCE_URLS.writingDescriptors,
            taskType,
            criterion,
            band,
            note: notes[band],
            locator: `Writing Task 1 Band Descriptors, page ${page}`,
            rubricVersion: "writing-band-descriptors-2023-05",
          }),
        );
      }
    }
  }
  for (const band of BANDS) {
    const page = writingDescriptorPage(band);
    for (const [criterion, notes] of [
      ["task_response", writingTask2],
      ["coherence_and_cohesion", writingCoherence],
      ["lexical_resource", writingLexical],
      ["grammatical_range_and_accuracy", writingGrammar],
    ] as const) {
      items.push(
        rubricItem({
          collection: "ielts.writing",
          sourceCanonicalUrl: IELTS_OFFICIAL_SOURCE_URLS.writingDescriptors,
          taskType: "writing_task_2",
          criterion,
          band,
          note: notes[band],
          locator: `Writing Task 2 Band Descriptors, page ${page}`,
          rubricVersion: "writing-band-descriptors-2023-05",
        }),
      );
    }
  }
  return items;
}

function buildSpeakingOfficialItems() {
  const items: KnowledgeManifestItemInput[] = [];
  for (const band of BANDS) {
    const page = speakingDescriptorPage(band);
    for (const [criterion, notes] of [
      ["fluency_and_coherence", speakingFluency],
      ["lexical_resource", speakingLexical],
      ["grammatical_range_and_accuracy", speakingGrammar],
      ["pronunciation", speakingPronunciation],
    ] as const) {
      items.push(
        rubricItem({
          collection: "ielts.speaking",
          sourceCanonicalUrl: IELTS_OFFICIAL_SOURCE_URLS.speakingDescriptors,
          taskType: "speaking_all_parts",
          criterion,
          band,
          note: notes[band],
          locator: `Speaking Band Descriptors, page ${page}`,
            rubricVersion: "speaking-band-descriptors-current-2026-08-31",
        }),
      );
    }
  }
  return items;
}

export function buildOfficialIeltsKnowledgeRecords(
  collection: Extract<
    KnowledgeCollectionKey,
    "ielts.writing" | "ielts.speaking"
  >,
): IeltsKnowledgeRecords {
  if (collection === "ielts.writing") {
    return {
      sources: [
        officialSource({
          canonicalUrl: IELTS_OFFICIAL_SOURCE_URLS.writingDescriptors,
          title: "IELTS Writing Band Descriptors",
          captureKind: "official_band_descriptors",
        }),
        officialSource({
          canonicalUrl: IELTS_OFFICIAL_SOURCE_URLS.writingCriteria,
          title: "IELTS Writing Key Assessment Criteria",
          captureKind: "official_assessment_criteria",
        }),
        officialSource({
          canonicalUrl: IELTS_OFFICIAL_SOURCE_URLS.writingAcademicExamples,
          title: "Academic Writing scored responses and examiner comments",
          captureKind: "official_scored_examples_reference",
        }),
        officialSource({
          canonicalUrl: IELTS_OFFICIAL_SOURCE_URLS.writingGeneralExamples,
          title:
            "General Training Writing scored responses and examiner comments",
          captureKind: "official_scored_examples_reference",
        }),
      ],
      items: [
        ...buildWritingOfficialItems(),
        ...buildWritingScoredExampleItems(),
      ],
    };
  }
  return {
    sources: [
      officialSource({
        canonicalUrl: IELTS_OFFICIAL_SOURCE_URLS.speakingDescriptors,
        title: "IELTS Speaking Band Descriptors",
        captureKind: "official_band_descriptors",
      }),
      officialSource({
        canonicalUrl: IELTS_OFFICIAL_SOURCE_URLS.speakingCriteria,
        title: "IELTS Speaking Key Assessment Criteria",
        captureKind: "official_assessment_criteria",
      }),
      officialSource({
        canonicalUrl: IELTS_OFFICIAL_SOURCE_URLS.speakingTasks,
        title: "IELTS Speaking Sample Tasks",
        captureKind: "official_task_format_reference",
      }),
      officialSource({
        canonicalUrl: IELTS_OFFICIAL_SOURCE_URLS.scoreSettingResources,
        title: "Official IELTS Speaking scored samples and examiner comments",
        captureKind: "official_scored_examples_reference",
      }),
    ],
    items: [
      ...buildSpeakingOfficialItems(),
      ...buildSpeakingScoredExampleItems(),
    ],
  };
}
