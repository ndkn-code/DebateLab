import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCourseBySlug } from "@/lib/api/courses";
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
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  // Courses are admin-only for now
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (!profile || profile.role !== "admin") redirect("/dashboard");

  const course = await getCourseBySlug(slug, user.id);
  if (!course) notFound();

  return <CourseDetailContent course={course} />;
}
