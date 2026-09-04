"use client";

/**
 * Class export menu (B3).
 *
 * Three reports, two formats each. Every download goes through a server action
 * that returns an `ExportPayload` and `downloadExportFile` rebuilds the file in
 * the browser — there is no route handler for exports and there must not be one
 * (`scripts/ci/checks/no-new-vercel-functions.ts`).
 *
 * Deliberately never gated on `ROSTER_IMPORT_V1`: export only reads tables that
 * already exist, and it is the manual fallback while the importer is dark.
 */
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  exportClassAttendance,
  exportClassRoster,
  exportIeltsClassGradebook,
} from "@/app/actions/admin-classes";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, Download, Loader2 } from "@/components/ui/icons";
import type { ExportFormat, ExportLocale } from "@/lib/export";
import { downloadExportFile } from "@/lib/export/download";

type ReportId = "roster" | "attendance" | "gradebook";

const RUNNERS: Record<
  ReportId,
  (
    classId: string,
    format: ExportFormat,
    locale: ExportLocale,
  ) => Promise<Parameters<typeof downloadExportFile>[0]>
> = {
  roster: exportClassRoster,
  attendance: exportClassAttendance,
  gradebook: exportIeltsClassGradebook,
};

/** XLSX first: it is the default a centre opens without a delimiter dialog. */
const FORMATS: readonly ExportFormat[] = ["xlsx", "csv"];

export function ClassExportMenu({
  classId,
  showIeltsGradebook = true,
}: {
  classId: string;
  /** The gradebook action requires an IELTS class attached to an organisation. */
  showIeltsGradebook?: boolean;
}) {
  const t = useTranslations("admin.classes.detail.roster.export");
  const locale = useLocale();
  const exportLocale: ExportLocale = locale === "en" ? "en" : "vi";
  const [busy, setBusy] = useState(false);

  const reports: ReportId[] = showIeltsGradebook
    ? ["roster", "attendance", "gradebook"]
    : ["roster", "attendance"];

  async function run(report: ReportId, format: ExportFormat) {
    if (busy) return;
    setBusy(true);
    try {
      downloadExportFile(await RUNNERS[report](classId, format, exportLocale));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="outline" />}
        disabled={busy}
        aria-busy={busy}
      >
        {busy ? (
          <Loader2 className="animate-spin" aria-hidden="true" />
        ) : (
          <Download data-icon="inline-start" aria-hidden="true" />
        )}
        {t("label")}
        <ChevronDown data-icon="inline-end" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-auto min-w-[184px]">
        {reports.map((report, index) => (
          <DropdownMenuGroup key={report}>
            {index > 0 ? (
              <DropdownMenuSeparator className="bg-outline-variant" />
            ) : null}
            <DropdownMenuLabel className="text-on-surface-variant">
              {t(report)}
            </DropdownMenuLabel>
            {FORMATS.map((format) => (
              <DropdownMenuItem
                key={format}
                className="cursor-pointer text-on-surface"
                onClick={() => {
                  void run(report, format);
                }}
              >
                {t(format)}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
