import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLessonBySlug } from "@/lib/api/courses";
import { LessonContent } from "@/components/courses/lesson-content";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; lessonSlug: string }>;
}) {
  const { slug, lessonSlug } = await params;
  const lesson = await getLessonBySlug(slug, lessonSlug);
  return { title: lesson?.title ?? "Lesson" };
}

export default async function LessonPage({
  params,
}: {
  params: Promise<{ slug: string; lessonSlug: string }>;
}) {
  const { slug, lessonSlug } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const lesson = await getLessonBySlug(slug, lessonSlug, user.id);
  if (!lesson) notFound();

  return <LessonContent lesson={lesson} courseSlug={slug} />;
}
