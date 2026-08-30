"use client";

import { useMemo, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  BellRing,
  Check,
  Info,
  Loader2,
  Lock,
  Mail,
  Moon,
} from "@/components/ui/icons";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  buildDefaultNotificationPreferences,
  type EmailDeliveryMode,
  type NotificationPreferenceV1,
  type NotificationUiOperations,
} from "./contracts";
import { getNotificationCopy, type NotificationLocale } from "./copy";

const TIMEZONES = [
  "America/New_York",
  "America/Los_Angeles",
  "Europe/London",
  "Asia/Ho_Chi_Minh",
  "Asia/Singapore",
  "Australia/Sydney",
] as const;

function browserTimezone() {
  if (typeof Intl === "undefined") return "Asia/Ho_Chi_Minh";
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Ho_Chi_Minh";
}

interface NotificationPreferencesPanelProps {
  locale: NotificationLocale;
  preferences?: NotificationPreferenceV1[];
  operations?: Pick<NotificationUiOperations, "updatePreferences">;
  migratedPreferenceReviewRequired?: boolean;
  onReviewDismiss?: () => void;
}

export function NotificationPreferencesPanel({
  locale,
  preferences,
  operations,
  migratedPreferenceReviewRequired = false,
  onReviewDismiss,
}: NotificationPreferencesPanelProps) {
  const copy = getNotificationCopy(locale).settings;
  const defaultPreferences = useMemo(
    () => buildDefaultNotificationPreferences(browserTimezone()),
    [],
  );
  const [saved, setSaved] = useState(preferences ?? defaultPreferences);
  const [draft, setDraft] = useState(preferences ?? defaultPreferences);
  const [reviewVisible, setReviewVisible] = useState(
    migratedPreferenceReviewRequired,
  );
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [isPending, startTransition] = useTransition();

  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  const optionalEmailEnabled = draft.some(
    (preference) =>
      preference.messageClass === "optional" && preference.channels.email,
  );
  const sharedSchedule = draft[0] ?? defaultPreferences[0];
  const timezoneOptions = useMemo(
    () => Array.from(new Set([sharedSchedule.timezone, ...TIMEZONES])),
    [sharedSchedule.timezone],
  );

  function updatePreference(
    topic: NotificationPreferenceV1["topic"],
    update: (current: NotificationPreferenceV1) => NotificationPreferenceV1,
  ) {
    setStatus("idle");
    setDraft((current) =>
      current.map((preference) =>
        preference.topic === topic ? update(preference) : preference,
      ),
    );
  }

  function updateSchedule(
    update: Pick<NotificationPreferenceV1, "timezone" | "quietHours">,
  ) {
    setStatus("idle");
    setDraft((current) =>
      current.map((preference) => ({ ...preference, ...update })),
    );
  }

  function toggleOptionalEmail(enabled: boolean) {
    setStatus("idle");
    setDraft((current) =>
      current.map((preference) => {
        if (preference.messageClass === "essential") return preference;
        return {
          ...preference,
          channels: { ...preference.channels, email: enabled },
          emailDeliveryMode: enabled ? "daily" : "off",
        };
      }),
    );
  }

  function dismissReview() {
    setReviewVisible(false);
    onReviewDismiss?.();
  }

  function savePreferences() {
    if (!operations) return;
    startTransition(async () => {
      setStatus("idle");
      try {
        const next = await operations.updatePreferences(draft);
        setDraft(next);
        setSaved(next);
        setStatus("saved");
        dismissReview();
      } catch {
        setStatus("error");
      }
    });
  }

  return (
    <div className="divide-y divide-outline-variant/60">
      {reviewVisible ? (
        <div className="m-4 flex flex-col gap-3 rounded-[10px] border border-primary/20 bg-primary-container/45 p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <Info
              className="mt-0.5 h-4 w-4 shrink-0 text-primary"
              aria-hidden="true"
            />
            <div>
              <p className="type-label font-semibold text-on-surface">
                {copy.reviewTitle}
              </p>
              <p className="mt-1 type-body-sm text-on-surface-variant">
                {copy.reviewBody}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button type="button" variant="ghost" onClick={dismissReview}>
              {copy.reviewDismiss}
            </Button>
            <Button
              type="button"
              onClick={() =>
                document
                  .getElementById("notification-topic-table")
                  ?.scrollIntoView({ block: "center", behavior: "auto" })
              }
            >
              {copy.reviewAction}
            </Button>
          </div>
        </div>
      ) : null}

      <div className="grid min-h-11 gap-3 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-[8px] bg-surface-container text-on-surface-variant">
            <Mail className="h-4 w-4" aria-hidden="true" />
          </span>
          <div>
            <p className="type-label font-semibold text-on-surface">
              {copy.optionalEmail}
            </p>
            <p className="mt-0.5 type-body-sm text-on-surface-variant">
              {copy.optionalEmailBody}
            </p>
          </div>
        </div>
        <Switch
          checked={optionalEmailEnabled}
          onCheckedChange={toggleOptionalEmail}
          aria-label={copy.optionalEmail}
        />
      </div>

      <div id="notification-topic-table" className="overflow-x-auto">
        <div className="min-w-[680px]">
          <div className="grid grid-cols-[minmax(260px,1fr)_88px_88px_170px] items-center border-b border-outline-variant/60 bg-surface-container-low px-4 py-2 type-caption font-semibold text-on-surface-variant">
            <span>{copy.title}</span>
            <span className="text-center">{copy.inApp}</span>
            <span className="text-center">{copy.email}</span>
            <span>{copy.cadence}</span>
          </div>
          {draft.map((preference) => {
            const [title, description] = copy.topics[preference.topic];
            const essential = preference.messageClass === "essential";
            return (
              <div
                key={preference.topic}
                className="grid min-h-11 grid-cols-[minmax(260px,1fr)_88px_88px_170px] items-center border-b border-outline-variant/40 px-4 py-2.5 last:border-b-0"
              >
                <div className="min-w-0 pr-4">
                  <div className="flex items-center gap-2">
                    <p className="type-label font-semibold text-on-surface">
                      {title}
                    </p>
                    {essential ? (
                      <span className="inline-flex h-5 items-center gap-1 rounded-[6px] bg-surface-container px-1.5 type-caption font-semibold text-on-surface-variant">
                        <Lock className="h-3 w-3" aria-hidden="true" />
                        {copy.essential}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-0.5 type-caption text-on-surface-variant">
                    {essential ? copy.essentialHelp : description}
                  </p>
                </div>
                <div className="flex justify-center">
                  <Switch
                    checked={preference.channels.in_app}
                    disabled={essential}
                    aria-label={`${title}: ${copy.inApp}`}
                    onCheckedChange={(checked) =>
                      updatePreference(preference.topic, (current) => ({
                        ...current,
                        channels: { ...current.channels, in_app: checked },
                      }))
                    }
                  />
                </div>
                <div className="flex justify-center">
                  <Switch
                    checked={preference.channels.email}
                    disabled={essential}
                    aria-label={`${title}: ${copy.email}`}
                    onCheckedChange={(checked) =>
                      updatePreference(preference.topic, (current) => ({
                        ...current,
                        channels: { ...current.channels, email: checked },
                        emailDeliveryMode: checked ? "immediate" : "off",
                      }))
                    }
                  />
                </div>
                <Select
                  value={preference.emailDeliveryMode}
                  disabled={essential || !preference.channels.email}
                  aria-label={`${title}: ${copy.cadence}`}
                  className="h-8 py-1 type-label"
                  onChange={(event) =>
                    updatePreference(preference.topic, (current) => ({
                      ...current,
                      emailDeliveryMode: event.target
                        .value as EmailDeliveryMode,
                    }))
                  }
                >
                  {(["immediate", "daily", "weekly"] as const).map((mode) => (
                    <option key={mode} value={mode}>
                      {copy.cadenceLabels[mode]}
                    </option>
                  ))}
                  {!preference.channels.email ? (
                    <option value="off">{copy.cadenceLabels.off}</option>
                  ) : null}
                </Select>
              </div>
            );
          })}
        </div>
      </div>

      <div className="p-4">
        <div className="flex items-center gap-2">
          <Moon
            className="h-4 w-4 text-on-surface-variant"
            aria-hidden="true"
          />
          <h3 className="type-label font-semibold text-on-surface">
            {copy.deliveryTitle}
          </h3>
        </div>
        <div className="mt-3 grid gap-4 lg:grid-cols-[minmax(220px,1fr)_auto_auto_auto] lg:items-end">
          <label className="grid gap-1 type-label font-medium text-on-surface">
            {copy.timezone}
            <Select
              value={sharedSchedule.timezone}
              onChange={(event) =>
                updateSchedule({
                  timezone: event.target.value,
                  quietHours: sharedSchedule.quietHours,
                })
              }
              className="h-8 py-1"
            >
              {timezoneOptions.map((timezone) => (
                <option key={timezone} value={timezone}>
                  {timezone.replaceAll("_", " ")}
                </option>
              ))}
            </Select>
          </label>
          <div className="flex items-end gap-2">
            <label className="grid gap-1 type-label font-medium text-on-surface">
              {copy.start}
              <input
                type="time"
                value={sharedSchedule.quietHours.start}
                disabled={!sharedSchedule.quietHours.enabled}
                onChange={(event) =>
                  updateSchedule({
                    timezone: sharedSchedule.timezone,
                    quietHours: {
                      ...sharedSchedule.quietHours,
                      start: event.target.value,
                    },
                  })
                }
                className="h-8 rounded-[10px] border border-outline-variant bg-surface-container-lowest px-2 type-label outline-none focus-visible:ring-3 focus-visible:ring-ring/40 disabled:opacity-50"
              />
            </label>
            <label className="grid gap-1 type-label font-medium text-on-surface">
              {copy.end}
              <input
                type="time"
                value={sharedSchedule.quietHours.end}
                disabled={!sharedSchedule.quietHours.enabled}
                onChange={(event) =>
                  updateSchedule({
                    timezone: sharedSchedule.timezone,
                    quietHours: {
                      ...sharedSchedule.quietHours,
                      end: event.target.value,
                    },
                  })
                }
                className="h-8 rounded-[10px] border border-outline-variant bg-surface-container-lowest px-2 type-label outline-none focus-visible:ring-3 focus-visible:ring-ring/40 disabled:opacity-50"
              />
            </label>
          </div>
          <div className="flex items-center gap-2 pb-0.5">
            <Switch
              checked={sharedSchedule.quietHours.enabled}
              onCheckedChange={(enabled) =>
                updateSchedule({
                  timezone: sharedSchedule.timezone,
                  quietHours: { ...sharedSchedule.quietHours, enabled },
                })
              }
              aria-label={copy.quietHours}
            />
            <div>
              <p className="type-label font-semibold text-on-surface">
                {copy.quietHours}
              </p>
              <p className="max-w-xs type-caption text-on-surface-variant">
                {copy.quietHoursBody}
              </p>
            </div>
          </div>
          <Button
            type="button"
            onClick={savePreferences}
            disabled={!dirty || isPending || !operations}
            className="gap-2"
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : status === "saved" ? (
              <Check className="h-4 w-4" aria-hidden="true" />
            ) : (
              <BellRing className="h-4 w-4" aria-hidden="true" />
            )}
            {copy.save}
          </Button>
        </div>
        <p
          aria-live="polite"
          className={cn(
            "mt-3 type-caption",
            status === "error" ? "text-error" : "text-on-surface-variant",
          )}
        >
          {status === "saved"
            ? copy.saved
            : status === "error"
              ? copy.saveError
              : !operations
                ? copy.wiring
                : ""}
        </p>
      </div>
    </div>
  );
}
