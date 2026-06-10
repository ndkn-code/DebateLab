import { createHash } from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";

type SourceType =
  | "single_match_episode"
  | "multi_match_compilation"
  | "highlight_reel"
  | "unclear";
type SegmentType =
  | "mc"
  | "debater_speech"
  | "poi"
  | "judge_feedback"
  | "backstage"
  | "sponsor"
  | "award"
  | "unclear";
type Side = "proposition" | "opposition" | "neutral" | "unknown";
type TeamSide = "proposition" | "opposition" | "unknown";
type MomentType =
  | "definition"
  | "burden"
  | "mechanism"
  | "evidence"
  | "rebuttal"
  | "weighing"
  | "clash"
  | "closing"
  | "judging"
  | "style";
type UsableFor = "rebuttal" | "judging" | "phrase_bank" | "prep_helper" | "eval";
type EvidenceStatus =
  | "verified_from_video"
  | "mentioned_but_unverified"
  | "uncertain_stt"
  | "not_applicable";
type ImportStatus = "approved" | "needs_review" | "do_not_import";
type PhraseFunction =
  | "burden"
  | "mechanism"
  | "assumption_attack"
  | "world_comparison"
  | "weighing"
  | "crystallization"
  | "polite_attack"
  | "transition";

interface RawSourceObject {
  source?: Record<string, unknown>;
  matches?: RawMatch[];
  cross_source_notes?: Record<string, unknown>;
}

interface RawMatch {
  match_key?: unknown;
  match_confidence?: unknown;
  motion?: Record<string, unknown>;
  teams?: Array<Record<string, unknown>>;
  segment_map?: Array<Record<string, unknown>>;
  debate_moments?: Array<Record<string, unknown>>;
  phrase_bank?: Array<Record<string, unknown>>;
  judging_lessons?: Array<Record<string, unknown>>;
  case_skeletons?: Array<Record<string, unknown>>;
  extraction_notes?: Record<string, unknown>;
}

interface CorpusIssue {
  severity: "info" | "warning" | "error";
  code: string;
  path: string;
  message: string;
  value?: unknown;
}

interface NormalizedSource {
  source_id: string;
  source_index: number;
  video_title: string;
  youtube_url: string;
  youtube_video_id: string | null;
  source_type: SourceType;
  season: number | null;
  episode: string | null;
  stage: string | null;
  language: string;
  transcript_quality: "excellent" | "good" | "medium" | "poor";
  overall_confidence: number;
  recommended_import_status: ImportStatus;
  recommended_use: UsableFor[];
  reason: string | null;
  raw_line: number;
}

interface NormalizedTeam {
  team_name: string;
  team_key: string;
  side: TeamSide;
  confidence: number;
}

interface NormalizedSegment {
  segment_type: SegmentType;
  approx_start: string | null;
  approx_end: string | null;
  speaker_or_role: string | null;
  side: Side;
  summary: string;
  confidence: number;
}

interface NormalizedMoment {
  moment_id: string;
  source_id: string;
  source_match_key: string;
  moment_key: string;
  moment_type: MomentType;
  side: Side;
  approx_timestamp: string | null;
  short_paraphrase: string;
  strategic_value: string;
  what_strong_ai_should_notice: string;
  what_weak_ai_would_miss: string;
  usable_for: UsableFor[];
  evidence_status: EvidenceStatus;
  confidence: number;
  canonical_fingerprint: string;
}

interface NormalizedPhrase {
  phrase_id: string;
  source_id: string;
  source_match_key: string;
  phrase_vi: string;
  function: PhraseFunction;
  english_meaning: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  natural_truong_teen_style: boolean;
  confidence: number;
  canonical_fingerprint: string;
}

interface NormalizedJudgingLesson {
  lesson_id: string;
  source_id: string;
  source_match_key: string;
  lesson: string;
  rewarded_behavior: string;
  penalized_behavior: string;
  thinkfy_judge_rule: string;
  evidence_status: EvidenceStatus;
  confidence: number;
  canonical_fingerprint: string;
}

interface NormalizedCaseSkeletonClaim {
  side: Side;
  label: string;
  claim: string;
  mechanism: string;
  impact: string;
  answerability: string | null;
}

interface NormalizedCaseSkeleton {
  skeleton_id: string;
  source_id: string;
  source_match_key: string;
  side: Side;
  independent_claims: NormalizedCaseSkeletonClaim[];
  mechanisms: string[];
  examples: string[];
  weighing_hooks: string[];
  common_clashes: string[];
  evidence_status: EvidenceStatus;
  confidence: number;
  canonical_fingerprint: string;
}

interface NormalizedMatch {
  source_id: string;
  source_match_key: string;
  canonical_match_key: string;
  import_status: ImportStatus;
  import_decision: "candidate" | "phrase_only" | "metadata_only" | "reject";
  import_notes: string[];
  match_confidence: number;
  motion: {
    vi: string;
    en_translation: string | null;
    motion_confidence: number;
    motion_key: string;
  };
  teams: NormalizedTeam[];
  segment_map: NormalizedSegment[];
  debate_moments: NormalizedMoment[];
  phrase_bank: NormalizedPhrase[];
  judging_lessons: NormalizedJudgingLesson[];
  case_skeletons: NormalizedCaseSkeleton[];
  extraction_notes: {
    uncertain_areas: string[];
    possible_stt_errors: string[];
    non_debate_sections_to_ignore: string[];
    human_review_needed: boolean;
  };
}

interface CanonicalMatch {
  canonical_match_key: string;
  motion: NormalizedMatch["motion"];
  teams: NormalizedTeam[];
  source_match_refs: Array<{
    source_id: string;
    source_match_key: string;
    youtube_url: string;
    match_confidence: number;
    import_decision: NormalizedMatch["import_decision"];
  }>;
  import_decision: NormalizedMatch["import_decision"];
  aggregate_confidence: number;
  debate_moments: NormalizedMoment[];
  phrase_bank: NormalizedPhrase[];
  judging_lessons: NormalizedJudgingLesson[];
  case_skeletons: NormalizedCaseSkeleton[];
  rejected_reason: string | null;
}

interface NormalizedCorpus {
  schema_version: "truong_teen_corpus_seed_v0";
  input_file: string;
  generated_at: string;
  summary: {
    sources: number;
    unique_youtube_urls: number;
    source_types: Record<string, number>;
    source_statuses: Record<string, number>;
    source_matches: number;
    canonical_matches: number;
    candidate_matches: number;
    phrase_only_matches: number;
    metadata_only_matches: number;
    rejected_matches: number;
    debate_moments: number;
    phrase_bank_entries: number;
    judging_lessons: number;
    case_skeletons: number;
    issues: Record<CorpusIssue["severity"], number>;
  };
  sources: NormalizedSource[];
  source_matches: NormalizedMatch[];
  canonical_matches: CanonicalMatch[];
  issues: CorpusIssue[];
}

const SOURCE_TYPE_VALUES = new Set<SourceType>([
  "single_match_episode",
  "multi_match_compilation",
  "highlight_reel",
  "unclear",
]);
const SEGMENT_TYPE_VALUES = new Set<SegmentType>([
  "mc",
  "debater_speech",
  "poi",
  "judge_feedback",
  "backstage",
  "sponsor",
  "award",
  "unclear",
]);
const SIDE_VALUES = new Set<Side>([
  "proposition",
  "opposition",
  "neutral",
  "unknown",
]);
const TEAM_SIDE_VALUES = new Set<TeamSide>([
  "proposition",
  "opposition",
  "unknown",
]);
const MOMENT_TYPE_VALUES = new Set<MomentType>([
  "definition",
  "burden",
  "mechanism",
  "evidence",
  "rebuttal",
  "weighing",
  "clash",
  "closing",
  "judging",
  "style",
]);
const USABLE_FOR_VALUES = new Set<UsableFor>([
  "rebuttal",
  "judging",
  "phrase_bank",
  "prep_helper",
  "eval",
]);
const EVIDENCE_STATUS_VALUES = new Set<EvidenceStatus>([
  "verified_from_video",
  "mentioned_but_unverified",
  "uncertain_stt",
  "not_applicable",
]);
const IMPORT_STATUS_VALUES = new Set<ImportStatus>([
  "approved",
  "needs_review",
  "do_not_import",
]);
const PHRASE_FUNCTION_VALUES = new Set<PhraseFunction>([
  "burden",
  "mechanism",
  "assumption_attack",
  "world_comparison",
  "weighing",
  "crystallization",
  "polite_attack",
  "transition",
]);

const SIDE_ALIASES: Record<string, Side> = {
  unclear: "unknown",
  proposition: "proposition",
  opposition: "opposition",
  neutral: "neutral",
  unknown: "unknown",
};

const USABLE_FOR_ALIASES: Record<string, UsableFor | null> = {
  rebuttal: "rebuttal",
  judging: "judging",
  phrase_bank: "phrase_bank",
  prep_helper: "prep_helper",
  eval: "eval",
  style: "phrase_bank",
  weighing: "judging",
  evidence: "eval",
};

const PHRASE_FUNCTION_ALIASES: Record<string, PhraseFunction> = {
  burden: "burden",
  mechanism: "mechanism",
  assumption_attack: "assumption_attack",
  world_comparison: "world_comparison",
  weighing: "weighing",
  crystallization: "crystallization",
  polite_attack: "polite_attack",
  transition: "transition",
  definition: "burden",
};

function addIssue(
  issues: CorpusIssue[],
  severity: CorpusIssue["severity"],
  code: string,
  pathName: string,
  message: string,
  value?: unknown
) {
  issues.push({ severity, code, path: pathName, message, value });
}

function asString(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function asNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function clampConfidence(
  value: unknown,
  pathName: string,
  issues: CorpusIssue[],
  fallback = 0.5
) {
  const num = asNumber(value, fallback);
  if (num < 0 || num > 1) {
    addIssue(
      issues,
      "warning",
      "confidence_clamped",
      pathName,
      "Confidence was outside 0-1 and was clamped.",
      value
    );
  }
  return Math.max(0, Math.min(1, num));
}

function asStringArray(value: unknown) {
  return Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)
    : [];
}

function asRecordArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter(
        (item): item is Record<string, unknown> =>
          Boolean(item && typeof item === "object" && !Array.isArray(item))
      )
    : [];
}

export function normalizeTextKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function slugify(value: string) {
  return normalizeTextKey(value).replace(/\s+/g, "_").slice(0, 80);
}

function teamKeyFor(value: string) {
  const normalized = normalizeTextKey(value)
    .replace(/\btrung hoc pho thong\b/g, " ")
    .replace(/\bthpt\b/g, " ")
    .replace(/\bchuyen\b/g, " ")
    .replace(/\bthanh pho ho chi minh\b/g, "tp hcm")
    .replace(/\btp ho chi minh\b/g, "tp hcm")
    .replace(/\btphcm\b/g, "tp hcm")
    .replace(/\bdhqg hcm\b/g, "dhqg tp hcm")
    .replace(/\bho chi minh\b/g, "tp hcm")
    .replace(/\s+/g, " ")
    .trim();

  return slugify(normalized);
}

function hash(value: string, length = 12) {
  return createHash("sha256").update(value).digest("hex").slice(0, length);
}

function compactWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeYoutubeUrl(value: unknown, pathName: string, issues: CorpusIssue[]) {
  const raw = asString(value);
  const match = raw.match(/https?:\/\/[^\]\s)]+/);
  const extracted = match?.[0] ?? raw;

  if (raw && raw !== extracted) {
    addIssue(
      issues,
      "info",
      "markdown_url_normalized",
      pathName,
      "Markdown-formatted YouTube URL was normalized to a plain URL.",
      raw
    );
  }

  if (!extracted) {
    return "";
  }

  try {
    const url = new URL(extracted);
    url.searchParams.delete("si");
    return url.toString().replace(/[?&]$/, "");
  } catch {
    addIssue(
      issues,
      "warning",
      "invalid_url",
      pathName,
      "YouTube URL could not be parsed.",
      raw
    );
    return extracted;
  }
}

function youtubeVideoId(url: string) {
  try {
    const parsed = new URL(url);
    if (parsed.hostname === "youtu.be") {
      return parsed.pathname.replace("/", "") || null;
    }
    return parsed.searchParams.get("v");
  } catch {
    return null;
  }
}

function normalizeSourceType(
  value: unknown,
  pathName: string,
  issues: CorpusIssue[]
): SourceType {
  const raw = asString(value, "unclear") as SourceType;
  if (SOURCE_TYPE_VALUES.has(raw)) {
    return raw;
  }
  addIssue(issues, "warning", "invalid_source_type", pathName, "Unknown source type.", value);
  return "unclear";
}

function normalizeSegmentType(
  value: unknown,
  pathName: string,
  issues: CorpusIssue[]
): SegmentType {
  const raw = asString(value, "unclear") as SegmentType;
  if (SEGMENT_TYPE_VALUES.has(raw)) {
    return raw;
  }
  addIssue(issues, "warning", "invalid_segment_type", pathName, "Unknown segment type.", value);
  return "unclear";
}

function normalizeSide(value: unknown, pathName: string, issues: CorpusIssue[]): Side {
  const raw = asString(value, "unknown");
  const normalized = SIDE_ALIASES[raw] ?? null;
  if (normalized) {
    if (raw !== normalized) {
      addIssue(issues, "info", "side_alias_normalized", pathName, "Side alias was normalized.", value);
    }
    return normalized;
  }
  addIssue(issues, "warning", "invalid_side", pathName, "Unknown side.", value);
  return "unknown";
}

function normalizeTeamSide(value: unknown, pathName: string, issues: CorpusIssue[]): TeamSide {
  const side = normalizeSide(value, pathName, issues);
  if (side === "neutral") {
    addIssue(issues, "warning", "neutral_team_side", pathName, "Team side cannot be neutral.", value);
    return "unknown";
  }
  if (TEAM_SIDE_VALUES.has(side)) {
    return side;
  }
  return "unknown";
}

function normalizeMomentType(
  value: unknown,
  pathName: string,
  issues: CorpusIssue[]
): MomentType {
  const raw = asString(value, "style") as MomentType;
  if (MOMENT_TYPE_VALUES.has(raw)) {
    return raw;
  }
  addIssue(issues, "warning", "invalid_moment_type", pathName, "Unknown moment type.", value);
  return "style";
}

function normalizeUsableFor(
  value: unknown,
  pathName: string,
  issues: CorpusIssue[]
): UsableFor[] {
  const raw = Array.isArray(value) ? value : [];
  const out = new Set<UsableFor>();
  raw.forEach((item, index) => {
    const token = asString(item);
    const normalized = USABLE_FOR_ALIASES[token];
    if (normalized === undefined) {
      addIssue(
        issues,
        "warning",
        "invalid_usable_for",
        `${pathName}[${index}]`,
        "Unknown usable_for value was dropped.",
        item
      );
      return;
    }
    if (normalized === null) {
      return;
    }
    if (token !== normalized && !USABLE_FOR_VALUES.has(token as UsableFor)) {
      addIssue(
        issues,
        "info",
        "usable_for_alias_normalized",
        `${pathName}[${index}]`,
        "usable_for alias was normalized.",
        item
      );
    }
    out.add(normalized);
  });
  return [...out];
}

function normalizeEvidenceStatus(
  value: unknown,
  pathName: string,
  issues: CorpusIssue[]
): EvidenceStatus {
  const raw = asString(value, "not_applicable") as EvidenceStatus;
  if (EVIDENCE_STATUS_VALUES.has(raw)) {
    return raw;
  }
  addIssue(
    issues,
    "warning",
    "invalid_evidence_status",
    pathName,
    "Unknown evidence status.",
    value
  );
  return "mentioned_but_unverified";
}

function normalizeImportStatus(
  value: unknown,
  pathName: string,
  issues: CorpusIssue[]
): ImportStatus {
  const raw = asString(value, "needs_review") as ImportStatus;
  if (IMPORT_STATUS_VALUES.has(raw)) {
    return raw;
  }
  addIssue(issues, "warning", "invalid_import_status", pathName, "Unknown import status.", value);
  return "needs_review";
}

function normalizePhraseFunction(
  value: unknown,
  pathName: string,
  issues: CorpusIssue[]
): PhraseFunction {
  const raw = asString(value, "transition");
  const normalized = PHRASE_FUNCTION_ALIASES[raw];
  if (normalized) {
    if (raw !== normalized && !PHRASE_FUNCTION_VALUES.has(raw as PhraseFunction)) {
      addIssue(
        issues,
        "info",
        "phrase_function_alias_normalized",
        pathName,
        "Phrase function alias was normalized.",
        value
      );
    }
    return normalized;
  }
  addIssue(
    issues,
    "warning",
    "invalid_phrase_function",
    pathName,
    "Unknown phrase function.",
    value
  );
  return "transition";
}

function normalizeDifficulty(value: unknown) {
  const raw = asString(value, "intermediate");
  return raw === "beginner" || raw === "intermediate" || raw === "advanced"
    ? raw
    : "intermediate";
}

export function splitTopLevelJsonObjects(text: string) {
  const chunks: Array<{ start: number; end: number; text: string; line: number }> = [];
  let depth = 0;
  let start = -1;
  let inString = false;
  let escaped = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === "\"") {
        inString = false;
      }
      continue;
    }

    if (char === "\"") {
      inString = true;
      continue;
    }

    if (char === "{") {
      if (depth === 0) {
        start = index;
      }
      depth += 1;
      continue;
    }

    if (char === "}") {
      depth -= 1;
      if (depth === 0 && start >= 0) {
        chunks.push({
          start,
          end: index + 1,
          text: text.slice(start, index + 1),
          line: text.slice(0, start).split("\n").length,
        });
        start = -1;
      }
    }
  }

  return chunks;
}

function sourceIdFor(url: string, index: number) {
  const id = youtubeVideoId(url);
  return id ? `yt_${id}` : `source_${index + 1}_${hash(url || String(index))}`;
}

function canonicalMatchKeyFor(motionKey: string, teams: NormalizedTeam[]) {
  const prop = teams.find((team) => team.side === "proposition")?.team_key ?? "prop_unknown";
  const opp = teams.find((team) => team.side === "opposition")?.team_key ?? "opp_unknown";
  return `${slugify(motionKey)}__${prop}_vs_${opp}`.slice(0, 160);
}

function momentFingerprint(moment: Pick<NormalizedMoment, "moment_type" | "side" | "short_paraphrase">) {
  return hash(
    `${moment.moment_type}|${moment.side}|${normalizeTextKey(moment.short_paraphrase)}`,
    16
  );
}

function phraseFingerprint(phrase: Pick<NormalizedPhrase, "phrase_vi" | "function">) {
  return hash(`${phrase.function}|${normalizeTextKey(phrase.phrase_vi)}`, 16);
}

function lessonFingerprint(lesson: Pick<NormalizedJudgingLesson, "lesson" | "thinkfy_judge_rule">) {
  return hash(`${normalizeTextKey(lesson.lesson)}|${normalizeTextKey(lesson.thinkfy_judge_rule)}`, 16);
}

function skeletonFingerprint(
  skeleton: Pick<NormalizedCaseSkeleton, "side" | "independent_claims" | "weighing_hooks">
) {
  return hash(
    [
      skeleton.side,
      ...skeleton.independent_claims.map((claim) =>
        `${claim.side}|${normalizeTextKey(claim.label)}|${normalizeTextKey(claim.claim)}`
      ),
      ...skeleton.weighing_hooks.map(normalizeTextKey),
    ].join("|"),
    16
  );
}

function normalizeSource(
  raw: RawSourceObject,
  sourceIndex: number,
  rawLine: number,
  issues: CorpusIssue[]
): NormalizedSource {
  const source = raw.source ?? {};
  const notes = raw.cross_source_notes ?? {};
  const youtubeUrl = normalizeYoutubeUrl(
    source.youtube_url,
    `sources[${sourceIndex}].source.youtube_url`,
    issues
  );
  const sourceType = normalizeSourceType(
    source.source_type,
    `sources[${sourceIndex}].source.source_type`,
    issues
  );
  const transcriptQuality = asString(source.transcript_quality, "medium");
  const normalizedTranscriptQuality =
    sourceType === "multi_match_compilation" &&
    (transcriptQuality === "excellent" || transcriptQuality === "good")
      ? "medium"
      : transcriptQuality;

  if (transcriptQuality !== normalizedTranscriptQuality) {
    addIssue(
      issues,
      "info",
      "compilation_quality_downgraded",
      `sources[${sourceIndex}].source.transcript_quality`,
      "Compilation transcript quality was normalized to medium for import safety.",
      transcriptQuality
    );
  }

  return {
    source_id: sourceIdFor(youtubeUrl, sourceIndex),
    source_index: sourceIndex + 1,
    video_title: asString(source.video_title),
    youtube_url: youtubeUrl,
    youtube_video_id: youtubeVideoId(youtubeUrl),
    source_type: sourceType,
    season: typeof source.season === "number" ? source.season : null,
    episode: asString(source.episode) || null,
    stage: asString(source.stage) || null,
    language: asString(source.language, "vi"),
    transcript_quality: (
      normalizedTranscriptQuality === "excellent" ||
      normalizedTranscriptQuality === "good" ||
      normalizedTranscriptQuality === "medium" ||
      normalizedTranscriptQuality === "poor"
        ? normalizedTranscriptQuality
        : "medium"
    ) as NormalizedSource["transcript_quality"],
    overall_confidence: clampConfidence(
      source.overall_confidence,
      `sources[${sourceIndex}].source.overall_confidence`,
      issues,
      0.5
    ),
    recommended_import_status: normalizeImportStatus(
      notes.recommended_import_status,
      `sources[${sourceIndex}].cross_source_notes.recommended_import_status`,
      issues
    ),
    recommended_use: normalizeUsableFor(
      notes.recommended_use,
      `sources[${sourceIndex}].cross_source_notes.recommended_use`,
      issues
    ),
    reason: asString(notes.reason) || null,
    raw_line: rawLine,
  };
}

function normalizeMatch(
  raw: RawMatch,
  source: NormalizedSource,
  sourceIndex: number,
  matchIndex: number,
  issues: CorpusIssue[]
): NormalizedMatch {
  const pathBase = `sources[${sourceIndex}].matches[${matchIndex}]`;
  const sourceMatchKey =
    asString(raw.match_key) ||
    `match_${source.source_index}_${matchIndex + 1}_${hash(JSON.stringify(raw.motion ?? {}), 8)}`;
  const motionVi = compactWhitespace(asString(raw.motion?.vi));
  const motionKey = normalizeTextKey(motionVi);
  const teams = (raw.teams ?? []).map((team, teamIndex) => {
    const teamName = compactWhitespace(asString(team.team_name, "Unknown team"));
    return {
      team_name: teamName,
      team_key: teamKeyFor(teamName),
      side: normalizeTeamSide(team.side, `${pathBase}.teams[${teamIndex}].side`, issues),
      confidence: clampConfidence(
        team.confidence,
        `${pathBase}.teams[${teamIndex}].confidence`,
        issues,
        0.5
      ),
    };
  });
  const canonicalMatchKey = canonicalMatchKeyFor(motionKey, teams);

  const segmentMap = (raw.segment_map ?? []).map((segment, segmentIndex) => ({
    segment_type: normalizeSegmentType(
      segment.segment_type,
      `${pathBase}.segment_map[${segmentIndex}].segment_type`,
      issues
    ),
    approx_start: asString(segment.approx_start) || null,
    approx_end: asString(segment.approx_end) || null,
    speaker_or_role: asString(segment.speaker_or_role) || null,
    side: normalizeSide(segment.side, `${pathBase}.segment_map[${segmentIndex}].side`, issues),
    summary: compactWhitespace(asString(segment.summary)),
    confidence: clampConfidence(
      segment.confidence,
      `${pathBase}.segment_map[${segmentIndex}].confidence`,
      issues,
      0.5
    ),
  }));

  const debateMoments = (raw.debate_moments ?? []).map((moment, momentIndex) => {
    const normalized: Omit<NormalizedMoment, "moment_id" | "canonical_fingerprint"> = {
      source_id: source.source_id,
      source_match_key: sourceMatchKey,
      moment_key: asString(moment.moment_key, `moment_${momentIndex + 1}`),
      moment_type: normalizeMomentType(
        moment.moment_type,
        `${pathBase}.debate_moments[${momentIndex}].moment_type`,
        issues
      ),
      side: normalizeSide(moment.side, `${pathBase}.debate_moments[${momentIndex}].side`, issues),
      approx_timestamp: asString(moment.approx_timestamp) || null,
      short_paraphrase: compactWhitespace(asString(moment.short_paraphrase)),
      strategic_value: compactWhitespace(asString(moment.strategic_value)),
      what_strong_ai_should_notice: compactWhitespace(asString(moment.what_strong_ai_should_notice)),
      what_weak_ai_would_miss: compactWhitespace(asString(moment.what_weak_ai_would_miss)),
      usable_for: normalizeUsableFor(
        moment.usable_for,
        `${pathBase}.debate_moments[${momentIndex}].usable_for`,
        issues
      ),
      evidence_status: normalizeEvidenceStatus(
        moment.evidence_status,
        `${pathBase}.debate_moments[${momentIndex}].evidence_status`,
        issues
      ),
      confidence: clampConfidence(
        moment.confidence,
        `${pathBase}.debate_moments[${momentIndex}].confidence`,
        issues,
        0.5
      ),
    };
    const fingerprint = momentFingerprint(normalized);
    return {
      ...normalized,
      moment_id: `moment_${source.source_id}_${sourceMatchKey}_${fingerprint}`,
      canonical_fingerprint: fingerprint,
    };
  });

  const phraseBank = (raw.phrase_bank ?? []).map((phrase, phraseIndex) => {
    const englishMeaning = asString(phrase.english_meaning) || asString(phrase.phrase_en);
    if (!phrase.english_meaning && phrase.phrase_en) {
      addIssue(
        issues,
        "info",
        "phrase_en_normalized",
        `${pathBase}.phrase_bank[${phraseIndex}].phrase_en`,
        "phrase_en was normalized to english_meaning.",
        phrase.phrase_en
      );
    }

    const normalized: Omit<NormalizedPhrase, "phrase_id" | "canonical_fingerprint"> = {
      source_id: source.source_id,
      source_match_key: sourceMatchKey,
      phrase_vi: compactWhitespace(asString(phrase.phrase_vi)),
      function: normalizePhraseFunction(
        phrase.function,
        `${pathBase}.phrase_bank[${phraseIndex}].function`,
        issues
      ),
      english_meaning: compactWhitespace(englishMeaning),
      difficulty: normalizeDifficulty(phrase.difficulty),
      natural_truong_teen_style: phrase.natural_truong_teen_style !== false,
      confidence: clampConfidence(
        phrase.confidence,
        `${pathBase}.phrase_bank[${phraseIndex}].confidence`,
        issues,
        0.5
      ),
    };
    const fingerprint = phraseFingerprint(normalized);
    return {
      ...normalized,
      phrase_id: `phrase_${source.source_id}_${sourceMatchKey}_${fingerprint}`,
      canonical_fingerprint: fingerprint,
    };
  });

  const judgingLessons = (raw.judging_lessons ?? []).map((lesson, lessonIndex) => {
    const normalized: Omit<NormalizedJudgingLesson, "lesson_id" | "canonical_fingerprint"> = {
      source_id: source.source_id,
      source_match_key: sourceMatchKey,
      lesson: compactWhitespace(asString(lesson.lesson)),
      rewarded_behavior: compactWhitespace(asString(lesson.rewarded_behavior)),
      penalized_behavior: compactWhitespace(asString(lesson.penalized_behavior)),
      thinkfy_judge_rule: compactWhitespace(asString(lesson.thinkfy_judge_rule)),
      evidence_status: normalizeEvidenceStatus(
        lesson.evidence_status,
        `${pathBase}.judging_lessons[${lessonIndex}].evidence_status`,
        issues
      ),
      confidence: clampConfidence(
        lesson.confidence,
        `${pathBase}.judging_lessons[${lessonIndex}].confidence`,
        issues,
        0.5
      ),
    };
    const fingerprint = lessonFingerprint(normalized);
    return {
      ...normalized,
      lesson_id: `lesson_${source.source_id}_${sourceMatchKey}_${fingerprint}`,
      canonical_fingerprint: fingerprint,
    };
  });

  const caseSkeletons = (raw.case_skeletons ?? [])
    .map((skeleton, skeletonIndex) => {
      const side = normalizeSide(
        skeleton.side,
        `${pathBase}.case_skeletons[${skeletonIndex}].side`,
        issues
      );
      const independentClaims = asRecordArray(skeleton.independent_claims)
        .map((claim, claimIndex) => ({
          side: normalizeSide(
            claim.side ?? side,
            `${pathBase}.case_skeletons[${skeletonIndex}].independent_claims[${claimIndex}].side`,
            issues
          ),
          label: compactWhitespace(asString(claim.label)),
          claim: compactWhitespace(asString(claim.claim)),
          mechanism: compactWhitespace(asString(claim.mechanism)),
          impact: compactWhitespace(asString(claim.impact)),
          answerability: compactWhitespace(asString(claim.answerability)) || null,
        }))
        .filter(
          (claim) =>
            claim.label && claim.claim && claim.mechanism && claim.impact
        );
      const normalized: Omit<
        NormalizedCaseSkeleton,
        "skeleton_id" | "canonical_fingerprint"
      > = {
        source_id: source.source_id,
        source_match_key: sourceMatchKey,
        side,
        independent_claims: independentClaims,
        mechanisms: asStringArray(skeleton.mechanisms).map(compactWhitespace),
        examples: asStringArray(skeleton.examples).map(compactWhitespace),
        weighing_hooks: asStringArray(skeleton.weighing_hooks).map(compactWhitespace),
        common_clashes: asStringArray(skeleton.common_clashes).map(compactWhitespace),
        evidence_status: normalizeEvidenceStatus(
          skeleton.evidence_status,
          `${pathBase}.case_skeletons[${skeletonIndex}].evidence_status`,
          issues
        ),
        confidence: clampConfidence(
          skeleton.confidence,
          `${pathBase}.case_skeletons[${skeletonIndex}].confidence`,
          issues,
          0.5
        ),
      };
      const fingerprint = skeletonFingerprint(normalized);
      return {
        ...normalized,
        skeleton_id: `case_${source.source_id}_${sourceMatchKey}_${fingerprint}`,
        canonical_fingerprint: fingerprint,
      };
    })
    .filter((skeleton) => skeleton.independent_claims.length > 0);

  const importNotes: string[] = [];
  const extractionNotes = {
    uncertain_areas: asStringArray(raw.extraction_notes?.uncertain_areas),
    possible_stt_errors: asStringArray(raw.extraction_notes?.possible_stt_errors),
    non_debate_sections_to_ignore: asStringArray(raw.extraction_notes?.non_debate_sections_to_ignore),
    human_review_needed:
      source.source_type === "multi_match_compilation" ||
      raw.extraction_notes?.human_review_needed !== false,
  };

  if (source.source_type === "multi_match_compilation") {
    importNotes.push("Compilation-derived match requires review before trusted factual use.");
  }

  const importDecision = decideImport({
    debateMoments,
    phraseBank,
    judgingLessons,
    caseSkeletons,
    matchConfidence: clampConfidence(
      raw.match_confidence,
      `${pathBase}.match_confidence`,
      issues,
      0.5
    ),
    sourceStatus: source.recommended_import_status,
    extractionNotes,
    importNotes,
  });

  return {
    source_id: source.source_id,
    source_match_key: sourceMatchKey,
    canonical_match_key: canonicalMatchKey,
    import_status: source.recommended_import_status,
    import_decision: importDecision,
    import_notes: importNotes,
    match_confidence: clampConfidence(
      raw.match_confidence,
      `${pathBase}.match_confidence`,
      issues,
      0.5
    ),
    motion: {
      vi: motionVi,
      en_translation: asString(raw.motion?.en_translation) || null,
      motion_confidence: clampConfidence(
        raw.motion?.motion_confidence,
        `${pathBase}.motion.motion_confidence`,
        issues,
        0.5
      ),
      motion_key: motionKey,
    },
    teams,
    segment_map: segmentMap,
    debate_moments: debateMoments,
    phrase_bank: phraseBank,
    judging_lessons: judgingLessons,
    case_skeletons: caseSkeletons,
    extraction_notes: extractionNotes,
  };
}

function decideImport(input: {
  debateMoments: NormalizedMoment[];
  phraseBank: NormalizedPhrase[];
  judgingLessons: NormalizedJudgingLesson[];
  caseSkeletons: NormalizedCaseSkeleton[];
  matchConfidence: number;
  sourceStatus: ImportStatus;
  extractionNotes: NormalizedMatch["extraction_notes"];
  importNotes: string[];
}): NormalizedMatch["import_decision"] {
  if (input.sourceStatus === "do_not_import") {
    input.importNotes.push("Source-level status is do_not_import.");
    return "reject";
  }

  if (input.debateMoments.length === 0 && input.caseSkeletons.length === 0) {
    input.importNotes.push("No debate moments or case skeletons; keep only source/match metadata.");
    return input.phraseBank.length > 0 ? "phrase_only" : "metadata_only";
  }

  if (input.matchConfidence < 0.75) {
    input.importNotes.push("Low match confidence; use only phrases/metadata unless reviewed.");
    return input.caseSkeletons.length > 0
      ? "candidate"
      : input.phraseBank.length > 0
        ? "phrase_only"
        : "metadata_only";
  }

  if (input.debateMoments.length < 2 && input.judgingLessons.length === 0) {
    input.importNotes.push("Too few strategic moments for RAG; phrase/style only.");
    return input.caseSkeletons.length > 0
      ? "candidate"
      : input.phraseBank.length > 0
        ? "phrase_only"
        : "metadata_only";
  }

  return "candidate";
}

function bestByConfidence<T extends { confidence: number }>(items: T[], fingerprint: (item: T) => string) {
  const map = new Map<string, T>();
  items.forEach((item) => {
    const key = fingerprint(item);
    const current = map.get(key);
    if (!current || item.confidence > current.confidence) {
      map.set(key, item);
    }
  });
  return [...map.values()].sort((a, b) => b.confidence - a.confidence);
}

function buildCanonicalMatches(
  matches: NormalizedMatch[],
  sourcesById: Map<string, NormalizedSource>
): CanonicalMatch[] {
  const groups = new Map<string, NormalizedMatch[]>();
  matches.forEach((match) => {
    const existing = groups.get(match.canonical_match_key) ?? [];
    existing.push(match);
    groups.set(match.canonical_match_key, existing);
  });

  return [...groups.entries()]
    .map(([canonicalMatchKey, group]) => {
      const viable = group.filter((match) => match.import_decision === "candidate");
      const phraseOnly = group.filter((match) => match.import_decision === "phrase_only");
      const bestMatch = [...viable, ...phraseOnly, ...group].sort(
        (a, b) => b.match_confidence - a.match_confidence
      )[0]!;
      const decision: NormalizedMatch["import_decision"] =
        viable.length > 0
          ? "candidate"
          : phraseOnly.length > 0
            ? "phrase_only"
            : group.some((match) => match.import_decision === "metadata_only")
              ? "metadata_only"
              : "reject";

      const sourceMatchRefs = group.map((match) => {
        const source = sourcesById.get(match.source_id);
        return {
          source_id: match.source_id,
          source_match_key: match.source_match_key,
          youtube_url: source?.youtube_url ?? "",
          match_confidence: match.match_confidence,
          import_decision: match.import_decision,
        };
      });
      const allMoments = group.flatMap((match) => match.debate_moments);
      const allPhrases = group.flatMap((match) => match.phrase_bank);
      const allLessons = group.flatMap((match) => match.judging_lessons);
      const allCaseSkeletons = group.flatMap((match) => match.case_skeletons);
      const aggregateConfidence =
        group.reduce((sum, match) => sum + match.match_confidence, 0) / group.length;

      return {
        canonical_match_key: canonicalMatchKey,
        motion: bestMatch.motion,
        teams: bestMatch.teams,
        source_match_refs: sourceMatchRefs,
        import_decision: decision,
        aggregate_confidence: Number(aggregateConfidence.toFixed(3)),
        debate_moments: decision === "candidate"
          ? bestByConfidence(allMoments, (moment) => moment.canonical_fingerprint)
          : [],
        phrase_bank: bestByConfidence(allPhrases, (phrase) => phrase.canonical_fingerprint),
        judging_lessons: decision === "candidate" || decision === "phrase_only"
          ? bestByConfidence(allLessons, (lesson) => lesson.canonical_fingerprint)
          : [],
        case_skeletons:
          decision === "candidate" || allCaseSkeletons.length > 0
            ? bestByConfidence(
                allCaseSkeletons,
                (skeleton) => skeleton.canonical_fingerprint
              )
            : [],
        rejected_reason:
          decision === "metadata_only" ? "No usable debate moments in source matches." : null,
      };
    })
    .sort((a, b) => b.source_match_refs.length - a.source_match_refs.length);
}

function countBy<T extends string>(values: T[]) {
  return values.reduce<Record<string, number>>((acc, value) => {
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {});
}

export function normalizeTruongTeenCorpus(inputFile: string, now = "2026-05-24T00:00:00.000Z") {
  const issues: CorpusIssue[] = [];
  const inputText = fs.readFileSync(inputFile, "utf8");
  const chunks = splitTopLevelJsonObjects(inputText);
  const rawObjects: Array<{ raw: RawSourceObject; line: number }> = [];

  chunks.forEach((chunk, index) => {
    try {
      rawObjects.push({ raw: JSON.parse(chunk.text) as RawSourceObject, line: chunk.line });
    } catch (error) {
      addIssue(
        issues,
        "error",
        "json_parse_failed",
        `chunks[${index}]`,
        error instanceof Error ? error.message : "Unknown parse error.",
        chunk.text.slice(0, 100)
      );
    }
  });

  const sources = rawObjects.map(({ raw, line }, index) =>
    normalizeSource(raw, index, line, issues)
  );
  const sourcesById = new Map(sources.map((source) => [source.source_id, source]));
  const sourceMatches = rawObjects.flatMap(({ raw }, sourceIndex) =>
    (raw.matches ?? []).map((match, matchIndex) =>
      normalizeMatch(match, sources[sourceIndex]!, sourceIndex, matchIndex, issues)
    )
  );
  const canonicalMatches = buildCanonicalMatches(sourceMatches, sourcesById);
  const uniqueUrls = new Set(sources.map((source) => source.youtube_url).filter(Boolean));
  const issueCounts = {
    info: issues.filter((issue) => issue.severity === "info").length,
    warning: issues.filter((issue) => issue.severity === "warning").length,
    error: issues.filter((issue) => issue.severity === "error").length,
  };

  const normalized: NormalizedCorpus = {
    schema_version: "truong_teen_corpus_seed_v0",
    input_file: inputFile,
    generated_at: now,
    summary: {
      sources: sources.length,
      unique_youtube_urls: uniqueUrls.size,
      source_types: countBy(sources.map((source) => source.source_type)),
      source_statuses: countBy(sources.map((source) => source.recommended_import_status)),
      source_matches: sourceMatches.length,
      canonical_matches: canonicalMatches.length,
      candidate_matches: canonicalMatches.filter((match) => match.import_decision === "candidate").length,
      phrase_only_matches: canonicalMatches.filter((match) => match.import_decision === "phrase_only").length,
      metadata_only_matches: canonicalMatches.filter((match) => match.import_decision === "metadata_only").length,
      rejected_matches: canonicalMatches.filter((match) => match.import_decision === "reject").length,
      debate_moments: canonicalMatches.reduce(
        (sum, match) => sum + match.debate_moments.length,
        0
      ),
      phrase_bank_entries: canonicalMatches.reduce(
        (sum, match) => sum + match.phrase_bank.length,
        0
      ),
      judging_lessons: canonicalMatches.reduce(
        (sum, match) => sum + match.judging_lessons.length,
        0
      ),
      case_skeletons: canonicalMatches.reduce(
        (sum, match) => sum + match.case_skeletons.length,
        0
      ),
      issues: issueCounts,
    },
    sources,
    source_matches: sourceMatches,
    canonical_matches: canonicalMatches,
    issues,
  };

  return normalized;
}

export function buildMarkdownReport(corpus: NormalizedCorpus) {
  const lines = [
    "# Trường Teen 2025 Corpus Seed Report",
    "",
    `Input: ${corpus.input_file}`,
    `Generated: ${corpus.generated_at}`,
    "",
    "## Summary",
    "",
    `- Sources: ${corpus.summary.sources}`,
    `- Unique YouTube URLs: ${corpus.summary.unique_youtube_urls}`,
    `- Source matches: ${corpus.summary.source_matches}`,
    `- Canonical matches after dedupe: ${corpus.summary.canonical_matches}`,
    `- Candidate RAG matches: ${corpus.summary.candidate_matches}`,
    `- Phrase-only matches: ${corpus.summary.phrase_only_matches}`,
    `- Metadata-only matches: ${corpus.summary.metadata_only_matches}`,
    `- Debate moments after dedupe: ${corpus.summary.debate_moments}`,
    `- Phrase-bank entries after dedupe: ${corpus.summary.phrase_bank_entries}`,
    `- Judging lessons after dedupe: ${corpus.summary.judging_lessons}`,
    `- Case skeletons after dedupe: ${corpus.summary.case_skeletons}`,
    `- Issues: ${corpus.summary.issues.info} info, ${corpus.summary.issues.warning} warning, ${corpus.summary.issues.error} error`,
    "",
    "## Canonical Matches",
    "",
    ...corpus.canonical_matches.flatMap((match) => [
      `### ${match.motion.vi || match.canonical_match_key}`,
      "",
      `- Decision: ${match.import_decision}`,
      `- Sources merged: ${match.source_match_refs.length}`,
      `- Aggregate confidence: ${match.aggregate_confidence}`,
      `- Teams: ${match.teams.map((team) => `${team.team_name} (${team.side})`).join(" vs ")}`,
      `- Moments: ${match.debate_moments.length}`,
      `- Phrases: ${match.phrase_bank.length}`,
      `- Judging lessons: ${match.judging_lessons.length}`,
      `- Case skeletons: ${match.case_skeletons.length}`,
      match.rejected_reason ? `- Reason: ${match.rejected_reason}` : "",
      "",
    ]),
    "## Issue Rollup",
    "",
    ...Object.entries(
      corpus.issues.reduce<Record<string, number>>((acc, issue) => {
        acc[issue.code] = (acc[issue.code] ?? 0) + 1;
        return acc;
      }, {})
    )
      .sort((a, b) => b[1] - a[1])
      .map(([code, count]) => `- ${code}: ${count}`),
    "",
  ];

  return lines.filter((line, index, array) => line !== "" || array[index - 1] !== "").join("\n");
}

function parseArgs(argv: string[]) {
  const args = new Map<string, string | boolean>();
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]!;
    if (!arg.startsWith("--")) {
      continue;
    }
    const key = arg.slice(2);
    const next = argv[index + 1];
    if (next && !next.startsWith("--")) {
      args.set(key, next);
      index += 1;
    } else {
      args.set(key, true);
    }
  }
  return args;
}

if (require.main === module) {
  const args = parseArgs(process.argv.slice(2));
  const input = String(args.get("input") ?? "/Users/jacknguyen/notes.md");
  const outDir = String(args.get("out-dir") ?? "data/corpus");
  const now = String(args.get("generated-at") ?? "2026-05-24T00:00:00.000Z");
  const corpus = normalizeTruongTeenCorpus(input, now);
  fs.mkdirSync(outDir, { recursive: true });
  const jsonPath = path.join(outDir, "truong-teen-2025.seed.normalized.json");
  const reportPath = path.join(outDir, "truong-teen-2025.seed.report.md");
  fs.writeFileSync(jsonPath, `${JSON.stringify(corpus, null, 2)}\n`);
  fs.writeFileSync(reportPath, `${buildMarkdownReport(corpus)}\n`);
  console.log(
    JSON.stringify(
      {
        wrote: [jsonPath, reportPath],
        summary: corpus.summary,
      },
      null,
      2
    )
  );

  if (corpus.summary.issues.error > 0) {
    process.exitCode = 1;
  }
}
