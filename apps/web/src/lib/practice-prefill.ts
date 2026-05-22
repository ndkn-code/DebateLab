import {
  CATEGORIES,
  getCategoryKey,
  getCategoryLabel,
  getLocalizedTopic,
  getLocalizedTopics,
  getTopicByKey,
} from "@/lib/topics";
import type {
  AiDifficulty,
  ClubPracticeContext,
  DebateTopic,
  PracticeLanguage,
  PracticeTrack,
} from "@/types";

export type PracticeMode = "quick" | "full";
export type PracticeSide = "proposition" | "opposition" | "random";

export interface PracticePrefill {
  topicId?: string;
  topicTitle: string;
  topicCategory?: string;
  topicDescription?: string;
  practiceTrack?: PracticeTrack;
  practiceLanguage?: PracticeLanguage;
  mode?: PracticeMode;
  aiDifficulty?: AiDifficulty;
  side?: PracticeSide;
  clubContext?: ClubPracticeContext;
}

export interface PracticeQueryPrefill {
  topicId?: string;
  topicTitle?: string;
  topicCategory?: string;
  topicDescription?: string;
  practiceTrack?: PracticeTrack;
  practiceLanguage?: PracticeLanguage;
  mode?: PracticeMode;
  aiDifficulty?: AiDifficulty;
  side?: PracticeSide;
  clubContext?: ClubPracticeContext;
}

const DEFAULT_CATEGORY = CATEGORIES[0];

function normalizeText(value: string) {
  return value.trim().toLowerCase();
}

function parsePracticeTrack(value?: string | null): PracticeTrack | undefined {
  return value === "speaking" || value === "debate" ? value : undefined;
}

function parsePracticeLanguage(value?: string | null): PracticeLanguage | undefined {
  return value === "en" || value === "vi" ? value : undefined;
}

function parseMode(value?: string | null): PracticeMode | undefined {
  return value === "quick" || value === "full" ? value : undefined;
}

function parseAiDifficulty(value?: string | null): AiDifficulty | undefined {
  return value === "easy" || value === "medium" || value === "hard"
    ? value
    : undefined;
}

function parseSide(value?: string | null): PracticeSide | undefined {
  return value === "proposition" ||
    value === "opposition" ||
    value === "random"
    ? value
    : undefined;
}

function parseContextId(value?: string | null) {
  if (!value) return undefined;
  const trimmed = value.trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(trimmed)
    ? trimmed
    : undefined;
}

function parseClubContext(searchParams: URLSearchParams): ClubPracticeContext | undefined {
  const clubId = parseContextId(searchParams.get("clubId"));
  const classId = parseContextId(searchParams.get("classId"));
  const assignmentId = parseContextId(searchParams.get("assignmentId"));
  const assignmentTitle = searchParams.get("assignmentTitle")?.trim() || undefined;

  if (!clubId && !classId && !assignmentId && !assignmentTitle) return undefined;
  return { clubId, classId, assignmentId, assignmentTitle };
}

function toTopicDifficulty(
  aiDifficulty?: AiDifficulty
): DebateTopic["difficulty"] {
  if (aiDifficulty === "hard") return "advanced";
  if (aiDifficulty === "medium") return "intermediate";
  return "beginner";
}

function slugify(value: string) {
  const slug = value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  return slug || "custom-topic";
}

export function findPracticeTopicByTitle(
  title?: string | null,
  language: PracticeLanguage = "en",
  catalogTopics?: DebateTopic[]
) {
  if (!title) return undefined;
  const normalizedTitle = normalizeText(title);

  if (catalogTopics?.length) {
    return catalogTopics.find(
      (candidate) => normalizeText(candidate.title) === normalizedTitle
    );
  }

  const languages: PracticeLanguage[] =
    language === "vi" ? ["vi", "en"] : ["en", "vi"];

  for (const candidateLanguage of languages) {
    const topic = getLocalizedTopics(candidateLanguage).find(
      (candidate) => normalizeText(candidate.title) === normalizedTitle
    );
    if (topic) return getLocalizedTopic(topic, language);
  }

  return undefined;
}

function findPracticeTopicByKey(
  topicKey: string | null | undefined,
  catalogTopics?: DebateTopic[]
) {
  if (!topicKey || !catalogTopics?.length) {
    return undefined;
  }

  return catalogTopics.find(
    (topic) => topic.id === topicKey || topic.topicKey === topicKey
  );
}

export function resolvePracticeTopic(
  prefill: PracticePrefill,
  language: PracticeLanguage = prefill.practiceLanguage ?? "en",
  catalogTopics?: DebateTopic[]
): DebateTopic {
  const existingTopic =
    findPracticeTopicByKey(prefill.topicId, catalogTopics) ??
    (catalogTopics?.length ? undefined : getTopicByKey(prefill.topicId)) ??
    findPracticeTopicByTitle(prefill.topicTitle, language, catalogTopics);
  if (existingTopic) return getLocalizedTopic(existingTopic, language);

  const categoryKey = getCategoryKey(prefill.topicCategory ?? DEFAULT_CATEGORY);

  return {
    id: `prefill-${slugify(prefill.topicTitle)}`,
    topicKey: `prefill-${slugify(prefill.topicTitle)}`,
    categoryKey,
    title: prefill.topicTitle,
    category: getCategoryLabel(categoryKey, language),
    difficulty: toTopicDifficulty(prefill.aiDifficulty),
    context: prefill.topicDescription,
  };
}

export function readPracticePrefill(
  searchParams: URLSearchParams
): PracticeQueryPrefill | null {
  const topicTitle = searchParams.get("topic");
  const topicId = searchParams.get("topicId") ?? undefined;
  const topicCategory = searchParams.get("category") ?? undefined;
  const topicDescription = searchParams.get("description") ?? undefined;
  const practiceTrack = parsePracticeTrack(searchParams.get("track"));
  const practiceLanguage = parsePracticeLanguage(searchParams.get("language"));
  const mode = parseMode(searchParams.get("mode"));
  const aiDifficulty = parseAiDifficulty(searchParams.get("difficulty"));
  const side = parseSide(searchParams.get("side"));
  const clubContext = parseClubContext(searchParams);

  if (
    !topicId &&
    !topicTitle &&
    !topicCategory &&
    !topicDescription &&
    !practiceTrack &&
    !practiceLanguage &&
    !mode &&
    !aiDifficulty &&
    !side &&
    !clubContext
  ) {
    return null;
  }

  return {
    topicId,
    topicTitle: topicTitle ?? undefined,
    topicCategory,
    topicDescription,
    practiceTrack,
    practiceLanguage,
    mode,
    aiDifficulty,
    side,
    clubContext,
  };
}

export function buildLegacyPracticeLanguageRedirect(
  pathname: string,
  legacyLanguage: PracticeLanguage,
  searchParams: URLSearchParams
) {
  const nextParams = new URLSearchParams(searchParams.toString());
  nextParams.delete("language");

  const normalizedPathname = pathname.startsWith("/") ? pathname : `/${pathname}`;
  const pathWithoutLocale =
    normalizedPathname.replace(/^\/(en|vi)(?=\/|$)/, "") || "/";
  const pathSuffix = nextParams.toString() ? `?${nextParams.toString()}` : "";
  const finalPath =
    legacyLanguage === "en"
      ? `/en${pathWithoutLocale === "/" ? "" : pathWithoutLocale}`
      : pathWithoutLocale;
  const switchPath = `/${legacyLanguage}${pathWithoutLocale === "/" ? "" : pathWithoutLocale}`;

  return {
    finalHref: `${finalPath}${pathSuffix}`,
    switchHref: `${switchPath}${pathSuffix}`,
  };
}

export function buildPracticeHref(prefill: PracticePrefill) {
  const searchParams = new URLSearchParams();
  searchParams.set("topic", prefill.topicTitle);

  if (prefill.topicId) {
    searchParams.set("topicId", prefill.topicId);
  }

  if (prefill.topicCategory) {
    searchParams.set("category", prefill.topicCategory);
  }

  if (prefill.topicDescription) {
    searchParams.set("description", prefill.topicDescription);
  }

  if (prefill.practiceTrack) {
    searchParams.set("track", prefill.practiceTrack);
  }

  if (prefill.practiceLanguage) {
    searchParams.set("language", prefill.practiceLanguage);
  }

  if (prefill.mode) {
    searchParams.set("mode", prefill.mode);
  }

  if (prefill.aiDifficulty) {
    searchParams.set("difficulty", prefill.aiDifficulty);
  }

  if (prefill.side) {
    searchParams.set("side", prefill.side);
  }

  if (prefill.clubContext?.clubId) {
    searchParams.set("clubId", prefill.clubContext.clubId);
  }

  if (prefill.clubContext?.classId) {
    searchParams.set("classId", prefill.clubContext.classId);
  }

  if (prefill.clubContext?.assignmentId) {
    searchParams.set("assignmentId", prefill.clubContext.assignmentId);
  }

  if (prefill.clubContext?.assignmentTitle) {
    searchParams.set("assignmentTitle", prefill.clubContext.assignmentTitle);
  }

  return `/practice?${searchParams.toString()}`;
}
