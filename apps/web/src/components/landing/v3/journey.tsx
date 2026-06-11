"use client";

import Image from "next/image";
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { LandingV3Copy } from "./copy";
import { BookIcon, MicIcon, SwordsIcon, TrophyIcon } from "./icons";
import { Reveal } from "./motion-primitives";
import { Highlight } from "./ui";

const VIEW_W = 1200;
const VIEW_H = 520;
const PATH_D =
  "M 50 470 C 230 480, 300 372, 450 352 C 600 332, 620 256, 770 240 C 910 226, 950 150, 1120 112";
/** Fractions along the path where the four waypoint badges sit. */
const WAYPOINT_T = [0.06, 0.37, 0.67, 0.97] as const;
/** Where the mascot walks (from waypoint 1 to just before waypoint 3). */
const MASCOT_RANGE: [number, number] = [0.08, 0.6];

const WAYPOINT_ICONS = { book: BookIcon, mic: MicIcon, swords: SwordsIcon, trophy: TrophyIcon } as const;

type Point = { x: number; y: number };

function Hills() {
  return (
    <div aria-hidden="true" className="absolute inset-x-0 bottom-0">
      <Image
        src="/images/landing-v3/journey-backdrop.webp"
        alt=""
        width={1915}
        height={821}
        className="h-auto w-full object-cover [mask-image:linear-gradient(180deg,transparent_0%,black_38%)]"
        sizes="100vw"
      />
    </div>
  );
}

function WaypointBadge({
  icon,
  label,
  point,
  isFinal,
  labelBelow,
  delay,
}: {
  icon: keyof typeof WAYPOINT_ICONS;
  label: string;
  point: Point;
  isFinal: boolean;
  labelBelow: boolean;
  delay: number;
}) {
  const Icon = WAYPOINT_ICONS[icon];
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.4 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ type: "spring", stiffness: 300, damping: 18, delay }}
      className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
      style={{ left: `${(point.x / VIEW_W) * 100}%`, top: `${(point.y / VIEW_H) * 100}%` }}
    >
      {!labelBelow ? (
        <span className="mb-2 whitespace-nowrap rounded-full border border-outline-variant bg-white px-3 py-1 text-xs font-extrabold text-on-surface shadow-token-card">
          {label}
        </span>
      ) : null}
      {isFinal ? (
        <span className="relative flex h-20 w-20 items-center justify-center">
          <Image
            src="/images/landing-v3/badge-trophy.webp"
            alt=""
            aria-hidden="true"
            width={1254}
            height={1254}
            className="h-auto w-full object-contain drop-shadow-[0_8px_12px_rgba(199,147,0,0.3)]"
            sizes="80px"
          />
        </span>
      ) : (
        <span className="relative flex h-[52px] w-[52px] items-center justify-center rounded-full border-4 border-white bg-white shadow-token-card">
          <Icon className="h-6 w-6 text-primary" />
        </span>
      )}
      {labelBelow ? (
        <span className="mt-2 whitespace-nowrap rounded-full border border-outline-variant bg-white px-3 py-1 text-xs font-extrabold text-on-surface shadow-token-card">
          {label}
        </span>
      ) : null}
    </motion.div>
  );
}

/** Desktop canvas: scroll-linked path draw + mascot walking along the path. */
function JourneyCanvas({ copy }: { copy: LandingV3Copy }) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const reduceMotion = useReducedMotion();
  const [waypoints, setWaypoints] = useState<Point[] | null>(null);

  const { scrollYProgress } = useScroll({
    target: canvasRef,
    offset: ["start 85%", "end 45%"],
  });
  const drawProgress = useSpring(useTransform(scrollYProgress, [0, 1], [0, 1]), {
    stiffness: 90,
    damping: 24,
  });
  const dashOffset = useTransform(drawProgress, (v) => 1 - v);

  // Mascot position: walk along the real path geometry as the user scrolls.
  const mascotX = useMotionValue(0);
  const mascotY = useMotionValue(0);
  useEffect(() => {
    const path = pathRef.current;
    if (!path) return;
    const total = path.getTotalLength();

    const place = (t: number) => {
      const clamped = MASCOT_RANGE[0] + (MASCOT_RANGE[1] - MASCOT_RANGE[0]) * t;
      const point = path.getPointAtLength(total * clamped);
      mascotX.set((point.x / VIEW_W) * 100);
      mascotY.set((point.y / VIEW_H) * 100);
    };

    setWaypoints(WAYPOINT_T.map((t) => path.getPointAtLength(total * t)));
    if (reduceMotion) {
      place(0.6);
      return;
    }
    place(drawProgress.get());
    return drawProgress.on("change", place);
  }, [drawProgress, mascotX, mascotY, reduceMotion]);

  const mascotLeft = useTransform(mascotX, (v) => `${v}%`);
  const mascotTop = useTransform(mascotY, (v) => `${v}%`);

  return (
    <div ref={canvasRef} className="relative mx-auto mt-4 hidden aspect-[1200/520] w-full max-w-6xl md:block">
      <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className="absolute inset-0 h-full w-full" fill="none">
        {/* Track */}
        <path d={PATH_D} stroke="#CDECF3" strokeWidth="14" strokeLinecap="round" strokeDasharray="2 22" />
        {/* Animated fill */}
        <motion.path
          ref={pathRef}
          d={PATH_D}
          stroke="#00B8D9"
          strokeWidth="14"
          strokeLinecap="round"
          pathLength={1}
          strokeDasharray="1"
          style={{ strokeDashoffset: reduceMotion ? 0 : dashOffset }}
        />
      </svg>

      {/* Walking mascot */}
      <motion.div
        className="absolute z-10 -translate-x-1/2 -translate-y-[88%]"
        style={{ left: mascotLeft, top: mascotTop }}
      >
        <motion.div
          animate={reduceMotion ? undefined : { rotate: [-3, 3, -3] }}
          transition={{ duration: 0.9, repeat: Infinity, ease: "easeInOut" }}
        >
          <Image
            src="/images/landing-v3/mascot-walking.webp"
            alt=""
            aria-hidden="true"
            width={1254}
            height={1254}
            className="h-auto w-24 object-contain drop-shadow-[0_10px_14px_rgba(16,41,54,0.2)] lg:w-28"
            sizes="112px"
          />
        </motion.div>
      </motion.div>

      {waypoints
        ? copy.journey.waypoints.map((waypoint, index) => (
            <WaypointBadge
              key={waypoint.label}
              icon={waypoint.icon}
              label={waypoint.label}
              point={waypoints[index]}
              isFinal={index === copy.journey.waypoints.length - 1}
              labelBelow={index % 2 === 0}
              delay={0.15 + index * 0.18}
            />
          ))
        : null}
    </div>
  );
}

/** Mobile fallback: vertical timeline. */
function JourneyTimeline({ copy }: { copy: LandingV3Copy }) {
  return (
    <div className="relative mx-auto mt-12 flex max-w-sm flex-col gap-8 md:hidden">
      <span aria-hidden="true" className="absolute bottom-6 left-[26px] top-6 w-1 rounded-full bg-[#CDECF3]" />
      {copy.journey.waypoints.map((waypoint, index) => {
        const Icon = WAYPOINT_ICONS[waypoint.icon];
        const isFinal = index === copy.journey.waypoints.length - 1;
        return (
          <motion.div
            key={waypoint.label}
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.55, delay: index * 0.1, ease: [0.16, 1, 0.3, 1] }}
            className="relative flex items-center gap-4"
          >
            <span
              className={cn(
                "relative z-10 flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full border-4 border-white shadow-token-card",
                isFinal ? "bg-reward" : "bg-white"
              )}
            >
              <Icon className={cn("h-6 w-6", isFinal ? "text-white" : "text-primary")} />
            </span>
            <span className="text-base font-extrabold text-on-surface">{waypoint.label}</span>
          </motion.div>
        );
      })}
    </div>
  );
}

export function JourneySection({ copy }: { copy: LandingV3Copy }) {
  return (
    <section
      id="journey"
      className="relative overflow-hidden bg-[linear-gradient(180deg,#FFFFFF_0%,#F3FCFE_40%,#E5F8FC_100%)] px-6 pb-24 pt-20 md:px-8 md:pb-32 md:pt-28"
    >
      <Hills />
      <div className="relative mx-auto max-w-6xl">
        <Reveal className="mx-auto max-w-[680px] text-center">
          <h2 className="text-[2.1rem] font-extrabold leading-[1.12] tracking-[-0.03em] text-on-surface sm:text-[2.9rem]">
            <Highlight text={copy.journey.title.text} highlight={copy.journey.title.highlight} />
          </h2>
          <p className="mt-5 text-[1.05rem] leading-8 text-on-surface-variant">
            {copy.journey.description}
          </p>
        </Reveal>

        <JourneyCanvas copy={copy} />
        <JourneyTimeline copy={copy} />
      </div>
    </section>
  );
}
