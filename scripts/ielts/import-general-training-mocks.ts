import Module from "node:module";
import type { IeltsDbClient } from "../../apps/web/src/lib/api/ielts/client";
import type { IeltsTest } from "../../apps/web/src/lib/api/ielts/tests-repository";
import {
  GENERAL_TRAINING_MOCKS,
  GT_BATCH_KEY,
  GT_READING_BAND_CONVERSION_KEY,
  GT_READING_BAND_ROWS,
  type AuthoredListeningSection,
  type AuthoredPassage,
  type AuthoredQuestion,
  type GeneralTrainingMock,
} from "./general-training-mocks-01-04";

type EntityTable = "passages" | "listening_sections" | "ielts_questions";
type AdminModule = typeof import("../../apps/web/src/lib/supabase/admin");
type BandRepository = typeof import("../../apps/web/src/lib/api/ielts/band-conversions-repository");
type TestsRepository = typeof import("../../apps/web/src/lib/api/ielts/tests-repository");
type PassagesRepository = typeof import("../../apps/web/src/lib/api/ielts/passages-repository");
type ListeningRepository = typeof import("../../apps/web/src/lib/api/ielts/listening-repository");
type QuestionsRepository = typeof import("../../apps/web/src/lib/api/ielts/questions-repository");

let createTypedAdminClient: AdminModule["createTypedAdminClient"];
let createBandConversion: BandRepository["createBandConversion"];
let listBandConversions: BandRepository["listBandConversions"];
let createIeltsTest: TestsRepository["createIeltsTest"];
let getIeltsTestBySlug: TestsRepository["getIeltsTestBySlug"];
let transitionIeltsTestStatus: TestsRepository["transitionIeltsTestStatus"];
let updateIeltsTest: TestsRepository["updateIeltsTest"];
let createPassage: PassagesRepository["createPassage"];
let createListeningSection: ListeningRepository["createListeningSection"];
let createQuestion: QuestionsRepository["createQuestion"];

interface ImportSummary {
  slug: string;
  testId: string;
  created: { passages: number; listeningSections: number; questions: number };
  skipped: { passages: number; listeningSections: number; questions: number };
  warnings: string[];
}

function installServerOnlyStub(): void {
  const require = Module.createRequire(import.meta.url);
  const serverOnlyPath = require.resolve("server-only");
  require.cache[serverOnlyPath] = {
    id: serverOnlyPath,
    filename: serverOnlyPath,
    loaded: true,
    exports: {},
    children: [],
    paths: [],
    isPreloading: false,
    parent: null,
    path: "",
    require,
  } as NodeJS.Module;
}

async function loadServerModules(): Promise<void> {
  installServerOnlyStub();
  const [admin, bands, tests, passages, listening, questions] = await Promise.all([
    import("../../apps/web/src/lib/supabase/admin"),
    import("../../apps/web/src/lib/api/ielts/band-conversions-repository"),
    import("../../apps/web/src/lib/api/ielts/tests-repository"),
    import("../../apps/web/src/lib/api/ielts/passages-repository"),
    import("../../apps/web/src/lib/api/ielts/listening-repository"),
    import("../../apps/web/src/lib/api/ielts/questions-repository"),
  ]);
  createTypedAdminClient = admin.createTypedAdminClient;
  createBandConversion = bands.createBandConversion;
  listBandConversions = bands.listBandConversions;
  createIeltsTest = tests.createIeltsTest;
  getIeltsTestBySlug = tests.getIeltsTestBySlug;
  transitionIeltsTestStatus = tests.transitionIeltsTestStatus;
  updateIeltsTest = tests.updateIeltsTest;
  createPassage = passages.createPassage;
  createListeningSection = listening.createListeningSection;
  createQuestion = questions.createQuestion;
}

function metadataForTest(mock: GeneralTrainingMock) {
  return {
    band_conversion_key: GT_READING_BAND_CONVERSION_KEY,
    importBatch: GT_BATCH_KEY,
    module: "general_training",
    listeningAudioStatus: "pending_backfill",
    provenance: {
      sourceBook: "Original Authoring",
      sourceTest: mock.slug,
      transformationSummary:
        "None. This mock was authored as original IELTS General Training practice content.",
    },
  };
}

async function ensureGtReadingBandTable(client: IeltsDbClient): Promise<string> {
  const rows = await listBandConversions(GT_READING_BAND_CONVERSION_KEY, client);
  const existing = rows.filter(
    (row) => row.skill === "reading" && row.module === "general_training",
  );
  const existingBands = new Set(existing.map((row) => Number(row.band)));
  const missing = GT_READING_BAND_ROWS.filter((row) => !existingBands.has(row.band));
  if (missing.length === 0) return "existing";

  for (const row of missing) {
    await createBandConversion(
      {
        conversionKey: GT_READING_BAND_CONVERSION_KEY,
        skill: "reading",
        module: "general_training",
        rawMin: row.rawMin,
        rawMax: row.rawMax,
        band: row.band,
      },
      client,
    );
  }
  return existing.length === 0 ? "created" : "completed";
}

async function ensureTest(
  mock: GeneralTrainingMock,
  client: IeltsDbClient,
): Promise<IeltsTest> {
  const existing = await getIeltsTestBySlug(mock.slug, client);
  const input = {
    slug: mock.slug,
    title: mock.title,
    kind: "full_mock" as const,
    module: "general_training" as const,
    status: "in_qa" as const,
    timeLimitSeconds: 10800,
    description: mock.description,
    metadata: metadataForTest(mock),
  };
  if (!existing) return createIeltsTest(input, {}, client);

  return updateIeltsTest(
    existing.id,
    {
      title: mock.title,
      kind: "full_mock",
      module: "general_training",
      timeLimitSeconds: 10800,
      description: mock.description,
      metadata: metadataForTest(mock),
    },
    client,
  );
}

function importIdFromMetadata(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const value = (metadata as Record<string, unknown>).importId;
  return typeof value === "string" && value ? value : null;
}

async function loadImportMap(
  table: EntityTable,
  testId: string,
  client: IeltsDbClient,
): Promise<Map<string, string>> {
  const { data, error } = await client
    .from(table)
    .select("id, metadata")
    .eq("test_id", testId);
  if (error) throw new Error(`loadImportMap(${table}) failed: ${error.message}`);
  const map = new Map<string, string>();
  for (const row of data ?? []) {
    const importId = importIdFromMetadata(row.metadata);
    if (importId) map.set(importId, row.id);
  }
  return map;
}

async function importPassages(
  rows: AuthoredPassage[],
  testId: string,
  client: IeltsDbClient,
): Promise<{ map: Map<string, string>; created: number; skipped: number }> {
  const map = await loadImportMap("passages", testId, client);
  let created = 0;
  let skipped = 0;
  for (const row of rows) {
    if (map.has(row.importId)) {
      skipped++;
      continue;
    }
    const inserted = await createPassage({ testId, ...row }, client);
    map.set(row.importId, inserted.id);
    created++;
  }
  return { map, created, skipped };
}

async function importListeningSections(
  rows: AuthoredListeningSection[],
  testId: string,
  client: IeltsDbClient,
): Promise<{ map: Map<string, string>; created: number; skipped: number }> {
  const map = await loadImportMap("listening_sections", testId, client);
  let created = 0;
  let skipped = 0;
  for (const row of rows) {
    if (map.has(row.importId)) {
      skipped++;
      continue;
    }
    const inserted = await createListeningSection({ testId, ...row }, client);
    map.set(row.importId, inserted.id);
    created++;
  }
  return { map, created, skipped };
}

function linkedId(
  map: Map<string, string>,
  importId: string | undefined,
  entity: string,
  question: AuthoredQuestion,
): string | null {
  if (!importId) return null;
  const id = map.get(importId);
  if (!id) {
    throw new Error(`${question.importId}: missing ${entity} importId ${importId}`);
  }
  return id;
}

async function importQuestions(
  rows: AuthoredQuestion[],
  testId: string,
  passageMap: Map<string, string>,
  sectionMap: Map<string, string>,
  client: IeltsDbClient,
): Promise<{ created: number; skipped: number }> {
  const existing = await loadImportMap("ielts_questions", testId, client);
  let created = 0;
  let skipped = 0;
  for (const row of rows) {
    if (existing.has(row.importId)) {
      skipped++;
      continue;
    }
    await createQuestion(
      {
        testId,
        skill: row.skill,
        questionType: row.questionType,
        prompt: row.prompt,
        orderIndex: row.orderIndex,
        passageId: linkedId(passageMap, row.passageImportId, "passage", row),
        listeningSectionId: linkedId(sectionMap, row.sectionImportId, "listening section", row),
        groupKey: row.groupKey,
        groupInstructions: row.groupInstructions,
        options: row.options,
        maxPoints: row.maxPoints ?? 1,
        wordLimit: row.wordLimit,
        metadata: row.metadata ?? {},
        correctAnswer: row.correctAnswer,
        acceptVariants: row.acceptVariants,
        explanationEn: row.explanationEn,
        explanationVi: row.explanationVi,
        modelAnswer: row.modelAnswer,
        examinerNotes: row.examinerNotes ?? {},
      },
      client,
    );
    created++;
  }
  return { created, skipped };
}

async function importMock(
  mock: GeneralTrainingMock,
  client: IeltsDbClient,
): Promise<ImportSummary> {
  const test = await ensureTest(mock, client);
  const warnings: string[] = [];
  const passages = await importPassages(mock.passages, test.id, client);
  const sections = await importListeningSections(mock.listeningSections, test.id, client);
  const questions = await importQuestions(
    mock.questions,
    test.id,
    passages.map,
    sections.map,
    client,
  );

  if (test.status === "draft") {
    await transitionIeltsTestStatus(test.id, "in_qa", { note: "Original GT batch imported" }, client);
  } else if (test.status !== "in_qa") {
    warnings.push(`existing test status is ${test.status}; content was not moved back to in_qa`);
  }

  return {
    slug: mock.slug,
    testId: test.id,
    created: {
      passages: passages.created,
      listeningSections: sections.created,
      questions: questions.created,
    },
    skipped: {
      passages: passages.skipped,
      listeningSections: sections.skipped,
      questions: questions.skipped,
    },
    warnings,
  };
}

async function main(): Promise<void> {
  await loadServerModules();
  const client = createTypedAdminClient();
  const bandStatus = await ensureGtReadingBandTable(client);
  console.log(`GT reading band conversion table: ${bandStatus}`);

  for (const mock of GENERAL_TRAINING_MOCKS) {
    const summary = await importMock(mock, client);
    console.log(
      `${summary.slug}: test=${summary.testId} created=${JSON.stringify(summary.created)} skipped=${JSON.stringify(summary.skipped)}`,
    );
    for (const warning of summary.warnings) {
      console.warn(`${summary.slug}: ${warning}`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
