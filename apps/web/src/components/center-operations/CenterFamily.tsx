"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { setCenterGuardianPreferences } from "@/app/actions/admin-clubs";
import { Switch } from "@/components/ui/switch";

import type { CenterGuardianProgress } from "@/lib/center-operations/contracts";

type Props = {
  progress: CenterGuardianProgress;
  locale: "en" | "vi";
};
const copy = {
  en: {
    title: "Family overview",
    classes: "Classes",
    trials: "Trial sessions",
    attendance: "Attendance",
    present: "Present",
    late: "Late",
    absent: "Absent",
    preferences: "Updates",
    classChanges: "Class changes",
    progressSummary: "Progress summaries",
    renewal: "Renewal reminders",
    save: "Save preferences",
  },
  vi: {
    title: "Tổng quan gia đình",
    classes: "Lớp học",
    trials: "Buổi học thử",
    attendance: "Chuyên cần",
    present: "Có mặt",
    late: "Đi muộn",
    absent: "Vắng",
    preferences: "Cập nhật",
    classChanges: "Thay đổi lớp",
    progressSummary: "Tóm tắt tiến bộ",
    renewal: "Nhắc gia hạn",
    save: "Lưu tùy chọn",
  },
} as const;

export function CenterFamily({ progress, locale }: Props) {
  const t = copy[locale];
  const [prefs, setPrefs] = useState({
    classChanges: progress.preferences?.class_changes ?? false,
    progressSummary: progress.preferences?.progress_summary ?? false,
    renewal: progress.preferences?.renewal ?? false,
  });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const toggle = (key: keyof typeof prefs) =>
    setPrefs((value) => ({ ...value, [key]: !value[key] }));
  return (
    <main className="min-w-0 space-y-4 p-4 lg:p-6">
      <div>
        <p className="type-eyebrow text-primary">{t.title}</p>
        <h1 className="type-heading-xl text-on-surface">
          {progress.student?.name ?? t.title}
        </h1>
        {progress.student?.code && (
          <p className="type-body text-on-surface-variant">
            {progress.student.code}
          </p>
        )}
      </div>
      <section className="grid min-w-0 gap-4 lg:grid-cols-2">
        <div className="min-w-0 rounded-2xl border border-border bg-surface p-4">
          <h2 className="type-heading-md text-on-surface">{t.classes}</h2>
          <div className="mt-3 divide-y divide-border">
            {(progress.classes ?? []).map((item) => (
              <p key={item.id} className="py-2 type-body text-on-surface">
                {item.name}
              </p>
            ))}
            {!progress.classes?.length && (
              <p className="py-3 type-body text-on-surface-variant">—</p>
            )}
          </div>
        </div>
        <div className="min-w-0 rounded-2xl border border-border bg-surface p-4">
          <h2 className="type-heading-md text-on-surface">{t.attendance}</h2>
          <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div>
              <dt className="type-caption text-on-surface-variant">
                {t.present}
              </dt>
              <dd className="type-heading-md text-on-surface">
                {progress.attendance?.present ?? 0}
              </dd>
            </div>
            <div>
              <dt className="type-caption text-on-surface-variant">{t.late}</dt>
              <dd className="type-heading-md text-on-surface">
                {progress.attendance?.late ?? 0}
              </dd>
            </div>
            <div>
              <dt className="type-caption text-on-surface-variant">
                {t.absent}
              </dt>
              <dd className="type-heading-md text-on-surface">
                {progress.attendance?.absent ?? 0}
              </dd>
            </div>
          </dl>
        </div>
      </section>
      {!!progress.trials?.length && (
        <section className="min-w-0 rounded-2xl border border-border bg-surface p-4">
          <h2 className="type-heading-md text-on-surface">{t.trials}</h2>
          <ul className="mt-3 divide-y divide-border">
            {progress.trials.map((trial, index) => (
              <li
                key={`${trial.classId}:${trial.startsAt}:${index}`}
                className="flex flex-wrap justify-between gap-2 py-2 type-body text-on-surface"
              >
                <span>
                  {new Intl.DateTimeFormat(
                    locale === "vi" ? "vi-VN" : "en-GB",
                    {
                      dateStyle: "medium",
                      timeStyle: "short",
                      timeZone: "Asia/Ho_Chi_Minh",
                    },
                  ).format(new Date(trial.startsAt))}
                </span>
                <span className="text-on-surface-variant">
                  {(
                    {
                      booked: locale === "vi" ? "Đã đặt" : "Booked",
                      attended: locale === "vi" ? "Đã học" : "Attended",
                      no_show: locale === "vi" ? "Vắng" : "Absent",
                      cancelled: locale === "vi" ? "Đã hủy" : "Cancelled",
                    } as Record<string, string>
                  )[trial.status] ?? "—"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <section className="min-w-0 rounded-2xl border border-border bg-surface p-4">
        <h2 className="type-heading-md text-on-surface">{t.preferences}</h2>
        <div className="mt-3 grid gap-3">
          {(
            [
              ["classChanges", t.classChanges],
              ["progressSummary", t.progressSummary],
              ["renewal", t.renewal],
            ] as const
          ).map(([key, label]) => (
            <label
              key={key}
              className="flex items-center justify-between gap-2 type-body text-on-surface"
            >
              <span>{label}</span>
              <Switch
                checked={prefs[key]}
                onCheckedChange={() => toggle(key)}
              />
            </label>
          ))}
          <Button
            className="w-fit"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setMessage("");
              const result = await setCenterGuardianPreferences({
                guardianId: progress.guardianId,
                studentRecordId: progress.studentRecordId,
                preferences: prefs,
              });
              setMessage(
                result.ok
                  ? locale === "vi"
                    ? "Đã lưu"
                    : "Saved"
                  : result.error,
              );
              setBusy(false);
            }}
          >
            {t.save}
          </Button>
          {message && (
            <p role="status" className="type-caption text-on-surface-variant">
              {message}
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
