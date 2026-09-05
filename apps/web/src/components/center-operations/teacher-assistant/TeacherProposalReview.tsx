"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type {
  CenterSnapshot,
  TeacherProposal,
  CommandReceipt,
  CenterResult,
} from "@/lib/center-operations/contracts";
import { decideCenterTeacherProposal } from "@/app/actions/admin-clubs";
import { centerCopy } from "../copy";
import { teacherErrorMessage } from "./client-state";

export function TeacherProposalReview({
  proposal,
  copy,
  snapshot,
  clubId,
  onDone,
  onDecide = decideCenterTeacherProposal,
  running = false,
}: {
  proposal: TeacherProposal;
  copy: typeof centerCopy.en;
  snapshot: CenterSnapshot;
  clubId: string;
  onDone: () => Promise<void>;
  running?: boolean;
  onDecide?: (
    clubId: string,
    proposalId: string,
    decision: "confirm" | "cancel",
  ) => Promise<CenterResult<CommandReceipt | null>>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState(proposal.status);
  const decide = async (decision: "confirm" | "cancel") => {
    setBusy(true);
    setError("");
    try {
      const result = await onDecide(clubId, proposal.id, decision);
      if (!result.ok)
        setError(
          teacherErrorMessage(
            result.error,
            copy === centerCopy.vi ? "vi" : "en",
          ),
        );
      else {
        // A receipt means it already executed, even if cancellation raced completion.
        setStatus(result.data ? "executed" : "cancelled");
        await onDone();
      }
    } catch {
      setError(
        teacherErrorMessage("decision", copy === centerCopy.vi ? "vi" : "en"),
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="min-w-0 rounded-control border border-outline-variant bg-surface-container-low p-3">
      <h3 className="type-title text-on-surface">
        {copy.proposal} · {proposalOperationLabel(proposal.kind, copy)} ·{" "}
        {statusLabel(status, copy)}
      </h3>
      <p className="type-caption text-on-surface-variant">
        {proposalTarget(proposal, snapshot, copy)}
      </p>
      <dl className="mt-2 space-y-1">
        {Object.entries(proposal.input)
          .filter(
            ([key]) =>
              key !== "expectedRevision" && key !== "expectedUpdatedAt",
          )
          .map(([key, value]) => (
            <div
              key={key}
              className="grid grid-cols-[auto_minmax(0,1fr)] gap-2 type-body"
            >
              <dt className="text-on-surface-variant">
                {proposalFieldLabel(key, copy)}
              </dt>
              <dd className="break-words text-on-surface">
                {formatProposalValue(value, key, copy, snapshot)}
              </dd>
            </div>
          ))}
      </dl>
      {error && <p className="mt-2 type-caption text-error">{error}</p>}
      {status === "failed" && !proposal.requires_confirmation && (
        <div className="mt-3 space-y-2">
          <p className="type-body text-on-surface-variant">
            {copy === centerCopy.vi
              ? "Thao tác này chưa được lưu. Bạn có thể thử lưu lại."
              : "This action was not saved. You can try saving it again."}
          </p>
          <Button
            variant="outline"
            disabled={busy || running}
            onClick={() => decide("confirm")}
          >
            {copy === centerCopy.vi ? "Thử lưu lại" : "Try saving again"}
          </Button>
        </div>
      )}
      {status === "pending" && (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => decide("confirm")}
            disabled={busy || running}
          >
            {copy.confirm}
          </Button>
          <Button
            variant="outline"
            onClick={() => decide("cancel")}
            disabled={busy || running}
          >
            {copy.cancelProposal}
          </Button>
        </div>
      )}
    </section>
  );
}

const proposalFieldKeys: Record<string, keyof typeof centerCopy.en> = {
  studentRecordId: "name",
  classId: "class",
  trialId: "trial",
  priorTrialId: "trial",
  admissionId: "admission",
  scheduleId: "schedule",
  startAt: "start",
  endAt: "end",
  amount: "amount",
  startDate: "offerStart",
  endDate: "offerEnd",
  title: "proposalTitle",
  body: "body",
  draftType: "draftType",
  templateKey: "templateKey",
  assessment: "assessment",
  expectedRevision: "revision",
  expectedUpdatedAt: "updatedAt",
};

const proposalEnumKeys: Record<string, keyof typeof centerCopy.en> = {
  homework: "draftTypeHomework",
  lesson: "draftTypeLesson",
  report: "draftTypeReport",
  announcement: "draftTypeAnnouncement",
  trial_confirmation: "templateTrialConfirmation",
  trial_reminder: "templateTrialReminder",
  class_rescheduled: "templateClassRescheduled",
  progress_summary: "templateProgressSummary",
  renewal_reminder: "templateRenewalReminder",
};

function proposalOperationLabel(
  kind: string,
  copy: typeof centerCopy.en,
): string {
  const labels: Record<string, keyof typeof centerCopy.en> = {
    "trial.book": "bookTrial",
    "trial.rebook": "rebook",
    "trial.evaluate": "evaluate",
    "admission.stage": "stage",
    "offer.create": "offer",
    "schedule.reschedule": "reschedule",
    "message.send": "send",
    "draft.create": "draft",
    "note.create": "addNote",
  };
  return labels[kind] ? copy[labels[kind]] : copy.proposal;
}

function proposalFieldLabel(key: string, copy: typeof centerCopy.en): string {
  const copyKey = proposalFieldKeys[key];
  return copyKey ? copy[copyKey] : (copy[key] ?? key.replaceAll("_", " "));
}

function formatProposalValue(
  value: unknown,
  key: string,
  copy: typeof centerCopy.en,
  snapshot: CenterSnapshot,
): string {
  const locale = copy === centerCopy.vi ? "vi-VN" : "en-GB";
  if (Array.isArray(value))
    return value
      .map((item) => formatProposalValue(item, key, copy, snapshot))
      .join(", ");
  if (value && typeof value === "object")
    return Object.entries(value)
      .map(
        ([childKey, childValue]) =>
          `${proposalFieldLabel(childKey, copy)}: ${formatProposalValue(childValue, childKey, copy, snapshot)}`,
      )
      .join(", ");
  if (typeof value === "number") return value.toLocaleString(locale);
  if (typeof value !== "string") return String(value);
  const targetName =
    snapshot.students.find((item) => item.id === value)?.name ??
    snapshot.classes.find((item) => item.id === value)?.name;
  if (targetName) return targetName;
  if (key === "trialId") {
    const trial = snapshot.trials.find((item) => item.id === value);
    if (trial)
      return `${snapshot.students.find((item) => item.id === trial.student_record_id)?.name ?? copy.trial} · ${formatProposalValue(trial.starts_at, "startAt", copy, snapshot)}`;
  }
  if (key === "priorTrialId") {
    const trial = snapshot.trials.find((item) => item.id === value);
    if (trial)
      return `${copy.trial} · ${snapshot.students.find((item) => item.id === trial.student_record_id)?.name ?? "—"} · ${classNameForProposal(trial.class_id, snapshot)} · ${formatProposalValue(trial.starts_at, "startAt", copy, snapshot)}`;
  }
  if (key === "admissionId") {
    const admission = snapshot.admissions.find((item) => item.id === value);
    if (admission)
      return (
        snapshot.students.find(
          (item) => item.id === admission.student_record_id,
        )?.name ?? copy.admission
      );
  }
  if (key === "scheduleId") {
    const schedule = snapshot.schedules.find((item) => item.id === value);
    if (schedule)
      return `${schedule.title} · ${formatProposalValue(schedule.starts_at, "startAt", copy, snapshot)}`;
  }
  if (key === "stage") return copy[value] ?? value;
  const enumKey =
    key === "draftType" || key === "templateKey"
      ? proposalEnumKeys[value]
      : undefined;
  if (enumKey) return copy[enumKey];
  if (key === "startAt" || key === "endAt" || key === "expectedUpdatedAt") {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime()))
      return new Intl.DateTimeFormat(locale, {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Ho_Chi_Minh",
      }).format(date);
  }
  if (/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(value))
    return copy === centerCopy.vi
      ? "Bản ghi không còn khả dụng"
      : "Record no longer available";
  return value;
}

export function sourceText(id: string, snapshot: CenterSnapshot): string {
  const [kind, value] = id.split(":");
  if (kind === "note")
    return snapshot.notes.find((item) => item.id === value)?.body ?? "—";
  if (kind === "draft") {
    const item = snapshot.drafts.find((draft) => draft.id === value);
    return item ? `${item.title}: ${item.body}` : "—";
  }
  if (kind === "trial") {
    const item = snapshot.trials.find((trial) => trial.id === value);
    return item?.assessment ? JSON.stringify(item.assessment) : "—";
  }
  return "—";
}
function proposalTarget(
  proposal: TeacherProposal,
  snapshot: CenterSnapshot,
  copy: typeof centerCopy.en,
): string {
  const input = proposal.input;
  const student =
    typeof input.studentRecordId === "string"
      ? snapshot.students.find((item) => item.id === input.studentRecordId)
          ?.name
      : undefined;
  const priorTrial =
    typeof input.priorTrialId === "string"
      ? snapshot.trials.find((item) => item.id === input.priorTrialId)
      : undefined;
  const cls =
    typeof input.classId === "string"
      ? snapshot.classes.find((item) => item.id === input.classId)?.name
      : undefined;
  return (
    [
      student ??
        (priorTrial
          ? snapshot.students.find(
              (item) => item.id === priorTrial.student_record_id,
            )?.name
          : undefined),
      cls ??
        (priorTrial
          ? classNameForProposal(priorTrial.class_id, snapshot)
          : undefined),
    ]
      .filter(Boolean)
      .join(" · ") || (priorTrial ? copy.trial : "")
  );
}
function classNameForProposal(id: string, snapshot: CenterSnapshot) {
  return snapshot.classes.find((item) => item.id === id)?.name ?? "—";
}
function statusLabel(value: string, copy: typeof centerCopy.en): string {
  const vi = copy === centerCopy.vi;
  const labels: Record<string, string> = {
    pending: copy.pendingStatus,
    executed: copy.executed,
    cancelled: copy.cancelledStatus,
    failed: vi ? "Chưa lưu được" : "Could not save",
    confirmed: vi ? "Đã xác nhận" : "Confirmed",
  };
  return labels[value] ?? (vi ? "Cần kiểm tra" : "Needs review");
}
