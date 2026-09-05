import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import type { TeacherWorkspaceSurface } from "@/lib/teacher-workspace/presentation";
import { TeacherWorkspaceRoute } from "../teacher-workspace-route";

const SURFACES = new Set<TeacherWorkspaceSurface>([
  "calendar",
  "classes",
  "review-queue",
  "assignments",
  "gradebook",
  "attendance",
  "materials",
  "announcements",
  "organization",
  "people",
  "curriculum",
  "reports",
]);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; surface: string }>;
}) {
  const { locale, surface } = await params;
  const t = await getTranslations({ locale, namespace: "dashboard.nav" });
  return {
    title: SURFACES.has(surface as TeacherWorkspaceSurface)
      ? t(`teacherLinks.${surface.replace("-", "_")}`)
      : t("teacherWorkspace"),
  };
}

export default async function TeacherWorkspaceSurfacePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; surface: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolved = await params;
  if (!SURFACES.has(resolved.surface as TeacherWorkspaceSurface)) notFound();
  return (
    <TeacherWorkspaceRoute
      params={Promise.resolve({ locale: resolved.locale })}
      searchParams={searchParams}
      surface={resolved.surface as TeacherWorkspaceSurface}
    />
  );
}
