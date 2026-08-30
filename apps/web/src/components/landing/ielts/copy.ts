export type IeltsLandingLocale = "en" | "vi";

export const IELTS_LANDING_COPY = {
  en: {
    eyebrow: "IELTS preparation, with a plan",
    title: "Prepare with clarity. Walk into IELTS ready.",
    intro:
      "Build the right habits for your test day with focused practice, useful feedback, and a study path that adapts as you improve.",
    primary: "Start your IELTS plan",
    secondary: "Sign in",
    note: "Choose your test type after you create your account. You can change it later with a clear plan review.",
    pathLabel: "Your IELTS path",
    todayLabel: "Today",
    todayTitle: "Set your goal and find your starting point",
    todayBody: "A short setup, then a focused next step.",
    pathSteps: [
      "Choose Academic or General Training",
      "Build your four-skill plan",
      "Practice with confidence",
    ],
    academicDifference: "Reading and Writing differ from General Training",
    generalDifference: "Reading and Writing follow General Training",
    routeTitle: "Start with the test that matches your goal",
    academic: {
      title: "Academic",
      body: "For university study, professional registration, or other higher-education goals.",
      tag: "Study & registration",
    },
    general: {
      title: "General Training",
      body: "For migration, work, or study below degree level in an English-speaking environment.",
      tag: "Migration & work",
    },
    modesTitle: "Practice your way, then rehearse the real thing",
    modes: [
      [
        "Practice",
        "Untimed work with hints, explanations, retry, and feedback.",
      ],
      [
        "Exam Simulation",
        "A focused, timed Listening, Reading, and Writing rehearsal with section rules and results after submission.",
      ],
    ],
    skillsTitle: "One calm workspace for every IELTS skill",
    skills: ["Listening", "Reading", "Writing", "Speaking"],
    footer: "Authentic IELTS preparation for your next step.",
  },
  vi: {
    eyebrow: "Luyện IELTS, có lộ trình rõ ràng",
    title: "Chuẩn bị sáng suốt. Tự tin bước vào kỳ thi IELTS.",
    intro:
      "Xây dựng thói quen đúng với bài luyện tập tập trung, phản hồi hữu ích và lộ trình thích ứng khi bạn tiến bộ.",
    primary: "Bắt đầu lộ trình IELTS",
    secondary: "Đăng nhập",
    note: "Bạn sẽ chọn loại bài thi sau khi tạo tài khoản và có thể đổi lại với bước xem xét lộ trình rõ ràng.",
    pathLabel: "Lộ trình IELTS của bạn",
    todayLabel: "Hôm nay",
    todayTitle: "Đặt mục tiêu và xác định điểm xuất phát",
    todayBody: "Thiết lập ngắn gọn, sau đó bắt đầu một nhiệm vụ phù hợp.",
    pathSteps: [
      "Chọn Academic hoặc General Training",
      "Xây dựng lộ trình bốn kỹ năng",
      "Luyện tập tự tin",
    ],
    academicDifference: "Bài Đọc và Viết khác General Training",
    generalDifference: "Bài Đọc và Viết theo General Training",
    routeTitle: "Bắt đầu với loại bài thi phù hợp mục tiêu",
    academic: {
      title: "Academic",
      body: "Dành cho du học đại học, đăng ký nghề nghiệp hoặc các mục tiêu giáo dục bậc cao.",
      tag: "Du học & đăng ký nghề",
    },
    general: {
      title: "General Training",
      body: "Dành cho định cư, công việc hoặc học tập dưới bậc đại học trong môi trường nói tiếng Anh.",
      tag: "Định cư & công việc",
    },
    modesTitle: "Luyện tập linh hoạt, rồi mô phỏng ngày thi",
    modes: [
      [
        "Practice",
        "Luyện không giới hạn thời gian với gợi ý, giải thích, làm lại và phản hồi.",
      ],
      [
        "Exam Simulation",
        "Mô phỏng Nghe, Đọc và Viết có bấm giờ, quy tắc theo từng phần và nhận kết quả sau khi nộp.",
      ],
    ],
    skillsTitle: "Một không gian rõ ràng cho mọi kỹ năng IELTS",
    skills: ["Listening", "Reading", "Writing", "Speaking"],
    footer: "Luyện IELTS thực tế cho bước tiến tiếp theo của bạn.",
  },
} as const;
