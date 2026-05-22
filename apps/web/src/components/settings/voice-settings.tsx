"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Check, Pause, Play, Sparkles, Waves } from "@/components/ui/icons";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import {
  getVoiceSampleUrl,
  getVoicesForLanguage,
  TTS_SAMPLE_TEXT_BY_LANGUAGE,
  TTS_VOICES,
  type TTSVoice,
} from "@/lib/tts-voices";
import { cn } from "@/lib/utils";
import type { PracticeLanguage } from "@/types";

interface VoiceSettingsProps {
  currentVoice: string;
  practiceLanguage: PracticeLanguage;
  onVoiceChange: (voiceId: string) => void;
}

const FEATURED_VOICE_IDS_BY_LANGUAGE: Record<PracticeLanguage, string[]> = {
  en: ["aura-orion-en", "aura-asteria-en"],
  vi: ["vi-VN-Wavenet-A", "vi-VN-HoaiMyNeural"],
};
const WAVE_BARS = [14, 24, 12, 20, 10, 26, 18, 12, 22, 9, 16, 20];

function findVoice(voiceId: string, language: PracticeLanguage) {
  return (
    TTS_VOICES.find((voice) => voice.id === voiceId && voice.language === language) ??
    getVoicesForLanguage(language)[0] ??
    TTS_VOICES[0]
  );
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
  genderLabel: string;
  qualityLabel: string;
}) {
  const { voice, selected, previewing, disabled, onSelect, onPreview, genderLabel, qualityLabel } =
    props;

  function handleSelectKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    onSelect();
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      onClick={onSelect}
      onKeyDown={handleSelectKeyDown}
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
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span className="text-xs text-on-surface-variant">{genderLabel}</span>
              {voice.quality === "high" ? (
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                  {qualityLabel}
                </span>
              ) : null}
            </div>
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
    </div>
  );
}

export function VoiceSettings({
  currentVoice,
  practiceLanguage,
  onVoiceChange,
}: VoiceSettingsProps) {
  const t = useTranslations("settings");
  const [previewingVoice, setPreviewingVoice] = useState<string | null>(null);
  const [loadingVoice, setLoadingVoice] = useState<string | null>(null);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const blobUrlRef = useRef<string | null>(null);
  const voicesForLanguage = useMemo(
    () => getVoicesForLanguage(practiceLanguage),
    [practiceLanguage]
  );
  const featuredVoiceIds = FEATURED_VOICE_IDS_BY_LANGUAGE[practiceLanguage];

  const selectedVoice = useMemo(
    () => findVoice(currentVoice, practiceLanguage),
    [currentVoice, practiceLanguage]
  );
  const resolvedVoiceId = selectedVoice.id;
  const featuredVoices = useMemo(
    () =>
      featuredVoiceIds.map((voiceId) => findVoice(voiceId, practiceLanguage)).filter(Boolean),
    [featuredVoiceIds, practiceLanguage]
  );
  const additionalVoices = useMemo(
    () =>
      voicesForLanguage.filter(
        (voice) => !featuredVoiceIds.includes(voice.id)
      ),
    [featuredVoiceIds, voicesForLanguage]
  );

  const stopPreview = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }

    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }

    setIsPlayingPreview(false);
    setLoadingVoice(null);
  }, []);

  useEffect(() => {
    return () => stopPreview();
  }, [stopPreview]);

  async function playPreviewUrl(url: string) {
    const audio = new Audio(url);
    audioRef.current = audio;

    audio.onpause = () => {
      if (!audio.ended) {
        setIsPlayingPreview(false);
      }
    };
    audio.onended = () => {
      setIsPlayingPreview(false);
      setPreviewingVoice(null);
    };

    await new Promise<void>((resolve, reject) => {
      audio.onplay = () => {
        setLoadingVoice(null);
        setIsPlayingPreview(true);
        resolve();
      };
      audio.onerror = () => reject(new Error("Preview audio failed"));
      audio.play().catch(reject);
    });
  }

  async function playLivePreview(voiceId: string) {
    setLoadingVoice(voiceId);
    const response = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: TTS_SAMPLE_TEXT_BY_LANGUAGE[practiceLanguage],
        voice: voiceId,
        practiceLanguage,
      }),
    });

    if (!response.ok) {
      throw new Error("Preview failed");
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    blobUrlRef.current = url;
    await playPreviewUrl(url);
  }

  async function handlePreview(voiceId: string) {
    if (isPlayingPreview && previewingVoice === voiceId) {
      stopPreview();
      setPreviewingVoice(null);
      return;
    }

    stopPreview();
    setPreviewingVoice(voiceId);
    setLoadingVoice(voiceId);

    const sampleUrl = getVoiceSampleUrl(voiceId);
    if (sampleUrl) {
      try {
        await playPreviewUrl(sampleUrl);
        return;
      } catch {
        stopPreview();
        setPreviewingVoice(voiceId);
      }
    }

    try {
      await playLivePreview(voiceId);
    } catch {
      stopPreview();
      setPreviewingVoice(null);
    }
  }

  function renderVoiceOptionLabel(voice: TTSVoice) {
    return [
      voice.name,
      voice.gender === "male" ? t("voice.male") : t("voice.female"),
      voice.quality === "high" ? t("voice.high_quality") : null,
    ]
      .filter(Boolean)
      .join(" / ");
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 lg:grid-cols-2">
        {featuredVoices.map((voice) => (
          <VoiceCard
            key={voice.id}
            voice={voice}
            selected={resolvedVoiceId === voice.id}
            previewing={previewingVoice === voice.id && isPlayingPreview}
            disabled={Boolean(loadingVoice && loadingVoice !== voice.id)}
            onSelect={() => onVoiceChange(voice.id)}
            onPreview={() => handlePreview(voice.id)}
            genderLabel={voice.gender === "male" ? t("voice.male") : t("voice.female")}
            qualityLabel={t("voice.high_quality")}
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
                value={resolvedVoiceId}
                onChange={(event) => onVoiceChange(event.target.value)}
              >
                {[selectedVoice, ...additionalVoices]
                  .filter(
                    (voice, index, voices) =>
                      voices.findIndex((candidate) => candidate.id === voice.id) === index
                  )
                  .map((voice) => (
                    <option key={voice.id} value={voice.id}>
                      {renderVoiceOptionLabel(voice)}
                    </option>
                  ))}
              </Select>
              <Button
                type="button"
                variant="outline"
                className="gap-2"
                onClick={() => handlePreview(resolvedVoiceId)}
                disabled={Boolean(loadingVoice && previewingVoice !== resolvedVoiceId)}
              >
                {previewingVoice === resolvedVoiceId && isPlayingPreview ? (
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
              {selectedVoice.name} / {selectedVoice.gender === "male" ? t("voice.male") : t("voice.female")}
            </p>
          </div>
        </div>
        {selectedVoice.quality === "high" ? (
          <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
            {t("voice.high_quality")}
          </span>
        ) : null}
      </div>
    </div>
  );
}
