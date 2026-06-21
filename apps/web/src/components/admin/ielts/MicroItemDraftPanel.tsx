"use client";

import { useMemo, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Check, Save, Send, Sparkles, XCircle } from "@/components/ui/icons";
import {
  generateMicroItemDraftsAction,
  publishMicroItemDraftAction,
  reviewMicroItemDraftAction,
  updateMicroItemDraftAction,
} from "@/app/actions/ielts";
import type { QuestionWithKey } from "@/lib/api/ielts/tree";
import type {
  MicroItemDraftView,
  MicroItemPublishTarget,
} from "@/lib/ielts/micro-drafts/types";
import { readAnswerKeyPreview } from "@/lib/ielts/micro-drafts/preview";
import { QUESTION_TYPE_LABELS, TextArea, type IeltsQuestionType } from "./ielts-ui";

function formatJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    throw new Error("JSON is not valid");
  }
}

function snippet(value: string, max = 96): string {
  return value.length > max ? `${value.slice(0, max)}...` : value;
}

function statusVariant(
  status: string,
): "success" | "info" | "destructive" | "warning" {
  if (status === "published") return "success";
  if (status === "approved") return "info";
  if (status === "rejected") return "destructive";
  return "warning";
}

function DraftCard({
  view,
  publishTargets,
}: {
  view: MicroItemDraftView;
  publishTargets: MicroItemPublishTarget[];
}) {
  const router = useRouter();
  const { draft } = view;
  const [contentJson, setContentJson] = useState(formatJson(draft.draft_content));
  const [answerKeyJson, setAnswerKeyJson] = useState(formatJson(draft.answer_key));
  const [rationaleEn, setRationaleEn] = useState(draft.rationale_en);
  const [rationaleVi, setRationaleVi] = useState(draft.rationale_vi);
  const [subskillKey, setSubskillKey] = useState(draft.subskill_key ?? "");
  const [qaNotes, setQaNotes] = useState(draft.qa_notes ?? "");
  const [moduleId, setModuleId] = useState(publishTargets[0]?.moduleId ?? "");
  const [publishTitle, setPublishTitle] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const locked = draft.status === "published";

  async function save() {
    setBusy("save");
    try {
      await updateMicroItemDraftAction({
        draftId: draft.id,
        content: parseJson(contentJson),
        answerKey: parseJson(answerKeyJson),
        rationaleEn,
        rationaleVi,
        subskillKey: subskillKey || null,
        qaNotes: qaNotes || null,
      });
      toast.success("Micro-item draft saved");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Save failed");
    } finally {
      setBusy(null);
    }
  }

  async function review(status: "approved" | "rejected" | "needs_review") {
    setBusy(status);
    try {
      await reviewMicroItemDraftAction({
        draftId: draft.id,
        status,
        qaNotes: qaNotes || null,
      });
      toast.success(status === "approved" ? "Draft approved" : "Draft updated");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Review failed");
    } finally {
      setBusy(null);
    }
  }

  async function publish() {
    if (!moduleId) {
      toast.error("Choose an IELTS module before publishing");
      return;
    }
    setBusy("publish");
    try {
      await publishMicroItemDraftAction({
        draftId: draft.id,
        moduleId,
        title: publishTitle || undefined,
      });
      toast.success("Micro-item published to activities");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Publish failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-outline-variant/30 bg-surface-container-lowest p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={statusVariant(draft.status)}>{draft.status}</Badge>
            <Badge variant="secondary">{draft.activity_type.replace(/_/g, " ")}</Badge>
            {draft.subskill_key ? <Badge variant="outline">{draft.subskill_key}</Badge> : null}
          </div>
          <p className="mt-2 type-body-sm text-on-surface">{view.sourceLabel}</p>
          {view.publishedActivityTitle ? (
            <p className="mt-1 type-caption text-on-surface-variant">
              Published as {view.publishedActivityTitle}
            </p>
          ) : null}
        </div>
        <p className="max-w-sm type-caption text-on-surface-variant">
          Key preview: {readAnswerKeyPreview(draft.answer_key)}
        </p>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="type-label text-on-surface">Public content JSON</span>
          <TextArea
            value={contentJson}
            onChange={(event) => setContentJson(event.target.value)}
            rows={13}
            disabled={locked}
            className="font-mono text-xs"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="type-label text-on-surface">Private answer key JSON</span>
          <TextArea
            value={answerKeyJson}
            onChange={(event) => setAnswerKeyJson(event.target.value)}
            rows={13}
            disabled={locked}
            className="font-mono text-xs"
          />
        </label>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="type-label text-on-surface">Rationale EN</span>
          <TextArea
            value={rationaleEn}
            onChange={(event) => setRationaleEn(event.target.value)}
            rows={3}
            disabled={locked}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="type-label text-on-surface">Rationale VI</span>
          <TextArea
            value={rationaleVi}
            onChange={(event) => setRationaleVi(event.target.value)}
            rows={3}
            disabled={locked}
          />
        </label>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="type-label text-on-surface">Subskill key</span>
          <Input
            value={subskillKey}
            onChange={(event) => setSubskillKey(event.target.value)}
            disabled={locked}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="type-label text-on-surface">QA notes</span>
          <Input
            value={qaNotes}
            onChange={(event) => setQaNotes(event.target.value)}
            disabled={locked}
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={save} disabled={locked || busy !== null}>
            <Save className="h-4 w-4" /> {busy === "save" ? "Saving..." : "Save edits"}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => review("approved")}
            disabled={locked || busy !== null}
          >
            <Check className="h-4 w-4" /> Approve
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => review("rejected")}
            disabled={locked || busy !== null}
          >
            <XCircle className="h-4 w-4" /> Reject
          </Button>
        </div>
        <div className="grid min-w-[280px] flex-1 gap-2 md:grid-cols-[1fr_1fr_auto]">
          <Select
            value={moduleId}
            onChange={(event) => setModuleId(event.target.value)}
            disabled={locked || publishTargets.length === 0}
          >
            {publishTargets.length === 0 ? <option value="">No IELTS modules</option> : null}
            {publishTargets.map((target) => (
              <option key={target.moduleId} value={target.moduleId}>
                {target.courseTitle} / {target.moduleTitle}
              </option>
            ))}
          </Select>
          <Input
            value={publishTitle}
            onChange={(event) => setPublishTitle(event.target.value)}
            placeholder="Optional activity title"
            disabled={locked}
          />
          <Button
            variant="primary"
            size="sm"
            onClick={publish}
            disabled={locked || draft.status !== "approved" || busy !== null}
          >
            <Send className="h-4 w-4" /> {busy === "publish" ? "Publishing..." : "Publish"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function MicroItemDraftPanel({
  questions,
  drafts,
  publishTargets,
}: {
  testId: string;
  questions: QuestionWithKey[];
  drafts: MicroItemDraftView[];
  publishTargets: MicroItemPublishTarget[];
}) {
  const router = useRouter();
  const eligibleQuestions = useMemo(
    () => questions.filter((question) => Boolean(question.key)),
    [questions],
  );
  const [questionId, setQuestionId] = useState(eligibleQuestions[0]?.id ?? "");
  const [generating, setGenerating] = useState(false);

  async function generate() {
    if (!questionId) {
      toast.error("Choose a keyed IELTS question first");
      return;
    }
    setGenerating(true);
    try {
      const rows = await generateMicroItemDraftsAction({ questionId });
      toast.success(`Generated ${rows.length} draft${rows.length === 1 ? "" : "s"}`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-lg border border-outline-variant/30 bg-surface-container-lowest p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-end">
          <label className="flex min-w-0 flex-1 flex-col gap-1.5">
            <span className="type-label text-on-surface">Source question</span>
            <Select value={questionId} onChange={(event) => setQuestionId(event.target.value)}>
              {eligibleQuestions.length === 0 ? <option value="">No keyed questions</option> : null}
              {eligibleQuestions.map((question) => (
                <option key={question.id} value={question.id}>
                  {QUESTION_TYPE_LABELS[question.question_type as IeltsQuestionType] ??
                    question.question_type}{" "}
                  - {snippet(question.prompt, 110)}
                </option>
              ))}
            </Select>
          </label>
          <Button
            variant="primary"
            onClick={generate}
            disabled={generating || !questionId}
            className="md:w-auto"
          >
            <Sparkles className="h-4 w-4" />{" "}
            {generating ? "Generating..." : "Generate micro-items"}
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <p className="type-body-sm text-on-surface-variant">{drafts.length} draft(s)</p>
      </div>
      <div className="flex flex-col gap-3">
        {drafts.length === 0 ? (
          <div className="rounded-lg border border-dashed border-outline-variant/50 p-6 text-center type-body-sm text-on-surface-variant">
            No micro-item drafts yet.
          </div>
        ) : (
          drafts.map((view) => (
            <DraftCard key={view.draft.id} view={view} publishTargets={publishTargets} />
          ))
        )}
      </div>
    </div>
  );
}
