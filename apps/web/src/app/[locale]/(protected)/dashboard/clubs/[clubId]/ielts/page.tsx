import { notFound } from "next/navigation";
import { loadIeltsAssignmentsAdminPage } from "@/lib/api/ielts/assignment-manager-page";
import { IeltsAssignmentsManager } from "@/components/ielts/assignments/IeltsAssignmentsManager";
import styles from "@/components/ielts/ielts-v2.module.css";

export const metadata = { title: "IELTS mock assignments" };
export const dynamic = "force-dynamic";

export default async function ClubIeltsAssignmentsPage({
  params,
}: {
  params: Promise<{ clubId: string }>;
}) {
  const { clubId } = await params;
  const data = await loadIeltsAssignmentsAdminPage(clubId);
  if (!data) notFound();

  return (
    <main className={`${styles.root} mx-auto w-full max-w-5xl px-4 py-6`} data-ielts-v2="root">
      <IeltsAssignmentsManager
        clubId={data.clubId}
        clubName={data.clubName}
        classes={data.classes}
        tests={data.tests}
        assignments={data.assignments}
        classStudyPlans={data.classStudyPlans}
      />
    </main>
  );
}
