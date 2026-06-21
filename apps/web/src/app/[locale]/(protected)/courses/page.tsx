import { redirect } from "next/navigation";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { getCourseLibraryData } from "@/lib/api/courses";
import { CourseListContent } from "@/components/courses/course-list-content";
import { ensureDevelopmentLibraryCourses } from "@/lib/seed/ensure-development-library-courses";
import { StudentRouteSkeleton } from "@/components/shared/student-route-skeleton";
import { areStudentCoursesEnabled } from "@/lib/features";
import { getActiveSubject } from "@/lib/subject/server";
import { DEV_ADMIN_PROFILE } from "@/lib/dev-admin-bypass";
import { getDevAuthBypassUserFromServerContext } from "@/lib/dev-auth-bypass";
import { isEnrolledStudent } from "@/lib/ielts/enrollment";

export const metadata = {
  title: "Courses",
};

async function CoursesPayload() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const devAuthBypassUser = user
    ? null
    : await getDevAuthBypassUserFromServerContext();

  if (!user && !devAuthBypassUser) redirect("/auth/login");

  const activeUserId = user?.id ?? devAuthBypassUser?.id ?? DEV_ADMIN_PROFILE.id;
  const subject = await getActiveSubject();

  if (!areStudentCoursesEnabled(subject)) {
    const { data: profile } = user
      ? await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single()
      : { data: DEV_ADMIN_PROFILE };

    redirect(profile?.role === "admin" ? "/dashboard/admin/courses" : "/dashboard");
  }

  if (subject === "ielts" && !(await isEnrolledStudent(activeUserId))) {
    redirect("/ielts");
  }

  // Dev seed content is debate-only; never seed it into the IELTS surface.
  if (subject === "debate") {
    await ensureDevelopmentLibraryCourses(activeUserId);
  }
  const library = await getCourseLibraryData(activeUserId, subject);

  return <CourseListContent library={library} />;
}

export default function CoursesPage() {
  return (
    <Suspense fallback={<StudentRouteSkeleton variant="courses" />}>
      <CoursesPayload />
    </Suspense>
  );
}
