"use client";

/**
 * Stimulus image picker for IELTS authoring: uploads through
 * `uploadIeltsQuestionMediaAction` (testId + file) and hands back the public
 * URL, which the author can also paste directly. The file control is a styled
 * button over a visually-hidden input (no browser-drawn control on screen).
 */
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ImagePlus, Loader2 } from "@/components/ui/icons";
import { uploadIeltsQuestionMediaAction } from "@/app/actions/ielts";
import { Field, InlineError } from "./ielts-ui";

export function ImageUploadField({
  testId,
  url,
  onUrlChange,
  label = "Image",
}: {
  testId: string;
  url: string;
  onUrlChange: (url: string) => void;
  label?: string;
}) {
  const inputId = useId();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.set("testId", testId);
      formData.set("file", file);
      const result = await uploadIeltsQuestionMediaAction(formData);
      if (result.ok) onUrlChange(result.url);
      else setError(result.error);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Field label={label} hint="Upload a PNG/JPG/WebP or paste a public URL">
        <div className="flex items-center gap-2">
          <Input
            value={url}
            onChange={(e) => onUrlChange(e.target.value)}
            placeholder="https://…"
            className="flex-1"
          />
          <input
            id={inputId}
            type="file"
            accept="image/*"
            className="sr-only"
            disabled={uploading}
            onChange={(e) => {
              void upload(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          <Button
            variant="outline"
            size="sm"
            disabled={uploading}
            onClick={() => document.getElementById(inputId)?.click()}
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
            {uploading ? "Uploading…" : "Upload"}
          </Button>
        </div>
      </Field>
      <InlineError message={error} />
    </div>
  );
}
