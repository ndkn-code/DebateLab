import { z } from "zod";

export const maintenanceModes = ["off", "banner", "full"] as const;
export type MaintenanceMode = (typeof maintenanceModes)[number];
export type MaintenanceLocale = "en" | "vi";

export interface LocalizedMaintenanceMessage {
  en: string;
  vi: string;
}

export interface MaintenanceState {
  mode: MaintenanceMode;
  bannerMessage: LocalizedMaintenanceMessage;
  fullMessage: LocalizedMaintenanceMessage;
  expectedDoneAt: string | null;
  updatedAt: string | null;
}

export const DEFAULT_MAINTENANCE_STATE: MaintenanceState = {
  mode: "off",
  bannerMessage: {
    en: "A quick heads-up: Thinkfy is getting a tune-up. Everything stays available while we finish.",
    vi: "Thông báo nhanh: Thinkfy đang được tinh chỉnh. Bạn vẫn có thể sử dụng ứng dụng trong lúc chúng mình hoàn tất.",
  },
  fullMessage: {
    en: "We are making Thinkfy better and will be back shortly. Your progress is safe.",
    vi: "Thinkfy đang được nâng cấp và sẽ sớm trở lại. Tiến độ của bạn vẫn được bảo toàn.",
  },
  expectedDoneAt: null,
  updatedAt: null,
};

const localizedMessageSchema = z.object({
  en: z.string().trim().min(1).max(600),
  vi: z.string().trim().min(1).max(600),
});

const isoDateSchema = z.string().refine(
  (value) => Number.isFinite(Date.parse(value)),
  "Expected completion time must be a valid ISO timestamp",
);

export const maintenanceStateSchema = z.object({
  mode: z.enum(maintenanceModes),
  bannerMessage: localizedMessageSchema,
  fullMessage: localizedMessageSchema,
  expectedDoneAt: isoDateSchema.nullable(),
  updatedAt: isoDateSchema.nullable(),
});

export const maintenanceUpdateSchema = z
  .object({
    mode: z.enum(maintenanceModes),
    bannerMessage: localizedMessageSchema,
    fullMessage: localizedMessageSchema,
    expectedDoneAt: isoDateSchema.nullable(),
  })
  .superRefine((value, context) => {
    if (value.mode !== "full") return;
    if (!value.expectedDoneAt) {
      context.addIssue({
        code: "custom",
        path: ["expectedDoneAt"],
        message: "Expected completion time is required in full mode",
      });
      return;
    }
    if (Date.parse(value.expectedDoneAt) <= Date.now()) {
      context.addIssue({
        code: "custom",
        path: ["expectedDoneAt"],
        message: "Expected completion time must be in the future",
      });
    }
  });

export type MaintenanceUpdateInput = z.infer<typeof maintenanceUpdateSchema>;

export interface MaintenanceRow {
  mode: string;
  banner_message_en: string;
  banner_message_vi: string;
  full_message_en: string;
  full_message_vi: string;
  expected_done_at: string | null;
  updated_at: string | null;
}

export function mapMaintenanceRow(row: MaintenanceRow): MaintenanceState {
  return maintenanceStateSchema.parse({
    mode: row.mode,
    bannerMessage: { en: row.banner_message_en, vi: row.banner_message_vi },
    fullMessage: { en: row.full_message_en, vi: row.full_message_vi },
    expectedDoneAt: row.expected_done_at,
    updatedAt: row.updated_at,
  });
}

export function localizedMessage(
  message: LocalizedMaintenanceMessage,
  locale: string,
) {
  return locale === "vi" ? message.vi : message.en;
}

export function stripLocalePrefix(pathname: string) {
  return pathname.replace(/^\/(?:en|vi)(?=\/|$)/, "") || "/";
}

export function isMaintenanceBypassPath(pathname: string) {
  const path = stripLocalePrefix(pathname);
  return (
    path === "/maintenance" ||
    path.startsWith("/maintenance/") ||
    path === "/dashboard/admin" ||
    path.startsWith("/dashboard/admin/") ||
    path === "/auth" ||
    path.startsWith("/auth/") ||
    pathname === "/auth/callback" ||
    pathname === "/api/public/maintenance" ||
    pathname === "/api/admin" ||
    pathname.startsWith("/api/admin/") ||
    pathname.startsWith("/_next/") ||
    /\.[a-z0-9]+$/i.test(pathname)
  );
}

export function requestLocale(
  pathname: string,
  cookieLocale?: string,
  acceptLanguage = "",
): MaintenanceLocale {
  const pathLocale = pathname.match(/^\/(en|vi)(?:\/|$)/)?.[1];
  if (pathLocale === "en" || pathLocale === "vi") return pathLocale;
  if (cookieLocale === "en" || cookieLocale === "vi") return cookieLocale;
  return acceptLanguage.toLowerCase().includes("vi") ? "vi" : "en";
}

export async function evaluateMaintenanceGate({
  environment,
  bypass,
  readState,
}: {
  environment: string | undefined;
  bypass: boolean;
  readState: () => Promise<MaintenanceState>;
}): Promise<MaintenanceState | null> {
  if (environment !== "production" || bypass) return null;
  try {
    const state = await readState();
    return state.mode === "full" ? state : null;
  } catch {
    return null;
  }
}
