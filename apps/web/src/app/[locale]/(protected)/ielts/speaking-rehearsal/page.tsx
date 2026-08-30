import { getPublishedIeltsTests } from "@/lib/api/ielts/tests-repository";
import { toTestCard } from "@/lib/ielts/learner/library";
import { SpeakingRehearsalLibrary } from "@/components/ielts/speaking-rehearsal/SpeakingRehearsalLibrary";

export const metadata = {
  title: "IELTS Speaking Rehearsal",
};

export const dynamic = "force-dynamic";

export default async function IeltsSpeakingRehearsalPage() {
  const published = await getPublishedIeltsTests();
  const rehearsals = published
    .filter(
      (test) =>
        test.skill === "speaking" &&
        (test.kind === "skill_set" || test.kind === "drill"),
    )
    .map(toTestCard);

  return <SpeakingRehearsalLibrary tests={rehearsals} />;
}
