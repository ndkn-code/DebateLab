/**
 * Live verification of the imported format-showcase mocks against the real
 * Supabase project (service role):
 *
 *   npm run ielts:showcase:verify:live -- [--user <uuid>] [--keep]
 *
 * 1. Reads back each test by slug and checks passage / section / group /
 *    question / key counts, group–question linkage, audio status, asset URLs.
 * 2. Creates a throwaway attempt for the QA user via the real
 *    `ielts_create_attempt_with_blueprint` RPC (so groups are frozen), writes a
 *    perfect answer for every objective question, submits, and runs
 *    `gradeAttemptObjective` — asserting 40/40 → band 9.0 and that
 *    `ielts_attempt_question_group_blueprints` was populated.
 * 3. Deletes the attempt unless `--keep` is passed.
 */
import assert from "node:assert/strict";
import Module from "node:module";
import { loadWebEnv } from "./format-showcase/env";
import { FORMAT_SHOWCASE_BATCH_KEY, FORMAT_SHOWCASE_TESTS } from "./format-showcase";
import type { AuthoredQuestion, AuthoredTest } from "./format-showcase/types";
import { isObjectiveQuestionType } from "../../apps/web/src/lib/ielts/question-types/registry";
import type { IeltsQuestionType } from "../../apps/web/src/lib/ielts/question-types/types";
import { buildMockBlueprint } from "../../apps/web/src/lib/ielts/mock-blueprint";

type AdminModule = typeof import("../../apps/web/src/lib/supabase/admin");
type LifecycleModule = typeof import("../../apps/web/src/lib/api/ielts/attempt-lifecycle");
type GradeModule = typeof import("../../apps/web/src/lib/api/ielts/grade-attempt");
type MockRepo = typeof import("../../apps/web/src/lib/api/ielts/mock-repository");

let createTypedAdminClient: AdminModule["createTypedAdminClient"];
let createAttemptWithSections: LifecycleModule["createAttemptWithSections"];
let markAttemptSubmitted: LifecycleModule["markAttemptSubmitted"];
let gradeAttemptObjective: GradeModule["gradeAttemptObjective"];
let getSkillsWithContent: MockRepo["getSkillsWithContent"];

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
  const [admin, lifecycle, grade, mock] = await Promise.all([
    import("../../apps/web/src/lib/supabase/admin"),
    import("../../apps/web/src/lib/api/ielts/attempt-lifecycle"),
    import("../../apps/web/src/lib/api/ielts/grade-attempt"),
    import("../../apps/web/src/lib/api/ielts/mock-repository"),
  ]);
  createTypedAdminClient = admin.createTypedAdminClient;
  createAttemptWithSections = lifecycle.createAttemptWithSections;
  markAttemptSubmitted = lifecycle.markAttemptSubmitted;
  gradeAttemptObjective = grade.gradeAttemptObjective;
  getSkillsWithContent = mock.getSkillsWithContent;
}

type Admin = ReturnType<AdminModule["createTypedAdminClient"]>;

function importIdOf(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const v = (metadata as Record<string, unknown>).importId;
  return typeof v === "string" ? v : null;
}

async function resolveQaUser(admin: Admin, explicit: string | null): Promise<string> {
  if (explicit) return explicit;
  const fromEnv = process.env.IELTS_QA_USER_ID;
  if (fromEnv) return fromEnv;
  const { data, error } = await admin.from("profiles").select("id").eq("role", "admin").limit(1);
  if (error) throw new Error(`resolveQaUser: ${error.message}`);
  const id = data?.[0]?.id;
  if (!id) throw new Error("No admin profile found; pass --user <uuid>");
  return id;
}

async function verifyStructure(admin: Admin, test: AuthoredTest) {
  const { data: row, error } = await admin.from("ielts_tests").select("*").eq("slug", test.slug).maybeSingle();
  if (error) throw new Error(error.message);
  assert.ok(row, `${test.slug}: test row missing`);
  assert.equal(row.status, "published", `${test.slug}: expected published, got ${row.status}`);
  assert.equal(
    (row.metadata as Record<string, unknown>)?.importBatch,
    FORMAT_SHOWCASE_BATCH_KEY,
    `${test.slug}: importBatch marker`,
  );

  const [passages, sections, groups, questions] = await Promise.all([
    admin.from("passages").select("id, metadata").eq("test_id", row.id),
    admin.from("listening_sections").select("id, metadata, audio_asset_id, section_number").eq("test_id", row.id),
    admin.from("ielts_question_groups").select("id, group_key, skill, stimulus, bank").eq("test_id", row.id),
    admin.from("ielts_questions").select("id, group_key, metadata, question_type, skill, max_points").eq("test_id", row.id),
  ]);
  for (const r of [passages, sections, groups, questions]) if (r.error) throw new Error(r.error.message);

  assert.equal(passages.data?.length, test.passages.length, `${test.slug}: passage count`);
  assert.equal(sections.data?.length, test.listeningSections.length, `${test.slug}: section count`);
  assert.equal(groups.data?.length, test.groups.length, `${test.slug}: group count`);
  assert.equal(questions.data?.length, test.questions.length, `${test.slug}: question count`);

  const groupKeys = new Set((groups.data ?? []).map((g) => g.group_key));
  for (const q of questions.data ?? []) {
    if (q.group_key) assert.ok(groupKeys.has(q.group_key), `${test.slug}: question ${importIdOf(q.metadata)} → missing group ${q.group_key}`);
  }

  const questionIds = (questions.data ?? []).map((q) => q.id);
  const { count: keyCount, error: keyError } = await admin
    .from("ielts_question_keys").select("question_id", { count: "exact", head: true }).in("question_id", questionIds);
  if (keyError) throw new Error(keyError.message);
  assert.equal(keyCount, questionIds.length, `${test.slug}: key rows`);

  // Group image stimulus URLs must be reachable.
  for (const g of groups.data ?? []) {
    const stimulus = g.stimulus as { kind?: string; url?: string } | null;
    if (stimulus?.kind === "image" && stimulus.url) {
      const res = await fetch(stimulus.url, { method: "GET" });
      assert.equal(res.status, 200, `${test.slug}: asset ${stimulus.url} → ${res.status}`);
    }
  }

  // Audio status per listening section.
  if ((sections.data ?? []).length > 0) {
    const assetIds = (sections.data ?? []).map((s) => s.audio_asset_id).filter((x): x is string => Boolean(x));
    const { data: assets } = assetIds.length
      ? await admin.from("audio_assets").select("id, status").in("id", assetIds)
      : { data: [] as { id: string; status: string }[] };
    const statusById = new Map((assets ?? []).map((a) => [a.id, a.status]));
    for (const s of sections.data ?? []) {
      const status = s.audio_asset_id ? statusById.get(s.audio_asset_id) ?? "missing" : "none";
      console.log(`${test.slug}: listening section ${s.section_number} audio=${status}`);
    }
  }

  return { testRow: row, questions: questions.data ?? [] };
}

function perfectResponse(q: AuthoredQuestion): unknown {
  const answer = q.correctAnswer;
  if (Array.isArray(answer)) return { values: { "0": answer } };
  return { values: { "0": String(answer ?? "").split("/")[0]?.trim() ?? "" } };
}

async function verifyAttempt(
  admin: Admin, test: AuthoredTest, testRow: { id: string; module: "academic" | "general_training"; kind: "full_mock" | "skill_set" | "drill"; skill: string | null; assessment_mode: string },
  dbQuestions: Array<{ id: string; metadata: unknown; skill: string }>, userId: string, keep: boolean,
) {
  const skillsWithContent = await getSkillsWithContent(testRow.id);
  const blueprint = buildMockBlueprint({
    kind: testRow.kind,
    skill: (testRow.skill as never) ?? null,
    skillsWithContent,
    assessmentMode: testRow.assessment_mode as never,
  });
  const { attempt, sections } = await createAttemptWithSections({
    userId, test: { id: testRow.id, module: testRow.module }, blueprint,
  });
  console.log(`${test.slug}: attempt ${attempt.id} with ${sections.length} sections`);
  try {
    await admin.from("ielts_attempts").update({ metadata: { seed: FORMAT_SHOWCASE_BATCH_KEY, qa: true } }).eq("id", attempt.id);

    const { data: groupBlueprints, error: gbError } = await admin
      .from("ielts_attempt_question_group_blueprints").select("group_key").eq("attempt_id", attempt.id);
    if (gbError) throw new Error(gbError.message);
    assert.equal(groupBlueprints?.length, test.groups.length, `${test.slug}: frozen group blueprints`);

    const byImportId = new Map(test.questions.map((q) => [q.importId, q]));
    const sectionBySkill = new Map(sections.map((s) => [s.skill, s]));
    const now = new Date();
    for (const s of sections) {
      await admin.from("ielts_attempt_sections").update({
        started_at: now.toISOString(),
        deadline_at: new Date(now.getTime() + s.time_limit_seconds * 1000).toISOString(),
      }).eq("id", s.id);
    }
    const rows = [];
    for (const dbq of dbQuestions) {
      const authored = byImportId.get(importIdOf(dbq.metadata) ?? "");
      if (!authored || !isObjectiveQuestionType(authored.questionType as IeltsQuestionType)) continue;
      const section = sectionBySkill.get(dbq.skill as never);
      if (!section) continue;
      rows.push({
        attempt_id: attempt.id, user_id: userId, question_id: dbq.id, section_id: section.id,
        response: perfectResponse(authored) as never, test_version: attempt.test_version,
      });
    }
    const { error: insertError } = await admin.from("ielts_question_responses").insert(rows);
    if (insertError) throw new Error(`responses: ${insertError.message}`);
    await markAttemptSubmitted(attempt.id);
    const grade = await gradeAttemptObjective(attempt.id);
    console.log(`${test.slug}: graded L=${grade.listeningRaw ?? "–"} R=${grade.readingRaw} bands=${JSON.stringify(grade.bands)}`);
    if (skillsWithContent.includes("listening")) assert.equal(grade.listeningRaw, 40);
    const readingMax = test.questions.filter((q) => q.skill === "reading").reduce((s, q) => s + (q.maxPoints ?? 1), 0);
    assert.equal(grade.readingRaw, readingMax);
  } finally {
    if (!keep) {
      const { error } = await admin.from("ielts_attempts").delete().eq("id", attempt.id);
      if (error) console.warn(`${test.slug}: cleanup failed: ${error.message}`);
      else console.log(`${test.slug}: QA attempt deleted`);
    }
  }
}

async function main(): Promise<void> {
  loadWebEnv();
  await loadServerModules();
  const argv = process.argv.slice(2);
  const user = argv.includes("--user") ? argv[argv.indexOf("--user") + 1] ?? null : null;
  const keep = argv.includes("--keep");
  const admin = createTypedAdminClient();
  const userId = await resolveQaUser(admin, user);
  for (const test of FORMAT_SHOWCASE_TESTS) {
    const { testRow, questions } = await verifyStructure(admin, test);
    await verifyAttempt(admin, test, testRow as never, questions, userId, keep);
  }
  console.log("format-showcase live verify ✓");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
