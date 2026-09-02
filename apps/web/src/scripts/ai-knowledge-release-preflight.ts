import "server-only";

import { z } from "zod";

import {
  summarizeKnowledgeReleasePreflight,
  type KnowledgeReleaseEmbedding,
  type KnowledgeReleaseItem,
  type KnowledgeReleaseSource,
} from "@/lib/ai/knowledge/release-preflight";
import { createAdminClient } from "@/lib/supabase/admin";

const ArgsSchema = z.object({
  collection: z.enum([
    "ielts.writing",
    "ielts.speaking",
    "debate.en.competitive",
  ]),
  version: z.number().int().positive(),
});

function readFlag(argv: string[], name: string) {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : undefined;
}

async function main() {
  const argv = process.argv.slice(2);
  const args = ArgsSchema.parse({
    collection: readFlag(argv, "--collection"),
    version: Number(readFlag(argv, "--version")),
  });
  const client = createAdminClient();
  const { data: collectionRow, error: collectionError } = await client
    .from("ai_knowledge_collections")
    .select("id,slug,embedding_provider,embedding_model,embedding_dimensions")
    .eq("slug", args.collection)
    .single();
  if (collectionError || !collectionRow)
    throw new Error(`knowledge_collection_lookup:${collectionError?.message}`);

  const [versionResult, itemResult] = await Promise.all([
    client
      .from("ai_knowledge_collection_versions")
      .select("status")
      .eq("collection_id", collectionRow.id)
      .eq("version", args.version)
      .maybeSingle(),
    client
      .from("ai_knowledge_items")
      .select(
        "id,source_id,item_kind,review_status,usable_for,content_hash,metadata,submitted_by,reviewed_by",
      )
      .eq("collection_id", collectionRow.id)
      .eq("collection_version", args.version),
  ]);
  if (versionResult.error)
    throw new Error(`knowledge_version_lookup:${versionResult.error.message}`);
  if (itemResult.error)
    throw new Error(`knowledge_item_lookup:${itemResult.error.message}`);

  const itemRows = itemResult.data ?? [];
  const itemIds = itemRows.map((row) => row.id);
  const sourceIds = [...new Set(itemRows.map((row) => row.source_id))];
  const [sourceResult, embeddingResult] = await Promise.all([
    sourceIds.length
      ? client
          .from("ai_knowledge_sources")
          .select(
            "id,authority_tier,review_status,rights_status,submitted_by,reviewed_by",
          )
          .in("id", sourceIds)
      : Promise.resolve({ data: [], error: null }),
    itemIds.length
      ? client
          .from("ai_knowledge_embeddings")
          .select("item_id,provider,model,dimensions,input_type,content_hash")
          .in("item_id", itemIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (sourceResult.error)
    throw new Error(`knowledge_source_lookup:${sourceResult.error.message}`);
  if (embeddingResult.error)
    throw new Error(
      `knowledge_embedding_lookup:${embeddingResult.error.message}`,
    );

  const result = summarizeKnowledgeReleasePreflight({
    collection: {
      slug: collectionRow.slug,
      embeddingProvider: collectionRow.embedding_provider,
      embeddingModel: collectionRow.embedding_model,
      embeddingDimensions: collectionRow.embedding_dimensions,
    },
    version: args.version,
    versionStatus: versionResult.data?.status ?? null,
    items: itemRows.map(
      (row): KnowledgeReleaseItem => ({
        id: row.id,
        sourceId: row.source_id,
        itemKind: row.item_kind,
        reviewStatus: row.review_status,
        usableFor: row.usable_for,
        contentHash: row.content_hash,
        metadata:
          row.metadata && typeof row.metadata === "object"
            ? (row.metadata as Record<string, unknown>)
            : {},
        submittedBy: row.submitted_by,
        reviewedBy: row.reviewed_by,
      }),
    ),
    sources: (sourceResult.data ?? []).map(
      (row): KnowledgeReleaseSource => ({
        id: row.id,
        authorityTier: row.authority_tier,
        reviewStatus: row.review_status,
        rightsStatus: row.rights_status,
        submittedBy: row.submitted_by,
        reviewedBy: row.reviewed_by,
      }),
    ),
    embeddings: (embeddingResult.data ?? []).map(
      (row): KnowledgeReleaseEmbedding => ({
        itemId: row.item_id,
        provider: row.provider,
        model: row.model,
        dimensions: row.dimensions,
        inputType: row.input_type,
        contentHash: row.content_hash,
      }),
    ),
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!result.ready) process.exitCode = 2;
}

main().catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
});
