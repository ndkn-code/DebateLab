import { redirect } from "next/navigation";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; lessonSlug: string }>;
}) {
  const { lessonSlug } = await params;
  return { title: lessonSlug ?? "Lesson" };
}

export default async function LessonPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string; lessonSlug: string }>;
}) {
  const { locale, slug, lessonSlug } = await params;
  redirect(`/${locale}/courses/${slug}?lesson=${encodeURIComponent(lessonSlug)}`);
}
