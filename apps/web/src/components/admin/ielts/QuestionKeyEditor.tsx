"use client";

/**
 * Answer-key editor (the `ielts_question_keys` half of the form). Objective
 * items: one correct answer + variants, or — when the prompt carries two or
 * more `__BLANK_` markers — one row per blank id, submitted as a record.
 * Writing / Speaking: Band-9 model answer + per-criterion examiner notes.
 */
import { Input } from "@/components/ui/input";
import type { QuestionCategory } from "@/lib/api/ielts/question-schema";
import { promptBlankIds } from "@/lib/ielts/question-types/prompt";
import { Field, TextArea, type IeltsQuestionType } from "./ielts-ui";
import { NOTE_KEYS, NOTE_LABELS, type BlankKey, type KeyState } from "./question-form-state";

interface Props {
  type: IeltsQuestionType;
  category: QuestionCategory;
  prompt: string;
  value: KeyState;
  onChange: (next: KeyState) => void;
}

const ANSWER_HINT: Partial<Record<IeltsQuestionType, string>> = {
  mcq_multi: "Pipe-separate the correct option letters: B | D",
  true_false_notgiven: "TRUE / FALSE / NOT GIVEN",
  yes_no_notgiven: "YES / NO / NOT GIVEN",
  matching_headings: "Bank option id/letter for this statement",
  matching_information: "Paragraph letter",
  matching_features: "Bank option id/letter",
  matching_sentence_endings: "Bank option id/letter",
};

function BlankRows({
  blankIds,
  value,
  onChange,
}: {
  blankIds: string[];
  value: KeyState;
  onChange: (next: KeyState) => void;
}) {
  const setBlank = (id: string, patch: Partial<BlankKey>) =>
    onChange({
      ...value,
      blanks: {
        ...value.blanks,
        [id]: { ...(value.blanks[id] ?? { value: "", variants: "" }), ...patch },
      },
    });
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-[4rem_1fr_1fr] gap-2 px-0.5">
        <span className="type-caption text-on-surface-variant">Blank</span>
        <span className="type-caption text-on-surface-variant">Correct answer</span>
        <span className="type-caption text-on-surface-variant">Accept variants (pipe-separated)</span>
      </div>
      {blankIds.map((id) => {
        const blank = value.blanks[id] ?? { value: "", variants: "" };
        return (
          <div key={id} className="grid grid-cols-[4rem_1fr_1fr] items-center gap-2">
            <span className="rounded-md bg-surface-container px-2 py-1 text-center type-caption text-on-surface">
              {id}
            </span>
            <Input
              value={blank.value}
              onChange={(e) => setBlank(id, { value: e.target.value })}
              aria-label={`Answer for blank ${id}`}
            />
            <Input
              value={blank.variants}
              onChange={(e) => setBlank(id, { variants: e.target.value })}
              aria-label={`Variants for blank ${id}`}
            />
          </div>
        );
      })}
    </div>
  );
}

function ObjectiveKey({ type, prompt, value, onChange }: Omit<Props, "category">) {
  const blankIds = promptBlankIds(prompt);
  const set = (patch: Partial<KeyState>) => onChange({ ...value, ...patch });
  return (
    <>
      {blankIds.length >= 2 ? (
        <BlankRows blankIds={blankIds} value={value} onChange={onChange} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Correct answer" hint={ANSWER_HINT[type] ?? "Exact answer text"}>
            <Input value={value.single} onChange={(e) => set({ single: e.target.value })} />
          </Field>
          <Field label="Accept variants" hint="Pipe-separated alternatives">
            <Input value={value.variants} onChange={(e) => set({ variants: e.target.value })} />
          </Field>
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Explanation (EN)">
          <TextArea
            value={value.explanationEn}
            onChange={(e) => set({ explanationEn: e.target.value })}
            rows={2}
          />
        </Field>
        <Field label="Explanation (VI)">
          <TextArea
            value={value.explanationVi}
            onChange={(e) => set({ explanationVi: e.target.value })}
            rows={2}
          />
        </Field>
      </div>
    </>
  );
}

function RubricKey({
  category,
  value,
  onChange,
}: {
  category: "writing" | "speaking";
  value: KeyState;
  onChange: (next: KeyState) => void;
}) {
  const setNote = (name: string, text: string) =>
    onChange({ ...value, notes: { ...value.notes, [name]: text } });
  return (
    <>
      <Field label="Band-9 model answer / notes">
        <TextArea
          value={value.modelAnswer}
          onChange={(e) => onChange({ ...value, modelAnswer: e.target.value })}
          rows={5}
        />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        {NOTE_KEYS[category].map((name) => (
          <Field key={name} label={NOTE_LABELS[name] ?? name}>
            <Input value={value.notes[name] ?? ""} onChange={(e) => setNote(name, e.target.value)} />
          </Field>
        ))}
      </div>
    </>
  );
}

export function QuestionKeyEditor({ type, category, prompt, value, onChange }: Props) {
  if (category === "objective") {
    return <ObjectiveKey type={type} prompt={prompt} value={value} onChange={onChange} />;
  }
  return <RubricKey category={category} value={value} onChange={onChange} />;
}
