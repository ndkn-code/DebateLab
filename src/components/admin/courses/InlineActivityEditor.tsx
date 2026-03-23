"use client";

import { useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";
import { toast } from "sonner";
import { updateActivity } from "@/app/actions/courses";
import { validateActivityContent } from "@/lib/activity/validators";
import type { Activity, ActivityPhase, ActivityContent } from "@/lib/types/admin";
import { LessonBuilder } from "./builders/LessonBuilder";
import { QuizBuilder } from "./builders/QuizBuilder";
import { MatchingBuilder } from "./builders/MatchingBuilder";
import { FillBlankBuilder } from "./builders/FillBlankBuilder";
import { DragOrderBuilder } from "./builders/DragOrderBuilder";
import { FlashcardBuilder } from "./builders/FlashcardBuilder";

interface Props {
  activity: Activity;
  onClose: () => void;
}

export function InlineActivityEditor({ activity, onClose }: Props) {
  const t = useTranslations("admin.courses.builders.common");
  const [title, setTitle] = useState(activity.title);
  const [phase, setPhase] = useState<ActivityPhase>(activity.phase);
  const [duration, setDuration] = useState(activity.duration_minutes);
  const [content, setContent] = useState<ActivityContent>(activity.content);
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const handleSave = useCallback(async () => {
    const validation = validateActivityContent(activity.activity_type, content);
    if (!validation.valid) {
      setErrors(validation.errors);
      return;
    }
    setErrors([]);
    setSaving(true);
    try {
      await updateActivity(activity.id, { title, phase, duration_minutes: duration, content });
      toast.success("Activity saved!");
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
      setErrors([err instanceof Error ? err.message : "Save failed"]);
    }
    setSaving(false);
  }, [activity.id, activity.activity_type, title, phase, duration, content, onClose]);

  const renderBuilder = () => {
    const props = { content, onChange: setContent };
    switch (activity.activity_type) {
      case "lesson": return <LessonBuilder {...props} />;
      case "quiz": return <QuizBuilder {...props} />;
      case "matching": return <MatchingBuilder {...props} />;
      case "fill_blank": return <FillBlankBuilder {...props} />;
      case "drag_order": return <DragOrderBuilder {...props} />;
      case "flashcard": return <FlashcardBuilder {...props} />;
    }
  };

  return (
    <div className="bg-primary/[0.02] border-l-2 border-primary px-4 py-4 space-y-4">
      {/* Header controls */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="flex-1 min-w-[200px] rounded-lg border border-outline-variant/20 px-3 py-1.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
        <select
          value={phase}
          onChange={(e) => setPhase(e.target.value as ActivityPhase)}
          className="rounded-lg border border-outline-variant/20 px-2 py-1.5 text-xs"
        >
          <option value="learn">Learn</option>
          <option value="practice">Practice</option>
          <option value="apply">Apply</option>
        </select>
        <div className="flex items-center gap-1">
          <input
            type="number"
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            min={1}
            max={60}
            className="w-14 rounded-lg border border-outline-variant/20 px-2 py-1.5 text-xs text-center"
          />
          <span className="text-xs text-on-surface-variant">min</span>
        </div>
        <span className="text-xs text-on-surface-variant bg-surface-container px-2 py-1 rounded-md">
          {activity.activity_type.replace("_", " ")}
        </span>
      </div>

      {/* Builder */}
      <div>{renderBuilder()}</div>

      {/* Errors */}
      {errors.length > 0 && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-3 py-2">
          <p className="text-xs font-medium text-red-700 mb-1">{t("validationErrors")}</p>
          <ul className="text-xs text-red-600 space-y-0.5">
            {errors.map((e, i) => <li key={i}>- {e}</li>)}
          </ul>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-2">
        <button
          onClick={onClose}
          className="rounded-xl px-4 py-2 text-sm font-medium text-on-surface-variant hover:bg-surface-container transition-colors"
        >
          {t("cancel")}
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-on-primary hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {saving ? t("saving") : t("save")}
        </button>
      </div>
    </div>
  );
}
