'use client';

import dynamic from 'next/dynamic';
import type { CSSProperties } from 'react';

const Lottie = dynamic(() => import('lottie-react'), { ssr: false });

type LottieAnimationData = unknown;

interface LottieAnimationProps {
  animationData: LottieAnimationData;
  loop?: boolean;
  autoplay?: boolean;
  style?: CSSProperties;
  className?: string;
}

export function LottieAnimation({
  animationData,
  loop = true,
  autoplay = true,
  style,
  className,
}: LottieAnimationProps) {
  return (
    <Lottie
      animationData={animationData}
      loop={loop}
      autoplay={autoplay}
      style={style}
      className={className}
    />
  );
}
