import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCourseBySlug, getCourseReaderBySlug } from "@/lib/api/courses";
import { CourseDetailContent } from "@/components/courses/course-detail-content";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const course = await getCourseBySlug(slug);
  return { title: course?.title ?? "Course" };
}

export default async function CourseDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ lesson?: string | string[] }>;
}) {
  const { slug } = await params;
  const resolvedSearchParams = await searchParams;
  const lessonSlug = Array.isArray(resolvedSearchParams.lesson)
    ? resolvedSearchParams.lesson[0]
    : resolvedSearchParams.lesson;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") redirect("/dashboard");

  const course = await getCourseReaderBySlug(slug, user.id, lessonSlug);
  if (!course) notFound();

  return <CourseDetailContent course={course} />;
}
