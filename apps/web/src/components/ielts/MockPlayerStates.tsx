"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import type { AttemptGrade } from "@/lib/scoring/ielts/grade-objective";
import { ProductIcon } from "@/components/ui/product-icon";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MockPreTestGuide } from "./MockPreTestGuide";
import {
  IELTS_PLAYER_EXPERIENCE_COPY,
  type IeltsPlayerExperience,
  type IeltsPlayerLocale,
} from "./player-experience";

const PILL = "rounded-full px-5 py-2 text-sm font-semibold";

const INTRO_COPY = {
  en: {
    section: "Section",
    pace: "Timing",
    next: "After you submit",
    experience: {
      exam_simulation: {
        section: "Listening · Reading · Writing",
        pace: "Timed sections",
        next: "Results after marking",
      },
      guided_practice: {
        section: "Focused skill practice",
        pace: "Untimed · pause anytime",
        next: "Feedback and explanations",
      },
      speaking_rehearsal: {
        section: "Speaking rehearsal",
        pace: "Short recorded response",
        next: "AI practice feedback",
      },
    },
    errorTitle: "Practice could not start",
    retry: "Try again",
    back: "Back to test library",
    supportCode: "Support code",
    starting: "Starting…",
  },
  vi: {
    section: "Nội dung",
    pace: "Thời gian",
    next: "Sau khi nộp",
    experience: {
      exam_simulation: {
        section: "Nghe · Đọc · Viết",
        pace: "Tính giờ theo từng phần",
        next: "Kết quả sau khi chấm",
      },
      guided_practice: {
        section: "Luyện một kỹ năng",
        pace: "Không giới hạn · có thể tạm dừng",
        next: "Phản hồi và giải thích",
      },
      speaking_rehearsal: {
        section: "Luyện nói",
        pace: "Câu trả lời ghi âm ngắn",
        next: "Phản hồi luyện tập từ AI",
      },
    },
    errorTitle: "Chưa thể bắt đầu bài luyện",
    retry: "Thử lại",
    back: "Quay lại thư viện đề",
    supportCode: "Mã hỗ trợ",
    starting: "Đang bắt đầu…",
  },
} as const;

function bandText(band: number | null): string {
  return band === null ? "—" : band.toFixed(1);
}

export function MockIntroCard({
  title,
  experience,
  locale,
  busy,
  error,
  supportCode,
  onStart,
  backHref,
}: {
  title: string;
  experience: IeltsPlayerExperience;
  locale: IeltsPlayerLocale;
  busy: boolean;
  error: string | null;
  supportCode?: string | null;
  onStart: () => void;
  backHref: string;
}) {
  const copy = IELTS_PLAYER_EXPERIENCE_COPY[locale][experience];
  const intro = INTRO_COPY[locale];
  const facts = intro.experience[experience];

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 rounded-xl border border-outline-variant bg-surface p-4 sm:p-5">
      <div className="text-left">
        <p className="type-eyebrow text-primary">{copy.label}</p>
        <h1 className="mt-1 type-heading-lg text-on-surface">{title}</h1>
        <p className="mt-2 max-w-xl type-body-sm text-on-surface-variant">
          {copy.intro}
        </p>
      </div>

      <dl className="grid divide-y divide-outline-variant rounded-xl border border-outline-variant bg-surface-container-low sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        {[
          [intro.section, facts.section, "listChecks"],
          [intro.pace, facts.pace, "timer"],
          [intro.next, facts.next, "arrowRight"],
        ].map(([label, value, icon]) => (
          <div key={label} className="flex min-w-0 gap-2.5 px-3 py-3">
            <ProductIcon
              name={icon as "listChecks" | "timer" | "arrowRight"}
              size="sm"
              className="mt-0.5 text-primary"
            />
            <div className="min-w-0">
              <dt className="type-caption text-on-surface-variant">{label}</dt>
              <dd className="mt-0.5 type-label font-semibold text-on-surface">
                {value}
              </dd>
            </div>
          </div>
        ))}
      </dl>

      <MockPreTestGuide experience={experience} locale={locale} />

      {error ? (
        <div
          className="rounded-xl border border-error/25 bg-error-container p-3 text-left"
          role="alert"
        >
          <div className="flex items-start gap-2.5">
            <ProductIcon
              name="warning"
              size="sm"
              className="mt-0.5 text-error"
            />
            <div className="min-w-0 flex-1">
              <p className="type-label font-semibold text-error">
                {intro.errorTitle}
              </p>
              <p className="mt-1 type-body-sm text-on-error-container">
                {error}
              </p>
              {supportCode ? (
                <p className="mt-2 type-caption text-on-surface-variant">
                  {intro.supportCode}: <code>{supportCode}</code>
                </p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Link
          href={backHref}
          className={buttonVariants({
            variant: "outline",
            size: "lg",
            className: "w-full sm:w-auto",
          })}
        >
          {intro.back}
        </Link>
        <Button
          type="button"
          size="lg"
          onClick={onStart}
          disabled={busy}
          aria-busy={busy}
          className={cn("w-full sm:w-auto", busy && "cursor-wait")}
        >
          {busy ? (
            <ProductIcon
              name="loader"
              size="sm"
              className="animate-spin motion-reduce:animate-none"
            />
          ) : null}
          {busy ? intro.starting : error ? intro.retry : copy.start}
        </Button>
      </div>
    </div>
  );
}

export function MockBandSummary({
  grade,
  resultsHref,
  returnHref,
  returnLabel,
  experience,
  locale,
}: {
  grade: AttemptGrade;
  resultsHref: string | null;
  returnHref?: string;
  returnLabel?: string;
  experience: IeltsPlayerExperience;
  locale: IeltsPlayerLocale;
}) {
  const copy = IELTS_PLAYER_EXPERIENCE_COPY[locale][experience];
  const t = useTranslations("ielts.player.exam");
  const rows: Array<[string, number | null, number | null]> = [
    [t("skills.listening"), grade.listeningRaw, grade.bands.listeningBand],
    [t("skills.reading"), grade.readingRaw, grade.bands.readingBand],
  ];

  if (experience === "speaking_rehearsal") {
    return (
      <div className="mx-auto flex max-w-lg flex-col gap-4 rounded-xl border border-outline-variant bg-surface-container p-8 text-center">
        <span
          aria-hidden="true"
          className="mx-auto flex size-12 items-center justify-center rounded-xl bg-primary-container text-primary"
        >
          <ProductIcon name="checkCircle" size="lg" weight="fill" />
        </span>
        <h1 className="text-xl font-bold text-on-surface">
          {copy.summaryTitle}
        </h1>
        <p className="text-sm text-on-surface-variant">{copy.completionNote}</p>
        {resultsHref ? (
          <Link
            href={resultsHref}
            className={`${PILL} bg-primary text-center text-on-primary`}
          >
            {copy.resultsLabel}
          </Link>
        ) : null}
      </div>
    );
  }

  if (experience === "exam_simulation") {
    return (
      <div className="mx-auto flex max-w-lg flex-col gap-4 rounded-xl border border-outline-variant bg-surface-container p-5 text-center sm:p-6">
        <span
          aria-hidden="true"
          className="mx-auto flex size-12 items-center justify-center rounded-xl bg-primary-container text-primary"
        >
          <ProductIcon name="checkCircle" size="lg" weight="fill" />
        </span>
        <h1 className="text-xl font-bold text-on-surface">
          {copy.summaryTitle}
        </h1>
        <p className="text-sm text-on-surface-variant">{copy.completionNote}</p>
        {resultsHref ? (
          <Link
            href={resultsHref}
            className={`${PILL} bg-primary text-center text-on-primary`}
          >
            {copy.resultsLabel}
          </Link>
        ) : null}
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4 rounded-xl border border-outline-variant bg-surface-container p-5 sm:p-6">
      <h1 className="text-center text-xl font-bold text-on-surface">
        {copy.summaryTitle}
      </h1>
      <div className="rounded-xl bg-primary p-5 text-center text-on-primary">
        <p className="text-xs font-semibold uppercase tracking-wide">
          {t("overallProvisional")}
        </p>
        <p className="text-4xl font-extrabold">
          {bandText(grade.bands.overallBand)}
        </p>
      </div>
      <div className="flex flex-col gap-2">
        {rows.map(([label, raw, band]) => (
          <div
            key={label}
            className="flex items-center justify-between rounded-lg bg-surface px-4 py-3 text-on-surface"
          >
            <span className="text-sm font-medium">{label}</span>
            <span className="text-sm text-on-surface-variant">
              {raw === null ? "—" : `${raw}/40`} ·{" "}
              <span className="font-bold text-on-surface">
                {t("band", { band: bandText(band) })}
              </span>
            </span>
          </div>
        ))}
      </div>
      {resultsHref ? (
        <Link
          href={resultsHref}
          className={`${PILL} bg-primary text-center text-on-primary`}
        >
          {copy.resultsLabel}
        </Link>
      ) : null}
      {returnHref ? (
        <Link
          href={returnHref}
          className={`${PILL} bg-surface-container-high text-center text-on-surface`}
        >
          {returnLabel ?? t("continue")}
        </Link>
      ) : null}
      <p className="text-center text-xs text-on-surface-variant">
        {copy.completionNote}
      </p>
    </div>
  );
}
