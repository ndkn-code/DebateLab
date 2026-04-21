'use client';

import Lottie from 'lottie-react';
import type { CSSProperties } from 'react';

type LottieAnimationData = Parameters<typeof Lottie>[0]["animationData"];

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
