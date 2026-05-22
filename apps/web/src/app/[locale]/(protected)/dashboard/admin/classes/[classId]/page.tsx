import { notFound } from "next/navigation";
import { ClassDetailDashboard } from "@/components/admin/classes/ClassDetailDashboard";
import { getAdminClassDetail } from "@/lib/api/admin-classes";

export const metadata = { title: "Admin - Class Detail" };

export default async function AdminClassDetailPage({
  params,
}: {
  params: Promise<{ classId: string }>;
}) {
  const { classId } = await params;
  const data = await getAdminClassDetail(classId);
  if (!data) notFound();

  return <ClassDetailDashboard data={data} />;
}
