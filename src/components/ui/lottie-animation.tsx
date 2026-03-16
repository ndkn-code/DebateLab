'use client';

import Lottie from 'lottie-react';
import { CSSProperties } from 'react';

interface LottieAnimationProps {
  animationData: any;
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
