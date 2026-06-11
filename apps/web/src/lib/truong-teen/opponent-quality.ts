export interface TruongTeenOpponentQualityMetrics {
  version: 2;
  wordCount: number;
  paragraphCount: number;
  directRebuttalCueCount: number;
  constructiveCueCount: number;
  weighingCueCount: number;
  crystallizationCueCount: number;
  inventedEvidenceRiskCount: number;
  closingNewArgumentCueCount: number;
  standaloneClaimCount: number;
  rebuttalCueParagraphRatio: number;
  hasStandaloneOffense: boolean;
  hasWeighing: boolean;
  hasInventedEvidenceRisk: boolean;
  hasClosingCrystallization: boolean;
  hasClosingNewArgumentRisk: boolean;
  onlyRebuttalRisk: "low" | "medium" | "high";
}

interface CasePlanForStandaloneOffense {
  independentClaims?: Array<{
    label?: string;
    claim?: string;
    mechanism?: string;
    impact?: string;
    answerability?: string;
  }>;
}

interface OpponentQualityAnalysisOptions {
  sourceText?: string;
}

export interface StandaloneOffenseGuardrailResult {
  text: string;
  metrics: TruongTeenOpponentQualityMetrics;
  inserted: boolean;
  insertedParagraph?: string;
}

const DIRECT_REBUTTAL_CUES = [
  "đội bạn",
  "bên bạn",
  "phía bạn",
  "lập luận của bạn",
  "luận điểm của bạn",
  "đối phương",
  "họ cho rằng",
  "bạn nói",
  "phản biện",
  "đội bạn đã",
  "đội bạn đang",
];

const CONSTRUCTIVE_CUES = [
  "luận điểm độc lập",
  "ý độc lập",
  "ý tấn công độc lập",
  "một luận điểm riêng",
  "luận điểm của chúng tôi",
  "lập luận của chúng tôi",
  "thế giới của chúng tôi",
  "trong thế giới chúng tôi",
  "chúng tôi chứng minh",
  "chúng tôi có một cơ chế",
  "cơ chế của chúng tôi",
  "điều chúng tôi muốn chứng minh",
  "lý do thứ nhất",
  "lý do thứ hai",
];

const WEIGHING_CUES = [
  "cân tác động",
  "cân nhắc",
  "cân với",
  "so sánh",
  "so sánh hai thế giới",
  "thế giới của đội bạn",
  "thế giới của chúng tôi",
  "thế giới của tôi",
  "thế giới không có",
  "chi phí cơ hội",
  "đánh đổi",
  "quy mô",
  "mức độ nghiêm trọng",
  "khả năng xảy ra",
  "khả năng đảo ngược",
  "trọng lượng",
  "quan trọng hơn",
  "nặng hơn",
  "lớn hơn",
];

const INVENTED_EVIDENCE_RISK_PATTERNS = [
  /\b\d{1,3}\s*%/i,
  /\b(?:nghiên cứu|khảo sát|số liệu|thống kê)\s+(?:cho thấy|chỉ ra|nói rằng|kết luận)/i,
  /\btheo\s+(?:một\s+)?(?:nghiên cứu|khảo sát|báo cáo|thống kê)/i,
];

const CLOSING_NEW_ARGUMENT_PATTERNS = [
  /(?:đưa ra|trình bày|nêu|bổ sung)\s+(?:một\s+)?(?:luận điểm|ý)\s+độc lập/i,
  /luận điểm\s+độc lập\s+của\s+chúng tôi\s+là/i,
  /một\s+luận điểm\s+riêng\s+của\s+chúng tôi/i,
  /ý\s+độc lập\s+của\s+chúng tôi/i,
  /trước khi chốt trận,\s*luận điểm độc lập/i,
];

const CRYSTALLIZATION_CUES = [
  "chốt clash",
  "chốt lại",
  "trận này",
  "điểm quyết định",
  "câu hỏi trung tâm",
  "vì vậy",
  "cuối cùng",
];

function countWords(text: string) {
  return text.split(/\s+/).filter(Boolean).length;
}

function countCueMatches(text: string, cues: readonly string[]) {
  const normalized = text.toLowerCase();
  return cues.reduce((count, cue) => {
    const matches = normalized.match(new RegExp(escapeRegExp(cue), "g"));
    return count + (matches?.length ?? 0);
  }, 0);
}

function countPatternMatches(text: string, patterns: readonly RegExp[]) {
  return patterns.reduce((count, pattern) => {
    const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
    const globalPattern = new RegExp(pattern.source, flags);
    return count + (text.match(globalPattern)?.length ?? 0);
  }, 0);
}

function normalizeEvidenceText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/\s+/g, " ")
    .trim();
}

const VIETNAMESE_UNITS = [
  "khong",
  "mot",
  "hai",
  "ba",
  "bon",
  "nam",
  "sau",
  "bay",
  "tam",
  "chin",
] as const;

function numberToVietnameseWords(value: number) {
  if (!Number.isInteger(value) || value < 0 || value > 100) return null;
  if (value < 10) return VIETNAMESE_UNITS[value];
  if (value === 10) return "muoi";
  if (value < 20) {
    return `muoi ${value === 15 ? "lam" : VIETNAMESE_UNITS[value % 10]}`;
  }
  if (value === 100) return "mot tram";

  const tens = Math.floor(value / 10);
  const unit = value % 10;
  if (unit === 0) return `${VIETNAMESE_UNITS[tens]} muoi`;
  return `${VIETNAMESE_UNITS[tens]} muoi ${
    unit === 1 ? "mot" : unit === 5 ? "lam" : VIETNAMESE_UNITS[unit]
  }`;
}

function sourceSupportsEvidenceMatch(matchText: string, sourceText?: string) {
  if (!sourceText) return false;

  const normalizedSource = normalizeEvidenceText(sourceText);
  const normalizedMatch = normalizeEvidenceText(matchText);
  if (normalizedMatch && normalizedSource.includes(normalizedMatch)) {
    return true;
  }

  const percentMatch = matchText.match(/\b(\d{1,3})\s*%/);
  if (percentMatch) {
    const numericValue = Number(percentMatch[1]);
    const vietnameseWords = numberToVietnameseWords(numericValue);
    return (
      normalizedSource.includes(`${numericValue}%`) ||
      normalizedSource.includes(`${numericValue} %`) ||
      Boolean(
        vietnameseWords &&
          normalizedSource.includes(`${vietnameseWords} phan tram`)
      )
    );
  }

  return false;
}

function countUnsupportedEvidenceRiskMatches(
  text: string,
  patterns: readonly RegExp[],
  options?: OpponentQualityAnalysisOptions
) {
  return patterns.reduce((count, pattern) => {
    const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
    const globalPattern = new RegExp(pattern.source, flags);
    const matches = Array.from(text.matchAll(globalPattern));
    return (
      count +
      matches.filter(
        (match) => !sourceSupportsEvidenceMatch(match[0], options?.sourceText)
      ).length
    );
  }, 0);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function splitParagraphs(text: string) {
  return text
    .split(
      /\n{2,}|\n(?=\s*(?:Thứ|Một là|Hai là|Ba là|Cuối cùng|Chốt lại|Luận điểm độc lập|Ý độc lập|Một luận điểm riêng))/i
    )
    .map((paragraph) => paragraph.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function looksLikeStandaloneClaim(paragraph: string) {
  const lower = paragraph.toLowerCase();
  const startsAsRebuttal = DIRECT_REBUTTAL_CUES.some((cue) =>
    lower.slice(0, 90).includes(cue)
  );
  const hasConstructiveCue = CONSTRUCTIVE_CUES.some((cue) => lower.includes(cue));
  const hasMechanism =
    /(cơ chế|động cơ|hành vi|hệ quả|dẫn đến|khiến|tạo ra|làm cho)/i.test(
      paragraph
    );
  const hasImpact =
    /(tác động|tác hại|lợi ích|rủi ro|áp lực|bất bình đẳng|động lực|niềm tin)/i.test(
      paragraph
    );

  return (
    countWords(paragraph) >= 35 &&
    !startsAsRebuttal &&
    (hasConstructiveCue || (hasMechanism && hasImpact))
  );
}

export function analyzeTruongTeenOpponentOutput(
  text: string,
  mode: "rebuttal" | "closing" = "rebuttal",
  options?: OpponentQualityAnalysisOptions
): TruongTeenOpponentQualityMetrics {
  const paragraphs = splitParagraphs(text);
  const rebuttalCueParagraphs = paragraphs.filter((paragraph) => {
    const opening = paragraph.toLowerCase().slice(0, 120);
    return DIRECT_REBUTTAL_CUES.some((cue) => opening.includes(cue));
  });
  const standaloneClaimCount = paragraphs.filter(looksLikeStandaloneClaim).length;
  const directRebuttalCueCount = countCueMatches(text, DIRECT_REBUTTAL_CUES);
  const constructiveCueCount = countCueMatches(text, CONSTRUCTIVE_CUES);
  const weighingCueCount = countCueMatches(text, WEIGHING_CUES);
  const crystallizationCueCount = countCueMatches(text, CRYSTALLIZATION_CUES);
  const inventedEvidenceRiskCount = countUnsupportedEvidenceRiskMatches(
    text,
    INVENTED_EVIDENCE_RISK_PATTERNS,
    options
  );
  const closingNewArgumentCueCount =
    mode === "closing" ? countPatternMatches(text, CLOSING_NEW_ARGUMENT_PATTERNS) : 0;
  const paragraphCount = paragraphs.length;
  const rebuttalCueParagraphRatio =
    paragraphCount > 0 ? rebuttalCueParagraphs.length / paragraphCount : 0;
  const hasStandaloneOffense = standaloneClaimCount > 0 || constructiveCueCount >= 2;
  const hasWeighing = weighingCueCount > 0;
  const hasInventedEvidenceRisk = inventedEvidenceRiskCount > 0;
  const hasClosingCrystallization =
    mode === "closing" ? crystallizationCueCount > 0 && hasWeighing : true;
  const hasClosingNewArgumentRisk =
    mode === "closing" && closingNewArgumentCueCount > 0;
  const onlyRebuttalRisk =
    !hasStandaloneOffense && rebuttalCueParagraphRatio >= 0.6
      ? "high"
      : !hasStandaloneOffense || rebuttalCueParagraphRatio >= 0.75
        ? "medium"
        : "low";

  return {
    version: 2,
    wordCount: countWords(text),
    paragraphCount,
    directRebuttalCueCount,
    constructiveCueCount,
    weighingCueCount,
    crystallizationCueCount,
    inventedEvidenceRiskCount,
    closingNewArgumentCueCount,
    standaloneClaimCount,
    rebuttalCueParagraphRatio: Number(rebuttalCueParagraphRatio.toFixed(3)),
    hasStandaloneOffense,
    hasWeighing,
    hasInventedEvidenceRisk,
    hasClosingCrystallization,
    hasClosingNewArgumentRisk,
    onlyRebuttalRisk,
  };
}

function buildStandaloneParagraph(params: {
  claim: NonNullable<CasePlanForStandaloneOffense["independentClaims"]>[number];
  mode: "rebuttal" | "closing";
}) {
  const claim = params.claim.claim?.trim();
  if (!claim) return "";

  const label = params.claim.label?.trim();
  const mechanism = params.claim.mechanism?.trim();
  const impact = params.claim.impact?.trim();
  const answerability = params.claim.answerability?.trim();
  const opener = "Luận điểm độc lập của chúng tôi là";

  return [
    `${opener}: ${label ? `${label} - ` : ""}${claim}`,
    mechanism ? `Cơ chế là ${mechanism}` : "",
    impact ? `Tác động là ${impact}` : "",
    answerability
      ? `Điểm này vẫn có cửa phản biện trực tiếp: ${answerability}`
      : "",
  ]
    .filter(Boolean)
    .join(" ");
}

export function ensureTruongTeenStandaloneOffense(params: {
  text: string;
  mode?: "rebuttal" | "closing";
  casePlan?: CasePlanForStandaloneOffense | null;
  sourceText?: string;
}): StandaloneOffenseGuardrailResult {
  const mode = params.mode ?? "rebuttal";
  const metrics = analyzeTruongTeenOpponentOutput(params.text, mode, {
    sourceText: params.sourceText,
  });
  if (mode === "closing") {
    return { text: params.text, metrics, inserted: false };
  }
  if (metrics.standaloneClaimCount > 0) {
    return { text: params.text, metrics, inserted: false };
  }

  const claim = params.casePlan?.independentClaims?.find((item) =>
    Boolean(item.claim?.trim())
  );
  if (!claim) return { text: params.text, metrics, inserted: false };

  const insertedParagraph = buildStandaloneParagraph({ claim, mode });
  if (!insertedParagraph) {
    return { text: params.text, metrics, inserted: false };
  }

  const trimmed = params.text.trim();
  const text = trimmed ? `${trimmed}\n\n${insertedParagraph}` : insertedParagraph;

  return {
    text,
    metrics: analyzeTruongTeenOpponentOutput(text, mode, {
      sourceText: params.sourceText,
    }),
    inserted: true,
    insertedParagraph,
  };
}
