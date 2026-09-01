export type CoachLocale = "en" | "vi";

export const IELTS_COACH_COPY = {
  en: {
    coachName: "IELTS AI Coach",
    eyebrow: "IELTS · AI practice support",
    title: "Ask about your next IELTS move",
    intro:
      "Get a concise explanation, then move straight into the practice that helps.",
    emptyTitle: "What do you want to improve?",
    emptyBody:
      "Ask about a criterion, a recent result, or how to approach a task.",
    placeholder: "Ask about IELTS Writing, Speaking, Reading, or Listening…",
    send: "Send",
    thinking: "Reviewing your IELTS context…",
    error:
      "The coach could not answer just now. Try again without losing your question.",
    retry: "Try again",
    boundaryTitle: "How to use this coach",
    boundaryBody:
      "Advice is for practice. Band estimates remain provisional unless a teacher publishes them.",
    sourcesTitle: "Context and sources",
    sourcesEmpty: "Sources appear here when a response uses them.",
    sourceAuthority: "Authority",
    sourceVersion: "Version",
    diagnosisTitle: "Evidence-based diagnosis",
    scoreSummary: "Band snapshot",
    evidenceUsedTitle: "What the coach used",
    currentBand: "Current",
    targetBand: "Target",
    scoreAuthority: "Score status",
    notAvailable: "Not enough evidence",
    recommendationTitle: "Recommended next step",
    recommendation: "Apply the advice in one focused IELTS practice task.",
    recommendationSource: "AI coaching suggestion",
    whyItHelps: "Why this helps",
    actionUnavailable:
      "This recommendation cannot be opened safely. Ask the coach for another task.",
    practiceEstimateDisclaimer:
      "Practice guidance only. This is not an official IELTS, Cambridge, British Council, or IDP result.",
    confidence: "Confidence",
    confidenceLevels: {
      low: "Low",
      medium: "Medium",
      high: "High",
    },
    authority: "Authority",
    provisional: "Provisional",
    startPractice: "Choose a practice task",
    followUps: "Useful follow-ups",
    newChat: "New conversation",
    composerHint: "Enter to send · Shift + Enter for a new line",
    conversationLabel: "IELTS AI Coach conversation",
    googleAiConsent:
      "To answer with Gemini 3.5 Flash-Lite, your Coach question and authorized IELTS learning context will be sent to Google AI. Student submissions are not sent unless you include them in this chat. Allow this once on this device? Choose Cancel to use the privacy-safe Groq fallback.",
    practiceShortcutTitle: "Practice library",
    practiceShortcutBody:
      "Choose a focused IELTS task when you are ready to apply the guidance.",
    prompts: [
      "How can I improve Task 2 coherence?",
      "Explain my weakest IELTS criterion",
      "Give me a 15-minute Speaking drill",
      "What should I practise before my next mock?",
    ],
    followUpPrompts: [
      "Show me a stronger example",
      "Turn this into a 15-minute drill",
      "What should I do first?",
    ],
  },
  vi: {
    coachName: "Trợ lý AI IELTS",
    eyebrow: "IELTS · Hỗ trợ luyện tập bằng AI",
    title: "Hỏi về bước IELTS tiếp theo của bạn",
    intro: "Nhận giải thích ngắn gọn rồi chuyển thẳng sang bài luyện phù hợp.",
    emptyTitle: "Bạn muốn cải thiện điều gì?",
    emptyBody:
      "Hỏi về một tiêu chí, kết quả gần đây hoặc cách làm một dạng bài.",
    placeholder: "Hỏi về Viết, Nói, Đọc hoặc Nghe IELTS…",
    send: "Gửi",
    thinking: "Đang xem ngữ cảnh IELTS của bạn…",
    error:
      "Trợ lý chưa thể trả lời lúc này. Hãy thử lại; câu hỏi của bạn vẫn được giữ nguyên.",
    retry: "Thử lại",
    boundaryTitle: "Cách dùng trợ lý này",
    boundaryBody:
      "Lời khuyên chỉ phục vụ luyện tập. Ước tính band là tạm thời trừ khi giáo viên công bố.",
    sourcesTitle: "Ngữ cảnh và nguồn",
    sourcesEmpty: "Nguồn sẽ xuất hiện ở đây khi câu trả lời sử dụng chúng.",
    sourceAuthority: "Mức độ tin cậy",
    sourceVersion: "Phiên bản",
    diagnosisTitle: "Chẩn đoán dựa trên bằng chứng",
    scoreSummary: "Tóm tắt band",
    evidenceUsedTitle: "Dữ liệu trợ lý đã sử dụng",
    currentBand: "Hiện tại",
    targetBand: "Mục tiêu",
    scoreAuthority: "Trạng thái điểm",
    notAvailable: "Chưa đủ bằng chứng",
    recommendationTitle: "Bước tiếp theo được đề xuất",
    recommendation: "Áp dụng lời khuyên trong một bài luyện IELTS tập trung.",
    recommendationSource: "Đề xuất huấn luyện bằng AI",
    whyItHelps: "Vì sao bài này hữu ích",
    actionUnavailable:
      "Không thể mở đề xuất này một cách an toàn. Hãy yêu cầu trợ lý chọn bài khác.",
    practiceEstimateDisclaimer:
      "Chỉ phục vụ luyện tập. Đây không phải kết quả chính thức của IELTS, Cambridge, British Council hoặc IDP.",
    confidence: "Độ tin cậy",
    confidenceLevels: {
      low: "Thấp",
      medium: "Trung bình",
      high: "Cao",
    },
    authority: "Nguồn đề xuất",
    provisional: "Tạm thời",
    startPractice: "Chọn bài luyện",
    followUps: "Câu hỏi tiếp theo hữu ích",
    newChat: "Cuộc trò chuyện mới",
    composerHint: "Enter để gửi · Shift + Enter để xuống dòng",
    conversationLabel: "Cuộc trò chuyện với trợ lý AI IELTS",
    googleAiConsent:
      "Để trả lời bằng Gemini 3.5 Flash-Lite, câu hỏi và ngữ cảnh học IELTS được cho phép của bạn sẽ được gửi tới Google AI. Bài làm của học viên không được gửi trừ khi bạn tự đưa vào cuộc trò chuyện này. Cho phép một lần trên thiết bị này? Chọn Hủy để dùng phương án dự phòng Groq.",
    practiceShortcutTitle: "Thư viện luyện tập",
    practiceShortcutBody:
      "Chọn một bài IELTS tập trung khi bạn sẵn sàng áp dụng hướng dẫn.",
    prompts: [
      "Làm sao cải thiện tính mạch lạc của Writing Task 2?",
      "Giải thích tiêu chí IELTS yếu nhất của tôi",
      "Tạo bài luyện Speaking 15 phút",
      "Tôi nên luyện gì trước bài thi thử tiếp theo?",
    ],
    followUpPrompts: [
      "Cho tôi xem một ví dụ tốt hơn",
      "Biến nội dung này thành bài luyện 15 phút",
      "Tôi nên làm gì trước tiên?",
    ],
  },
} as const;
