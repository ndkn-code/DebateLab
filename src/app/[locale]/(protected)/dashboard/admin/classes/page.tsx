import { ClassesDashboard } from "@/components/admin/classes/ClassesDashboard";
import { getAdminClassesPageData } from "@/lib/api/admin-classes";

export const metadata = { title: "Admin - Classes" };

export default async function AdminClassesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const data = await getAdminClassesPageData({
    searchParams: await searchParams,
  });

  return <ClassesDashboard data={data} />;
}
