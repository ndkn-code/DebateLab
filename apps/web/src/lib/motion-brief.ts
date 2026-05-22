import type { DebateTopic, MotionBrief, PracticeLanguage } from "@/types";

function sidePoint(
  topic: DebateTopic,
  side: "proposition" | "opposition",
  fallback: string
) {
  return topic.suggestedPoints?.[side]?.find(Boolean) ?? fallback;
}

function fallbackBrief(topic: DebateTopic, language: PracticeLanguage): MotionBrief {
  if (language === "vi") {
    return {
      keyTerms: [
        `motion: ${topic.title}`,
        "phạm vi: đối tượng và bối cảnh cần được định nghĩa trước khi tranh luận",
        "burden: điều mỗi phe phải chứng minh để thắng",
      ],
      scope:
        topic.context ??
        "Hãy xác định rõ motion áp dụng cho ai, trong bối cảnh nào, và ngoại lệ nào không thuộc tranh luận.",
      propositionBurden: sidePoint(
        topic,
        "proposition",
        "Chứng minh thay đổi/quan điểm trong motion tạo lợi ích lớn hơn tác hại."
      ),
      oppositionBurden: sidePoint(
        topic,
        "opposition",
        "Chứng minh motion quá rộng, gây hại, hoặc cách giải quyết hiện tại tốt hơn."
      ),
      modelClarification:
        "Giữ một định nghĩa nhất quán xuyên suốt bài nói; nếu đề mơ hồ, hãy nói rõ mô hình trước khi đưa luận điểm.",
    };
  }

  return {
    keyTerms: [
      `motion: ${topic.title}`,
      "scope: the people, place, and exceptions covered by the debate",
      "burden: what each side must prove to win",
    ],
    scope:
      topic.context ??
      "Define who the motion applies to, what context it covers, and which exceptions are outside the debate.",
    propositionBurden: sidePoint(
      topic,
      "proposition",
      "Prove that the motion's change or claim creates more benefit than harm."
    ),
    oppositionBurden: sidePoint(
      topic,
      "opposition",
      "Prove that the motion is too broad, harmful, unnecessary, or worse than the status quo."
    ),
    modelClarification:
      "Keep one consistent definition throughout the round; if the motion is vague, state the model before building arguments.",
  };
}

export function getMotionBrief(
  topic: DebateTopic,
  language: PracticeLanguage = "en"
): MotionBrief {
  const brief = topic.motionBrief;
  if (
    brief?.keyTerms?.length &&
    brief.scope &&
    brief.propositionBurden &&
    brief.oppositionBurden &&
    brief.modelClarification
  ) {
    return brief;
  }

  return fallbackBrief(topic, language);
}

export function formatMotionBriefForPrompt(brief: MotionBrief) {
  return `## Motion Definition
- Key terms:
${brief.keyTerms.map((term) => `  - ${term}`).join("\n")}
- Scope: ${brief.scope}
- Proposition burden: ${brief.propositionBurden}
- Opposition burden: ${brief.oppositionBurden}
- Model clarification: ${brief.modelClarification}`;
}
