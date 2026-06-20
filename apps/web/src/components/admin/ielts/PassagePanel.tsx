"use client";

/** Reading-passage authoring (WS-1.1): list + inline create/edit + delete. */
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2 } from "@/components/ui/icons";
import {
  createPassageAction,
  deletePassageAction,
  updatePassageAction,
} from "@/app/actions/ielts";
import type { Passage } from "@/lib/api/ielts/passages-repository";
import { Field, TextArea } from "./ielts-ui";

function PassageForm({
  testId,
  passage,
  onClose,
}: {
  testId: string;
  passage?: Passage;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(passage?.title ?? "");
  const [body, setBody] = useState(passage?.body ?? "");
  const [genre, setGenre] = useState(passage?.genre ?? "");
  const [wordCount, setWordCount] = useState(passage?.word_count ? String(passage.word_count) : "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const payload = {
        title,
        body,
        genre: genre || null,
        wordCount: wordCount ? Number(wordCount) : null,
      };
      if (passage) await updatePassageAction(passage.id, payload);
      else await createPassageAction({ testId, ...payload });
      toast.success(passage ? "Passage updated" : "Passage added");
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-4">
      <div className="grid gap-4 sm:grid-cols-[2fr_1fr_1fr]">
        <Field label="Title">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Field label="Genre">
          <Input value={genre} onChange={(e) => setGenre(e.target.value)} />
        </Field>
        <Field label="Word count">
          <Input type="number" value={wordCount} onChange={(e) => setWordCount(e.target.value)} />
        </Field>
      </div>
      <Field label="Passage text" hint="≈700–900 words, academic register">
        <TextArea value={body} onChange={(e) => setBody(e.target.value)} rows={10} />
      </Field>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button variant="primary" onClick={save} disabled={saving}>
          {saving ? "Saving…" : passage ? "Update" : "Add passage"}
        </Button>
      </div>
    </div>
  );
}

export function PassagePanel({ testId, passages }: { testId: string; passages: Passage[] }) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  async function remove(passage: Passage) {
    if (!window.confirm(`Delete passage "${passage.title}"? Its questions are removed too.`)) return;
    try {
      await deletePassageAction(passage.id, testId);
      toast.success("Passage deleted");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Delete failed");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="type-body-sm text-on-surface-variant">{passages.length} passage(s)</p>
        {!adding ? (
          <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
            <Plus className="h-4 w-4" /> Add passage
          </Button>
        ) : null}
      </div>
      {adding ? <PassageForm testId={testId} onClose={() => setAdding(false)} /> : null}
      <div className="flex flex-col gap-3">
        {passages.map((passage) =>
          editingId === passage.id ? (
            <PassageForm
              key={passage.id}
              testId={testId}
              passage={passage}
              onClose={() => setEditingId(null)}
            />
          ) : (
            <div
              key={passage.id}
              className="flex items-start justify-between gap-3 rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-4"
            >
              <div className="min-w-0">
                <p className="type-title text-on-surface">{passage.title}</p>
                <p className="type-caption text-on-surface-variant">
                  {passage.genre ?? "—"} · {passage.word_count ?? "?"} words
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button variant="ghost" size="sm" onClick={() => setEditingId(passage.id)}>
                  Edit
                </Button>
                <Button variant="ghost" size="icon-sm" onClick={() => remove(passage)}>
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
