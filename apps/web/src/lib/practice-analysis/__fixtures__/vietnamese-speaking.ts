import type { DebateScore } from "@/types/feedback";
import type { PracticeAnalysisInput } from "../types";

export const vietnameseSpeakingInput: PracticeAnalysisInput = {
  transcript:
    "Em nghĩ học sinh nên luyện nói tiếng Anh mỗi ngày vì thói quen nhỏ sẽ giúp mình tự tin hơn. Khi luyện đều, mình không còn quá sợ sai và có thể diễn đạt ý tưởng rõ ràng hơn trước lớp.",
  topic: "Học sinh nên luyện nói tiếng Anh mỗi ngày",
  side: "proposition",
  speechType: "Speaking Practice",
  timeLimit: 2,
  actualDuration: 64,
  practiceTrack: "speaking",
  practiceLanguage: "vi",
  isFullRound: false,
  mode: "quick",
  prepTime: 60,
  speechTime: 120,
  prepNotes: "Mở bài: thói quen nhỏ. Ví dụ: luyện đều giúp tự tin hơn.",
  topicCategory: "Speaking",
  topicCategoryKey: "speaking",
  topicDifficulty: "beginner",
};

export const vietnameseSpeakingFeedback: DebateScore = {
  content: {
    claimClarity: 8,
    evidenceSupport: 6,
    logicCoherence: 7,
    counterArgument: 4,
    score: 25,
  },
  structure: {
    introduction: 7,
    bodyOrganization: 7,
    conclusion: 5,
    score: 19,
  },
  language: {
    vocabulary: 7,
    grammar: 7,
    fluency: 7,
    score: 21,
  },
  persuasion: {
    audienceAwareness: 4,
    impactfulness: 3,
    score: 7,
  },
  totalScore: 72,
  overallBand: "Competent",
  summary: "Bài nói có thông điệp rõ và phù hợp với mục tiêu luyện nói.",
  strengths: ["Ý chính rõ", "Giọng văn tự nhiên", "Có ví dụ gần gũi"],
  improvements: ["Thêm kết luận", "Nói rõ hơn về kết quả", "Thêm một phản biện ngắn"],
  sampleArguments: ["Một ví dụ tốt hơn là mô tả sự tự tin tăng lên sau một tuần luyện đều."],
  practiceTrack: "speaking",
  practiceLanguage: "vi",
  detailedFeedback: {
    contentFeedback: "Ý tưởng chính dễ hiểu.",
    structureFeedback: "Bố cục cần phần kết rõ hơn.",
    languageFeedback: "Ngôn ngữ tự nhiên và dễ theo dõi.",
    persuasionFeedback: "Thông điệp có thể mạnh hơn nếu thêm kết quả cụ thể.",
  },
};
