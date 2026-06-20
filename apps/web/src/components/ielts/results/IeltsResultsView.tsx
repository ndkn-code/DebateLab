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
import { ObjectiveReviewList } from "./ObjectiveReviewList";
import { RawBandBreakdown } from "./RawBandBreakdown";
import { SpeakingResultPanel, WritingResultPanel } from "./SkillFeedbackPanels";
import { STATUS_LABEL, STATUS_PILL, bandText } from "./format";

function OverallHero({ overall }: { overall: OverallBandSummary }) {
  return (
    <section className="rounded-3xl bg-primary p-6 text-center text-on-primary sm:p-8">
      <p className="type-label uppercase">
        {overall.isProvisional ? "Provisional overall band" : "Overall band"}
      </p>
      <p className="mt-1 text-5xl font-extrabold tabular-nums">{bandText(overall.band)}</p>
      <p className="mt-2 type-body-sm">
        {overall.presentCount} of {overall.totalSkills}{" "}
        {overall.totalSkills === 1 ? "skill" : "skills"} scored
        {overall.isProvisional ? " · updates as Writing & Speaking are marked" : ""}
      </p>
    </section>
  );
}

function SkillRow({ skill }: { skill: SkillBandRow }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-outline-variant bg-surface-container px-4 py-3">
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="type-title text-on-surface">{skill.label}</span>
        <span className={`rounded-full px-2.5 py-0.5 type-caption ${STATUS_PILL[skill.status]}`}>
          {STATUS_LABEL[skill.status]}
        </span>
      </div>
      <div className="flex items-center gap-4">
        {skill.raw !== null ? (
          <span className="type-body-sm text-on-surface-variant tabular-nums">
            {skill.raw}/{skill.rawMax}
          </span>
        ) : null}
        <span className="min-w-10 text-right type-heading-md text-on-surface tabular-nums">
          {bandText(skill.band)}
        </span>
      </div>
    </div>
  );
}

export function IeltsResultsView({ model }: { model: AttemptResultsViewModel }) {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="type-heading-lg text-on-surface">{model.testTitle}</h1>
        <p className="type-body-sm text-on-surface-variant">
          {model.module === "general_training" ? "General Training" : "Academic"} · your results
        </p>
      </header>

      <OverallHero overall={model.overall} />

      <section className="flex flex-col gap-2">
        {model.skills.map((skill) => (
          <SkillRow key={skill.skill} skill={skill} />
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
