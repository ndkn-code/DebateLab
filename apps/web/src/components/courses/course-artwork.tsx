"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { CourseCategory, CourseLibraryItem } from "@/lib/api/courses";

export type CourseArtworkVariant =
  | "lighthouse"
  | "microphone"
  | "puzzle"
  | "mountain"
  | "brain"
  | "default";

export function resolveCourseArtworkVariant(
  course: Pick<CourseLibraryItem, "slug" | "title" | "category" | "artworkVariant">
): CourseArtworkVariant {
  if (course.artworkVariant) {
    return course.artworkVariant;
  }

  const slug = course.slug.toLowerCase();
  const title = course.title.toLowerCase();

  if (
    slug.includes("intro-to-debate") ||
    slug.includes("foundations-of-competitive-debate") ||
    title.includes("fundamentals of debate")
  ) {
    return "lighthouse";
  }

  if (slug.includes("public-speaking") || title.includes("public speaking")) {
    return "microphone";
  }

  if (slug.includes("logic") || title.includes("critical thinking")) {
    return "puzzle";
  }

  if (slug.includes("advanced-debate") || title.includes("advanced debate")) {
    return "mountain";
  }

  if (slug.includes("rebuttal") || title.includes("rebuttal")) {
    return "brain";
  }

  return course.category === "public-speaking" ? "microphone" : "default";
}

export function CourseArtwork({
  variant,
  className,
}: {
  variant: CourseArtworkVariant;
  className?: string;
}) {
  return (
    <div className={cn("relative h-full w-full overflow-hidden", className)}>
      {variant === "lighthouse" ? <LighthouseArtwork /> : null}
      {variant === "microphone" ? <MicrophoneArtwork /> : null}
      {variant === "puzzle" ? <PuzzleArtwork /> : null}
      {variant === "mountain" ? <MountainArtwork /> : null}
      {variant === "brain" ? <BrainArtwork /> : null}
      {variant === "default" ? <DefaultArtwork /> : null}
    </div>
  );
}

function ArtworkFrame({
  viewBox = "0 0 320 190",
  children,
}: {
  viewBox?: string;
  children: ReactNode;
}) {
  return (
    <svg
      viewBox={viewBox}
      className="h-full w-full"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

function LighthouseArtwork() {
  return (
    <ArtworkFrame>
      <defs>
        <linearGradient id="sky-lighthouse" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#b9cfff" />
          <stop offset="58%" stopColor="#f9d4c9" />
          <stop offset="100%" stopColor="#ffeeb7" />
        </linearGradient>
        <linearGradient id="sea-lighthouse" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#8eaef5" />
          <stop offset="100%" stopColor="#5d79d8" />
        </linearGradient>
      </defs>
      <rect width="320" height="190" fill="url(#sky-lighthouse)" />
      <circle cx="276" cy="134" r="18" fill="#fff7df" opacity="0.88" />
      <path d="M0 116C32 108 74 106 115 116C157 127 191 132 220 126C246 121 283 103 320 102V190H0Z" fill="url(#sea-lighthouse)" />
      <path d="M0 125C36 113 64 121 103 130C136 137 171 142 211 136C242 132 276 118 320 118V190H0Z" fill="#6f8de4" opacity="0.6" />
      <path d="M20 147L89 121L150 144L170 190H0V190Z" fill="#5f6e95" />
      <path d="M63 145L130 127L171 146L185 190H22Z" fill="#3b4768" />
      <rect x="145" y="45" width="40" height="86" rx="8" fill="#f9fbff" />
      <rect x="156" y="34" width="19" height="20" rx="2" fill="#20335a" />
      <rect x="151" y="24" width="28" height="12" rx="4" fill="#f0a657" />
      <rect x="161" y="17" width="8" height="10" rx="2" fill="#3f516d" />
      <rect x="149" y="55" width="33" height="6" fill="#d7e1f4" />
      <rect x="149" y="79" width="33" height="6" fill="#d7e1f4" />
      <path d="M140 131H190L198 151H132Z" fill="#f1f5fb" />
      <path d="M140 131H190L194 142H136Z" fill="#cedaf0" opacity="0.8" />
      <path d="M168 34L194 43L168 52Z" fill="#ffd56b" opacity="0.5" />
      <path d="M78 58C84 53 90 53 97 58" fill="none" stroke="#3b4b77" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M95 58C101 53 108 53 114 58" fill="none" stroke="#3b4b77" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M220 157H279" stroke="#f9fcff" strokeWidth="4" strokeLinecap="round" opacity="0.75" />
    </ArtworkFrame>
  );
}

function MicrophoneArtwork() {
  return (
    <ArtworkFrame>
      <defs>
        <linearGradient id="mic-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#6b5644" />
          <stop offset="45%" stopColor="#2a2d35" />
          <stop offset="100%" stopColor="#1b1b1e" />
        </linearGradient>
        <linearGradient id="mic-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f4f7fb" />
          <stop offset="100%" stopColor="#9aa7ba" />
        </linearGradient>
      </defs>
      <rect width="320" height="190" fill="url(#mic-bg)" />
      <circle cx="58" cy="36" r="12" fill="#f9cf78" opacity="0.8" />
      <circle cx="93" cy="74" r="8" fill="#fde1a4" opacity="0.55" />
      <circle cx="37" cy="90" r="7" fill="#fff0c4" opacity="0.4" />
      <circle cx="271" cy="39" r="11" fill="#fff0c4" opacity="0.55" />
      <circle cx="248" cy="75" r="6" fill="#f9cf78" opacity="0.4" />
      <rect x="139" y="34" width="48" height="70" rx="24" fill="url(#mic-body)" />
      <rect x="145" y="43" width="36" height="52" rx="18" fill="#252d3f" />
      <line x1="152" y1="50" x2="152" y2="90" stroke="#8391a9" strokeWidth="2" />
      <line x1="160" y1="46" x2="160" y2="94" stroke="#8391a9" strokeWidth="2" />
      <line x1="168" y1="46" x2="168" y2="94" stroke="#8391a9" strokeWidth="2" />
      <line x1="176" y1="46" x2="176" y2="94" stroke="#8391a9" strokeWidth="2" />
      <path d="M131 83C131 100 143 112 163 112C182 112 195 100 195 83" fill="none" stroke="#dfe7f3" strokeWidth="8" strokeLinecap="round" />
      <path d="M163 112V138" stroke="#dfe7f3" strokeWidth="8" strokeLinecap="round" />
      <path d="M141 138H186" stroke="#dfe7f3" strokeWidth="8" strokeLinecap="round" />
      <path d="M144 154H182" stroke="#a9b7cb" strokeWidth="6" strokeLinecap="round" />
    </ArtworkFrame>
  );
}

function PuzzleArtwork() {
  return (
    <ArtworkFrame>
      <defs>
        <linearGradient id="puzzle-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#7f80c9" />
          <stop offset="52%" stopColor="#606eb5" />
          <stop offset="100%" stopColor="#4e8bf5" />
        </linearGradient>
      </defs>
      <rect width="320" height="190" fill="url(#puzzle-bg)" />
      <path d="M0 0H140L108 36L70 55L0 48Z" fill="#9898d8" opacity="0.4" />
      <g transform="translate(26 38) rotate(-10 50 40)">
        <rect x="0" y="0" width="98" height="78" rx="16" fill="#d6caef" />
        <circle cx="98" cy="35" r="12" fill="#d6caef" />
        <circle cx="48" cy="78" r="12" fill="#d6caef" />
        <circle cx="22" cy="0" r="11" fill="#7f80c9" />
      </g>
      <g transform="translate(132 28) rotate(8 70 60)">
        <rect x="0" y="0" width="126" height="102" rx="18" fill="#4a8fff" />
        <circle cx="126" cy="44" r="16" fill="#4a8fff" />
        <circle cx="56" cy="102" r="16" fill="#4a8fff" />
        <circle cx="0" cy="58" r="13" fill="#6aa8ff" />
        <circle cx="88" cy="0" r="13" fill="#6aa8ff" />
      </g>
      <circle cx="214" cy="86" r="18" fill="#7bb5ff" opacity="0.55" />
      <rect x="208" y="94" width="34" height="34" rx="6" fill="#6f86ff" opacity="0.6" />
    </ArtworkFrame>
  );
}

function MountainArtwork() {
  return (
    <ArtworkFrame>
      <defs>
        <linearGradient id="mountain-sky" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#9dd0ff" />
          <stop offset="65%" stopColor="#dbeaff" />
          <stop offset="100%" stopColor="#f7efe4" />
        </linearGradient>
      </defs>
      <rect width="320" height="190" fill="url(#mountain-sky)" />
      <circle cx="252" cy="42" r="18" fill="#fff7dc" opacity="0.82" />
      <path d="M0 132L62 76L116 132Z" fill="#dfe9f8" />
      <path d="M49 132L123 55L192 132Z" fill="#b5c8ea" />
      <path d="M101 132L194 34L308 132Z" fill="#7299e0" />
      <path d="M126 132L204 52L275 132Z" fill="#4877d4" />
      <path d="M170 67L192 34L214 68L205 67L193 52L179 67Z" fill="#eef6ff" />
      <path d="M0 132H320V190H0Z" fill="#ffffff" opacity="0.8" />
      <path d="M232 44L237 32L242 44Z" fill="#e15050" />
      <path d="M237 32V56" stroke="#365184" strokeWidth="2.5" />
    </ArtworkFrame>
  );
}

function BrainArtwork() {
  return (
    <ArtworkFrame>
      <defs>
        <linearGradient id="brain-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#182f73" />
          <stop offset="100%" stopColor="#0b1d54" />
        </linearGradient>
        <radialGradient id="brain-glow" cx="50%" cy="42%" r="40%">
          <stop offset="0%" stopColor="#ffe296" />
          <stop offset="100%" stopColor="#ffb94b" />
        </radialGradient>
      </defs>
      <rect width="320" height="190" fill="url(#brain-bg)" />
      <circle cx="92" cy="34" r="4" fill="#ffd56b" opacity="0.75" />
      <circle cx="228" cy="30" r="6" fill="#ffd56b" opacity="0.5" />
      <circle cx="265" cy="56" r="4" fill="#ffd56b" opacity="0.5" />
      <circle cx="58" cy="68" r="3" fill="#ffd56b" opacity="0.5" />
      <rect x="110" y="116" width="100" height="50" rx="14" fill="#5aa1ff" />
      <path d="M136 116H184L170 148H150Z" fill="#6fb0ff" />
      <circle cx="160" cy="78" r="38" fill="url(#brain-glow)" />
      <circle cx="141" cy="72" r="20" fill="#ffc45c" />
      <circle cx="177" cy="72" r="20" fill="#ffc45c" />
      <circle cx="152" cy="91" r="19" fill="#ffcf73" />
      <circle cx="170" cy="92" r="19" fill="#ffcf73" />
      <path d="M134 66C142 60 148 62 152 70" fill="none" stroke="#ef8f26" strokeWidth="4" strokeLinecap="round" />
      <path d="M170 70C173 62 180 60 188 66" fill="none" stroke="#ef8f26" strokeWidth="4" strokeLinecap="round" />
      <path d="M153 96C160 86 166 86 173 96" fill="none" stroke="#ef8f26" strokeWidth="4" strokeLinecap="round" />
      <path d="M160 27V16" stroke="#ffd56b" strokeWidth="4" strokeLinecap="round" />
      <path d="M128 37L121 28" stroke="#ffd56b" strokeWidth="4" strokeLinecap="round" />
      <path d="M192 37L199 28" stroke="#ffd56b" strokeWidth="4" strokeLinecap="round" />
      <path d="M116 54L105 51" stroke="#ffd56b" strokeWidth="4" strokeLinecap="round" />
      <path d="M204 54L215 51" stroke="#ffd56b" strokeWidth="4" strokeLinecap="round" />
    </ArtworkFrame>
  );
}

function DefaultArtwork() {
  return (
    <ArtworkFrame>
      <defs>
        <linearGradient id="default-art" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#c4d9ff" />
          <stop offset="100%" stopColor="#4d86f7" />
        </linearGradient>
      </defs>
      <rect width="320" height="190" fill="url(#default-art)" />
      <circle cx="74" cy="64" r="42" fill="#ffffff" opacity="0.12" />
      <circle cx="248" cy="122" r="58" fill="#ffffff" opacity="0.12" />
      <path d="M0 132C52 116 96 118 142 129C186 140 234 142 320 120V190H0Z" fill="#366de6" opacity="0.6" />
    </ArtworkFrame>
  );
}

export function getArtworkBackgroundClass(category: CourseCategory) {
  return category === "public-speaking"
    ? "from-[#32444c] via-[#2a2c34] to-[#191b1f]"
    : "from-[#b9cfff] via-[#f9d4c9] to-[#ffe9b7]";
}
