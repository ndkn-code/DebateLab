import "server-only";

import { isDevAdminBypassEnabled } from "@/lib/dev-admin-bypass";
import { createTypedAdminClient } from "@/lib/supabase/admin";
import { createTypedServerClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/supabase";
import {
  VOCAB_PAGE_SIZE,
  escapeVocabSearch,
  normalizeVocabFilters,
  normalizeVocabInput,
  type VocabFilters,
} from "@/lib/vocab/model";

export type VocabItem = Tables<"vocab_items">;

export type VocabPage = {
  items: VocabItem[];
  filters: VocabFilters;
  page: number;
  pageSize: number;
  pageCount: number;
  totalCount: number;
  bands: string[];
  topics: string[];
};

type VocabClient = Awaited<ReturnType<typeof createTypedServerClient>>;

async function createReadClient(): Promise<VocabClient> {
  return isDevAdminBypassEnabled()
    ? createTypedAdminClient()
    : createTypedServerClient();
}

async function verifyAdmin(): Promise<{
  client: VocabClient;
  userId: string | null;
}> {
  if (isDevAdminBypassEnabled()) {
    return { client: createTypedAdminClient(), userId: null };
  }
  const client = await createReadClient();
  const {
    data: { user },
    error: userError,
  } = await client.auth.getUser();
  if (userError || !user) throw new Error("vocabulary: unauthorized");
  const { data: profile, error: profileError } = await client
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profileError || profile?.role !== "admin")
    throw new Error("vocabulary: forbidden");
  return { client, userId: user.id };
}

export async function listVocab({
  subject,
  bandTag,
  topicTag,
  search,
  page,
  pageSize = VOCAB_PAGE_SIZE,
}: {
  subject?: string | null;
  bandTag?: string | null;
  topicTag?: string | null;
  search?: string | null;
  page?: string | number | null;
  pageSize?: number;
} = {}): Promise<VocabPage> {
  const filters = normalizeVocabFilters({
    subject,
    bandTag,
    topicTag,
    search,
    page,
  });
  const client = await createReadClient();
  const safePageSize = Math.min(100, Math.max(1, Math.floor(pageSize)));
  let query = client.from("vocab_items").select("*", { count: "exact" });
  if (filters.subject !== "all") query = query.eq("subject", filters.subject);
  if (filters.bandTag) query = query.eq("band_tag", filters.bandTag);
  if (filters.topicTag)
    query = query.contains("topic_tags", [filters.topicTag]);
  if (filters.search) {
    const term = escapeVocabSearch(filters.search);
    query = query.or(
      `term.ilike.%${term}%,definition_en.ilike.%${term}%,definition_vi.ilike.%${term}%`,
    );
  }
  const from = (filters.page - 1) * safePageSize;
  const { data, error, count } = await query
    .order("term", { ascending: true })
    .range(from, from + safePageSize - 1);
  if (error) throw new Error(`vocabulary(list): ${error.message}`);

  const { data: facets, error: facetsError } = await client
    .from("vocab_items")
    .select("band_tag, topic_tags")
    .limit(2000);
  if (facetsError)
    throw new Error(`vocabulary(facets): ${facetsError.message}`);
  const bands = [
    ...new Set(
      (facets ?? []).flatMap((row) => (row.band_tag ? [row.band_tag] : [])),
    ),
  ].sort();
  const topics = [
    ...new Set((facets ?? []).flatMap((row) => row.topic_tags)),
  ].sort();
  const totalCount = count ?? 0;
  return {
    items: data ?? [],
    filters,
    page: filters.page,
    pageSize: safePageSize,
    pageCount: Math.max(1, Math.ceil(totalCount / safePageSize)),
    totalCount,
    bands,
    topics,
  };
}

export async function getVocab(id: string): Promise<VocabItem> {
  const client = await createReadClient();
  const { data, error } = await client
    .from("vocab_items")
    .select("*")
    .eq("id", id)
    .single();
  if (error || !data)
    throw new Error(`vocabulary(get): ${error?.message ?? "not found"}`);
  return data;
}

export async function upsertVocab(input: unknown): Promise<VocabItem> {
  const value = normalizeVocabInput(input);
  const { client, userId } = await verifyAdmin();
  const row = {
    term: value.term,
    part_of_speech: value.partOfSpeech,
    phonetic: value.phonetic,
    definition_en: value.definitionEn,
    definition_vi: value.definitionVi,
    example: value.example,
    synonyms: value.synonyms,
    collocations: value.collocations,
    topic_tags: value.topicTags,
    band_tag: value.bandTag,
    subject: value.subject,
    source: value.source,
    updated_at: new Date().toISOString(),
  };
  const query = value.id
    ? client.from("vocab_items").update(row).eq("id", value.id)
    : client.from("vocab_items").insert({ ...row, created_by: userId });
  const { data, error } = await query.select("*").single();
  if (error || !data)
    throw new Error(
      `vocabulary(upsert): ${error?.message ?? "no row returned"}`,
    );
  return data;
}

export async function deleteVocab(id: string): Promise<void> {
  const { client } = await verifyAdmin();
  const { error } = await client.from("vocab_items").delete().eq("id", id);
  if (error) throw new Error(`vocabulary(delete): ${error.message}`);
}
