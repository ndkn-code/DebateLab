import { NextRequest, NextResponse } from "next/server";
import { isAdminUser } from "@/lib/auth/admin";
import { requireRequestAuth } from "@/lib/api/request-auth";
import { tryCreateAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function getParam(params: URLSearchParams, key: string) {
  const value = params.get(key);
  return value && value !== "all" ? value : null;
}

function includesText(row: Record<string, unknown>, query: string | null) {
  if (!query) return true;
  const haystack = JSON.stringify(row).toLowerCase();
  return haystack.includes(query.toLowerCase());
}

export async function GET(req: NextRequest) {
  const auth = await requireRequestAuth(req);
  if (!auth.ok) return auth.errorResponse;

  const { supabase, user } = auth;
  if (!(await isAdminUser(supabase, user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = tryCreateAdminClient() ?? supabase;
  const params = new URL(req.url).searchParams;
  const reviewStatus = getParam(params, "reviewStatus");
  const itemType = getParam(params, "itemType");
  const queryText = getParam(params, "q");

  const [
    sourcesResult,
    matchesResult,
    itemsResult,
    motionsResult,
    logsResult,
    importsResult,
    embeddingsResult,
  ] = await Promise.all([
    admin
      .from("debate_corpus_sources")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(150),
    admin
      .from("debate_corpus_matches")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(150),
    admin
      .from("debate_corpus_items")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(250),
    admin
      .from("debate_corpus_motion_candidates")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(150),
    admin
      .from("debate_corpus_retrieval_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100),
    admin
      .from("debate_corpus_import_batches")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(60),
    admin
      .from("debate_corpus_embeddings")
      .select("item_id, provider, model, dimensions, content_hash, embedded_at"),
  ]);

  const errors = [
    sourcesResult.error,
    matchesResult.error,
    itemsResult.error,
    motionsResult.error,
    logsResult.error,
    importsResult.error,
    embeddingsResult.error,
  ].filter(Boolean);

  if (errors.length) {
    return NextResponse.json({ error: "Unable to load corpus data" }, { status: 500 });
  }

  const sources = ((sourcesResult.data ?? []) as Record<string, unknown>[])
    .filter((row) => !reviewStatus || row.review_status === reviewStatus)
    .filter((row) => includesText(row, queryText));
  const matches = ((matchesResult.data ?? []) as Record<string, unknown>[])
    .filter((row) => !reviewStatus || row.review_status === reviewStatus)
    .filter((row) => includesText(row, queryText));
  const items = ((itemsResult.data ?? []) as Record<string, unknown>[])
    .filter((row) => !reviewStatus || row.review_status === reviewStatus)
    .filter((row) => !itemType || row.item_type === itemType)
    .filter((row) => includesText(row, queryText));
  const motions = ((motionsResult.data ?? []) as Record<string, unknown>[])
    .filter((row) => !reviewStatus || row.review_status === reviewStatus)
    .filter((row) => includesText(row, queryText));
  const embeddings = (embeddingsResult.data ?? []) as Array<{
    item_id: string;
    provider: string;
    model: string;
    dimensions: number;
    content_hash: string;
  }>;

  const currentEmbeddingItemIds = new Set(
    embeddings.map((embedding) => `${embedding.item_id}:${embedding.content_hash}`)
  );
  const missingEmbeddingCount = ((itemsResult.data ?? []) as Array<{
    id: string;
    content_hash: string;
    review_status: string;
  }>).filter(
    (item) =>
      item.review_status !== "rejected" &&
      !currentEmbeddingItemIds.has(`${item.id}:${item.content_hash}`)
  ).length;

  const reviewCounts = ((itemsResult.data ?? []) as Array<{ review_status: string }>).reduce<
    Record<string, number>
  >((counts, item) => {
    counts[item.review_status] = (counts[item.review_status] ?? 0) + 1;
    return counts;
  }, {});

  const providerCounts = embeddings.reduce<Record<string, number>>((counts, row) => {
    const key = `${row.provider}:${row.model}`;
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});

  return NextResponse.json({
    kpis: {
      sourceCount: sourcesResult.data?.length ?? 0,
      matchCount: matchesResult.data?.length ?? 0,
      itemCount: itemsResult.data?.length ?? 0,
      motionCount: motionsResult.data?.length ?? 0,
      importCount: importsResult.data?.length ?? 0,
      retrievalLogCount: logsResult.data?.length ?? 0,
      missingEmbeddingCount,
      reviewCounts,
      providerCounts,
      publishedMotionCount: ((motionsResult.data ?? []) as Array<{ publish_status: string }>).filter(
        (motion) => motion.publish_status === "published"
      ).length,
    },
    sources,
    matches,
    items,
    motions,
    retrievalLogs: logsResult.data ?? [],
    importBatches: importsResult.data ?? [],
  });
}
