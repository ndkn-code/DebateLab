import type {
  NotificationCadence,
  NotificationInboxFilter,
  NotificationTopic,
} from "./contracts";

export type NotificationLocale = "en" | "vi";

const copy = {
  en: {
    inbox: {
      title: "Notifications",
      description: "Updates that need your attention, kept in one place.",
      unread: (count: number) => `${count} unread`,
      markAll: "Mark all read",
      today: "Today",
      earlier: "Earlier",
      emptyTitle: "You’re all caught up",
      emptyBody: "New learning and class updates will appear here.",
      loading: "Loading notifications…",
      loadError: "Notifications couldn’t be loaded.",
      retry: "Try again",
      markRead: "Mark as read",
      mute: "Mute updates about this item",
      muted: "Updates about this item muted",
      mutedLabel: "Muted",
      open: "Open update",
      filters: {
        all: "All",
        unread: "Unread",
        learning: "Learning",
        classes: "Classes",
      } satisfies Record<NotificationInboxFilter, string>,
    },
    settings: {
      title: "Notifications",
      description:
        "Choose which updates reach you and when optional email is delivered.",
      reviewTitle: "Review your notification choices",
      reviewBody:
        "We carried over your previous email setting. Check the topics below when it’s convenient.",
      reviewAction: "Review now",
      reviewDismiss: "Later",
      optionalEmail: "Optional email",
      optionalEmailBody:
        "Turn off every non-essential email while keeping account and security messages.",
      inApp: "In-app",
      email: "Email",
      cadence: "Cadence",
      essential: "Essential",
      essentialHelp:
        "Account and security notices stay on so you can recover and protect your account.",
      deliveryTitle: "Delivery schedule",
      timezone: "Timezone",
      quietHours: "Quiet hours",
      quietHoursBody:
        "In-app alerts wait until quiet hours end. Essential security alerts are not delayed.",
      start: "Starts",
      end: "Ends",
      save: "Save notification preferences",
      loading: "Loading your notification preferences…",
      saved: "Notification preferences saved",
      saveError: "Couldn’t save notification preferences. Try again.",
      wiring:
        "Notification preferences are ready for the notification service adapter.",
      topics: {
        practice: ["Practice reminders", "Planned sessions and useful nudges."],
        streak: [
          "Study consistency",
          "A timely reminder when your routine is at risk.",
        ],
        achievements: [
          "Progress milestones",
          "Meaningful level and learning milestones.",
        ],
        assignments: [
          "Assignments",
          "New work, due dates, and submission changes.",
        ],
        teacher_feedback: [
          "Teacher feedback",
          "Published reviews and requests to revise.",
        ],
        class_updates: [
          "Class updates",
          "Announcements, schedule changes, and resources.",
        ],
        product_updates: [
          "Product updates",
          "Occasional changes that affect how Thinkfy works.",
        ],
        account_security: [
          "Account & security",
          "Sign-in, recovery, privacy, and billing notices.",
        ],
      } satisfies Record<NotificationTopic, [string, string]>,
      cadenceLabels: {
        immediate: "Immediate",
        daily: "Daily delivery",
        weekly: "Weekly delivery",
        off: "Off",
      } satisfies Record<NotificationCadence, string>,
    },
  },
  vi: {
    inbox: {
      title: "Thông báo",
      description: "Những cập nhật cần bạn chú ý, tập trung ở một nơi.",
      unread: (count: number) => `${count} chưa đọc`,
      markAll: "Đánh dấu tất cả đã đọc",
      today: "Hôm nay",
      earlier: "Trước đó",
      emptyTitle: "Bạn đã xem hết",
      emptyBody: "Cập nhật mới về học tập và lớp học sẽ xuất hiện tại đây.",
      loading: "Đang tải thông báo…",
      loadError: "Không thể tải thông báo.",
      retry: "Thử lại",
      markRead: "Đánh dấu đã đọc",
      mute: "Tắt cập nhật về mục này",
      muted: "Đã tắt cập nhật về mục này",
      mutedLabel: "Đã tắt",
      open: "Mở cập nhật",
      filters: {
        all: "Tất cả",
        unread: "Chưa đọc",
        learning: "Học tập",
        classes: "Lớp học",
      } satisfies Record<NotificationInboxFilter, string>,
    },
    settings: {
      title: "Thông báo",
      description:
        "Chọn cập nhật nào sẽ đến với bạn và thời điểm gửi email tùy chọn.",
      reviewTitle: "Xem lại lựa chọn thông báo",
      reviewBody:
        "Chúng tôi đã chuyển cài đặt email cũ của bạn. Bạn có thể kiểm tra từng chủ đề khi thuận tiện.",
      reviewAction: "Xem ngay",
      reviewDismiss: "Để sau",
      optionalEmail: "Email tùy chọn",
      optionalEmailBody:
        "Tắt mọi email không thiết yếu nhưng vẫn giữ thông báo tài khoản và bảo mật.",
      inApp: "Trong ứng dụng",
      email: "Email",
      cadence: "Tần suất",
      essential: "Thiết yếu",
      essentialHelp:
        "Thông báo tài khoản và bảo mật luôn bật để bạn có thể khôi phục và bảo vệ tài khoản.",
      deliveryTitle: "Lịch gửi",
      timezone: "Múi giờ",
      quietHours: "Giờ yên tĩnh",
      quietHoursBody:
        "Thông báo trong ứng dụng sẽ đợi đến khi giờ yên tĩnh kết thúc. Cảnh báo bảo mật thiết yếu không bị trì hoãn.",
      start: "Bắt đầu",
      end: "Kết thúc",
      save: "Lưu tùy chọn thông báo",
      loading: "Đang tải tùy chọn thông báo…",
      saved: "Đã lưu tùy chọn thông báo",
      saveError: "Không thể lưu tùy chọn thông báo. Hãy thử lại.",
      wiring: "Tùy chọn thông báo đã sẵn sàng để kết nối dịch vụ.",
      topics: {
        practice: [
          "Nhắc luyện tập",
          "Buổi học theo kế hoạch và lời nhắc hữu ích.",
        ],
        streak: [
          "Nhịp học",
          "Nhắc đúng lúc khi thói quen học có nguy cơ gián đoạn.",
        ],
        achievements: [
          "Cột mốc tiến bộ",
          "Cấp độ và cột mốc học tập có ý nghĩa.",
        ],
        assignments: [
          "Bài tập",
          "Bài mới, hạn nộp và thay đổi trạng thái nộp bài.",
        ],
        teacher_feedback: [
          "Phản hồi giáo viên",
          "Bài nhận xét đã công bố và yêu cầu sửa lại.",
        ],
        class_updates: ["Cập nhật lớp", "Thông báo, đổi lịch và tài liệu mới."],
        product_updates: [
          "Cập nhật sản phẩm",
          "Thay đổi thỉnh thoảng ảnh hưởng cách Thinkfy hoạt động.",
        ],
        account_security: [
          "Tài khoản & bảo mật",
          "Đăng nhập, khôi phục, quyền riêng tư và thanh toán.",
        ],
      } satisfies Record<NotificationTopic, [string, string]>,
      cadenceLabels: {
        immediate: "Ngay lập tức",
        daily: "Gửi hằng ngày",
        weekly: "Gửi hằng tuần",
        off: "Tắt",
      } satisfies Record<NotificationCadence, string>,
    },
  },
} as const;

export function getNotificationCopy(locale: NotificationLocale) {
  return copy[locale];
}
