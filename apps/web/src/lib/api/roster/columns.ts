/**
 * The roster field set — declared **once** (B3).
 *
 * The downloadable template, the column-mapping auto-suggest, the importer and
 * the error sheet all read this array. That is the point: a template whose
 * headers the importer does not recognize is the classic bulk-import failure,
 * and it is only avoidable if one declaration drives both ends.
 *
 * Vietnamese aliases are not a nicety. A real Đà Nẵng centre roster has
 * `Họ và tên`, `Ngày sinh`, `SĐT phụ huynh` — a English-only alias table
 * auto-maps nothing and every teacher does ten dropdowns by hand.
 */
import type { ExportLocale } from "@/lib/export";

export type RosterFieldId =
  | "fullName"
  | "email"
  | "studentCode"
  | "dateOfBirth"
  | "phone"
  | "guardianName"
  | "guardianPhone"
  | "guardianEmail"
  | "notes";

export interface RosterField {
  id: RosterFieldId;
  /** Template header text, and the header the error sheet writes back. */
  header: Record<ExportLocale, string>;
  /** Only `fullName` is required — a roster works on paper before it has emails. */
  required: boolean;
  /**
   * Extra header spellings, already normalized (lowercase, unaccented). The
   * localized `header` values are added automatically.
   */
  aliases: readonly string[];
  hint: Record<ExportLocale, string>;
}

export const ROSTER_FIELDS: readonly RosterField[] = [
  {
    id: "fullName",
    header: { en: "Full name", vi: "Họ và tên" },
    required: true,
    aliases: ["ho ten", "hoten", "hovaten", "ten hoc vien", "hoc vien", "ten", "name", "student name", "student"],
    hint: { en: "Required", vi: "Bắt buộc" },
  },
  {
    id: "email",
    header: { en: "Email", vi: "Email" },
    required: false,
    aliases: ["e mail", "thu dien tu", "dia chi email", "email hoc vien", "mail"],
    hint: {
      // Kept to two short clauses: this string is a helper line under a mapping
      // row, and the Vietnamese runs ~30% longer. Siblings sharing one parent
      // address is common here and two rows with the same email block each
      // other, so the second clause has to survive the trim.
      en: "Invites the student. A shared family address goes in Guardian email.",
      vi: "Dùng để mời học viên. Email chung của gia đình điền ở cột Email phụ huynh.",
    },
  },
  {
    id: "studentCode",
    header: { en: "Student code", vi: "Mã học viên" },
    required: false,
    aliases: ["ma hoc vien", "mahv", "ma hs", "ma so", "student id", "student code", "code", "id", "stt"],
    hint: { en: "Your own code. Must be unique in the club.", vi: "Mã riêng của trung tâm. Không trùng trong CLB." },
  },
  {
    id: "dateOfBirth",
    header: { en: "Date of birth", vi: "Ngày sinh" },
    required: false,
    aliases: ["ngay sinh", "ngaysinh", "sinh ngay", "dob", "birthday", "date of birth", "ns"],
    hint: { en: "Day first: 17/04/2009 or 2009-04-17.", vi: "Ngày trước: 17/04/2009 hoặc 2009-04-17." },
  },
  {
    id: "phone",
    header: { en: "Phone", vi: "Số điện thoại" },
    required: false,
    aliases: ["so dien thoai", "sdt", "dien thoai", "phone", "mobile", "tel", "dt"],
    hint: { en: "Student's own number.", vi: "Số của học viên." },
  },
  {
    id: "guardianName",
    header: { en: "Guardian name", vi: "Tên phụ huynh" },
    required: false,
    aliases: ["ten phu huynh", "phu huynh", "ph", "guardian", "parent", "parent name", "nguoi giam ho"],
    hint: { en: "Parent or guardian.", vi: "Cha mẹ hoặc người giám hộ." },
  },
  {
    id: "guardianPhone",
    header: { en: "Guardian phone", vi: "SĐT phụ huynh" },
    required: false,
    aliases: ["sdt phu huynh", "so dien thoai phu huynh", "dien thoai phu huynh", "sdt ph", "parent phone", "guardian phone"],
    hint: { en: "Where the centre calls about this student.", vi: "Số trung tâm liên hệ về học viên." },
  },
  {
    id: "guardianEmail",
    header: { en: "Guardian email", vi: "Email phụ huynh" },
    required: false,
    aliases: ["email phu huynh", "mail phu huynh", "email ph", "parent email", "guardian email"],
    hint: { en: "Used later for the parent report.", vi: "Dùng cho báo cáo gửi phụ huynh sau này." },
  },
  {
    id: "notes",
    header: { en: "Notes", vi: "Ghi chú" },
    required: false,
    aliases: ["ghi chu", "ghichu", "note", "notes", "comment", "remark"],
    hint: { en: "Free text.", vi: "Nội dung tự do." },
  },
];

export const ROSTER_FIELD_IDS: readonly RosterFieldId[] = ROSTER_FIELDS.map((f) => f.id);

export const REQUIRED_ROSTER_FIELD_IDS: readonly RosterFieldId[] = ROSTER_FIELDS.filter(
  (f) => f.required,
).map((f) => f.id);

export function rosterField(id: RosterFieldId): RosterField {
  const field = ROSTER_FIELDS.find((candidate) => candidate.id === id);
  if (!field) throw new Error(`Unknown roster field: ${id}`);
  return field;
}

/** The template's sheet name, matched case-insensitively on the way back in. */
export const ROSTER_TEMPLATE_SHEET = "Roster";
