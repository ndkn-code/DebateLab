"use client";

/**
 * Create / edit form for an IELTS question group (the set-level half of a
 * question set: shared bank + stimulus). Writes through the canonical group
 * actions, which validate with `CreateQuestionGroupSchema` and throw on bad
 * input — errors surface inline as well as in a toast.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { createQuestionGroupAction, updateQuestionGroupAction } from "@/app/actions/ielts";
import { IELTS_SKILLS } from "@/lib/api/ielts/schema";
import type { ListeningSection } from "@/lib/api/ielts/listening-repository";
import type { Passage } from "@/lib/api/ielts/passages-repository";
import type { Json, Tables } from "@/types/supabase";
import {
  emptyStimulusState,
  optionLinesFromJson,
  parseOptionLines,
  stimulusStateFromRow,
  stimulusStateToPayload,
  type StimulusState,
} from "./authoring-utils";
import { GroupBankEditor, type BankState } from "./GroupBankEditor";
import { GroupStimulusEditor } from "./GroupStimulusEditor";
import { Field, InlineError, TextArea } from "./ielts-ui";

export type QuestionGroupRow = Tables<"ielts_question_groups">;
type IeltsSkill = (typeof IELTS_SKILLS)[number];

interface Props {
  testId: string;
  passages: Passage[];
  listeningSections: ListeningSection[];
  group?: QuestionGroupRow;
  defaultOrderIndex: number;
  onClose: () => void;
}

function metadataRecord(raw: Json | null | undefined): Record<string, Json> {
  return raw && typeof raw === "object" && !Array.isArray(raw)
    ? (raw as Record<string, Json>)
    : {};
}

function initialBank(group?: QuestionGroupRow): BankState {
  return {
    bankText: optionLinesFromJson(group?.bank),
    bankReuse: group?.bank_reuse ?? false,
    answerMode:
      group?.answer_mode === "select" || group?.answer_mode === "text" ? group.answer_mode : "",
    anyOrder: group?.any_order ?? false,
  };
}

export function QuestionGroupForm({
  testId,
  passages,
  listeningSections,
  group,
  defaultOrderIndex,
  onClose,
}: Props) {
  const router = useRouter();
  const [groupKey, setGroupKey] = useState(group?.group_key ?? "");
  const [skill, setSkill] = useState<IeltsSkill>(group?.skill ?? "reading");
  const [passageId, setPassageId] = useState(group?.passage_id ?? "");
  const [sectionId, setSectionId] = useState(group?.listening_section_id ?? "");
  const [orderIndex, setOrderIndex] = useState(
    String(group?.order_index ?? defaultOrderIndex),
  );
  const [title, setTitle] = useState(group?.title ?? "");
  const [instructions, setInstructions] = useState(group?.instructions ?? "");
  const [stimulus, setStimulus] = useState<StimulusState>(() =>
    group ? stimulusStateFromRow(group.stimulus) : emptyStimulusState(),
  );
  const [bank, setBank] = useState<BankState>(() => initialBank(group));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function buildPayload() {
    return {
      testId,
      skill,
      passageId: skill === "reading" && passageId ? passageId : null,
      listeningSectionId: skill === "listening" && sectionId ? sectionId : null,
      groupKey: groupKey.trim(),
      orderIndex: Number.parseInt(orderIndex, 10) || 0,
      title: title.trim() || null,
      instructions: instructions.trim() || null,
      stimulus: stimulusStateToPayload(stimulus),
      bank: parseOptionLines(bank.bankText),
      bankReuse: bank.bankReuse,
      answerMode: bank.answerMode || null,
      anyOrder: bank.anyOrder,
      metadata: metadataRecord(group?.metadata),
    };
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const payload = buildPayload();
      if (group) await updateQuestionGroupAction({ ...payload, groupId: group.id });
      else await createQuestionGroupAction(payload);
      toast.success(group ? "Group updated" : "Group added");
      router.refresh();
      onClose();
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Save failed";
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-outline-variant bg-surface-container-lowest p-4">
      <div className="grid gap-4 sm:grid-cols-[1.5fr_1fr_6rem]">
        <Field label="Group key" hint="lowercase a-z, 0-9, _ or - — members reference this">
          <Input
            value={groupKey}
            onChange={(e) => setGroupKey(e.target.value)}
            placeholder="e.g. p1-headings"
            disabled={Boolean(group)}
          />
        </Field>
        <Field label="Skill">
          <Select value={skill} onChange={(e) => setSkill(e.target.value as IeltsSkill)}>
            {IELTS_SKILLS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Order">
          <Input type="number" value={orderIndex} onChange={(e) => setOrderIndex(e.target.value)} />
        </Field>
      </div>
      {skill === "reading" ? (
        <Field label="Linked passage">
          <Select value={passageId} onChange={(e) => setPassageId(e.target.value)}>
            <option value="">— none —</option>
            {passages.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}
      {skill === "listening" ? (
        <Field label="Linked listening section">
          <Select value={sectionId} onChange={(e) => setSectionId(e.target.value)}>
            <option value="">— none —</option>
            {listeningSections.map((s) => (
              <option key={s.id} value={s.id}>
                Section {s.section_number}
                {s.title ? ` — ${s.title}` : ""}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}
      <Field label="Title (optional)" hint="e.g. Questions 1–5">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} />
      </Field>
      <Field label="Instructions" hint="Shown once above the whole set">
        <TextArea
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          rows={2}
        />
      </Field>
      <GroupStimulusEditor testId={testId} value={stimulus} onChange={setStimulus} />
      <GroupBankEditor value={bank} onChange={setBank} />
      <InlineError message={error} />
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button variant="primary" onClick={save} disabled={saving}>
          {saving ? "Saving…" : group ? "Update group" : "Add group"}
        </Button>
      </div>
    </div>
  );
}
