import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/shared/sidebar";
import type { Profile } from "@/types/database";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url, role, onboarding_completed")
    .eq("id", user.id)
    .single();

  // Redirect to onboarding if profile missing or not completed
  if (!profile || !profile.onboarding_completed) {
    redirect("/onboarding");
  }

  return (
    <div className="flex min-h-screen flex-col bg-background md:flex-row">
      <Sidebar
        profile={profile as Profile | null}
        userEmail={user.email ?? null}
      />
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}
