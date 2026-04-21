"use client";

import { useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";
import { ArrowLeft, Plus, Settings, Eye, EyeOff, ChevronDown, ChevronRight, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { updateCourse, createModule, togglePublish } from "@/app/actions/courses";
import type { AdminCourse, AdminCourseModule, Activity } from "@/lib/types/admin";
import { ModuleItem } from "./ModuleItem";

interface Props {
  course: AdminCourse & { modules: (AdminCourseModule & { activities: Activity[] })[] };
}

export function CourseEditor({ course: initialCourse }: Props) {
  const t = useTranslations("admin.courses");
  const router = useRouter();
  const [course, setCourse] = useState(initialCourse);
  const [infoOpen, setInfoOpen] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [title, setTitle] = useState(course.title);
  const [description, setDescription] = useState(course.description ?? "");
  const [addingModule, setAddingModule] = useState(false);
  const [newModuleTitle, setNewModuleTitle] = useState("");

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await updateCourse(course.id, { title, description });
      toast.success(t("courseSaved"));
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    }
    setSaving(false);
  }, [course.id, title, description, router, t]);

  const handleAddModule = async () => {
    if (addingModule) return;
    setAddingModule(true);
    setNewModuleTitle("");
  };

  const handleSaveNewModule = async () => {
    const name = newModuleTitle.trim() || `Module ${course.modules.length + 1}`;
    try {
      const mod = await createModule(course.id, name);
      toast.success("Module added!");
      setAddingModule(false);
      setNewModuleTitle("");
      // Optimistic update
      setCourse((prev) => ({
        ...prev,
        modules: [...prev.modules, { ...mod, activities: [] }],
      }));
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add module");
    }
  };

  const handleTogglePublish = async () => {
    setPublishing(true);
    try {
      await togglePublish(course.id);
      const newState = !course.is_published;
      toast.success(newState ? "Course published!" : "Course unpublished");
      setCourse((prev) => ({ ...prev, is_published: newState }));
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    }
    setPublishing(false);
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 space-y-6">
      {/* Top bar */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <Link
          href="/dashboard/admin/courses"
          className="flex items-center gap-1 text-sm text-on-surface-variant hover:text-on-surface transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("title")}
        </Link>
        <div className="flex items-center gap-2">
          <Link
            href={`/dashboard/courses/${course.id}?preview=1`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 rounded-xl border border-outline-variant/20 px-3 py-2 text-sm font-medium text-on-surface-variant hover:bg-surface-container transition-colors"
          >
            <ExternalLink className="h-4 w-4" />
            {t("preview")}
          </Link>
          <Link
            href={`/dashboard/admin/courses/${course.id}/settings`}
            className="flex items-center gap-1.5 rounded-xl border border-outline-variant/20 px-3 py-2 text-sm font-medium text-on-surface-variant hover:bg-surface-container transition-colors"
          >
            <Settings className="h-4 w-4" />
          </Link>
          <button
            onClick={handleTogglePublish}
            disabled={publishing}
            className="flex items-center gap-1.5 rounded-xl border border-outline-variant/20 px-3 py-2 text-sm font-medium text-on-surface-variant hover:bg-surface-container transition-colors disabled:opacity-50"
          >
            {publishing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : course.is_published ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
            {course.is_published ? t("unpublish") : t("publish")}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-on-primary hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {saving ? "Saving..." : "Save Changes"}
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

        {course.modules.length === 0 && !addingModule ? (
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

            {/* Inline new module input */}
            {addingModule && (
              <div className="rounded-2xl bg-surface-container-lowest border-2 border-primary/30 shadow-sm p-4">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-primary bg-primary/10 rounded-md px-1.5 py-0.5">
                    {course.modules.length + 1}
                  </span>
                  <input
                    value={newModuleTitle}
                    onChange={(e) => setNewModuleTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSaveNewModule();
                      if (e.key === "Escape") setAddingModule(false);
                    }}
                    placeholder="Module title..."
                    autoFocus
                    className="flex-1 rounded-lg border border-outline-variant/20 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                  <button
                    onClick={handleSaveNewModule}
                    className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-on-primary hover:bg-primary/90"
                  >
                    Add
                  </button>
                  <button
                    onClick={() => setAddingModule(false)}
                    className="rounded-lg px-3 py-1.5 text-xs font-medium text-on-surface-variant hover:bg-surface-container"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
