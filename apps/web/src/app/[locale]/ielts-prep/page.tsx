import { redirect } from "next/navigation";

export default async function IeltsPrepPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect(`/${locale}/ielts`);
}
