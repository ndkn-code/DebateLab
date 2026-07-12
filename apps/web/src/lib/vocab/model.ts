import { z } from "zod";

export const VOCAB_PAGE_SIZE = 24;
export const VOCAB_SUBJECTS = ["ielts", "debate"] as const;

export const vocabInputSchema = z
  .object({
    id: z.string().uuid().optional(),
    term: z.string().trim().min(1).max(200),
    partOfSpeech: z.string().trim().max(80).nullable().optional(),
    phonetic: z.string().trim().max(200).nullable().optional(),
    definitionEn: z.string().trim().max(2000).nullable().optional(),
    definitionVi: z.string().trim().max(2000).nullable().optional(),
    example: z.string().trim().max(2000).nullable().optional(),
    synonyms: z.array(z.string()).max(40).default([]),
    collocations: z.array(z.string()).max(40).default([]),
    topicTags: z.array(z.string()).max(40).default([]),
    bandTag: z.string().trim().max(20).nullable().optional(),
    subject: z.enum(VOCAB_SUBJECTS).default("ielts"),
    source: z.string().trim().max(500).nullable().optional(),
  })
  .strict();

export type VocabInput = z.infer<typeof vocabInputSchema>;

export type VocabFilters = {
  subject: "all" | (typeof VOCAB_SUBJECTS)[number];
  bandTag: string;
  topicTag: string;
  search: string;
  page: number;
};

function clean(value: string | null | undefined): string {
  return value?.trim().replace(/\s+/g, " ") ?? "";
}

export function normalizeStringList(values: readonly string[]): string[] {
  const seen = new Set<string>();
  return values.flatMap((raw) => {
    const value = clean(raw);
    const key = value.toLocaleLowerCase();
    if (!value || seen.has(key)) return [];
    seen.add(key);
    return [value];
  });
}

export function parseStringList(value: string): string[] {
  return normalizeStringList(value.split(/[,\n]/));
}

export function normalizeVocabFilters(
  input: {
    subject?: string | null;
    bandTag?: string | null;
    topicTag?: string | null;
    search?: string | null;
    page?: string | number | null;
  } = {},
): VocabFilters {
  const subject = VOCAB_SUBJECTS.includes(
    input.subject as (typeof VOCAB_SUBJECTS)[number],
  )
    ? (input.subject as (typeof VOCAB_SUBJECTS)[number])
    : "all";
  const parsedPage =
    typeof input.page === "number" ? input.page : Number(input.page);
  return {
    subject,
    bandTag: clean(input.bandTag).slice(0, 20),
    topicTag: clean(input.topicTag).slice(0, 100),
    search: clean(input.search).slice(0, 200),
    page: Number.isFinite(parsedPage) ? Math.max(1, Math.floor(parsedPage)) : 1,
  };
}

export function normalizeVocabInput(input: unknown): VocabInput {
  const parsed = vocabInputSchema.parse(input);
  return {
    ...parsed,
    term: clean(parsed.term),
    partOfSpeech: clean(parsed.partOfSpeech) || null,
    phonetic: clean(parsed.phonetic) || null,
    definitionEn: clean(parsed.definitionEn) || null,
    definitionVi: clean(parsed.definitionVi) || null,
    example: clean(parsed.example) || null,
    synonyms: normalizeStringList(parsed.synonyms),
    collocations: normalizeStringList(parsed.collocations),
    topicTags: normalizeStringList(parsed.topicTags),
    bandTag: clean(parsed.bandTag) || null,
    source: clean(parsed.source) || null,
  };
}

export function escapeVocabSearch(value: string): string {
  return value
    .replace(/[%_,()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
