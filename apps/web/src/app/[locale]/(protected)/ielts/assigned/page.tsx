import { listLearnerAssignedTests } from "@/lib/api/ielts/learner-assignments-repository";
import { loadMyAssignedWork } from "@/lib/api/class-lms/student-assignments-repository";
import { AssignedTestsList } from "@/components/ielts/assignments/AssignedTestsList";
import { AssignedWorkList } from "@/components/lms/AssignedWorkList";
import { redirect } from "next/navigation";
import {
  PageContainer,
  ProductPageShell,
} from "@/components/shared/product-layout";
import { DEFAULT_CLASS_TIMEZONE } from "@/lib/api/admin-class-schedules-model";
import { STUDENT_LMS_WORKSPACE_V1 } from "@/lib/features";

export const metadata = { title: "Assigned IELTS tests" };
export const dynamic = "force-dynamic";

export default async function IeltsAssignedTestsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ assignment?: string }>;
}) {
  const [{ locale }, filters, tests, homework] = await Promise.all([
    params,
    searchParams,
    listLearnerAssignedTests(),
    // `listLearnerAssignedTests` filters `assignment_type = 'ielts_mock'`, so
    // homework assigned to the learner's class never reached this surface.
    STUDENT_LMS_WORKSPACE_V1 ? loadMyAssignedWork() : Promise.resolve([]),
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

  const vi = locale === "vi";
  const classHomework = homework.filter(
    (item) => item.assignmentType !== "ielts_mock",
  );
  const outstandingHomework = classHomework.filter(
    (item) => item.outstanding,
  ).length;

  return (
    <ProductPageShell>
      <PageContainer size="data" className="py-5 lg:py-6">
        <AssignedTestsList tests={tests} locale={locale} />
        {STUDENT_LMS_WORKSPACE_V1 ? (
          <AssignedWorkList
            className="mt-4 rounded-control border border-outline-variant bg-surface p-3"
            headingId="assigned-homework-heading"
            work={classHomework}
            locale={locale}
            timezone={DEFAULT_CLASS_TIMEZONE}
            outstandingCount={outstandingHomework}
            heading={vi ? "Bài tập từ lớp học" : "Homework from your classes"}
            emptyTitle={
              vi ? "Chưa có bài tập nào" : "No homework assigned yet"
            }
            emptyBody={
              vi
                ? "Bài tập giáo viên giao cho lớp của bạn sẽ hiện ở đây."
                : "Work your teacher assigns to your class shows up here."
            }
          />
        ) : null}
      </PageContainer>
    </ProductPageShell>
  );
}
