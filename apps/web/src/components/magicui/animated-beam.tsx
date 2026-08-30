"use client";

import {
  useEffect,
  useId,
  useState,
  type RefObject,
  type SVGProps,
} from "react";
import { motion, useReducedMotion } from "framer-motion";

import { cn } from "@/lib/utils";

/**
 * Adapted from Magic UI's Animated Beam component.
 * Source: https://magicui.design/docs/components/animated-beam
 * License: MIT, Copyright (c) Magic UI
 * Foundation credit retained from the upstream component: @itsarghyadas.
 */
export function AnimatedBeam({
  className,
  containerRef,
  fromRef,
  toRef,
  duration = 4,
  delay = 0,
  curvature = 0,
  reverse = false,
  ...props
}: {
  containerRef: RefObject<HTMLElement | null>;
  fromRef: RefObject<HTMLElement | null>;
  toRef: RefObject<HTMLElement | null>;
  duration?: number;
  delay?: number;
  curvature?: number;
  reverse?: boolean;
} & Omit<SVGProps<SVGSVGElement>, "from" | "to">) {
  const reduceMotion = useReducedMotion();
  const gradientId = useId().replace(/:/g, "");
  const [path, setPath] = useState("");
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const update = () => {
      const container = containerRef.current?.getBoundingClientRect();
      const from = fromRef.current?.getBoundingClientRect();
      const to = toRef.current?.getBoundingClientRect();
      if (!container || !from || !to) return;
      const startX = from.left - container.left + from.width / 2;
      const startY = from.top - container.top + from.height / 2;
      const endX = to.left - container.left + to.width / 2;
      const endY = to.top - container.top + to.height / 2;
      const controlX = (startX + endX) / 2;
      const controlY = (startY + endY) / 2 - curvature;
      setSize({ width: container.width, height: container.height });
      setPath(
        `M ${startX} ${startY} Q ${controlX} ${controlY} ${endX} ${endY}`,
      );
    };
    update();
    const observer = new ResizeObserver(update);
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [containerRef, curvature, fromRef, toRef]);

  if (!path) return null;

  return (
    <svg
      aria-hidden="true"
      className={cn("pointer-events-none absolute inset-0", className)}
      width={size.width}
      height={size.height}
      viewBox={`0 0 ${size.width} ${size.height}`}
      fill="none"
      {...props}
    >
      <path
        d={path}
        stroke="var(--color-outline-variant)"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      {reduceMotion ? (
        <path
          d={path}
          stroke="var(--color-secondary)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray="8 12"
        />
      ) : (
        <>
          <defs>
            <linearGradient id={gradientId}>
              <stop stopColor="var(--color-secondary)" stopOpacity="0" />
              <stop offset=".5" stopColor="var(--color-secondary)" />
              <stop
                offset="1"
                stopColor="var(--color-success)"
                stopOpacity="0"
              />
            </linearGradient>
          </defs>
          <motion.path
            d={path}
            stroke={`url(#${gradientId})`}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeDasharray="16 80"
            initial={{ pathLength: 0, pathOffset: reverse ? 1 : 0 }}
            animate={{ pathLength: 1, pathOffset: reverse ? 0 : 1 }}
            transition={{
              duration,
              delay,
              repeat: Infinity,
              ease: "linear",
            }}
          />
        </>
      )}
    </svg>
  );
}
