import type { AttentionReasonCode } from "./contracts";

export type FollowupContext = {
  days: 7 | 30 | 90;
  reasons: AttentionReasonCode[];
};
const codes: AttentionReasonCode[] = [
  "overdue_assignment",
  "critical_weakness",
  "repeated_absence",
];
function first(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}
export function attentionDays(raw?: string | string[]): 7 | 30 | 90 {
  const value = first(raw);
  return value === "7" ? 7 : value === "90" ? 90 : 30;
}
export function parseFollowupContext(query: {
  attention?: string | string[];
  days?: string | string[];
  reasons?: string | string[];
}): FollowupContext | undefined {
  if (first(query.attention) !== "1") return undefined;
  return {
    days: attentionDays(query.days),
    reasons: codes.filter((code) =>
      first(query.reasons)?.split(",").includes(code),
    ),
  };
}
export function followupQuery(context: FollowupContext) {
  return new URLSearchParams({
    attention: "1",
    days: String(context.days),
    reasons: context.reasons.join(","),
  }).toString();
}
export function learnerReportHref(
  classId: string,
  studentId: string,
  context: FollowupContext,
) {
  return `/dashboard/teacher/classes/${encodeURIComponent(classId)}/reports/${encodeURIComponent(studentId)}?${followupQuery(context)}`;
}
export function attentionReturnHref(
  classId: string,
  studentId: string,
  days: 7 | 30 | 90,
) {
  return `/dashboard/teacher/classes/${encodeURIComponent(classId)}?classTab=analytics&attentionDays=${days}#learner-attention-${encodeURIComponent(studentId)}`;
}
