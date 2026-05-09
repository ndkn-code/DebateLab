import { ClassesDashboard } from "@/components/admin/classes/ClassesDashboard";
import { getAdminClassesPageData, getAdminClassSchedulesPageData } from "@/lib/api/admin-classes";

export const metadata = { title: "Admin - Classes" };

export default async function AdminClassesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = await searchParams;
  const [data, schedulesData] = await Promise.all([
    getAdminClassesPageData({ searchParams: resolvedSearchParams }),
    getAdminClassSchedulesPageData({ searchParams: resolvedSearchParams }),
  ]);

  return <ClassesDashboard data={data} schedulesData={schedulesData} />;
}
