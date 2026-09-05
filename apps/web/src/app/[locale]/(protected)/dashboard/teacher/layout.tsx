import { getTranslations } from "next-intl/server";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "dashboard.nav" });
  return { title: t("teacherWorkspace") };
}

export default function TeacherNavigationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
