"use client";

/**
 * Group stimulus editor: kind picker (none / text / table / flowchart / image)
 * with a per-kind editor. Text and flow-chart steps carry `__BLANK_<slot>__`
 * markers (an "Insert blank" helper picks the next free slot); tables toggle
 * cells into gaps; images upload through the media action and place hotspots.
 */
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Plus, Trash2 } from "@/components/ui/icons";
import { promptBlankIds } from "@/lib/ielts/question-types/prompt";
import {
  STIMULUS_KINDS,
  appendBlankMarker,
  type StimulusKind,
  type StimulusState,
} from "./authoring-utils";
import { GroupTableEditor } from "./GroupTableEditor";
import { HotspotPlacer } from "./HotspotPlacer";
import { ImageUploadField } from "./ImageUploadField";
import { Field, TextArea } from "./ielts-ui";

interface Props {
  testId: string;
  value: StimulusState;
  onChange: (next: StimulusState) => void;
}

function TextStimulus({ value, set }: { value: StimulusState; set: (p: Partial<StimulusState>) => void }) {
  const slots = promptBlankIds(value.body);
  return (
    <>
      <Field label="Heading (optional)">
        <Input value={value.heading} onChange={(e) => set({ heading: e.target.value })} />
      </Field>
      <Field
        label="Body"
        hint={`Blanks: ${slots.length > 0 ? slots.join(", ") : "none yet"} — each __BLANK_<slot>__ is answered by the member with that slot`}
      >
        <TextArea value={value.body} onChange={(e) => set({ body: e.target.value })} rows={8} />
      </Field>
      <div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => set({ body: appendBlankMarker(value.body, slots) })}
        >
          <Plus className="h-4 w-4" /> Insert blank
        </Button>
      </div>
    </>
  );
}

function FlowchartStimulus({
  value,
  set,
}: {
  value: StimulusState;
  set: (p: Partial<StimulusState>) => void;
}) {
  const slots = value.steps.flatMap(promptBlankIds);
  const setStep = (index: number, text: string) =>
    set({ steps: value.steps.map((s, i) => (i === index ? text : s)) });
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-[1fr_10rem]">
        <Field label="Title (optional)">
          <Input value={value.title} onChange={(e) => set({ title: e.target.value })} />
        </Field>
        <Field label="Direction">
          <Select
            value={value.direction}
            onChange={(e) => set({ direction: e.target.value as "down" | "right" })}
          >
            <option value="down">Down</option>
            <option value="right">Right</option>
          </Select>
        </Field>
      </div>
      <div className="flex flex-col gap-2">
        <span className="type-label text-on-surface">Steps</span>
        {value.steps.map((step, index) => (
          <div key={index} className="flex items-start gap-2">
            <span className="w-6 shrink-0 pt-2 text-center type-caption text-on-surface-variant">
              {index + 1}
            </span>
            <TextArea
              value={step}
              onChange={(e) => setStep(index, e.target.value)}
              rows={2}
              aria-label={`Step ${index + 1}`}
            />
            <div className="flex shrink-0 flex-col gap-1">
              <Button
                variant="ghost"
                size="xs"
                onClick={() => setStep(index, appendBlankMarker(step, slots))}
              >
                Blank
              </Button>
              <Button
                variant="ghost"
                size="icon-xs"
                disabled={value.steps.length <= 1}
                onClick={() => set({ steps: value.steps.filter((_, i) => i !== index) })}
                aria-label="Remove step"
              >
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            </div>
          </div>
        ))}
        <div>
          <Button variant="outline" size="sm" onClick={() => set({ steps: [...value.steps, ""] })}>
            <Plus className="h-4 w-4" /> Step
          </Button>
        </div>
      </div>
    </>
  );
}

function ImageStimulus({
  testId,
  value,
  set,
}: {
  testId: string;
  value: StimulusState;
  set: (p: Partial<StimulusState>) => void;
}) {
  return (
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
      <HotspotPlacer
        url={value.url}
        alt={value.alt}
        hotspots={value.hotspots}
        onChange={(hotspots) => set({ hotspots })}
      />
    </>
  );
}

export function GroupStimulusEditor({ testId, value, onChange }: Props) {
  const set = (patch: Partial<StimulusState>) => onChange({ ...value, ...patch });
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-outline-variant p-3">
      <Field label="Stimulus" hint="The shared text / table / chart / image the members refer to">
        <Select value={value.kind} onChange={(e) => set({ kind: e.target.value as StimulusKind })}>
          {STIMULUS_KINDS.map((kind) => (
            <option key={kind.id} value={kind.id}>
              {kind.label}
            </option>
          ))}
        </Select>
      </Field>
      {value.kind === "text" ? <TextStimulus value={value} set={set} /> : null}
      {value.kind === "table" ? (
        <GroupTableEditor
          caption={value.caption}
          headers={value.headers}
          rows={value.rows}
          onChange={set}
        />
      ) : null}
      {value.kind === "flowchart" ? <FlowchartStimulus value={value} set={set} /> : null}
      {value.kind === "image" ? <ImageStimulus testId={testId} value={value} set={set} /> : null}
    </div>
  );
}
