import { skillAccentVars } from "@/components/ielts/skill-accent";
import { ProductIcon } from "@/components/ui/product-icon";
import { cn } from "@/lib/utils";
import { Chip } from "../editorial";
import type { IeltsPanelSkill, IeltsPlanPanelCopy } from "../types";

/** Band meter tinted with the same skill accents the IELTS app uses. */
export function SkillMeter({
  skill,
  progress,
  className,
}: {
  skill: IeltsPanelSkill;
  progress: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "h-1.5 overflow-hidden rounded-full bg-surface-container-high",
        className,
      )}
      style={skillAccentVars(skill)}
      aria-hidden="true"
    >
      <div
        className="h-full rounded-full"
        style={{
          width: `${Math.round(Math.max(0, Math.min(1, progress)) * 100)}%`,
          background: "var(--ielts-skill-accent)",
        }}
      />
    </div>
  );
}

type SkillRow = IeltsPlanPanelCopy["skills"][number];

/**
 * Skills are grouped by the mode their band came from, so the Exam Simulation /
 * AI Rehearsal split is legible in the hero rather than repeated on every row.
 */
function groupByMode(skills: IeltsPlanPanelCopy["skills"]) {
  const groups: Array<{ mode: SkillRow["mode"]; skills: SkillRow[] }> = [];
  for (const skill of skills) {
    const last = groups.at(-1);
    if (last && last.mode === skill.mode) last.skills.push(skill);
    else groups.push({ mode: skill.mode, skills: [skill] });
  }
  return groups;
}

/**
 * Mirrors the IELTS study-plan home: a provisional overall estimate against a
 * target, the four skills with the mode each band came from, and one next task.
 */
export function IeltsPlanPanel({ copy }: { copy: IeltsPlanPanelCopy }) {
  return (
    <div className="flex flex-col gap-5 p-5 sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex size-7 items-center justify-center rounded-[9px] bg-primary text-on-primary">
            <ProductIcon name="compass" size="sm" />
          </span>
          <span className="type-label font-semibold text-on-surface">
            {copy.planLabel}
          </span>
        </div>
        <Chip tone="neutral">
          {copy.targetLabel} · {copy.target}
        </Chip>
      </div>

      <div className="flex items-end justify-between gap-4 border-b border-outline-variant pb-5">
        <div>
          <p className="type-eyebrow text-on-surface-variant">
            {copy.estimateLabel}
          </p>
          <p className="mt-1.5 type-display-sm leading-none text-on-surface">
            {copy.estimate}
          </p>
          <p className="mt-2 max-w-[30ch] type-caption text-on-surface-variant">
            {copy.estimateNote}
          </p>
        </div>
        <Chip tone="caution">{copy.provisionalLabel}</Chip>
      </div>

      <div>
        <p className="type-eyebrow text-on-surface-variant">
          {copy.skillsLabel}
        </p>
        {groupByMode(copy.skills).map((group) => (
          <section key={group.mode} className="mt-4 first:mt-3">
            <div className="flex items-center gap-2.5">
              <Chip tone={group.mode === "rehearsal" ? "caution" : "neutral"}>
                {copy.modeLabels[group.mode]}
              </Chip>
              <span
                aria-hidden="true"
                className="h-px flex-1 bg-outline-variant"
              />
            </div>
            <ul className="mt-3 space-y-3">
              {group.skills.map((skill) => (
                <li key={skill.skill}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="truncate type-label text-on-surface">
                      {skill.label}
                    </span>
                    <span className="type-label font-semibold tabular-nums text-on-surface">
                      {skill.band}
                    </span>
                  </div>
                  <SkillMeter
                    skill={skill.skill}
                    progress={skill.progress}
                    className="mt-1.5"
                  />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <div className="rounded-[12px] border border-outline-variant bg-surface-container-low p-4">
        <p className="type-eyebrow text-on-surface-variant">{copy.taskLabel}</p>
        <p className="mt-2 type-title font-semibold text-on-surface">
          {copy.task}
        </p>
        <p className="mt-1 type-caption text-on-surface-variant">
          {copy.taskMeta}
        </p>
      </div>

      <p className="type-caption text-on-surface-variant">{copy.footnote}</p>
    </div>
  );
}
