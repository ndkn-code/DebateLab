"use client";

/**
 * Roster spreadsheet import (B3) — one dialog, four steps.
 *
 * Upload → Map → Preview → Result. The file is read once in the browser and
 * kept as base64 in state; every later server action re-sends it, so nothing is
 * staged server-side between steps and an abandoned import leaves no residue.
 *
 * The mapping step is **destination-led**: nine fixed rows read from
 * `ROSTER_FIELDS`, each asking which source column feeds it. Source-led mapping
 * grows with the teacher's sheet (`STT`, `Học phí`, `Ca học`…) and turns a
 * nine-decision screen into a twenty-decision one.
 *
 * Issue and outcome text comes from `lib/api/roster/import/messages`, not from
 * the i18n bundle — the downloadable error sheet is built server-side from the
 * same table, so a message never differs between screen and file.
 */
import { useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  commitRosterImportAction,
  downloadRosterTemplate,
  exportRosterImportErrors,
  parseRosterUpload,
  planRosterImport,
  sendRosterInvitationsAction,
} from "@/app/actions/admin-classes";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertTriangle,
  Download,
  FileText,
  Import,
  Loader2,
  Send,
} from "@/components/ui/icons";
import { Select } from "@/components/ui/select";
import { useRouter } from "@/i18n/navigation";
import type { ExportLocale } from "@/lib/export";
import { downloadExportFile } from "@/lib/export/download";
import { ROSTER_FIELDS, type RosterFieldId } from "@/lib/api/roster/columns";
import {
  mappingFromSuggestions,
  type ColumnSuggestion,
  type RosterColumnMapping,
} from "@/lib/api/roster/import/column-map";
import {
  describeIssues,
  describeOutcome,
} from "@/lib/api/roster/import/messages";
import type {
  RosterImportReport,
  RosterRowOutcome,
} from "@/lib/api/roster/import/types";

type Step = "upload" | "map" | "preview" | "result";

const STEPS: readonly Step[] = ["upload", "map", "preview", "result"];

const OUTCOME_ORDER: readonly RosterRowOutcome[] = [
  "created",
  "updated",
  "invited",
  "email_skipped",
  "skipped",
  "needs_review",
  "error",
];

interface ParsedSheet {
  headers: string[];
  sampleRows: string[][];
  suggestions: ColumnSuggestion[];
  sheetNames: string[];
}

interface InviteProgress {
  invited: number;
  skipped: number;
  remaining: number;
  failures: Array<{ email: string; reason: string }>;
}

/** `FileReader` + chunked `btoa`: `String.fromCharCode(...bytes)` blows the
 *  argument limit on a 150-row workbook's worth of bytes. */
async function fileToBase64(file: File): Promise<string> {
  const buffer = await new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error ?? new Error("read failed"));
    reader.readAsArrayBuffer(file);
  });
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
  }
  return btoa(binary);
}

function errorText(caught: unknown, fallback: string) {
  return caught instanceof Error && caught.message ? caught.message : fallback;
}

function blockedRows(report: RosterImportReport) {
  return report.rows.filter(
    (row) => row.outcome === "error" || row.outcome === "needs_review",
  );
}

export function RosterImportDialog({
  clubId,
  classId,
}: {
  clubId: string;
  classId: string;
}) {
  const t = useTranslations("admin.classes.detail.roster.import");
  const locale = useLocale();
  const exportLocale: ExportLocale = locale === "en" ? "en" : "vi";
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  /** Generated once per confirmed import and reused on retry, so a retried
   *  commit returns the stored report instead of duplicating the roster. */
  const idempotencyRef = useRef<string | null>(null);

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("upload");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [filename, setFilename] = useState("");
  const [base64, setBase64] = useState("");
  const [parsed, setParsed] = useState<ParsedSheet | null>(null);
  const [mapping, setMapping] = useState<RosterColumnMapping | null>(null);
  const [touched, setTouched] = useState<RosterFieldId[]>([]);
  const [report, setReport] = useState<RosterImportReport | null>(null);
  const [invites, setInvites] = useState<InviteProgress | null>(null);

  function reset() {
    idempotencyRef.current = null;
    setStep("upload");
    setBusy(false);
    setError(null);
    setFilename("");
    setBase64("");
    setParsed(null);
    setMapping(null);
    setTouched([]);
    setReport(null);
    setInvites(null);
  }

  async function guard(work: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await work();
    } catch (caught) {
      setError(errorText(caught, t("failed")));
    } finally {
      setBusy(false);
    }
  }

  function pickFile(file: File | null) {
    if (!file) return;
    void guard(async () => {
      const encoded = await fileToBase64(file);
      const sheet = await parseRosterUpload(clubId, file.name, encoded);
      idempotencyRef.current = null;
      setFilename(file.name);
      setBase64(encoded);
      setParsed(sheet);
      setMapping(mappingFromSuggestions(sheet.suggestions));
      setTouched([]);
      setReport(null);
      setInvites(null);
      setStep("map");
    });
  }

  function toPreview() {
    if (!mapping) return;
    void guard(async () => {
      setReport(
        await planRosterImport({ clubId, classId, filename, base64, mapping }),
      );
      setStep("preview");
    });
  }

  function commit() {
    if (!mapping) return;
    void guard(async () => {
      idempotencyRef.current ??= crypto.randomUUID();
      setReport(
        await commitRosterImportAction({
          clubId,
          classId,
          filename,
          base64,
          mapping,
          idempotencyKey: idempotencyRef.current,
        }),
      );
      setStep("result");
      router.refresh();
    });
  }

  function downloadTemplate() {
    void guard(async () => {
      downloadExportFile(await downloadRosterTemplate(exportLocale, "xlsx"));
    });
  }

  function downloadErrors() {
    if (!mapping || !report) return;
    void guard(async () => {
      downloadExportFile(
        await exportRosterImportErrors({
          clubId,
          filename,
          base64,
          mapping,
          report,
          locale: exportLocale,
        }),
      );
    });
  }

  function sendInvitations() {
    const batchId = report?.batchId;
    if (!batchId) return;
    void guard(async () => {
      const progress: InviteProgress = {
        invited: 0,
        skipped: 0,
        remaining: 0,
        failures: [],
      };
      // Bounded: 200 passes × 20 covers any roster a centre uploads at once,
      // and a run that stops making progress breaks rather than spinning.
      for (let pass = 0; pass < 200; pass += 1) {
        const run = await sendRosterInvitationsAction(clubId, batchId, 20);
        progress.invited += run.invited;
        progress.skipped += run.skipped;
        progress.remaining = run.remaining;
        progress.failures = [...progress.failures, ...run.failures];
        setInvites({ ...progress });
        if (run.remaining === 0) break;
        if (run.invited === 0 && run.skipped === 0) break;
      }
    });
  }

  const fullNameMapped = mapping ? mapping.fullName !== null : false;
  const importable = report
    ? report.rows.length - blockedRows(report).length
    : 0;
  const hasEmails = report?.rows.some((row) => Boolean(row.email)) ?? false;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (busy && !next) return;
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger render={<Button variant="outline" />}>
        <Import data-icon="inline-start" aria-hidden="true" />
        {t("open")}
      </DialogTrigger>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 type-caption">
          {STEPS.map((name, index) => (
            <li
              key={name}
              className={
                name === step
                  ? "text-on-surface"
                  : "text-on-surface-variant opacity-70"
              }
            >
              {index > 0 ? <span aria-hidden="true">· </span> : null}
              {index + 1}. {t(`steps.${name}`)}
            </li>
          ))}
        </ol>

        {error ? (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-md border border-error bg-error-container px-3 py-2 type-body-sm text-on-error-container"
          >
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {error}
          </p>
        ) : null}

        {step === "upload" ? (
          <div className="flex flex-col gap-3">
            <p className="type-body-sm text-on-surface-variant">
              {t("upload.help")}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" onClick={downloadTemplate} disabled={busy}>
                <Download data-icon="inline-start" aria-hidden="true" />
                {t("upload.template")}
              </Button>
              <Button
                variant="primary"
                onClick={() => fileInputRef.current?.click()}
                disabled={busy}
              >
                {busy ? (
                  <Loader2 className="animate-spin" aria-hidden="true" />
                ) : null}
                {t("upload.choose")}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.csv"
                className="sr-only"
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null;
                  event.target.value = "";
                  pickFile(file);
                }}
              />
            </div>
            <p className="type-caption text-on-surface-variant">
              {t("upload.accept")}
            </p>
          </div>
        ) : null}

        {step === "map" && parsed && mapping ? (
          <div className="flex flex-col gap-3">
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 type-caption text-on-surface-variant">
              <span className="inline-flex items-center gap-1.5 text-on-surface">
                <FileText className="size-3.5" aria-hidden="true" />
                {filename}
              </span>
              <span>{t("map.sheet", { name: parsed.sheetNames[0] ?? "" })}</span>
              <span>{t("map.columns", { count: parsed.headers.length })}</span>
            </p>
            <div className="overflow-hidden rounded-lg border border-outline-variant">
              <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-3 bg-surface-container px-3 py-2 type-caption font-semibold uppercase text-on-surface-variant">
                <span>{t("map.field")}</span>
                <span>{t("map.source")}</span>
              </div>
              {ROSTER_FIELDS.map((field) => {
                const suggestion = parsed.suggestions.find(
                  (item) => item.field === field.id,
                );
                const value = mapping[field.id];
                const isGuess =
                  suggestion?.confidence === "guessed" &&
                  !touched.includes(field.id) &&
                  value === suggestion.sourceIndex;
                const samples =
                  value === null
                    ? []
                    : parsed.sampleRows
                        .map((row) => row[value] ?? "")
                        .filter((cell) => cell.trim().length > 0)
                        .slice(0, 3);
                return (
                  <div
                    key={field.id}
                    className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] items-center gap-3 border-t border-outline-variant px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-1.5 type-label text-on-surface">
                        {field.header[exportLocale]}
                        {field.required ? (
                          <Badge variant="outline">{t("map.required")}</Badge>
                        ) : null}
                        {isGuess ? (
                          <Badge variant="warning">{t("map.guessed")}</Badge>
                        ) : null}
                      </p>
                      <p className="type-caption text-on-surface-variant">
                        {field.hint[exportLocale]}
                      </p>
                    </div>
                    <div className="min-w-0">
                      <Select
                        className="h-9"
                        aria-label={field.header[exportLocale]}
                        value={value === null ? "" : String(value)}
                        onChange={(event) => {
                          const next = event.target.value;
                          setTouched((current) =>
                            current.includes(field.id)
                              ? current
                              : [...current, field.id],
                          );
                          setMapping((current) =>
                            current
                              ? {
                                  ...current,
                                  [field.id]: next === "" ? null : Number(next),
                                }
                              : current,
                          );
                        }}
                      >
                        <option value="">{t("map.none")}</option>
                        {parsed.headers.map((header, index) => (
                          <option key={`${header}-${index}`} value={String(index)}>
                            {header || t("map.unnamed", { index: index + 1 })}
                          </option>
                        ))}
                      </Select>
                      {samples.length > 0 ? (
                        <p className="mt-1 truncate type-caption text-on-surface-variant">
                          {t("map.samples", { values: samples.join(" · ") })}
                        </p>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
            {!fullNameMapped ? (
              <p className="type-caption text-error">{t("map.missingRequired")}</p>
            ) : null}
          </div>
        ) : null}

        {(step === "preview" || step === "result") && report ? (
          <ReportPanel
            report={report}
            locale={exportLocale}
            emptyLabel={t("preview.clean")}
            problemsLabel={t("preview.problemsTitle")}
            columnLabels={{
              row: t("preview.row"),
              name: t("preview.name"),
              problem: t("preview.problem"),
            }}
            capacityLabel={(capacity) =>
              capacity.max === null
                ? t("preview.capacityOpen", {
                    current: capacity.current,
                    incoming: capacity.incoming,
                  })
                : t("preview.capacity", {
                    current: capacity.current,
                    max: capacity.max,
                    incoming: capacity.incoming,
                  })
            }
          />
        ) : null}

        {step === "result" && report ? (
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              {blockedRows(report).length > 0 ? (
                <Button variant="outline" onClick={downloadErrors} disabled={busy}>
                  <Download data-icon="inline-start" aria-hidden="true" />
                  {t("result.downloadErrors")}
                </Button>
              ) : null}
              {report.batchId && hasEmails ? (
                <Button
                  variant="outline"
                  onClick={sendInvitations}
                  disabled={busy || invites?.remaining === 0}
                >
                  <Send data-icon="inline-start" aria-hidden="true" />
                  {t("result.invite")}
                </Button>
              ) : null}
            </div>
            {invites ? (
              <p role="status" aria-live="polite" className="type-caption text-on-surface-variant">
                {invites.remaining > 0
                  ? t("result.inviting", {
                      invited: invites.invited,
                      remaining: invites.remaining,
                    })
                  : t("result.invited", {
                      invited: invites.invited,
                      skipped: invites.skipped,
                    })}
                {invites.failures.length > 0
                  ? ` · ${t("result.inviteFailures", { count: invites.failures.length })}`
                  : ""}
              </p>
            ) : null}
          </div>
        ) : null}

        <DialogFooter>
          {step === "map" ? (
            <Button variant="ghost" onClick={() => setStep("upload")} disabled={busy}>
              {t("back")}
            </Button>
          ) : null}
          {step === "preview" ? (
            <Button variant="ghost" onClick={() => setStep("map")} disabled={busy}>
              {t("back")}
            </Button>
          ) : null}
          {step === "result" ? (
            <Button
              variant="primary"
              onClick={() => {
                setOpen(false);
                reset();
              }}
              disabled={busy}
            >
              {t("close")}
            </Button>
          ) : (
            <Button
              variant="ghost"
              onClick={() => {
                setOpen(false);
                reset();
              }}
              disabled={busy}
            >
              {t("cancel")}
            </Button>
          )}
          {step === "map" ? (
            <Button
              variant="primary"
              onClick={toPreview}
              disabled={busy || !fullNameMapped}
            >
              {busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
              {t("continue")}
            </Button>
          ) : null}
          {step === "preview" ? (
            <Button
              variant="primary"
              onClick={commit}
              disabled={busy || importable === 0}
            >
              {busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
              {t("preview.confirm", { count: importable })}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Shared by the dry run and the commit — one report shape, one renderer. */
function ReportPanel({
  report,
  locale,
  emptyLabel,
  problemsLabel,
  columnLabels,
  capacityLabel,
}: {
  report: RosterImportReport;
  locale: ExportLocale;
  emptyLabel: string;
  problemsLabel: string;
  columnLabels: { row: string; name: string; problem: string };
  capacityLabel: (
    capacity: NonNullable<RosterImportReport["capacity"]>,
  ) => string;
}) {
  const problems = blockedRows(report);
  const counts = OUTCOME_ORDER.filter((outcome) => report.counts[outcome] > 0);

  return (
    <div className="flex flex-col gap-3">
      <dl className="flex flex-wrap items-baseline gap-x-5 gap-y-1">
        {counts.map((outcome) => (
          <div key={outcome} className="flex items-baseline gap-1.5">
            <dt className="type-caption text-on-surface-variant">
              {describeOutcome(outcome, locale)}
            </dt>
            <dd className="type-title text-on-surface">
              {report.counts[outcome]}
            </dd>
          </div>
        ))}
      </dl>

      {report.capacity ? (
        <p className="type-caption text-on-surface-variant">
          {capacityLabel(report.capacity)}
        </p>
      ) : null}

      {report.warnings.map((warning) => (
        <p
          key={warning}
          className="flex items-start gap-2 type-caption text-warning"
        >
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          {warning}
        </p>
      ))}

      {problems.length === 0 ? (
        <p className="type-caption text-on-surface-variant">{emptyLabel}</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          <p className="type-label text-on-surface">{problemsLabel}</p>
          <div className="max-h-64 overflow-auto rounded-lg border border-outline-variant">
            <div className="grid min-w-[520px] grid-cols-[56px_minmax(0,1fr)_minmax(0,2fr)] gap-3 bg-surface-container px-3 py-2 type-caption font-semibold uppercase text-on-surface-variant">
              <span>{columnLabels.row}</span>
              <span>{columnLabels.name}</span>
              <span>{columnLabels.problem}</span>
            </div>
            {problems.map((row) => (
              <div
                key={row.rowNumber}
                className="grid min-w-[520px] grid-cols-[56px_minmax(0,1fr)_minmax(0,2fr)] gap-3 border-t border-outline-variant px-3 py-2 type-body-sm"
              >
                <span className="text-on-surface-variant">{row.rowNumber}</span>
                <span className="truncate text-on-surface">{row.fullName}</span>
                <span className="text-on-surface-variant">
                  {describeIssues(row.issues, locale)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
