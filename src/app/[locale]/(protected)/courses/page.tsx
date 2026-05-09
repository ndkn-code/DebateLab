import { redirect } from "next/navigation";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { getCourseLibraryData } from "@/lib/api/courses";
import { CourseListContent } from "@/components/courses/course-list-content";
import { ensureDevelopmentLibraryCourses } from "@/lib/seed/ensure-development-library-courses";
import { StudentRouteSkeleton } from "@/components/shared/student-route-skeleton";

export const metadata = {
  title: "Courses",
};

async function CoursesPayload() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  await ensureDevelopmentLibraryCourses(user.id);
  const library = await getCourseLibraryData(user.id);

  return <CourseListContent library={library} />;
}

export default function CoursesPage() {
  return (
    <Suspense fallback={<StudentRouteSkeleton variant="courses" />}>
      <CoursesPayload />
    </Suspense>
  );
}
