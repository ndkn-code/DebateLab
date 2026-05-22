import { Suspense } from "react";
import { StudentRouteSkeleton } from "@/components/shared/student-route-skeleton";
import { getActivePracticeTopics } from "@/lib/practice-topics/catalog";
import { coercePracticeLanguage } from "@/lib/practice-language";
import PracticeClient from "./practice-client";

export const metadata = {
  title: "Practice",
};

export const dynamic = "force-dynamic";

async function PracticePayload({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const practiceLanguage = coercePracticeLanguage(locale);
  const initialTopics = await getActivePracticeTopics(practiceLanguage, {
    allowAdminFallback: true,
  });

  return <PracticeClient initialTopics={initialTopics} />;
}

export default function PracticePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  return (
    <Suspense fallback={<StudentRouteSkeleton variant="practice" />}>
      <PracticePayload params={params} />
    </Suspense>
  );
}
