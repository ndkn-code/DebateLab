"use client";

/** IELTS authoring home (WS-1.1): list every test + create a new one. */
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Plus } from "@/components/ui/icons";
import { createIeltsTestAction } from "@/app/actions/ielts";
import { IELTS_MODULES, IELTS_SKILLS, IELTS_TEST_KINDS } from "@/lib/api/ielts/schema";
import type { IeltsTest } from "@/lib/api/ielts/tests-repository";
import { Field, StatusBadge } from "./ielts-ui";

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function CreateTestForm({ onCancel }: { onCancel: () => void }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [kind, setKind] = useState<(typeof IELTS_TEST_KINDS)[number]>("full_mock");
  const [module, setModule] = useState<(typeof IELTS_MODULES)[number]>("academic");
  const [skill, setSkill] = useState("");
  const [saving, setSaving] = useState(false);

  function onTitle(value: string) {
    setTitle(value);
    if (!slugEdited) setSlug(slugify(value));
  }

  async function save() {
    setSaving(true);
    try {
      const test = await createIeltsTestAction({
        slug: slug || slugify(title),
        title,
        kind,
        module,
        skill: kind === "full_mock" ? null : skill || null,
      });
      toast.success("Test created");
      router.push(`/dashboard/admin/ielts/${test.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Create failed");
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Title">
          <Input value={title} onChange={(e) => onTitle(e.target.value)} placeholder="Academic Mock 1" />
        </Field>
        <Field label="Slug">
          <Input
            value={slug}
            onChange={(e) => {
              setSlug(e.target.value);
              setSlugEdited(true);
            }}
            placeholder="academic-mock-1"
          />
        </Field>
      </div>
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
        <Field label="Skill" hint="For skill_set / drill">
          <Select value={skill} onChange={(e) => setSkill(e.target.value)} disabled={kind === "full_mock"}>
            <option value="">—</option>
            {IELTS_SKILLS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button variant="primary" onClick={save} disabled={saving || !title}>
          {saving ? "Creating…" : "Create test"}
        </Button>
      </div>
    </div>
  );
}

export function IeltsTestsClient({ tests }: { tests: IeltsTest[] }) {
  const [creating, setCreating] = useState(false);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="type-heading-lg text-on-surface">IELTS content</h1>
          <p className="type-body-sm text-on-surface-variant">
            Author tests, passages, listening scripts, questions, and bulk-import the template.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link
            href="/dashboard/admin/ielts/band-conversions"
            className="rounded-full px-4 py-2 type-label text-on-surface-variant transition-colors hover:bg-surface-container"
          >
            Band conversions
          </Link>
          {!creating ? (
            <Button variant="primary" onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" /> New test
            </Button>
          ) : null}
        </div>
      </div>

      {creating ? <CreateTestForm onCancel={() => setCreating(false)} /> : null}

      <div className="flex flex-col gap-2">
        {tests.map((test) => (
          <Link
            key={test.id}
            href={`/dashboard/admin/ielts/${test.id}`}
            className="flex items-center justify-between gap-3 rounded-2xl border border-outline-variant/30 bg-surface-container-lowest px-4 py-3 transition-colors hover:bg-surface-container"
          >
            <div className="min-w-0">
              <p className="type-title text-on-surface">{test.title}</p>
              <p className="type-caption text-on-surface-variant">
                {test.kind} · {test.module}
                {test.skill ? ` · ${test.skill}` : ""} · /{test.slug}
              </p>
            </div>
            <StatusBadge status={test.status} />
          </Link>
        ))}
        {tests.length === 0 && !creating ? (
          <p className="type-body-sm text-on-surface-variant">No tests yet. Create your first one.</p>
        ) : null}
      </div>
    </div>
  );
}
