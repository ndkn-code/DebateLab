export type IeltsPlayerExperience = "exam_simulation" | "speaking_rehearsal";

export type IeltsPlayerLocale = "en" | "vi";

export const IELTS_PLAYER_EXPERIENCE_COPY = {
  en: {
    exam_simulation: {
      label: "Exam Simulation",
      intro:
        "Timed rehearsal for Listening, Reading, and Writing. Reading and Writing can be paused; Listening recordings play once without pause or replay.",
      start: "Start simulation",
      guideTitle: "How this simulation works",
      guideClose: "Got it",
      submitted: "Simulation submitted. Your results are ready.",
      summaryTitle: "Your result",
      resultsLabel: "See full results and review",
      completionNote:
        "Writing is scored separately and appears in your full results when marking finishes.",
    },
    speaking_rehearsal: {
      label: "Speaking Rehearsal",
      intro:
        "Low-stakes Speaking practice with AI feedback. This is separate from Exam Simulation and does not produce an official IELTS score.",
      start: "Start rehearsal",
      guideTitle: "How Speaking Rehearsal works",
      guideClose: "Got it",
      submitted: "Rehearsal submitted. AI feedback is processing.",
      summaryTitle: "Rehearsal submitted",
      resultsLabel: "View AI feedback",
      completionNote:
        "AI feedback is for practice only and is not an official IELTS Speaking result.",
    },
  },
  vi: {
    exam_simulation: {
      label: "Mô phỏng bài thi",
      intro:
        "Mô phỏng có bấm giờ cho Nghe, Đọc và Viết. Có thể tạm dừng phần Đọc và Viết; bản ghi Nghe chỉ phát một lần, không tạm dừng hoặc phát lại.",
      start: "Bắt đầu mô phỏng",
      guideTitle: "Cách bài mô phỏng hoạt động",
      guideClose: "Đã hiểu",
      submitted: "Đã nộp bài mô phỏng. Kết quả đã sẵn sàng.",
      summaryTitle: "Kết quả của bạn",
      resultsLabel: "Xem kết quả và phần ôn lại",
      completionNote:
        "Phần Viết được chấm riêng và sẽ xuất hiện trong kết quả đầy đủ khi chấm xong.",
    },
    speaking_rehearsal: {
      label: "Luyện nói mô phỏng",
      intro:
        "Luyện Speaking ít áp lực với phản hồi AI. Đây không phải Mô phỏng bài thi và không tạo điểm IELTS chính thức.",
      start: "Bắt đầu luyện nói",
      guideTitle: "Cách luyện nói mô phỏng hoạt động",
      guideClose: "Đã hiểu",
      submitted: "Đã nộp bài luyện. AI đang xử lý phản hồi.",
      summaryTitle: "Đã nộp bài luyện",
      resultsLabel: "Xem phản hồi AI",
      completionNote:
        "Phản hồi AI chỉ phục vụ luyện tập và không phải kết quả IELTS Speaking chính thức.",
    },
  },
} as const;
