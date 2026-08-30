"use client";

import { useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { ArrowRight, Clock, Target } from "@/components/ui/icons";
import { buttonVariants } from "@/components/ui/button";
import { BandGauge, BandMeter } from "@/components/ielts/band-visuals";
import { PageTransition } from "@/components/shared/page-motion";
import {
  PageContainer,
  ProductPageShell,
} from "@/components/shared/product-layout";
import { cn } from "@/lib/utils";
import type { IeltsProfileView } from "./types";
import { ProfileEvidenceLists } from "./ProfileEvidenceLists";
import { StudyConsistencyHeatmap } from "./StudyConsistencyHeatmap";

const COPY = {
  en: {
    eyebrow: "IELTS performance",
    title: "Your profile",
    subtitle: "A focused view of your goal, evidence, and next step.",
    current: "Current estimate",
    target: "Target",
    testDate: "Test date",
    noDate: "Not set",
    academic: "Academic",
    general: "General Training",
    aiProvisional: "AI provisional",
    confidence: "{value}% confidence",
    range: "Likely range {value}",
    diagnosticNeeded: "Complete a diagnostic to establish a reliable estimate.",
    next: "Recommended next",
    minutes: "{value} min",
    start: "Start",
    skills: "Skill breakdown",
    skillCaption:
      "Every band uses the official 0–9 scale. The marker shows your target.",
    listening: "Listening",
    reading: "Reading",
    writing: "Writing",
    speaking: "Speaking",
    evidenceLow: "Limited evidence",
    evidenceMedium: "Growing evidence",
    evidenceHigh: "Stronger evidence",
    asOf: "Updated {date}",
  },
  vi: {
    eyebrow: "Kết quả IELTS",
    title: "Hồ sơ của bạn",
    subtitle: "Tập trung vào mục tiêu, bằng chứng và bước tiếp theo.",
    current: "Ước tính hiện tại",
    target: "Mục tiêu",
    testDate: "Ngày thi",
    noDate: "Chưa đặt",
    academic: "Học thuật",
    general: "Tổng quát",
    aiProvisional: "AI tạm tính",
    confidence: "Độ tin cậy {value}%",
    range: "Khoảng dự kiến {value}",
    diagnosticNeeded: "Hoàn thành bài chẩn đoán để có ước tính đáng tin cậy.",
    next: "Bước tiếp theo",
    minutes: "{value} phút",
    start: "Bắt đầu",
    skills: "Kết quả theo kỹ năng",
    skillCaption:
      "Mọi điểm band dùng thang 0–9 chính thức. Vạch đánh dấu là mục tiêu.",
    listening: "Nghe",
    reading: "Đọc",
    writing: "Viết",
    speaking: "Nói",
    evidenceLow: "Ít bằng chứng",
    evidenceMedium: "Bằng chứng đang tăng",
    evidenceHigh: "Bằng chứng vững hơn",
    asOf: "Cập nhật {date}",
  },
} as const;

type Copy = (typeof COPY)[keyof typeof COPY];

function interpolate(
  template: string,
  values: Record<string, string | number>,
): string {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.replace(`{${key}}`, String(value)),
    template,
  );
}

function formatBand(value: number | null): string {
  return value === null ? "—" : value.toFixed(1);
}

function dateFormatter(locale: string, options?: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...options,
  });
}

function confidenceLabel(
  status: IeltsProfileView["estimate"]["status"],
  copy: Copy,
) {
  if (status === "high_confidence") return copy.evidenceHigh;
  if (status === "medium_confidence") return copy.evidenceMedium;
  return copy.evidenceLow;
}

function CurrentEstimate({
  view,
  copy,
  locale,
}: {
  view: IeltsProfileView;
  copy: Copy;
  locale: string;
}) {
  const estimate = view.estimate;
  const hasEstimate = estimate.band !== null;
  const range =
    estimate.lower !== null && estimate.upper !== null
      ? `${estimate.lower.toFixed(1)}–${estimate.upper.toFixed(1)}`
      : null;
  const caption = hasEstimate ? (
    <span className="grid gap-2">
      <span className="flex flex-wrap items-center gap-2">
        <span className="rounded-md bg-primary-container px-2 py-1 type-caption font-semibold text-on-primary-container">
          {copy.aiProvisional}
        </span>
        <span>
          {interpolate(copy.confidence, { value: estimate.confidencePercent })}
        </span>
      </span>
      {range ? <span>{interpolate(copy.range, { value: range })}</span> : null}
      <span className="type-caption">
        {interpolate(copy.asOf, {
          date: dateFormatter(locale).format(new Date(estimate.asOf)),
        })}
      </span>
    </span>
  ) : (
    copy.diagnosticNeeded
  );

  return (
    <BandGauge
      band={estimate.band}
      caption={caption}
      className="h-full shadow-none"
      isProvisional
      label={copy.current}
      target={view.target.overallBand}
      targetLabel={copy.target}
    />
  );
}

function GoalAndNext({
  view,
  copy,
  locale,
}: {
  view: IeltsProfileView;
  copy: Copy;
  locale: string;
}) {
  const title =
    locale === "vi" ? view.nextAction.titleVi : view.nextAction.titleEn;
  return (
    <aside className="grid gap-4 rounded-xl border border-outline-variant bg-surface-container p-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-surface px-3 py-3">
          <p className="type-caption text-on-surface-variant">{copy.target}</p>
          <p className="mt-1 type-heading-md font-semibold tabular-nums text-on-surface">
            {formatBand(view.target.overallBand)}
          </p>
        </div>
        <div className="rounded-lg bg-surface px-3 py-3">
          <p className="type-caption text-on-surface-variant">
            {copy.testDate}
          </p>
          <p className="mt-1 type-label font-semibold text-on-surface">
            {view.target.testDate
              ? dateFormatter(locale).format(
                  new Date(`${view.target.testDate}T12:00:00Z`),
                )
              : copy.noDate}
          </p>
        </div>
      </div>
      <div className="border-t border-outline-variant pt-4">
        <div className="flex items-center gap-2 type-caption font-semibold uppercase text-primary">
          <Target className="size-4" aria-hidden />
          {copy.next}
        </div>
        <p className="mt-2 type-title font-semibold text-on-surface">{title}</p>
        {view.nextAction.estimatedMinutes ? (
          <p className="mt-1 flex items-center gap-1.5 type-caption text-on-surface-variant">
            <Clock className="size-3.5" aria-hidden />
            {interpolate(copy.minutes, {
              value: view.nextAction.estimatedMinutes,
            })}
          </p>
        ) : null}
        <Link
          className={cn(buttonVariants({ variant: "primary" }), "mt-4 w-full")}
          href={view.nextAction.href}
        >
          {copy.start}
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      </div>
    </aside>
  );
}

function SkillBreakdown({
  view,
  copy,
}: {
  view: IeltsProfileView;
  copy: Copy;
}) {
  return (
    <section aria-labelledby="ielts-profile-skills" className="grid gap-3">
      <div>
        <h2
          id="ielts-profile-skills"
          className="type-heading-md font-semibold text-on-surface"
        >
          {copy.skills}
        </h2>
        <p className="mt-1 type-body-sm text-on-surface-variant">
          {copy.skillCaption}
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {view.skills.map((skill) => (
          <BandMeter
            accent={skill.skill}
            band={skill.band}
            key={skill.skill}
            skill={copy[skill.skill]}
            status={
              <span>
                {confidenceLabel(skill.status, copy)} ·{" "}
                {skill.confidencePercent}%
              </span>
            }
            target={skill.target}
            targetLabel={copy.target}
          />
        ))}
      </div>
    </section>
  );
}

export function IeltsProfilePerformanceCenter({
  view,
}: {
  view: IeltsProfileView;
}) {
  const locale = useLocale();
  const copy = COPY[locale === "vi" ? "vi" : "en"];
  const moduleLabel =
    view.module === "general_training" ? copy.general : copy.academic;

  return (
    <PageTransition>
      <ProductPageShell>
        <PageContainer size="data" className="flex flex-col gap-6 py-6 lg:py-8">
          <header className="flex flex-col gap-1">
            <p className="type-eyebrow font-semibold uppercase text-primary">
              {copy.eyebrow}
            </p>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h1 className="type-heading-xl font-semibold text-on-surface">
                  {copy.title}
                </h1>
                <p className="mt-1 type-body-sm text-on-surface-variant">
                  {copy.subtitle}
                </p>
              </div>
              <span className="rounded-md border border-outline-variant bg-surface-container px-2.5 py-1 type-caption font-semibold text-on-surface-variant">
                {moduleLabel}
              </span>
            </div>
          </header>

          <div className="grid items-stretch gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(280px,0.75fr)]">
            <CurrentEstimate copy={copy} locale={locale} view={view} />
            <GoalAndNext copy={copy} locale={locale} view={view} />
          </div>

          <SkillBreakdown copy={copy} view={view} />
          <StudyConsistencyHeatmap view={view} />
          <ProfileEvidenceLists view={view} />
        </PageContainer>
      </ProductPageShell>
    </PageTransition>
  );
}
