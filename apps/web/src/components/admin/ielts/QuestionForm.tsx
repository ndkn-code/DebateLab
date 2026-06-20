"use client";

/**
 * Unified IELTS question authoring form (WS-1.1). One form that adapts its fields
 * to the selected question type (objective vs Writing vs Speaking) and writes via
 * the canonical create/update question actions (which atomically persist the
 * secret key). Used for both new questions and editing.
 */
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { createQuestionAction, updateQuestionAction } from "@/app/actions/ielts";
import { questionCategory } from "@/lib/api/ielts/question-schema";
import type { QuestionWithKey } from "@/lib/api/ielts/tree";
import type { Passage } from "@/lib/api/ielts/passages-repository";
import type { ListeningSection } from "@/lib/api/ielts/listening-repository";
import {
  Field,
  QUESTION_TYPE_GROUPS,
  QUESTION_TYPE_LABELS,
  TextArea,
  linesToList,
  type IeltsQuestionType,
} from "./ielts-ui";

function jsonToText(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.filter((v) => typeof v === "string").join(" | ");
  return "";
}

function noteValue(notes: unknown, key: string): string {
  if (notes && typeof notes === "object" && !Array.isArray(notes)) {
    const v = (notes as Record<string, unknown>)[key];
    return typeof v === "string" ? v : "";
  }
  return "";
}

interface Props {
  testId: string;
  passages: Passage[];
  listeningSections: ListeningSection[];
  question?: QuestionWithKey;
  onDone: () => void;
  onCancel: () => void;
}

export function QuestionForm({ testId, passages, listeningSections, question, onCancel, onDone }: Props) {
  const key = question?.key ?? null;
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
  const [options, setOptions] = useState(jsonToText(question?.options).replace(/ \| /g, "\n"));
  const [correctAnswer, setCorrectAnswer] = useState(jsonToText(key?.correct_answer));
  const [acceptVariants, setAcceptVariants] = useState(jsonToText(key?.accept_variants));
  const [wordLimit, setWordLimit] = useState(question?.word_limit ? String(question.word_limit) : "");
  const [explanationEn, setExplanationEn] = useState(key?.explanation_en ?? "");
  const [explanationVi, setExplanationVi] = useState(key?.explanation_vi ?? "");
  const [modelAnswer, setModelAnswer] = useState(key?.model_answer ?? "");
  const seedKeys =
    questionCategory((question?.question_type as IeltsQuestionType) ?? "true_false_notgiven") ===
    "writing"
      ? ["task", "coherence", "lexical", "grammar"]
      : ["fluency", "lexical", "grammar", "pronunciation"];
  const [noteA, setNoteA] = useState(noteValue(key?.examiner_notes, seedKeys[0]));
  const [noteB, setNoteB] = useState(noteValue(key?.examiner_notes, seedKeys[1]));
  const [noteC, setNoteC] = useState(noteValue(key?.examiner_notes, seedKeys[2]));
  const [noteD, setNoteD] = useState(noteValue(key?.examiner_notes, seedKeys[3]));
  const [difficulty, setDifficulty] = useState(
    typeof question?.metadata === "object" && question?.metadata && !Array.isArray(question.metadata)
      ? String((question.metadata as Record<string, unknown>).difficulty ?? "")
      : "",
  );
  const [saving, setSaving] = useState(false);

  const category = questionCategory(type);
  const resolvedSkill = category === "objective" ? skill : category;

  function examinerNotes(): Record<string, string> {
    if (category === "writing") {
      return { task: noteA, coherence: noteB, lexical: noteC, grammar: noteD };
    }
    if (category === "speaking") {
      return { fluency: noteA, lexical: noteB, grammar: noteC, pronunciation: noteD };
    }
    return {};
  }

  const noteLabels =
    category === "writing"
      ? ["Examiner: Task (TA/TR)", "Examiner: Coherence (CC)", "Examiner: Lexical (LR)", "Examiner: Grammar (GRA)"]
      : ["Examiner: Fluency (FC)", "Examiner: Lexical (LR)", "Examiner: Grammar (GRA)", "Examiner: Pronunciation"];

  async function handleSave() {
    setSaving(true);
    try {
      const payload = {
        testId,
        skill: resolvedSkill,
        questionType: type,
        prompt,
        groupInstructions: instructions || null,
        passageId: resolvedSkill === "reading" && passageId ? passageId : null,
        listeningSectionId: resolvedSkill === "listening" && sectionId ? sectionId : null,
        options: linesToList(options),
        correctAnswer,
        acceptVariants,
        wordLimit: wordLimit ? Number(wordLimit) : null,
        explanationEn: explanationEn || null,
        explanationVi: explanationVi || null,
        modelAnswer: modelAnswer || null,
        examinerNotes: examinerNotes(),
        metadata: difficulty ? { difficulty } : {},
      };
      if (question) {
        await updateQuestionAction({ ...payload, questionId: question.id });
      } else {
        await createQuestionAction(payload);
      }
      toast.success(question ? "Question updated" : "Question added");
      onDone();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-4">
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
        {category === "objective" ? (
          <Field label="Skill">
            <Select value={skill} onChange={(e) => setSkill(e.target.value as "reading" | "listening")}>
              <option value="reading">Reading</option>
              <option value="listening">Listening</option>
            </Select>
          </Field>
        ) : (
          <Field label="Skill">
            <Input value={category} disabled />
          </Field>
        )}
      </div>

      <Field label="Prompt / question stem">
        <TextArea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={3} />
      </Field>

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
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Options (one per line)" hint="For MCQ / matching banks">
              <TextArea value={options} onChange={(e) => setOptions(e.target.value)} rows={3} />
            </Field>
            <div className="flex flex-col gap-4">
              <Field label="Correct answer(s)" hint="Pipe-separate multiple answers">
                <Input value={correctAnswer} onChange={(e) => setCorrectAnswer(e.target.value)} />
              </Field>
              <Field label="Accept variants" hint="Pipe-separated">
                <Input value={acceptVariants} onChange={(e) => setAcceptVariants(e.target.value)} />
              </Field>
              <Field label="Word limit">
                <Input
                  type="number"
                  value={wordLimit}
                  onChange={(e) => setWordLimit(e.target.value)}
                />
              </Field>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Explanation (EN)">
              <TextArea value={explanationEn} onChange={(e) => setExplanationEn(e.target.value)} rows={2} />
            </Field>
            <Field label="Explanation (VI)">
              <TextArea value={explanationVi} onChange={(e) => setExplanationVi(e.target.value)} rows={2} />
            </Field>
          </div>
        </>
      ) : (
        <>
          <Field label="Band-9 model answer / notes">
            <TextArea value={modelAnswer} onChange={(e) => setModelAnswer(e.target.value)} rows={5} />
          </Field>
          {category === "speaking" ? (
            <Field label="Cue-card bullets / follow-up questions (one per line)">
              <TextArea value={options} onChange={(e) => setOptions(e.target.value)} rows={3} />
            </Field>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={noteLabels[0]}>
              <Input value={noteA} onChange={(e) => setNoteA(e.target.value)} />
            </Field>
            <Field label={noteLabels[1]}>
              <Input value={noteB} onChange={(e) => setNoteB(e.target.value)} />
            </Field>
            <Field label={noteLabels[2]}>
              <Input value={noteC} onChange={(e) => setNoteC(e.target.value)} />
            </Field>
            <Field label={noteLabels[3]}>
              <Input value={noteD} onChange={(e) => setNoteD(e.target.value)} />
            </Field>
          </div>
        </>
      )}

      <div className="flex items-center justify-between gap-3">
        <Field label="Difficulty">
          <Select value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
            <option value="">—</option>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </Select>
        </Field>
        <div className="flex items-end gap-2 self-end">
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
