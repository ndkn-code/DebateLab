"use client";

import Link from "next/link";
import { Flame, BarChart3, Clock, BookOpen } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
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
  const xpForLevel = profile.level * 500;
  const xpPercent = xpForLevel > 0 ? (xpInLevel / 500) * 100 : 0;

  const stats = [
    {
      icon: Flame,
      value: profile.streak_current,
      label: "Day Streak",
      color: "text-orange-500",
      bg: "bg-orange-50",
    },
    {
      icon: BarChart3,
      value: profile.total_sessions_completed,
      label: "Debates",
      color: "text-blue-500",
      bg: "bg-blue-50",
    },
    {
      icon: Clock,
      value: formatMinutes(profile.total_practice_minutes),
      label: "Practiced",
      color: "text-emerald-500",
      bg: "bg-emerald-50",
    },
    {
      icon: BookOpen,
      value: "\u2014",
      label: "Courses",
      color: "text-purple-500",
      bg: "bg-purple-50",
    },
  ];

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm md:p-6">
      {/* Gradient banner */}
      <div className="rounded-xl bg-gradient-to-br from-[#2f4fdd] to-[#6366f1] p-6 text-white md:p-8">
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
          {/* Avatar */}
          <Avatar className="size-20 ring-4 ring-white shadow-lg">
            {profile.avatar_url && (
              <AvatarImage src={profile.avatar_url} alt={profile.display_name ?? "Avatar"} />
            )}
            <AvatarFallback className="bg-white/20 text-xl font-bold text-white">
              {getInitials(profile.display_name)}
            </AvatarFallback>
          </Avatar>

          {/* Name and title */}
          <div className="flex-1 text-center sm:text-left">
            <h1 className="text-2xl font-bold">
              {profile.display_name ?? "Debater"}
            </h1>
            {profile.selected_title && (
              <p className="mt-0.5 text-sm italic text-amber-300">
                {profile.selected_title}
              </p>
            )}

            {/* XP bar */}
            <div className="mt-4">
              <div className="mb-1.5 flex items-center justify-between text-sm">
                <span className="font-semibold">Level {profile.level}</span>
                <span className="text-white/70">
                  {xpInLevel} / 500 XP
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-white/20">
                <div
                  className="h-full rounded-full bg-amber-400 transition-all duration-500"
                  style={{ width: `${xpPercent}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Stats grid */}
        <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="flex items-center gap-3 rounded-lg bg-white/10 px-3 py-2.5 backdrop-blur-sm"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/15">
                <stat.icon className="h-4.5 w-4.5" />
              </div>
              <div>
                <p className="text-lg font-bold leading-tight">{stat.value}</p>
                <p className="text-xs text-white/70">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Action buttons */}
      <div className="mt-4 flex flex-wrap gap-3">
        <Button variant="outline" size="sm" onClick={onTitleChange}>
          Change Title
        </Button>
        <Link href="/settings">
          <Button variant="outline" size="sm">
            Edit Profile
          </Button>
        </Link>
      </div>
    </div>
  );
}
