"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Check,
  Loader2,
  Pause,
  Play,
  Search,
  Volume2,
  Waves,
} from "@/components/ui/icons";
import { InfoHint } from "@/components/settings/info-hint";
import {
  filterVoicesForSearch,
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

const WAVE_BARS = [14, 24, 12, 20, 10, 26, 18, 12, 22, 9, 16, 20];

function findVoice(voiceId: string, language: PracticeLanguage) {
  return (
    TTS_VOICES.find(
      (voice) => voice.id === voiceId && voice.language === language
    ) ??
    getVoicesForLanguage(language)[0] ??
    TTS_VOICES[0]
  );
}

function VoiceAvatar({ voice }: { voice: TTSVoice }) {
  return (
    <div
      className={cn(
        "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border text-sm font-semibold",
        voice.gender === "male"
          ? "border-outline-variant bg-surface-container text-primary-dim"
          : "border-outline-variant bg-surface-container text-on-surface-variant"
      )}
    >
      {voice.gender === "male" ? "M" : "F"}
    </div>
  );
}

function VoiceWaveform({ active }: { active: boolean }) {
  return (
    <div className="flex h-7 items-end gap-1" aria-hidden="true">
      {WAVE_BARS.map((height, index) => (
        <span
          key={`${height}-${index}`}
          className={cn(
            "block w-1 rounded-full transition-colors",
            active ? "bg-primary/80" : "bg-surface-container-high"
          )}
          style={{ height }}
        />
      ))}
    </div>
  );
}

function VoiceMeta(props: {
  voice: TTSVoice;
  genderLabel: string;
  qualityLabel: string;
}) {
  const { voice, genderLabel, qualityLabel } = props;

  return (
    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-on-surface-variant">
      <span>{genderLabel}</span>
      <span aria-hidden="true">/</span>
      <span>{voice.accent}</span>
      <span aria-hidden="true">/</span>
      <span className="capitalize">{voice.provider}</span>
      {voice.quality === "high" ? (
        <span className="rounded-full bg-primary-container px-2 py-0.5 font-medium text-primary-dim">
          {qualityLabel}
        </span>
      ) : null}
    </div>
  );
}

export function VoiceSettings({
  currentVoice,
  practiceLanguage,
  onVoiceChange,
}: VoiceSettingsProps) {
  const t = useTranslations("settings");
  const [query, setQuery] = useState("");
  const [previewingVoice, setPreviewingVoice] = useState<string | null>(null);
  const [loadingVoice, setLoadingVoice] = useState<string | null>(null);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const blobUrlRef = useRef<string | null>(null);
  const voicesForLanguage = useMemo(
    () => getVoicesForLanguage(practiceLanguage),
    [practiceLanguage]
  );
  const filteredVoices = useMemo(
    () => filterVoicesForSearch(voicesForLanguage, query),
    [query, voicesForLanguage]
  );

  const selectedVoice = useMemo(
    () => findVoice(currentVoice, practiceLanguage),
    [currentVoice, practiceLanguage]
  );
  const resolvedVoiceId = selectedVoice.id;

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

  function getGenderLabel(voice: TTSVoice) {
    return voice.gender === "male" ? t("voice.male") : t("voice.female");
  }

  function renderPreviewIcon(voiceId: string) {
    if (loadingVoice === voiceId) {
      return <Loader2 className="h-4 w-4 animate-spin" />;
    }

    if (previewingVoice === voiceId && isPlayingPreview) {
      return <Pause className="h-4 w-4" />;
    }

    return <Play className="h-4 w-4" />;
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,300px)_minmax(0,1fr)]">
      <div className="rounded-lg border border-outline-variant bg-background p-4 dark:border-outline-variant/70 dark:bg-surface-container-lowest">
        <div className="flex items-start gap-3">
          <VoiceAvatar voice={selectedVoice} />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">
              {t("voice.current_voice")}
            </p>
            <p className="mt-1 truncate text-sm font-semibold text-on-surface dark:text-on-surface">
              {selectedVoice.name}
            </p>
            <VoiceMeta
              voice={selectedVoice}
              genderLabel={getGenderLabel(selectedVoice)}
              qualityLabel={t("voice.high_quality")}
            />
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <VoiceWaveform
            active={previewingVoice === resolvedVoiceId && isPlayingPreview}
          />
          <Button
            type="button"
            variant="outline"
            className="gap-2 rounded-lg border-outline-variant bg-white"
            onClick={() => handlePreview(resolvedVoiceId)}
            disabled={Boolean(loadingVoice && loadingVoice !== resolvedVoiceId)}
          >
            {renderPreviewIcon(resolvedVoiceId)}
            {t("voice.preview_button")}
          </Button>
        </div>
      </div>

      <div className="min-w-0 space-y-3">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-medium text-on-surface dark:text-on-surface">
            {t("voice.change_voice")}
          </p>
          <InfoHint label={t("voice.search_description")} />
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("voice.search_placeholder")}
            className="h-11 w-full rounded-lg border border-outline-variant bg-white pl-9 pr-3 text-sm font-medium text-on-surface outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-3 focus:ring-primary/15 dark:border-outline-variant/70 dark:bg-surface-container-lowest dark:text-on-surface"
          />
        </div>

        <div className="max-h-[360px] space-y-2 overflow-y-auto rounded-lg bg-white dark:bg-surface-container-lowest">
          {filteredVoices.length > 0 ? (
            filteredVoices.map((voice) => {
              const selected = resolvedVoiceId === voice.id;
              const previewing = previewingVoice === voice.id && isPlayingPreview;

              return (
                <div
                  key={voice.id}
                  className={cn(
                    "flex items-center gap-2 rounded-lg border px-3 py-3 transition-colors",
                    selected
                      ? "border-primary/30 bg-primary-container"
                      : "border-transparent bg-background hover:border-outline-variant hover:bg-white dark:bg-surface-container-lowest"
                  )}
                >
                  <button
                    type="button"
                    onClick={() => onVoiceChange(voice.id)}
                    aria-pressed={selected}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  >
                    <VoiceAvatar voice={voice} />
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 items-center gap-2">
                        <p className="truncate text-sm font-semibold text-on-surface dark:text-on-surface">
                          {voice.name}
                        </p>
                        {selected ? (
                          <Check className="h-4 w-4 shrink-0 text-primary-dim" />
                        ) : null}
                      </div>
                      <VoiceMeta
                        voice={voice}
                        genderLabel={getGenderLabel(voice)}
                        qualityLabel={t("voice.high_quality")}
                      />
                    </div>
                  </button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    title={t("voice.preview_button")}
                    className={cn(
                      "h-9 w-9 shrink-0 rounded-lg border border-outline-variant bg-white text-on-surface-variant",
                      previewing && "text-primary-dim"
                    )}
                    onClick={(event) => {
                      event.stopPropagation();
                      handlePreview(voice.id);
                    }}
                    disabled={Boolean(loadingVoice && loadingVoice !== voice.id)}
                  >
                    {renderPreviewIcon(voice.id)}
                  </Button>
                </div>
              );
            })
          ) : (
            <div className="flex min-h-32 flex-col items-center justify-center gap-2 px-4 py-8 text-center text-sm text-on-surface-variant">
              <Volume2 className="h-5 w-5" />
              {t("voice.empty_search")}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 text-xs text-on-surface-variant">
          <Waves className="h-4 w-4 text-primary" />
          {t("voice.shown_count", {
            shown: filteredVoices.length,
            total: voicesForLanguage.length,
          })}
        </div>
      </div>
    </div>
  );
}
