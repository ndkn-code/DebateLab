import { redirect } from "next/navigation";
import { areStudentCoursesEnabled } from "@/lib/features";
import { getActiveSubject } from "@/lib/subject/server";

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
  const subject = await getActiveSubject();
  if (!areStudentCoursesEnabled(subject)) {
    redirect(`/${locale}/dashboard`);
  }

  redirect(`/${locale}/courses/${slug}?lesson=${encodeURIComponent(lessonSlug)}`);
}
