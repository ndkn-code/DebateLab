import {
  buildKnowledgeIngestionPlan,
  ingestKnowledgePlan,
} from "@/lib/ai/knowledge/ingestion";
import {
  buildEnglishDebateCombinedDraftManifest,
  ENGLISH_DEBATE_COMBINED_DRAFT_VERSION,
} from "@/lib/ai/knowledge/english-debate-release-manifest";
import { parseKnowledgeDraftArgs } from "@/lib/ai/knowledge/release-cli";
import { createAdminClient } from "@/lib/supabase/admin";

async function main() {
  const args = parseKnowledgeDraftArgs(process.argv.slice(2), {
    minimumVersion: ENGLISH_DEBATE_COMBINED_DRAFT_VERSION,
    defaultVersion: ENGLISH_DEBATE_COMBINED_DRAFT_VERSION,
  });
  const plan = buildKnowledgeIngestionPlan(
    buildEnglishDebateCombinedDraftManifest(args.collectionVersion),
  );
  const result = await ingestKnowledgePlan({
    supabase: createAdminClient(),
    plan,
    embed: true,
    embeddingBatchSize: 20,
    embeddingBatchDelayMs: 31_000,
    embeddingBatchRetryAttempts: 2,
    embeddingBatchRetryDelayMs: 65_000,
    submittedBy: args.submittedBy,
  });
  process.stdout.write(
    `${JSON.stringify({ status: "draft_needs_independent_review_rights_and_video_verification", collection: "debate.en.competitive", version: args.collectionVersion, ...result }, null, 2)}\n`,
  );
}

main().catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
});
