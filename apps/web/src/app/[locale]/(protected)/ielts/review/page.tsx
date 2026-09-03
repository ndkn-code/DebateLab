import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createTypedServerClient } from "@/lib/supabase/server";
import { getIeltsReviewPageData } from "@/lib/api/ielts/review-page-repository";
import { IeltsReviewSession } from "@/components/ielts/review/IeltsReviewSession";
import { StudentRouteSkeleton } from "@/components/shared/student-route-skeleton";

export const metadata = {
  title: "IELTS review",
};

export const dynamic = "force-dynamic";

async function IeltsReviewPayload() {
  const supabase = await createTypedServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const data = await getIeltsReviewPageData(user.id, supabase);

  return <IeltsReviewSession view={data.view} />;
}

export default function IeltsReviewPage() {
  return (
    <Suspense fallback={<StudentRouteSkeleton variant="dashboard" />}>
      <IeltsReviewPayload />
    </Suspense>
  );
}
