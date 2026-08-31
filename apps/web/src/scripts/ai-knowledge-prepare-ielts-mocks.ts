import { z } from "zod";

import {
  buildKnowledgeIngestionPlan,
  ingestKnowledgePlan,
  type KnowledgeManifestItemInput,
  type KnowledgeSourceInput,
} from "@/lib/ai/knowledge/ingestion";
import type { KnowledgeCollectionKey } from "@/lib/ai/knowledge/collections";
import { createAdminClient } from "@/lib/supabase/admin";

const ArgsSchema = z.object({
  collectionVersion: z.number().int().min(2),
});

type QuestionRow = {
  id: string;
  skill: "writing" | "speaking";
  question_type: string;
  prompt: string;
  metadata: Record<string, unknown> | null;
  ielts_tests:
    | { slug: string; title: string; status: string }
    | Array<{ slug: string; title: string; status: string }>;
};

function readArgs(argv: string[]) {
  const versionIndex = argv.indexOf("--collection-version");
  const rawVersion = versionIndex >= 0 ? argv[versionIndex + 1] : "2";
  return ArgsSchema.parse({ collectionVersion: Number(rawVersion) });
}

function strings(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function testRecord(row: QuestionRow) {
  return Array.isArray(row.ielts_tests) ? row.ielts_tests[0] : row.ielts_tests;
}

function collectionFor(skill: QuestionRow["skill"]): KnowledgeCollectionKey {
  return skill === "writing" ? "ielts.writing" : "ielts.speaking";
}

async function prepareCollection(params: {
  rows: QuestionRow[];
  collection: KnowledgeCollectionKey;
  collectionVersion: number;
}) {
  const rows = params.rows.filter(
    (row) => collectionFor(row.skill) === params.collection,
  );
  const sourcesByUrl = new Map<string, KnowledgeSourceInput>();
  const items: KnowledgeManifestItemInput[] = [];

  for (const row of rows) {
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
    const criteria = strings(metadata.coach_criteria);
    for (const criterion of criteria) {
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
          subskillTags: strings(metadata.subskill_tags),
        },
      });
    }
  }
  if (!items.length || !sourcesByUrl.size) {
    throw new Error(`ielts_mock_knowledge_empty:${params.collection}`);
  }
  const plan = buildKnowledgeIngestionPlan({
    collection: params.collection,
    collectionVersion: params.collectionVersion,
    sources: [...sourcesByUrl.values()],
    items,
  });
  const result = await ingestKnowledgePlan({
    supabase: createAdminClient(),
    plan,
    embed: true,
    submittedBy: null,
  });
  return { collection: params.collection, ...result };
}

async function main() {
  const args = readArgs(process.argv.slice(2));
  const client = createAdminClient();
  // This projection intentionally cannot read answer keys, explanations,
  // learner responses, or teacher material.
  const questions = await client
    .from("ielts_questions")
    .select(
      "id, skill, question_type, prompt, metadata, ielts_tests!inner(slug, title, status)",
    )
    .in("skill", ["writing", "speaking"])
    .eq("ielts_tests.status", "published")
    .contains("metadata", { coach_recommendable: true })
    .order("order_index", { ascending: true });
  if (questions.error) throw new Error(questions.error.message);
  const rows = (questions.data ?? []) as unknown as QuestionRow[];
  const results = [];
  for (const collection of [
    "ielts.writing",
    "ielts.speaking",
  ] as const) {
    results.push(
      await prepareCollection({
        rows,
        collection,
        collectionVersion: args.collectionVersion,
      }),
    );
  }
  process.stdout.write(
    `${JSON.stringify({ status: "draft_needs_independent_review", results }, null, 2)}\n`,
  );
}

main().catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
});
