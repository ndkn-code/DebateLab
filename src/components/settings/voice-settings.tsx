"use client";

import { useMemo, useState } from "react";
import { Check, Pause, Play, Sparkles, Waves } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { useTTS } from "@/hooks/use-tts";
import { TTS_VOICES, type TTSVoice } from "@/lib/tts-voices";
import { cn } from "@/lib/utils";

interface VoiceSettingsProps {
  currentVoice: string;
  onVoiceChange: (voiceId: string) => void;
}

const FEATURED_VOICE_IDS = ["aura-orion-en", "aura-asteria-en"] as const;
const PREVIEW_TEXT =
  "That is a strong claim, but let me challenge the assumption behind it.";
const WAVE_BARS = [14, 24, 12, 20, 10, 26, 18, 12, 22, 9, 16, 20];

function findVoice(voiceId: string) {
  return TTS_VOICES.find((voice) => voice.id === voiceId) ?? TTS_VOICES[0];
}

function VoiceWaveform({ active }: { active: boolean }) {
  return (
    <div className="flex h-8 items-end gap-1">
      {WAVE_BARS.map((height, index) => (
        <span
          key={`${height}-${index}`}
          className={cn(
            "block w-1 rounded-full transition-colors",
            active ? "bg-primary/80" : "bg-primary/25"
          )}
          style={{ height }}
        />
      ))}
    </div>
  );
}

function VoiceCard(props: {
  voice: TTSVoice;
  selected: boolean;
  previewing: boolean;
  disabled: boolean;
  onSelect: () => void;
  onPreview: () => void;
  accentLabel: string;
  genderLabel: string;
}) {
  const { voice, selected, previewing, disabled, onSelect, onPreview, accentLabel, genderLabel } =
    props;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "group relative flex w-full flex-col gap-4 rounded-2xl border p-4 text-left transition-all",
        selected
          ? "border-primary/60 bg-primary/5 shadow-[0_18px_35px_-28px_rgba(44,108,246,0.8)]"
          : "border-outline-variant/20 bg-surface-container-lowest hover:border-primary/25 hover:bg-surface"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "flex h-12 w-12 items-center justify-center rounded-2xl text-sm font-semibold",
              voice.gender === "male"
                ? "bg-primary/12 text-primary"
                : "bg-rose-500/12 text-rose-500"
            )}
          >
            {voice.gender === "male" ? "M" : "F"}
          </div>
          <div>
            <p className="text-sm font-semibold text-on-surface">{voice.name}</p>
            <p className="text-xs text-on-surface-variant">
              {genderLabel} / {accentLabel}
            </p>
          </div>
        </div>
        {selected ? (
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-white">
            <Check className="h-4 w-4" />
          </div>
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-3">
        <VoiceWaveform active={selected || previewing} />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0 rounded-full border border-outline-variant/20"
          onClick={(event) => {
            event.stopPropagation();
            onPreview();
          }}
          disabled={disabled}
        >
          {previewing ? (
            <Pause className="h-4 w-4" />
          ) : (
            <Play className="h-4 w-4" />
          )}
        </Button>
      </div>
    </button>
  );
}

export function VoiceSettings({
  currentVoice,
  onVoiceChange,
}: VoiceSettingsProps) {
  const t = useTranslations("settings");
  const [previewingVoice, setPreviewingVoice] = useState<string | null>(null);

  const selectedVoice = useMemo(
    () => findVoice(currentVoice),
    [currentVoice]
  );
  const featuredVoices = useMemo(
    () =>
      FEATURED_VOICE_IDS.map((voiceId) => findVoice(voiceId)).filter(Boolean),
    []
  );
  const additionalVoices = useMemo(
    () =>
      TTS_VOICES.filter(
        (voice) => !FEATURED_VOICE_IDS.includes(voice.id as (typeof FEATURED_VOICE_IDS)[number])
      ),
    []
  );

  const { speak, stop, isLoading, isPlaying } = useTTS({
    voice: previewingVoice ?? currentVoice,
    autoPlay: true,
    onPlayEnd: () => setPreviewingVoice(null),
    onError: () => setPreviewingVoice(null),
  });

  async function handlePreview(voiceId: string) {
    if (isPlaying && previewingVoice === voiceId) {
      stop();
      setPreviewingVoice(null);
      return;
    }

    stop();
    setPreviewingVoice(voiceId);
    await speak(PREVIEW_TEXT);
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 lg:grid-cols-2">
        {featuredVoices.map((voice) => (
          <VoiceCard
            key={voice.id}
            voice={voice}
            selected={currentVoice === voice.id}
            previewing={previewingVoice === voice.id && isPlaying}
            disabled={isLoading && previewingVoice !== voice.id}
            onSelect={() => onVoiceChange(voice.id)}
            onPreview={() => handlePreview(voice.id)}
            accentLabel={t(`voice.accents.${voice.accent.toLowerCase()}`)}
            genderLabel={voice.gender === "male" ? t("voice.male") : t("voice.female")}
          />
        ))}
      </div>

      <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-low p-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl bg-surface text-on-surface-variant">
            <Waves className="h-4 w-4" />
          </div>
          <div className="flex-1 space-y-3">
            <div>
              <p className="text-sm font-medium text-on-surface">
                {t("voice.more_voices")}
              </p>
              <p className="mt-1 text-xs text-on-surface-variant">
                {t("voice.more_voices_description")}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
              <Select
                value={currentVoice}
                onChange={(event) => onVoiceChange(event.target.value)}
              >
                {[selectedVoice, ...additionalVoices]
                  .filter(
                    (voice, index, voices) =>
                      voices.findIndex((candidate) => candidate.id === voice.id) === index
                  )
                  .map((voice) => (
                    <option key={voice.id} value={voice.id}>
                      {voice.name} /{" "}
                      {voice.gender === "male" ? t("voice.male") : t("voice.female")} /{" "}
                      {t(`voice.accents.${voice.accent.toLowerCase()}`)}
                    </option>
                  ))}
              </Select>
              <Button
                type="button"
                variant="outline"
                className="gap-2"
                onClick={() => handlePreview(currentVoice)}
                disabled={isLoading && previewingVoice !== currentVoice}
              >
                {previewingVoice === currentVoice && isPlaying ? (
                  <Pause className="h-4 w-4" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
                {t("voice.preview_button")}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between rounded-2xl border border-outline-variant/15 bg-surface-container-low px-4 py-3">
        <div className="flex items-center gap-3">
          <Sparkles className="h-4 w-4 text-primary" />
          <div>
            <p className="text-sm font-medium text-on-surface">
              {t("voice.selected_label")}
            </p>
            <p className="text-xs text-on-surface-variant">
              {selectedVoice.name} /{" "}
              {selectedVoice.gender === "male" ? t("voice.male") : t("voice.female")}
            </p>
          </div>
        </div>
        <span className="text-xs font-medium text-on-surface-variant">
          {t(`voice.accents.${selectedVoice.accent.toLowerCase()}`)}
        </span>
      </div>
    </div>
  );
}
