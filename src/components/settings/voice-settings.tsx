'use client';

import { useState } from 'react';
import { TTS_VOICES } from '@/lib/tts-voices';
import { useTTS } from '@/hooks/use-tts';
import { Button } from '@/components/ui/button';
import { Play, Pause, Check, Volume2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';

interface VoiceSettingsProps {
  currentVoice: string;
  onVoiceChange: (voiceId: string) => void;
}

const PREVIEW_TEXT = "That's an interesting argument, but consider this counterpoint.";

export function VoiceSettings({ currentVoice, onVoiceChange }: VoiceSettingsProps) {
  const t = useTranslations('settings');
  const [previewingVoice, setPreviewingVoice] = useState<string | null>(null);

  const { speak, stop, isLoading, isPlaying } = useTTS({
    voice: previewingVoice || currentVoice,
    autoPlay: true,
  });

  const handlePreview = async (voiceId: string) => {
    if (isPlaying && previewingVoice === voiceId) {
      stop();
      setPreviewingVoice(null);
      return;
    }
    stop();
    setPreviewingVoice(voiceId);
    await speak(PREVIEW_TEXT);
    setPreviewingVoice(null);
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="flex items-center gap-2 text-lg font-semibold text-on-surface">
          <Volume2 className="h-5 w-5" />
          {t('voice.title')}
        </h3>
        <p className="mt-1 text-sm text-on-surface-variant">{t('voice.description')}</p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {TTS_VOICES.map((voice) => {
          const isSelected = currentVoice === voice.id;
          const isPreviewing = previewingVoice === voice.id;

          return (
            <div
              key={voice.id}
              className={cn(
                'flex cursor-pointer items-center justify-between rounded-lg border p-3 transition-all',
                isSelected
                  ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                  : 'border-outline-variant/20 hover:border-primary/40'
              )}
              onClick={() => onVoiceChange(voice.id)}
            >
              <div className="flex items-center gap-3">
                {isSelected && <Check className="h-4 w-4 text-primary" />}
                <div>
                  <p className="text-sm font-medium text-on-surface">{voice.name}</p>
                  <p className="text-xs text-on-surface-variant">
                    {voice.gender === 'female' ? t('voice.female') : t('voice.male')} · {voice.accent}
                  </p>
                </div>
              </div>

              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={(e) => {
                  e.stopPropagation();
                  handlePreview(voice.id);
                }}
                disabled={isLoading && previewingVoice !== voice.id}
              >
                {isPreviewing && isPlaying ? (
                  <Pause className="h-3.5 w-3.5" />
                ) : (
                  <Play className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
