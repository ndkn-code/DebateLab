import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { isDevAdminBypassEnabled } from "@/lib/dev-admin-bypass";

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

  if (!user) {
    if (devAdminBypass) {
      return (
        <div className="fixed inset-0 z-50 flex h-dvh w-screen flex-col overflow-hidden bg-background md:flex-row">
          <AdminSidebar />
          <main className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden">{children}</main>
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
        <div className="fixed inset-0 z-50 flex h-dvh w-screen flex-col overflow-hidden bg-background md:flex-row">
          <AdminSidebar />
          <main className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden">{children}</main>
        </div>
      );
    }

    redirect("/dashboard");
  }

  // Use fixed positioning to completely replace the parent layout's sidebar
  return (
    <div className="fixed inset-0 z-50 flex h-dvh w-screen flex-col overflow-hidden bg-background md:flex-row">
      <AdminSidebar />
      <main className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden">{children}</main>
    </div>
  );
}
