import Link from "next/link";
import { notFound } from "next/navigation";
import { loadAttemptResults } from "@/lib/api/ielts/results-repository";
import { loadActiveIeltsBandTargets } from "@/lib/api/ielts/study-plan-repository";
import { buildAttemptResultsViewModel } from "@/lib/ielts/results/view-model";
import { IeltsResultsView } from "@/components/ielts/results/IeltsResultsView";

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

  // The review (correct answers + explanations) is only meaningful once a
  // sitting is submitted — send an in-progress attempt back to the player.
  if (input.attemptStatus === "in_progress") {
    return (
      <main className="mx-auto w-full max-w-md px-4 py-10 text-center">
        <div className="rounded-3xl border border-outline-variant bg-surface-container p-8">
          <h1 className="type-heading-md text-on-surface">Attempt in progress</h1>
          <p className="mt-2 type-body-sm text-on-surface-variant">
            This mock has not been submitted yet. Finish it to see your band and review.
          </p>
          {input.testSlug ? (
            <Link
              href={`/${locale}/ielts/mock/${input.testSlug}`}
              className="mt-4 inline-block rounded-full bg-primary px-5 py-2 type-label text-on-primary"
            >
              Resume mock
            </Link>
          ) : null}
        </div>
      </main>
    );
  }

  const targets = await loadActiveIeltsBandTargets(input.userId);
  const model = buildAttemptResultsViewModel(input);
  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-6">
      <IeltsResultsView model={model} targets={targets} />
    </main>
  );
}
