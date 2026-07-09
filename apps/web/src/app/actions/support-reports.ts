"use server";

import {
  updateSupportReportStatus as updateSupportReportStatusInApi,
} from "@/lib/api/support-reports";
import type { SupportReportStatus } from "@/lib/support/support-reports-model";

export async function updateSupportReportStatus(input: {
  id: string;
  status: SupportReportStatus;
}) {
  return updateSupportReportStatusInApi(input);
}
