"use client";

/**
 * "Question groups" tab of the IELTS test editor (workbench): one row per group
 * — key, skill, stimulus kind, bank size, member count (questions sharing the
 * `group_key`), flags — with inline create / edit and delete.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "@/components/ui/icons";
import { deleteQuestionGroupAction } from "@/app/actions/ielts";
import type { ListeningSection } from "@/lib/api/ielts/listening-repository";
import type { Passage } from "@/lib/api/ielts/passages-repository";
import type { QuestionWithKey } from "@/lib/api/ielts/tree";
import { normalizeGroupStimulus } from "@/lib/ielts/question-types/groups";
import { QuestionGroupForm, type QuestionGroupRow } from "./QuestionGroupForm";

const STIMULUS_LABEL: Record<string, string> = {
  text: "Text",
  table: "Table",
  flowchart: "Flow chart",
  image: "Image",
};

function bankSize(raw: unknown): number {
  return Array.isArray(raw) ? raw.length : 0;
}

function GroupRow({
  group,
  memberCount,
  onEdit,
  onRemove,
}: {
  group: QuestionGroupRow;
  memberCount: number;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const stimulus = normalizeGroupStimulus(group.stimulus);
  const bank = bankSize(group.bank);
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2.5">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
        <span className="type-body-sm font-medium text-on-surface">{group.group_key}</span>
        <Badge variant="secondary">{group.skill}</Badge>
        <span className="type-caption text-on-surface-variant">
          {stimulus ? STIMULUS_LABEL[stimulus.kind] : "No stimulus"} · bank {bank} ·{" "}
          {memberCount} member{memberCount === 1 ? "" : "s"} · order {group.order_index}
        </span>
        {group.title ? (
          <span className="truncate type-caption text-on-surface-variant">{group.title}</span>
        ) : null}
        {group.bank_reuse ? <Badge variant="outline">reuse</Badge> : null}
        {group.any_order ? <Badge variant="outline">any order</Badge> : null}
        {group.answer_mode ? <Badge variant="outline">{group.answer_mode}</Badge> : null}
        {memberCount === 0 ? <Badge variant="warning">no members</Badge> : null}
      </div>
      <div className="flex shrink-0 gap-1">
        <Button variant="ghost" size="sm" onClick={onEdit}>
          Edit
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={onRemove} aria-label="Delete group">
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>
    </div>
  );
}

export function QuestionGroupPanel({
  testId,
  groups,
  passages,
  listeningSections,
  questions,
}: {
  testId: string;
  groups: QuestionGroupRow[];
  passages: Passage[];
  listeningSections: ListeningSection[];
  questions: QuestionWithKey[];
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const memberCounts = new Map<string, number>();
  for (const question of questions) {
    if (!question.group_key) continue;
    memberCounts.set(question.group_key, (memberCounts.get(question.group_key) ?? 0) + 1);
  }

  async function remove(group: QuestionGroupRow) {
    const members = memberCounts.get(group.group_key) ?? 0;
    const warning =
      members > 0
        ? ` ${members} member question(s) keep their group_key and will lose the shared stimulus.`
        : "";
    if (!window.confirm(`Delete group "${group.group_key}"?${warning}`)) return;
    try {
      await deleteQuestionGroupAction({ testId, groupId: group.id });
      toast.success("Group deleted");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Delete failed");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="type-body-sm text-on-surface-variant">
          {groups.length} group(s) — shared banks and stimuli; members link by group key
        </p>
        {!adding ? (
          <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
            <Plus className="h-4 w-4" /> Add group
          </Button>
        ) : null}
      </div>
      {adding ? (
        <QuestionGroupForm
          testId={testId}
          passages={passages}
          listeningSections={listeningSections}
          defaultOrderIndex={groups.length}
          onClose={() => setAdding(false)}
        />
      ) : null}
      <div className="flex flex-col gap-2">
        {groups.map((group) =>
          editingId === group.id ? (
            <QuestionGroupForm
              key={group.id}
              testId={testId}
              passages={passages}
              listeningSections={listeningSections}
              group={group}
              defaultOrderIndex={group.order_index}
              onClose={() => setEditingId(null)}
            />
          ) : (
            <GroupRow
              key={group.id}
              group={group}
              memberCount={memberCounts.get(group.group_key) ?? 0}
              onEdit={() => setEditingId(group.id)}
              onRemove={() => remove(group)}
            />
          ),
        )}
        {groups.length === 0 && !adding ? (
          <p className="rounded-xl border border-dashed border-outline-variant px-4 py-6 text-center type-body-sm text-on-surface-variant">
            No groups yet. Add one for matching-heading banks, summary / notes text with
            blanks, tables, flow charts, or labelled diagrams.
          </p>
        ) : null}
      </div>
    </div>
  );
}
