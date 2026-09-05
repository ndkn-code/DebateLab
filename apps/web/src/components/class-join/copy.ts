import type { ClassJoinStatus } from "@/lib/class-join/contracts";

export type ClassJoinLocale = "en" | "vi";

type Copy = {
  inviteStudents: string;
  invitationFor: (title: string) => string;
  createCode: string;
  replaceCode: string;
  revokeCode: string;
  copyCode: string;
  copyLink: string;
  copied: string;
  copyFailed: string;
  expires: (date: string) => string;
  uses: (count: number, max: number) => string;
  policy: string;
  replaceQuestion: string;
  replaceDescription: string;
  revokeQuestion: string;
  revokeDescription: string;
  cancel: string;
  confirm: string;
  retry: string;
  close: string;
  loading: string;
  unavailable: string;
  enterCode: string;
  codeHint: string;
  preview: string;
  joinClass: string;
  signingIn: string;
  signInToJoin: string;
  signIn: string;
  classDetailsHidden: string;
  classReady: string;
  joined: string;
  alreadyJoined: string;
  success: string;
  goToClass: string;
  status: Record<ClassJoinStatus, string>;
};

const english: Copy = {
  inviteStudents: "Invite students",
  invitationFor: (title) => `Invitation for ${title}`,
  createCode: "Create invitation",
  replaceCode: "Replace invitation",
  revokeCode: "Revoke invitation",
  copyCode: "Copy code",
  copyLink: "Copy link",
  copied: "Copied",
  copyFailed: "Could not copy. Select and copy manually.",
  expires: (date) => `Expires ${date}`,
  uses: (count, max) => `${count} of ${max} new enrollments used`,
  policy:
    "Share this link with learners already in your center. It lasts 7 days and permits 100 new enrollments, subject to class capacity.",
  replaceQuestion: "Replace this invitation?",
  replaceDescription:
    "The current code will stop working immediately. Existing class memberships are not affected.",
  revokeQuestion: "Revoke this invitation?",
  revokeDescription:
    "Students who have not joined yet will no longer be able to use this code.",
  cancel: "Cancel",
  confirm: "Confirm",
  retry: "Try again",
  close: "Close",
  loading: "Loading…",
  unavailable: "We could not load this invitation.",
  enterCode: "Enter your invitation code",
  codeHint: "Paste the 32-character code from your teacher.",
  preview: "Preview class",
  joinClass: "Join class",
  signingIn: "Opening sign in…",
  signInToJoin: "Sign in to join this class",
  signIn: "Sign in",
  classDetailsHidden: "Sign in to preview the class details.",
  classReady: "You can join this class.",
  joined: "You joined the class.",
  alreadyJoined: "You are already in this class.",
  success: "Class joined successfully.",
  goToClass: "Go to class",
  status: {
    ready: "Ready to join",
    joined: "Joined",
    already_joined: "Already joined",
    invalid: "This invitation code is invalid.",
    expired: "This invitation has expired. Ask your teacher for a new link.",
    revoked:
      "This invitation has been revoked. Ask your teacher for a new link.",
    exhausted: "This invitation has reached its enrollment limit.",
    archived: "This class is archived.",
    full: "This class is full.",
    ineligible:
      "You are not eligible to join this class. Ask your teacher to check your learner access.",
    organization_required:
      "Ask your teacher to add you to the center first, then try again.",
    forbidden:
      "You cannot use this invitation. Ask the class teacher to check your access.",
    stale: "This invitation changed. Reload it to see the current invitation.",
    unavailable: "This invitation is temporarily unavailable.",
    sign_in_required: "Sign in to continue.",
  },
};

const vietnamese: Copy = {
  ...english,
  inviteStudents: "Mời học viên",
  invitationFor: (title) => `Lời mời cho ${title}`,
  createCode: "Tạo lời mời",
  replaceCode: "Thay lời mời",
  revokeCode: "Thu hồi lời mời",
  copyCode: "Sao chép mã",
  copyLink: "Sao chép liên kết",
  copied: "Đã sao chép",
  copyFailed: "Không thể sao chép. Hãy chọn và sao chép thủ công.",
  expires: (date) => `Hết hạn ${date}`,
  uses: (count, max) => `Đã dùng ${count}/${max} lượt tham gia mới`,
  policy:
    "Chia sẻ liên kết với học viên đã thuộc trung tâm. Lời mời có hiệu lực 7 ngày, tối đa 100 lượt tham gia mới và tùy theo chỗ trống của lớp.",
  replaceQuestion: "Thay lời mời này?",
  replaceDescription:
    "Mã hiện tại sẽ ngừng hoạt động ngay. Thành viên đã tham gia lớp không bị ảnh hưởng.",
  revokeQuestion: "Thu hồi lời mời này?",
  revokeDescription: "Học viên chưa tham gia sẽ không thể dùng mã này nữa.",
  cancel: "Hủy",
  confirm: "Xác nhận",
  retry: "Thử lại",
  close: "Đóng",
  loading: "Đang tải…",
  unavailable: "Không thể tải lời mời này.",
  enterCode: "Nhập mã lời mời",
  codeHint: "Dán mã 32 ký tự từ giáo viên của bạn.",
  preview: "Xem trước lớp",
  joinClass: "Tham gia lớp",
  signingIn: "Đang mở đăng nhập…",
  signInToJoin: "Đăng nhập để tham gia lớp",
  signIn: "Đăng nhập",
  classDetailsHidden: "Đăng nhập để xem thông tin lớp.",
  classReady: "Bạn có thể tham gia lớp này.",
  joined: "Bạn đã tham gia lớp.",
  alreadyJoined: "Bạn đã ở trong lớp này.",
  success: "Đã tham gia lớp thành công.",
  goToClass: "Mở lớp",
  status: {
    ...english.status,
    ready: "Sẵn sàng tham gia",
    joined: "Đã tham gia",
    already_joined: "Đã tham gia",
    invalid: "Mã lời mời không hợp lệ.",
    expired: "Lời mời đã hết hạn. Hãy xin giáo viên liên kết mới.",
    revoked: "Lời mời đã bị thu hồi. Hãy xin giáo viên liên kết mới.",
    exhausted: "Lời mời đã đạt giới hạn lượt tham gia.",
    archived: "Lớp đã được lưu trữ.",
    full: "Lớp đã đủ người.",
    ineligible:
      "Bạn không đủ điều kiện tham gia lớp này. Hãy nhờ giáo viên kiểm tra quyền học viên.",
    organization_required:
      "Hãy nhờ giáo viên thêm bạn vào trung tâm trước, sau đó thử lại.",
    forbidden:
      "Bạn không thể dùng lời mời này. Hãy nhờ giáo viên kiểm tra quyền truy cập.",
    stale: "Lời mời đã thay đổi. Hãy tải lại để xem lời mời hiện tại.",
    unavailable: "Lời mời tạm thời không khả dụng.",
    sign_in_required: "Đăng nhập để tiếp tục.",
  },
};

export function getClassJoinCopy(locale: string): Copy {
  return locale === "vi" ? vietnamese : english;
}
