import { z } from "zod";

import {
  buildIeltsMockKnowledgeRecords,
  buildOfficialIeltsKnowledgeRecords,
  type IeltsKnowledgeQuestionRow,
} from "@/lib/ai/knowledge/ielts-release-corpus";
import {
  buildKnowledgeIngestionPlan,
  ingestKnowledgePlan,
} from "@/lib/ai/knowledge/ingestion";
import { createAdminClient } from "@/lib/supabase/admin";

const ArgsSchema = z.object({
  collectionVersion: z.number().int().min(4),
});

function readArgs(argv: string[]) {
  const versionIndex = argv.indexOf("--collection-version");
  const rawVersion = versionIndex >= 0 ? argv[versionIndex + 1] : "4";
  return ArgsSchema.parse({ collectionVersion: Number(rawVersion) });
}

async function main() {
  const args = readArgs(process.argv.slice(2));
  const client = createAdminClient();
  // This projection intentionally cannot read answer keys, explanations,
  // learner responses, teacher feedback, or protected benchmark labels.
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
  const rows = (questions.data ?? []) as unknown as IeltsKnowledgeQuestionRow[];
  const results = [];
  for (const collection of ["ielts.writing", "ielts.speaking"] as const) {
    const mocks = buildIeltsMockKnowledgeRecords({ rows, collection });
    const official = buildOfficialIeltsKnowledgeRecords(collection);
    if (!mocks.items.length || !official.items.length) {
      throw new Error(`ielts_release_knowledge_empty:${collection}`);
    }
    const plan = buildKnowledgeIngestionPlan({
      collection,
      collectionVersion: args.collectionVersion,
      sources: [...mocks.sources, ...official.sources],
      items: [...mocks.items, ...official.items],
    });
    const result = await ingestKnowledgePlan({
      supabase: client,
      plan,
      embed: true,
      // Unfunded Voyage accounts currently allow 3 RPM / 10K TPM. Keep each
      // request small and spaced so this review import is reliable without
      // changing learner-facing runtime latency.
      embeddingBatchSize: 20,
      embeddingBatchDelayMs: 31_000,
      embeddingBatchRetryAttempts: 2,
      embeddingBatchRetryDelayMs: 65_000,
      submittedBy: null,
    });
    results.push({
      collection,
      mockItemCount: mocks.items.length,
      officialCandidateItemCount: official.items.length,
      ...result,
    });
  }
  process.stdout.write(
    `${JSON.stringify({ status: "draft_needs_independent_review_and_rights_clearance", results }, null, 2)}\n`,
  );
}

main().catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
});
