"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  CircleDashed,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { CoachContextEnvelope, CoachProfile } from "@/types";

interface CoachInsightsRailProps {
  profile: CoachProfile;
  envelope: CoachContextEnvelope;
  isLoading?: boolean;
  onPromptSelect: (prompt: string) => void;
  className?: string;
  compact?: boolean;
}

const SKILL_COLORS = {
  clarity: "bg-[#4D86F7]",
  logic: "bg-[#A9C6FB]",
  rebuttal: "bg-[#F5B942]",
  evidence: "bg-[#34C759]",
  delivery: "bg-[#7B61FF]",
} as const;

export function CoachBrief({
  profile,
  envelope,
  onPromptSelect,
}: {
  profile: CoachProfile;
  envelope: CoachContextEnvelope;
  onPromptSelect: (prompt: string) => void;
}) {
  const t = useTranslations("dashboard.chat");
  const skillLabel = (key: keyof typeof SKILL_COLORS | null) =>
    key ? t(`coach.skill_names.${key}`) : t("coach.not_enough_data");

  return (
    <div className="rounded-[28px] border border-outline-variant/15 bg-surface px-5 py-5 shadow-[0_18px_40px_rgba(11,20,66,0.04)] sm:px-6 sm:py-6">
      <div className="max-w-3xl">
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/12 bg-primary/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
          <Sparkles className="h-3.5 w-3.5" />
          {t("coach.personalized_brief_badge")}
        </div>
        <h1 className="mt-4 text-3xl font-semibold leading-tight text-on-surface sm:text-[2.15rem]">
          {t("coach.personalized_brief_title", { name: profile.displayName })}
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-on-surface-variant sm:text-[15px]">
          {envelope.focusSummary}
        </p>
      </div>

      <div className="mt-6 grid gap-3 lg:grid-cols-3">
        <InsightStat
          label={t("coach.strongest_skill")}
          value={skillLabel(profile.skillSnapshot.strongestSkill)}
          description={
            profile.strengthPatterns[0]
              ? t("coach.recurring_strength_description", {
                  strength: profile.strengthPatterns[0],
                })
              : t("coach.strongest_skill_fallback")
          }
        />
        <InsightStat
          label={t("coach.focus_next")}
          value={
            profile.skillSnapshot.weakestSkill
              ? skillLabel(profile.skillSnapshot.weakestSkill)
              : t("coach.get_scored_session")
          }
          description={profile.brief.nextMove}
        />
        <InsightStat
          label={t("coach.recent_trend")}
          value={
            profile.recentTrend.averageScore != null
              ? `${Math.round(profile.recentTrend.averageScore)} /100`
              : t("coach.no_scored_trend")
          }
          description={profile.brief.trendSummary}
        />
      </div>

      <div className="mt-6">
        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-on-surface-variant">
          {t("coach.ask_about_this")}
        </div>
        <div className="mt-3 flex flex-wrap gap-2.5">
          {envelope.starterPrompts.map((prompt) => (
            <button
              key={prompt}
              onClick={() => onPromptSelect(prompt)}
              className="rounded-full border border-outline-variant/18 bg-surface-container-low px-4 py-2 text-sm font-medium text-on-surface transition-colors hover:border-primary/30 hover:bg-primary/5 hover:text-primary"
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function InsightStat({
  label,
  value,
  description,
}: {
  label: string;
  value: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-outline-variant/12 bg-surface-container-low px-4 py-4">
      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-on-surface-variant">
        {label}
      </div>
      <div className="mt-2 text-xl font-semibold text-on-surface">{value}</div>
      <p className="mt-2 text-sm leading-6 text-on-surface-variant">{description}</p>
    </div>
  );
}

export function CoachInsightsRail({
  profile,
  envelope,
  isLoading = false,
  onPromptSelect,
  className,
  compact = false,
}: CoachInsightsRailProps) {
  const t = useTranslations("dashboard.chat");
  const sessionLimit = compact ? 2 : 3;
  const recommendationLimit = compact ? 2 : 3;
  const skillLabel = (key: keyof typeof SKILL_COLORS) => t(`coach.skill_names.${key}`);

  return (
    <aside
      className={cn(
        "flex h-full flex-col gap-4 overflow-y-auto bg-surface-container-low/50 px-4 py-4 sm:px-5",
        className
      )}
    >
      <section className="rounded-[24px] border border-outline-variant/14 bg-surface px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-base font-semibold text-on-surface">
              {t("coach.skill_snapshot_title")}
            </div>
            <p className="mt-1 text-sm leading-6 text-on-surface-variant">
              {t("coach.skill_snapshot_subtitle")}
            </p>
          </div>
          <BarChart3 className="mt-0.5 h-4 w-4 text-primary" />
        </div>

        <div className="mt-4 space-y-3">
          {profile.skillSnapshot.metrics.map((metric) => (
            <div key={metric.key} className="space-y-1.5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm font-medium text-on-surface">
                  <span
                    className={cn(
                      "h-2.5 w-2.5 rounded-full",
                      SKILL_COLORS[metric.key]
                    )}
                  />
                  <span>{skillLabel(metric.key)}</span>
                </div>
                <span className="text-sm font-semibold text-on-surface">
                  {Math.round(metric.value)} /100
                </span>
              </div>
              <div className="h-2 rounded-full bg-[#DEE8F8]">
                <div
                  className={cn(
                    "h-full rounded-full",
                    SKILL_COLORS[metric.key]
                  )}
                  style={{ width: `${Math.max(12, metric.value)}%` }}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between rounded-2xl border border-outline-variant/12 bg-surface-container-low px-3 py-3">
          <div>
            <div className="text-xs uppercase tracking-[0.16em] text-on-surface-variant">
              {t("coach.overall_score")}
            </div>
            <div className="mt-1 text-lg font-semibold text-on-surface">
              {profile.skillSnapshot.overallScore != null
                ? `${Math.round(profile.skillSnapshot.overallScore)} /100`
                : t("coach.not_enough_data")}
            </div>
          </div>
          <div className="text-right text-xs leading-5 text-on-surface-variant">
            <div>
              {t("coach.strongest_label", {
                skill: profile.skillSnapshot.strongestSkill
                  ? skillLabel(profile.skillSnapshot.strongestSkill)
                  : t("coach.not_enough_data"),
              })}
            </div>
            <div>
              {t("coach.weakest_label", {
                skill: profile.skillSnapshot.weakestSkill
                  ? skillLabel(profile.skillSnapshot.weakestSkill)
                  : t("coach.not_enough_data"),
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[24px] border border-outline-variant/14 bg-surface px-4 py-4">
        <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.16em] text-primary">
          <Target className="h-4 w-4" />
          {t("coach.current_focus")}
        </div>
        <div className="mt-3 text-base font-semibold text-on-surface">
          {envelope.focusTitle}
        </div>
        <p className="mt-2 text-sm leading-6 text-on-surface-variant">
          {envelope.focusSummary}
        </p>
        {envelope.selectedSession && (
          <div className="mt-3 rounded-2xl border border-outline-variant/12 bg-surface-container-low px-3 py-3">
            <div className="text-sm font-semibold text-on-surface">
              {envelope.selectedSession.topicTitle}
            </div>
            <div className="mt-1 text-xs text-on-surface-variant">
              {envelope.selectedSession.practiceTrack === "speaking"
                ? t("coach.speaking_practice")
                : t("coach.debate_practice")}{" "}
              • {envelope.selectedSession.overallBand ?? t("coach.unrated")}
            </div>
          </div>
        )}
        {envelope.selectedDuel && (
          <div className="mt-3 rounded-2xl border border-outline-variant/12 bg-surface-container-low px-3 py-3">
            <div className="text-sm font-semibold text-on-surface">
              {envelope.selectedDuel.topicTitle}
            </div>
            <div className="mt-1 text-xs text-on-surface-variant">
              {t("coach.winner_side", {
                side: envelope.selectedDuel.winnerSide ?? t("coach.pending"),
              })}
            </div>
          </div>
        )}
        {envelope.selectedCourse && (
          <div className="mt-3 rounded-2xl border border-outline-variant/12 bg-surface-container-low px-3 py-3">
            <div className="text-sm font-semibold text-on-surface">
              {envelope.selectedCourse.title}
            </div>
            <div className="mt-1 text-xs text-on-surface-variant">
              {envelope.selectedCourse.progressPercent != null
                ? t("coach.course_progress_complete", {
                    progress: envelope.selectedCourse.progressPercent,
                  })
                : t("coach.course_progress_unavailable")}
            </div>
          </div>
        )}
      </section>

      <section className="rounded-[24px] border border-outline-variant/14 bg-surface px-4 py-4">
        <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.16em] text-primary">
          <TrendingUp className="h-4 w-4" />
          {t("coach.recommended_next_steps")}
        </div>
        <div className="mt-3 space-y-3">
          {profile.recommendations.slice(0, recommendationLimit).map((recommendation) => (
            <div
              key={recommendation.id}
              className="rounded-2xl border border-outline-variant/12 bg-surface-container-low px-3 py-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-on-surface">
                    {recommendation.title}
                  </div>
                  <p className="mt-1 text-xs leading-5 text-on-surface-variant">
                    {recommendation.description}
                  </p>
                </div>
                {recommendation.href ? (
                  <Link
                    href={recommendation.href}
                    className="rounded-full border border-primary/18 bg-primary/5 px-2.5 py-1 text-xs font-semibold text-primary transition-colors hover:bg-primary/10"
                  >
                    {t("coach.open_action")}
                  </Link>
                ) : (
                  <button
                    onClick={() => onPromptSelect(recommendation.prompt)}
                    className="rounded-full border border-primary/18 bg-primary/5 px-2.5 py-1 text-xs font-semibold text-primary transition-colors hover:bg-primary/10"
                  >
                    {t("coach.ask_action")}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-[24px] border border-outline-variant/14 bg-surface px-4 py-4">
        <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.16em] text-primary">
          <BookOpen className="h-4 w-4" />
          {t("coach.recent_sessions")}
        </div>
        <div className="mt-3 space-y-3">
          {profile.recentSessions.length > 0 ? (
            profile.recentSessions.slice(0, sessionLimit).map((session) => (
              <Link
                key={session.id}
                href={session.href}
                className="block rounded-2xl border border-outline-variant/12 bg-surface-container-low px-3 py-3 transition-colors hover:border-primary/20 hover:bg-primary/5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-on-surface">
                      {session.topicTitle}
                    </div>
                    <div className="mt-1 text-xs text-on-surface-variant">
                      {session.practiceTrack === "speaking"
                        ? t("coach.speaking_practice")
                        : t("coach.debate_practice")}
                    </div>
                  </div>
                  <div className="text-right text-xs text-on-surface-variant">
                    <div className="font-semibold text-on-surface">
                      {session.totalScore != null
                        ? `${Math.round(session.totalScore)} /100`
                        : t("coach.unscored")}
                    </div>
                  </div>
                </div>
              </Link>
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-outline-variant/16 bg-surface-container-low px-3 py-3 text-sm text-on-surface-variant">
              {t("coach.no_recent_sessions")}
            </div>
          )}
        </div>
      </section>

      <section className="rounded-[24px] border border-outline-variant/14 bg-surface px-4 py-4">
        <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.16em] text-primary">
          <CircleDashed className="h-4 w-4" />
          {t("coach.ask_about_this")}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {envelope.starterPrompts.map((prompt) => (
            <button
              key={prompt}
              onClick={() => onPromptSelect(prompt)}
              className="rounded-full border border-outline-variant/14 bg-surface-container-low px-3 py-2 text-xs font-medium text-on-surface transition-colors hover:border-primary/30 hover:bg-primary/5 hover:text-primary"
            >
              {prompt}
            </button>
          ))}
        </div>
        {!compact && (
          <div className="mt-4 flex items-center justify-between rounded-2xl border border-outline-variant/12 bg-surface-container-low px-3 py-3 text-xs text-on-surface-variant">
            <span>
              {isLoading ? t("coach.refreshing_insights") : profile.recentTrend.summary}
            </span>
            <ArrowRight className="h-3.5 w-3.5 shrink-0 text-primary" />
          </div>
        )}
      </section>
    </aside>
  );
}
