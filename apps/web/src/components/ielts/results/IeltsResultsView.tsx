/**
 * IELTS attempt results — the post-attempt experience (WS-2.2). A server
 * component: it renders the serialisable {@link AttemptResultsViewModel} the
 * page builds (per-skill bands, the overall, the raw→band breakdown, the
 * per-question review, and Writing/Speaking panels). No interactivity beyond
 * native `<details>`, so nothing ships to the client. Design-system tokens only.
 */
import type {
  AttemptResultsViewModel,
  OverallBandSummary,
  SkillBandRow,
} from "@/lib/ielts/results/types";
import {
  buildResultsBandInsight,
  targetBandForSkill,
  type IeltsBandTargets,
} from "@/lib/ielts/band-visuals";
import { BandGauge, BandMeter } from "@/components/ielts/band-visuals";
import { ObjectiveReviewList } from "./ObjectiveReviewList";
import { RawBandBreakdown } from "./RawBandBreakdown";
import { SpeakingResultPanel, WritingResultPanel } from "./SkillFeedbackPanels";
import { STATUS_LABEL, STATUS_PILL } from "./format";

function OverallHero({
  overall,
  skills,
  targets,
}: {
  overall: OverallBandSummary;
  skills: SkillBandRow[];
  targets: IeltsBandTargets;
}) {
  const scoredCopy = `${overall.presentCount} of ${overall.totalSkills} ${
    overall.totalSkills === 1 ? "skill" : "skills"
  } scored`;
  const insight = buildResultsBandInsight(skills, targets);

  return (
    <BandGauge
      band={overall.band}
      caption={
        <span className="flex flex-col gap-2">
          <span>
            {scoredCopy}
            {overall.isProvisional
              ? " · updates as Writing & Speaking are marked"
              : ""}
          </span>
          {overall.isProvisional ? (
            <span className="inline-flex w-fit rounded-full bg-surface-container-high px-3 py-1 type-caption font-semibold uppercase text-on-surface-variant">
              Pending
            </span>
          ) : null}
          <span className="text-on-surface">{insight}</span>
        </span>
      }
      isProvisional={overall.isProvisional}
      label="Overall band"
      target={targets.overall}
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
  return (
    <BandMeter
      band={skill.band}
      delayMs={delayMs}
      raw={skill.raw}
      rawMax={skill.rawMax}
      skill={skill.label}
      status={
        <span
          className={`rounded-full px-2.5 py-0.5 type-caption ${STATUS_PILL[skill.status]}`}
        >
          {STATUS_LABEL[skill.status]}
        </span>
      }
      target={targetBandForSkill(targets, skill.skill)}
    />
  );
}

export function IeltsResultsView({
  model,
  targets,
}: {
  model: AttemptResultsViewModel;
  targets: IeltsBandTargets;
}) {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="type-heading-lg text-on-surface">{model.testTitle}</h1>
        <p className="type-body-sm text-on-surface-variant">
          {model.module === "general_training" ? "General Training" : "Academic"} · your results
        </p>
      </header>

      <OverallHero
        overall={model.overall}
        skills={model.skills}
        targets={targets}
      />

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

      {model.objective.length > 0 ? (
        <ObjectiveReviewList sections={model.objective} />
      ) : null}

      {model.writing ? <WritingResultPanel writing={model.writing} /> : null}
      {model.speaking ? <SpeakingResultPanel speaking={model.speaking} /> : null}
    </div>
  );
}
