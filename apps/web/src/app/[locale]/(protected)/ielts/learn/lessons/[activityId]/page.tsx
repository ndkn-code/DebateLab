import { notFound } from "next/navigation";
import { getIeltsLearnLessonData } from "@/lib/api/ielts/learn-path-repository";
import { IeltsLessonPlayer } from "@/components/ielts/learn/IeltsLessonPlayer";
import { resolveIeltsLearnContext } from "../../_resolve-user";
import { startActivity } from "@/app/actions/activities";

export const dynamic = "force-dynamic";

export default async function IeltsLearnLessonPage({
  params,
}: {
  params: Promise<{ locale: string; activityId: string }>;
}) {
  const { activityId } = await params;
  const { userId, client } = await resolveIeltsLearnContext();
  const data = await getIeltsLearnLessonData(userId, activityId, client);
  if (!data) notFound();
  const attempt = await startActivity(data.activity.id);

  return (
    <IeltsLessonPlayer
      activityId={data.activity.id}
      attemptId={attempt.id}
      courseId={data.courseId}
      activityTitle={data.activity.title}
      activityType={data.activity.activityType}
      content={data.activity.content}
      estimatedMinutes={data.activity.estimatedMinutes}
      unitTitle={data.unit.title}
      pathHref={data.pathHref}
      unitHref={data.unitHref}
      nextLessonHref={data.nextLessonHref}
      subskillKeys={data.subskillKeys}
      beforeMastery={data.beforeMastery}
    />
  );
}
