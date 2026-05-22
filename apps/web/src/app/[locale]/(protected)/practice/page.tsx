import { Suspense } from "react";
import { StudentRouteSkeleton } from "@/components/shared/student-route-skeleton";
import PracticeClient from "./practice-client";

export const metadata = {
  title: "Practice",
};

export default function PracticePage() {
  return (
    <Suspense fallback={<StudentRouteSkeleton variant="practice" />}>
      <PracticeClient />
    </Suspense>
  );
}
