import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCourses } from "@/lib/api/courses";
import { CourseListContent } from "@/components/courses/course-list-content";

export const metadata = {
  title: "Courses",
};

export default async function CoursesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const { courses, enrollments } = await getCourses(user.id);

  return <CourseListContent courses={courses} enrollments={enrollments} />;
}
