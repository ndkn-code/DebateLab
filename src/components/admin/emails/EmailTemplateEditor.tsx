"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  Check,
  Clock3,
  Flame,
  Laptop,
  Loader2,
  Mail,
  RotateCcw,
  Save,
  Send,
  Smartphone,
  Sparkles,
  Trophy,
  Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { EmailLocale, EmailTemplateKey } from "@/lib/email/types";

type CopyFieldKey =
  | "subject"
  | "preheader"
  | "headline"
  | "body"
  | "cta_label"
  | "badge_label"
  | "stat1_label"
  | "stat2_label"
  | "stat3_label";

type TemplateCopy = Record<CopyFieldKey, string>;

interface CopyFieldConfig {
  key: CopyFieldKey;
  label: string;
  maxLength: number;
  required: boolean;
}

interface AuditEvent {
  id: string;
  action: "save" | "reset";
  fields: Partial<TemplateCopy>;
  previous_fields: Partial<TemplateCopy> | null;
  version: number;
  actor_id: string | null;
  created_at: string;
}

interface LocaleState {
  defaultCopy: TemplateCopy;
  overrideCopy: Partial<TemplateCopy> | null;
  effectiveCopy: TemplateCopy;
  hasOverride: boolean;
  version: number | null;
  updatedAt: string | null;
  updatedBy: string | null;
  audit: AuditEvent[];
}

interface TemplateItem {
  templateKey: EmailTemplateKey;
  category: string;
  preference: string;
  locales: Record<EmailLocale, LocaleState>;
}

interface TemplatePayload {
  templates: TemplateItem[];
  scenarios: Array<{ key: string; label: string }>;
  fields: CopyFieldConfig[];
}

interface PreviewState {
  subject: string;
  preheader: string;
  html: string;
  text: string;
  activeVersion: number | null;
}

const TEMPLATE_LABELS: Record<EmailTemplateKey, { title: string; helper: string; icon: typeof Mail }> = {
  welcome: { title: "welcome", helper: "Chào mừng người mới", icon: Sparkles },
  onboarding_nudge: { title: "onboarding_nudge", helper: "Nhắc hoàn tất setup", icon: Wand2 },
  practice_reminder: { title: "practice_reminder", helper: "Nhắc luyện tập", icon: BookOpen },
  streak_rescue: { title: "streak_rescue", helper: "Cứu streak", icon: Flame },
  winback: { title: "winback", helper: "Khôi phục người dùng", icon: Clock3 },
  weekly_progress: { title: "weekly_progress", helper: "Báo cáo tiến bộ tuần", icon: Mail },
  achievement: { title: "achievement", helper: "Chúc mừng thành tích", icon: Trophy },
  course_nudge: { title: "course_nudge", helper: "Nhắc học tiếp", icon: BookOpen },
  club_invitation: { title: "club_invitation", helper: "Mời vào câu lạc bộ", icon: Mail },
};

const DEFAULT_TEST_RECIPIENT = "ndkn.work@gmail.com";

function formatDate(value: string | null) {
  if (!value) return "Never";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function createEmptyCopy(): TemplateCopy {
  return {
    subject: "",
    preheader: "",
    headline: "",
    body: "",
    cta_label: "",
    badge_label: "",
    stat1_label: "",
    stat2_label: "",
    stat3_label: "",
  };
}

function sameCopy(a: TemplateCopy, b: TemplateCopy) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function mergeCopy(defaultCopy: TemplateCopy, fields: Partial<TemplateCopy> | null | undefined): TemplateCopy {
  return { ...defaultCopy, ...(fields ?? {}) };
}

function FieldEditor({
  field,
  value,
  onChange,
}: {
  field: CopyFieldConfig;
  value: string;
  onChange: (value: string) => void;
}) {
  const baseClass =
    "mt-1 w-full rounded-lg border border-outline-variant/60 bg-surface-container-lowest px-3 py-2 text-sm text-on-surface outline-none transition-colors focus:border-primary focus:ring-3 focus:ring-primary-fixed/35";
  return (
    <label className={field.key === "body" ? "sm:col-span-2" : undefined}>
      <span className="flex items-center justify-between gap-3 text-xs font-bold text-on-surface-variant">
        <span>
          {field.label}
          {!field.required ? <span className="font-medium text-muted-foreground"> optional</span> : null}
        </span>
        <span className={value.length > field.maxLength ? "text-error-dim" : "text-muted-foreground"}>
          {value.length}/{field.maxLength}
        </span>
      </span>
      {field.key === "body" ? (
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          rows={5}
          className={cn(baseClass, "resize-y leading-6")}
        />
      ) : (
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={baseClass}
        />
      )}
    </label>
  );
}

function DeviceToggle({
  value,
  onChange,
}: {
  value: "mobile" | "laptop";
  onChange: (value: "mobile" | "laptop") => void;
}) {
  return (
    <div className="inline-flex rounded-lg border border-outline-variant/60 bg-surface-container-lowest p-1">
      {[
        { key: "mobile", label: "Mobile", icon: Smartphone },
        { key: "laptop", label: "Laptop", icon: Laptop },
      ].map((item) => {
        const Icon = item.icon;
        const active = value === item.key;
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => onChange(item.key as "mobile" | "laptop")}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-bold transition-colors",
              active ? "bg-primary text-on-primary" : "text-on-surface-variant hover:bg-surface-container"
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

function LocaleToggle({
  value,
  onChange,
}: {
  value: EmailLocale;
  onChange: (value: EmailLocale) => void;
}) {
  return (
    <div className="inline-flex rounded-lg border border-outline-variant/60 bg-surface-container-lowest p-1">
      {(["vi", "en"] as EmailLocale[]).map((item) => (
        <button
          key={item}
          type="button"
          onClick={() => onChange(item)}
          className={cn(
            "h-8 rounded-md px-4 text-xs font-bold uppercase transition-colors",
            value === item ? "bg-primary text-on-primary" : "text-on-surface-variant hover:bg-surface-container"
          )}
        >
          {item}
        </button>
      ))}
    </div>
  );
}

function PreviewFrame({
  preview,
  device,
  loading,
}: {
  preview: PreviewState | null;
  device: "mobile" | "laptop";
  loading: boolean;
}) {
  const mobile = device === "mobile";
  return (
    <div className="min-w-0 overflow-auto rounded-lg bg-surface-container p-3">
      <div
        className={cn(
          "mx-auto overflow-hidden bg-[#F7FAFE] shadow-[0_24px_70px_-38px_rgba(11,20,36,0.65)]",
          mobile
            ? "w-[390px] max-w-full rounded-[2rem] border-[7px] border-[#162033]"
            : "w-[680px] max-w-full rounded-xl border border-outline-variant/70"
        )}
      >
        {loading ? (
          <div className="flex h-[720px] items-center justify-center text-sm font-semibold text-on-surface-variant">
            <Loader2 className="mr-2 h-4 w-4 animate-spin text-primary" />
            Rendering preview
          </div>
        ) : (
          <iframe
            title="Rendered Thinkfy email preview"
            srcDoc={preview?.html ?? "<html><body></body></html>"}
            sandbox=""
            referrerPolicy="no-referrer"
            className={cn("block w-full border-0 bg-[#F7FAFE]", mobile ? "h-[760px]" : "h-[720px]")}
          />
        )}
      </div>
    </div>
  );
}

export function EmailTemplateEditor() {
  const [payload, setPayload] = useState<TemplatePayload | null>(null);
  const [selectedKey, setSelectedKey] = useState<EmailTemplateKey>("welcome");
  const [locale, setLocale] = useState<EmailLocale>("vi");
  const [scenarioKey, setScenarioKey] = useState("default");
  const [device, setDevice] = useState<"mobile" | "laptop">("mobile");
  const [fields, setFields] = useState<TemplateCopy>(createEmptyCopy);
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [loading, setLoading] = useState(true);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [testRecipient, setTestRecipient] = useState(DEFAULT_TEST_RECIPIENT);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/admin/emails/templates", { cache: "no-store" });
        const data = (await response.json()) as TemplatePayload | { error?: string };
        if (!response.ok) throw new Error("error" in data ? data.error : "Unable to load templates");
        if (!cancelled) setPayload(data as TemplatePayload);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Unable to load templates");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedTemplate = useMemo(
    () => payload?.templates.find((item) => item.templateKey === selectedKey) ?? null,
    [payload, selectedKey]
  );
  const localeState = selectedTemplate?.locales[locale] ?? null;
  const effectiveCopy = localeState?.effectiveCopy ?? createEmptyCopy();
  const restoreCopy = localeState?.audit.find((event) => event.previous_fields)?.previous_fields ?? null;
  const dirty = localeState ? !sameCopy(fields, effectiveCopy) : false;

  useEffect(() => {
    if (localeState) {
      setFields(localeState.effectiveCopy);
      setNotice(null);
      setError(null);
    }
  }, [selectedKey, locale, localeState]);

  useEffect(() => {
    if (!payload || !selectedTemplate) return;
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setPreviewLoading(true);
      try {
        const response = await fetch("/api/admin/emails/templates/preview", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ templateKey: selectedKey, locale, scenarioKey, fields }),
          signal: controller.signal,
        });
        const data = (await response.json()) as PreviewState | { error?: string };
        if (!response.ok) throw new Error("error" in data ? data.error : "Unable to render preview");
        setPreview(data as PreviewState);
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(err instanceof Error ? err.message : "Unable to render preview");
        }
      } finally {
        if (!controller.signal.aborted) setPreviewLoading(false);
      }
    }, 250);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [payload, selectedTemplate, selectedKey, locale, scenarioKey, fields]);

  function updateField(key: CopyFieldKey, value: string) {
    setFields((current) => ({ ...current, [key]: value }));
  }

  async function saveLive() {
    setSaving(true);
    setNotice(null);
    setError(null);
    try {
      const response = await fetch("/api/admin/emails/templates", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ templateKey: selectedKey, locale, fields }),
      });
      const data = (await response.json()) as { payload?: TemplatePayload; error?: string };
      if (!response.ok || !data.payload) throw new Error(data.error ?? "Unable to save template");
      setPayload(data.payload);
      setNotice("Live copy saved for future sends.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save template");
    } finally {
      setSaving(false);
    }
  }

  async function resetTemplate() {
    setSaving(true);
    setNotice(null);
    setError(null);
    try {
      const response = await fetch("/api/admin/emails/templates", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ templateKey: selectedKey, locale }),
      });
      const data = (await response.json()) as { payload?: TemplatePayload; error?: string };
      if (!response.ok || !data.payload) throw new Error(data.error ?? "Unable to reset template");
      setPayload(data.payload);
      setNotice("Template reset to code defaults.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to reset template");
    } finally {
      setSaving(false);
    }
  }

  async function sendTest() {
    setSending(true);
    setNotice(null);
    setError(null);
    try {
      const response = await fetch("/api/admin/emails/templates/test-send", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ templateKey: selectedKey, locale, scenarioKey, fields, to: testRecipient }),
      });
      const data = (await response.json()) as { id?: string | null; to?: string; error?: string };
      if (!response.ok) throw new Error(data.error ?? "Unable to send test email");
      setNotice(`Test email sent to ${data.to ?? testRecipient}${data.id ? ` (${data.id})` : ""}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to send test email");
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-lg border border-outline-variant/50 bg-surface-container-lowest p-8 text-sm font-semibold text-on-surface-variant">
        <Loader2 className="mr-2 inline h-4 w-4 animate-spin text-primary" />
        Loading template editor
      </div>
    );
  }

  if (!payload || !selectedTemplate || !localeState) {
    return (
      <div className="rounded-lg border border-error/20 bg-error-container/60 p-4 text-sm font-semibold text-error-dim">
        {error ?? "Unable to load template editor."}
      </div>
    );
  }

  const selectedMeta = TEMPLATE_LABELS[selectedKey];
  const SelectedIcon = selectedMeta.icon;

  return (
    <section className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-[260px_minmax(360px,0.95fr)_minmax(390px,1.2fr)]">
      <aside className="min-w-0 overflow-hidden rounded-lg border border-outline-variant/50 bg-surface-container-lowest shadow-[0_16px_34px_-30px_rgba(11,20,36,0.35)]">
        <div className="border-b border-outline-variant/40 px-4 py-4">
          <h2 className="text-base font-extrabold text-[#0B1424]">Templates</h2>
          <p className="mt-1 text-xs text-on-surface-variant">{payload.templates.length} lifecycle templates</p>
        </div>
        <div className="divide-y divide-outline-variant/35">
          {payload.templates.map((template) => {
            const meta = TEMPLATE_LABELS[template.templateKey];
            const Icon = meta.icon;
            const state = template.locales[locale];
            const active = selectedKey === template.templateKey;
            return (
              <button
                key={template.templateKey}
                type="button"
                onClick={() => setSelectedKey(template.templateKey)}
                className={cn(
                  "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors",
                  active ? "bg-primary-container ring-1 ring-inset ring-primary/60" : "hover:bg-surface-container"
                )}
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-container text-primary">
                  <Icon className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-extrabold text-[#0B1424]">{meta.title}</span>
                  <span className="block truncate text-xs text-on-surface-variant">{meta.helper}</span>
                </span>
                <span
                  className={cn(
                    "rounded-full border px-2 py-0.5 text-[10px] font-extrabold uppercase",
                    state.hasOverride
                      ? "border-secondary/20 bg-secondary-container text-secondary-dim"
                      : "border-outline-variant/60 bg-surface-container-lowest text-muted-foreground"
                  )}
                >
                  {state.hasOverride ? "Live" : "Default"}
                </span>
              </button>
            );
          })}
        </div>
      </aside>

      <div className="min-w-0 rounded-lg border border-outline-variant/50 bg-surface-container-lowest shadow-[0_16px_34px_-30px_rgba(11,20,36,0.35)]">
        <div className="flex items-start justify-between gap-3 border-b border-outline-variant/40 px-4 py-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <SelectedIcon className="h-5 w-5 text-primary" />
              <h2 className="truncate text-lg font-extrabold text-[#0B1424]">
                Template editor: {selectedMeta.title}
              </h2>
              <span
                className={cn(
                  "rounded-full border px-2 py-0.5 text-[10px] font-extrabold uppercase",
                  localeState.hasOverride
                    ? "border-secondary/20 bg-secondary-container text-secondary-dim"
                    : "border-outline-variant/60 bg-surface-container text-muted-foreground"
                )}
              >
                {localeState.hasOverride ? `Live v${localeState.version}` : "Default"}
              </span>
            </div>
            <p className="mt-1 text-xs text-on-surface-variant">
              Last updated: {formatDate(localeState.updatedAt)}
              {localeState.updatedBy ? ` by ${localeState.updatedBy.slice(0, 8)}` : ""}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="icon"
            title="Restore latest previous copy into the editor"
            disabled={!restoreCopy || saving}
            onClick={() => restoreCopy && setFields(mergeCopy(localeState.defaultCopy, restoreCopy))}
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-4 p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {payload.fields.map((field) => (
              <FieldEditor
                key={field.key}
                field={field}
                value={fields[field.key] ?? ""}
                onChange={(value) => updateField(field.key, value)}
              />
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3 border-t border-outline-variant/40 pt-4">
            <Button type="button" onClick={saveLive} disabled={!dirty || saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save live
            </Button>
            <Button type="button" variant="outline" onClick={resetTemplate} disabled={saving || !localeState.hasOverride}>
              <RotateCcw className="h-4 w-4" />
              Reset
            </Button>
            <div className="flex min-w-[220px] flex-1 items-center gap-2">
              <input
                value={testRecipient}
                onChange={(event) => setTestRecipient(event.target.value)}
                className="h-9 min-w-0 flex-1 rounded-lg border border-outline-variant/60 bg-surface-container-lowest px-3 text-sm outline-none focus:border-primary"
                aria-label="Test recipient"
              />
              <Button type="button" variant="outline" onClick={sendTest} disabled={sending}>
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Send test
              </Button>
            </div>
          </div>

          {notice ? (
            <p className="rounded-lg bg-secondary-container/70 px-3 py-2 text-xs font-semibold text-secondary-dim">
              <Check className="mr-1 inline h-3.5 w-3.5" />
              {notice}
            </p>
          ) : null}
          {error ? (
            <p className="rounded-lg bg-error-container/70 px-3 py-2 text-xs font-semibold text-error-dim">
              {error}
            </p>
          ) : null}

          <div className="rounded-lg bg-surface-container-low p-3 text-xs text-on-surface-variant">
            Changes apply to future automated emails for this template and locale. Existing send records stay unchanged.
          </div>
        </div>
      </div>

      <div className="min-w-0 rounded-lg border border-outline-variant/50 bg-surface-container-lowest p-4 shadow-[0_16px_34px_-30px_rgba(11,20,36,0.35)]">
        <div className="flex flex-col gap-3 border-b border-outline-variant/40 pb-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-extrabold text-[#0B1424]">Preview studio</h2>
              <p className="mt-1 text-xs text-on-surface-variant">Sandboxed render from production email HTML.</p>
            </div>
            <DeviceToggle value={device} onChange={setDevice} />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[auto_minmax(0,1fr)]">
            <div>
              <p className="mb-1 text-xs font-bold text-on-surface-variant">Locale</p>
              <LocaleToggle value={locale} onChange={setLocale} />
            </div>
            <label>
              <span className="mb-1 block text-xs font-bold text-on-surface-variant">Scenario</span>
              <Select value={scenarioKey} onChange={(event) => setScenarioKey(event.target.value)}>
                {payload.scenarios.map((scenario) => (
                  <option key={scenario.key} value={scenario.key}>
                    {scenario.label}
                  </option>
                ))}
              </Select>
            </label>
          </div>
        </div>

        <div className="my-4 rounded-lg border border-outline-variant/50 bg-surface-container-lowest px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-container text-primary">
              <Mail className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-extrabold text-[#0B1424]">{preview?.subject ?? fields.subject}</p>
              <p className="truncate text-xs text-on-surface-variant">{preview?.preheader ?? fields.preheader}</p>
            </div>
            <span className="text-xs font-semibold text-muted-foreground">9:41 AM</span>
          </div>
        </div>

        <PreviewFrame preview={preview} device={device} loading={previewLoading} />
      </div>
    </section>
  );
}
