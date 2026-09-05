"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getLearnerFollowupAction } from "@/app/actions/admin-classes";
import type { LearnerFollowup } from "@/lib/analytics/learner-followup";
import {
  attentionReturnHref,
  type FollowupContext,
} from "@/lib/analytics/learner-followup-navigation";
import { learnerWorkStatus } from "@/lib/analytics/learner-work-status";
import { followupCopy } from "./learner-followup-copy";
import { AnalyticsSection, PeriodLabel } from "./shared";

export function LearnerFollowupPanel({
  classId,
  studentId,
  locale,
  context,
}: {
  classId: string;
  studentId: string;
  locale: "en" | "vi";
  context: FollowupContext;
}) {
  const [version, setVersion] = useState(0);
  const key = `${classId}:${studentId}:${context.days}:${version}`;
  const [state, setState] = useState<{
    key: string;
    data?: LearnerFollowup;
    error?: "unavailable" | "forbidden";
  }>({ key: "" });
  useEffect(() => {
    let current = true;
    getLearnerFollowupAction({ classId, studentId, days: context.days })
      .then((result) => {
        if (current)
          setState(
            result.ok
              ? { key, data: result.data }
              : { key, error: result.error },
          );
      })
      .catch(() => {
        if (current) setState({ key, error: "unavailable" });
      });
    return () => {
      current = false;
    };
  }, [classId, studentId, context.days, key]);
  const c = followupCopy[locale];
  return (
    <section className="min-w-0 space-y-4" aria-label={c.title}>
      <Button
        nativeButton={false}
        variant="outline"
        className="h-auto min-h-8 whitespace-normal text-left"
        render={
          <Link
            href={`/${locale}${attentionReturnHref(classId, studentId, context.days)}`}
          />
        }
      >
        {c.back}
      </Button>
      {state.key !== key ? (
        <p role="status" className="type-body text-on-surface-variant">
          {c.loading}
        </p>
      ) : state.data ? (
        <LearnerFollowupView
          data={state.data}
          locale={locale}
          context={context}
        />
      ) : (
        <div role="alert" className="space-y-3">
          <p className="type-body text-on-surface-variant">
            {state.error === "forbidden" ? c.forbidden : c.unavailable}
          </p>
          {state.error !== "forbidden" && (
            <Button
              variant="outline"
              onClick={() => setVersion((value) => value + 1)}
            >
              {c.retry}
            </Button>
          )}
        </div>
      )}
    </section>
  );
}

export function LearnerFollowupView({
  data,
  locale,
  context,
}: {
  data: LearnerFollowup;
  locale: "en" | "vi";
  context: FollowupContext;
}) {
  const c = followupCopy[locale];
  const date = (value: string | null) =>
    value
      ? new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-US", {
          dateStyle: "medium",
          timeZone: data.period.timezone,
        }).format(new Date(value))
      : c.noDate;
  const related = new Set(
    data.reasons.flatMap((reason) => reason.assignmentIds),
  );
  const assignments = [...data.assignments].sort(
    (a, b) =>
      Number(related.has(b.assignmentId)) -
        Number(related.has(a.assignmentId)) ||
      (b.dueAt ?? "").localeCompare(a.dueAt ?? ""),
  );
  const firstReview = assignments.flatMap(
    (assignment) => assignment.reviewTargets,
  )[0]?.responseId;
  return (
    <div className="min-w-0 break-words" data-testid="learner-followup">
      <h1 className="type-heading-md text-on-surface">
        {data.displayName} · {c.title}
      </h1>
      <p className="mt-1 type-body text-on-surface-variant">
        {data.classTitle}
      </p>
      <p className="mt-2 type-caption text-on-surface-variant">
        <PeriodLabel period={data.period} locale={locale} />
      </p>
      <AnalyticsSection title={c.current}>
        {data.reasons.length ? (
          <ul className="space-y-2 type-body text-on-surface">
            {data.reasons.map((reason) => (
              <li key={reason.code}>
                {c.reasons[reason.code]}: {reason.count}
                {reason.details?.length
                  ? ` · ${reason.details.map((item) => item[locale]).join(", ")}`
                  : ""}
              </li>
            ))}
          </ul>
        ) : (
          <p className="type-body text-on-surface-variant">
            {data.sources.subskills === "unavailable"
              ? c.weakUnavailable
              : c.resolved}
          </p>
        )}
        {context.reasons.some(
          (code) =>
            !(
              code === "critical_weakness" &&
              data.sources.subskills === "unavailable"
            ) && !data.reasons.some((reason) => reason.code === code),
        ) && (
          <p className="mt-2 type-body text-on-surface-variant">{c.changed}</p>
        )}
      </AnalyticsSection>
      <AnalyticsSection title={c.work}>
        {assignments.length ? (
          <ul className="divide-y divide-outline-variant">
            {assignments.map((work) => {
              const status = learnerWorkStatus(work, data.period.end);
              const submittedAt = work.homework.submittedAt ?? work.submittedAt;
              return (
                <li
                  key={work.assignmentId}
                  className="flex flex-wrap items-start justify-between gap-3 py-4"
                >
                  <div className="min-w-0 flex-1 basis-64 space-y-2">
                    <h3 className="type-title text-on-surface">{work.title}</h3>
                    {related.has(work.assignmentId) && (
                      <p className="type-caption text-on-surface-variant">
                        {c.related}
                      </p>
                    )}
                    <p
                      className={`type-label ${status === "overdue" ? "text-warning" : "text-on-surface"}`}
                    >
                      {c.statuses[status]}
                    </p>
                    <p className="type-body text-on-surface-variant">
                      {c.due}: {work.dueAt ? date(work.dueAt) : c.noDue}
                      <br />
                      {c.submitted}: {date(submittedAt)}
                    </p>
                    {submittedAt &&
                      work.dueAt &&
                      Date.parse(submittedAt) > Date.parse(work.dueAt) && (
                        <p className="type-caption text-on-surface-variant">
                          {c.late}
                        </p>
                      )}
                    {work.homework.score !== null &&
                      work.homework.gradeStatus === "graded" && (
                        <p className="type-label text-on-surface">
                          {c.score}: {work.homework.score}
                          {work.homework.scoreMax !== null
                            ? `/${work.homework.scoreMax}`
                            : ""}
                        </p>
                      )}
                    {work.score.overall !== null && (
                      <p className="type-label text-on-surface">
                        {work.score.overallIsProvisional
                          ? c.provisional
                          : c.band}
                        : {work.score.overall}
                      </p>
                    )}
                  </div>
                  <div className="flex min-w-0 flex-wrap gap-2">
                    {work.reviewTargets.map((target) => (
                      <Button
                        nativeButton={false}
                        key={target.responseId}
                        variant={
                          target.responseId === firstReview
                            ? "primary"
                            : "outline"
                        }
                        className="h-auto min-h-8 whitespace-normal text-left"
                        render={
                          <Link
                            href={`/${locale}/dashboard/teacher/classes/${data.classId}?workbenchTab=reviews&responseId=${encodeURIComponent(target.responseId)}`}
                          />
                        }
                      >
                        {c.review} ·{" "}
                        {target.responseKind === "writing"
                          ? locale === "vi"
                            ? "Viết"
                            : "Writing"
                          : locale === "vi"
                            ? "Nói"
                            : "Speaking"}{" "}
                        {target.taskNumber ?? target.partNumber ?? ""}
                      </Button>
                    ))}
                    <Button
                      nativeButton={false}
                      variant="outline"
                      className="h-auto min-h-8 whitespace-normal text-left"
                      render={
                        <Link
                          href={`/${locale}/dashboard/clubs/${data.clubId}/assignments/${work.assignmentId}`}
                        />
                      }
                    >
                      {c.inspect}
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="type-body text-on-surface-variant">{c.empty}</p>
        )}
      </AnalyticsSection>
      <AnalyticsSection title={c.weaknesses}>
        <p className="mb-3 type-body text-on-surface-variant">
          {c.learnerWide}
        </p>
        {data.sources.subskills === "unavailable" ? (
          <p role="status" className="type-body text-on-surface-variant">
            {c.weakUnavailable}
          </p>
        ) : data.weaknesses.length ? (
          <ul className="divide-y divide-outline-variant">
            {data.weaknesses.map((item, index) => (
              <li key={index} className="space-y-1 py-3">
                <p className="type-body text-on-surface">
                  {item.label[locale]}
                </p>
                <p className="type-caption text-on-surface-variant">
                  {item.evidenceCount} {c.evidence} · {c.lastEvidence}:{" "}
                  {date(item.lastEvidenceAt)}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="type-body text-on-surface-variant">{c.noWeakness}</p>
        )}
      </AnalyticsSection>
      <AnalyticsSection title={c.attendance}>
        {data.attendance.length ? (
          <ul className="divide-y divide-outline-variant">
            {data.attendance.map((item, index) => (
              <li
                key={index}
                className="flex flex-wrap justify-between gap-2 py-2 type-body text-on-surface"
              >
                <span>{item.date}</span>
                <span>
                  {c.attendanceStatuses[
                    item.status as keyof typeof c.attendanceStatuses
                  ] ?? c.noDate}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="type-body text-on-surface-variant">{c.noAttendance}</p>
        )}
      </AnalyticsSection>
    </div>
  );
}
