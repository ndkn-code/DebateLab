"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { ChevronDown, ChevronRight, GripVertical, Trash2, BookOpen, HelpCircle, Link2, PenLine, ArrowUpDown, Layers } from "lucide-react";
import { updateModule, deleteModule } from "@/app/actions/courses";
import type { AdminCourseModule, Activity, ActivityType } from "@/lib/types/admin";
import { ActivityItem } from "./ActivityItem";
import { AddActivityButton } from "./AddActivityButton";

interface Props {
  module: AdminCourseModule & { activities?: Activity[] };
  index: number;
  courseId: string;
}

export function ModuleItem({ module, index, courseId }: Props) {
  const t = useTranslations("admin.courses");
  const router = useRouter();
  const [expanded, setExpanded] = useState(true);
  const [title, setTitle] = useState(module.title);
  const [editing, setEditing] = useState(false);

  const handleTitleSave = async () => {
    setEditing(false);
    if (title !== module.title) {
      await updateModule(module.id, { title });
      router.refresh();
    }
  };

  const handleDelete = async () => {
    if (!confirm(t("confirmDeleteModule"))) return;
    await deleteModule(module.id);
    router.refresh();
  };

  return (
    <div className="rounded-2xl bg-surface-container-lowest border border-outline-variant/10 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3">
        <GripVertical className="h-4 w-4 text-on-surface-variant/40 shrink-0 cursor-grab" />
        <button onClick={() => setExpanded(!expanded)} className="shrink-0">
          {expanded ? <ChevronDown className="h-4 w-4 text-on-surface-variant" /> : <ChevronRight className="h-4 w-4 text-on-surface-variant" />}
        </button>
        <span className="text-xs font-bold text-primary bg-primary/10 rounded-md px-1.5 py-0.5 shrink-0">
          {index + 1}
        </span>
        {editing ? (
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleTitleSave}
            onKeyDown={(e) => e.key === "Enter" && handleTitleSave()}
            autoFocus
            className="flex-1 rounded-lg border border-primary/30 px-2 py-1 text-sm focus:outline-none"
          />
        ) : (
          <button onClick={() => setEditing(true)} className="flex-1 text-left text-sm font-medium text-on-surface hover:text-primary transition-colors truncate">
            {module.title}
          </button>
        )}
        {!expanded && (
          <span className="text-xs text-on-surface-variant">({(module.activities ?? []).length} activities)</span>
        )}
        <button onClick={handleDelete} className="p-1.5 rounded-lg hover:bg-red-50 text-on-surface-variant hover:text-red-600 transition-colors shrink-0">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {/* Activities */}
      {expanded && (
        <div className="border-t border-outline-variant/10">
          {(module.activities ?? []).length > 0 ? (
            <div className="divide-y divide-outline-variant/5">
              {(module.activities ?? []).map((act) => (
                <ActivityItem key={act.id} activity={act} />
              ))}
            </div>
          ) : (
            <div className="px-4 py-6 text-center text-sm text-on-surface-variant">
              No activities yet
            </div>
          )}
          <div className="px-4 py-3 border-t border-outline-variant/10">
            <AddActivityButton moduleId={module.id} />
          </div>
        </div>
      )}
    </div>
  );
}
