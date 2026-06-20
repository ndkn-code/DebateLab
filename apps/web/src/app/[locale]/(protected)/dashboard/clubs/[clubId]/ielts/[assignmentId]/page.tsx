import { notFound } from "next/navigation";
import { getAssignmentResultsForManager } from "@/lib/api/ielts/assignment-results-repository";
import { IeltsAssignmentResultsView } from "@/components/ielts/assignments/IeltsAssignmentResultsView";

export const metadata = { title: "IELTS assignment results" };
export const dynamic = "force-dynamic";

export default async function ClubIeltsAssignmentResultsPage({
  params,
}: {
  params: Promise<{ clubId: string; assignmentId: string }>;
}) {
  const { clubId, assignmentId } = await params;
  const results = await getAssignmentResultsForManager(clubId, assignmentId);
  if (!results) notFound();

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6">
      <IeltsAssignmentResultsView clubId={clubId} results={results} />
    </main>
  );
}
