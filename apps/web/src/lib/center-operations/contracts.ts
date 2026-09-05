import { z } from "zod";

const uuid = z.string().uuid();
const text = (max = 200) => z.string().trim().min(1).max(max);
const revision = z.number().int().positive();
const datetime = z.string().datetime({ offset: true });
export const centerCommandSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("student.create"),
      name: text(),
      phone: z.string().max(30).optional(),
      email: z.union([z.literal(""), z.string().email()]).optional(),
      code: z.string().max(60).optional(),
      source: text(100).optional(),
      target: z.string().max(200).optional(),
    })
    .strict(),
  z
    .object({
      kind: z.literal("admission.stage"),
      admissionId: uuid,
      stage: z.enum(["lead", "qualified", "lost"]),
      expectedRevision: revision,
    })
    .strict(),
  z
    .object({
      kind: z.literal("trial.book"),
      studentRecordId: uuid,
      classId: uuid,
      startAt: datetime,
      endAt: datetime,
    })
    .strict(),
  z
    .object({
      kind: z.literal("trial.rebook"),
      priorTrialId: uuid,
      startAt: datetime,
      endAt: datetime,
      expectedRevision: revision,
    })
    .strict(),
  z
    .object({
      kind: z.literal("trial.status"),
      trialId: uuid,
      status: z.enum(["attended", "no_show", "cancelled"]),
      expectedRevision: revision,
    })
    .strict(),
  z
    .object({
      kind: z.literal("trial.evaluate"),
      trialId: uuid,
      assessment: z
        .object({
          level: text(1000),
          strengths: text(3000),
          weaknesses: text(3000),
          recommendation: text(3000),
        })
        .strict(),
      expectedRevision: revision,
    })
    .strict(),
  z
    .object({
      kind: z.literal("note.create"),
      studentRecordId: uuid,
      body: text(10000),
    })
    .strict(),
  z
    .object({
      kind: z.literal("note.remove"),
      noteId: uuid,
      expectedRevision: revision,
    })
    .strict(),
  z
    .object({
      kind: z.literal("draft.create"),
      classId: uuid,
      title: text(),
      body: text(50000),
      draftType: z.enum(["homework", "lesson", "report", "announcement"]),
    })
    .strict(),
  z
    .object({
      kind: z.literal("offer.create"),
      studentRecordId: uuid,
      classId: uuid,
      amount: z.number().int().min(1).max(1000000000),
      startDate: z.string().date(),
      endDate: z.string().date(),
    })
    .strict(),
  z
    .object({
      kind: z.literal("offer.cancel"),
      offerId: uuid,
      expectedRevision: revision,
    })
    .strict(),
  z.object({ kind: z.literal("invoice.checkout"), invoiceId: uuid }).strict(),
  z
    .object({
      kind: z.literal("connection.prepare"),
      provider: z.enum(["google", "zbs", "zalopay"]),
    })
    .strict(),
  z
    .object({ kind: z.literal("connection.disconnect"), connectionId: uuid })
    .strict(),
  z
    .object({
      kind: z.literal("schedule.reschedule"),
      scheduleId: uuid,
      startAt: datetime,
      endAt: datetime,
      expectedUpdatedAt: datetime,
    })
    .strict(),
  z
    .object({
      kind: z.literal("message.send"),
      studentRecordId: uuid,
      templateKey: z.enum([
        "trial_confirmation",
        "trial_reminder",
        "class_rescheduled",
        "progress_summary",
        "renewal_reminder",
      ]),
    })
    .strict(),
]);
export type CenterCommand = z.infer<typeof centerCommandSchema>;
export type CommandReceipt = {
  commandId: string;
  kind: string;
  targetId: string;
  revision: number | null;
  status: "pending" | "completed";
};
export type CenterStudent = {
  id: string;
  name: string;
  code: string | null;
  linked: boolean;
  status: string;
  classIds: string[];
};
export type CenterTrial = {
  id: string;
  student_record_id: string;
  class_id: string;
  starts_at: string;
  ends_at: string;
  timezone: string;
  status: "booked" | "attended" | "no_show" | "cancelled";
  assessment: {
    level: string;
    strengths: string;
    weaknesses: string;
    recommendation: string;
  } | null;
  rebook_of: string | null;
  revision: number;
};
export type CenterSnapshot = {
  organizationId: string;
  actorId: string;
  canManage: boolean;
  canManageFinance: boolean;
  classes: { id: string; name: string }[];
  students: CenterStudent[];
  admissions: {
    id: string;
    student_record_id: string;
    stage: string;
    source: string;
    target: string | null;
    revision: number;
    created_at: string;
  }[];
  trials: CenterTrial[];
  notes: {
    id: string;
    student_record_id: string;
    body: string;
    created_by: string;
    created_at: string;
    revision: number;
  }[];
  drafts: {
    id: string;
    class_id: string;
    kind: string;
    title: string;
    body: string;
    status: string;
    revision: number;
  }[];
  offers: {
    id: string;
    student_record_id: string;
    class_id: string;
    amount: number;
    starts_on: string;
    ends_on: string;
    status: string;
    revision: number;
  }[];
  invoices: {
    id: string;
    offer_id: string;
    amount: number;
    status: string;
    revision: number;
    checkout_url: string | null;
    payment_status: string | null;
  }[];
  schedules: {
    id: string;
    class_id: string;
    title: string;
    starts_at: string;
    ends_at: string;
    updated_at: string;
    connected: boolean;
  }[];
  connections: {
    id: string;
    provider: "google" | "zbs" | "zalopay";
    status: string;
    account_label: string | null;
    last_sync_at: string | null;
    last_error: string | null;
    scopes: string[];
  }[];
  bindings: {
    id: string;
    kind: string;
    label: string;
    state: string;
    external_id: string;
    class_id: string | null;
    last_sync_at: string | null;
  }[];
  events: {
    id: string;
    kind: string;
    status: string;
    last_error: string | null;
    created_at: string;
  }[];
};
export type CenterResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };
export type TeacherProposal = {
  id: string;
  kind: string;
  input: Record<string, unknown>;
  requires_confirmation: boolean;
  status: string;
  receipt: CommandReceipt | null;
  expires_at: string;
};
export type TeacherTurn = {
  conversationId: string;
  answer: string;
  sources: { id: string; label: string; text?: string }[];
  proposals: TeacherProposal[];
};
export type TeacherHistory = {
  conversationId: string;
  messages: {
    id: string;
    role: "user" | "assistant";
    body: string;
    metadata: Record<string, unknown>;
  }[];
  proposals: TeacherProposal[];
};

export type CenterGuardianProgress = {
  guardianId: string;
  studentRecordId: string;
  preferences?: {
    class_changes?: boolean;
    progress_summary?: boolean;
    renewal?: boolean;
  };
  student?: { name?: string; code?: string };
  classes?: Array<{ id: string; name: string }>;
  trials?: Array<{ classId: string; startsAt: string; status: string }>;
  attendance?: { present: number; late: number; absent: number };
};
