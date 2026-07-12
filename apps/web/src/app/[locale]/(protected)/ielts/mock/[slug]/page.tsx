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
  searchParams: Promise<{ assignment?: string; returnTo?: string }>;
}) {
  const { locale, slug } = await params;
  const { assignment, returnTo } = await searchParams;
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
  const safeReturnTo =
    returnTo && returnTo.startsWith("/") && !returnTo.startsWith("//") && !returnTo.includes("://")
      ? returnTo
      : undefined;

  return (
    <main className="h-full min-h-0 w-full overflow-hidden">
      <MockTestPlayer
        structure={structure}
        assignmentId={assignmentId}
        returnHref={safeReturnTo}
        returnLabel={
          locale === "vi" ? "Xem kế hoạch đầu tiên" : "See your first plan"
        }
      />
    </main>
  );
}
