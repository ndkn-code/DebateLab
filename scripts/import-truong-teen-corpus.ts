import * as fs from "node:fs";
import * as path from "node:path";
import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";
import {
  buildDebateCorpusItemPlans,
  type DebateCorpusSeed,
} from "../apps/web/src/lib/corpus/model";

interface ImportOptions {
  inputFile: string;
  apply: boolean;
}

function parseArgs(argv: string[]): ImportOptions {
  const options: ImportOptions = {
    inputFile: "data/corpus/truong-teen-2025.seed.normalized.json",
    apply: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--apply") {
      options.apply = true;
    } else if (arg === "--input") {
      options.inputFile = argv[index + 1] ?? options.inputFile;
      index += 1;
    } else if (arg === "--help" || arg === "-h") {
      console.log(`Usage: tsx scripts/import-truong-teen-corpus.ts [--input file] [--apply]

Default mode is a dry run. Pass --apply to upsert into Supabase using
NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.`);
      process.exit(0);
    }
  }

  return options;
}

function readSeedCorpus(inputFile: string): DebateCorpusSeed {
  const absolute = path.resolve(inputFile);
  return JSON.parse(fs.readFileSync(absolute, "utf8")) as DebateCorpusSeed;
}

function createSupabaseAdminClient() {
  loadEnvConfig(path.resolve(process.cwd(), "apps/web"));
  loadEnvConfig(process.cwd());
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY."
    );
  }
  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function toSourceRows(seed: DebateCorpusSeed) {
  return seed.sources.map((source) => ({
    id: source.source_id,
    youtube_url: source.youtube_url,
    youtube_video_id: source.youtube_video_id ?? null,
    video_title: source.video_title,
    source_type: source.source_type,
    season: source.season ?? null,
    episode: source.episode ?? null,
    stage: source.stage ?? null,
    language: source.language === "en" ? "en" : "vi",
    transcript_quality: source.transcript_quality,
    overall_confidence: source.overall_confidence,
    recommended_import_status: source.recommended_import_status,
    recommended_use: source.recommended_use ?? [],
    reason: source.reason ?? null,
    raw_line: source.raw_line ?? null,
    metadata: {
      sourceIndex: source.source_index ?? null,
      importedFrom: "truong-teen-2025.seed.normalized.json",
    },
    updated_at: new Date().toISOString(),
  }));
}

function toMatchRows(seed: DebateCorpusSeed) {
  return seed.canonical_matches.map((match) => ({
    canonical_match_key: match.canonical_match_key,
    motion_vi: match.motion.vi,
    motion_en: match.motion.en_translation ?? null,
    motion_key: match.motion.motion_key,
    motion_confidence: match.motion.motion_confidence,
    teams: match.teams,
    source_match_refs: match.source_match_refs,
    import_decision: match.import_decision,
    aggregate_confidence: match.aggregate_confidence,
    rejected_reason: match.rejected_reason ?? null,
    metadata: {
      sourceMatchCount: match.source_match_refs.length,
      debateMomentCount: match.debate_moments?.length ?? 0,
      phraseCount: match.phrase_bank?.length ?? 0,
      judgingLessonCount: match.judging_lessons?.length ?? 0,
      caseSkeletonCount: match.case_skeletons?.length ?? 0,
    },
    updated_at: new Date().toISOString(),
  }));
}

async function importCorpus(options: ImportOptions) {
  const seed = readSeedCorpus(options.inputFile);
  const itemPlans = buildDebateCorpusItemPlans(seed);
  const sourceRows = toSourceRows(seed);
  const matchRows = toMatchRows(seed);

  const itemCounts = itemPlans.reduce<Record<string, number>>((counts, item) => {
    counts[item.itemType] = (counts[item.itemType] ?? 0) + 1;
    return counts;
  }, {});

  console.log(
    JSON.stringify(
      {
        mode: options.apply ? "apply" : "dry-run",
        inputFile: options.inputFile,
        sources: sourceRows.length,
        matches: matchRows.length,
        items: itemPlans.length,
        itemCounts,
        skippedMetadataOnlyMatches: seed.canonical_matches.filter(
          (match) => match.import_decision === "metadata_only"
        ).length,
      },
      null,
      2
    )
  );

  if (!options.apply) {
    return;
  }

  const supabase = createSupabaseAdminClient();
  const { error: sourceError } = await supabase
    .from("debate_corpus_sources")
    .upsert(sourceRows, { onConflict: "id" });
  if (sourceError) throw new Error(sourceError.message);

  const { data: matches, error: matchError } = await supabase
    .from("debate_corpus_matches")
    .upsert(matchRows, { onConflict: "canonical_match_key" })
    .select("id, canonical_match_key");
  if (matchError) throw new Error(matchError.message);

  const matchIdByKey = new Map(
    (matches ?? []).map((match) => [
      match.canonical_match_key as string,
      match.id as string,
    ])
  );

  const itemRows = itemPlans.map((item) => {
    const canonicalMatchId = matchIdByKey.get(item.canonicalMatchKey);
    if (!canonicalMatchId) {
      throw new Error(`Missing match id for ${item.canonicalMatchKey}`);
    }
    return {
      canonical_match_id: canonicalMatchId,
      source_id: item.sourceId,
      source_match_key: item.sourceMatchKey,
      item_type: item.itemType,
      canonical_fingerprint: item.canonicalFingerprint,
      language: item.language,
      side: item.side,
      usable_for: item.usableFor,
      evidence_status: item.evidenceStatus,
      confidence: item.confidence,
      review_status: item.reviewStatus,
      embedding_text: item.embeddingText,
      content_hash: item.contentHash,
      content: item.content,
      metadata: item.metadata ?? {},
      updated_at: new Date().toISOString(),
    };
  });

  const batchSize = 100;
  for (let index = 0; index < itemRows.length; index += batchSize) {
    const batch = itemRows.slice(index, index + batchSize);
    const { error } = await supabase
      .from("debate_corpus_items")
      .upsert(batch, {
        onConflict:
          "canonical_match_id,item_type,canonical_fingerprint",
      });
    if (error) throw new Error(error.message);
  }

  console.log(
    `Imported ${sourceRows.length} sources, ${matchRows.length} matches, and ${itemRows.length} corpus items.`
  );
}

if (require.main === module) {
  importCorpus(parseArgs(process.argv.slice(2))).catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
