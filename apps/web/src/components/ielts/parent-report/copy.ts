import type {
  ReportLocale,
  ReportSkill,
  ReportSource,
} from "@/lib/ielts/parent-report/contract";

export const PARENT_REPORT_COPY: Record<
  ReportLocale,
  {
    title: string;
    period: string;
    generated: string;
    updated: string;
    scoreBasis: string;
    overall: string;
    skills: string;
    trajectory: string;
    criteria: string;
    attendance: string;
    nextFocus: string;
    noScore: string;
    noData: string;
    coverage: string;
    present: string;
    late: string;
    absent: string;
    unmarked: string;
    recorded: string;
    assessed: string;
    pending: string;
    missing: string;
    source: Record<ReportSource, string>;
    print: string;
    xlsx: string;
    student: string;
    month: string;
    chooseSkill: string;
    allSkills: string;
    latest: string;
    criterion: string;
    band: string;
    date: string;
    sessionOnly: string;
    saveHint: string;
    noNextFocus: string;
    skill: Record<ReportSkill, string>;
    sourceFor: string;
  }
> = {
  vi: {
    title: "Báo cáo tiến bộ IELTS",
    period: "Tháng",
    generated: "Tạo lúc",
    updated: "Cập nhật điểm đến",
    scoreBasis:
      "Điểm luyện tập, không phải chứng chỉ IELTS. Bao gồm các cập nhật điểm mới nhất khi tạo báo cáo.",
    overall: "Band tổng",
    skills: "Kỹ năng",
    trajectory: "Diễn tiến band",
    criteria: "Chi tiết theo phần",
    attendance: "Chuyên cần",
    nextFocus: "Gợi ý luyện tập tiếp theo",
    noScore: "Chưa có điểm",
    noData: "Chưa có dữ liệu cho thời gian này.",
    coverage: "Tính trên các buổi đã ghi nhận",
    present: "Có mặt",
    late: "Đi muộn",
    absent: "Vắng",
    unmarked: "Chưa đánh dấu",
    recorded: "buổi đã ghi nhận",
    assessed: "đã có điểm",
    pending: "bài chưa có band tổng đầy đủ",
    missing: "chưa có",
    print: "In / Lưu PDF",
    xlsx: "Tải bảng tính",
    student: "Học viên",
    month: "Tháng báo cáo",
    chooseSkill: "Chọn kỹ năng",
    allSkills: "Band tổng",
    latest: "Mới nhất",
    criterion: "Phần",
    band: "Band",
    date: "Ngày",
    sessionOnly: "Chỉ lưu trong phiên này.",
    saveHint: "Gợi ý này không thay đổi dữ liệu học tập.",
    noNextFocus: "Chưa có gợi ý cho tháng này.",
    sourceFor: "Nguồn điểm",
    skill: {
      listening: "Nghe",
      reading: "Đọc",
      writing: "Viết",
      speaking: "Nói",
    },
    source: {
      objective: "Chấm theo đáp án",
      ai: "Ước tính từ AI",
      teacher: "Giáo viên đã chấm",
      mixed: "Giáo viên và AI",
      none: "Chưa có",
    },
  },
  en: {
    title: "IELTS progress report",
    period: "Month",
    generated: "Created",
    updated: "Scores updated through",
    scoreBasis:
      "Practice results, not an IELTS certificate. Includes the latest score corrections when this report was created.",
    overall: "Overall band",
    skills: "Skills",
    trajectory: "Band progress",
    criteria: "Part details",
    attendance: "Attendance",
    nextFocus: "Suggested next steps",
    noScore: "No score yet",
    noData: "No data recorded for this period.",
    coverage: "Based on recorded sessions",
    present: "Present",
    late: "Late",
    absent: "Absent",
    unmarked: "Unmarked",
    recorded: "recorded sessions",
    assessed: "scored",
    pending: "assessments without a complete overall band",
    missing: "not available",
    print: "Print / Save PDF",
    xlsx: "Download spreadsheet",
    student: "Student",
    month: "Report month",
    chooseSkill: "Choose a skill",
    allSkills: "Overall band",
    latest: "Latest",
    criterion: "Part",
    band: "Band",
    date: "Date",
    sessionOnly: "Saved for this session only.",
    saveHint: "This suggestion does not change learning records.",
    noNextFocus: "No focus areas were added for this month.",
    sourceFor: "Score source",
    skill: {
      listening: "Listening",
      reading: "Reading",
      writing: "Writing",
      speaking: "Speaking",
    },
    source: {
      objective: "Answer-key result",
      ai: "AI estimate",
      teacher: "Teacher reviewed",
      mixed: "Teacher and AI combined",
      none: "Not available",
    },
  },
};

export function formatMonth(month: string, locale: ReportLocale) {
  const [year, value] = month.split("-").map(Number);
  return new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, value - 1, 1)));
}

export function formatDate(
  value: string | null,
  locale: ReportLocale,
  timeZone = "Asia/Ho_Chi_Minh",
) {
  if (!value) return "—";
  return new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone,
  }).format(new Date(value));
}
