export const IELTS_SETTINGS_TIMEZONES = [
  "Asia/Ho_Chi_Minh",
  "Europe/London",
  "America/New_York",
  "Australia/Sydney",
  "UTC",
] as const;

export const IELTS_SETTINGS_COPY = {
  en: {
    back: "IELTS home",
    eyebrow: "IELTS preferences",
    title: "Settings",
    intro:
      "Keep your study plan, exam setup, and coaching preferences in one place.",
    saved: "Saved",
    unsaved: "Unsaved changes",
    saving: "Saving…",
    save: "Save changes",
    retry: "Please try again. Your previous settings are still safe.",
    goalTitle: "Goal and test date",
    goalCaption: "Your plan uses these values to choose pace and priorities.",
    overallBand: "Target band",
    testDate: "Test date",
    testType: "Test type",
    academic: "Academic",
    generalTraining: "General Training",
    noGoal: "Complete IELTS setup to create a target and weekly plan.",
    setGoal: "Set up IELTS",
    editPlan: "Edit full study plan",
    weeklyTitle: "Weekly plan",
    weeklyCaption:
      "Review your study rhythm and the timezone used for due dates.",
    studyDays: "Study days",
    dailyTime: "Daily time",
    minutes: "{count} min",
    timezone: "Plan timezone",
    timezoneHint:
      "Changing timezone regenerates future plan dates; completed work stays intact.",
    monday: "Mon",
    tuesday: "Tue",
    wednesday: "Wed",
    thursday: "Thu",
    friday: "Fri",
    saturday: "Sat",
    sunday: "Sun",
    examTitle: "Exam accessibility and display",
    examCaption:
      "Simulation controls stay close to the task so they can be adjusted when needed.",
    examBody:
      "Text size, contrast, highlighting, notes, and audio controls are available in the simulation setup and exam toolbar. Account-level exam display presets are not supported yet.",
    examCta: "Open test library",
    displayCta: "Manage app appearance",
    audioTitle: "Microphone readiness",
    audioCaption:
      "Check this browser before Speaking Rehearsal. Nothing is recorded or uploaded.",
    audioIdle: "Microphone has not been checked on this device.",
    audioTesting: "Checking microphone access…",
    audioReady: "Microphone is ready in this browser.",
    audioBlocked:
      "Microphone access is blocked. Allow it in browser settings, then check again.",
    audioUnavailable: "No compatible microphone was found in this browser.",
    audioCheck: "Check microphone",
    audioAgain: "Check again",
    speakingCta: "Open Speaking Rehearsal",
    coachTitle: "AI coaching",
    coachCaption:
      "Choose the language used for IELTS explanations and feedback.",
    feedbackLanguage: "Feedback language",
    english: "English",
    vietnamese: "Vietnamese",
    coachStyle: "Coaching style",
    coachStyleBody:
      "A separate IELTS coaching-style preference is not persisted yet. The coach adapts to the language above and the task context.",
    notificationTitle: "Notifications",
    notificationCaption:
      "These account-wide choices also affect reminders outside IELTS.",
    practiceReminders: "Account practice reminders",
    practiceRemindersBody:
      "Remind me when planned practice work is due across Thinkfy.",
    emailUpdates: "Account email reminders",
    emailUpdatesBody:
      "Send practice reminders and important account updates by email.",
    privacyTitle: "Privacy and data",
    privacyCaption:
      "Review account-wide privacy, analytics, and data controls.",
    privacyBody:
      "IELTS settings never change who can see your account. Account privacy and destructive actions remain in the protected privacy center and require confirmation.",
    privacyCta: "Open privacy controls",
    planSaveNote:
      "Goal, language, and timezone are saved to your IELTS study plan.",
    notificationsSaveNote:
      "These notification choices apply to your whole Thinkfy account.",
  },
  vi: {
    back: "Trang IELTS",
    eyebrow: "Tùy chọn IELTS",
    title: "Cài đặt",
    intro:
      "Quản lý kế hoạch học, thiết lập thi và tùy chọn hướng dẫn ở một nơi.",
    saved: "Đã lưu",
    unsaved: "Có thay đổi chưa lưu",
    saving: "Đang lưu…",
    save: "Lưu thay đổi",
    retry: "Vui lòng thử lại. Cài đặt trước đó của bạn vẫn an toàn.",
    goalTitle: "Mục tiêu và ngày thi",
    goalCaption: "Kế hoạch dùng các thông tin này để chọn nhịp học và ưu tiên.",
    overallBand: "Band mục tiêu",
    testDate: "Ngày thi",
    testType: "Loại bài thi",
    academic: "Học thuật",
    generalTraining: "Tổng quát",
    noGoal: "Hoàn tất thiết lập IELTS để tạo mục tiêu và kế hoạch tuần.",
    setGoal: "Thiết lập IELTS",
    editPlan: "Chỉnh toàn bộ kế hoạch",
    weeklyTitle: "Kế hoạch tuần",
    weeklyCaption: "Xem nhịp học và múi giờ dùng cho hạn hoàn thành.",
    studyDays: "Ngày học",
    dailyTime: "Thời lượng mỗi ngày",
    minutes: "{count} phút",
    timezone: "Múi giờ kế hoạch",
    timezoneHint:
      "Đổi múi giờ sẽ tạo lại các ngày sắp tới; phần đã hoàn thành được giữ nguyên.",
    monday: "T2",
    tuesday: "T3",
    wednesday: "T4",
    thursday: "T5",
    friday: "T6",
    saturday: "T7",
    sunday: "CN",
    examTitle: "Hiển thị và hỗ trợ khi thi",
    examCaption:
      "Các điều khiển mô phỏng nằm gần bài làm để bạn chỉnh khi cần.",
    examBody:
      "Cỡ chữ, độ tương phản, tô sáng, ghi chú và âm thanh có trong bước chuẩn bị và thanh công cụ của bài mô phỏng. Hiện chưa hỗ trợ lưu sẵn thiết lập hiển thị thi cho tài khoản.",
    examCta: "Mở thư viện đề",
    displayCta: "Quản lý giao diện ứng dụng",
    audioTitle: "Kiểm tra micrô",
    audioCaption:
      "Kiểm tra trình duyệt này trước khi Luyện nói. Không có âm thanh nào được ghi hoặc tải lên.",
    audioIdle: "Micrô chưa được kiểm tra trên thiết bị này.",
    audioTesting: "Đang kiểm tra quyền truy cập micrô…",
    audioReady: "Micrô đã sẵn sàng trong trình duyệt này.",
    audioBlocked:
      "Quyền micrô đang bị chặn. Hãy cho phép trong cài đặt trình duyệt rồi thử lại.",
    audioUnavailable: "Không tìm thấy micrô tương thích trong trình duyệt này.",
    audioCheck: "Kiểm tra micrô",
    audioAgain: "Kiểm tra lại",
    speakingCta: "Mở Luyện nói",
    coachTitle: "Hướng dẫn bằng AI",
    coachCaption: "Chọn ngôn ngữ cho phần giải thích và phản hồi IELTS.",
    feedbackLanguage: "Ngôn ngữ phản hồi",
    english: "Tiếng Anh",
    vietnamese: "Tiếng Việt",
    coachStyle: "Phong cách hướng dẫn",
    coachStyleBody:
      "Hiện chưa có hợp đồng lưu riêng cho phong cách hướng dẫn IELTS. Trợ lý sẽ điều chỉnh theo ngôn ngữ ở trên và ngữ cảnh bài tập.",
    notificationTitle: "Thông báo",
    notificationCaption:
      "Các lựa chọn cấp tài khoản này cũng áp dụng ngoài IELTS.",
    practiceReminders: "Nhắc luyện tập toàn tài khoản",
    practiceRemindersBody:
      "Nhắc tôi khi bài luyện đã lên kế hoạch trên Thinkfy đến hạn.",
    emailUpdates: "Nhắc email toàn tài khoản",
    emailUpdatesBody:
      "Gửi lời nhắc luyện tập và cập nhật quan trọng của tài khoản qua email.",
    privacyTitle: "Quyền riêng tư và dữ liệu",
    privacyCaption:
      "Xem các tùy chọn quyền riêng tư, phân tích và dữ liệu của tài khoản.",
    privacyBody:
      "Cài đặt IELTS không thay đổi người có thể xem tài khoản của bạn. Quyền riêng tư và thao tác xóa dữ liệu nằm trong trung tâm bảo mật và luôn yêu cầu xác nhận.",
    privacyCta: "Mở cài đặt quyền riêng tư",
    planSaveNote: "Mục tiêu, ngôn ngữ và múi giờ được lưu vào kế hoạch IELTS.",
    notificationsSaveNote:
      "Các lựa chọn thông báo này áp dụng cho toàn bộ tài khoản Thinkfy.",
  },
} as const;

export type IeltsSettingsCopy =
  | (typeof IELTS_SETTINGS_COPY)["en"]
  | (typeof IELTS_SETTINGS_COPY)["vi"];
