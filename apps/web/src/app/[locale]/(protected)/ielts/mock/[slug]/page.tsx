import { notFound } from "next/navigation";
import { getIeltsTestBySlug } from "@/lib/api/ielts/tests-repository";
import {
  loadAttemptState,
  loadMockStructure,
} from "@/lib/api/ielts/mock-repository";
import { isAssignmentStartableForTest } from "@/lib/api/ielts/learner-assignments-repository";
import { MockTestPlayer } from "@/components/ielts/MockTestPlayer";
import type { IeltsPlayerExperience } from "@/components/ielts/player-experience";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return { title: `IELTS Mock — ${slug}` };
}

function safeReturnPath(returnTo?: string) {
  return returnTo?.startsWith("/") && !returnTo.startsWith("//") && !returnTo.includes("://")
    ? returnTo
    : undefined;
}

function resolveExperience(
  experience: string | undefined,
  test: { skill: string | null; kind: string; assessment_mode: string },
): IeltsPlayerExperience {
  if (experience === "speaking_rehearsal" && test.skill === "speaking" &&
      (test.kind === "skill_set" || test.kind === "drill")) return "speaking_rehearsal";
  return test.assessment_mode === "simulation" ? "exam_simulation" : "guided_practice";
}

export default async function IeltsMockPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<{
    assignment?: string;
    returnTo?: string;
    attempt?: string;
    experience?: string;
  }>;
}) {
  const { locale, slug } = await params;
  const {
    assignment,
    returnTo,
    attempt: attemptId,
    experience,
  } = await searchParams;
  const test = await getIeltsTestBySlug(slug);
  if (!test) notFound();

  const resumed = attemptId ? await loadAttemptState(attemptId) : null;
  const structure =
    resumed?.structure?.test.id === test.id
      ? resumed.structure
      : await loadMockStructure(test.id);
  if (!structure) notFound();

  // Only thread the assignment through when it is genuinely the learner's active
  // assignment for THIS test — otherwise fall back to a self-serve sitting.
  const assignmentId =
    assignment && (await isAssignmentStartableForTest(assignment, test.id))
      ? assignment
      : undefined;
  const safeReturnTo = safeReturnPath(returnTo);
  const playerExperience = resolveExperience(experience, test);

  return (
    <main className="h-full min-h-0 w-full overflow-hidden">
      <MockTestPlayer
        structure={structure}
        experience={playerExperience}
        initialState={
          resumed?.structure?.test.id === test.id ? resumed : undefined
        }
        assignmentId={assignmentId}
        returnHref={safeReturnTo}
        returnLabel={
          locale === "vi" ? "Xem kế hoạch đầu tiên" : "See your first plan"
        }
      />
    </main>
  );
}
