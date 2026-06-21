import { Suspense } from "react";
import type { User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { createTypedServerClient } from "@/lib/supabase/server";
import { createTypedAdminClient } from "@/lib/supabase/admin";
import { getIeltsHomeData } from "@/lib/api/ielts/learner-repository";
import { IeltsHome } from "@/components/ielts/learner/IeltsHome";
import { StudentRouteSkeleton } from "@/components/shared/student-route-skeleton";
import { DEV_ADMIN_PROFILE } from "@/lib/dev-admin-bypass";
import { getDevAuthBypassUserFromServerContext } from "@/lib/dev-auth-bypass";

export const metadata = {
  title: "IELTS",
};

export const dynamic = "force-dynamic";

type DevAuthBypassUser = {
  id: string;
  email: string | null;
};

function displayNameForIeltsHome({
  user,
  devAuthBypassUser,
}: {
  user: User | null;
  devAuthBypassUser: DevAuthBypassUser | null;
}) {
  return (
    (user?.user_metadata?.display_name as string | undefined) ||
    user?.email?.split("@")[0] ||
    devAuthBypassUser?.email?.split("@")[0] ||
    DEV_ADMIN_PROFILE.display_name ||
    "there"
  );
}

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
  const { user, devAuthBypassUser, userId } = await resolveIeltsHomeUser();
  const data = await getIeltsHomeData(
    userId,
    devAuthBypassUser ? createTypedAdminClient() : undefined,
  );

  return (
    <IeltsHome
      data={data}
      displayName={displayNameForIeltsHome({ user, devAuthBypassUser })}
    />
  );
}

export default function IeltsHomePage() {
  return (
    <Suspense fallback={<StudentRouteSkeleton variant="dashboard" />}>
      <IeltsHomePayload />
    </Suspense>
  );
}
