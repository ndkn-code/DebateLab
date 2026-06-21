import { Suspense } from "react";
import { getIeltsLearnPathData } from "@/lib/api/ielts/learn-path-repository";
import { LearnPathHome } from "@/components/ielts/learn/LearnPathHome";
import { StudentRouteSkeleton } from "@/components/shared/student-route-skeleton";
import { resolveIeltsLearnContext } from "./_resolve-user";

export const metadata = {
  title: "IELTS Learn",
};

export const dynamic = "force-dynamic";

async function LearnHomePayload() {
  const { userId, client } = await resolveIeltsLearnContext();
  const data = await getIeltsLearnPathData(userId, client);
  return <LearnPathHome path={data.path} />;
}

export default function IeltsLearnPage() {
  return (
    <Suspense fallback={<StudentRouteSkeleton variant="dashboard" />}>
      <LearnHomePayload />
    </Suspense>
  );
}
