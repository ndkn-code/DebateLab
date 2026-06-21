import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import type { LucideIcon } from "@/components/ui/icons";
import type { IeltsSkill } from "@/lib/ielts/adaptive/contracts";
import { cn } from "@/lib/utils";

/** Consistent section container for the study-plan surfaces. */
export function SectionCard({
  icon: Icon,
  title,
  caption,
  action,
  children,
}: {
  icon: LucideIcon;
  title: string;
  caption?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-outline-variant bg-surface-container p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary-container text-on-secondary-container">
            <Icon className="size-5" />
          </span>
          <div className="min-w-0">
            <h2 className="type-heading-sm font-bold text-on-surface">{title}</h2>
            {caption ? (
              <p className="mt-0.5 type-body-sm text-on-surface-variant">{caption}</p>
            ) : null}
          </div>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

export function SkillBadge({
  skill,
  className,
}: {
  skill: IeltsSkill;
  className?: string;
}) {
  const t = useTranslations("ielts.studyPlan");
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full bg-surface-container-high px-2.5 py-0.5 type-caption font-semibold text-on-surface-variant",
        className,
      )}
    >
      {t(`skills.${skill}`)}
    </span>
  );
}

export function KindChip({ kind }: { kind: string }) {
  const t = useTranslations("ielts.studyPlan");
  return (
    <span className="inline-flex items-center rounded-full bg-secondary-container px-2.5 py-0.5 type-caption font-semibold text-on-secondary-container">
      {t(`kind.${kind}`)}
    </span>
  );
}

const SEVERITY_CLASS: Record<string, string> = {
  critical: "bg-error-container text-on-error-container",
  weak: "bg-warning-container text-on-warning-container",
  watch: "bg-secondary-container text-on-secondary-container",
};

export function severityClass(severity: string): string {
  return SEVERITY_CLASS[severity] ?? SEVERITY_CLASS.watch;
}

/** Render an ISO date (or timestamp) as a short, locale-aware calendar label. */
export function formatShortDate(iso: string, locale: string): string {
  const date = iso.length === 10 ? new Date(`${iso}T00:00:00.000Z`) : new Date(iso);
  return new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(date);
}

/** Day-of-month from an ISO date, for the calendar date chip. */
export function dayOfMonth(iso: string): string {
  return String(Number(iso.slice(8, 10)));
}

/** Turn a snake/colon key (review kind, trigger) into a readable label. */
export function humanizeKey(value: string): string {
  return value
    .replace(/[_:]+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function pickText(locale: string, en: string, vi: string): string {
  return locale === "vi" ? vi : en;
}
