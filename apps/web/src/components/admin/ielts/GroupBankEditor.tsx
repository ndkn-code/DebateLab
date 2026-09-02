"use client";

/**
 * Shared-bank editor for a question group: one option per line
 * (`id | label | text`, `id | text`, or plain text) plus the bank-reuse /
 * answer-mode / any-order flags that shape how members are answered.
 */
import { Select } from "@/components/ui/select";
import { Field, TextArea, ToggleRow } from "./ielts-ui";

export type BankAnswerMode = "" | "select" | "text";

export interface BankState {
  bankText: string;
  bankReuse: boolean;
  answerMode: BankAnswerMode;
  anyOrder: boolean;
}

export function GroupBankEditor({
  value,
  onChange,
}: {
  value: BankState;
  onChange: (next: BankState) => void;
}) {
  const set = (patch: Partial<BankState>) => onChange({ ...value, ...patch });
  return (
    <div className="flex flex-col gap-3">
      <Field
        label="Shared bank (one per line)"
        hint="Formats: `A | Heading text`, `i | i | Paragraph heading`, or plain text (labels A, B, C… auto-assigned). Leave empty for typed completion groups."
      >
        <TextArea
          value={value.bankText}
          onChange={(e) => set({ bankText: e.target.value })}
          rows={5}
        />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Answer mode" hint="Auto: select when a bank exists">
          <Select
            value={value.answerMode}
            onChange={(e) => set({ answerMode: e.target.value as BankAnswerMode })}
          >
            <option value="">Auto</option>
            <option value="select">Select from bank</option>
            <option value="text">Typed text</option>
          </Select>
        </Field>
        <div className="flex flex-col gap-2">
          <ToggleRow
            label="Bank options reusable"
            hint="An option may answer more than one member"
            checked={value.bankReuse}
            onCheckedChange={(bankReuse) => set({ bankReuse })}
          />
          <ToggleRow
            label="Any order"
            hint="Members can be answered in any order (e.g. choose TWO)"
            checked={value.anyOrder}
            onCheckedChange={(anyOrder) => set({ anyOrder })}
          />
        </div>
      </div>
    </div>
  );
}
