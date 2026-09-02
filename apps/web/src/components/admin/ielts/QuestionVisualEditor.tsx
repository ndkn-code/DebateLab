"use client";

/**
 * `visual` editor for Writing Task 1 and labelling questions: none / image
 * (upload via the media action) / table / chart JSON / described.
 */
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ImageUploadField } from "./ImageUploadField";
import { Field, TextArea } from "./ielts-ui";
import type { VisualKind, VisualState } from "./question-form-state";

const KINDS: Array<{ id: VisualKind; label: string }> = [
  { id: "none", label: "None" },
  { id: "image", label: "Image (diagram / map / chart image)" },
  { id: "table", label: "Table" },
  { id: "chart", label: "Chart (JSON data)" },
  { id: "described", label: "Described in text" },
];

const CHART_HINT =
  '{ "chartType": "bar" | "line" | "area" | "pie", "title"?, "xAxisKey"?, "data": [{...}], "series": [{ "dataKey", "label" }] }';

export function QuestionVisualEditor({
  testId,
  value,
  onChange,
}: {
  testId: string;
  value: VisualState;
  onChange: (next: VisualState) => void;
}) {
  const set = (patch: Partial<VisualState>) => onChange({ ...value, ...patch });
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-outline-variant p-3">
      <Field label="Visual" hint="Labelling types need an image here or a group with an image stimulus">
        <Select value={value.kind} onChange={(e) => set({ kind: e.target.value as VisualKind })}>
          {KINDS.map((kind) => (
            <option key={kind.id} value={kind.id}>
              {kind.label}
            </option>
          ))}
        </Select>
      </Field>
      {value.kind === "image" ? (
        <>
          <ImageUploadField testId={testId} url={value.url} onUrlChange={(url) => set({ url })} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Alt text (required)">
              <Input value={value.alt} onChange={(e) => set({ alt: e.target.value })} />
            </Field>
            <Field label="Caption (optional)">
              <Input value={value.caption} onChange={(e) => set({ caption: e.target.value })} />
            </Field>
          </div>
          {value.url.trim() ? (
            // Stimulus lives in Supabase storage (no next/image remote pattern).
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={value.url}
              alt={value.alt || "Visual preview"}
              className="max-h-64 max-w-full rounded-xl border border-outline-variant"
            />
          ) : null}
        </>
      ) : null}
      {value.kind === "table" ? (
        <>
          <Field label="Headers" hint="Pipe-separated: Year | Sales | Profit">
            <Input value={value.headersLine} onChange={(e) => set({ headersLine: e.target.value })} />
          </Field>
          <Field label="Rows" hint="One row per line, cells pipe-separated">
            <TextArea value={value.rowsText} onChange={(e) => set({ rowsText: e.target.value })} rows={4} />
          </Field>
          <Field label="Caption (optional)">
            <Input value={value.caption} onChange={(e) => set({ caption: e.target.value })} />
          </Field>
        </>
      ) : null}
      {value.kind === "chart" ? (
        <Field label="Chart JSON" hint={CHART_HINT}>
          <TextArea
            value={value.chartJson}
            onChange={(e) => set({ chartJson: e.target.value })}
            rows={8}
            className="type-code"
          />
        </Field>
      ) : null}
      {value.kind === "described" ? (
        <Field label="Description" hint="Textual description of the data the candidate must report">
          <TextArea
            value={value.description}
            onChange={(e) => set({ description: e.target.value })}
            rows={4}
          />
        </Field>
      ) : null}
    </div>
  );
}
