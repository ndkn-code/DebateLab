"use client";

/**
 * Unified IELTS question authoring form (WS-1.1 + format-variety pass). One form
 * that adapts to the selected question type and writes via the canonical
 * create/update question actions (which atomically persist the secret key).
 * Typed metadata, the visual, and the key live in their own sub-editors.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Plus } from "@/components/ui/icons";
import { createQuestionAction, updateQuestionAction } from "@/app/actions/ielts";
import { questionCategory } from "@/lib/api/ielts/question-schema";
import type { QuestionWithKey } from "@/lib/api/ielts/tree";
import type { Passage } from "@/lib/api/ielts/passages-repository";
import type { ListeningSection } from "@/lib/api/ielts/listening-repository";
import { promptBlankIds } from "@/lib/ielts/question-types/prompt";
import { appendBlankMarker } from "./authoring-utils";
import {
  Field,
  InlineError,
  QUESTION_TYPE_GROUPS,
  QUESTION_TYPE_LABELS,
  TextArea,
  linesToList,
  type IeltsQuestionType,
} from "./ielts-ui";
import type { QuestionGroupRow } from "./QuestionGroupForm";
import { QuestionFormAdvanced } from "./QuestionFormAdvanced";
import { QuestionKeyEditor } from "./QuestionKeyEditor";
import { QuestionVisualEditor } from "./QuestionVisualEditor";
import {
  COMPLETION_TYPES,
  buildKey,
  buildMetadata,
  buildVisual,
  examinerNotesFor,
  initAdvancedState,
  initKeyState,
  initVisualState,
  jsonToText,
  metadataRecord,
  usesVisual,
} from "./question-form-state";

interface Props {
  testId: string;
  passages: Passage[];
  listeningSections: ListeningSection[];
  groups: QuestionGroupRow[];
  question?: QuestionWithKey;
  defaultOrderIndex: number;
  onDone: () => void;
  onCancel: () => void;
}

export function QuestionForm({
  testId,
  passages,
  listeningSections,
  groups,
  question,
  defaultOrderIndex,
  onCancel,
  onDone,
}: Props) {
  const router = useRouter();
  const [type, setType] = useState<IeltsQuestionType>(
    (question?.question_type as IeltsQuestionType) ?? "true_false_notgiven",
  );
  const [skill, setSkill] = useState<"reading" | "listening">(
    question?.skill === "listening" ? "listening" : "reading",
  );
  const [prompt, setPrompt] = useState(question?.prompt ?? "");
  const [instructions, setInstructions] = useState(question?.group_instructions ?? "");
  const [passageId, setPassageId] = useState(question?.passage_id ?? "");
  const [sectionId, setSectionId] = useState(question?.listening_section_id ?? "");
  const [groupKey, setGroupKey] = useState(question?.group_key ?? "");
  const [orderIndex, setOrderIndex] = useState(
    String(question?.order_index ?? defaultOrderIndex),
  );
  const [options, setOptions] = useState(jsonToText(question?.options).replace(/ \| /g, "\n"));
  const [wordLimit, setWordLimit] = useState(question?.word_limit ? String(question.word_limit) : "");
  const [difficulty, setDifficulty] = useState(
    String(metadataRecord(question?.metadata).difficulty ?? ""),
  );
  const [advanced, setAdvanced] = useState(() => initAdvancedState(question));
  const [keyState, setKeyState] = useState(() => initKeyState(question));
  const [visual, setVisual] = useState(() => initVisualState(question?.visual));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const category = questionCategory(type);
  const resolvedSkill = category === "objective" ? skill : category;
  const skillGroups = groups.filter((g) => g.skill === resolvedSkill);

  function selectGroup(nextKey: string) {
    setGroupKey(nextKey);
    const group = groups.find((g) => g.group_key === nextKey);
    if (group?.passage_id) setPassageId(group.passage_id);
    if (group?.listening_section_id) setSectionId(group.listening_section_id);
  }

  function buildPayload() {
    const maxPoints = Number.parseInt(advanced.maxPoints, 10);
    return {
      testId,
      skill: resolvedSkill,
      questionType: type,
      prompt,
      passageId: resolvedSkill === "reading" && passageId ? passageId : null,
      listeningSectionId: resolvedSkill === "listening" && sectionId ? sectionId : null,
      orderIndex: Number.parseInt(orderIndex, 10) || 0,
      groupKey: groupKey || null,
      groupInstructions: instructions || null,
      options: linesToList(options),
      ...(Number.isFinite(maxPoints) ? { maxPoints } : {}),
      wordLimit: wordLimit ? Number(wordLimit) : null,
      visual: buildVisual(visual),
      metadata: buildMetadata(metadataRecord(question?.metadata), advanced, type, difficulty),
      ...(category === "objective" ? buildKey(prompt, keyState) : {}),
      explanationEn: keyState.explanationEn || null,
      explanationVi: keyState.explanationVi || null,
      modelAnswer: keyState.modelAnswer || null,
      examinerNotes: examinerNotesFor(category, keyState.notes),
    };
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const payload = buildPayload();
      if (question) await updateQuestionAction({ ...payload, questionId: question.id });
      else await createQuestionAction(payload);
      toast.success(question ? "Question updated" : "Question added");
      router.refresh();
      onDone();
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
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Question type">
          <Select value={type} onChange={(e) => setType(e.target.value as IeltsQuestionType)}>
            {QUESTION_TYPE_GROUPS.map((group) => (
              <optgroup key={group.label} label={group.label}>
                {group.types.map((t) => (
                  <option key={t} value={t}>
                    {QUESTION_TYPE_LABELS[t]}
                  </option>
                ))}
              </optgroup>
            ))}
          </Select>
        </Field>
        <Field label="Skill">
          {category === "objective" ? (
            <Select value={skill} onChange={(e) => setSkill(e.target.value as "reading" | "listening")}>
              <option value="reading">Reading</option>
              <option value="listening">Listening</option>
            </Select>
          ) : (
            <Input value={category} disabled />
          )}
        </Field>
      </div>

      <Field
        label="Prompt / question stem"
        hint={
          COMPLETION_TYPES.has(type)
            ? "Inline blanks: __BLANK_<id>__ — two or more blanks switch the key to one row per blank"
            : undefined
        }
      >
        <TextArea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={3} />
      </Field>
      {COMPLETION_TYPES.has(type) ? (
        <div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPrompt(appendBlankMarker(prompt, promptBlankIds(prompt)))}
          >
            <Plus className="h-4 w-4" /> Insert blank
          </Button>
        </div>
      ) : null}

      {category === "objective" ? (
        <>
          <Field label="Instructions (e.g. NO MORE THAN TWO WORDS)">
            <Input value={instructions} onChange={(e) => setInstructions(e.target.value)} />
          </Field>
          {resolvedSkill === "reading" ? (
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
          ) : (
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
          )}
        </>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-[1fr_6rem]">
        <Field label="Question group" hint="Shared bank / stimulus; set in the Groups tab">
          <Select value={groupKey} onChange={(e) => selectGroup(e.target.value)}>
            <option value="">— none —</option>
            {skillGroups.map((g) => (
              <option key={g.id} value={g.group_key}>
                {g.group_key}
                {g.title ? ` — ${g.title}` : ""}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Order">
          <Input type="number" value={orderIndex} onChange={(e) => setOrderIndex(e.target.value)} />
        </Field>
      </div>

      {category === "objective" ? (
        <Field label="Options (one per line)" hint="MCQ choices, or a per-question bank when no group is linked">
          <TextArea value={options} onChange={(e) => setOptions(e.target.value)} rows={3} />
        </Field>
      ) : null}
      {category === "speaking" && type !== "speaking_part2_cuecard" ? (
        <Field label="Follow-up questions (one per line)">
          <TextArea value={options} onChange={(e) => setOptions(e.target.value)} rows={3} />
        </Field>
      ) : null}

      <QuestionFormAdvanced type={type} category={category} value={advanced} onChange={setAdvanced} />
      {usesVisual(type) ? (
        <QuestionVisualEditor testId={testId} value={visual} onChange={setVisual} />
      ) : null}
      <QuestionKeyEditor
        type={type}
        category={category}
        prompt={prompt}
        value={keyState}
        onChange={setKeyState}
      />

      <InlineError message={error} />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Difficulty">
            <Select value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
              <option value="">—</option>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </Select>
          </Field>
          {category === "objective" ? (
            <Field label="Word limit" hint="Max words per answer (≤100)">
              <Input type="number" value={wordLimit} onChange={(e) => setWordLimit(e.target.value)} />
            </Field>
          ) : null}
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : question ? "Update" : "Add question"}
          </Button>
        </div>
      </div>
    </div>
  );
}
