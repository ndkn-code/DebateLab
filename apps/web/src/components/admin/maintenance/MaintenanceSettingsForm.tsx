"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { saveMaintenanceSettings } from "@/app/actions/maintenance";
import { AlertTriangle, Megaphone, Save, Settings, ShieldCheck } from "@/components/ui/icons";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  maintenanceModes,
  maintenanceUpdateSchema,
  type MaintenanceMode,
  type MaintenanceState,
} from "@/lib/maintenance/model";

const MODE_ICONS = { off: ShieldCheck, banner: Megaphone, full: AlertTriangle } as const;

function toDateTimeInput(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function defaultDoneAt() {
  return toDateTimeInput(new Date(Date.now() + 60 * 60_000).toISOString());
}

export function MaintenanceSettingsForm({ initialState }: { initialState: MaintenanceState }) {
  const t = useTranslations("admin.maintenance");
  const [state, setState] = useState(initialState);
  const [doneAtInput, setDoneAtInput] = useState(toDateTimeInput(initialState.expectedDoneAt));
  const [pending, startTransition] = useTransition();

  function selectMode(mode: MaintenanceMode) {
    setState((current) => ({ ...current, mode }));
    if (mode === "full" && !doneAtInput) setDoneAtInput(defaultDoneAt());
  }

  function save() {
    const candidate = {
      mode: state.mode,
      bannerMessage: state.bannerMessage,
      fullMessage: state.fullMessage,
      expectedDoneAt: state.mode === "full" && doneAtInput
        ? new Date(doneAtInput).toISOString()
        : null,
    };
    const validation = maintenanceUpdateSchema.safeParse(candidate);
    if (!validation.success) {
      toast.error(validation.error.issues[0]?.message ?? t("invalid"));
      return;
    }
    startTransition(async () => {
      try {
        const saved = await saveMaintenanceSettings(validation.data);
        setState(saved);
        setDoneAtInput(toDateTimeInput(saved.expectedDoneAt));
        toast.success(t("saved"));
      } catch (error) {
        toast.error(error instanceof Error ? error.message : t("saveFailed"));
      }
    });
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 p-4 sm:p-6 lg:p-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="type-eyebrow text-primary-dim">{t("eyebrow")}</p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-on-surface">{t("title")}</h1>
          <p className="mt-2 max-w-2xl text-sm text-on-surface-variant">{t("description")}</p>
        </div>
        <Button onClick={save} disabled={pending} size="lg">
          <Save aria-hidden="true" />
          {pending ? t("saving") : t("save")}
        </Button>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>{t("modeTitle")}</CardTitle>
          <CardDescription>{t("modeDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          {maintenanceModes.map((mode) => {
            const Icon = MODE_ICONS[mode];
            const selected = state.mode === mode;
            return (
              <button
                key={mode}
                type="button"
                aria-pressed={selected}
                onClick={() => selectMode(mode)}
                className={cn(
                  "flex min-h-24 items-start gap-3 rounded-xl border p-4 text-left transition-colors",
                  selected
                    ? "border-primary bg-primary-container text-primary-dim"
                    : "border-outline-variant/30 bg-surface text-on-surface hover:bg-surface-container-low",
                )}
              >
                <Icon className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
                <span>
                  <span className="block font-extrabold">{t(`modes.${mode}.label`)}</span>
                  <span className="mt-1 block text-xs leading-relaxed text-on-surface-variant">
                    {t(`modes.${mode}.description`)}
                  </span>
                </span>
              </button>
            );
          })}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <MessageCard
          title={t("bannerTitle")}
          description={t("bannerDescription")}
          value={state.bannerMessage}
          onChange={(locale, value) => setState((current) => ({
            ...current,
            bannerMessage: { ...current.bannerMessage, [locale]: value },
          }))}
        />
        <MessageCard
          title={t("fullTitle")}
          description={t("fullDescription")}
          value={state.fullMessage}
          onChange={(locale, value) => setState((current) => ({
            ...current,
            fullMessage: { ...current.fullMessage, [locale]: value },
          }))}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="size-5 text-primary" aria-hidden="true" />
            {t("doneAtTitle")}
          </CardTitle>
          <CardDescription>{t("doneAtDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="max-w-md space-y-2">
          <Label htmlFor="maintenance-done-at">{t("doneAtLabel")}</Label>
          <Input
            id="maintenance-done-at"
            type="datetime-local"
            value={doneAtInput}
            disabled={state.mode !== "full"}
            onChange={(event) => setDoneAtInput(event.target.value)}
          />
          <p className="text-xs text-on-surface-variant">{t("doneAtHint")}</p>
        </CardContent>
      </Card>
    </div>
  );
}

function MessageCard({
  title,
  description,
  value,
  onChange,
}: {
  title: string;
  description: string;
  value: { en: string; vi: string };
  onChange: (locale: "en" | "vi", value: string) => void;
}) {
  const t = useTranslations("admin.maintenance");
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {(["en", "vi"] as const).map((locale) => (
          <div key={locale} className="space-y-2">
            <Label htmlFor={`${title}-${locale}`}>{t(`languages.${locale}`)}</Label>
            <textarea
              id={`${title}-${locale}`}
              rows={4}
              value={value[locale]}
              onChange={(event) => onChange(locale, event.target.value)}
              className="w-full resize-y rounded-xl border border-input bg-surface px-3 py-2 text-sm text-on-surface outline-none transition focus:border-primary focus:ring-3 focus:ring-primary/20"
            />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
