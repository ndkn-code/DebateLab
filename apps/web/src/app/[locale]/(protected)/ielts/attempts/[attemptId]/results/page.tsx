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
import { Button } from "@/components/ui/button";

import { loadResultsAssignmentContext } from "@/lib/ielts/results/assignment-context";
import { resultsNextStep } from "@/lib/ielts/results/next-step";

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
          unavailable:
            "Không thể mở lại bài thi này. Bạn vẫn có thể chọn bài khác.",
          tests: "Xem bài thi thử",
        }
      : {
          title: "Attempt in progress",
          body: "This mock has not been submitted yet. Finish it to see your band and review.",
          resume: "Resume mock",
          unavailable:
            "This mock is no longer available to resume. You can choose another test.",
          tests: "Browse mocks",
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
            {!input.testSlug ? (
              <p className="mt-2 type-body-sm text-on-surface-variant">
                {copy.unavailable}
              </p>
            ) : null}
            <Button
              variant="primary"
              nativeButton={false}
              className="mt-4 h-auto min-h-9 max-w-full whitespace-normal py-2"
              render={
                <Link
                  href={localizedPath(
                    locale,
                    input.testSlug
                      ? ieltsPaths.mock(input.testSlug, {
                          attempt: input.attemptId,
                        })
                      : ieltsPaths.tests,
                  )}
                />
              }
            >
              {input.testSlug ? copy.resume : copy.tests}
            </Button>
          </div>
        </PageContainer>
      </ProductPageShell>
    );
  }

  const [targets, assignment] = await Promise.all([
    loadActiveIeltsBandTargets(input.userId),
    loadResultsAssignmentContext(input.attemptId, input.userId),
  ]);
  const model = buildAttemptResultsViewModel(input);
  return (
    <ProductPageShell>
      <PageContainer size="data" className="py-5 lg:py-6">
        <IeltsResultsView
          model={model}
          targets={targets}
          nextStep={resultsNextStep(locale, assignment)}
        />
      </PageContainer>
    </ProductPageShell>
  );
}
