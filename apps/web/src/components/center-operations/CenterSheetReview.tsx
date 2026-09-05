"use client";

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  listCenterSheetStages,
  previewCenterSheetImport,
  commitCenterSheetImport,
} from "@/app/actions/admin-clubs";
import { ROSTER_FIELDS, type RosterFieldId } from "@/lib/api/roster/columns";
import type { RosterColumnMapping } from "@/lib/api/roster/import/column-map";
import {
  describeIssues,
  describeOutcome,
} from "@/lib/api/roster/import/messages";
import type {
  RosterImportReport,
  RosterRowOutcome,
} from "@/lib/api/roster/import/types";
import {
  planStagedRosterSheet,
  defaultStagedMapping,
  type StagedSheet,
} from "@/lib/center-operations/sheets";

type Props = { clubId: string; locale: "en" | "vi" };
const copy = {
  en: {
    title: "Review staged sheets",
    empty: "No sheets awaiting review.",
    loading: "Loading sheets…",
    rows: "data rows",
    preview: "Preview import",
    commit: "Confirm import",
    refresh: "Refresh",
    blocked: "blocked",
    ready: "valid",
    confirm: "I reviewed the preview and its duplicate decisions.",
    mapping: "Column mapping",
    unmapped: "Not mapped",
    column: "Column",
    firstRow: "The first row contains column headers and will not be imported.",
    row: "Data row",
    name: "Full name",
    email: "Email",
    phone: "Phone",
    decision: "Decision",
    issues: "Details",
    previewTitle: "Import preview",
    resultTitle: "Import result",
    failed: "The operation could not be completed. Please retry.",
    invalid:
      "This sheet has no readable header row. Correct the source sheet and sync it again.",
    pending: "Awaiting review",
    capacity: "Class capacity",
    noName: "Map a column to Full name before previewing.",
    reviewHelp:
      "Rows marked Needs review or Not imported will not be added. Resolve them in the source sheet and sync again.",
    noRows: "The sheet has no data rows.",
  },
  vi: {
    title: "Xem lại bảng tính",
    empty: "Chưa có bảng tính chờ kiểm tra.",
    loading: "Đang tải bảng tính…",
    rows: "dòng dữ liệu",
    preview: "Xem trước dữ liệu nhập",
    commit: "Xác nhận nhập",
    refresh: "Tải lại",
    blocked: "bị chặn",
    ready: "hợp lệ",
    confirm: "Tôi đã xem trước dữ liệu và cách xử lý các dòng trùng.",
    mapping: "Ghép cột dữ liệu",
    unmapped: "Không ghép",
    column: "Cột",
    firstRow: "Dòng đầu là tiêu đề cột và sẽ không được nhập.",
    row: "Dòng dữ liệu",
    name: "Họ và tên",
    email: "Email",
    phone: "Số điện thoại",
    decision: "Kết quả",
    issues: "Chi tiết",
    previewTitle: "Xem trước kết quả nhập",
    resultTitle: "Kết quả nhập",
    failed: "Không thể hoàn tất thao tác. Vui lòng thử lại.",
    invalid:
      "Bảng tính chưa có dòng tiêu đề hợp lệ. Hãy sửa bảng tính gốc rồi đồng bộ lại.",
    pending: "Chờ kiểm tra",
    capacity: "Sĩ số lớp",
    noName: "Ghép cột Họ và tên trước khi xem trước dữ liệu.",
    reviewHelp:
      "Các dòng Cần kiểm tra hoặc Chưa nhập được sẽ không được thêm. Hãy sửa bảng tính gốc rồi đồng bộ lại.",
    noRows: "Bảng tính chưa có dòng dữ liệu.",
  },
} as const;

function warningText(warning: string, locale: Props["locale"]) {
  if (locale === "en") return warning;
  if (warning === "No column is mapped to Full name; nothing can be imported.")
    return copy.vi.noName;
  if (warning === "The sheet has no data rows.") return copy.vi.noRows;
  const blank = /^Column (\d+) has no header and cannot be mapped\.$/.exec(
    warning,
  );
  if (blank) return `Cột ${blank[1]} chưa có tiêu đề nên không thể ghép.`;
  const duplicate =
    /^Header "(.*)" appears in columns (\d+) and (\d+); only the first is readable\.$/.exec(
      warning,
    );
  if (duplicate)
    return `Tiêu đề “${duplicate[1]}” trùng ở cột ${duplicate[2]} và ${duplicate[3]}; chỉ dùng cột đầu tiên.`;
  return warning;
}

export function CenterSheetReview(props: Props) {
  return <SheetReviewList key={props.clubId} {...props} />;
}

function SheetReviewList({ clubId, locale }: Props) {
  const t = copy[locale];
  const [stages, setStages] = useState<StagedSheet[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState<RosterImportReport | null>(null);
  const applyStages = useCallback((next: StagedSheet[]) => {
    setStages(next);
    setSelectedId((current) =>
      next.some((stage) => stage.id === current)
        ? current
        : (next[0]?.id ?? null),
    );
  }, []);

  useEffect(() => {
    let cancelled = false;
    void listCenterSheetStages(clubId)
      .then((result) => {
        if (cancelled) return;
        if (result.ok) applyStages(result.data);
        else setError(result.error);
      })
      .catch(() => {
        if (!cancelled) setError(t.failed);
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [clubId, applyStages, t.failed]);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const result = await listCenterSheetStages(clubId);
      if (result.ok) applyStages(result.data);
      else setError(result.error);
    } catch {
      setError(t.failed);
    } finally {
      setLoaded(true);
      setLoading(false);
    }
  }

  const selected = stages.find((stage) => stage.id === selectedId);
  return (
    <section className="min-w-0 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="type-heading-lg text-on-surface">{t.title}</h1>
        <Button
          variant="ghost"
          disabled={!loaded || loading}
          onClick={() => void refresh()}
        >
          {t.refresh}
        </Button>
      </div>
      {error && (
        <p role="alert" className="break-words type-body text-error">
          {error}
        </p>
      )}
      {!loaded && (
        <p role="status" className="type-body text-on-surface-variant">
          {t.loading}
        </p>
      )}
      {completed && <ReportPanel report={completed} locale={locale} />}
      {loaded && !stages.length && !error && (
        <p className="type-body text-on-surface-variant">{t.empty}</p>
      )}
      {stages.length > 0 && (
        <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(180px,240px)_minmax(0,1fr)]">
          <nav aria-label={t.title} className="min-w-0 space-y-2">
            {stages.map((stage) => (
              <button
                type="button"
                key={stage.id}
                aria-current={selectedId === stage.id ? "true" : undefined}
                onClick={() => {
                  setSelectedId(stage.id);
                  setCompleted(null);
                }}
                className={`w-full min-w-0 rounded-control border p-3 text-left ${selectedId === stage.id ? "border-primary bg-surface-container" : "border-outline-variant bg-surface"}`}
              >
                <span className="block break-all type-label text-on-surface">
                  {stage.id}
                </span>
                <span className="mt-1 block type-caption text-on-surface-variant">
                  {t.pending} ·{" "}
                  {new Date(stage.created_at).toLocaleString(
                    locale === "vi" ? "vi-VN" : "en-US",
                    { timeZone: "Asia/Ho_Chi_Minh" },
                  )}
                </span>
              </button>
            ))}
          </nav>
          {selected && (
            <StageReview
              key={`${selected.id}:${JSON.stringify(selected.rows)}`}
              stage={selected}
              clubId={clubId}
              locale={locale}
              onCommitted={async (report) => {
                setCompleted(report);
                await refresh();
              }}
            />
          )}
        </div>
      )}
    </section>
  );
}

function StageReview({
  stage,
  clubId,
  locale,
  onCommitted,
}: Props & {
  stage: StagedSheet;
  onCommitted: (report: RosterImportReport) => Promise<void>;
}) {
  const t = copy[locale];
  const formId = useId();
  const headers = Array.isArray(stage.rows[0])
    ? stage.rows[0].map((cell) => (cell == null ? "" : String(cell)))
    : [];
  const [mapping, setMapping] = useState<RosterColumnMapping>(() =>
    defaultStagedMapping(headers),
  );
  const [report, setReport] = useState<RosterImportReport | null>(null);
  const [previewKey, setPreviewKey] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [committed, setCommitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mappingKey = JSON.stringify(mapping);
  const plan = useMemo(() => {
    try {
      return planStagedRosterSheet(stage, mapping);
    } catch {
      return null;
    }
  }, [stage, mapping]);
  const canCommit =
    report?.dryRun &&
    previewKey === mappingKey &&
    report.rows.some(
      (row) => row.outcome !== "error" && row.outcome !== "needs_review",
    );

  function changeMapping(field: RosterFieldId, value: string) {
    const sourceIndex = value === "none" ? null : Number(value);
    setMapping((previous) => {
      const next = { ...previous, [field]: sourceIndex };
      // B3 maps each source column to a single destination.
      if (sourceIndex !== null)
        ROSTER_FIELDS.forEach((other) => {
          if (other.id !== field && next[other.id] === sourceIndex)
            next[other.id] = null;
        });
      return next;
    });
    setReport(null);
    setPreviewKey(null);
    setConfirmed(false);
    setError(null);
  }

  async function run(commit: boolean) {
    if (busy || committed || (commit && (!canCommit || !confirmed))) return;
    setBusy(true);
    setError(null);
    setPreviewKey(null);
    setConfirmed(false);
    try {
      const result = await (
        commit ? commitCenterSheetImport : previewCenterSheetImport
      )(clubId, stage.id, mapping);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setReport(result.data);
      if (commit) {
        setCommitted(true);
        await onCommitted(result.data);
      } else {
        setPreviewKey(mappingKey);
      }
    } catch {
      setError(t.failed);
    } finally {
      setBusy(false);
    }
  }

  if (!plan)
    return (
      <p role="alert" className="type-body text-error">
        {t.invalid}
      </p>
    );
  return (
    <div className="min-w-0 space-y-4 rounded-container border border-outline-variant bg-surface p-4">
      <div>
        <h2 className="type-title text-on-surface">{t.mapping}</h2>
        <p className="mt-1 type-caption text-on-surface-variant">
          {t.firstRow}
        </p>
      </div>
      <div className="grid min-w-0 gap-x-4 gap-y-3 sm:grid-cols-2">
        {ROSTER_FIELDS.map((field) => (
          <div key={field.id} className="min-w-0">
            <label
              htmlFor={`${formId}-${field.id}`}
              className="mb-1 block type-label text-on-surface"
            >
              {field.header[locale]}
              {field.required ? " *" : ""}
            </label>
            <Select
              id={`${formId}-${field.id}`}
              className="min-w-0 type-body"
              disabled={busy || committed}
              value={mapping[field.id] ?? "none"}
              onChange={(event) => changeMapping(field.id, event.target.value)}
            >
              <option value="none">{t.unmapped}</option>
              {headers.map((header, index) => (
                <option
                  key={index}
                  value={index}
                  disabled={
                    !header.trim() ||
                    headers
                      .slice(0, index)
                      .some((earlier) => earlier.trim() === header.trim())
                  }
                >
                  {t.column} {index + 1}: {header || "—"}
                </option>
              ))}
            </Select>
            <p className="mt-1 type-caption text-on-surface-variant">
              {field.hint[locale]}
            </p>
          </div>
        ))}
      </div>
      {error && (
        <p role="alert" className="break-words type-body text-error">
          {error}
        </p>
      )}
      {report ? (
        <ReportPanel report={report} locale={locale} />
      ) : (
        <div className="min-w-0 space-y-2">
          <p className="type-caption text-on-surface-variant">
            {plan.counts.total} {t.rows} · {plan.counts.ready} {t.ready} ·{" "}
            {plan.counts.blocked} {t.blocked}
          </p>
          {plan.warnings.map((warning) => (
            <p key={warning} className="type-caption text-warning">
              {warningText(warning, locale)}
            </p>
          ))}
          <div className="max-h-80 overflow-auto rounded-control border border-outline-variant">
            <table className="w-full text-left type-body">
              <thead>
                <tr>
                  {[t.row, t.name, t.email, t.phone, t.issues].map(
                    (heading) => (
                      <th
                        key={heading}
                        scope="col"
                        className="border-b border-outline-variant px-3 py-2 type-label text-on-surface"
                      >
                        {heading}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {plan.rows.map((row) => (
                  <tr key={row.rowNumber}>
                    <td className="px-3 py-2 text-on-surface-variant">
                      {row.rowNumber}
                    </td>
                    <td className="px-3 py-2 text-on-surface">
                      {row.values.fullName || "—"}
                    </td>
                    <td className="break-all px-3 py-2 text-on-surface-variant">
                      {row.values.email || "—"}
                    </td>
                    <td className="px-3 py-2 text-on-surface-variant">
                      {row.values.phone || "—"}
                    </td>
                    <td className="px-3 py-2 text-on-surface-variant">
                      {describeIssues(row.issues, locale) || t.ready}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="outline"
          disabled={
            busy || committed || mapping.fullName === null || !plan.rows.length
          }
          onClick={() => void run(false)}
        >
          {t.preview}
        </Button>
        <Button
          variant="primary"
          disabled={busy || committed || !canCommit || !confirmed}
          onClick={() => void run(true)}
        >
          {t.commit}
        </Button>
      </div>
      <div className="flex items-start gap-2">
        <Switch
          id={`${formId}-confirm`}
          checked={confirmed}
          onCheckedChange={setConfirmed}
          disabled={busy || committed || !canCommit}
        />
        <label
          htmlFor={`${formId}-confirm`}
          className="type-caption text-on-surface-variant"
        >
          {t.confirm}
        </label>
      </div>
    </div>
  );
}

function ReportPanel({
  report,
  locale,
}: {
  report: RosterImportReport;
  locale: Props["locale"];
}) {
  const t = copy[locale];
  return (
    <div className="min-w-0 space-y-3" aria-live="polite">
      <h2 className="type-title text-on-surface">
        {report.dryRun ? t.previewTitle : t.resultTitle}
      </h2>
      <dl className="flex flex-wrap gap-x-5 gap-y-2">
        {(Object.keys(report.counts) as RosterRowOutcome[])
          .filter((outcome) => report.counts[outcome] > 0)
          .map((outcome) => (
            <div key={outcome}>
              <dt className="type-caption text-on-surface-variant">
                {describeOutcome(outcome, locale)}
              </dt>
              <dd className="type-title text-on-surface">
                {report.counts[outcome]}
              </dd>
            </div>
          ))}
      </dl>
      {(report.counts.needs_review > 0 || report.counts.error > 0) && (
        <p className="type-caption text-on-surface-variant">{t.reviewHelp}</p>
      )}
      {report.capacity && (
        <p className="type-caption text-on-surface-variant">
          {t.capacity}: {report.capacity.current} + {report.capacity.incoming} /{" "}
          {report.capacity.max ?? "—"}
        </p>
      )}
      {report.warnings.map((warning) => (
        <p key={warning} className="break-words type-caption text-warning">
          {warningText(warning, locale)}
        </p>
      ))}
      <div className="max-h-96 overflow-auto rounded-control border border-outline-variant">
        <table className="w-full text-left type-body">
          <thead>
            <tr>
              {[t.row, t.name, t.email, t.decision, t.issues].map((heading) => (
                <th
                  key={heading}
                  scope="col"
                  className="border-b border-outline-variant px-3 py-2 type-label text-on-surface"
                >
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {report.rows.map((row) => (
              <tr key={row.rowNumber}>
                <td className="px-3 py-2 text-on-surface-variant">
                  {row.rowNumber}
                </td>
                <td className="px-3 py-2 text-on-surface">
                  {row.fullName || "—"}
                </td>
                <td className="break-all px-3 py-2 text-on-surface-variant">
                  {row.email || "—"}
                </td>
                <td className="px-3 py-2 text-on-surface">
                  {describeOutcome(row.outcome, locale)}
                </td>
                <td className="px-3 py-2 text-on-surface-variant">
                  {describeIssues(row.issues, locale) || "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
