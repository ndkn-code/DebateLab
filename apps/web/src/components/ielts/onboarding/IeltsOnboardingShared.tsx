import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import {
  CheckCircle2,
  type LucideIcon,
} from "@/components/ui/icons";
import type { IeltsOnboardingStep } from "@/lib/ielts/onboarding/model";
import { cn } from "@/lib/utils";

const ONBOARDING_STEPS: IeltsOnboardingStep[] = [
  "welcome",
  "goal",
  "diagnostic",
  "result",
];

function stepIndex(step: IeltsOnboardingStep): number {
  return ONBOARDING_STEPS.indexOf(step);
}

export function OnboardingHeader({
  step,
}: {
  step: IeltsOnboardingStep;
}) {
  const t = useTranslations("ielts.onboarding");

  return (
    <header className="flex flex-col gap-4 border-b border-outline-variant pb-5">
      <div>
        <p className="type-eyebrow font-semibold uppercase text-primary">
          {t("eyebrow")}
        </p>
        <h1 className="type-heading-xl font-bold text-on-surface">
          {t("title")}
        </h1>
      </div>
      <ol className="grid gap-2 sm:grid-cols-4">
        {ONBOARDING_STEPS.map((item) => {
          const active = item === step;
          const done = stepIndex(item) < stepIndex(step);
          return (
            <li
              key={item}
              className={cn(
                "flex min-h-12 items-center gap-2 rounded-lg border px-3 type-body-sm font-semibold",
                active
                  ? "border-primary bg-primary-container text-on-primary-container"
                  : done
                    ? "border-success-container bg-success-container text-success-dim"
                    : "border-outline-variant bg-surface-container-low text-on-surface-variant",
              )}
            >
              {done ? <CheckCircle2 className="size-4" /> : null}
              {t(`steps.${item}`)}
            </li>
          );
        })}
      </ol>
    </header>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="type-body-sm font-semibold text-on-surface">{label}</span>
      {children}
    </label>
  );
}

export function ChoiceGroup({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-2">
      <p className="type-body-sm font-semibold text-on-surface">{label}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

export function choiceClass(active: boolean): string {
  return cn(
    "min-h-9 rounded-lg border px-3 type-body-sm font-semibold transition-colors",
    active
      ? "border-primary bg-primary-container text-on-primary-container"
      : "border-outline-variant bg-surface-container-low text-on-surface-variant hover:bg-surface-container",
  );
}

export function InfoStrip({
  icon: Icon,
  label,
}: {
  icon: LucideIcon;
  label: string;
}) {
  return (
    <div className="flex min-h-20 items-center gap-3 rounded-lg border border-outline-variant bg-surface-container px-4 py-3">
      <div className="inline-flex size-9 items-center justify-center rounded-lg bg-secondary-container text-on-secondary-container">
        <Icon className="size-5" />
      </div>
      <p className="type-body-sm font-semibold text-on-surface">{label}</p>
    </div>
  );
}
