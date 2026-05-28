import type { CoachRouteIntent } from "@/types";
import type { DebateCorpusPurpose } from "@/lib/corpus/model";

export type CoachCorpusPurpose = DebateCorpusPurpose;

export interface CoachIntentDecision {
  intent: CoachRouteIntent;
  corpusPurpose: CoachCorpusPurpose | null;
  reason: string;
}

function normalize(value: string) {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function hasAny(text: string, patterns: RegExp[]) {
  return patterns.some((pattern) => pattern.test(text));
}

const VISUAL_PATTERNS = [
  /\b(show|visual|diagram|map|flow|animate|animation|illustrate)\b/i,
  /\b(i don't get|dont get|don't understand|confused)\b/i,
  /(minh ho[ạa]|sơ đồ|bản đồ|hình dung|vẽ|không hiểu|chưa hiểu|khó hiểu|giải thích bằng hình)/i,
];

const DEEP_REVIEW_PATTERNS = [
  /\b(compare|review|audit|diagnose|progress|last\s+\d+\s+sessions?|next drill)\b/i,
  /(so sánh|rà soát|đánh giá sâu|tiến bộ|phiên gần nhất|lần gần nhất|bài tập tiếp theo|điểm yếu|điểm mạnh)/i,
];

const PHRASE_PATTERNS = [
  /\b(phrase|wording|style|say this|sentence|opening line|closing line)\b/i,
  /(câu từ|diễn đạt|văn phong|nói như thế nào|câu mở|câu chốt|phong cách)/i,
];

const JUDGING_PATTERNS = [
  /\b(judge|judging|rubric|score|criteria|adjudicator)\b/i,
  /(giám khảo|chấm|tiêu chí|thang điểm|rubric|vì sao bị trừ|phân xử)/i,
];

const DEBATE_PATTERNS = [
  /\b(truong teen|trường teen|motion|case|argument|rebuttal|clash|weighing|impact|mechanism|burden|poi|wsdc)\b/i,
  /(kiến nghị|luận điểm|phản biện|đối đầu|cơ chế|tác động|so sánh thế giới|gánh nặng chứng minh|tranh biện)/i,
];

export function decideCoachIntent(params: {
  message: string;
  contextType?: string | null;
}): CoachIntentDecision {
  const text = normalize(params.message);
  const contextType = normalize(params.contextType ?? "");

  if (hasAny(text, VISUAL_PATTERNS)) {
    return {
      intent: "visual_explainer",
      corpusPurpose: hasAny(text, DEBATE_PATTERNS) ? "coach" : null,
      reason: "visual_request",
    };
  }

  if (
    hasAny(text, DEEP_REVIEW_PATTERNS) ||
    /\b(session-review|session-comparison|duel-review|practice-feedback)\b/.test(
      contextType
    )
  ) {
    return {
      intent: "deep_review",
      corpusPurpose: hasAny(text, JUDGING_PATTERNS) ? "judging" : "coach",
      reason: "deep_review_request",
    };
  }

  if (hasAny(text, PHRASE_PATTERNS)) {
    return {
      intent: "corpus_debate_help",
      corpusPurpose: "phrase_bank",
      reason: "phrase_or_style_request",
    };
  }

  if (hasAny(text, JUDGING_PATTERNS)) {
    return {
      intent: "corpus_debate_help",
      corpusPurpose: "judging",
      reason: "judging_or_rubric_request",
    };
  }

  if (hasAny(text, DEBATE_PATTERNS)) {
    return {
      intent: "corpus_debate_help",
      corpusPurpose: "coach",
      reason: "debate_help_request",
    };
  }

  return {
    intent: "general",
    corpusPurpose: null,
    reason: "general_chat",
  };
}
