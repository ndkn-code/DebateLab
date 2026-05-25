import { createHash } from "node:crypto";
import {
  DEBATE_CORPUS_USABLE_FOR,
  buildDebateCorpusItemPlans,
  hashDebateCorpusContent,
  type DebateCorpusCanonicalMatchSeed,
  type DebateCorpusEvidenceStatus,
  type PhraseBankSeed,
  type DebateCorpusSeed,
  type DebateCorpusSide,
  type DebateCorpusSourceSeed,
  type DebateCorpusUsableFor,
} from "./model";

type JsonRecord = Record<string, unknown>;

export interface CorpusImportParseResult {
  seed: DebateCorpusSeed;
  inputFormat: "json" | "markdown";
  objectCount: number;
}

export interface CorpusMotionCandidatePlan {
  canonicalMatchKey: string;
  sourceId: string | null;
  motionVi: string;
  motionEn: string | null;
  normalizedTitleHash: string;
  motionKey: string;
  categoryKey:
    | "education"
    | "technology"
    | "society"
    | "environment"
    | "ethics"
    | "vietnam";
  difficulty: "beginner" | "intermediate" | "advanced";
  sourceStage: string | null;
  sourceSeason: number | null;
  sourceUrl: string | null;
  teams: unknown[];
  metadata: Record<string, unknown>;
}

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function asString(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function asNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function compact(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function slugifyCorpusText(value: string, fallback = "item") {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
  return normalized || fallback;
}

export function normalizeMotionTitle(value: string) {
  return compact(value)
    .toLowerCase()
    .replace(/[“”"'.?!,:;]+/g, "")
    .replace(/\s+/g, " ");
}

export function hashCorpusMotionTitle(value: string) {
  return createHash("md5").update(normalizeMotionTitle(value)).digest("hex");
}

function extractYoutubeVideoId(url: string) {
  const trimmed = url.trim();
  const patterns = [
    /youtu\.be\/([A-Za-z0-9_-]{6,})/,
    /youtube\.com\/watch\?[^#]*v=([A-Za-z0-9_-]{6,})/,
    /youtube\.com\/embed\/([A-Za-z0-9_-]{6,})/,
  ];
  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    if (match?.[1]) return match[1];
  }
  return null;
}

function parseJsonOrMarkdown(content: string) {
  const trimmed = content.trim();
  try {
    return {
      inputFormat: "json" as const,
      objects: [JSON.parse(trimmed) as unknown],
    };
  } catch {
    const blocks = [...content.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)]
      .map((match) => match[1]?.trim())
      .filter((block): block is string => Boolean(block));
    const objects = blocks
      .map((block) => {
        try {
          return JSON.parse(block) as unknown;
        } catch {
          return null;
        }
      })
      .filter((value): value is unknown => value !== null);

    if (objects.length === 0) {
      throw new Error("No valid JSON object or fenced JSON block was found.");
    }
    return { inputFormat: "markdown" as const, objects };
  }
}

function normalizeUsableFor(value: unknown): DebateCorpusUsableFor[] {
  const allowed = DEBATE_CORPUS_USABLE_FOR as readonly string[];
  return Array.from(
    new Set(
      asArray(value).filter((item): item is DebateCorpusUsableFor =>
        typeof item === "string" && allowed.includes(item)
      )
    )
  );
}

function normalizeSide(value: unknown): DebateCorpusSide {
  if (
    value === "proposition" ||
    value === "opposition" ||
    value === "neutral" ||
    value === "unknown"
  ) {
    return value;
  }
  return "unknown";
}

function normalizeEvidenceStatus(value: unknown): DebateCorpusEvidenceStatus {
  if (
    value === "verified_from_video" ||
    value === "mentioned_but_unverified" ||
    value === "uncertain_stt" ||
    value === "not_applicable"
  ) {
    return value;
  }
  return "not_applicable";
}

function fingerprint(prefix: string, value: unknown) {
  return `${prefix}_${hashDebateCorpusContent(value).slice(0, 16)}`;
}

function normalizeSource(source: JsonRecord, index: number): DebateCorpusSourceSeed {
  const youtubeUrl = asString(source.youtube_url);
  const videoId = asString(source.youtube_video_id) || extractYoutubeVideoId(youtubeUrl);
  const title = asString(source.video_title, `Corpus source ${index + 1}`);
  const sourceId =
    asString(source.source_id) ||
    (videoId ? `youtube_${videoId}` : `source_${slugifyCorpusText(title)}_${index + 1}`);

  return {
    source_id: sourceId,
    source_index: index + 1,
    video_title: title,
    youtube_url: youtubeUrl || `internal://corpus-source/${sourceId}`,
    youtube_video_id: videoId,
    source_type: [
      "single_match_episode",
      "multi_match_compilation",
      "highlight_reel",
      "unclear",
    ].includes(asString(source.source_type))
      ? asString(source.source_type)
      : "unclear",
    season: asNumber(source.season, 0) || null,
    episode: asString(source.episode) || null,
    stage: asString(source.stage) || null,
    language: asString(source.language, "vi"),
    transcript_quality: ["excellent", "good", "medium", "poor"].includes(
      asString(source.transcript_quality)
    )
      ? asString(source.transcript_quality)
      : "medium",
    overall_confidence: Math.max(0, Math.min(1, asNumber(source.overall_confidence, 0.7))),
    recommended_import_status: ["approved", "needs_review", "do_not_import"].includes(
      asString(source.recommended_import_status)
    )
      ? asString(source.recommended_import_status)
      : "needs_review",
    recommended_use: normalizeUsableFor(source.recommended_use),
    reason: asString(source.reason) || null,
  };
}

function normalizeDebateMoments(match: JsonRecord, sourceId: string, sourceMatchKey: string) {
  return asArray(match.debate_moments)
    .filter(isRecord)
    .map((moment) => {
      const shortParaphrase = asString(moment.short_paraphrase);
      const strategicValue = asString(moment.strategic_value);
      return {
        source_id: asString(moment.source_id, sourceId),
        source_match_key: asString(moment.source_match_key, sourceMatchKey),
        moment_key:
          asString(moment.moment_key) ||
          fingerprint("moment", [sourceId, sourceMatchKey, shortParaphrase]),
        moment_type: asString(moment.moment_type, "clash"),
        side: normalizeSide(moment.side),
        approx_timestamp: asString(moment.approx_timestamp) || null,
        short_paraphrase: shortParaphrase,
        strategic_value: strategicValue,
        what_strong_ai_should_notice: asString(moment.what_strong_ai_should_notice),
        what_weak_ai_would_miss: asString(moment.what_weak_ai_would_miss),
        usable_for: normalizeUsableFor(moment.usable_for).length
          ? normalizeUsableFor(moment.usable_for)
          : (["rebuttal", "eval"] as DebateCorpusUsableFor[]),
        evidence_status: normalizeEvidenceStatus(moment.evidence_status),
        confidence: Math.max(0, Math.min(1, asNumber(moment.confidence, 0.75))),
        canonical_fingerprint:
          asString(moment.canonical_fingerprint) ||
          fingerprint("moment", [shortParaphrase, strategicValue]),
      };
    })
    .filter((moment) => moment.short_paraphrase && moment.strategic_value);
}

function normalizePhraseBank(match: JsonRecord, sourceId: string, sourceMatchKey: string) {
  return asArray(match.phrase_bank)
    .filter(isRecord)
    .map((phrase) => {
      const phraseVi = asString(phrase.phrase_vi);
      const difficulty: PhraseBankSeed["difficulty"] =
        phrase.difficulty === "beginner" ||
        phrase.difficulty === "intermediate" ||
        phrase.difficulty === "advanced"
          ? phrase.difficulty
          : "intermediate";
      return {
        source_id: asString(phrase.source_id, sourceId),
        source_match_key: asString(phrase.source_match_key, sourceMatchKey),
        phrase_vi: phraseVi,
        function: asString(phrase.function, "style"),
        english_meaning: asString(
          phrase.english_meaning,
          asString(phrase.phrase_en)
        ),
        difficulty,
        natural_truong_teen_style:
          typeof phrase.natural_truong_teen_style === "boolean"
            ? phrase.natural_truong_teen_style
            : true,
        confidence: Math.max(0, Math.min(1, asNumber(phrase.confidence, 0.75))),
        canonical_fingerprint:
          asString(phrase.canonical_fingerprint) ||
          fingerprint("phrase", [phraseVi, asString(phrase.function)]),
      };
    })
    .filter((phrase) => phrase.phrase_vi);
}

function normalizeJudgingLessons(match: JsonRecord, sourceId: string, sourceMatchKey: string) {
  return asArray(match.judging_lessons)
    .filter(isRecord)
    .map((lesson) => {
      const lessonText = asString(lesson.lesson);
      return {
        source_id: asString(lesson.source_id, sourceId),
        source_match_key: asString(lesson.source_match_key, sourceMatchKey),
        lesson: lessonText,
        rewarded_behavior: asString(lesson.rewarded_behavior),
        penalized_behavior: asString(lesson.penalized_behavior),
        thinkfy_judge_rule: asString(lesson.thinkfy_judge_rule),
        evidence_status: normalizeEvidenceStatus(lesson.evidence_status),
        confidence: Math.max(0, Math.min(1, asNumber(lesson.confidence, 0.75))),
        canonical_fingerprint:
          asString(lesson.canonical_fingerprint) ||
          fingerprint("lesson", [lessonText, asString(lesson.thinkfy_judge_rule)]),
      };
    })
    .filter((lesson) => lesson.lesson && lesson.thinkfy_judge_rule);
}

function normalizeMatch(
  match: JsonRecord,
  source: DebateCorpusSourceSeed,
  index: number
): DebateCorpusCanonicalMatchSeed {
  const motion = isRecord(match.motion) ? match.motion : {};
  const motionVi = asString(motion.vi, asString(match.motion_vi, "Unclear motion"));
  const sourceMatchKey =
    asString(match.match_key) ||
    asString(match.canonical_match_key) ||
    `match_${slugifyCorpusText(motionVi)}_${index + 1}`;
  const hasDebateContent =
    asArray(match.debate_moments).length > 0 ||
    asArray(match.phrase_bank).length > 0 ||
    asArray(match.judging_lessons).length > 0;

  return {
    canonical_match_key: asString(match.canonical_match_key, sourceMatchKey),
    motion: {
      vi: motionVi,
      en_translation: asString(motion.en_translation, asString(match.motion_en)) || null,
      motion_confidence: Math.max(
        0,
        Math.min(1, asNumber(motion.motion_confidence, asNumber(match.match_confidence, 0.75)))
      ),
      motion_key: asString(motion.motion_key) || slugifyCorpusText(motionVi, "motion"),
    },
    teams: asArray(match.teams),
    source_match_refs: [
      {
        source_id: source.source_id,
        source_match_key: sourceMatchKey,
        youtube_url: source.youtube_url,
        match_confidence: Math.max(0, Math.min(1, asNumber(match.match_confidence, 0.75))),
        import_decision: hasDebateContent ? "candidate" : "metadata_only",
      },
    ],
    import_decision: hasDebateContent ? "candidate" : "metadata_only",
    aggregate_confidence: Math.max(0, Math.min(1, asNumber(match.match_confidence, 0.75))),
    debate_moments: normalizeDebateMoments(match, source.source_id, sourceMatchKey),
    phrase_bank: normalizePhraseBank(match, source.source_id, sourceMatchKey),
    judging_lessons: normalizeJudgingLessons(match, source.source_id, sourceMatchKey),
    rejected_reason: asString(match.rejected_reason) || null,
  };
}

function isSeedCorpus(value: JsonRecord) {
  return Array.isArray(value.sources) && Array.isArray(value.canonical_matches);
}

function normalizeSourceBundle(value: JsonRecord, index: number): DebateCorpusSeed {
  if (isSeedCorpus(value)) return value as unknown as DebateCorpusSeed;

  const sourceRecord = isRecord(value.source) ? value.source : value;
  const source = normalizeSource(sourceRecord, index);
  const matches = asArray(value.matches)
    .filter(isRecord)
    .map((match, matchIndex) => normalizeMatch(match, source, matchIndex));

  return {
    schema_version: "corpus_import_v1",
    generated_at: new Date().toISOString(),
    sources: [source],
    canonical_matches: matches,
  };
}

function mergeSeeds(seeds: DebateCorpusSeed[]): DebateCorpusSeed {
  const sourcesById = new Map<string, DebateCorpusSourceSeed>();
  const matchesByKey = new Map<string, DebateCorpusCanonicalMatchSeed>();

  for (const seed of seeds) {
    for (const source of seed.sources) sourcesById.set(source.source_id, source);
    for (const match of seed.canonical_matches) {
      const existing = matchesByKey.get(match.canonical_match_key);
      if (!existing) {
        matchesByKey.set(match.canonical_match_key, match);
      } else {
        matchesByKey.set(match.canonical_match_key, {
          ...existing,
          source_match_refs: [
            ...existing.source_match_refs,
            ...match.source_match_refs,
          ],
          debate_moments: [
            ...(existing.debate_moments ?? []),
            ...(match.debate_moments ?? []),
          ],
          phrase_bank: [
            ...(existing.phrase_bank ?? []),
            ...(match.phrase_bank ?? []),
          ],
          judging_lessons: [
            ...(existing.judging_lessons ?? []),
            ...(match.judging_lessons ?? []),
          ],
        });
      }
    }
  }

  return {
    schema_version: "corpus_import_v1",
    generated_at: new Date().toISOString(),
    sources: [...sourcesById.values()],
    canonical_matches: [...matchesByKey.values()],
  };
}

export function parseCorpusImportText(content: string): CorpusImportParseResult {
  const parsed = parseJsonOrMarkdown(content);
  const objects = parsed.objects.flatMap((value) =>
    Array.isArray(value) ? value : [value]
  );
  const seeds = objects
    .filter(isRecord)
    .map((object, index) => normalizeSourceBundle(object, index));
  if (seeds.length === 0) {
    throw new Error("No importable corpus source object was found.");
  }
  return {
    seed: mergeSeeds(seeds),
    inputFormat: parsed.inputFormat,
    objectCount: seeds.length,
  };
}

export function inferCorpusMotionCategory(motionVi: string): CorpusMotionCandidatePlan["categoryKey"] {
  if (/(trường|học|giáo dục|thi|tốt nghiệp|ngữ văn|học sinh|đại học)/i.test(motionVi)) {
    return "education";
  }
  if (/(truyền thông|mạng xã hội|chatgpt|ai|công nghệ|điện thoại)/i.test(motionVi)) {
    return "technology";
  }
  if (/(môi trường|khí hậu|năng lượng|rác|nhựa)/i.test(motionVi)) {
    return "environment";
  }
  if (/(đạo đức|pháp luật|cấm|trừng phạt|quyền|công bằng)/i.test(motionVi)) {
    return "ethics";
  }
  if (/(văn hóa|gia đình|người trẻ|người nổi tiếng|độc thân)/i.test(motionVi)) {
    return "society";
  }
  return "vietnam";
}

export function inferCorpusMotionDifficulty(motionVi: string): CorpusMotionCandidatePlan["difficulty"] {
  if (/(nhà nước|bộ giáo dục|kỳ thi|chấm dứt|bắt buộc|pháp luật|thương mại)/i.test(motionVi)) {
    return "advanced";
  }
  if (/(nên cấm|nên bỏ|nên ngừng|cần được)/i.test(motionVi)) {
    return "intermediate";
  }
  return "beginner";
}

export function buildCorpusMotionCandidatePlans(seed: DebateCorpusSeed): CorpusMotionCandidatePlan[] {
  const sourceById = new Map(seed.sources.map((source) => [source.source_id, source]));
  return seed.canonical_matches
    .filter((match) => match.import_decision !== "reject")
    .map((match) => {
      const firstRef = match.source_match_refs[0];
      const source = firstRef ? sourceById.get(firstRef.source_id) : null;
      return {
        canonicalMatchKey: match.canonical_match_key,
        sourceId: source?.source_id ?? null,
        motionVi: match.motion.vi,
        motionEn: match.motion.en_translation ?? null,
        normalizedTitleHash: hashCorpusMotionTitle(match.motion.vi),
        motionKey: match.motion.motion_key || slugifyCorpusText(match.motion.vi, "motion"),
        categoryKey: inferCorpusMotionCategory(match.motion.vi),
        difficulty: inferCorpusMotionDifficulty(match.motion.vi),
        sourceStage: source?.stage ?? null,
        sourceSeason: source?.season ?? null,
        sourceUrl: source?.youtube_url ?? firstRef?.youtube_url ?? null,
        teams: match.teams,
        metadata: {
          canonicalMatchKey: match.canonical_match_key,
          aggregateConfidence: match.aggregate_confidence,
          sourceMatchRefs: match.source_match_refs,
        },
      };
    });
}

export function summarizeCorpusSeed(seed: DebateCorpusSeed) {
  return {
    sources: seed.sources.length,
    matches: seed.canonical_matches.length,
    items: buildDebateCorpusItemPlans(seed).length,
    motions: buildCorpusMotionCandidatePlans(seed).length,
  };
}
