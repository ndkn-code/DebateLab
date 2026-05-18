import type { PracticeLanguage } from "@/types";

export interface CoachStarterPromptInput {
  weakestSkillLabel: string | null;
  strongestSkillLabel: string | null;
  weaknessLabel: string | null;
  recentSessionCount: number;
  practiceLanguage: PracticeLanguage;
}

export function buildCoachStarterPrompts({
  weakestSkillLabel,
  strongestSkillLabel,
  weaknessLabel,
  recentSessionCount,
  practiceLanguage,
}: CoachStarterPromptInput) {
  const prompts: string[] = [];

  if (weakestSkillLabel && strongestSkillLabel) {
    prompts.push(
      practiceLanguage === "vi"
        ? `Vì sao ${weakestSkillLabel} của mình yếu hơn ${strongestSkillLabel}?`
        : `Why is my ${weakestSkillLabel} weaker than my ${strongestSkillLabel}?`
    );
  }

  if (recentSessionCount >= 2) {
    prompts.push(
      practiceLanguage === "vi"
        ? "So sánh 3 phiên tranh biện gần nhất của mình."
        : "Compare my last 3 debate sessions."
    );
  }

  if (weaknessLabel) {
    prompts.push(
      practiceLanguage === "vi"
        ? `Giúp mình sửa ${weaknessLabel.toLowerCase()}.`
        : `Help me fix my ${weaknessLabel.toLowerCase()}.`
    );
  }

  prompts.push(
    practiceLanguage === "vi"
      ? "Hôm nay mình nên luyện gì?"
      : "What should I practice today?"
  );

  if (recentSessionCount === 0) {
    return practiceLanguage === "vi"
      ? [
          "Giúp mình xây phần mở đầu tranh biện thật rõ.",
          "Mình nên tập trung gì trong phiên luyện đầu tiên?",
          "Tạo cho mình một bài luyện phản biện ngắn.",
          "Làm sao để so sánh tác động rõ hơn?",
        ]
      : [
          "Help me build a clear debate opening.",
          "What should I focus on in my first practice session?",
          "Make me a short rebuttal drill.",
          "How do I weigh impacts clearly?",
        ];
  }

  return prompts.slice(0, 4);
}
