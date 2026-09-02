"use client";

/**
 * Typed-metadata fields of the question form: slot / number span / select
 * count / allow-number / max points, matching `items`, the Speaking Part 2 cue
 * card, and the General Training Task 1 letter brief. Only the fields relevant
 * to the selected question type are rendered.
 */
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { LETTER_REGISTERS, type IeltsLetterRegister } from "@/lib/ielts/question-types/metadata";
import type { QuestionCategory } from "@/lib/api/ielts/question-schema";
import { Field, TextArea, type IeltsQuestionType } from "./ielts-ui";
import { COMPLETION_TYPES, MATCHING_TYPES, type AdvancedState } from "./question-form-state";

const REGISTER_LABEL: Record<IeltsLetterRegister, string> = {
  formal: "Formal",
  semi_formal: "Semi-formal",
  informal: "Informal",
};

interface Props {
  type: IeltsQuestionType;
  category: QuestionCategory;
  value: AdvancedState;
  onChange: (next: AdvancedState) => void;
}

function ObjectiveMeta({ type, value, set }: { type: IeltsQuestionType; value: AdvancedState; set: (p: Partial<AdvancedState>) => void }) {
  return (
    <div className="grid gap-3 sm:grid-cols-4">
      <Field label="Slot" hint="Blank / hotspot id in the group">
        <Input value={value.slot} onChange={(e) => set({ slot: e.target.value })} placeholder="auto" />
      </Field>
      <Field label="Max points" hint="Default 1">
        <Input
          type="number"
          value={value.maxPoints}
          onChange={(e) => set({ maxPoints: e.target.value })}
          placeholder="1"
        />
      </Field>
      {type === "mcq_multi" ? (
        <>
          <Field label="Select count" hint="Choose N letters">
            <Input
              type="number"
              value={value.selectCount}
              onChange={(e) => set({ selectCount: e.target.value })}
            />
          </Field>
          <Field label="Number span" hint="Occupies N question numbers; max points must match">
            <Input
              type="number"
              value={value.numberSpan}
              onChange={(e) => set({ numberSpan: e.target.value })}
            />
          </Field>
        </>
      ) : null}
      {COMPLETION_TYPES.has(type) ? (
        <Field label="Numbers allowed" hint="AND/OR A NUMBER">
          <Select
            value={value.allowNumber}
            onChange={(e) => set({ allowNumber: e.target.value as AdvancedState["allowNumber"] })}
          >
            <option value="">From instructions</option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </Select>
        </Field>
      ) : null}
    </div>
  );
}

function CueCardFields({ value, set }: { value: AdvancedState; set: (p: Partial<AdvancedState>) => void }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-outline-variant p-3">
      <span className="type-label text-on-surface">Cue card</span>
      <Field label="Topic" hint="Describe a time when…">
        <Input value={value.cueTopic} onChange={(e) => set({ cueTopic: e.target.value })} />
      </Field>
      <Field label="You should say (one bullet per line, 1–6)">
        <TextArea value={value.cueBullets} onChange={(e) => set({ cueBullets: e.target.value })} rows={4} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-[1fr_8rem_8rem]">
        <Field label="Closing line (optional)" hint="and explain why…">
          <Input value={value.cueClosing} onChange={(e) => set({ cueClosing: e.target.value })} />
        </Field>
        <Field label="Prep seconds">
          <Input type="number" value={value.cuePrep} onChange={(e) => set({ cuePrep: e.target.value })} />
        </Field>
        <Field label="Speak seconds">
          <Input type="number" value={value.cueSpeak} onChange={(e) => set({ cueSpeak: e.target.value })} />
        </Field>
      </div>
    </div>
  );
}

function LetterFields({ value, set }: { value: AdvancedState; set: (p: Partial<AdvancedState>) => void }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-outline-variant p-3">
      <span className="type-label text-on-surface">Letter brief</span>
      <div className="grid gap-3 sm:grid-cols-[1fr_10rem]">
        <Field label="Recipient" hint="e.g. your landlord">
          <Input
            value={value.letterRecipient}
            onChange={(e) => set({ letterRecipient: e.target.value })}
          />
        </Field>
        <Field label="Register">
          <Select
            value={value.letterRegister}
            onChange={(e) => set({ letterRegister: e.target.value as IeltsLetterRegister })}
          >
            {LETTER_REGISTERS.map((register) => (
              <option key={register} value={register}>
                {REGISTER_LABEL[register]}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="In your letter (one bullet per line, 1–5)">
        <TextArea
          value={value.letterBullets}
          onChange={(e) => set({ letterBullets: e.target.value })}
          rows={3}
        />
      </Field>
    </div>
  );
}

export function QuestionFormAdvanced({ type, category, value, onChange }: Props) {
  const set = (patch: Partial<AdvancedState>) => onChange({ ...value, ...patch });
  return (
    <>
      {category === "objective" ? <ObjectiveMeta type={type} value={value} set={set} /> : null}
      {MATCHING_TYPES.has(type) ? (
        <Field
          label="Statements to match (one per line)"
          hint="`id | label | text` or `id | text`; the correct answer is the bank option id/letter for this statement"
        >
          <TextArea value={value.itemsText} onChange={(e) => set({ itemsText: e.target.value })} rows={3} />
        </Field>
      ) : null}
      {type === "speaking_part2_cuecard" ? <CueCardFields value={value} set={set} /> : null}
      {type === "writing_task1_general" ? <LetterFields value={value} set={set} /> : null}
    </>
  );
}
