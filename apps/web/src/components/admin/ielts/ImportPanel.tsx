"use client";

/**
 * Bulk-import panel (WS-1.1): upload the authoring workbook (.xlsx) — or a
 * single-tab .csv with its tab name — into THIS test, then show the per-row report.
 */
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ImportReport } from "@/lib/api/ielts/import/types";
import { Field } from "./ielts-ui";

export function ImportPanel({ testId }: { testId: string }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [sheetName, setSheetName] = useState("");
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<ImportReport | null>(null);

  async function run() {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      toast.error("Choose a workbook file first");
      return;
    }
    setBusy(true);
    setReport(null);
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("testId", testId);
      if (sheetName.trim()) form.set("sheetName", sheetName.trim());
      const res = await fetch("/api/admin/ielts/import", { method: "POST", body: form });
      const json = (await res.json()) as { ok?: boolean; report?: ImportReport; error?: string };
      if (!res.ok || !json.ok || !json.report) {
        throw new Error(json.error ?? "Import failed");
      }
      setReport(json.report);
      const { created } = json.report;
      toast.success(
        `Imported ${created.passages} passages, ${created.listeningSections} sections, ${created.questions} questions`,
      );
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Import failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="type-body-sm text-on-surface-variant">
        Import the authoring template (docs/ielts-content-authoring-template.xlsx) into this test.
        Rows are matched to the schema by column; re-importing skips already-imported rows.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Workbook file (.xlsx or .csv)">
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.csv"
            className="block w-full text-sm text-on-surface file:mr-3 file:rounded-lg file:border-0 file:bg-surface-container file:px-3 file:py-2 file:text-sm file:text-on-surface"
          />
        </Field>
        <Field label="Tab name (only for .csv)" hint="e.g. Reading Questions">
          <Input value={sheetName} onChange={(e) => setSheetName(e.target.value)} />
        </Field>
      </div>
      <div>
        <Button variant="primary" onClick={run} disabled={busy}>
          {busy ? "Importing…" : "Run import"}
        </Button>
      </div>

      {report ? (
        <div className="flex flex-col gap-2 rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-4">
          <p className="type-title text-on-surface">
            Created {report.created.passages} passages · {report.created.listeningSections} sections ·{" "}
            {report.created.questions} questions
          </p>
          <p className="type-body-sm text-on-surface-variant">
            {report.skipped} skipped · {report.errors} errors
          </p>
          {report.warnings.map((w, i) => (
            <p key={i} className="type-caption text-warning">
              ⚠ {w}
            </p>
          ))}
          {report.rows
            .filter((r) => r.outcome === "error")
            .map((r, i) => (
              <p key={i} className="type-caption text-destructive">
                {r.tab} row {r.rowNumber} ({r.importId ?? "—"}): {r.message}
              </p>
            ))}
        </div>
      ) : null}
    </div>
  );
}
