import { useTranslations } from "next-intl";
import { ArrowRight } from "@/components/ui/icons";
import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import type { IeltsDiagnosticTestSummary } from "@/lib/api/ielts/study-plan-repository";
import { cn } from "@/lib/utils";

export function IeltsOnboardingDiagnosticStep({
  diagnosticTest,
  diagnosticHref,
}: {
  diagnosticTest: IeltsDiagnosticTestSummary | null;
  diagnosticHref: string | null;
}) {
  const t = useTranslations("ielts.onboarding");

  return (
    <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
      <div>
        <h2 className="type-heading-lg font-bold text-on-surface">
          {t("diagnostic_title")}
        </h2>
        <p className="mt-2 type-body text-on-surface-variant">
          {t("diagnostic_body")}
        </p>
      </div>
      <div className="rounded-lg border border-outline-variant bg-surface-container p-5">
        {diagnosticTest && diagnosticHref ? (
          <div className="flex flex-col gap-4">
            <p className="type-body-sm font-semibold text-primary">
              {t("diagnostic_ready")}
            </p>
            <h3 className="type-heading-md font-bold text-on-surface">
              {diagnosticTest.title}
            </h3>
            <p className="type-body text-on-surface-variant">
              {t("diagnostic_shape")}
            </p>
            <Link
              href={diagnosticHref}
              className={cn(buttonVariants({ variant: "primary", size: "lg" }))}
            >
              {t("start_diagnostic")}
              <ArrowRight className="size-4" />
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <h3 className="type-heading-md font-bold text-on-surface">
              {t("diagnostic_unavailable_title")}
            </h3>
            <p className="type-body text-on-surface-variant">
              {t("diagnostic_unavailable_body")}
            </p>
            <Link
              href="/ielts/tests"
              className={cn(buttonVariants({ variant: "secondary", size: "lg" }))}
            >
              {t("browse_tests")}
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
