"use client";

import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import {
  User,
  Mail,
  Lock,
  Settings2,
  LogOut,
  Check,
  Loader2,
  Globe,
  Volume2,
  Gift,
  Copy,
} from "lucide-react";
import { OrbBalance } from "@/components/shared/orb-balance";
import { VoiceSettings } from "@/components/settings/voice-settings";
import { DEFAULT_VOICE } from "@/lib/tts-voices";
import { Button } from "@/components/ui/button";
import { showToast } from "@/components/shared/toast";
import { LanguageToggle } from "@/components/ui/language-toggle";
import {
  updateProfile,
  updatePreferences,
  changePassword,
} from "@/app/[locale]/(protected)/settings/actions";
import { createClient } from "@/lib/supabase/client";
import { usePostHog } from "posthog-js/react";
import type { Profile } from "@/types/database";

const AVATAR_PRESETS = [
  "🎤", "🏆", "📚", "💡", "🎯", "⚡", "🌟", "🔥",
];

const PREP_TIME_VALUES = [
  { minutes: 5, value: 300 },
  { minutes: 7, value: 420 },
  { minutes: 10, value: 600 },
  { minutes: 15, value: 900 },
];

const SPEECH_TIME_VALUES = [
  { minutes: 3, value: 180 },
  { minutes: 5, value: 300 },
  { minutes: 7, value: 420 },
  { minutes: 8, value: 480 },
];

interface SettingsContentProps {
  profile: Profile | null;
  userEmail: string;
}

export function SettingsContent({ profile, userEmail }: SettingsContentProps) {
  const router = useRouter();
  const t = useTranslations('settings');
  const posthog = usePostHog();
  const [isPending, startTransition] = useTransition();

  // Profile state
  const [displayName, setDisplayName] = useState(
    profile?.display_name ?? ""
  );
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url ?? "");

  // Password state
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Preferences state
  const prefs = (profile?.preferences ?? {}) as Record<string, unknown>;
  const [defaultPrepTime, setDefaultPrepTime] = useState(
    (prefs.default_prep_time as number) ?? 420
  );
  const [defaultSpeechTime, setDefaultSpeechTime] = useState(
    (prefs.default_speech_time as number) ?? 420
  );
  const [defaultDifficulty, setDefaultDifficulty] = useState(
    (prefs.default_ai_difficulty as string) ?? "medium"
  );
  const [ttsVoice, setTtsVoice] = useState(
    (prefs.tts_voice as string) ?? DEFAULT_VOICE
  );

  // Referral state
  const [refCodeInput, setRefCodeInput] = useState("");
  const [refCopied, setRefCopied] = useState(false);
  const [refApplying, setRefApplying] = useState(false);
  const [refError, setRefError] = useState<string | null>(null);
  const [refSuccess, setRefSuccess] = useState<string | null>(null);

  const DIFFICULTY_OPTIONS = [
    { label: t('difficulty_easy'), value: "easy" },
    { label: t('difficulty_medium'), value: "medium" },
    { label: t('difficulty_hard'), value: "hard" },
  ];

  const handleSaveProfile = () => {
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("display_name", displayName);
        formData.set("avatar_url", avatarUrl);
        await updateProfile(formData);
        showToast(t('toast.profile_updated'), "success");
      } catch {
        showToast(t('toast.profile_error'), "error");
      }
    });
  };

  const handleSavePreferences = () => {
    startTransition(async () => {
      try {
        await updatePreferences({
          default_prep_time: defaultPrepTime,
          default_speech_time: defaultSpeechTime,
          default_ai_difficulty: defaultDifficulty,
          tts_voice: ttsVoice,
        });
        showToast(t('toast.preferences_saved'), "success");
      } catch {
        showToast(t('toast.preferences_error'), "error");
      }
    });
  };

  const handleChangePassword = () => {
    if (newPassword.length < 6) {
      showToast(t('toast.password_short'), "warning");
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast(t('toast.password_mismatch'), "warning");
      return;
    }
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("new_password", newPassword);
        formData.set("confirm_password", confirmPassword);
        await changePassword(formData);
        setNewPassword("");
        setConfirmPassword("");
        showToast(t('toast.password_updated'), "success");
      } catch (err) {
        showToast(
          err instanceof Error ? err.message : t('toast.password_error'),
          "error"
        );
      }
    });
  };

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6 lg:py-8">
      <h1 className="mb-8 text-2xl font-bold text-on-surface sm:text-3xl">
        {t('headline')}
      </h1>

      {/* Profile Section */}
      <section className="mb-8 rounded-2xl border border-outline-variant/10 bg-surface-container-lowest p-6 soft-shadow">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-container/40">
            <User className="h-5 w-5 text-primary" />
          </div>
          <h2 className="text-lg font-semibold text-on-surface">{t('profile')}</h2>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-on-surface-variant">
              {t('display_name')}
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={t('your_name')}
              className="w-full rounded-xl border border-outline-variant/20 bg-surface px-4 py-2.5 text-sm text-on-surface outline-none transition-colors focus:border-primary/40"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-on-surface-variant">
              {t('avatar')}
            </label>
            <div className="flex flex-wrap gap-2">
              {AVATAR_PRESETS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => setAvatarUrl(emoji)}
                  className={`flex h-10 w-10 items-center justify-center rounded-xl border-2 text-lg transition-colors ${
                    avatarUrl === emoji
                      ? "border-primary bg-primary/10"
                      : "border-outline-variant/20 hover:border-primary/30"
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          <Button
            onClick={handleSaveProfile}
            disabled={isPending}
            className="gap-2 bg-primary text-on-primary"
            size="sm"
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            {t('save_profile')}
          </Button>
        </div>
      </section>

      {/* Account Section */}
      <section className="mb-8 rounded-2xl border border-outline-variant/10 bg-surface-container-lowest p-6 soft-shadow">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-tertiary-container/40">
            <Mail className="h-5 w-5 text-tertiary" />
          </div>
          <h2 className="text-lg font-semibold text-on-surface">{t('account')}</h2>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-on-surface-variant">
              {t('email')}
            </label>
            <input
              type="email"
              value={userEmail}
              readOnly
              className="w-full rounded-xl border border-outline-variant/10 bg-surface-container px-4 py-2.5 text-sm text-on-surface-variant"
            />
          </div>

          <div className="border-t border-outline-variant/10 pt-4">
            <div className="mb-3 flex items-center gap-2">
              <Lock className="h-4 w-4 text-on-surface-variant" />
              <span className="text-sm font-medium text-on-surface">
                {t('change_password')}
              </span>
            </div>
            <div className="space-y-3">
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder={t('new_password')}
                className="w-full rounded-xl border border-outline-variant/20 bg-surface px-4 py-2.5 text-sm text-on-surface outline-none transition-colors focus:border-primary/40"
              />
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder={t('confirm_password')}
                className="w-full rounded-xl border border-outline-variant/20 bg-surface px-4 py-2.5 text-sm text-on-surface outline-none transition-colors focus:border-primary/40"
              />
              <Button
                onClick={handleChangePassword}
                disabled={isPending || !newPassword}
                variant="outline"
                className="gap-2 border-outline-variant/20"
                size="sm"
              >
                {isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Lock className="h-4 w-4" />
                )}
                {t('update_password')}
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Preferences Section */}
      <section className="mb-8 rounded-2xl border border-outline-variant/10 bg-surface-container-lowest p-6 soft-shadow">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary-container/40">
            <Settings2 className="h-5 w-5 text-secondary" />
          </div>
          <h2 className="text-lg font-semibold text-on-surface">
            {t('practice_defaults')}
          </h2>
        </div>

        <div className="space-y-5">
          <div>
            <label className="mb-2 block text-sm font-medium text-on-surface-variant">
              {t('default_prep_time')}
            </label>
            <div className="flex flex-wrap gap-2">
              {PREP_TIME_VALUES.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setDefaultPrepTime(opt.value)}
                  className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                    defaultPrepTime === opt.value
                      ? "bg-primary/15 text-primary"
                      : "bg-surface-container text-on-surface-variant hover:text-on-surface"
                  }`}
                >
                  {opt.minutes} {t('minutes_short')}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-on-surface-variant">
              {t('default_speech_time')}
            </label>
            <div className="flex flex-wrap gap-2">
              {SPEECH_TIME_VALUES.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setDefaultSpeechTime(opt.value)}
                  className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                    defaultSpeechTime === opt.value
                      ? "bg-primary/15 text-primary"
                      : "bg-surface-container text-on-surface-variant hover:text-on-surface"
                  }`}
                >
                  {opt.minutes} {t('minutes_short')}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-on-surface-variant">
              {t('default_difficulty')}
            </label>
            <div className="flex flex-wrap gap-2">
              {DIFFICULTY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setDefaultDifficulty(opt.value)}
                  className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                    defaultDifficulty === opt.value
                      ? "bg-primary/15 text-primary"
                      : "bg-surface-container text-on-surface-variant hover:text-on-surface"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <Button
            onClick={handleSavePreferences}
            disabled={isPending}
            className="gap-2 bg-primary text-on-primary"
            size="sm"
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            {t('save_preferences')}
          </Button>
        </div>
      </section>

      {/* Voice Section */}
      <section className="mb-8 rounded-2xl border border-outline-variant/10 bg-surface-container-lowest p-6 soft-shadow">
        <VoiceSettings
          currentVoice={ttsVoice}
          onVoiceChange={(voiceId) => {
            const previousVoice = ttsVoice;
            setTtsVoice(voiceId);
            posthog?.capture('tts_voice_changed', {
              new_voice: voiceId,
              previous_voice: previousVoice,
            });
          }}
        />
        <div className="mt-4">
          <Button
            onClick={handleSavePreferences}
            disabled={isPending}
            className="gap-2 bg-primary text-on-primary"
            size="sm"
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            {t('save_preferences')}
          </Button>
        </div>
      </section>

      {/* Language Section */}
      <section className="mb-8 rounded-2xl border border-outline-variant/10 bg-surface-container-lowest p-6 soft-shadow">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-container/40">
            <Globe className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-on-surface">{t('language')}</h2>
            <p className="text-sm text-on-surface-variant">{t('language_description')}</p>
          </div>
        </div>
        <LanguageToggle />
      </section>

      {/* Referral Section */}
      <section className="mb-8 rounded-2xl border border-outline-variant/10 bg-surface-container-lowest p-6 soft-shadow">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10">
            <Gift className="h-5 w-5 text-amber-500" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-on-surface">Referrals</h2>
            <p className="text-sm text-on-surface-variant">Invite friends and earn Orbs</p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Current Orb balance */}
          <div className="flex items-center justify-between rounded-xl border border-outline-variant/10 bg-surface-container-low px-4 py-3">
            <span className="text-sm text-on-surface-variant">Your Orb balance</span>
            <OrbBalance balance={profile?.orb_balance ?? 0} size="md" showLabel />
          </div>

          {/* Your referral code */}
          {profile?.referral_code && (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-on-surface-variant">
                Your invite link
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={`${typeof window !== "undefined" ? window.location.origin : ""}/join/${profile.referral_code}`}
                  className="flex-1 rounded-xl border border-outline-variant/10 bg-surface-container px-4 py-2.5 text-sm text-on-surface-variant"
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0 gap-1.5 border-outline-variant/20"
                  onClick={() => {
                    navigator.clipboard.writeText(
                      `${window.location.origin}/join/${profile.referral_code}`
                    );
                    setRefCopied(true);
                    setTimeout(() => setRefCopied(false), 2000);
                  }}
                >
                  {refCopied ? (
                    <Check className="h-3.5 w-3.5 text-emerald-500" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
              <p className="mt-1.5 text-xs text-on-surface-variant">
                Both you and your friend earn 3 bonus Orbs when they complete their first practice
              </p>
            </div>
          )}

          {/* Enter referral code (only if not already referred) */}
          {!profile?.referred_by && (
            <div className="border-t border-outline-variant/10 pt-4">
              <label className="mb-1.5 block text-sm font-medium text-on-surface-variant">
                Have a referral code?
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={refCodeInput}
                  onChange={(e) => {
                    setRefCodeInput(e.target.value.toUpperCase());
                    setRefError(null);
                  }}
                  placeholder="e.g. K7X2MN"
                  maxLength={6}
                  className="flex-1 rounded-xl border border-outline-variant/20 bg-surface px-4 py-2.5 text-sm text-on-surface uppercase tracking-widest outline-none transition-colors focus:border-primary/40"
                />
                <Button
                  onClick={async () => {
                    if (refCodeInput.length !== 6) {
                      setRefError("Code must be 6 characters");
                      return;
                    }
                    setRefApplying(true);
                    setRefError(null);
                    try {
                      const res = await fetch("/api/referral/apply", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ code: refCodeInput }),
                      });
                      const data = await res.json();
                      if (!res.ok) {
                        setRefError(data.error || "Failed to apply code");
                      } else {
                        setRefSuccess(`Linked! Referred by ${data.referrerName}`);
                        setRefCodeInput("");
                      }
                    } catch {
                      setRefError("Failed to apply code");
                    }
                    setRefApplying(false);
                  }}
                  disabled={refApplying || refCodeInput.length !== 6}
                  className="gap-2 bg-primary text-on-primary"
                  size="sm"
                >
                  {refApplying ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Apply"
                  )}
                </Button>
              </div>
              {refError && (
                <p className="mt-1.5 text-xs text-red-500">{refError}</p>
              )}
              {refSuccess && (
                <p className="mt-1.5 text-xs text-emerald-500">{refSuccess}</p>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Sign Out */}
      <section className="rounded-2xl border border-red-500/10 bg-surface-container-lowest p-6">
        <Button
          onClick={handleSignOut}
          variant="outline"
          className="gap-2 border-red-500/20 text-red-500 hover:bg-red-500/10"
        >
          <LogOut className="h-4 w-4" />
          {t('sign_out')}
        </Button>
      </section>
    </div>
  );
}
