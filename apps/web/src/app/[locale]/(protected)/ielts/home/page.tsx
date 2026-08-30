import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createTypedServerClient } from "@/lib/supabase/server";
import { createTypedAdminClient } from "@/lib/supabase/admin";
import { getIeltsHomeData } from "@/lib/api/ielts/learner-repository";
import { loadActiveIeltsStudyPlan } from "@/lib/api/ielts/study-plan-repository";
import { IeltsHome } from "@/components/ielts/learner/IeltsHome";
import { IeltsHomeSkeleton } from "@/components/ielts/learner/IeltsHomeSkeleton";
import { getDevAuthBypassUserFromServerContext } from "@/lib/dev-auth-bypass";

export const metadata = {
  title: "IELTS home",
};

export const dynamic = "force-dynamic";

async function resolveIeltsHomeUser() {
  const supabase = await createTypedServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const devAuthBypassUser = user
    ? null
    : await getDevAuthBypassUserFromServerContext();

  if (!user && !devAuthBypassUser) redirect("/auth/login?next=/ielts/home");

  const userId = user?.id ?? devAuthBypassUser?.id;
  if (!userId) redirect("/auth/login?next=/ielts/home");

  return { supabase, devAuthBypassUser, userId };
}

async function IeltsHomePayload() {
  const { supabase, devAuthBypassUser, userId } = await resolveIeltsHomeUser();
  const ieltsClient = devAuthBypassUser ? createTypedAdminClient() : supabase;
  const activePlan = await loadActiveIeltsStudyPlan(userId, ieltsClient);
  if (!activePlan) redirect("/ielts/onboarding");

  const data = await getIeltsHomeData(userId, ieltsClient);
  return <IeltsHome data={data} />;
}

export default function IeltsHomePage() {
  return (
    <Suspense fallback={<IeltsHomeSkeleton />}>
      <IeltsHomePayload />
    </Suspense>
  );
}
