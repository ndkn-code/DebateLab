"use client";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { CenterSnapshot } from "@/lib/center-operations/contracts";
import {
  bindCenterGoogleResource,
  executeCenterOperation,
  getCenterGooglePickerToken,
  listCenterGoogleResources,
  requestCenterResourceSync,
  startCenterGoogleConnection,
} from "@/app/actions/admin-clubs";
import { centerCopy } from "./copy";

declare global {
  interface Window {
    gapi?: { load: (name: string, callback: () => void) => void };
    google?: {
      picker?: {
        PickerBuilder: new () => PickerBuilder;
        Action: { PICKED: string };
        ViewId: { DOCS: string; SPREADSHEETS: string };
        DocsView: new (viewId: string) => {
          setMimeTypes: (types: string) => unknown;
        };
      };
    };
  }
}
type PickerBuilder = {
  addView: (view: unknown) => PickerBuilder;
  setOAuthToken: (token: string) => PickerBuilder;
  setDeveloperKey: (key: string) => PickerBuilder;
  setAppId: (id: string) => PickerBuilder;
  setCallback: (
    callback: (data: {
      action: string;
      docs?: { id: string; name: string }[];
    }) => void,
  ) => PickerBuilder;
  build: () => { setVisible: (visible: boolean) => void };
};
type Props = {
  clubId: string;
  snapshot: CenterSnapshot;
  locale: "en" | "vi";
  onRefresh: () => Promise<void>;
};
const copy = {
  en: {
    calendar: "Calendar",
    sheet: "Sheet",
    file: "Drive file",
    class: "Class",
    label: "Label",
    range: "Sheet range",
    bind: "Bind resource",
    choose: "Choose from Google",
    create: "Create app calendar",
    selected: "Selected",
    empty: "No Google resources available.",
    connect: "Connect",
    prepare: "Prepare setup",
    disconnect: "Disconnect",
    disconnectConfirm: "Disconnect?",
    disconnectNote: "Sync stops and imported material is archived.",
    cancel: "Cancel",
    connected: "Connected",
    sync: "Re-sync",
    consent: "Allow editing existing calendars",
    consentNote: "This requests permission to edit existing Google calendars.",
  },
  vi: {
    calendar: "Lịch",
    sheet: "Trang tính",
    file: "Tệp Drive",
    class: "Lớp",
    label: "Nhãn",
    range: "Phạm vi trang tính",
    bind: "Liên kết tài nguyên",
    choose: "Chọn từ Google",
    create: "Tạo lịch ứng dụng",
    selected: "Đã chọn",
    empty: "Chưa có tài nguyên Google.",
    connect: "Kết nối",
    prepare: "Chuẩn bị kết nối",
    disconnect: "Ngắt kết nối",
    disconnectConfirm: "Ngắt kết nối?",
    disconnectNote: "Đồng bộ sẽ dừng và tài liệu đã nhập được lưu trữ.",
    cancel: "Hủy",
    connected: "Đã kết nối",
    sync: "Đồng bộ lại",
    consent: "Cho phép chỉnh sửa lịch hiện có",
    consentNote: "Quyền này cho phép chỉnh sửa các lịch Google hiện có.",
  },
};
let pickerLoader: Promise<void> | null = null;
function loadPicker() {
  if (window.google?.picker) return Promise.resolve();
  if (pickerLoader) return pickerLoader;
  pickerLoader = new Promise((resolve, reject) => {
    const script =
      document.querySelector<HTMLScriptElement>("script[data-google-picker]") ??
      document.createElement("script");
    script.setAttribute("data-google-picker", "true");
    script.src = "https://apis.google.com/js/api.js";
    script.async = true;
    script.addEventListener("error", () =>
      reject(new Error("Google Picker failed to load")),
    );
    script.addEventListener("load", () => window.gapi?.load("picker", resolve));
    if (!script.parentNode) document.head.appendChild(script);
  });
  return pickerLoader;
}
export function CenterIntegrations({
  clubId,
  snapshot,
  locale,
  onRefresh,
}: Props) {
  const t = copy[locale];
  const statusText = (status: string) =>
    status === "pending"
      ? locale === "vi"
        ? "Chờ hoàn tất kết nối"
        : "Awaiting setup"
      : (centerCopy[locale][status] ?? status);
  const providerName = (provider: string) =>
    provider === "google"
      ? "Google"
      : provider === "zbs"
        ? "Zalo OA"
        : "ZaloPay";
  const google = snapshot.connections.find(
    (item) => item.provider === "google",
  );
  const googleConnected =
    google?.status === "connected" || google?.status === "sandbox";
  const [resources, setResources] = useState({
    calendars: [] as { id: string; summary: string }[],
    bindings: snapshot.bindings,
  });
  const [kind, setKind] = useState<"calendar" | "sheet" | "drive_file">(
    "calendar",
  );
  const [calendar, setCalendar] = useState("");
  const [classId, setClassId] = useState("");
  const [label, setLabel] = useState("");
  const [range, setRange] = useState("Sheet1!A1:Z1000");
  const [selected, setSelected] = useState<{ id: string; name: string } | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmId, setConfirmId] = useState<string | null>(null);
  useEffect(() => {
    setResources((old) => ({ ...old, bindings: snapshot.bindings }));
    setCalendar("");
  }, [snapshot.bindings]);
  useEffect(() => {
    if (!googleConnected) {
      setResources((old) => ({ ...old, calendars: [] }));
      return;
    }
    void listCenterGoogleResources(clubId).then((result) => {
      if (result.ok) setResources(result.data);
      else setError(result.error);
    });
  }, [clubId, googleConnected]);
  const pick = async () => {
    setBusy(true);
    setError("");
    try {
      await loadPicker();
      const token = await getCenterGooglePickerToken(clubId);
      if (!token.ok) throw new Error(token.error);
      const picker = window.google?.picker;
      if (!picker) throw new Error("Google Picker is unavailable.");
      const view = new picker.DocsView(
        kind === "sheet" ? picker.ViewId.SPREADSHEETS : picker.ViewId.DOCS,
      );
      view.setMimeTypes(
        kind === "sheet"
          ? "application/vnd.google-apps.spreadsheet"
          : "application/pdf,application/vnd.google-apps.document,text/plain",
      );
      new picker.PickerBuilder()
        .addView(view)
        .setOAuthToken(token.data.accessToken)
        .setDeveloperKey(token.data.developerKey)
        .setAppId(token.data.appId)
        .setCallback((data) => {
          if (data.action === picker.Action.PICKED && data.docs?.[0]) {
            setSelected(data.docs[0]);
            setLabel(data.docs[0].name);
          }
          setBusy(false);
        })
        .build()
        .setVisible(true);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Google Picker is unavailable.",
      );
      setBusy(false);
    }
  };
  const bind = async () => {
    const externalId = kind === "calendar" ? calendar : selected?.id;
    const resourceLabel =
      calendar === "create"
        ? snapshot.classes.find((item) => item.id === classId)?.name
        : label;
    if (!externalId || !resourceLabel || (kind !== "sheet" && !classId)) return;
    setBusy(true);
    const result = await bindCenterGoogleResource(clubId, {
      kind,
      externalId,
      label: resourceLabel,
      classId: classId || undefined,
      range: kind === "sheet" ? range : undefined,
    });
    if (!result.ok) setError(result.error);
    else {
      setSelected(null);
      setLabel("");
      await onRefresh();
    }
    setBusy(false);
  };
  const providerRows = useMemo(
    () =>
      (["google", "zbs", "zalopay"] as const).map(
        (provider) =>
          snapshot.connections.find((item) => item.provider === provider) ?? {
            id: provider,
            provider,
            status: "not_connected",
            account_label: null,
            scopes: [],
            last_sync_at: null,
          },
      ),
    [snapshot.connections],
  );
  return (
    <section className="min-w-0 space-y-4">
      <div className="grid gap-2">
        {providerRows.map((provider) => (
          <div
            key={provider.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border bg-surface p-2"
          >
            <span className="type-body text-on-surface">
              {providerName(provider.provider)} · {statusText(provider.status)}
            </span>
            {snapshot.canManageFinance &&
              provider.provider === "google" &&
              [
                "not_connected",
                "pending",
                "disabled",
                "reconnect_required",
              ].includes(provider.status) && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    const result = await startCenterGoogleConnection(clubId);
                    setBusy(false);
                    if (result.ok) window.location.assign(result.data.url);
                    else setError(result.error);
                  }}
                >
                  {t.connect}
                </Button>
              )}
            {snapshot.canManageFinance &&
              provider.provider !== "google" &&
              ["not_connected", "disabled"].includes(provider.status) && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    const result = await executeCenterOperation(
                      clubId,
                      {
                        kind: "connection.prepare",
                        provider: provider.provider,
                      },
                      crypto.randomUUID(),
                    );
                    if (!result.ok) setError(result.error);
                    else await onRefresh();
                    setBusy(false);
                  }}
                >
                  {t.prepare}
                </Button>
              )}
            {snapshot.canManageFinance &&
              [
                "connected",
                "sandbox",
                "pending",
                "reconnect_required",
              ].includes(provider.status) &&
              (confirmId === provider.id ? (
                <span className="flex flex-wrap items-center gap-2">
                  <span className="type-caption text-on-surface-variant">
                    {t.disconnectNote}
                  </span>
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      const result = await executeCenterOperation(
                        clubId,
                        {
                          kind: "connection.disconnect",
                          connectionId: provider.id,
                        },
                        crypto.randomUUID(),
                      );
                      if (!result.ok) setError(result.error);
                      else {
                        setConfirmId(null);
                        await onRefresh();
                      }
                      setBusy(false);
                    }}
                  >
                    {t.disconnectConfirm}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    onClick={() => setConfirmId(null)}
                  >
                    {t.cancel}
                  </Button>
                </span>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => setConfirmId(provider.id)}
                >
                  {t.disconnect}
                </Button>
              ))}
          </div>
        ))}
      </div>
      {googleConnected && snapshot.canManageFinance && (
        <>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                const result = await startCenterGoogleConnection(clubId, true);
                setBusy(false);
                if (result.ok) window.location.assign(result.data.url);
                else setError(result.error);
              }}
            >
              {t.consent}
            </Button>
            <span className="type-caption text-on-surface-variant">
              {t.consentNote}
            </span>
          </div>
          <div className="grid gap-3 rounded-2xl border border-border bg-surface p-3 md:grid-cols-2">
            <div className="grid gap-1.5">
              <Label>
                {t.calendar} / {t.sheet} / {t.file}
              </Label>
              <Select
                value={kind}
                onChange={(event) => {
                  setKind(event.target.value as typeof kind);
                  setSelected(null);
                  setLabel("");
                  setCalendar("");
                }}
              >
                <option value="calendar">{t.calendar}</option>
                <option value="sheet">{t.sheet}</option>
                <option value="drive_file">{t.file}</option>
              </Select>
            </div>
            {kind === "calendar" ? (
              <div className="grid gap-1.5">
                <Label>{t.calendar}</Label>
                <Select
                  value={calendar}
                  onChange={(event) => setCalendar(event.target.value)}
                >
                  <option value="">{t.empty}</option>
                  {resources.calendars.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.summary}
                    </option>
                  ))}
                  <option value="create">{t.create}</option>
                </Select>
              </div>
            ) : (
              <div className="flex items-end">
                <Button variant="outline" onClick={pick} disabled={busy}>
                  {t.choose}
                </Button>
              </div>
            )}
            {kind === "sheet" && (
              <div className="grid gap-1.5">
                <Label htmlFor="center-range">{t.range}</Label>
                <Input
                  id="center-range"
                  value={range}
                  onChange={(event) => setRange(event.target.value)}
                />
              </div>
            )}
            <div className="grid gap-1.5">
              <Label htmlFor="center-resource-label">{t.label}</Label>
              <Input
                id="center-resource-label"
                value={label}
                onChange={(event) => setLabel(event.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>{t.class}</Label>
              <Select
                value={classId}
                onChange={(event) => setClassId(event.target.value)}
              >
                <option value="">—</option>
                {snapshot.classes.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </Select>
            </div>
            {selected && (
              <p className="type-caption text-on-surface-variant">
                {t.selected}: {selected.name}
              </p>
            )}
            <Button
              variant="outline"
              onClick={bind}
              disabled={
                busy ||
                (kind === "calendar"
                  ? !calendar ||
                    (calendar !== "create" && !label) ||
                    (calendar === "create" && !classId)
                  : !selected || !label)
              }
            >
              {t.bind}
            </Button>
          </div>
        </>
      )}
      {resources.bindings.map((binding) => (
        <div
          key={binding.id}
          className="flex min-w-0 flex-wrap justify-between gap-2 rounded-control border border-border bg-surface p-2 type-body text-on-surface"
        >
          <span className="break-words">
            {binding.label} · {binding.kind}
          </span>
          <span className="flex items-center gap-2 type-caption text-on-surface-variant">
            {(
              {
                active: locale === "vi" ? "Đang đồng bộ" : "Active",
                revoked: locale === "vi" ? "Đã ngắt" : "Revoked",
                conflict: locale === "vi" ? "Cần đồng bộ lại" : "Sync conflict",
              } as Record<string, string>
            )[binding.state] ?? binding.state}
            <Button
              size="sm"
              variant="outline"
              disabled={
                busy ||
                !snapshot.canManageFinance ||
                binding.state === "revoked"
              }
              onClick={async () => {
                setBusy(true);
                const result = await requestCenterResourceSync(
                  clubId,
                  binding.id,
                );
                if (!result.ok) setError(result.error);
                else await onRefresh();
                setBusy(false);
              }}
            >
              {t.sync}
            </Button>
          </span>
        </div>
      ))}
      {error && (
        <p role="alert" className="type-caption text-error">
          {error}
        </p>
      )}
    </section>
  );
}
