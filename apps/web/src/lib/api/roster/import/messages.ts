/**
 * Bilingual rendering for roster-import issues and outcomes (B3).
 *
 * This lives in the library rather than in the i18n bundle because the *error
 * sheet* needs it: the downloadable fix-and-re-import artifact is generated
 * server-side and has no React context to read translations from. The dialog
 * reads the same table so a message never differs between screen and file.
 */
import type { ExportLocale } from "@/lib/export";
import type { RosterIssueCode, RosterRowIssue, RosterRowOutcome } from "./types";

type Localized = Record<ExportLocale, string>;

/** `{detail}` is replaced with the issue's offending value. */
const ISSUE_MESSAGES: Record<RosterIssueCode, Localized> = {
  missing_full_name: {
    en: "Full name is required.",
    vi: "Thiếu họ và tên.",
  },
  invalid_email: {
    en: '"{detail}" is not a valid email address.',
    vi: '"{detail}" không phải địa chỉ email hợp lệ.',
  },
  invalid_guardian_email: {
    en: 'Guardian email "{detail}" is not a valid email address.',
    vi: 'Email phụ huynh "{detail}" không hợp lệ.',
  },
  invalid_date: {
    en: '"{detail}" is not a date. Use 17/04/2009 (day first) or 2009-04-17.',
    vi: '"{detail}" không phải ngày. Dùng 17/04/2009 (ngày trước) hoặc 2009-04-17.',
  },
  invalid_student_code: {
    en: 'Student code "{detail}" contains characters that are not allowed.',
    vi: 'Mã học viên "{detail}" chứa ký tự không hợp lệ.',
  },
  duplicate_in_file: {
    en: "Duplicate in this file: {detail}",
    vi: "Trùng trong tệp này: {detail}",
  },
  duplicate_student_code: {
    en: "Duplicate student code in this file: {detail}",
    vi: "Trùng mã học viên trong tệp này: {detail}",
  },
  ambiguous_name_match: {
    en: "Matches an existing student by name and date of birth. Confirm before merging: {detail}",
    vi: "Trùng tên và ngày sinh với học viên đã có. Cần xác nhận trước khi gộp: {detail}",
  },
  class_at_capacity: {
    en: "The class is at capacity, so this student was not enrolled: {detail}",
    vi: "Lớp đã đủ sĩ số nên học viên chưa được xếp lớp: {detail}",
  },
  write_failed: {
    en: "Could not be saved: {detail}",
    vi: "Không lưu được: {detail}",
  },
};

const OUTCOME_LABELS: Record<RosterRowOutcome, Localized> = {
  created: { en: "Added", vi: "Đã thêm" },
  updated: { en: "Updated", vi: "Đã cập nhật" },
  skipped: { en: "Already up to date", vi: "Đã có, không đổi" },
  invited: { en: "Added and invited", vi: "Đã thêm và gửi lời mời" },
  email_skipped: { en: "Added, invite not sent", vi: "Đã thêm, chưa gửi lời mời" },
  needs_review: { en: "Needs review", vi: "Cần kiểm tra" },
  error: { en: "Not imported", vi: "Chưa nhập được" },
};

export function describeIssue(issue: RosterRowIssue, locale: ExportLocale): string {
  const template = ISSUE_MESSAGES[issue.code][locale];
  return template.replace("{detail}", issue.detail ?? "");
}

export function describeIssues(
  issues: readonly RosterRowIssue[],
  locale: ExportLocale,
): string {
  return issues.map((issue) => describeIssue(issue, locale)).join(" ");
}

export function describeOutcome(outcome: RosterRowOutcome, locale: ExportLocale): string {
  return OUTCOME_LABELS[outcome][locale];
}

export const ROSTER_ISSUE_MESSAGES = ISSUE_MESSAGES;
export const ROSTER_OUTCOME_LABELS = OUTCOME_LABELS;
