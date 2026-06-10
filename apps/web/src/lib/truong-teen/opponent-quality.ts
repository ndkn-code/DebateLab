export interface TruongTeenOpponentQualityMetrics {
  version: 1;
  wordCount: number;
  paragraphCount: number;
  directRebuttalCueCount: number;
  constructiveCueCount: number;
  weighingCueCount: number;
  crystallizationCueCount: number;
  inventedEvidenceRiskCount: number;
  standaloneClaimCount: number;
  rebuttalCueParagraphRatio: number;
  hasStandaloneOffense: boolean;
  hasWeighing: boolean;
  hasInventedEvidenceRisk: boolean;
  hasClosingCrystallization: boolean;
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
  mode: "rebuttal" | "closing" = "rebuttal"
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
  const inventedEvidenceRiskCount = countPatternMatches(
    text,
    INVENTED_EVIDENCE_RISK_PATTERNS
  );
  const paragraphCount = paragraphs.length;
  const rebuttalCueParagraphRatio =
    paragraphCount > 0 ? rebuttalCueParagraphs.length / paragraphCount : 0;
  const hasStandaloneOffense = standaloneClaimCount > 0 || constructiveCueCount >= 2;
  const hasWeighing = weighingCueCount > 0;
  const hasInventedEvidenceRisk = inventedEvidenceRiskCount > 0;
  const hasClosingCrystallization =
    mode === "closing" ? crystallizationCueCount > 0 && hasWeighing : true;
  const onlyRebuttalRisk =
    !hasStandaloneOffense && rebuttalCueParagraphRatio >= 0.6
      ? "high"
      : !hasStandaloneOffense || rebuttalCueParagraphRatio >= 0.75
        ? "medium"
        : "low";

  return {
    version: 1,
    wordCount: countWords(text),
    paragraphCount,
    directRebuttalCueCount,
    constructiveCueCount,
    weighingCueCount,
    crystallizationCueCount,
    inventedEvidenceRiskCount,
    standaloneClaimCount,
    rebuttalCueParagraphRatio: Number(rebuttalCueParagraphRatio.toFixed(3)),
    hasStandaloneOffense,
    hasWeighing,
    hasInventedEvidenceRisk,
    hasClosingCrystallization,
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
  const opener =
    params.mode === "closing"
      ? "Trước khi chốt trận, luận điểm độc lập của chúng tôi là"
      : "Luận điểm độc lập của chúng tôi là";

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
}): StandaloneOffenseGuardrailResult {
  const mode = params.mode ?? "rebuttal";
  const metrics = analyzeTruongTeenOpponentOutput(params.text, mode);
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
    metrics: analyzeTruongTeenOpponentOutput(text, mode),
    inserted: true,
    insertedParagraph,
  };
}
