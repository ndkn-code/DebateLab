export const reuseCopy = {
  en: {
    newCohort: "new cohort",
    draft: "Draft",
    draftNotice:
      "The class, materials and assignments start as drafts. Nothing is published.",
    missingStart: "The source has no start date. Copied dates will be cleared.",
    shiftHelp:
      "Preserve local clock time and move by the difference between class start dates.",
    emptyItems: "No items in this class.",
    days: "calendar days",
    clearHelp:
      "Copied due dates and release windows will be cleared. Missing dates stay unscheduled.",
    release: "Release",
    expires: "Expires",
    due: "Due",
    reload: "Reload preview",
    retryCreate: "Retry creating this class",
    retryHelp:
      "The outcome is not confirmed. Retry this same request to recover the class safely; your request is saved in this browser tab.",
    title: "Reuse curriculum",
    description:
      "Start a new cohort with selected curriculum from an existing class.",
    source: "Source class",
    destination: "New class",
    chooseSource: "Choose a source class",
    classTitle: "Class name",
    titlePlaceholder: "Class name",
    dates: "Class dates",
    startDate: "Start date",
    endDate: "End date",
    dateFormat: "Use YYYY-MM-DD",
    dateMode: "Date handling",
    clearDates: "Clear dates",
    shiftDates: "Shift dates from the new start",
    timezone: "Timezone",
    curriculum: "Curriculum",
    courses: "Courses",
    materials: "Materials",
    assignments: "Assignments",
    lesson: "lesson",
    lessons: "lessons",
    selected: "selected",
    legacy: (count: number) =>
      `${count} older resource${count === 1 ? "" : "s"} will stay in the source class. Only approved shared material placements can be reused here.`,
    notEligible: "Not eligible for reuse",
    noCopy:
      "Learners, attendance, submissions, grades, feedback, announcements, progress, teacher allocation, and schedule are never copied.",
    continue: "Continue to review",
    review: "Review new class",
    create: "Create draft class",
    back: "Back",
    close: "Close",
    loading: "Loading preview…",
    creating: "Creating draft…",
    failed: "Something went wrong. Your selections are still here; try again.",
    sourceChanged:
      "This source changed. Review the latest curriculum before creating the class.",
    datePreview: "Date preview",
    before: "Before",
    after: "After",
    draftReady: "Draft class created",
    nextSteps: "Next steps",
    assignTeacher: "Assign a teacher",
    setSchedule: "Set a schedule",
    enrollLearners: "Enroll learners",
    publish: "Publish when ready",
    noSource: "No eligible source classes are available.",
    sourceDates: "Source dates",
    notScheduled: "Not scheduled",
    sharedReference:
      "Selected courses remain shared references; edits affect the same curriculum.",
    destinationClass: "Destination class",
  },
  vi: {
    newCohort: "nhóm mới",
    draft: "Bản nháp",
    draftNotice:
      "Lớp, tài liệu và bài tập đều ở trạng thái nháp. Chưa xuất bản nội dung nào.",
    missingStart:
      "Lớp nguồn chưa có ngày bắt đầu. Ngày của nội dung sao chép sẽ được xóa.",
    shiftHelp:
      "Giữ giờ địa phương và dời theo chênh lệch ngày bắt đầu của hai lớp.",
    emptyItems: "Lớp này chưa có nội dung.",
    days: "ngày theo lịch",
    clearHelp:
      "Hạn nộp và thời gian mở tài liệu sẽ được xóa. Ngày còn thiếu vẫn để trống.",
    release: "Mở từ",
    expires: "Hết hạn",
    due: "Hạn nộp",
    reload: "Tải lại bản xem trước",
    retryCreate: "Thử tạo lại lớp này",
    retryHelp:
      "Chưa xác nhận được kết quả. Thử lại cùng yêu cầu để khôi phục lớp an toàn; yêu cầu được lưu trong thẻ trình duyệt này.",
    title: "Tái sử dụng giáo trình",
    description:
      "Bắt đầu nhóm học viên mới với giáo trình đã chọn từ một lớp hiện có.",
    source: "Lớp nguồn",
    destination: "Lớp mới",
    chooseSource: "Chọn lớp nguồn",
    classTitle: "Tên lớp",
    titlePlaceholder: "Tên lớp",
    dates: "Thời gian lớp",
    startDate: "Ngày bắt đầu",
    endDate: "Ngày kết thúc",
    dateFormat: "Dùng định dạng YYYY-MM-DD",
    dateMode: "Cách xử lý ngày",
    clearDates: "Xóa ngày",
    shiftDates: "Dời ngày theo ngày bắt đầu mới",
    timezone: "Múi giờ",
    curriculum: "Giáo trình",
    courses: "Khóa học",
    materials: "Tài liệu",
    assignments: "Bài tập",
    lesson: "bài học",
    lessons: "bài học",
    selected: "đã chọn",
    legacy: (count: number) =>
      `${count} tài nguyên cũ sẽ được giữ ở lớp nguồn. Chỉ tài liệu dùng chung đã được duyệt mới được tái sử dụng tại đây.`,
    notEligible: "Không đủ điều kiện tái sử dụng",
    noCopy:
      "Học viên, điểm danh, bài nộp, điểm số, nhận xét, thông báo, tiến độ, phân công giáo viên và lịch học sẽ không được sao chép.",
    continue: "Tiếp tục xem lại",
    review: "Xem lại lớp mới",
    create: "Tạo lớp nháp",
    back: "Quay lại",
    close: "Đóng",
    loading: "Đang tải bản xem trước…",
    creating: "Đang tạo lớp nháp…",
    failed: "Đã xảy ra lỗi. Các lựa chọn vẫn được giữ lại; hãy thử lại.",
    sourceChanged:
      "Lớp nguồn đã thay đổi. Hãy xem lại giáo trình mới nhất trước khi tạo lớp.",
    datePreview: "Xem trước ngày",
    before: "Trước",
    after: "Sau",
    draftReady: "Đã tạo lớp nháp",
    nextSteps: "Bước tiếp theo",
    assignTeacher: "Phân công giáo viên",
    setSchedule: "Đặt lịch học",
    enrollLearners: "Thêm học viên",
    publish: "Xuất bản khi sẵn sàng",
    noSource: "Không có lớp nguồn đủ điều kiện.",
    sourceDates: "Thời gian lớp nguồn",
    notScheduled: "Chưa lên lịch",
    sharedReference:
      "Các khóa học đã chọn vẫn dùng chung giáo trình; chỉnh sửa sẽ áp dụng cho cùng giáo trình.",
    destinationClass: "Lớp đích",
  },
} as const;

export const reuseReasons: Record<"en" | "vi", Record<string, string>> = {
  en: {
    unavailable: "Unavailable for reuse",
    class_scoped: "Private to the source class",
    selected_audience: "Assigned to specific learners",
    rights: "Reuse rights are not approved",
    not_ready: "Processing or content review is incomplete",
    program: "Different teaching program",
    linked_assignment: "Linked work needs separate setup",
  },
  vi: {
    unavailable: "Chưa thể tái sử dụng",
    class_scoped: "Chỉ dành riêng cho lớp nguồn",
    selected_audience: "Đã giao cho học viên cụ thể",
    rights: "Chưa duyệt quyền tái sử dụng",
    not_ready: "Chưa xử lý hoặc duyệt xong nội dung",
    program: "Khác chương trình giảng dạy",
    linked_assignment: "Bài tập có liên kết cần thiết lập riêng",
  },
};
export const reuseErrors: Record<"en" | "vi", Record<string, string>> = {
  en: {
    REUSE_INVALID_INPUT:
      "Check the class name and dates. Use YYYY-MM-DD and an end date on or after the start date.",
    REUSE_INVALID_DATES:
      "Check both class dates. Shifting requires a source and a new start date.",
    REUSE_INVALID_TIMEZONE: "Choose a valid timezone.",
    REUSE_DST_GAP:
      "A shifted time does not exist because the clocks change. Clear dates or choose another start date.",
    REUSE_DATE_OUTSIDE_CLASS:
      "A copied date falls outside the new class dates. Extend the class dates or clear copied dates.",
    REUSE_SOURCE_CHANGED:
      "The source changed. Review the refreshed content before creating the class.",
    REUSE_INELIGIBLE_SELECTION:
      "Some selected content can no longer be reused. Reload the preview.",
    REUSE_FORBIDDEN: "You no longer have permission to reuse this class.",
    REUSE_NOT_FOUND: "The source class is no longer available.",
    REUSE_IDEMPOTENCY_CONFLICT:
      "This saved request differs from the original. Close and reopen to recover the original request.",
    REUSE_RETRY_PENDING:
      "A previous create request needs confirmation. Retry to recover its result.",
  },
  vi: {
    REUSE_INVALID_INPUT:
      "Kiểm tra tên lớp và ngày. Dùng YYYY-MM-DD; ngày kết thúc không được trước ngày bắt đầu.",
    REUSE_INVALID_DATES:
      "Kiểm tra ngày của hai lớp. Để dời ngày, cần ngày bắt đầu của lớp nguồn và lớp mới.",
    REUSE_INVALID_TIMEZONE: "Chọn múi giờ hợp lệ.",
    REUSE_DST_GAP:
      "Giờ sau khi dời không tồn tại do đổi giờ mùa hè. Xóa ngày hoặc chọn ngày bắt đầu khác.",
    REUSE_DATE_OUTSIDE_CLASS:
      "Một ngày sao chép nằm ngoài thời gian lớp mới. Mở rộng thời gian lớp hoặc xóa ngày sao chép.",
    REUSE_SOURCE_CHANGED:
      "Lớp nguồn đã thay đổi. Xem lại nội dung mới tải trước khi tạo lớp.",
    REUSE_INELIGIBLE_SELECTION:
      "Một số nội dung đã chọn không còn được tái sử dụng. Tải lại bản xem trước.",
    REUSE_FORBIDDEN: "Bạn không còn quyền tái sử dụng lớp này.",
    REUSE_NOT_FOUND: "Lớp nguồn không còn khả dụng.",
    REUSE_IDEMPOTENCY_CONFLICT:
      "Yêu cầu đã lưu khác yêu cầu ban đầu. Đóng rồi mở lại để khôi phục yêu cầu gốc.",
    REUSE_RETRY_PENDING:
      "Yêu cầu tạo lớp trước đó cần xác nhận. Thử lại để khôi phục kết quả.",
  },
};
