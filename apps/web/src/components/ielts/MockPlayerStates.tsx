"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import type { AttemptGrade } from "@/lib/scoring/ielts/grade-objective";
import { ProductIcon } from "@/components/ui/product-icon";
import { MockPreTestGuide } from "./MockPreTestGuide";
import {
  IELTS_PLAYER_EXPERIENCE_COPY,
  type IeltsPlayerExperience,
  type IeltsPlayerLocale,
} from "./player-experience";

const PILL = "rounded-full px-5 py-2 text-sm font-semibold";

function bandText(band: number | null): string {
  return band === null ? "—" : band.toFixed(1);
}

export function MockIntroCard({
  title,
  experience,
  locale,
  busy,
  error,
  onStart,
}: {
  title: string;
  experience: IeltsPlayerExperience;
  locale: IeltsPlayerLocale;
  busy: boolean;
  error: string | null;
  onStart: () => void;
}) {
  const copy = IELTS_PLAYER_EXPERIENCE_COPY[locale][experience];

  return (
    <div className="mx-auto flex max-w-lg flex-col items-center gap-4 rounded-3xl border border-outline-variant bg-surface-container p-8 text-center">
      <h1 className="text-xl font-bold text-on-surface">{title}</h1>
      <p className="type-label font-semibold uppercase tracking-wide text-primary">
        {copy.label}
      </p>
      <p className="text-sm text-on-surface-variant">{copy.intro}</p>
      <MockPreTestGuide experience={experience} locale={locale} />
      {error ? <p className="text-sm text-error">{error}</p> : null}
      <button
        type="button"
        onClick={onStart}
        disabled={busy}
        className={`${PILL} bg-primary text-on-primary disabled:opacity-50`}
      >
        {busy ? (locale === "vi" ? "Đang bắt đầu…" : "Starting…") : copy.start}
      </button>
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
      <div className="mx-auto flex max-w-lg flex-col gap-4 rounded-3xl border border-outline-variant bg-surface-container p-8 text-center">
        <span
          aria-hidden="true"
          className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary-container text-primary"
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
