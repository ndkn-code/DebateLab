export type TeacherAssistantLocale = "en" | "vi";

export type TeacherAssistantStage =
  | "loading_context"
  | "reading_materials"
  | "thinking"
  | "saving"
  | "completed"
  | "failed"
  | "stopped";

export const teacherAssistantCopy = {
  en: {
    assistant: "Teacher assistant",
    scopedTo: "Working in",
    history: "Conversation history",
    hideHistory: "Hide history",
    showHistory: "Show history",
    newConversation: "New conversation",
    recentConversations: "Recent conversations",
    emptyHistory: "Your conversations will appear here.",
    loadingHistory: "Loading conversations…",
    historyError: "We couldn’t load conversation history.",
    retry: "Try again",
    untitled: "Untitled conversation",
    noMessages: "Ask about a class, learner, or teaching task.",
    suggestions: "Try asking",
    composerLabel: "Message the teacher assistant",
    placeholder: "Ask about your classes or next teaching task…",
    send: "Send",
    stop: "Stop",
    stopping: "Stopping…",
    characters: "characters",
    status: {
      loading_context: "Checking your center context",
      reading_materials: "Reading class materials",
      thinking: "Preparing an answer",
      saving: "Saving your progress",
      completed: "Complete",
      failed: "Something went wrong",
      stopped: "Stopped",
    },
    conversationStatus: {
      queued: "Queued",
      working: "Working",
      running: "Working",
      needs_input: "Needs your input",
      needs_review: "Needs review",
      completed: "Complete",
      needs_follow_up: "Needs follow-up",
      stopped: "Stopped",
      failed: "Failed",
    },
    error: "The assistant couldn’t finish this request.",
    retryRequest: "Retry request",
    reviewNotice: "You’ll confirm before anything is sent or changed externally.",
  },
  vi: {
    assistant: "Trợ lý giáo viên",
    scopedTo: "Đang làm việc tại",
    history: "Lịch sử trò chuyện",
    hideHistory: "Ẩn lịch sử",
    showHistory: "Hiện lịch sử",
    newConversation: "Cuộc trò chuyện mới",
    recentConversations: "Trò chuyện gần đây",
    emptyHistory: "Các cuộc trò chuyện sẽ xuất hiện ở đây.",
    loadingHistory: "Đang tải cuộc trò chuyện…",
    historyError: "Không thể tải lịch sử trò chuyện.",
    retry: "Thử lại",
    untitled: "Cuộc trò chuyện chưa đặt tên",
    noMessages: "Hỏi về lớp học, học viên hoặc việc giảng dạy tiếp theo.",
    suggestions: "Bạn có thể hỏi",
    composerLabel: "Nhắn cho trợ lý giáo viên",
    placeholder: "Hỏi về lớp học hoặc việc cần dạy tiếp theo…",
    send: "Gửi",
    stop: "Dừng",
    stopping: "Đang dừng…",
    characters: "ký tự",
    status: {
      loading_context: "Đang kiểm tra thông tin trung tâm",
      reading_materials: "Đang đọc tài liệu lớp",
      thinking: "Đang chuẩn bị câu trả lời",
      saving: "Đang lưu tiến độ",
      completed: "Hoàn tất",
      failed: "Đã xảy ra lỗi",
      stopped: "Đã dừng",
    },
    conversationStatus: {
      queued: "Đang chờ",
      working: "Đang thực hiện",
      running: "Đang thực hiện",
      needs_input: "Cần bạn bổ sung",
      needs_review: "Cần xem lại",
      completed: "Hoàn tất",
      needs_follow_up: "Cần theo dõi thêm",
      stopped: "Đã dừng",
      failed: "Thất bại",
    },
    error: "Trợ lý chưa thể hoàn tất yêu cầu này.",
    retryRequest: "Thử lại yêu cầu",
    reviewNotice: "Bạn sẽ xác nhận trước khi nội dung được gửi hoặc thay đổi bên ngoài.",
  },
} as const;

export function getTeacherAssistantCopy(locale: TeacherAssistantLocale) {
  return teacherAssistantCopy[locale];
}
