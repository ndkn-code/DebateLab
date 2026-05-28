"use client";

import type React from "react";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import {
  BellRing,
  Camera,
  Clock3,
  Globe2,
  Loader2,
  LogOut,
  Save,
  SlidersHorizontal,
  Sparkles,
} from "@/components/ui/icons";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { DurationControl } from "@/components/shared/duration-control";
import { showToast } from "@/components/shared/toast";
import { VoiceSettings } from "@/components/settings/voice-settings";
import { saveSettings } from "@/app/[locale]/(protected)/settings/actions";
import {
  AI_DIFFICULTY_OPTIONS,
  SETTINGS_DRAFT_STORAGE_KEY,
  type SettingsDraft,
  type SettingsDraftSnapshot,
  type SettingsLocale,
  buildSavedSettingsDraft,
  buildSettingsDraft,
} from "@/lib/settings";
import {
  coercePracticeLanguage,
} from "@/lib/practice-language";
import {
  SOLO_PREP_DURATION,
  SOLO_SPEECH_DURATION,
} from "@/lib/practice-durations";
import { coerceVoiceForLanguage } from "@/lib/tts-voices";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { Profile } from "@/types/database";

interface SettingsContentProps {
  profile: Profile | null;
  userEmail: string;
  currentLocale: SettingsLocale;
}

function readStoredSnapshot() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(SETTINGS_DRAFT_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    return JSON.parse(raw) as SettingsDraftSnapshot;
  } catch {
    return null;
  }
}

function isRenderableAvatar(avatarUrl: string) {
  return (
    avatarUrl.startsWith("http://") ||
    avatarUrl.startsWith("https://") ||
    avatarUrl.startsWith("/") ||
    avatarUrl.startsWith("data:image/")
  );
}

function formatInitials(name: string) {
  const tokens = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (tokens.length === 0) {
    return "DL";
  }

  return tokens.map((token) => token[0]?.toUpperCase() ?? "").join("");
}

function SettingsCard(props: {
  icon: React.ReactNode;
  title: string;
  description: string;
  className?: string;
  children: React.ReactNode;
}) {
  const { icon, title, description, className, children } = props;

  return (
    <section
      className={cn(
        "rounded-[28px] border border-[#dbe5fb] bg-white/90 p-5 shadow-[0_18px_48px_-38px_rgba(34,67,138,0.5)] backdrop-blur dark:border-outline-variant/70 dark:bg-surface/92",
        className
      )}
    >
      <div className="mb-5 flex items-start gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#edf3ff] text-primary dark:bg-primary-container">
          {icon}
        </div>
        <div>
          <h2 className="text-base font-semibold text-[#172554] dark:text-on-surface">{title}</h2>
          <p className="mt-1 text-sm text-[#64748b] dark:text-on-surface-variant">{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function SettingLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-2 block text-sm font-medium text-[#1e3a5f] dark:text-on-surface">
      {children}
    </label>
  );
}

function ToggleRow(props: {
  title: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  const { title, description, checked, onCheckedChange } = props;

  return (
    <div className="flex items-start justify-between gap-4 rounded-2xl border border-[#edf2fb] bg-[#fbfdff] px-4 py-3 dark:border-outline-variant/70 dark:bg-surface-container-lowest">
      <div className="min-w-0">
        <p className="text-sm font-medium text-[#172554] dark:text-on-surface">{title}</p>
        <p className="mt-1 text-sm text-[#64748b] dark:text-on-surface-variant">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

async function fileToAvatarDataUrl(file: File) {
  const imageUrl = URL.createObjectURL(file);

  try {
    const image = new Image();
    image.src = imageUrl;
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = reject;
    });

    const size = Math.min(image.width, image.height);
    const sourceX = Math.max(0, (image.width - size) / 2);
    const sourceY = Math.max(0, (image.height - size) / 2);
    const outputSize = 320;
    const canvas = document.createElement("canvas");
    canvas.width = outputSize;
    canvas.height = outputSize;

    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Unable to process avatar image");
    }

    context.drawImage(
      image,
      sourceX,
      sourceY,
      size,
      size,
      0,
      0,
      outputSize,
      outputSize
    );

    return canvas.toDataURL("image/jpeg", 0.86);
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}

function AvatarPreview(props: {
  avatarUrl: string;
  displayName: string;
  sizeClassName?: string;
  textClassName?: string;
}) {
  const {
    avatarUrl,
    displayName,
    sizeClassName = "h-20 w-20",
    textClassName = "text-xl",
  } = props;
  const initials = formatInitials(displayName);

  return (
    <div
      className={cn(
        "overflow-hidden rounded-[26px] border border-white/80 bg-[#edf3ff] shadow-inner dark:border-outline-variant/70 dark:bg-primary-container",
        sizeClassName
      )}
    >
      {isRenderableAvatar(avatarUrl) ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={avatarUrl}
          alt={displayName || "Profile avatar"}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_top,_#4d86f7,_#1d4ed8)] font-semibold text-white">
          <span className={textClassName}>{initials}</span>
        </div>
      )}
    </div>
  );
}

export function SettingsContent({
  profile,
  userEmail,
  currentLocale,
}: SettingsContentProps) {
  const t = useTranslations("settings");
  const router = useRouter();
  const pathname = usePathname();
  const locale = useLocale() as SettingsLocale;
  const [isSaving, startSavingTransition] = useTransition();
  const [isLocalePending, startLocaleTransition] = useTransition();
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [isAvatarProcessing, setIsAvatarProcessing] = useState(false);

  const serverSavedDraft = useMemo(
    () =>
      buildSavedSettingsDraft({
        displayName: profile?.display_name,
        avatarUrl: profile?.avatar_url,
        preferences: (profile?.preferences as Record<string, unknown> | null) ?? {},
        currentLocale,
      }),
    [currentLocale, profile]
  );

  const serverDraft = useMemo(
    () =>
      buildSettingsDraft({
        displayName: profile?.display_name,
        avatarUrl: profile?.avatar_url,
        preferences: (profile?.preferences as Record<string, unknown> | null) ?? {},
        currentLocale,
      }),
    [currentLocale, profile]
  );

  const userId = profile?.id ?? "";
  const savedSignature = useMemo(
    () => JSON.stringify(serverSavedDraft),
    [serverSavedDraft]
  );
  const [localSavedDraft, setLocalSavedDraft] = useState<SettingsDraft | null>(
    null
  );
  const [draft, setDraft] = useState<SettingsDraft>(serverDraft);
  const [hasHydratedStoredDraft, setHasHydratedStoredDraft] = useState(false);

  useEffect(() => {
    const snapshot = readStoredSnapshot();

    if (
      snapshot &&
      snapshot.userId === userId &&
      JSON.stringify(snapshot.saved) === savedSignature
    ) {
      const practiceLanguage = coercePracticeLanguage(
        snapshot.draft.preferredLocale
      );
      setDraft({
        ...snapshot.draft,
        practiceLanguage,
        ttsVoice: coerceVoiceForLanguage(
          snapshot.draft.ttsVoice,
          practiceLanguage
        ),
        smartFeaturePopups:
          typeof snapshot.draft.smartFeaturePopups === "boolean"
            ? snapshot.draft.smartFeaturePopups
            : serverDraft.smartFeaturePopups,
        analyticsCookiesEnabled: serverDraft.analyticsCookiesEnabled,
      });
    }

    setHasHydratedStoredDraft(true);
  }, [savedSignature, serverDraft, userId]);

  const effectiveSavedDraft =
    localSavedDraft &&
    JSON.stringify(localSavedDraft) !== savedSignature
      ? localSavedDraft
      : serverSavedDraft;
  const draftSignature = useMemo(() => JSON.stringify(draft), [draft]);
  const savedDraftSignature = useMemo(
    () => JSON.stringify(effectiveSavedDraft),
    [effectiveSavedDraft]
  );
  const isDirty = draftSignature !== savedDraftSignature;

  useEffect(() => {
    if (!hasHydratedStoredDraft || !userId || typeof window === "undefined") {
      return;
    }

    const snapshot: SettingsDraftSnapshot = {
      userId,
      draft,
      saved: effectiveSavedDraft,
    };

    window.localStorage.setItem(
      SETTINGS_DRAFT_STORAGE_KEY,
      JSON.stringify(snapshot)
    );
  }, [draft, effectiveSavedDraft, hasHydratedStoredDraft, userId]);

  function updateDraft<K extends keyof SettingsDraft>(
    key: K,
    value: SettingsDraft[K]
  ) {
    setDraft((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function handleLocaleChange(nextLocale: SettingsLocale) {
    const practiceLanguage = coercePracticeLanguage(nextLocale);
    setDraft((current) => ({
      ...current,
      preferredLocale: nextLocale,
      practiceLanguage,
      ttsVoice: coerceVoiceForLanguage(current.ttsVoice, practiceLanguage),
    }));
    if (nextLocale === locale) {
      return;
    }

    startLocaleTransition(() => {
      router.replace(pathname, { locale: nextLocale });
    });
  }

  async function handleAvatarFileChange(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      showToast(t("toast.avatar_invalid"), "warning");
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      showToast(t("toast.avatar_too_large"), "warning");
      return;
    }

    setIsAvatarProcessing(true);
    try {
      const avatarUrl = await fileToAvatarDataUrl(file);
      updateDraft("avatarUrl", avatarUrl);
    } catch {
      showToast(t("toast.avatar_invalid"), "error");
    } finally {
      setIsAvatarProcessing(false);
    }
  }

  function handleSave() {
    startSavingTransition(async () => {
      try {
        const result = await saveSettings(draft);
        setLocalSavedDraft(result.saved);
        setDraft(result.saved);
        router.refresh();
        showToast(t("toast.saved"), "success");
      } catch (error) {
        showToast(
          error instanceof Error ? error.message : t("toast.save_error"),
          "error"
        );
      }
    });
  }

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
  }

  return (
    <div className="min-h-full bg-[linear-gradient(180deg,#f6f8fc_0%,#f8fbff_55%,#f3f7ff_100%)] dark:bg-[linear-gradient(180deg,#070b12_0%,#0b111c_55%,#080c13_100%)]">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-[#172554] sm:text-[2rem] dark:text-on-surface">
              {t("headline")}
            </h1>
          </div>

          <div className="flex items-center gap-3 self-start">
            <div className="hidden rounded-full bg-white/80 px-3 py-1.5 text-xs font-medium text-[#64748b] shadow-sm dark:bg-surface/80 dark:text-on-surface-variant sm:block">
              {isDirty ? t("status.unsaved") : t("status.saved")}
            </div>
            <Button
              type="button"
              onClick={handleSave}
              disabled={!isDirty || isSaving}
              className="gap-2 rounded-2xl bg-primary px-5 text-white shadow-[0_18px_35px_-28px_rgba(44,108,246,0.9)]"
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {t("save_changes")}
            </Button>
          </div>
        </div>

        <section className="mb-5 rounded-[30px] border border-[#dbe5fb] bg-white/95 p-5 shadow-[0_25px_60px_-45px_rgba(29,78,216,0.55)] dark:border-outline-variant/70 dark:bg-surface/95">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="relative shrink-0">
              <AvatarPreview
                avatarUrl={draft.avatarUrl}
                displayName={draft.displayName}
                sizeClassName="h-24 w-24"
                textClassName="text-2xl"
              />
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                capture="user"
                onChange={handleAvatarFileChange}
                className="sr-only"
              />
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                disabled={isAvatarProcessing}
                aria-label={t("avatar_upload")}
                className="absolute -bottom-1 -right-1 flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-primary text-white shadow-[0_12px_28px_-18px_rgba(44,108,246,0.9)] transition hover:bg-primary/90 disabled:opacity-70"
              >
                {isAvatarProcessing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Camera className="h-4 w-4" />
                )}
              </button>
            </div>

            <div className="grid min-w-0 flex-1 gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
              <div className="min-w-0">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-[#edf3ff] px-3 py-1 text-xs font-medium text-primary dark:bg-primary-container">
                    {t(`languages.${draft.preferredLocale}`)}
                  </span>
                </div>
                <SettingLabel>{t("fields.display_name")}</SettingLabel>
                <input
                  type="text"
                  value={draft.displayName}
                  onChange={(event) =>
                    updateDraft("displayName", event.target.value)
                  }
                  placeholder={t("fields.display_name_placeholder")}
                  className="h-11 w-full max-w-xl rounded-2xl border border-[#d8e3f8] bg-[#fbfdff] px-4 text-sm font-medium text-[#172554] outline-none transition-colors focus:border-primary dark:border-outline-variant/70 dark:bg-surface-container-lowest dark:text-on-surface"
                />
                <p className="mt-2 truncate text-sm text-[#64748b] dark:text-on-surface-variant">{userEmail}</p>
                <p className="mt-2 max-w-2xl text-sm text-[#64748b] dark:text-on-surface-variant">
                  {t("hero_summary")}
                </p>
              </div>

              <div className="hidden rounded-2xl border border-[#edf2fb] bg-[#fbfdff] px-4 py-3 text-sm text-[#64748b] dark:border-outline-variant/70 dark:bg-surface-container-lowest dark:text-on-surface-variant lg:block lg:max-w-xs">
                {isDirty ? t("status.unsaved") : t("status.saved")}
              </div>
            </div>
          </div>
        </section>

        <div className="grid gap-5 xl:grid-cols-3">
          <SettingsCard
            icon={<Clock3 className="h-5 w-5" />}
            title={t("cards.practice.title")}
            description={t("cards.practice.description")}
          >
            <div className="space-y-4">
              <DurationControl
                label={t("fields.default_prep_time")}
                value={draft.defaultPrepTime}
                config={SOLO_PREP_DURATION}
                onChange={(seconds) => updateDraft("defaultPrepTime", seconds)}
                helper={t("duration_helper.prep")}
                compact
              />

              <DurationControl
                label={t("fields.default_speech_time")}
                value={draft.defaultSpeechTime}
                config={SOLO_SPEECH_DURATION}
                onChange={(seconds) => updateDraft("defaultSpeechTime", seconds)}
                helper={t("duration_helper.speech")}
                compact
              />

              <div>
                <SettingLabel>{t("fields.default_difficulty")}</SettingLabel>
                <Select
                  value={draft.defaultDifficulty}
                  onChange={(event) =>
                    updateDraft(
                      "defaultDifficulty",
                      event.target.value as SettingsDraft["defaultDifficulty"]
                    )
                  }
                >
                  {AI_DIFFICULTY_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {t(`difficulty.${option}`)}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
          </SettingsCard>

          <SettingsCard
            icon={<Globe2 className="h-5 w-5" />}
            title={t("cards.language.title")}
            description={t("cards.language.description")}
          >
            <div className="space-y-4">
              <div>
                <SettingLabel>{t("fields.app_language")}</SettingLabel>
                <Select
                  value={draft.preferredLocale}
                  onChange={(event) =>
                    handleLocaleChange(event.target.value as SettingsLocale)
                  }
                  disabled={isLocalePending}
                >
                  <option value="en">{t("languages.en")}</option>
                  <option value="vi">{t("languages.vi")}</option>
                </Select>
              </div>
              <div className="rounded-2xl border border-[#edf2fb] bg-[#fbfdff] px-4 py-3 text-sm text-[#64748b] dark:border-outline-variant/70 dark:bg-surface-container-lowest dark:text-on-surface-variant">
                {isLocalePending
                  ? t("language_switching")
                  : t("language_hint")}
              </div>
            </div>
          </SettingsCard>

          <SettingsCard
            icon={<Sparkles className="h-5 w-5" />}
            title={t("cards.voice.title")}
            description={t("cards.voice.description")}
            className="xl:col-span-2"
          >
            <VoiceSettings
              currentVoice={draft.ttsVoice}
              practiceLanguage={draft.practiceLanguage}
              onVoiceChange={(voiceId) => updateDraft("ttsVoice", voiceId)}
            />
          </SettingsCard>

          <SettingsCard
            icon={<SlidersHorizontal className="h-5 w-5" />}
            title={t("cards.preferences.title")}
            description={t("cards.preferences.description")}
            className="xl:col-span-2"
          >
            <div className="space-y-3">
              <ToggleRow
                title={t("toggles.detailed_feedback.title")}
                description={t("toggles.detailed_feedback.description")}
                checked={draft.detailedFeedback}
                onCheckedChange={(checked) =>
                  updateDraft("detailedFeedback", checked)
                }
              />
              <ToggleRow
                title={t("toggles.highlight_weak_areas.title")}
                description={t("toggles.highlight_weak_areas.description")}
                checked={draft.highlightWeakAreas}
                onCheckedChange={(checked) =>
                  updateDraft("highlightWeakAreas", checked)
                }
              />
              <ToggleRow
                title={t("toggles.explain_like_im_learning.title")}
                description={t("toggles.explain_like_im_learning.description")}
                checked={draft.explainLikeImLearning}
                onCheckedChange={(checked) =>
                  updateDraft("explainLikeImLearning", checked)
                }
              />
              <ToggleRow
                title={t("toggles.advanced_terminology.title")}
                description={t("toggles.advanced_terminology.description")}
                checked={draft.advancedTerminology}
                onCheckedChange={(checked) =>
                  updateDraft("advancedTerminology", checked)
                }
              />
            </div>
          </SettingsCard>

          <SettingsCard
            icon={<BellRing className="h-5 w-5" />}
            title={t("cards.notifications.title")}
            description={t("cards.notifications.description")}
          >
            <div className="space-y-3">
              <ToggleRow
                title={t("toggles.practice_reminders.title")}
                description={t("toggles.practice_reminders.description")}
                checked={draft.practiceReminders}
                onCheckedChange={(checked) =>
                  updateDraft("practiceReminders", checked)
                }
              />
              <ToggleRow
                title={t("toggles.streak_reminders.title")}
                description={t("toggles.streak_reminders.description")}
                checked={draft.streakReminders}
                onCheckedChange={(checked) =>
                  updateDraft("streakReminders", checked)
                }
              />
              <ToggleRow
                title={t("toggles.achievement_updates.title")}
                description={t("toggles.achievement_updates.description")}
                checked={draft.achievementUpdates}
                onCheckedChange={(checked) =>
                  updateDraft("achievementUpdates", checked)
                }
              />
              <ToggleRow
                title={t("toggles.smart_feature_popups.title")}
                description={t("toggles.smart_feature_popups.description")}
                checked={draft.smartFeaturePopups}
                onCheckedChange={(checked) =>
                  updateDraft("smartFeaturePopups", checked)
                }
              />
              <ToggleRow
                title={t("toggles.email_notifications.title")}
                description={t("toggles.email_notifications.description")}
                checked={draft.emailNotifications}
                onCheckedChange={(checked) =>
                  updateDraft("emailNotifications", checked)
                }
              />
            </div>
          </SettingsCard>
        </div>

        <section className="mt-5 rounded-[28px] border border-red-200 bg-red-50/65 p-5 shadow-[0_18px_48px_-38px_rgba(220,38,38,0.3)] dark:border-error/35 dark:bg-error-container/40">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-100 text-red-500">
                <LogOut className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-red-600">
                  {t("sign_out")}
                </h2>
                <p className="mt-1 text-sm text-red-500/90">
                  {t("sign_out_description")}
                </p>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={handleSignOut}
            className="rounded-2xl border-red-300 bg-white text-red-500 hover:bg-red-50 dark:border-error/45 dark:bg-surface-container-lowest dark:text-error dark:hover:bg-error-container/35"
            >
              {t("sign_out")}
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}
