import { listLearnerAssignedTests } from "@/lib/api/ielts/learner-assignments-repository";
import { AssignedTestsList } from "@/components/ielts/assignments/AssignedTestsList";
import { redirect } from "next/navigation";
import {
  PageContainer,
  ProductPageShell,
} from "@/components/shared/product-layout";

export const metadata = { title: "Assigned IELTS tests" };
export const dynamic = "force-dynamic";

export default async function IeltsAssignedTestsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ assignment?: string }>;
}) {
  const [{ locale }, filters, tests] = await Promise.all([
    params,
    searchParams,
    listLearnerAssignedTests(),
  ]);
  const selected = filters.assignment
    ? tests.find((test) => test.assignmentId === filters.assignment)
    : null;
  if (selected) {
    const resultAttemptId = selected.progress.resultAttemptId;
    if (resultAttemptId) {
      redirect(`/${locale}/ielts/attempts/${resultAttemptId}/results`);
    }
    if (selected.testSlug) {
      redirect(
        `/${locale}/ielts/mock/${selected.testSlug}?assignment=${selected.assignmentId}`,
      );
    }
  }

  return (
    <ProductPageShell>
      <PageContainer size="data" className="py-5 lg:py-6">
        <AssignedTestsList tests={tests} locale={locale} />
      </PageContainer>
    </ProductPageShell>
  );
}
