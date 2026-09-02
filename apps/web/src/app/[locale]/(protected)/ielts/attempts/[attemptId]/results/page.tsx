import Link from "next/link";
import { notFound } from "next/navigation";
import { loadAttemptResults } from "@/lib/api/ielts/results-repository";
import { loadActiveIeltsBandTargets } from "@/lib/api/ielts/study-plan-repository";
import { buildAttemptResultsViewModel } from "@/lib/ielts/results/view-model";
import { ieltsPaths, localizedPath } from "@/lib/ielts/routes";
import { IeltsResultsView } from "@/components/ielts/results/IeltsResultsView";
import {
  PageContainer,
  ProductPageShell,
} from "@/components/shared/product-layout";
import { buttonVariants } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export const metadata = { title: "IELTS results" };

export default async function IeltsAttemptResultsPage({
  params,
}: {
  params: Promise<{ locale: string; attemptId: string }>;
}) {
  const { locale, attemptId } = await params;
  const input = await loadAttemptResults(attemptId);
  if (!input) notFound();
  const copy =
    locale === "vi"
      ? {
          title: "Bài làm đang tiếp tục",
          body: "Bài thi thử này chưa được nộp. Hoàn thành bài để xem band và phần xem lại.",
          resume: "Tiếp tục làm bài",
        }
      : {
          title: "Attempt in progress",
          body: "This mock has not been submitted yet. Finish it to see your band and review.",
          resume: "Resume mock",
        };

  // The review (correct answers + explanations) is only meaningful once a
  // sitting is submitted — send an in-progress attempt back to the player.
  if (input.attemptStatus === "in_progress") {
    return (
      <ProductPageShell>
        <PageContainer size="focused" className="py-8 text-center">
          <div className="rounded-xl border border-outline-variant bg-surface-container p-5 sm:p-6">
            <h1 className="type-heading-md text-on-surface">{copy.title}</h1>
            <p className="mt-2 type-body-sm text-on-surface-variant">
              {copy.body}
            </p>
            {input.testSlug ? (
              <Link
                href={localizedPath(locale, ieltsPaths.mock(input.testSlug))}
                className={buttonVariants({ className: "mt-4" })}
              >
                {copy.resume}
              </Link>
            ) : null}
          </div>
        </PageContainer>
      </ProductPageShell>
    );
  }

  const targets = await loadActiveIeltsBandTargets(input.userId);
  const model = buildAttemptResultsViewModel(input);
  return (
    <ProductPageShell>
      <PageContainer size="data" className="py-5 lg:py-6">
        <IeltsResultsView model={model} targets={targets} />
      </PageContainer>
    </ProductPageShell>
  );
}
