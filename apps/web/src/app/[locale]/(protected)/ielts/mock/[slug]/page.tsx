import { notFound } from "next/navigation";
import { getIeltsTestBySlug } from "@/lib/api/ielts/tests-repository";
import { loadMockStructure } from "@/lib/api/ielts/mock-repository";
import { isAssignmentStartableForTest } from "@/lib/api/ielts/learner-assignments-repository";
import { MockTestPlayer } from "@/components/ielts/MockTestPlayer";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return { title: `IELTS Mock — ${slug}` };
}

export default async function IeltsMockPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<{ assignment?: string }>;
}) {
  const { slug } = await params;
  const { assignment } = await searchParams;
  const test = await getIeltsTestBySlug(slug);
  if (!test) notFound();

  const structure = await loadMockStructure(test.id);
  if (!structure) notFound();

  // Only thread the assignment through when it is genuinely the learner's active
  // assignment for THIS test — otherwise fall back to a self-serve sitting.
  const assignmentId =
    assignment && (await isAssignmentStartableForTest(assignment, test.id))
      ? assignment
      : undefined;

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6">
      <MockTestPlayer structure={structure} assignmentId={assignmentId} />
    </main>
  );
}
