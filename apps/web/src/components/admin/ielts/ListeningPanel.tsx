"use client";

/** Listening-section authoring (WS-1.1): script + accent + speakers (audio = WS-1.3). */
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Plus, Trash2 } from "@/components/ui/icons";
import {
  createListeningSectionAction,
  deleteListeningSectionAction,
  updateListeningSectionAction,
} from "@/app/actions/ielts";
import { parseSpeakers } from "@/lib/api/ielts/import/cells";
import { IELTS_ACCENTS } from "@/lib/api/ielts/schema";
import type { ListeningSection } from "@/lib/api/ielts/listening-repository";
import { Field, TextArea } from "./ielts-ui";

function speakersToText(value: unknown): string {
  if (!Array.isArray(value)) return "";
  return value
    .map((s) =>
      s && typeof s === "object"
        ? `${String((s as Record<string, unknown>).name ?? "")}-${String((s as Record<string, unknown>).accent ?? "uk")}`
        : "",
    )
    .filter(Boolean)
    .join(", ");
}

function SectionForm({
  testId,
  section,
  onClose,
}: {
  testId: string;
  section?: ListeningSection;
  onClose: () => void;
}) {
  const [sectionNumber, setSectionNumber] = useState(String(section?.section_number ?? 1));
  const [title, setTitle] = useState(section?.title ?? "");
  const [accent, setAccent] = useState(section?.accent ?? "uk");
  const [speakers, setSpeakers] = useState(speakersToText(section?.speakers));
  const [script, setScript] = useState(section?.script ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const payload = {
        sectionNumber: Number(sectionNumber),
        title: title || null,
        accent,
        speakers: parseSpeakers(speakers),
        script,
      };
      if (section) await updateListeningSectionAction(section.id, payload);
      else await createListeningSectionAction({ testId, ...payload });
      toast.success(section ? "Section updated" : "Section added");
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-4">
      <div className="grid gap-4 sm:grid-cols-[1fr_2fr_1fr]">
        <Field label="Section (1–4)">
          <Select value={sectionNumber} onChange={(e) => setSectionNumber(e.target.value)}>
            {[1, 2, 3, 4].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Context / title">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Field label="Primary accent">
          <Select value={accent} onChange={(e) => setAccent(e.target.value as ListeningSection["accent"])}>
            {IELTS_ACCENTS.map((a) => (
              <option key={a} value={a}>
                {a.toUpperCase()}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="Speakers & accents" hint="e.g. F-UK (caller), M-AUS (staff)">
        <Input value={speakers} onChange={(e) => setSpeakers(e.target.value)} />
      </Field>
      <Field label="Script" hint="Embed answers naturally with realistic distractors">
        <TextArea value={script} onChange={(e) => setScript(e.target.value)} rows={10} />
      </Field>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button variant="primary" onClick={save} disabled={saving}>
          {saving ? "Saving…" : section ? "Update" : "Add section"}
        </Button>
      </div>
    </div>
  );
}

export function ListeningPanel({
  testId,
  sections,
}: {
  testId: string;
  sections: ListeningSection[];
}) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  async function remove(section: ListeningSection) {
    if (!window.confirm(`Delete listening section ${section.section_number}?`)) return;
    try {
      await deleteListeningSectionAction(section.id, testId);
      toast.success("Section deleted");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Delete failed");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="type-body-sm text-on-surface-variant">{sections.length} section(s)</p>
        {!adding ? (
          <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
            <Plus className="h-4 w-4" /> Add section
          </Button>
        ) : null}
      </div>
      {adding ? <SectionForm testId={testId} onClose={() => setAdding(false)} /> : null}
      <div className="flex flex-col gap-3">
        {sections.map((section) =>
          editingId === section.id ? (
            <SectionForm
              key={section.id}
              testId={testId}
              section={section}
              onClose={() => setEditingId(null)}
            />
          ) : (
            <div
              key={section.id}
              className="flex items-start justify-between gap-3 rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-4"
            >
              <div className="min-w-0">
                <p className="type-title text-on-surface">
                  Section {section.section_number}
                  {section.title ? ` — ${section.title}` : ""}
                </p>
                <p className="type-caption text-on-surface-variant">{section.accent.toUpperCase()}</p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button variant="ghost" size="sm" onClick={() => setEditingId(section.id)}>
                  Edit
                </Button>
                <Button variant="ghost" size="icon-sm" onClick={() => remove(section)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          ),
        )}
      </div>
    </div>
  );
}
