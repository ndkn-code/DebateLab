import { listLearnerAssignedTests } from "@/lib/api/ielts/learner-assignments-repository";
import { AssignedTestsList } from "@/components/ielts/assignments/AssignedTestsList";

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
    <main className="mx-auto w-full max-w-3xl px-4 py-6">
      <AssignedTestsList tests={tests} locale={locale} />
    </main>
  );
}
