import { redirect } from "next/navigation";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { getCourseLibraryData } from "@/lib/api/courses";
import { CourseListContent } from "@/components/courses/course-list-content";
import { ensureDevelopmentLibraryCourses } from "@/lib/seed/ensure-development-library-courses";
import { StudentRouteSkeleton } from "@/components/shared/student-route-skeleton";
import { STUDENT_COURSES_ENABLED } from "@/lib/features";

export const metadata = {
  title: "Courses",
};

async function CoursesPayload() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  if (!STUDENT_COURSES_ENABLED) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    redirect(profile?.role === "admin" ? "/dashboard/admin/courses" : "/dashboard");
  }

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
