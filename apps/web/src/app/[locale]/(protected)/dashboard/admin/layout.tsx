import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { isDevAdminBypassEnabled } from "@/lib/dev-admin-bypass";
import { getDevAuthBypassUserFromServerContext } from "@/lib/dev-auth-bypass";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const devAdminBypass = isDevAdminBypassEnabled();
  const devAuthBypassUser = user
    ? null
    : await getDevAuthBypassUserFromServerContext();

  if (!user) {
    if (devAdminBypass || devAuthBypassUser) {
      return (
        <div className="fixed inset-0 z-50 bg-background p-0 lg:p-4">
          <div className="flex h-full w-full flex-col overflow-hidden rounded-none border border-outline-variant bg-surface shadow-none lg:flex-row lg:rounded-[14px] lg:shadow-sm">
            <AdminSidebar />
            <main className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden bg-background">{children}</main>
          </div>
        </div>
      );
    }

    redirect("/auth/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") {
    if (devAdminBypass) {
      return (
        <div className="fixed inset-0 z-50 bg-background p-0 lg:p-4">
          <div className="flex h-full w-full flex-col overflow-hidden rounded-none border border-outline-variant bg-surface shadow-none lg:flex-row lg:rounded-[14px] lg:shadow-sm">
            <AdminSidebar />
            <main className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden bg-background">{children}</main>
          </div>
        </div>
      );
    }

    redirect("/dashboard");
  }

  // Use fixed positioning to completely replace the parent layout's sidebar
  return (
    <div className="fixed inset-0 z-50 bg-background p-0 lg:p-4">
      <div className="flex h-full w-full flex-col overflow-hidden rounded-none border border-outline-variant bg-surface shadow-none lg:flex-row lg:rounded-[14px] lg:shadow-sm">
        <AdminSidebar />
        <main className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden bg-background">{children}</main>
      </div>
    </div>
  );
}
