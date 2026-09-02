/**
 * Import the format-showcase mocks into the live Supabase project.
 *
 *   npm run ielts:showcase:import -- [--publish] [--skip-tts] [--force-update] [--only <slug>]
 *
 * Idempotent: the test is upserted by slug, media by fixed object path,
 * groups by (test_id, group_key), and passages / sections / questions by
 * `metadata.importId`. `--force-update` re-applies existing questions through
 * `updateQuestion` so key fixes land without deleting rows.
 *
 * Cleanup (run through the Supabase MCP if the batch must be removed):
 *   delete from public.ielts_attempts where metadata->>'seed' = 'format-showcase-v1';
 *   delete from public.ielts_tests where metadata->>'importBatch' = 'format-showcase-v1';
 *   -- then remove storage objects under ielts-question-media/format-showcase/
 */
import Module from "node:module";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { IeltsDbClient } from "../../apps/web/src/lib/api/ielts/client";
import type { IeltsTest } from "../../apps/web/src/lib/api/ielts/tests-repository";
import { loadWebEnv } from "./format-showcase/env";
import { FORMAT_SHOWCASE_BATCH_KEY, FORMAT_SHOWCASE_TESTS } from "./format-showcase";
import type {
  AuthoredBankOption,
  AuthoredGroup,
  AuthoredQuestion,
  AuthoredTest,
  AuthoredVisual,
} from "./format-showcase/types";

type EntityTable = "passages" | "listening_sections" | "ielts_questions";
type AdminModule = typeof import("../../apps/web/src/lib/supabase/admin");
type TestsRepository = typeof import("../../apps/web/src/lib/api/ielts/tests-repository");
type PassagesRepository = typeof import("../../apps/web/src/lib/api/ielts/passages-repository");
type ListeningRepository = typeof import("../../apps/web/src/lib/api/ielts/listening-repository");
type QuestionsRepository = typeof import("../../apps/web/src/lib/api/ielts/questions-repository");
type GroupsRepository = typeof import("../../apps/web/src/lib/api/ielts/question-groups-repository");
type MediaModule = typeof import("../../apps/web/src/lib/ielts/question-media/upload");
type BackfillModule = typeof import("../../apps/web/src/lib/ielts/listening-audio/backfill");

let createTypedAdminClient: AdminModule["createTypedAdminClient"];
let createIeltsTest: TestsRepository["createIeltsTest"];
let getIeltsTestBySlug: TestsRepository["getIeltsTestBySlug"];
let transitionIeltsTestStatus: TestsRepository["transitionIeltsTestStatus"];
let updateIeltsTest: TestsRepository["updateIeltsTest"];
let createPassage: PassagesRepository["createPassage"];
let createListeningSection: ListeningRepository["createListeningSection"];
let createQuestion: QuestionsRepository["createQuestion"];
let updateQuestion: QuestionsRepository["updateQuestion"];
let upsertQuestionGroupByKey: GroupsRepository["upsertQuestionGroupByKey"];
let uploadQuestionMedia: MediaModule["uploadQuestionMedia"];
let backfillListeningSectionAudio: BackfillModule["backfillListeningSectionAudio"];

const ASSETS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "format-showcase/assets");

interface Flags { publish: boolean; skipTts: boolean; forceUpdate: boolean; only: string | null }

function parseFlags(argv: string[]): Flags {
  const only = argv.includes("--only") ? argv[argv.indexOf("--only") + 1] ?? null : null;
  return {
    publish: argv.includes("--publish"),
    skipTts: argv.includes("--skip-tts"),
    forceUpdate: argv.includes("--force-update"),
    only,
  };
}

function installServerOnlyStub(): void {
  const require = Module.createRequire(import.meta.url);
  const serverOnlyPath = require.resolve("server-only");
  require.cache[serverOnlyPath] = {
    id: serverOnlyPath, filename: serverOnlyPath, loaded: true, exports: {}, children: [],
    paths: [], isPreloading: false, parent: null, path: "", require,
  } as NodeJS.Module;
}

async function loadServerModules(): Promise<void> {
  installServerOnlyStub();
  const [admin, tests, passages, listening, questions, groups, media, backfill] = await Promise.all([
    import("../../apps/web/src/lib/supabase/admin"),
    import("../../apps/web/src/lib/api/ielts/tests-repository"),
    import("../../apps/web/src/lib/api/ielts/passages-repository"),
    import("../../apps/web/src/lib/api/ielts/listening-repository"),
    import("../../apps/web/src/lib/api/ielts/questions-repository"),
    import("../../apps/web/src/lib/api/ielts/question-groups-repository"),
    import("../../apps/web/src/lib/ielts/question-media/upload"),
    import("../../apps/web/src/lib/ielts/listening-audio/backfill"),
  ]);
  createTypedAdminClient = admin.createTypedAdminClient;
  createIeltsTest = tests.createIeltsTest;
  getIeltsTestBySlug = tests.getIeltsTestBySlug;
  transitionIeltsTestStatus = tests.transitionIeltsTestStatus;
  updateIeltsTest = tests.updateIeltsTest;
  createPassage = passages.createPassage;
  createListeningSection = listening.createListeningSection;
  createQuestion = questions.createQuestion;
  updateQuestion = questions.updateQuestion;
  upsertQuestionGroupByKey = groups.upsertQuestionGroupByKey;
  uploadQuestionMedia = media.uploadQuestionMedia;
  backfillListeningSectionAudio = backfill.backfillListeningSectionAudio;
}

function metadataForTest(test: AuthoredTest) {
  return {
    band_conversion_key: test.bandConversionKey,
    importBatch: FORMAT_SHOWCASE_BATCH_KEY,
    seed: FORMAT_SHOWCASE_BATCH_KEY,
    module: test.module,
    listeningAudioStatus: "pending_backfill",
    provenance: {
      sourceBook: "Original Authoring",
      sourceTest: test.slug,
      transformationSummary:
        "None. Authored as an original format showcase covering every official IELTS question type.",
    },
  };
}

async function ensureTest(test: AuthoredTest, client: IeltsDbClient): Promise<IeltsTest> {
  const existing = await getIeltsTestBySlug(test.slug, client);
  const input = {
    slug: test.slug, title: test.title, kind: test.kind, module: test.module,
    status: "in_qa" as const, timeLimitSeconds: test.timeLimitSeconds,
    description: test.description, metadata: metadataForTest(test),
  };
  if (!existing) return createIeltsTest(input, {}, client);
  return updateIeltsTest(
    existing.id,
    { title: test.title, kind: test.kind, module: test.module, timeLimitSeconds: test.timeLimitSeconds,
      description: test.description, metadata: metadataForTest(test) },
    client,
  );
}

function importIdOf(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const value = (metadata as Record<string, unknown>).importId;
  return typeof value === "string" && value ? value : null;
}

async function loadImportMap(table: EntityTable, testId: string, client: IeltsDbClient) {
  const { data, error } = await client.from(table).select("id, metadata").eq("test_id", testId);
  if (error) throw new Error(`loadImportMap(${table}) failed: ${error.message}`);
  const map = new Map<string, string>();
  for (const row of data ?? []) {
    const id = importIdOf(row.metadata);
    if (id) map.set(id, row.id);
  }
  return map;
}

async function importPassages(test: AuthoredTest, testId: string, client: IeltsDbClient) {
  const map = await loadImportMap("passages", testId, client);
  let created = 0;
  for (const p of test.passages) {
    if (map.has(p.importId)) continue;
    const inserted = await createPassage(
      { testId, title: p.title, body: p.body, orderIndex: p.orderIndex, genre: p.genre,
        metadata: { importId: p.importId, importBatch: FORMAT_SHOWCASE_BATCH_KEY } },
      client,
    );
    map.set(p.importId, inserted.id);
    created++;
  }
  return { map, created };
}

async function importSections(test: AuthoredTest, testId: string, client: IeltsDbClient) {
  const map = await loadImportMap("listening_sections", testId, client);
  let created = 0;
  for (const s of test.listeningSections) {
    if (map.has(s.importId)) continue;
    const inserted = await createListeningSection(
      { testId, sectionNumber: s.sectionNumber, title: s.title, script: s.script,
        orderIndex: s.sectionNumber - 1, accent: s.accent, speakers: s.speakers,
        metadata: { importId: s.importId, importBatch: FORMAT_SHOWCASE_BATCH_KEY } },
      client,
    );
    map.set(s.importId, inserted.id);
    created++;
  }
  return { map, created };
}

async function importAssets(test: AuthoredTest, testId: string, client: IeltsDbClient) {
  const urls = new Map<string, string>();
  for (const asset of test.assets) {
    const bytes = readFileSync(path.join(ASSETS_DIR, asset.file));
    const result = await uploadQuestionMedia(client, {
      testId, bytes, contentType: asset.contentType, fileName: asset.file,
      objectPath: `format-showcase/${test.slug}/${asset.file}`,
    });
    urls.set(asset.importId, result.url);
  }
  return urls;
}

function bankInput(bank: AuthoredBankOption[] | undefined) {
  return (bank ?? []).map((o) => (typeof o === "string" ? o : { id: o.id, label: o.label, text: o.text }));
}

function linkedId(map: Map<string, string>, importId: string | undefined, what: string, owner: string) {
  if (!importId) return null;
  const id = map.get(importId);
  if (!id) throw new Error(`${owner}: missing ${what} importId ${importId}`);
  return id;
}

function groupStimulus(group: AuthoredGroup, assets: Map<string, string>) {
  const s = group.stimulus;
  if (!s) return null;
  if (s.kind !== "image") return s;
  const url = assets.get(s.assetImportId);
  if (!url) throw new Error(`${group.groupKey}: missing asset ${s.assetImportId}`);
  return { kind: "image" as const, url, alt: s.alt, caption: s.caption, hotspots: s.hotspots };
}

async function importGroups(
  test: AuthoredTest, testId: string, passages: Map<string, string>, sections: Map<string, string>,
  assets: Map<string, string>, client: IeltsDbClient,
) {
  let count = 0;
  for (const g of test.groups) {
    await upsertQuestionGroupByKey(
      {
        testId, skill: g.skill, groupKey: g.groupKey, orderIndex: g.orderIndex,
        passageId: linkedId(passages, g.passageImportId, "passage", g.groupKey),
        listeningSectionId: linkedId(sections, g.sectionImportId, "listening section", g.groupKey),
        title: g.title, instructions: g.instructions, stimulus: groupStimulus(g, assets),
        bank: bankInput(g.bank), bankReuse: g.bankReuse ?? false,
        answerMode: g.answerMode ?? null, anyOrder: g.anyOrder ?? false,
        metadata: { importId: g.importId, importBatch: FORMAT_SHOWCASE_BATCH_KEY },
      },
      client,
    );
    count++;
  }
  return count;
}

function visualInput(visual: AuthoredVisual | undefined, assets: Map<string, string>) {
  if (!visual) return null;
  if (visual.type !== "image") return visual;
  const url = assets.get(visual.assetImportId);
  if (!url) throw new Error(`missing asset ${visual.assetImportId}`);
  return { type: "image" as const, url, alt: visual.alt, caption: visual.caption };
}

function questionMetadata(q: AuthoredQuestion) {
  const meta: Record<string, unknown> = {
    importId: q.importId, importBatch: FORMAT_SHOWCASE_BATCH_KEY, origin: "original",
  };
  if (q.slot) meta.slot = q.slot;
  if (q.selectCount) meta.selectCount = q.selectCount;
  if (q.numberSpan) meta.numberSpan = q.numberSpan;
  if (q.allowNumber !== undefined) meta.allowNumber = q.allowNumber;
  if (q.cueCard) meta.cueCard = q.cueCard;
  if (q.letter) meta.letter = q.letter;
  return meta;
}

function questionInput(
  q: AuthoredQuestion, testId: string, passages: Map<string, string>, sections: Map<string, string>,
  assets: Map<string, string>,
) {
  return {
    testId, skill: q.skill, questionType: q.questionType, prompt: q.prompt, orderIndex: q.orderIndex,
    passageId: linkedId(passages, q.passageImportId, "passage", q.importId),
    listeningSectionId: linkedId(sections, q.sectionImportId, "listening section", q.importId),
    groupKey: q.groupKey ?? null, groupInstructions: q.groupInstructions ?? null,
    options: bankInput(q.options).map((o) => (typeof o === "string" ? o : o.text)),
    maxPoints: q.maxPoints ?? 1,
    // Objective word caps only; Writing minimums (150/250) come from the capture layer.
    wordLimit: q.skill === "writing" || q.skill === "speaking" ? null : (q.wordLimit ?? null),
    visual: visualInput(q.visual, assets), metadata: questionMetadata(q),
    correctAnswer: q.correctAnswer, acceptVariants: q.acceptVariants,
    explanationEn: q.explanationEn, explanationVi: q.explanationVi,
    modelAnswer: q.modelAnswer ?? null, examinerNotes: q.examinerNotes ?? {},
  };
}

async function importQuestions(
  test: AuthoredTest, testId: string, passages: Map<string, string>, sections: Map<string, string>,
  assets: Map<string, string>, flags: Flags, client: IeltsDbClient,
) {
  const existing = await loadImportMap("ielts_questions", testId, client);
  let created = 0;
  let updated = 0;
  const ordered = [...test.questions].sort((a, b) => a.orderIndex - b.orderIndex);
  for (const q of ordered) {
    const input = questionInput(q, testId, passages, sections, assets);
    const id = existing.get(q.importId);
    if (id) {
      if (flags.forceUpdate) { await updateQuestion({ ...input, questionId: id }, client); updated++; }
      continue;
    }
    await createQuestion(input, client);
    created++;
  }
  return { created, updated, skipped: ordered.length - created - updated };
}

async function importTest(test: AuthoredTest, flags: Flags, client: IeltsDbClient) {
  const row = await ensureTest(test, client);
  const passages = await importPassages(test, row.id, client);
  const sections = await importSections(test, row.id, client);
  const assets = await importAssets(test, row.id, client);
  const groups = await importGroups(test, row.id, passages.map, sections.map, assets, client);
  const questions = await importQuestions(test, row.id, passages.map, sections.map, assets, flags, client);
  console.log(
    `${test.slug}: test=${row.id} passages+${passages.created} sections+${sections.created} assets=${assets.size} groups=${groups} questions=${JSON.stringify(questions)}`,
  );

  if (!flags.skipTts && test.listeningSections.length > 0) {
    const summary = await backfillListeningSectionAudio({ testId: row.id, client });
    console.log(`${test.slug}: listening audio backfill ${JSON.stringify(summary)}`);
  }

  let status = (await getIeltsTestBySlug(test.slug, client))?.status ?? row.status;
  if (status === "draft") {
    status = (await transitionIeltsTestStatus(row.id, "in_qa", { note: "Format showcase imported" }, client)).status;
  }
  if (flags.publish) {
    if (status === "in_qa") {
      status = (await transitionIeltsTestStatus(row.id, "approved", { note: "Format showcase QA" }, client)).status;
    }
    if (status === "approved") {
      status = (await transitionIeltsTestStatus(row.id, "published", { note: "Format showcase published (admin-gated)" }, client)).status;
    }
  }
  console.log(`${test.slug}: status=${status}`);
}

async function main(): Promise<void> {
  loadWebEnv();
  const flags = parseFlags(process.argv.slice(2));
  await loadServerModules();
  const client = createTypedAdminClient();
  const tests = FORMAT_SHOWCASE_TESTS.filter((t) => !flags.only || t.slug === flags.only);
  if (tests.length === 0) throw new Error(`no test matches --only ${flags.only}`);
  for (const test of tests) await importTest(test, flags, client);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
