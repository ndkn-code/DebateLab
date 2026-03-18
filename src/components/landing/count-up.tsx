"use client";

import { useEffect, useRef, useState } from "react";
import { useInView } from "framer-motion";

interface CountUpProps {
  target: number;
  suffix?: string;
  prefix?: string;
  decimals?: boolean;
}

export function CountUp({
  target,
  suffix = "",
  prefix = "",
  decimals = false,
}: CountUpProps) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!isInView) return;
    const duration = 2000;
    const steps = 60;
    const increment = target / steps;
    let current = 0;
    const timer = setInterval(() => {
      current += increment;
      if (current >= target) {
        setCount(target);
        clearInterval(timer);
      } else {
        setCount(Math.floor(current));
      }
    }, duration / steps);
    return () => clearInterval(timer);
  }, [isInView, target]);

  const display = decimals
    ? count.toFixed(1)
    : count.toLocaleString();

  return (
    <span ref={ref}>
      {isInView ? `${prefix}${display}${suffix}` : `${prefix}0${suffix}`}
    </span>
  );
}
