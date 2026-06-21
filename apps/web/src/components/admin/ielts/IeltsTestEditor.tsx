"use client";

/**
 * IELTS test authoring editor (WS-1.1). Header + status workflow + tabbed panels
 * for settings, passages, listening sections, questions, versions, and import.
 */
import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ArrowLeft } from "@/components/ui/icons";
import { transitionIeltsTestStatusAction, updateIeltsTestAction } from "@/app/actions/ielts";
import { IELTS_MODULES, IELTS_SKILLS, IELTS_TEST_KINDS } from "@/lib/api/ielts/schema";
import { allowedTransitions, type IeltsContentStatus } from "@/lib/api/ielts/workflow";
import type { ContentVersionSummary } from "@/lib/api/ielts/versions-repository";
import type { IeltsTestTree } from "@/lib/api/ielts/tree";
import type {
  MicroItemDraftView,
  MicroItemPublishTarget,
} from "@/lib/ielts/micro-drafts/types";
import { Field, StatusBadge, TextArea } from "./ielts-ui";
import { ImportPanel } from "./ImportPanel";
import { ListeningPanel } from "./ListeningPanel";
import { MicroItemDraftPanel } from "./MicroItemDraftPanel";
import { PassagePanel } from "./PassagePanel";
import { QuestionPanel } from "./QuestionPanel";
import { VersionHistory } from "./VersionHistory";

const ACTION_LABEL: Record<IeltsContentStatus, string> = {
  draft: "Return to Draft",
  in_qa: "Send to QA",
  approved: "Approve",
  published: "Publish",
  archived: "Archive",
};

type Tab =
  | "settings"
  | "passages"
  | "listening"
  | "questions"
  | "micro_items"
  | "versions"
  | "import";

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "settings", label: "Settings" },
  { id: "passages", label: "Passages" },
  { id: "listening", label: "Listening" },
  { id: "questions", label: "Questions" },
  { id: "micro_items", label: "Micro-items" },
  { id: "versions", label: "Versions" },
  { id: "import", label: "Import" },
];

function SettingsForm({ tree }: { tree: IeltsTestTree }) {
  const { test } = tree;
  const [title, setTitle] = useState(test.title);
  const [kind, setKind] = useState(test.kind);
  const [module, setModule] = useState(test.module);
  const [skill, setSkill] = useState(test.skill ?? "");
  const [timeLimit, setTimeLimit] = useState(test.time_limit_seconds ? String(test.time_limit_seconds) : "");
  const [description, setDescription] = useState(test.description ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await updateIeltsTestAction(test.id, {
        title,
        kind,
        module,
        skill: kind === "full_mock" ? null : skill || null,
        timeLimitSeconds: timeLimit ? Number(timeLimit) : null,
        description: description || null,
      });
      toast.success("Settings saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Field label="Title">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Kind">
          <Select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
            {IELTS_TEST_KINDS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Module">
          <Select value={module} onChange={(e) => setModule(e.target.value as typeof module)}>
            {IELTS_MODULES.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Skill" hint="Ignored for full_mock">
          <Select
            value={skill}
            onChange={(e) => setSkill(e.target.value)}
            disabled={kind === "full_mock"}
          >
            <option value="">—</option>
            {IELTS_SKILLS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="Time limit (seconds)">
        <Input type="number" value={timeLimit} onChange={(e) => setTimeLimit(e.target.value)} />
      </Field>
      <Field label="Description">
        <TextArea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
      </Field>
      <div>
        <Button variant="primary" onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save settings"}
        </Button>
      </div>
    </div>
  );
}

export function IeltsTestEditor({
  tree,
  versions,
  microDrafts,
  microDraftTargets,
}: {
  tree: IeltsTestTree;
  versions: ContentVersionSummary[];
  microDrafts: MicroItemDraftView[];
  microDraftTargets: MicroItemPublishTarget[];
}) {
  const { test } = tree;
  const [tab, setTab] = useState<Tab>("settings");
  const [transitioning, setTransitioning] = useState(false);

  async function transition(to: IeltsContentStatus) {
    setTransitioning(true);
    try {
      await transitionIeltsTestStatusAction(test.id, to);
      toast.success(`Moved to ${to}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Transition failed");
    } finally {
      setTransitioning(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-6">
      <div className="flex flex-col gap-3">
        <Link
          href="/dashboard/admin/ielts"
          className="inline-flex w-fit items-center gap-1.5 type-body-sm text-on-surface-variant hover:text-on-surface"
        >
          <ArrowLeft className="h-4 w-4" /> All IELTS tests
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h1 className="type-heading-lg text-on-surface">{test.title}</h1>
            <StatusBadge status={test.status} />
            <span className="type-caption text-on-surface-variant">v{test.version}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {allowedTransitions(test.status).map((to) => (
              <Button
                key={to}
                variant={to === "published" ? "primary" : "outline"}
                size="sm"
                disabled={transitioning}
                onClick={() => transition(to)}
              >
                {ACTION_LABEL[to]}
              </Button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 border-b border-outline-variant/30 pb-2">
        {TABS.map((t) => (
          <Button
            key={t.id}
            variant={tab === t.id ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </Button>
        ))}
      </div>

      {tab === "settings" ? <SettingsForm tree={tree} /> : null}
      {tab === "passages" ? <PassagePanel testId={test.id} passages={tree.passages} /> : null}
      {tab === "listening" ? (
        <ListeningPanel
          testId={test.id}
          sections={tree.listeningSections}
          audioBySection={tree.audioBySection}
        />
      ) : null}
      {tab === "questions" ? (
        <QuestionPanel
          testId={test.id}
          questions={tree.questions}
          passages={tree.passages}
          listeningSections={tree.listeningSections}
        />
      ) : null}
      {tab === "micro_items" ? (
        <MicroItemDraftPanel
          testId={test.id}
          questions={tree.questions}
          drafts={microDrafts}
          publishTargets={microDraftTargets}
        />
      ) : null}
      {tab === "versions" ? <VersionHistory testId={test.id} versions={versions} /> : null}
      {tab === "import" ? <ImportPanel testId={test.id} /> : null}
    </div>
  );
}
