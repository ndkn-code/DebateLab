import { Suspense } from "react";
import { getIeltsLibraryData } from "@/lib/api/ielts/learner-repository";
import { IeltsTestLibrary } from "@/components/ielts/learner/IeltsTestLibrary";
import { StudentRouteSkeleton } from "@/components/shared/student-route-skeleton";

export const metadata = {
  title: "IELTS Tests",
};

export const dynamic = "force-dynamic";

async function IeltsTestsPayload() {
  const { tests } = await getIeltsLibraryData();
  return <IeltsTestLibrary tests={tests} />;
}

export default function IeltsTestsPage() {
  return (
    <Suspense fallback={<StudentRouteSkeleton variant="practice" />}>
      <IeltsTestsPayload />
    </Suspense>
  );
}
