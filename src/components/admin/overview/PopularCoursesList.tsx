"use client";

import { useTranslations } from "next-intl";
import { BookOpen } from "lucide-react";
import { Link } from "@/i18n/navigation";

const COLORS = ["#2f4fdd", "#7c3aed", "#059669", "#d97706", "#dc2626"];

interface Props {
  courses: { course_id: string; title: string; enrollment_count: number }[];
}

export function PopularCoursesList({ courses }: Props) {
  const t = useTranslations("admin.overview");

  return (
    <div className="rounded-2xl bg-surface-container-lowest border border-outline-variant/10 p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-on-surface mb-4">{t("popularCourses")}</h3>
      {courses.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-on-surface-variant">
          <BookOpen className="h-8 w-8 mb-2 opacity-40" />
          <p className="text-sm">{t("noData")}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {courses.map((course, i) => (
            <Link
              key={course.course_id}
              href={`/dashboard/admin/courses/${course.course_id}`}
              className="flex items-center gap-3 rounded-xl p-2 hover:bg-surface-container transition-colors"
            >
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white text-xs font-bold"
                style={{ backgroundColor: COLORS[i % COLORS.length] }}
              >
                {course.title[0]?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-on-surface truncate">{course.title}</p>
              </div>
              <span className="text-sm font-semibold text-on-surface-variant">
                {course.enrollment_count.toLocaleString()}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
