import { useLocale } from "next-intl";

const SKILL_FEEDBACK_COPY = {
  en: {
    writing: "Writing",
    speaking: "Speaking",
    band: "band",
    task: "Task {value}",
    part: "Part {value}",
    speakingResponse: "Speaking response",
    words: "{value} words",
    pending:
      "{skill} is still being scored. This section updates when marking finishes.",
    corrections: "Corrections ({value})",
    modelAnswer: "Band 9 model answer",
    paragraphFeedback: "Paragraph feedback",
    improve: "Improve",
    submittedEssay: "Submitted essay",
    transcript: "Transcript",
    heatmapUnavailable:
      "Pronunciation details are not available for this response yet.",
    heatmap: "Pronunciation details",
    accuracy: "Accuracy",
    fluency: "Fluency",
    completeness: "Completeness",
    pronunciation: "Pronunciation",
    criteria: {
      taskResponse: "Task Response / Achievement",
      taskAchievement: "Task Achievement",
      coherenceCohesion: "Coherence & Cohesion",
      lexicalResource: "Lexical Resource",
      grammaticalRangeAccuracy: "Grammatical Range & Accuracy",
      fluencyCoherence: "Fluency & Coherence",
      pronunciation: "Pronunciation",
    },
  },
  vi: {
    writing: "Viết",
    speaking: "Nói",
    band: "band",
    task: "Task {value}",
    part: "Phần {value}",
    speakingResponse: "Câu trả lời Nói",
    words: "{value} từ",
    pending: "{skill} vẫn đang được chấm. Phần này sẽ cập nhật khi chấm xong.",
    corrections: "Chỉnh sửa ({value})",
    modelAnswer: "Bài mẫu band 9",
    paragraphFeedback: "Phản hồi theo đoạn",
    improve: "Cần cải thiện",
    submittedEssay: "Bài viết đã nộp",
    transcript: "Bản chép lời",
    heatmapUnavailable: "Chưa có chi tiết phát âm cho câu trả lời này.",
    heatmap: "Chi tiết phát âm",
    accuracy: "Độ chính xác",
    fluency: "Độ trôi chảy",
    completeness: "Độ đầy đủ",
    pronunciation: "Phát âm",
    criteria: {
      taskResponse: "Đáp ứng yêu cầu đề bài",
      taskAchievement: "Hoàn thành yêu cầu đề bài",
      coherenceCohesion: "Mạch lạc và liên kết",
      lexicalResource: "Vốn từ",
      grammaticalRangeAccuracy: "Độ đa dạng và chính xác ngữ pháp",
      fluencyCoherence: "Độ trôi chảy và mạch lạc",
      pronunciation: "Phát âm",
    },
  },
} as const;

export function interpolateResultCopy(
  template: string,
  value: string | number,
) {
  return template.replace("{value}", String(value));
}

export function useSkillFeedbackCopy() {
  return SKILL_FEEDBACK_COPY[useLocale() === "vi" ? "vi" : "en"];
}
