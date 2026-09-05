"use client";

import { useLocale, useTranslations } from "next-intl";
import { BookOpen } from "@/components/ui/icons";
import { Link } from "@/i18n/navigation";

const COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
];

interface Props {
  courses: { course_id: string; title: string; enrollment_count: number }[];
}

export function PopularCoursesList({ courses }: Props) {
  const locale = useLocale();
  const t = useTranslations("admin.overview");

  return (
    <div className="rounded-control border border-outline-variant bg-surface p-4">
      <h3 className="mb-3 type-label font-semibold text-on-surface">
        {t("popularCourses")}
      </h3>
      {courses.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-on-surface-variant">
          <BookOpen className="h-8 w-8 mb-2 opacity-40" />
          <p className="text-sm">{t("noData")}</p>
        </div>
      ) : (
        <div className="divide-y divide-outline-variant">
          {courses.map((course, i) => (
            <Link
              key={course.course_id}
              href={`/dashboard/admin/courses/${course.course_id}`}
              className="flex min-h-10 items-center gap-3 rounded-control px-2 py-1 transition-colors hover:bg-surface-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-on-primary text-xs font-bold"
                style={{ backgroundColor: COLORS[i % COLORS.length] }}
              >
                {course.title[0]?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-on-surface truncate">
                  {course.title}
                </p>
              </div>
              <span className="text-sm font-semibold text-on-surface-variant">
                {course.enrollment_count.toLocaleString(locale)}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
