"use client";

/**
 * IELTS attempt results — the post-attempt experience (WS-2.2). A server
 * client presentation: it renders the serialisable {@link AttemptResultsViewModel} the
 * page builds (per-skill bands, the overall, the raw→band breakdown, the
 * per-skill review tabs). Momentum surface: the band hero and meters stay
 * warm; the review area below is calm and data-first. Design-system tokens only.
 */
import type {
  AttemptResultsViewModel,
  OverallBandSummary,
  SkillBandRow,
} from "@/lib/ielts/results/types";
import {
  targetBandForSkill,
  type IeltsBandTargets,
} from "@/lib/ielts/band-visuals";
import { BandGauge, BandMeter } from "@/components/ielts/band-visuals";
import { RawBandBreakdown } from "./RawBandBreakdown";
import { ResultsReviewTabs } from "./review/ResultsReviewTabs";
import { STATUS_PILL } from "./format";
import { useLocale } from "next-intl";

import { ResultsActions } from "./ResultsActions";
import {
  resultsNextStep,
  type ResultsNextStep,
} from "@/lib/ielts/results/next-step";

const COPY = {
  en: {
    skill: "skill",
    skills: "skills",
    scored: "scored",
    pendingDetail: "Some skill scores are still being marked.",
    pending: "Pending",
    practiceCompleteDetail:
      "All included skills are scored. A four-skill overall band is not calculated for this practice.",
    practiceComplete: "Practice complete",
    overall: "Overall band",
    target: "Target",
    academic: "Academic",
    general: "General Training",
    listening: "Listening",
    reading: "Reading",
    writing: "Writing",
    speaking: "Speaking",
    results: "your results",
    status: {
      scored: "Scored",
      in_progress: "Scoring…",
      not_attempted: "Not attempted",
    },
  },
  vi: {
    skill: "kỹ năng",
    skills: "kỹ năng",
    scored: "đã có điểm",
    pendingDetail: "Một số kỹ năng vẫn đang được chấm.",
    pending: "Đang chờ",
    practiceCompleteDetail:
      "Tất cả kỹ năng trong bài đã có điểm. Bài luyện này không tính band tổng bốn kỹ năng.",
    practiceComplete: "Hoàn thành bài luyện",
    overall: "Band tổng",
    target: "Mục tiêu",
    academic: "Học thuật",
    general: "Tổng quát",
    listening: "Nghe",
    reading: "Đọc",
    writing: "Viết",
    speaking: "Nói",
    results: "kết quả của bạn",
    status: {
      scored: "Đã chấm",
      in_progress: "Đang chấm…",
      not_attempted: "Chưa làm",
    },
  },
} as const;

function OverallHero({
  overall,
  targets,
}: {
  overall: OverallBandSummary;
  targets: IeltsBandTargets;
}) {
  const locale = useLocale();
  const copy = COPY[locale === "vi" ? "vi" : "en"];
  const scoredCopy = `${overall.presentCount}/${overall.totalSkills} ${
    overall.totalSkills === 1 ? copy.skill : copy.skills
  } ${copy.scored}`;
  const includedSkillsComplete =
    overall.isProvisional &&
    overall.totalSkills > 0 &&
    overall.presentCount === overall.totalSkills;

  return (
    <BandGauge
      band={overall.band}
      caption={
        <span className="flex flex-col gap-2">
          <span>
            {scoredCopy}
            {overall.isProvisional
              ? ` · ${
                  includedSkillsComplete
                    ? copy.practiceCompleteDetail
                    : copy.pendingDetail
                }`
              : ""}
          </span>
          {overall.isProvisional ? (
            <span className="inline-flex min-h-5 w-fit items-center rounded-md bg-surface-container-high px-2 type-caption font-semibold uppercase text-on-surface-variant">
              {includedSkillsComplete ? copy.practiceComplete : copy.pending}
            </span>
          ) : null}
        </span>
      }
      isProvisional={overall.isProvisional}
      label={copy.overall}
      target={targets.overall}
      targetLabel={copy.target}
    />
  );
}

function SkillRow({
  delayMs,
  skill,
  targets,
}: {
  delayMs: number;
  skill: SkillBandRow;
  targets: IeltsBandTargets;
}) {
  const locale = useLocale();
  const copy = COPY[locale === "vi" ? "vi" : "en"];
  return (
    <BandMeter
      accent={skill.skill}
      band={skill.band}
      delayMs={delayMs}
      raw={skill.raw}
      rawMax={skill.rawMax}
      skill={copy[skill.skill]}
      status={
        <span
          className={`inline-flex min-h-5 items-center rounded-md px-2 type-caption ${STATUS_PILL[skill.status]}`}
        >
          {copy.status[skill.status]}
        </span>
      }
      target={targetBandForSkill(targets, skill.skill)}
      targetLabel={copy.target}
    />
  );
}

export function IeltsResultsView({
  model,
  targets,
  nextStep,
}: {
  model: AttemptResultsViewModel;
  targets: IeltsBandTargets;
  nextStep?: ResultsNextStep;
}) {
  const locale = useLocale();
  const copy = COPY[locale === "vi" ? "vi" : "en"];
  return (
    <div className="flex flex-col gap-5">
      <header className="flex min-w-0 flex-col gap-1">
        <h1 className="break-words type-heading-lg font-semibold text-on-surface">
          {model.testTitle}
        </h1>
        <p className="type-body-sm text-on-surface-variant">
          {model.module === "general_training" ? copy.general : copy.academic} ·{" "}
          {copy.results}
        </p>
      </header>

      <ResultsActions
        nextStep={nextStep ?? resultsNextStep(locale)}
        hasReview={
          model.objective.length > 0 ||
          Boolean(model.writing) ||
          Boolean(model.speaking)
        }
        hasFailedScores={
          model.writing?.tasks.some((task) => task.status === "failed") ||
          model.speaking?.parts.some((part) => part.status === "failed")
        }
        awaitingScores={model.skills.some(
          (skill) => skill.status === "in_progress",
        )}
      />

      <OverallHero overall={model.overall} targets={targets} />

      <section className="flex flex-col gap-2">
        {model.skills.map((skill, index) => (
          <SkillRow
            delayMs={index * 70}
            key={skill.skill}
            skill={skill}
            targets={targets}
          />
        ))}
      </section>

      {model.breakdowns.length > 0 ? (
        <RawBandBreakdown breakdowns={model.breakdowns} />
      ) : null}

      <ResultsReviewTabs model={model} />
    </div>
  );
}
