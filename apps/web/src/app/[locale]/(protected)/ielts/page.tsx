import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createTypedServerClient } from "@/lib/supabase/server";
import { getIeltsHomeData } from "@/lib/api/ielts/learner-repository";
import { IeltsHome } from "@/components/ielts/learner/IeltsHome";
import { StudentRouteSkeleton } from "@/components/shared/student-route-skeleton";
import { DEV_ADMIN_PROFILE } from "@/lib/dev-admin-bypass";
import { getDevAuthBypassUserFromServerContext } from "@/lib/dev-auth-bypass";

export const metadata = {
  title: "IELTS",
};

export const dynamic = "force-dynamic";

async function IeltsHomePayload() {
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

  const data = await getIeltsHomeData();
  const displayName =
    (user?.user_metadata?.display_name as string | undefined) ||
    user?.email?.split("@")[0] ||
    devAuthBypassUser?.email?.split("@")[0] ||
    DEV_ADMIN_PROFILE.display_name ||
    "there";

  return <IeltsHome data={data} displayName={displayName} />;
}

export default function IeltsHomePage() {
  return (
    <Suspense fallback={<StudentRouteSkeleton variant="dashboard" />}>
      <IeltsHomePayload />
    </Suspense>
  );
}
