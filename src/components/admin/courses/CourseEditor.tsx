"use client";

import { useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";
import { ArrowLeft, Plus, Settings, Eye, EyeOff, ChevronDown, ChevronRight } from "lucide-react";
import { updateCourse, createModule, togglePublish } from "@/app/actions/courses";
import type { AdminCourse, AdminCourseModule, Activity } from "@/lib/types/admin";
import { ModuleItem } from "./ModuleItem";
import { AddActivityButton } from "./AddActivityButton";

interface Props {
  course: AdminCourse & { modules: (AdminCourseModule & { activities: Activity[] })[] };
}

export function CourseEditor({ course: initialCourse }: Props) {
  const t = useTranslations("admin.courses");
  const router = useRouter();
  const [course, setCourse] = useState(initialCourse);
  const [infoOpen, setInfoOpen] = useState(true);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState(course.title);
  const [description, setDescription] = useState(course.description ?? "");

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await updateCourse(course.id, { title, description });
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Save failed");
    }
    setSaving(false);
  }, [course.id, title, description, router]);

  const handleAddModule = async () => {
    const name = prompt(t("moduleName"), `Module ${course.modules.length + 1}`);
    if (!name) return;
    await createModule(course.id, name);
    router.refresh();
  };

  const handleTogglePublish = async () => {
    try {
      await togglePublish(course.id);
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error");
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 space-y-6">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <Link
          href="/dashboard/admin/courses"
          className="flex items-center gap-1 text-sm text-on-surface-variant hover:text-on-surface transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("title")}
        </Link>
        <div className="flex items-center gap-2">
          <Link
            href={`/dashboard/admin/courses/${course.id}/settings`}
            className="flex items-center gap-1.5 rounded-xl border border-outline-variant/20 px-3 py-2 text-sm font-medium text-on-surface-variant hover:bg-surface-container transition-colors"
          >
            <Settings className="h-4 w-4" />
          </Link>
          <button
            onClick={handleTogglePublish}
            className="flex items-center gap-1.5 rounded-xl border border-outline-variant/20 px-3 py-2 text-sm font-medium text-on-surface-variant hover:bg-surface-container transition-colors"
          >
            {course.is_published ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {course.is_published ? t("unpublish") : t("publish")}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-on-primary hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {saving ? "..." : t("courseSaved").replace("saved", "Save")}
          </button>
        </div>
      </div>

      {/* Course info (collapsible) */}
      <div className="rounded-2xl bg-surface-container-lowest border border-outline-variant/10 shadow-sm overflow-hidden">
        <button
          onClick={() => setInfoOpen(!infoOpen)}
          className="flex items-center justify-between w-full px-5 py-4 text-left"
        >
          <span className="font-semibold text-on-surface">{t("editCourse")}</span>
          {infoOpen ? <ChevronDown className="h-4 w-4 text-on-surface-variant" /> : <ChevronRight className="h-4 w-4 text-on-surface-variant" />}
        </button>
        {infoOpen && (
          <div className="px-5 pb-5 space-y-4 border-t border-outline-variant/10 pt-4">
            <div>
              <label className="block text-sm font-medium text-on-surface mb-1">Title</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-xl border border-outline-variant/20 bg-surface-container-lowest px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-on-surface mb-1">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full rounded-xl border border-outline-variant/20 bg-surface-container-lowest px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
              />
            </div>
          </div>
        )}
      </div>

      {/* Modules */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-on-surface">Modules</h2>
          <button
            onClick={handleAddModule}
            className="flex items-center gap-1.5 rounded-xl border border-dashed border-outline-variant/30 px-3 py-2 text-sm font-medium text-on-surface-variant hover:bg-surface-container hover:border-primary/30 transition-all"
          >
            <Plus className="h-4 w-4" />{t("addModule")}
          </button>
        </div>

        {course.modules.length === 0 ? (
          <div className="text-center py-12 text-on-surface-variant">
            <p className="text-sm">No modules yet. Add your first module to get started.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {course.modules.map((mod, idx) => (
              <ModuleItem
                key={mod.id}
                module={mod}
                index={idx}
                courseId={course.id}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
