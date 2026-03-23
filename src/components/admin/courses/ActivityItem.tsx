"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { GripVertical, BookOpen, HelpCircle, Link2, PenLine, ArrowUpDown, Layers, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { deleteActivity } from "@/app/actions/courses";
import type { Activity, ActivityType, ActivityPhase } from "@/lib/types/admin";
import { InlineActivityEditor } from "./InlineActivityEditor";

const TYPE_ICONS: Record<ActivityType, typeof BookOpen> = {
  lesson: BookOpen, quiz: HelpCircle, matching: Link2,
  fill_blank: PenLine, drag_order: ArrowUpDown, flashcard: Layers,
};

const PHASE_COLORS: Record<ActivityPhase, string> = {
  learn: "bg-green-100 text-green-700",
  practice: "bg-amber-100 text-amber-700",
  apply: "bg-blue-100 text-blue-700",
};

interface Props {
  activity: Activity;
}

export function ActivityItem({ activity }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const Icon = TYPE_ICONS[activity.activity_type] ?? BookOpen;

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Delete this activity?")) return;
    setDeleting(true);
    try {
      await deleteActivity(activity.id);
      toast.success("Activity deleted");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
      setDeleting(false);
    }
  };

  if (editing) {
    return (
      <InlineActivityEditor
        activity={activity}
        onClose={() => { setEditing(false); router.refresh(); }}
      />
    );
  }

  return (
    <div
      className={`flex items-center gap-3 px-4 py-2.5 hover:bg-surface-container/50 cursor-pointer transition-colors group ${deleting ? "opacity-50" : ""}`}
      onClick={() => setEditing(true)}
    >
      <GripVertical className="h-3.5 w-3.5 text-on-surface-variant/30 shrink-0" />
      <Icon className="h-4 w-4 text-on-surface-variant shrink-0" />
      <span className="flex-1 text-sm text-on-surface truncate">{activity.title}</span>
      {activity.phase && (
        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md shrink-0 ${PHASE_COLORS[activity.phase]}`}>
          {activity.phase}
        </span>
      )}
      <span className="text-xs text-on-surface-variant shrink-0">{activity.duration_minutes}m</span>
      <button
        onClick={handleDelete}
        disabled={deleting}
        className="p-1 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-50 text-on-surface-variant hover:text-red-600 transition-all shrink-0"
      >
        {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}
