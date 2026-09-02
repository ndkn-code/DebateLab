"use client";

import { useMemo, useState } from "react";
import {
  BarChart3,
  BookOpen,
  Building2,
  CalendarDays,
  Search,
  UsersRound,
} from "@/components/ui/icons";
import type {
  HeadTeacherWorkspaceSurface,
  TeacherWorkspacePresentation,
} from "@/lib/teacher-workspace/presentation";
import { buildHeadTeacherSurfaceModel } from "@/lib/teacher-workspace/head-teacher-surface-model";

const COPY = {
  en: {
    eyebrow: "HEAD TEACHER",
    organization: [
      "Organization",
      "Academic operations across active classes.",
    ],
    people: ["People", "Learner progress and attendance exceptions."],
    curriculum: [
      "Curriculum",
      "Class coverage, assignments, and teaching materials.",
    ],
    reports: [
      "Reports",
      "Comparable class health without losing the underlying rows.",
    ],
    classes: "Classes",
    learners: "Learners",
    pending: "Needs review",
    attendance: "Avg. attendance",
    completion: "Avg. completion",
    assignments: "Assignments",
    materials: "Materials",
    announcements: "Announcements",
    class: "Class",
    subject: "Subject",
    nextLesson: "Next lesson",
    person: "Person",
    role: "Role",
    assessed: "Assessed",
    gradePending: "Grade pending",
    learner: "Learner",
    coverage: "Coverage",
    attention: "Attention",
    onTrack: "On track",
    followUp: "Follow up",
    search: "Search people",
    empty: "No organization data is available for this view yet.",
    unrecorded: "Not recorded",
    ielts: "IELTS",
    debate: "Debate",
    public_speaking: "Public speaking",
  },
  vi: {
    eyebrow: "TRƯỞNG BỘ MÔN",
    organization: ["Tổ chức", "Vận hành học thuật của các lớp đang hoạt động."],
    people: ["Nhân sự", "Tiến độ học viên và các ngoại lệ điểm danh."],
    curriculum: [
      "Chương trình học",
      "Mức độ bao phủ lớp, bài tập và tài liệu giảng dạy.",
    ],
    reports: ["Báo cáo", "So sánh sức khỏe lớp học từ dữ liệu gốc."],
    classes: "Lớp",
    learners: "Học viên",
    pending: "Cần chấm",
    attendance: "Điểm danh TB",
    completion: "Hoàn thành TB",
    assignments: "Bài tập",
    materials: "Tài liệu",
    announcements: "Thông báo",
    class: "Lớp học",
    subject: "Môn học",
    nextLesson: "Buổi tiếp theo",
    person: "Thành viên",
    role: "Vai trò",
    assessed: "Đã chấm",
    gradePending: "Chờ chấm",
    learner: "Học viên",
    coverage: "Tiến độ",
    attention: "Theo dõi",
    onTrack: "Đúng tiến độ",
    followUp: "Cần theo dõi",
    search: "Tìm thành viên",
    empty: "Chưa có dữ liệu tổ chức cho chế độ xem này.",
    unrecorded: "Chưa ghi nhận",
    ielts: "IELTS",
    debate: "Tranh biện",
    public_speaking: "Thuyết trình",
  },
} as const;

function formatDateTime(value: string | null, locale: string) {
  if (!value) return "—";
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="min-w-0 border-b border-outline-variant px-4 py-3 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0">
      <p className="type-caption text-on-surface-variant">{label}</p>
      <p className="mt-1 type-title tabular-nums text-on-surface">{value}</p>
    </div>
  );
}

function EmptyRows({ message }: { message: string }) {
  return (
    <div className="border border-outline-variant bg-surface px-4 py-10 text-center type-body-sm text-on-surface-variant">
      {message}
    </div>
  );
}

function ProgressValue({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex min-w-32 items-center gap-2">
      <div
        className="h-1.5 min-w-20 flex-1 overflow-hidden rounded-full bg-surface-container-high"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
      >
        <div className="h-full bg-primary" style={{ width: `${value}%` }} />
      </div>
      <span className="type-caption tabular-nums text-on-surface">
        {value}%
      </span>
    </div>
  );
}

function TableFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-control border border-outline-variant bg-surface">
      {children}
    </div>
  );
}

export function HeadTeacherOperations({
  data,
  surface,
}: {
  data: TeacherWorkspacePresentation;
  surface: HeadTeacherWorkspaceSurface;
}) {
  const vi = data.locale === "vi";
  const t = COPY[vi ? "vi" : "en"];
  const model = useMemo(
    () => buildHeadTeacherSurfaceModel(data, surface),
    [data, surface],
  );
  const [query, setQuery] = useState("");
  const visiblePeople = model.people.filter((person) =>
    person.name
      .toLocaleLowerCase(data.locale)
      .includes(query.trim().toLocaleLowerCase(data.locale)),
  );
  const [title, description] = t[surface];
  const Icon =
    surface === "organization"
      ? Building2
      : surface === "people"
        ? UsersRound
        : surface === "curriculum"
          ? BookOpen
          : BarChart3;

  return (
    <section aria-labelledby={`head-teacher-${surface}-heading`}>
      <header className="flex flex-col gap-3 border-b border-outline-variant pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="flex items-center gap-2 type-label font-semibold text-primary">
            <Icon className="size-4" aria-hidden="true" />
            {t.eyebrow}
          </p>
          <h1
            id={`head-teacher-${surface}-heading`}
            className="mt-1 type-heading-md text-on-surface"
          >
            {title}
          </h1>
          <p className="mt-0.5 type-body-sm text-on-surface-variant">
            {description}
          </p>
        </div>
        {surface === "people" ? (
          <label className="relative block w-full sm:w-72">
            <Search
              className="pointer-events-none absolute left-3 top-2 size-4 text-on-surface-variant"
              aria-hidden="true"
            />
            <span className="sr-only">{t.search}</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t.search}
              className="h-8 w-full rounded-control border border-outline-variant bg-surface pl-9 pr-3 type-body text-on-surface placeholder:text-placeholder focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
        ) : null}
      </header>

      <div className="mt-4 grid overflow-hidden rounded-control border border-outline-variant bg-surface sm:grid-cols-4">
        {surface === "organization" ? (
          <>
            <Stat label={t.classes} value={model.totals.classes} />
            <Stat label={t.learners} value={model.totals.learners} />
            <Stat label={t.pending} value={model.totals.pendingReviews} />
            <Stat
              label={t.attendance}
              value={
                model.totals.averageAttendance == null
                  ? "—"
                  : `${model.totals.averageAttendance}%`
              }
            />
          </>
        ) : surface === "people" ? (
          <>
            <Stat label={t.learners} value={model.totals.learners} />
            <Stat label={t.classes} value={model.totals.classes} />
            <Stat label={t.pending} value={model.totals.pendingReviews} />
            <Stat label={t.announcements} value={model.totals.announcements} />
          </>
        ) : surface === "curriculum" ? (
          <>
            <Stat label={t.classes} value={model.totals.classes} />
            <Stat label={t.assignments} value={model.totals.assignments} />
            <Stat label={t.materials} value={model.totals.materials} />
            <Stat
              label={t.completion}
              value={
                model.totals.averageCompletion == null
                  ? "—"
                  : `${model.totals.averageCompletion}%`
              }
            />
          </>
        ) : (
          <>
            <Stat
              label={t.attendance}
              value={
                model.totals.averageAttendance == null
                  ? "—"
                  : `${model.totals.averageAttendance}%`
              }
            />
            <Stat
              label={t.completion}
              value={
                model.totals.averageCompletion == null
                  ? "—"
                  : `${model.totals.averageCompletion}%`
              }
            />
            <Stat label={t.pending} value={model.totals.pendingReviews} />
            <Stat label={t.assignments} value={model.totals.assignments} />
          </>
        )}
      </div>

      <div className="mt-4">
        {surface === "people" ? (
          visiblePeople.length ? (
            <TableFrame>
              <table className="min-w-[680px] w-full border-collapse text-left">
                <caption className="sr-only">{title}</caption>
                <thead className="bg-surface-container-low type-caption text-on-surface-variant">
                  <tr>
                    <th className="px-3 py-2 font-semibold">{t.person}</th>
                    <th className="px-3 py-2 font-semibold">{t.role}</th>
                    <th className="px-3 py-2 font-semibold">{t.attendance}</th>
                    <th className="px-3 py-2 font-semibold">{t.assessed}</th>
                    <th className="px-3 py-2 font-semibold">
                      {t.gradePending}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant type-body text-on-surface">
                  {visiblePeople.map((person) => (
                    <tr key={person.id} className="h-11">
                      <th className="px-3 py-2 font-semibold">{person.name}</th>
                      <td className="px-3 py-2 text-on-surface-variant">
                        {t.learner}
                      </td>
                      <td className="px-3 py-2 capitalize">
                        {person.attendance === "unrecorded"
                          ? t.unrecorded
                          : person.attendance.replaceAll("_", " ")}
                      </td>
                      <td className="px-3 py-2 tabular-nums">
                        {person.scoredAssessments}
                      </td>
                      <td className="px-3 py-2 tabular-nums">
                        {person.pendingAssessments}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableFrame>
          ) : (
            <EmptyRows message={t.empty} />
          )
        ) : model.classes.length ? (
          <TableFrame>
            <table className="min-w-[760px] w-full border-collapse text-left">
              <caption className="sr-only">{title}</caption>
              <thead className="bg-surface-container-low type-caption text-on-surface-variant">
                <tr>
                  <th className="px-3 py-2 font-semibold">{t.class}</th>
                  <th className="px-3 py-2 font-semibold">{t.subject}</th>
                  {surface === "organization" ? (
                    <>
                      <th className="px-3 py-2 font-semibold">{t.learners}</th>
                      <th className="px-3 py-2 font-semibold">
                        {t.nextLesson}
                      </th>
                      <th className="px-3 py-2 font-semibold">{t.pending}</th>
                    </>
                  ) : surface === "curriculum" ? (
                    <>
                      <th className="px-3 py-2 font-semibold">{t.coverage}</th>
                      <th className="px-3 py-2 font-semibold">
                        {t.assignments}
                      </th>
                      <th className="px-3 py-2 font-semibold">{t.materials}</th>
                    </>
                  ) : (
                    <>
                      <th className="px-3 py-2 font-semibold">
                        {t.attendance}
                      </th>
                      <th className="px-3 py-2 font-semibold">
                        {t.completion}
                      </th>
                      <th className="px-3 py-2 font-semibold">{t.attention}</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant type-body text-on-surface">
                {model.classes.map((item) => (
                  <tr key={item.id} className="h-11">
                    <th className="px-3 py-2 font-semibold">{item.title}</th>
                    <td className="px-3 py-2 text-on-surface-variant">
                      {t[item.programType]}
                    </td>
                    {surface === "organization" ? (
                      <>
                        <td className="px-3 py-2 tabular-nums">
                          {item.studentCount}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-on-surface-variant">
                          <span className="inline-flex items-center gap-1.5">
                            <CalendarDays
                              className="size-3.5"
                              aria-hidden="true"
                            />
                            {formatDateTime(item.nextLessonAt, data.locale)}
                          </span>
                        </td>
                        <td className="px-3 py-2 tabular-nums">
                          {item.pendingReviews}
                        </td>
                      </>
                    ) : surface === "curriculum" ? (
                      <>
                        <td className="px-3 py-2">
                          <ProgressValue
                            value={item.completion}
                            label={`${item.title}: ${item.completion}%`}
                          />
                        </td>
                        <td className="px-3 py-2 tabular-nums">
                          {item.assignmentCount}
                        </td>
                        <td className="px-3 py-2 tabular-nums">
                          {item.materialCount}
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-3 py-2 tabular-nums">
                          {item.attendanceRate}%
                        </td>
                        <td className="px-3 py-2">
                          <ProgressValue
                            value={item.completion}
                            label={`${item.title}: ${item.completion}%`}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className={
                              item.pendingReviews > 0
                                ? "font-semibold text-error"
                                : "text-success"
                            }
                          >
                            {item.pendingReviews > 0
                              ? `${t.followUp} · ${item.pendingReviews}`
                              : t.onTrack}
                          </span>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </TableFrame>
        ) : (
          <EmptyRows message={t.empty} />
        )}
      </div>
    </section>
  );
}
