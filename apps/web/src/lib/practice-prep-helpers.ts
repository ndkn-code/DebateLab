import type { DebateTopic } from "@/types";

export type PrepStarterKind =
  | "burden"
  | "clash"
  | "mechanism"
  | "weighing"
  | "rhetoric";

const EN_TOPIC_STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "be",
  "completely",
  "does",
  "for",
  "good",
  "harm",
  "more",
  "should",
  "than",
  "the",
  "to",
]);

const VI_TOPIC_STOP_WORDS = new Set([
  "ban",
  "cac",
  "cho",
  "cua",
  "gay",
  "hon",
  "khi",
  "la",
  "loi",
  "mot",
  "nen",
  "nhieu",
  "thi",
  "tren",
  "trong",
  "voi",
  "và",
  "các",
  "cho",
  "của",
  "gây",
  "hơn",
  "khi",
  "là",
  "lợi",
  "một",
  "nên",
  "nhiều",
  "thì",
  "trên",
  "trong",
  "với",
]);

const STARTER_BLOCK_COPY = {
  en: {
    fallbackTerms: ["key actor", "affected group", "main harm"],
    burden: [
      "Lock the burden:",
      "- My side must prove:",
      "- The other side must prove:",
      "- Scope I will defend:",
      "- One sentence that tells the judge what decides the round:",
    ],
    clash: "Clash axes:",
    clashFallback: [
      "Mechanism: why their causal chain fails",
      "Affected group: who matters most in this round",
      "Impact weighing: which harm is larger, more likely, or harder to reverse",
    ],
    mechanism: [
      "Deepen the mechanism:",
      "- Actor:",
      "- Incentive or pressure:",
      "- Behavior change:",
      "- Short-term effect:",
      "- Long-term impact:",
      "- Weakest link I need to defend:",
    ],
    weighing: [
      "Weigh the impacts:",
      "- Scale:",
      "- Severity:",
      "- Probability:",
      "- Reversibility:",
      "- Time frame:",
      "- Affected group:",
      "- Why this outweighs the other side:",
    ],
    rhetoric: [
      "Polish the phrasing:",
      "- Burden line:",
      "- Mechanism transition:",
      "- Rebuttal line:",
      "- World comparison line:",
      "- Closing crystallization:",
    ],
  },
  vi: {
    fallbackTerms: ["chủ thể chính", "nhóm chịu ảnh hưởng", "tác hại trung tâm"],
    burden: [
      "Chốt gánh nặng:",
      "- Phe mình phải chứng minh:",
      "- Phe đối lập phải chứng minh:",
      "- Phạm vi mình sẽ bảo vệ:",
      "- Một câu nói cho giám khảo biết trận này xoay quanh điều gì:",
    ],
    clash: "Tạo trục va chạm:",
    clashFallback: [
      "Cơ chế: vì sao chuỗi nhân quả của đối phương gãy",
      "Nhóm chịu ảnh hưởng: ai là nhóm quan trọng nhất trong trận này",
      "Cân tác động: tác hại nào lớn hơn, dễ xảy ra hơn, hoặc khó đảo ngược hơn",
    ],
    mechanism: [
      "Đào sâu cơ chế:",
      "- Chủ thể:",
      "- Động cơ hoặc áp lực:",
      "- Hành vi thay đổi:",
      "- Hệ quả ngắn hạn:",
      "- Tác động dài hạn:",
      "- Mắt xích yếu nhất cần bảo vệ:",
    ],
    weighing: [
      "Cân tác động:",
      "- Quy mô:",
      "- Mức độ nghiêm trọng:",
      "- Khả năng xảy ra:",
      "- Khả năng đảo ngược:",
      "- Khung thời gian:",
      "- Nhóm chịu ảnh hưởng:",
      "- Vì sao tác động này nặng hơn phe kia:",
    ],
    rhetoric: [
      "Đánh bóng văn phong:",
      "- Câu chốt gánh nặng:",
      "- Câu chuyển sang cơ chế:",
      "- Câu phản biện:",
      "- Câu so sánh hai thế giới:",
      "- Câu chốt clash:",
    ],
  },
} as const;

function getSuggestedPoints(
  topic: DebateTopic,
  side: "proposition" | "opposition"
) {
  const points =
    side === "proposition"
      ? topic.suggestedPoints?.proposition
      : topic.suggestedPoints?.opposition;

  return points?.filter(Boolean) ?? [];
}

function extractTopicTerms(title: string, locale: "en" | "vi") {
  const stopWords =
    locale === "vi" ? VI_TOPIC_STOP_WORDS : EN_TOPIC_STOP_WORDS;
  const minLength = locale === "vi" ? 2 : 3;
  const words = title
    .split(/\s+/)
    .map((word) => word.replace(/[^\p{L}\p{M}-]/gu, "").toLowerCase())
    .filter((word) => word.length > minLength && !stopWords.has(word));

  return Array.from(new Set(words)).slice(0, 4);
}

export function buildPrepStarterBlock(
  kind: PrepStarterKind,
  topic: DebateTopic,
  side: "proposition" | "opposition",
  locale: "en" | "vi"
) {
  const copy = STARTER_BLOCK_COPY[locale];
  const ownPoints = getSuggestedPoints(topic, side);
  const opposingSide = side === "proposition" ? "opposition" : "proposition";
  const opposingPoints = getSuggestedPoints(topic, opposingSide);

  if (kind === "burden") {
    const terms = extractTopicTerms(topic.title, locale);
    const anchors = terms.length > 0 ? terms : copy.fallbackTerms;

    return [
      ...copy.burden,
      locale === "vi" ? "- Từ khóa cần khóa nghĩa:" : "- Terms to lock:",
      ...anchors.map((term) => `  - ${term}:`),
    ].join("\n");
  }

  if (kind === "clash") {
    const lines =
      opposingPoints.length > 0
        ? opposingPoints.slice(0, 3).map((point) => `${point} -> `)
        : copy.clashFallback;

    return [copy.clash, ...lines.map((line) => `- ${line}`)].join("\n");
  }

  if (kind === "mechanism") {
    const anchor =
      ownPoints[0] ||
      (locale === "vi" ? "Luận điểm cần đào sâu:" : "Argument to deepen:");

    return [copy.mechanism[0], `- ${anchor}`, ...copy.mechanism.slice(1)].join(
      "\n"
    );
  }

  if (kind === "weighing") {
    return copy.weighing.join("\n");
  }

  return copy.rhetoric.join("\n");
}
