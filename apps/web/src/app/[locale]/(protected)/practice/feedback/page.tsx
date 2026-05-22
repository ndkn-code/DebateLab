import { Suspense } from "react";
import { StudentRouteSkeleton } from "@/components/shared/student-route-skeleton";
import FeedbackClient from "./feedback-client";

export const metadata = {
  title: "Practice Feedback",
};

export default function FeedbackPage() {
  return (
    <Suspense fallback={<StudentRouteSkeleton variant="feedback" />}>
      <FeedbackClient />
    </Suspense>
  );
}
