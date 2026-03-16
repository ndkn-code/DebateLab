"use client";

import Link from "next/link";
import { Flame, BarChart3, Clock, BookOpen, Sparkles } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { LottieAnimation } from "@/components/ui/lottie-animation";
import fireAnimation from "../../../public/lottie/fire.json";
import type { ProfileData } from "./profile-content";

interface UserCardProps {
  profile: ProfileData | null;
  onTitleChange: () => void;
}

function getInitials(name: string | null | undefined): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function UserCard({ profile, onTitleChange }: UserCardProps) {
  if (!profile) return null;

  const xpInLevel = profile.xp % 500;
  const xpPercent = (xpInLevel / 500) * 100;

  const stats = [
    {
      icon: Flame,
      value: profile.streak_current,
      label: "Day Streak",
      color: "text-orange-500",
      bg: "bg-orange-500/10",
    },
    {
      icon: BarChart3,
      value: profile.total_sessions_completed,
      label: "Debates",
      color: "text-primary",
      bg: "bg-primary/10",
    },
    {
      icon: Clock,
      value: formatMinutes(profile.total_practice_minutes),
      label: "Practiced",
      color: "text-emerald-500",
      bg: "bg-emerald-500/10",
    },
    {
      icon: BookOpen,
      value: "\u2014",
      label: "Courses",
      color: "text-purple-500",
      bg: "bg-purple-500/10",
    },
  ];

  return (
    <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary-container/30 to-surface-container-lowest p-6 soft-shadow">
      {/* Accent glow — matches AI Coach widget */}
      <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-primary/10 blur-2xl" />

      {/* Profile header */}
      <div className="relative flex flex-col items-center gap-5 sm:flex-row sm:items-start">
        {/* Avatar */}
        <Avatar className="size-20 ring-4 ring-white shadow-lg">
          {profile.avatar_url && (
            <AvatarImage src={profile.avatar_url} alt={profile.display_name ?? "Avatar"} />
          )}
          <AvatarFallback className="bg-primary-container text-on-primary-container text-xl font-bold">
            {getInitials(profile.display_name)}
          </AvatarFallback>
        </Avatar>

        {/* Name, title, XP */}
        <div className="flex-1 text-center sm:text-left">
          <h1 className="text-2xl font-bold text-on-surface">
            {profile.display_name ?? "Debater"}
          </h1>
          {profile.selected_title && (
            <p className="mt-0.5 flex items-center justify-center gap-1 text-sm font-medium text-primary sm:justify-start">
              <Sparkles className="h-3.5 w-3.5" />
              {profile.selected_title}
            </p>
          )}

          {/* XP bar */}
          <div className="mt-4">
            <div className="mb-1.5 flex items-center justify-between text-sm">
              <span className="font-semibold text-on-surface">Level {profile.level}</span>
              <span className="text-on-surface-variant">
                {xpInLevel} / 500 XP
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-primary/10">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500"
                style={{ width: `${xpPercent}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div className="relative mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="flex items-center gap-3 rounded-xl border border-outline-variant/10 bg-surface-container-lowest px-3 py-2.5"
          >
            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${stat.bg}`}>
              {stat.label === "Day Streak" && profile.streak_current > 0 ? (
                <LottieAnimation animationData={fireAnimation} className="w-7 h-7" loop={true} />
              ) : (
                <stat.icon className={`h-4.5 w-4.5 ${stat.color}`} />
              )}
            </div>
            <div>
              <p className="text-lg font-bold leading-tight text-on-surface">{stat.value}</p>
              <p className="text-xs text-on-surface-variant">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Action buttons */}
      <div className="relative mt-5 flex flex-wrap gap-3">
        <Button variant="outline" size="sm" onClick={onTitleChange} className="rounded-xl">
          Change Title
        </Button>
        <Link href="/settings">
          <Button variant="outline" size="sm" className="rounded-xl">
            Edit Profile
          </Button>
        </Link>
      </div>
    </div>
  );
}
