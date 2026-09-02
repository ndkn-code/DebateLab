"use client";

/** Question authoring (WS-1.1): list every item + add/edit via the unified form. */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "@/components/ui/icons";
import { deleteQuestionAction } from "@/app/actions/ielts";
import type { ListeningSection } from "@/lib/api/ielts/listening-repository";
import type { Passage } from "@/lib/api/ielts/passages-repository";
import type { QuestionWithKey } from "@/lib/api/ielts/tree";
import { parseQuestionMetadata } from "@/lib/ielts/question-types/metadata";
import { QuestionForm } from "./QuestionForm";
import type { QuestionGroupRow } from "./QuestionGroupForm";
import { QUESTION_TYPE_LABELS, type IeltsQuestionType } from "./ielts-ui";

function snippet(text: string): string {
  return text.length > 90 ? `${text.slice(0, 90)}…` : text;
}

function groupCaption(question: QuestionWithKey): string | null {
  if (!question.group_key) return null;
  const slot = parseQuestionMetadata(question.metadata).slot;
  return slot ? `${question.group_key} · slot ${slot}` : question.group_key;
}

export function QuestionPanel({
  testId,
  questions,
  passages,
  listeningSections,
  groups,
}: {
  testId: string;
  questions: QuestionWithKey[];
  passages: Passage[];
  listeningSections: ListeningSection[];
  groups: QuestionGroupRow[];
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  async function remove(question: QuestionWithKey) {
    if (!window.confirm("Delete this question and its answer key?")) return;
    try {
      await deleteQuestionAction(question.id, testId);
      toast.success("Question deleted");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Delete failed");
    }
  }

  const formProps = { testId, passages, listeningSections, groups };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="type-body-sm text-on-surface-variant">{questions.length} question(s)</p>
        {!adding ? (
          <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
            <Plus className="h-4 w-4" /> Add question
          </Button>
        ) : null}
      </div>
      {adding ? (
        <QuestionForm
          {...formProps}
          defaultOrderIndex={questions.length}
          onCancel={() => setAdding(false)}
          onDone={() => setAdding(false)}
        />
      ) : null}
      <div className="flex flex-col gap-3">
        {questions.map((question) =>
          editingId === question.id ? (
            <QuestionForm
              key={question.id}
              {...formProps}
              question={question}
              defaultOrderIndex={question.order_index}
              onCancel={() => setEditingId(null)}
              onDone={() => setEditingId(null)}
            />
          ) : (
            <div
              key={question.id}
              className="flex items-start justify-between gap-3 rounded-2xl border border-outline-variant bg-surface-container-lowest p-4"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="type-caption text-on-surface-variant">#{question.order_index}</span>
                  <Badge variant="secondary">
                    {QUESTION_TYPE_LABELS[question.question_type as IeltsQuestionType] ??
                      question.question_type}
                  </Badge>
                  {question.key ? null : <Badge variant="warning">no key</Badge>}
                  {groupCaption(question) ? (
                    <span className="type-caption text-on-surface-variant">
                      {groupCaption(question)}
                    </span>
                  ) : null}
                </div>
                <p className="mt-1.5 type-body-sm text-on-surface">{snippet(question.prompt)}</p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button variant="ghost" size="sm" onClick={() => setEditingId(question.id)}>
                  Edit
                </Button>
                <Button variant="ghost" size="icon-sm" onClick={() => remove(question)}>
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
