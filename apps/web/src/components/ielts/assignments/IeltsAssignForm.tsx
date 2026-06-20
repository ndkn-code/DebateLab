"use client";

/**
 * Teacher assign-a-mock form (WS-5.3): pick a class + a published mock (+ an
 * optional due date) and create an `ielts_mock` club assignment. Submits through
 * the `assignIeltsMockToClass` server action, then refreshes the list.
 */
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { assignIeltsMockToClass } from "@/app/actions/ielts/assignments";
import type { AssignableClass, AssignableTest } from "@/lib/api/ielts/assignment-manager-page";

const FIELD =
  "mt-1 w-full rounded-xl border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface focus:border-primary focus:outline-none disabled:opacity-50";

export function IeltsAssignForm({
  clubId,
  classes,
  tests,
}: {
  clubId: string;
  classes: AssignableClass[];
  tests: AssignableTest[];
}) {
  const t = useTranslations("ielts.assignments");
  const router = useRouter();
  const [classId, setClassId] = useState("");
  const [testId, setTestId] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const blocked = classes.length === 0 || tests.length === 0;
  const canSubmit = Boolean(classId) && Boolean(testId) && !busy && !blocked;

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      await assignIeltsMockToClass({ clubId, classId, testId, dueAt: dueAt || null });
      setClassId("");
      setTestId("");
      setDueAt("");
      router.refresh();
    } catch {
      setError(t("teacher.assignError"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-2xl border border-outline-variant bg-surface p-5 shadow-token-card"
    >
      <h2 className="type-title text-on-surface">{t("teacher.assignHeading")}</h2>

      {classes.length === 0 ? (
        <p className="mt-2 text-sm text-on-surface-variant">{t("teacher.noClasses")}</p>
      ) : null}
      {tests.length === 0 ? (
        <p className="mt-2 text-sm text-on-surface-variant">{t("teacher.noTests")}</p>
      ) : null}

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <label className="block">
          <span className="type-label text-on-surface-variant">{t("teacher.classLabel")}</span>
          <select
            className={FIELD}
            value={classId}
            disabled={blocked}
            onChange={(event) => setClassId(event.target.value)}
          >
            <option value="">{t("teacher.classPlaceholder")}</option>
            {classes.map((cls) => (
              <option key={cls.id} value={cls.id}>
                {cls.title}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="type-label text-on-surface-variant">{t("teacher.testLabel")}</span>
          <select
            className={FIELD}
            value={testId}
            disabled={blocked}
            onChange={(event) => setTestId(event.target.value)}
          >
            <option value="">{t("teacher.testPlaceholder")}</option>
            {tests.map((test) => (
              <option key={test.id} value={test.id}>
                {test.title}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="type-label text-on-surface-variant">{t("teacher.dueLabel")}</span>
          <input
            type="date"
            className={FIELD}
            value={dueAt}
            disabled={blocked}
            onChange={(event) => setDueAt(event.target.value)}
          />
        </label>
      </div>

      {error ? <p className="mt-3 text-sm text-error">{error}</p> : null}

      <div className="mt-4 flex justify-end">
        <button
          type="submit"
          disabled={!canSubmit}
          className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-on-primary disabled:opacity-50"
        >
          {busy ? t("teacher.assigning") : t("teacher.assignButton")}
        </button>
      </div>
    </form>
  );
}
