"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { ArrowLeft, Globe, Crown, Lock, Unlock, X } from "lucide-react";
import { updateCourseVisibility, updateModuleAccessLevel } from "@/app/actions/courses";
import type { CourseVisibility, ModuleAccessLevel } from "@/lib/types/admin";
import { StudentAssignment } from "./StudentAssignment";

interface Props {
  course: { id: string; title: string; visibility: string };
  modules: { id: string; title: string; sort_order: number; access_level: string }[];
  initialStudents: { id: string; display_name: string; avatar_url: string | null; email: string | null }[];
}

export function CourseSettings({ course, modules, initialStudents }: Props) {
  const t = useTranslations("admin.courses");
  const tv = useTranslations("admin.courses.visibility");
  const router = useRouter();
  const [visibility, setVisibility] = useState<CourseVisibility>(course.visibility as CourseVisibility);
  const [saving, setSaving] = useState(false);

  const handleVisibilityChange = async (v: CourseVisibility) => {
    setVisibility(v);
    setSaving(true);
    await updateCourseVisibility(course.id, v);
    setSaving(false);
    router.refresh();
  };

  const handleModuleAccess = async (moduleId: string, level: ModuleAccessLevel) => {
    await updateModuleAccessLevel(moduleId, level);
    router.refresh();
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 space-y-6">
      <Link
        href={`/dashboard/admin/courses/${course.id}`}
        className="flex items-center gap-1 text-sm text-on-surface-variant hover:text-on-surface transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("editCourse")}
      </Link>

      <h1 className="text-xl font-bold text-on-surface">Settings: {course.title}</h1>

      {/* Visibility */}
      <div className="rounded-2xl bg-surface-container-lowest border border-outline-variant/10 p-5 shadow-sm space-y-4">
        <h2 className="font-semibold text-on-surface">{t("filterVisibility")}</h2>
        <div className="space-y-2">
          {([
            { value: "public" as const, icon: Globe, title: tv("publicTitle"), desc: tv("publicDesc") },
            { value: "premium" as const, icon: Crown, title: tv("premiumTitle"), desc: tv("premiumDesc") },
            { value: "class_restricted" as const, icon: Lock, title: tv("restrictedTitle"), desc: tv("restrictedDesc") },
          ]).map(({ value, icon: Icon, title, desc }) => (
            <button
              key={value}
              onClick={() => handleVisibilityChange(value)}
              className={`w-full flex items-start gap-3 rounded-xl border-2 p-3 text-left transition-all ${
                visibility === value
                  ? "border-primary bg-primary/5"
                  : "border-outline-variant/20 hover:border-outline-variant/40"
              }`}
            >
              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${visibility === value ? "bg-primary text-on-primary" : "bg-surface-container text-on-surface-variant"}`}>
                <Icon className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-medium text-on-surface">{title}</p>
                <p className="text-xs text-on-surface-variant">{desc}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Module Access */}
      {visibility !== "class_restricted" && modules.length > 0 && (
        <div className="rounded-2xl bg-surface-container-lowest border border-outline-variant/10 p-5 shadow-sm space-y-4">
          <h2 className="font-semibold text-on-surface">Module Access</h2>
          <div className="space-y-2">
            {modules.map((mod) => (
              <div key={mod.id} className="flex items-center justify-between rounded-xl border border-outline-variant/10 px-4 py-3">
                <span className="text-sm font-medium text-on-surface">
                  Module {mod.sort_order + 1}: {mod.title}
                </span>
                <select
                  value={mod.access_level}
                  onChange={(e) => handleModuleAccess(mod.id, e.target.value as ModuleAccessLevel)}
                  className="rounded-lg border border-outline-variant/20 px-2 py-1 text-xs"
                >
                  <option value="free">Free</option>
                  <option value="locked">Locked</option>
                  <option value="premium">Premium</option>
                </select>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Student assignment (only for class_restricted) */}
      {visibility === "class_restricted" && (
        <StudentAssignment courseId={course.id} initialStudents={initialStudents} />
      )}
    </div>
  );
}
