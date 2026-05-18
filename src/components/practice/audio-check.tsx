'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Volume2, Check, RefreshCw, ArrowRight, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { usePostHog } from 'posthog-js/react';

interface AudioCheckProps {
  onPassed: () => void;
}

export function AudioCheck({ onPassed }: AudioCheckProps) {
  const t = useTranslations('dashboard.practice');
  const [status, setStatus] = useState<'idle' | 'playing' | 'passed'>('idle');
  const posthog = usePostHog();

  const playTestSound = () => {
    setStatus('playing');

    // Use Web Audio API to generate a short pleasant chime
    const ctx = new AudioContext();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
    oscillator.frequency.setValueAtTime(659.25, ctx.currentTime + 0.15); // E5
    oscillator.frequency.setValueAtTime(783.99, ctx.currentTime + 0.3); // G5

    gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.6);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.6);

    posthog?.capture('tts_audio_check_played');

    setTimeout(() => setStatus('passed'), 700);
  };

  const handleConfirm = () => {
    posthog?.capture('tts_audio_check_passed');
    onPassed();
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-1 flex-col items-center justify-center px-6 py-8 text-center"
      >
        <div className="flex h-24 w-24 items-center justify-center rounded-full bg-primary-container/80">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-container">
            <Volume2 className="h-8 w-8 text-primary" />
          </div>
        </div>

        <h2 className="mt-5 text-2xl font-semibold tracking-normal text-on-surface">
          {t('audioCheck.title')}
        </h2>
        <p className="mt-3 max-w-[460px] text-sm font-medium leading-6 text-on-surface-variant">
          {t('audioCheck.description')}
        </p>

        <AnimatePresence mode="wait">
          {status === 'idle' && (
            <motion.div key="test" className="mt-6" exit={{ opacity: 0 }}>
              <Button onClick={playTestSound} size="lg" className="h-11 gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-on-primary">
                <Volume2 className="h-5 w-5" />
                {t('audioCheck.playTest')}
              </Button>
              <p className="mt-4 text-xs font-medium text-on-surface-variant">
                {t('session.audio_sample_hint')}
              </p>
            </motion.div>
          )}
          {status === 'playing' && (
            <motion.div
              key="playing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="mt-6 flex items-center gap-3 text-primary"
            >
              <div className="flex gap-1.5">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    className="h-2.5 w-2.5 rounded-full bg-primary"
                    animate={{ scale: [1, 1.55, 1] }}
                    transition={{ repeat: Infinity, duration: 0.6, delay: i * 0.15 }}
                  />
                ))}
              </div>
              <span className="text-sm font-semibold">{t('audioCheck.playing')}</span>
            </motion.div>
          )}
          {status === 'passed' && (
            <motion.div
              key="passed"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mt-6 flex flex-col items-center gap-4"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary-container">
                <Check className="h-6 w-6 text-secondary-dim" />
              </div>

              <div className="flex gap-3">
                <Button variant="outline" size="lg" onClick={() => setStatus('idle')} className="h-10 gap-2 rounded-lg border-outline-variant/70 bg-surface text-sm">
                  <RefreshCw className="h-4 w-4" />
                  {t('audioCheck.tryAgain')}
                </Button>
                <Button onClick={handleConfirm} size="lg" className="h-10 gap-2 rounded-lg bg-primary px-5 text-sm text-on-primary">
                  {t('audioCheck.confirm')}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <div className="border-t border-outline-variant/60 bg-surface-container-lowest/80 px-4 py-3">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <span className="inline-flex items-center gap-3 text-sm font-medium text-on-surface-variant">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-outline-variant/70 bg-surface">
              <ArrowLeft className="h-4 w-4" />
            </span>
            {t('session.exit_practice')}
          </span>
          <div className="hidden items-center gap-3 sm:flex">
            <span className="h-1 w-8 rounded-full bg-primary" />
            <span className="h-1 w-8 rounded-full bg-outline-variant" />
            <span className="h-1 w-8 rounded-full bg-outline-variant" />
            <span className="h-1 w-8 rounded-full bg-outline-variant" />
          </div>
          <span className="inline-flex items-center gap-3 text-sm font-medium text-on-surface-variant">
            {t('session.next_mic_check')}
            <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-outline-variant/70 bg-surface">
              <ArrowRight className="h-4 w-4 text-primary" />
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}
