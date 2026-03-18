'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Volume2, Check, RefreshCw } from 'lucide-react';
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
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-1 flex-col items-center justify-center gap-6 text-center p-8"
    >
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
        <Volume2 className="h-8 w-8 text-primary" />
      </div>

      <div>
        <h3 className="text-xl font-semibold text-on-surface mb-2">
          {t('audioCheck.title')}
        </h3>
        <p className="text-muted-foreground text-on-surface-variant">
          {t('audioCheck.description')}
        </p>
      </div>

      <AnimatePresence mode="wait">
        {status === 'idle' && (
          <motion.div key="test" exit={{ opacity: 0 }}>
            <Button onClick={playTestSound} size="lg" className="gap-2 bg-primary text-on-primary">
              <Volume2 className="h-4 w-4" />
              {t('audioCheck.playTest')}
            </Button>
          </motion.div>
        )}
        {status === 'playing' && (
          <motion.div
            key="playing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-2 text-primary"
          >
            <div className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="h-2 w-2 rounded-full bg-primary"
                  animate={{ scale: [1, 1.5, 1] }}
                  transition={{ repeat: Infinity, duration: 0.6, delay: i * 0.15 }}
                />
              ))}
            </div>
            <span className="text-sm font-medium">{t('audioCheck.playing')}</span>
          </motion.div>
        )}
        {status === 'passed' && (
          <motion.div
            key="passed"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center gap-4"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
              <Check className="h-5 w-5 text-green-600" />
            </div>

            <div className="flex gap-3">
              <Button variant="ghost" size="sm" onClick={() => setStatus('idle')}>
                <RefreshCw className="mr-1 h-3 w-3" />
                {t('audioCheck.tryAgain')}
              </Button>
              <Button onClick={handleConfirm} size="lg" className="bg-primary text-on-primary">
                {t('audioCheck.confirm')}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
