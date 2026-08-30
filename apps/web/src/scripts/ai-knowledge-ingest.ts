import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

import {
  KnowledgeItemSchema,
  SourceSchema,
  buildKnowledgeIngestionPlan,
  ingestKnowledgePlan,
} from "@/lib/ai/knowledge/ingestion";
import { isKnowledgeCollectionKey } from "@/lib/ai/knowledge/collections";
import { publishAiKnowledgeVersion } from "@/lib/ai/knowledge/admin";

const UuidSchema = z.string().uuid();

const ManifestSchema = z.object({
  collection: z.string().refine(isKnowledgeCollectionKey, "Unknown collection"),
  collectionVersion: z.number().int().positive(),
  importKey: z.string().min(16).max(128).optional(),
  sources: z.array(SourceSchema).min(1).max(500),
  items: z
    .array(
      KnowledgeItemSchema.extend({
        sourceCanonicalUrl: z.string().url().optional(),
      }),
    )
    .min(1)
    .max(5_000),
});

type CliArgs = {
  manifest: string;
  submittedBy: string;
  reviewerId?: string;
  embed: boolean;
  publish: boolean;
  reviewNotes?: string;
};

function readArgs(argv: string[]): CliArgs {
  const values = new Map<string, string | true>();
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]!;
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) values.set(key, true);
    else {
      values.set(key, next);
      index += 1;
    }
  }
  const manifest = values.get("manifest");
  const submittedBy = values.get("submitted-by");
  if (typeof manifest !== "string" || typeof submittedBy !== "string") {
    throw new Error(
      "Usage: ai:knowledge-ingest -- --manifest <file.json> --submitted-by <uuid> [--reviewer-id <uuid> --embed --publish]",
    );
  }
  const reviewerId = values.get("reviewer-id");
  const reviewNotes = values.get("review-notes");
  return {
    manifest,
    submittedBy: UuidSchema.parse(submittedBy),
    reviewerId:
      typeof reviewerId === "string" ? UuidSchema.parse(reviewerId) : undefined,
    embed: values.get("embed") === true,
    publish: values.get("publish") === true,
    reviewNotes: typeof reviewNotes === "string" ? reviewNotes : undefined,
  };
}

async function main() {
  const args = readArgs(process.argv.slice(2));
  if (args.publish && !args.reviewerId) {
    throw new Error(
      "--publish requires --reviewer-id (the importer cannot self-review)",
    );
  }
  if (args.publish && !args.embed) {
    throw new Error(
      "--publish requires --embed so the published version is retrievable",
    );
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRole) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required",
    );
  }
  const raw = await readFile(resolve(process.cwd(), args.manifest), "utf8");
  const manifest = ManifestSchema.parse(JSON.parse(raw));
  const plan = buildKnowledgeIngestionPlan({
    collection: manifest.collection,
    collectionVersion: manifest.collectionVersion,
    sources: manifest.sources,
    items: manifest.items,
    importKey: manifest.importKey,
  });
  const client = createClient(url, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const ingested = await ingestKnowledgePlan({
    supabase: client,
    plan,
    embed: args.embed,
    submittedBy: args.submittedBy,
    reviewedBy: args.reviewerId,
  });
  const published = args.publish
    ? await publishAiKnowledgeVersion({
        supabase: client,
        collection: manifest.collection,
        version: manifest.collectionVersion,
        reviewerId: args.reviewerId!,
        reviewNotes: args.reviewNotes,
      })
    : null;
  process.stdout.write(
    `${JSON.stringify({ manifest: args.manifest, ingested, published }, null, 2)}\n`,
  );
}

main().catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
});
