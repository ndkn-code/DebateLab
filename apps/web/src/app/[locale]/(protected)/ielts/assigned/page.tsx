import { listLearnerAssignedTests } from "@/lib/api/ielts/learner-assignments-repository";
import { AssignedTestsList } from "@/components/ielts/assignments/AssignedTestsList";
import {
  PageContainer,
  ProductPageShell,
} from "@/components/shared/product-layout";

export const metadata = { title: "Assigned IELTS tests" };
export const dynamic = "force-dynamic";

export default async function IeltsAssignedTestsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const tests = await listLearnerAssignedTests();

  return (
    <ProductPageShell>
      <PageContainer size="data" className="py-5 lg:py-6">
        <AssignedTestsList tests={tests} locale={locale} />
      </PageContainer>
    </ProductPageShell>
  );
}
