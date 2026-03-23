"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { Plus, BookOpen, HelpCircle, Link2, PenLine, ArrowUpDown, Layers } from "lucide-react";
import { toast } from "sonner";
import { createActivity } from "@/app/actions/courses";
import type { ActivityType } from "@/lib/types/admin";
import { getDefaultContent, getDefaultPhase } from "@/lib/activity/registry";

const ACTIVITY_TYPES: { type: ActivityType; icon: typeof BookOpen; labelKey: string }[] = [
  { type: "lesson", icon: BookOpen, labelKey: "lesson" },
  { type: "quiz", icon: HelpCircle, labelKey: "quiz" },
  { type: "matching", icon: Link2, labelKey: "matching" },
  { type: "fill_blank", icon: PenLine, labelKey: "fill_blank" },
  { type: "drag_order", icon: ArrowUpDown, labelKey: "drag_order" },
  { type: "flashcard", icon: Layers, labelKey: "flashcard" },
];

interface Props {
  moduleId: string;
}

export function AddActivityButton({ moduleId }: Props) {
  const t = useTranslations("admin.courses.activityTypes");
  const tc = useTranslations("admin.courses");
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const handleSelect = async (type: ActivityType) => {
    setOpen(false);
    try {
      const phase = getDefaultPhase(type);
      const content = getDefaultContent(type);

      await createActivity(moduleId, {
        activity_type: type,
        title: `New ${type.replace("_", " ")}`,
        phase,
        content,
      });
      toast.success("Activity added!");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add activity");
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-sm font-medium text-on-surface-variant hover:text-primary transition-colors"
      >
        <Plus className="h-4 w-4" />
        <span>{tc("addActivity")}</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 bottom-full mb-2 z-20 w-64 rounded-xl border border-outline-variant/20 bg-surface-container-lowest shadow-lg py-1">
            {ACTIVITY_TYPES.map(({ type, icon: Icon, labelKey }) => (
              <button
                key={type}
                onClick={() => handleSelect(type)}
                className="flex items-center gap-3 w-full px-3 py-2.5 text-sm text-left hover:bg-surface-container transition-colors"
              >
                <Icon className="h-4 w-4 text-on-surface-variant shrink-0" />
                <span className="text-on-surface">{t(labelKey)}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
