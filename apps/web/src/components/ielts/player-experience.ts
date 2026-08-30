export type IeltsPlayerExperience =
  | "exam_simulation"
  | "guided_practice"
  | "speaking_rehearsal";

export type IeltsPlayerLocale = "en" | "vi";

export const IELTS_PLAYER_EXPERIENCE_COPY = {
  en: {
    exam_simulation: {
      label: "Exam Simulation",
      intro:
        "Timed rehearsal for Listening, Reading, and Writing in a fixed order. Submitted sections cannot be reopened, and Listening recordings play once.",
      start: "Start simulation",
      guideTitle: "How this simulation works",
      guideClose: "Got it",
      submitted: "Simulation submitted. Your results are being graded.",
      summaryTitle: "Simulation submitted",
      resultsLabel: "See full results and review",
      completionNote:
        "Writing is scored separately and appears in your full results when marking finishes.",
    },
    guided_practice: {
      label: "Practice",
      intro:
        "Focused skill practice with pausing, navigation, and coaching available where appropriate.",
      start: "Start practice",
      guideTitle: "How practice works",
      guideClose: "Got it",
      submitted: "Practice submitted. Your feedback is ready.",
      summaryTitle: "Practice result",
      resultsLabel: "See full results and review",
      completionNote:
        "These estimates support practice and are not official IELTS results.",
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
        "Mô phỏng có bấm giờ theo thứ tự cố định Nghe, Đọc và Viết. Không thể mở lại phần đã nộp và bản ghi Nghe chỉ phát một lần.",
      start: "Bắt đầu mô phỏng",
      guideTitle: "Cách bài mô phỏng hoạt động",
      guideClose: "Đã hiểu",
      submitted: "Đã nộp bài mô phỏng. Hệ thống đang chấm bài.",
      summaryTitle: "Đã nộp bài mô phỏng",
      resultsLabel: "Xem kết quả và phần ôn lại",
      completionNote:
        "Phần Viết được chấm riêng và sẽ xuất hiện trong kết quả đầy đủ khi chấm xong.",
    },
    guided_practice: {
      label: "Luyện tập",
      intro:
        "Luyện tập kỹ năng trọng tâm với khả năng tạm dừng, điều hướng và nhận hướng dẫn khi phù hợp.",
      start: "Bắt đầu luyện tập",
      guideTitle: "Cách chế độ luyện tập hoạt động",
      guideClose: "Đã hiểu",
      submitted: "Đã nộp bài luyện tập. Phản hồi đã sẵn sàng.",
      summaryTitle: "Kết quả luyện tập",
      resultsLabel: "Xem kết quả và bài làm đầy đủ",
      completionNote:
        "Điểm ước tính này chỉ phục vụ luyện tập, không phải kết quả IELTS chính thức.",
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
