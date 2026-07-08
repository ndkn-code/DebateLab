"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { FileText, Loader2, Plus, Save } from "@/components/ui/icons";
import { createClubAssignment } from "@/app/actions/admin-clubs";
import { showToast } from "@/components/shared/toast";
import type { AdminClassListRow } from "@/lib/types/admin-classes";

const FIELD =
  "min-h-10 w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm text-on-surface outline-none focus:border-primary disabled:opacity-60";
const DEFAULT_ALLOWED_EXT = "pdf, doc, docx, png, jpg, jpeg, mp3, m4a, wav";

export function ClubHomeworkAssignForm({
  clubId,
  cohorts,
}: {
  clubId: string;
  cohorts: AdminClassListRow[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [classId, setClassId] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [requiredAttempts, setRequiredAttempts] = useState(1);
  const [textEnabled, setTextEnabled] = useState(true);
  const [filesEnabled, setFilesEnabled] = useState(true);
  const [maxFiles, setMaxFiles] = useState(3);
  const [maxFileMb, setMaxFileMb] = useState(10);
  const [allowedExt, setAllowedExt] = useState(DEFAULT_ALLOWED_EXT);
  const [instructions, setInstructions] = useState("");
  const [isPending, startTransition] = useTransition();

  function reset() {
    setTitle("");
    setDescription("");
    setClassId("");
    setDueAt("");
    setRequiredAttempts(1);
    setTextEnabled(true);
    setFilesEnabled(true);
    setMaxFiles(3);
    setMaxFileMb(10);
    setAllowedExt(DEFAULT_ALLOWED_EXT);
    setInstructions("");
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      try {
        await createClubAssignment({
          clubId,
          classId: classId || null,
          title,
          description: description || null,
          assignmentType: "case",
          assignedTrack: "debate",
          dueAt: dueAt || null,
          requiredAttempts,
          submissionTextEnabled: textEnabled,
          submissionFilesEnabled: filesEnabled,
          submissionMaxFiles: filesEnabled ? maxFiles : 0,
          submissionMaxFileMb: maxFileMb,
          submissionAllowedExt: allowedExt
            .split(",")
            .map((ext) => ext.trim())
            .filter(Boolean),
          submissionInstructions: instructions || null,
        });
        showToast("Assignment created.", "success");
        reset();
        setOpen(false);
        router.refresh();
      } catch (error) {
        showToast(error instanceof Error ? error.message : "Unable to create assignment.", "error");
      }
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-10 items-center gap-2 rounded-lg bg-surface-container-high px-4 text-sm font-bold text-on-surface shadow-sm"
      >
        <Plus className="h-4 w-4" />
        Create homework
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-outline-variant bg-surface-container-lowest p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-bold text-on-surface">Create Homework</h2>
        <FileText className="h-5 w-5 text-on-surface-variant" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <label>
          <span className="text-xs font-bold uppercase text-on-surface-variant">Title</span>
          <input value={title} onChange={(event) => setTitle(event.target.value)} className={FIELD} required />
        </label>
        <label>
          <span className="text-xs font-bold uppercase text-on-surface-variant">Cohort</span>
          <select value={classId} onChange={(event) => setClassId(event.target.value)} className={FIELD}>
            <option value="">Whole club</option>
            {cohorts.map((cohort) => (
              <option key={cohort.id} value={cohort.id}>
                {cohort.title}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="text-xs font-bold uppercase text-on-surface-variant">Due</span>
          <input type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} className={FIELD} />
        </label>
        <label>
          <span className="text-xs font-bold uppercase text-on-surface-variant">Required submissions</span>
          <input
            type="number"
            min={1}
            value={requiredAttempts}
            onChange={(event) => setRequiredAttempts(Number(event.target.value))}
            className={FIELD}
          />
        </label>
      </div>

      <label className="mt-4 block">
        <span className="text-xs font-bold uppercase text-on-surface-variant">Description</span>
        <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} className={FIELD} />
      </label>

      <label className="mt-4 block">
        <span className="text-xs font-bold uppercase text-on-surface-variant">Instructions</span>
        <textarea value={instructions} onChange={(event) => setInstructions(event.target.value)} rows={3} className={FIELD} />
      </label>

      <div className="mt-4 grid gap-4 lg:grid-cols-[220px_220px_minmax(0,1fr)]">
        <label className="flex items-center gap-3 rounded-lg border border-outline-variant bg-background p-3 text-sm font-bold text-on-surface">
          <input type="checkbox" checked={textEnabled} onChange={(event) => setTextEnabled(event.target.checked)} />
          Text response
        </label>
        <label className="flex items-center gap-3 rounded-lg border border-outline-variant bg-background p-3 text-sm font-bold text-on-surface">
          <input type="checkbox" checked={filesEnabled} onChange={(event) => setFilesEnabled(event.target.checked)} />
          File upload
        </label>
        <label>
          <span className="text-xs font-bold uppercase text-on-surface-variant">Allowed extensions</span>
          <input value={allowedExt} onChange={(event) => setAllowedExt(event.target.value)} className={FIELD} />
        </label>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label>
          <span className="text-xs font-bold uppercase text-on-surface-variant">Max files</span>
          <input
            type="number"
            min={0}
            max={20}
            value={maxFiles}
            onChange={(event) => setMaxFiles(Number(event.target.value))}
            disabled={!filesEnabled}
            className={FIELD}
          />
        </label>
        <label>
          <span className="text-xs font-bold uppercase text-on-surface-variant">Max file MB</span>
          <input
            type="number"
            min={1}
            max={50}
            value={maxFileMb}
            onChange={(event) => setMaxFileMb(Number(event.target.value))}
            disabled={!filesEnabled}
            className={FIELD}
          />
        </label>
      </div>

      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="inline-flex h-10 items-center rounded-lg border border-outline-variant bg-surface-container-lowest px-4 text-sm font-bold text-on-surface"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isPending || !title.trim() || (!textEnabled && !filesEnabled)}
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-bold text-on-primary disabled:opacity-60"
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save
        </button>
      </div>
    </form>
  );
}
