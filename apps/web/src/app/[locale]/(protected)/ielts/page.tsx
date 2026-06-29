import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createTypedServerClient } from "@/lib/supabase/server";
import { createTypedAdminClient } from "@/lib/supabase/admin";
import { getIeltsHomeData } from "@/lib/api/ielts/learner-repository";
import { IeltsHome } from "@/components/ielts/learner/IeltsHome";
import { IeltsHomeSkeleton } from "@/components/ielts/learner/IeltsHomeSkeleton";
import { getDevAuthBypassUserFromServerContext } from "@/lib/dev-auth-bypass";

export const metadata = {
  title: "IELTS",
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

  if (!user && !devAuthBypassUser) {
    redirect("/auth/login");
  }

  const userId = user?.id ?? devAuthBypassUser?.id;
  if (!userId) {
    redirect("/auth/login");
  }

  return { user, devAuthBypassUser, userId };
}

async function IeltsHomePayload() {
  const { devAuthBypassUser, userId } = await resolveIeltsHomeUser();
  const data = await getIeltsHomeData(
    userId,
    devAuthBypassUser ? createTypedAdminClient() : undefined,
  );

  return <IeltsHome data={data} />;
}

export default function IeltsHomePage() {
  return (
    <Suspense fallback={<IeltsHomeSkeleton />}>
      <IeltsHomePayload />
    </Suspense>
  );
}
