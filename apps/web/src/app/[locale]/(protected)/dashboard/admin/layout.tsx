import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminV2Frame } from "@/components/admin/AdminV2Frame";

export default async function AdminLayout({
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
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") {
    redirect("/dashboard");
  }

  // Use fixed positioning to completely replace the parent layout's sidebar
  return (
    <div className="fixed inset-0 z-50 bg-background">
      <div className="flex h-full w-full flex-col overflow-hidden bg-surface lg:flex-row">
        <AdminSidebar />
        <main className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden bg-background">
          <AdminV2Frame className="min-h-full">{children}</AdminV2Frame>
        </main>
      </div>
    </div>
  );
}
