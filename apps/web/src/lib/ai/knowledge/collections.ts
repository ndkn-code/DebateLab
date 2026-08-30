import "server-only";

/** Every embedding-backed collection has its own model namespace. */
export const KNOWLEDGE_COLLECTION_KEYS = [
  "debate.vi.truong_teen",
  "debate.en.competitive",
  "ielts.speaking",
  "ielts.writing",
] as const;

export type KnowledgeCollectionKey = (typeof KNOWLEDGE_COLLECTION_KEYS)[number];
export type KnowledgeEmbeddingProvider = "self_hosted" | "voyage";

export interface KnowledgeCollectionConfig {
  key: KnowledgeCollectionKey;
  domain: "debate" | "ielts";
  language: "vi" | "en";
  provider: KnowledgeEmbeddingProvider;
  model: string;
  dimensions: 1024;
  defaultReviewStatuses: readonly string[];
}

const APPROVED_ONLY = ["approved"] as const;

export const KNOWLEDGE_COLLECTION_CONFIG: Record<
  KnowledgeCollectionKey,
  KnowledgeCollectionConfig
> = {
  "debate.vi.truong_teen": {
    key: "debate.vi.truong_teen",
    domain: "debate",
    language: "vi",
    provider: "self_hosted",
    model: "AITeamVN/Vietnamese_Embedding",
    dimensions: 1024,
    defaultReviewStatuses: ["candidate", "approved", "needs_review"],
  },
  "debate.en.competitive": {
    key: "debate.en.competitive",
    domain: "debate",
    language: "en",
    provider: "voyage",
    model: "voyage-4-large",
    dimensions: 1024,
    defaultReviewStatuses: APPROVED_ONLY,
  },
  "ielts.speaking": {
    key: "ielts.speaking",
    domain: "ielts",
    language: "en",
    provider: "voyage",
    model: "voyage-4-large",
    dimensions: 1024,
    defaultReviewStatuses: APPROVED_ONLY,
  },
  "ielts.writing": {
    key: "ielts.writing",
    domain: "ielts",
    language: "en",
    provider: "voyage",
    model: "voyage-4-large",
    dimensions: 1024,
    defaultReviewStatuses: APPROVED_ONLY,
  },
};

export function getKnowledgeCollectionConfig(key: KnowledgeCollectionKey) {
  return KNOWLEDGE_COLLECTION_CONFIG[key];
}

export function isKnowledgeCollectionKey(
  value: unknown,
): value is KnowledgeCollectionKey {
  return (
    typeof value === "string" &&
    (KNOWLEDGE_COLLECTION_KEYS as readonly string[]).includes(value)
  );
}
