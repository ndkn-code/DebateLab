import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCourseLibraryData } from "@/lib/api/courses";
import { CourseListContent } from "@/components/courses/course-list-content";
import { ensureDevelopmentLibraryCourses } from "@/lib/seed/ensure-development-library-courses";

export const metadata = {
  title: "Courses",
};

export default async function CoursesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  await ensureDevelopmentLibraryCourses(user.id);
  const library = await getCourseLibraryData(user.id);

  return <CourseListContent library={library} />;
}
