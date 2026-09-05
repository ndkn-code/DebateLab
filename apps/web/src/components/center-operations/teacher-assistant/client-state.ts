import type {
  CenterSnapshot,
  TeacherHistory,
} from "@/lib/center-operations/contracts";

export type PendingTeacherRequest = {
  key: string;
  message: string;
  conversationId?: string;
  startedAt: string;
};
export const teacherStorageKey = (organizationId: string, actorId: string) =>
  `center-teacher:${organizationId}:${actorId}`;

export function readTeacherStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
export function writeTeacherStorage(key: string, value: string | null) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    /* History is server-backed; unavailable local storage must not block chat. */
  }
}
export function parsePendingTeacherRequest(
  raw: string | null,
): PendingTeacherRequest | null {
  try {
    const value = JSON.parse(raw ?? "null");
    if (
      !value ||
      typeof value.key !== "string" ||
      typeof value.message !== "string" ||
      typeof value.startedAt !== "string" ||
      !Number.isFinite(Date.parse(value.startedAt))
    )
      return null;
    if (
      value.conversationId !== undefined &&
      typeof value.conversationId !== "string"
    )
      return null;
    return value;
  } catch {
    return null;
  }
}

export function teacherErrorMessage(
  error: string,
  locale: "en" | "vi",
): string {
  const vi = locale === "vi";
  if (/forbidden|unauthorized|access|scope|42501/i.test(error))
    return vi
      ? "Bạn không còn quyền truy cập dữ liệu này. Hãy chọn lại trung tâm hoặc liên hệ quản lý."
      : "You no longer have access to this data. Choose your center again or contact its manager.";
  if (/limit|rate|429/i.test(error))
    return vi
      ? "Bạn đã gửi nhiều yêu cầu. Hãy chờ một chút rồi thử lại."
      : "You have sent several requests. Wait a little, then try again.";
  if (/stopped/i.test(error))
    return vi
      ? "Đã dừng. Bạn có thể chỉnh sửa yêu cầu rồi gửi lại."
      : "Stopped. You can edit your request and send it again.";
  if (/expired|revision|changed|stale/i.test(error))
    return vi
      ? "Dữ liệu đã thay đổi. Hãy làm mới cuộc trò chuyện và yêu cầu bản đề xuất mới."
      : "The record has changed. Refresh the conversation and ask for a new proposal.";
  if (/timeout|deadline/i.test(error))
    return vi
      ? "Yêu cầu mất quá nhiều thời gian. Nội dung của bạn vẫn được giữ để thử lại."
      : "This request took too long. Your message is kept so you can try again.";
  if (/decision/i.test(error))
    return vi
      ? "Chưa xác nhận được kết quả. Hãy tải lại cuộc trò chuyện trước khi thử lại."
      : "We could not confirm the outcome. Reload the conversation before trying again.";
  return vi
    ? "Chưa hoàn tất được yêu cầu. Nội dung của bạn vẫn được giữ. Hãy thử lại."
    : "We could not finish this request. Your message is kept. Please try again.";
}

export function teacherStarterPrompts(
  snapshot: CenterSnapshot,
  locale: "en" | "vi",
  classId: string,
): string[] {
  const vi = locale === "vi";
  const cls = snapshot.classes.find((item) => item.id === classId);
  const target =
    cls?.name ?? (vi ? "các lớp tôi phụ trách" : "my assigned classes");
  return vi
    ? [
        `Tóm tắt lịch học và ghi chú hiện có trong tuần này cho ${target}. Nêu rõ dữ liệu còn thiếu.`,
        `Giúp tôi soạn bản nháp bài tập cho ${target}. Hỏi tôi chủ đề nếu chưa rõ.`,
        `Giúp tôi soạn kế hoạch bài học cho ${target}. Hỏi tôi mục tiêu và thời lượng nếu chưa rõ.`,
        "Giúp tôi ghi chú riêng về một học viên. Hỏi tôi tên và nội dung cần lưu.",
      ]
    : [
        `Summarize this week's available schedule and notes for ${target}. Explain any missing data.`,
        `Help me draft homework for ${target}. Ask me the topic if it is unclear.`,
        `Help me draft a lesson for ${target}. Ask about goals and duration if needed.`,
        "Help me save an internal student note. Ask for the student's name and what to record.",
      ];
}

export function requestFromHistory(
  history: TeacherHistory,
): PendingTeacherRequest | null {
  const key = history.run?.requestKey;
  if (!key) return null;
  const message = history.messages.find(
    (item) => item.role === "user" && item.metadata.requestKey === key,
  );
  return message
    ? {
        key,
        message: message.body,
        conversationId: history.conversationId,
        startedAt: history.run!.startedAt,
      }
    : null;
}
