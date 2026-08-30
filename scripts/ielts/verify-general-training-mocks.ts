import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseInput } from "../../apps/web/src/lib/api/boundary";
import {
  CreateIeltsTestSchema,
  IELTS_QUESTION_TYPES,
} from "../../apps/web/src/lib/api/ielts/schema";
import {
  CreateListeningSectionSchema,
  CreatePassageSchema,
  ReplaceBandConversionTableSchema,
} from "../../apps/web/src/lib/api/ielts/content-schema";
import {
  CreateIeltsQuestionSchema,
  questionCategory,
} from "../../apps/web/src/lib/api/ielts/question-schema";
import { scoreObjectiveAnswer } from "../../apps/web/src/lib/scoring/ielts/objective-scoring";
import {
  GENERAL_TRAINING_MOCKS,
  GT_BATCH_KEY,
  GT_READING_BAND_CONVERSION_KEY,
  GT_READING_BAND_ROWS,
  type AuthoredQuestion,
  type GeneralTrainingMock,
} from "./general-training-mocks-01-04";

const TEST_ID = "11111111-1111-4111-8111-111111111111";
const PASSAGE_ID = "22222222-2222-4222-8222-222222222222";
const SECTION_ID = "33333333-3333-4333-8333-333333333333";

interface MockQaResult {
  slug: string;
  listeningItems: number;
  readingItems: number;
  writingPrompts: number;
  speakingPrompts: number;
  desyncs: string[];
  supportIssues: string[];
  schemaIssues: string[];
  objectiveRows: AuthoredQuestion[];
}

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function supportParts(support: string | string[] | undefined): string[] {
  if (Array.isArray(support)) return support;
  if (!support) return [];
  return support.split(/\s+\/\s+/).filter(Boolean);
}

function firstCorrectAnswer(value: unknown): unknown {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") {
    const first = Object.values(value as Record<string, unknown>)[0];
    return first;
  }
  return value;
}

function qTypeIsObjective(question: AuthoredQuestion): boolean {
  return questionCategory(question.questionType) === "objective";
}

function validateBandTable(): string[] {
  const issues: string[] = [];
  try {
    parseInput(ReplaceBandConversionTableSchema, {
      conversionKey: GT_READING_BAND_CONVERSION_KEY,
      skill: "reading",
      module: "general_training",
      rows: GT_READING_BAND_ROWS,
    });
  } catch (error) {
    issues.push(error instanceof Error ? error.message : String(error));
  }
  return issues;
}

function validateTestContainer(mock: GeneralTrainingMock): string[] {
  const issues: string[] = [];
  try {
    parseInput(CreateIeltsTestSchema, {
      slug: mock.slug,
      title: mock.title,
      kind: "full_mock",
      module: "general_training",
      status: "in_qa",
      timeLimitSeconds: 10800,
      description: mock.description,
      metadata: {
        band_conversion_key: GT_READING_BAND_CONVERSION_KEY,
        provenance: { sourceBook: "Original Authoring" },
        importBatch: GT_BATCH_KEY,
      },
    });
  } catch (error) {
    issues.push(error instanceof Error ? error.message : String(error));
  }
  return issues;
}

function validateContentRows(mock: GeneralTrainingMock): string[] {
  const issues: string[] = [];
  for (const passage of mock.passages) {
    try {
      parseInput(CreatePassageSchema, { testId: TEST_ID, ...passage });
    } catch (error) {
      issues.push(`${passage.importId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  for (const section of mock.listeningSections) {
    try {
      parseInput(CreateListeningSectionSchema, { testId: TEST_ID, ...section });
    } catch (error) {
      issues.push(`${section.importId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  for (const question of mock.questions) {
    try {
      parseInput(CreateIeltsQuestionSchema, {
        testId: TEST_ID,
        passageId: question.passageImportId ? PASSAGE_ID : null,
        listeningSectionId: question.sectionImportId ? SECTION_ID : null,
        skill: question.skill,
        questionType: question.questionType,
        prompt: question.prompt,
        orderIndex: question.orderIndex,
        groupKey: question.groupKey,
        groupInstructions: question.groupInstructions,
        options: question.options,
        maxPoints: question.maxPoints ?? 1,
        wordLimit: question.wordLimit,
        metadata: question.metadata ?? {},
        correctAnswer: question.correctAnswer,
        acceptVariants: question.acceptVariants,
        explanationEn: question.explanationEn,
        explanationVi: question.explanationVi,
        modelAnswer: question.modelAnswer,
        examinerNotes: question.examinerNotes ?? {},
      });
    } catch (error) {
      issues.push(`${question.importId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return issues;
}

function validateSupports(mock: GeneralTrainingMock): string[] {
  const issues: string[] = [];
  const passageText = new Map(mock.passages.map((p) => [p.importId, normalizeText(p.body)]));
  const sectionText = new Map(mock.listeningSections.map((s) => [s.importId, normalizeText(s.script)]));

  for (const question of mock.questions.filter(qTypeIsObjective)) {
    const source =
      question.skill === "reading"
        ? passageText.get(question.passageImportId ?? "")
        : sectionText.get(question.sectionImportId ?? "");
    if (!source) {
      issues.push(`${question.importId}: missing linked ${question.skill} source`);
      continue;
    }
    const parts = supportParts(question.support);
    if (parts.length === 0) {
      issues.push(`${question.importId}: missing support text`);
      continue;
    }
    for (const part of parts) {
      if (!source.includes(normalizeText(part))) {
        issues.push(`${question.importId}: support not found -> ${part}`);
      }
    }
  }
  return issues;
}

function validateObjectiveKeys(mock: GeneralTrainingMock): string[] {
  const desyncs: string[] = [];
  for (const question of mock.questions.filter(qTypeIsObjective)) {
    const normalized = parseInput(CreateIeltsQuestionSchema, {
      testId: TEST_ID,
      passageId: question.passageImportId ? PASSAGE_ID : null,
      listeningSectionId: question.sectionImportId ? SECTION_ID : null,
      skill: question.skill,
      questionType: question.questionType,
      prompt: question.prompt,
      orderIndex: question.orderIndex,
      groupKey: question.groupKey,
      groupInstructions: question.groupInstructions,
      options: question.options,
      maxPoints: question.maxPoints ?? 1,
      wordLimit: question.wordLimit,
      metadata: question.metadata ?? {},
      correctAnswer: question.correctAnswer,
      acceptVariants: question.acceptVariants,
      explanationEn: question.explanationEn,
      explanationVi: question.explanationVi,
      modelAnswer: question.modelAnswer,
      examinerNotes: question.examinerNotes ?? {},
    });
    const response = firstCorrectAnswer(normalized.correctAnswer);
    const score = scoreObjectiveAnswer(
      {
        question_type: normalized.questionType,
        max_points: normalized.maxPoints,
        word_limit: normalized.wordLimit,
      },
      {
        correct_answer: normalized.correctAnswer,
        accept_variants: normalized.acceptVariants,
      },
      response,
    );
    if (!score.isCorrect || score.awardedPoints !== score.maxPoints) {
      desyncs.push(
        `${question.importId}: expected full credit, got ${score.awardedPoints}/${score.maxPoints}`,
      );
    }
  }
  return desyncs;
}

function validateCounts(mock: GeneralTrainingMock): string[] {
  const issues: string[] = [];
  const listening = mock.questions.filter((q) => q.skill === "listening" && qTypeIsObjective(q));
  const reading = mock.questions.filter((q) => q.skill === "reading" && qTypeIsObjective(q));
  const writing = mock.questions.filter((q) => q.skill === "writing");
  const speaking = mock.questions.filter((q) => q.skill === "speaking");
  if (listening.length !== 40) issues.push(`listening item count ${listening.length} != 40`);
  if (reading.length !== 40) issues.push(`reading item count ${reading.length} != 40`);
  if (writing.length !== 2) issues.push(`writing prompt count ${writing.length} != 2`);
  if (speaking.length !== 3) issues.push(`speaking prompt count ${speaking.length} != 3`);

  for (const [skill, rows] of [
    ["listening", listening],
    ["reading", reading],
  ] as const) {
    const indexes = rows.map((q) => q.orderIndex).sort((a, b) => a - b);
    const expected = Array.from({ length: 40 }, (_, i) => i);
    if (indexes.join(",") !== expected.join(",")) {
      issues.push(`${skill} order indexes are not 0..39`);
    }
    const pointTotal = rows.reduce((sum, q) => sum + (q.maxPoints ?? 1), 0);
    if (pointTotal !== 40) issues.push(`${skill} point total ${pointTotal} != 40`);
  }

  const sectionCounts = new Map<number, number>();
  for (const passage of mock.passages) {
    const section = Number(passage.metadata?.readingSection);
    sectionCounts.set(section, (sectionCounts.get(section) ?? 0) + 1);
  }
  if ((sectionCounts.get(1) ?? 0) < 2) issues.push("GT Reading Section 1 needs 2-3 short texts");
  if ((sectionCounts.get(2) ?? 0) !== 2) issues.push("GT Reading Section 2 needs exactly 2 workplace texts");
  if ((sectionCounts.get(3) ?? 0) !== 1) issues.push("GT Reading Section 3 needs exactly 1 longer article");

  const typeSet = new Set(reading.map((q) => q.questionType));
  for (const required of [
    "true_false_notgiven",
    "matching_features",
    "matching_headings",
    "matching_information",
    "sentence_completion",
    "summary_completion",
    "mcq_single",
    "short_answer",
  ]) {
    if (!typeSet.has(required as (typeof IELTS_QUESTION_TYPES)[number])) {
      issues.push(`reading missing ${required}`);
    }
  }
  return issues;
}

function qaMarkdown(result: MockQaResult): string {
  const rows = result.objectiveRows
    .map((q) => {
      const answer =
        typeof q.correctAnswer === "object"
          ? JSON.stringify(q.correctAnswer)
          : String(q.correctAnswer ?? "");
      return `| ${q.importId} | ${q.skill} | ${q.questionType} | ${answer.replace(/\|/g, "/")} | ${supportParts(q.support).join(" / ").replace(/\|/g, "/")} |`;
    })
    .join("\n");
  return `# ${result.slug} QA Worksheet

- module: general_training
- status: in_qa
- sourceBook: Original Authoring
- band_conversion_key: ${GT_READING_BAND_CONVERSION_KEY}
- co-founder QA: HARD pass pending
- next gate: signoff -> publish -> listening-audio backfill
- listening items: ${result.listeningItems}
- reading items: ${result.readingItems}
- writing prompts: ${result.writingPrompts}
- speaking prompts: ${result.speakingPrompts}
- desyncs: ${result.desyncs.length}
- supportIssues: ${result.supportIssues.length}
- schemaIssues: ${result.schemaIssues.length}

## Objective Key Support

| item | skill | type | key | support |
|---|---|---|---|---|
${rows}
`;
}

function verifyMock(mock: GeneralTrainingMock): MockQaResult {
  const objectiveRows = mock.questions.filter(qTypeIsObjective);
  const schemaIssues = [
    ...validateTestContainer(mock),
    ...validateContentRows(mock),
    ...validateCounts(mock),
  ];
  return {
    slug: mock.slug,
    listeningItems: mock.questions.filter((q) => q.skill === "listening" && qTypeIsObjective(q)).length,
    readingItems: mock.questions.filter((q) => q.skill === "reading" && qTypeIsObjective(q)).length,
    writingPrompts: mock.questions.filter((q) => q.skill === "writing").length,
    speakingPrompts: mock.questions.filter((q) => q.skill === "speaking").length,
    desyncs: validateObjectiveKeys(mock),
    supportIssues: validateSupports(mock),
    schemaIssues,
    objectiveRows,
  };
}

function main(): void {
  const writeQa = process.argv.includes("--write-qa");
  const bandIssues = validateBandTable();
  const results = GENERAL_TRAINING_MOCKS.map(verifyMock);
  const totals = results.reduce(
    (acc, result) => ({
      desyncs: acc.desyncs + result.desyncs.length,
      supportIssues: acc.supportIssues + result.supportIssues.length,
      schemaIssues: acc.schemaIssues + result.schemaIssues.length,
    }),
    { desyncs: 0, supportIssues: 0, schemaIssues: bandIssues.length },
  );

  if (writeQa) {
    const qaDir = join(process.cwd(), "docs/ielts/qa");
    mkdirSync(qaDir, { recursive: true });
    for (const result of results) {
      writeFileSync(join(qaDir, `${result.slug}.md`), qaMarkdown(result));
    }
  }

  for (const issue of bandIssues) console.error(`band table: ${issue}`);
  for (const result of results) {
    for (const issue of result.schemaIssues) console.error(`${result.slug} schema: ${issue}`);
    for (const issue of result.supportIssues) console.error(`${result.slug} support: ${issue}`);
    for (const issue of result.desyncs) console.error(`${result.slug} desync: ${issue}`);
    console.log(
      `${result.slug}: L=${result.listeningItems} R=${result.readingItems} W=${result.writingPrompts} S=${result.speakingPrompts} desyncs=${result.desyncs.length} supportIssues=${result.supportIssues.length} schemaIssues=${result.schemaIssues.length}`,
    );
  }

  console.log(
    `TOTAL: desyncs=${totals.desyncs} supportIssues=${totals.supportIssues} schemaIssues=${totals.schemaIssues}`,
  );
  if (totals.desyncs > 0 || totals.supportIssues > 0 || totals.schemaIssues > 0) {
    process.exitCode = 1;
  }
}

main();
