import { useTranslations } from "next-intl";
import {
  ArrowRight,
  CalendarDays,
  ClipboardList,
  Clock,
  Target,
} from "@/components/ui/icons";
import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { InfoStrip } from "./IeltsOnboardingShared";

export function IeltsOnboardingWelcome({
  onContinue,
}: {
  onContinue: () => void;
}) {
  const t = useTranslations("ielts.onboarding");

  return (
    <section className="grid gap-6 lg:grid-cols-[1fr_0.75fr]">
      <div className="flex flex-col justify-center gap-5">
        <div className="inline-flex size-12 items-center justify-center rounded-lg bg-primary-container text-on-primary-container">
          <Target className="size-6" />
        </div>
        <h2 className="type-heading-lg font-bold text-on-surface">
          {t("welcome_title")}
        </h2>
        <p className="max-w-2xl type-body text-on-surface-variant">
          {t("welcome_body")}
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className={cn(buttonVariants({ variant: "primary", size: "lg" }))}
            onClick={onContinue}
          >
            {t("welcome_cta")}
            <ArrowRight className="size-4" />
          </button>
          <Link
            href="/ielts"
            className={cn(buttonVariants({ variant: "secondary", size: "lg" }))}
          >
            {t("back_home")}
          </Link>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
        <InfoStrip icon={ClipboardList} label={t("welcome_goal")} />
        <InfoStrip icon={Clock} label={t("welcome_diagnostic")} />
        <InfoStrip icon={CalendarDays} label={t("welcome_plan")} />
      </div>
    </section>
  );
}
