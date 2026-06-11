"use client";

import { useMemo, useRef, useState, type RefObject } from "react";
import { Link } from "@/i18n/navigation";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Copy,
  FileText,
  Gauge,
  GitBranch,
  Info,
  Laptop,
  LayoutGrid,
  Loader2,
  Mic,
  Scale,
  Search,
  ShieldCheck,
  Sparkles,
  Swords,
  Trophy,
  Users,
  Volume2,
  WifiOff,
} from "@/components/ui/icons";
import type { LucideIcon } from "@/components/ui/icons";
import { Button } from "@/components/ui/button";
import { DuelCreatePage } from "@/components/debates/duel-create-page";
import { DuelMatchmakingPage } from "@/components/debates/duel-matchmaking-page";
import { DuelResultContent } from "@/components/debates/duel-result-page";
import {
  FeatureNudgePopup,
  SmartPopupFrame,
  SurveyPopup,
  SurveyThankYou,
} from "@/components/shared/smart-popup-host";
import { DebateClashMapPanel } from "@/components/feedback/debate-clash-map-panel";
import { DebateVerdictPanel } from "@/components/feedback/debate-verdict-panel";
import {
  SessionReviewShell,
  type SessionReviewTab,
} from "@/components/feedback/session-review-shell";
import { SessionResultDashboard } from "@/components/feedback/session-result-dashboard";
import { SessionTranscriptPanel } from "@/components/feedback/session-transcript-panel";
import { AiRebuttalPhase } from "@/components/practice/ai-rebuttal-phase";
import { AudioCheck } from "@/components/practice/audio-check";
import { MicCheck } from "@/components/practice/mic-check";
import { PrepPhase } from "@/components/practice/prep-phase";
import { SessionConfig } from "@/components/practice/session-config";
import { SpeakingPhase } from "@/components/practice/speaking-phase";
import {
  DEFAULT_SHOWCASE_SCENARIO_ID,
  SHOWCASE_SCENARIOS,
  SHOWCASE_SURFACES,
  getScenariosForSurface,
} from "@/lib/admin-ui-showcase/scenarios";
import {
  showcaseAiHighlights,
  showcaseAiRebuttalText,
  showcaseAnnotatedSession,
  showcaseDuelRoom,
  showcaseFullRoundSession,
  showcaseJudgingDuelRoom,
  showcaseLegacyDuelRoom,
  showcaseLegacySession,
  showcaseLivePrepDuelRoom,
  showcaseLiveSpeakingDuelRoom,
  showcaseLobbyDuelRoom,
  showcasePrepNotes,
  showcaseTopic,
  showcaseTranscript,
} from "@/lib/admin-ui-showcase/fixtures";
import { cn } from "@/lib/utils";
import type {
  ShowcaseCoverageRow,
  ShowcaseScenario,
  ShowcaseScenarioId,
  ShowcaseSurface,
} from "@/lib/admin-ui-showcase/types";
import type { LocalizedSurveyQuestion } from "@/lib/smart-popups/survey";
import type {
  SmartPopupPayload,
  SmartPopupSurveyPayload,
} from "@/lib/smart-popups/types";
import type { DebateDuelRoomView } from "@/types";

interface AdminUiShowcasePageProps {
  initialScenarioId: ShowcaseScenarioId;
  initialSurface: ShowcaseSurface;
  initialTab?: SessionReviewTab;
  coverageRows: ShowcaseCoverageRow[];
}

type PopupPortalContainer = RefObject<HTMLElement | ShadowRoot | null>;
type PopupShowcaseAnswer = number | string | string[];

const SURFACE_ICONS: Record<ShowcaseSurface, LucideIcon> = {
  practice: LayoutGrid,
  feedback: FileText,
  duel: Swords,
  popups: Sparkles,
};

const TABLE_LABELS: Record<ShowcaseCoverageRow["tableName"], string> = {
  practice_attempts: "Practice attempts",
  analysis_jobs: "Analysis jobs",
  debate_duels: "Debate duels",
};

const TABLE_ICONS: Record<ShowcaseCoverageRow["tableName"], LucideIcon> = {
  practice_attempts: LayoutGrid,
  analysis_jobs: Gauge,
  debate_duels: Swords,
};

type ShowcaseCategoryFilter =
  | "all"
  | "setup"
  | "transient"
  | "review"
  | "duel-room";

const CATEGORY_OPTIONS: Array<{
  value: ShowcaseCategoryFilter;
  label: string;
}> = [
  { value: "all", label: "All" },
  { value: "setup", label: "Setup" },
  { value: "transient", label: "Transient" },
  { value: "review", label: "Review" },
  { value: "duel-room", label: "Duel room" },
];

const STATUS_OPTIONS: Array<{
  value: "all" | ShowcaseScenario["status"];
  label: string;
}> = [
  { value: "all", label: "All" },
  { value: "ready", label: "Ready" },
  { value: "needs-review", label: "Needs review" },
  { value: "blocked", label: "Blocked" },
];

function scenarioHref(scenario: ShowcaseScenario) {
  const params = new URLSearchParams({
    surface: scenario.surface,
    state: scenario.id,
  });

  if (scenario.defaultTab) {
    params.set("tab", scenario.defaultTab);
  }

  return `/dashboard/admin/ui-showcase?${params.toString()}`;
}

function surfaceHref(surface: ShowcaseSurface) {
  const scenarioId =
    surface === "practice"
      ? DEFAULT_SHOWCASE_SCENARIO_ID
      : getScenariosForSurface(surface)[0]?.id ?? DEFAULT_SHOWCASE_SCENARIO_ID;
  return `/dashboard/admin/ui-showcase?surface=${surface}&state=${scenarioId}`;
}

function getScenarioIcon(scenario: ShowcaseScenario): LucideIcon {
  if (scenario.id.startsWith("audio")) return Volume2;
  if (scenario.id.startsWith("mic")) return Mic;
  if (scenario.id.startsWith("speaking")) return Mic;
  if (scenario.id.startsWith("ai-rebuttal")) return Bot;
  if (scenario.id.startsWith("transition")) return Loader2;
  if (scenario.id.startsWith("feedback-ai")) return Trophy;
  if (scenario.id.includes("clash")) return GitBranch;
  if (scenario.id.includes("transcript")) return FileText;
  if (scenario.surface === "popups") return Sparkles;
  if (scenario.surface === "duel") return Swords;
  if (scenario.surface === "feedback") return FileText;
  return LayoutGrid;
}

function aggregateCoverage(rows: ShowcaseCoverageRow[]) {
  return (Object.keys(TABLE_LABELS) as ShowcaseCoverageRow["tableName"][]).map(
    (tableName) => {
      const tableRows = rows.filter((row) => row.tableName === tableName);
      const total = tableRows.reduce((sum, row) => sum + row.count, 0);
      const statusSummary = tableRows
        .slice()
        .sort((left, right) => right.count - left.count)
        .slice(0, 3);

      return {
        tableName,
        total,
        statusSummary,
      };
    }
  );
}

function getScenarioCategory(scenario: ShowcaseScenario): ShowcaseCategoryFilter {
  if (
    scenario.id.includes("setup") ||
    scenario.id.includes("audio") ||
    scenario.id.includes("mic")
  ) {
    return "setup";
  }

  if (
    scenario.id.includes("speaking") ||
    scenario.id.includes("rebuttal") ||
    scenario.id.includes("transition")
  ) {
    return "transient";
  }

  if (scenario.surface === "duel") {
    return scenario.id.includes("result") ? "review" : "duel-room";
  }

  if (scenario.surface === "popups") {
    return "transient";
  }

  return "review";
}

function getFilteredScenarios({
  surface,
  query,
  category,
  status,
}: {
  surface: ShowcaseSurface;
  query: string;
  category: ShowcaseCategoryFilter;
  status: "all" | ShowcaseScenario["status"];
}) {
  const normalizedQuery = query.trim().toLowerCase();
  return getScenariosForSurface(surface).filter((scenario) => {
    const matchesQuery =
      !normalizedQuery ||
      scenario.title.toLowerCase().includes(normalizedQuery) ||
      scenario.summary.toLowerCase().includes(normalizedQuery) ||
      scenario.sourceComponent.toLowerCase().includes(normalizedQuery);
    const matchesCategory =
      category === "all" || getScenarioCategory(scenario) === category;
    const matchesStatus = status === "all" || scenario.status === status;

    return matchesQuery && matchesCategory && matchesStatus;
  });
}

function formatCount(count: number) {
  return new Intl.NumberFormat("en-US").format(count);
}

function formatSeconds(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

const POPUP_PLACEHOLDER_IMAGE = "/images/smart-popups/popup-placeholder-v1.png";

const POPUP_SURVEY: SmartPopupSurveyPayload = {
  versionId: "showcase-survey-v1",
  version: 1,
  rewardCredits: 50,
  thankYou: {
    title: "Thanks for the feedback.",
    body: "Your reward has been added to this preview state.",
  },
  questions: [
    {
      id: "overall",
      type: "rating",
      required: true,
      min: 1,
      max: 5,
      label: "How useful is this prompt?",
      minLabel: "Rough",
      maxLabel: "Great",
    },
    {
      id: "focus",
      type: "single_choice",
      required: true,
      label: "What should improve first?",
      options: [
        { id: "practice", label: "Practice flow" },
        { id: "feedback", label: "AI feedback" },
        { id: "reminders", label: "Reminders" },
      ],
    },
  ],
};

function makePopupPreviewPayload(
  id: ShowcaseScenarioId,
  overrides: Partial<SmartPopupPayload>
): SmartPopupPayload {
  const base: SmartPopupPayload = {
    key: id,
    surface: "dashboard",
    campaignType: "feature_nudge",
    popupKind: "practice_suggestion",
    segment: "active_user",
    title: "Practice smarter in 10 minutes.",
    body: "",
    eyebrow: "",
    ctaLabel: "Start practice",
    dismissLabel: "Later",
    dontShowAgainLabel: "Don't show again",
    ctaHref: "/practice",
    imageSrc: POPUP_PLACEHOLDER_IMAGE,
    imageAlt: "Blue Thinkfy star mascot holding a notification bell and cue card",
    facts: [],
    priority: 1,
    metadata: {
      previewOnly: true,
      actionSource: "ui_showcase",
      uiPattern: "duolingo_simple_modal_v2",
    },
  };

  return {
    ...base,
    ...overrides,
    metadata: {
      ...base.metadata,
      ...(overrides.metadata ?? {}),
    },
  };
}

const POPUP_PREVIEWS: Partial<Record<ShowcaseScenarioId, SmartPopupPayload>> = {
  "popup-feature-announcement": makePopupPreviewPayload("popup-feature-announcement", {
    popupKind: "feature_announcement",
    eyebrow: "",
    title: "Cleaner practice nudges are here.",
    body: "",
    ctaLabel: "Try a practice round",
    facts: [],
  }),
  "popup-practice-suggestion": makePopupPreviewPayload("popup-practice-suggestion", {
    popupKind: "practice_suggestion",
    eyebrow: "",
    title: "Drill rebuttal for 10 minutes.",
    body: "",
    ctaLabel: "Start rebuttal drill",
    facts: [],
  }),
  "popup-reminder-opt-in": makePopupPreviewPayload("popup-reminder-opt-in", {
    popupKind: "reminder_opt_in",
    eyebrow: "",
    title: "Want gentle practice reminders?",
    body: "",
    ctaLabel: "Enable email reminders",
    dismissLabel: "Not now",
    ctaHref: "/settings#notifications",
    facts: [],
  }),
  "popup-feedback-survey": makePopupPreviewPayload("popup-feedback-survey", {
    campaignType: "feedback_survey",
    popupKind: "feedback_survey",
    eyebrow: "",
    title: "How is Thinkfy feeling?",
    body: "",
    ctaLabel: "Share feedback",
    facts: [],
    survey: POPUP_SURVEY,
  }),
};

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function getDuelPhaseLabel(room: DebateDuelRoomView) {
  if (room.status === "lobby") return "Lobby";
  if (room.status === "judging") return "AI judging";
  if (room.currentPhase === "prep") return "Shared prep";
  if (room.currentPhase.includes("proposition")) return "Proposition speaking";
  if (room.currentPhase.includes("opposition")) return "Opposition speaking";
  return room.currentPhase.replaceAll("-", " ");
}

function getDuelStatusTone(status: DebateDuelRoomView["status"]) {
  if (status === "in_progress") return "border-primary/20 bg-primary/10 text-primary";
  if (status === "judging") return "border-warning/25 bg-warning/15 text-warning";
  if (status === "completed") return "border-success/20 bg-success/10 text-success";
  return "border-outline-variant/20 bg-surface-container-low text-on-surface-variant";
}

function ShowcaseToolbar({
  activeSurface,
  categoryFilter,
  onCategoryChange,
  rows,
  statusFilter,
  onStatusChange,
}: {
  activeSurface: ShowcaseSurface;
  categoryFilter: ShowcaseCategoryFilter;
  onCategoryChange: (value: ShowcaseCategoryFilter) => void;
  rows: ShowcaseCoverageRow[];
  statusFilter: "all" | ShowcaseScenario["status"];
  onStatusChange: (value: "all" | ShowcaseScenario["status"]) => void;
}) {
  const coverage = useMemo(() => aggregateCoverage(rows), [rows]);

  return (
    <section className="border-b border-outline-variant/20 bg-white px-4 py-3 sm:px-6 lg:px-7">
      <div className="grid min-w-0 gap-4 xl:grid-cols-[380px_115px_115px_minmax(435px,1fr)_125px]">
        <div className="min-w-0">
          <div className="mb-2 text-xs font-black text-on-surface">
            Surface
          </div>
          <div className="grid min-w-0 grid-cols-4 overflow-hidden rounded-lg border border-outline-variant/25 bg-surface">
            {SHOWCASE_SURFACES.map((surface) => {
              const Icon = SURFACE_ICONS[surface.id];
              const isActive = activeSurface === surface.id;
              return (
                <Link
                  key={surface.id}
                  href={surfaceHref(surface.id)}
                  className={cn(
                    "flex h-10 min-w-0 items-center justify-center gap-1.5 border-r border-outline-variant/20 px-2 text-sm font-black transition last:border-r-0",
                    isActive
                      ? "bg-primary text-on-primary shadow-token-card"
                      : "bg-surface text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{surface.label}</span>
                </Link>
              );
            })}
          </div>
        </div>

        <label className="min-w-0">
          <span className="mb-2 block text-xs font-black text-on-surface">
            Category
          </span>
          <select
            value={categoryFilter}
            onChange={(event) =>
              onCategoryChange(event.currentTarget.value as ShowcaseCategoryFilter)
            }
            className="h-10 w-full rounded-lg border border-outline-variant/25 bg-surface px-3 text-sm font-semibold text-on-surface outline-none focus:border-primary"
          >
            {CATEGORY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="min-w-0">
          <span className="mb-2 block text-xs font-black text-on-surface">
            Status
          </span>
          <select
            value={statusFilter}
            onChange={(event) =>
              onStatusChange(event.currentTarget.value as "all" | ShowcaseScenario["status"])
            }
            className="h-10 w-full rounded-lg border border-outline-variant/25 bg-surface px-3 text-sm font-semibold text-on-surface outline-none focus:border-primary"
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <div className="min-w-0 border-l border-outline-variant/20 pl-5">
          <div className="mb-2 flex items-center gap-2 text-xs font-black text-on-surface">
            Live coverage
            <Info className="h-3.5 w-3.5 text-on-surface-variant" />
          </div>
          <div className="grid min-w-0 gap-2 md:grid-cols-3">
          {coverage.map(({ tableName, total, statusSummary }) => {
            const Icon = TABLE_ICONS[tableName];
            const firstStatus = statusSummary[0];
            return (
              <div
                key={tableName}
                className="min-w-0 rounded-lg border border-outline-variant/25 bg-surface px-3 py-2.5"
              >
                <div className="flex items-start gap-2.5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary-container text-primary">
                      <Icon className="h-4 w-4" />
                    </span>
                  <div className="min-w-0">
                    <div className="truncate text-xs font-semibold text-on-surface-variant">
                      {TABLE_LABELS[tableName]}
                    </div>
                    <div className="mt-0.5 text-xl font-black leading-none text-on-surface">
                      {formatCount(total)}
                    </div>
                    <div className="mt-1 truncate text-[11px] font-medium text-on-surface-variant">
                      {firstStatus
                        ? `${firstStatus.status}: ${formatCount(firstStatus.count)}`
                        : "No rows"}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          </div>
        </div>

        <div className="min-w-0 border-l border-outline-variant/20 pl-5">
          <div className="text-xs font-black text-on-surface">
            About this page
          </div>
          <p className="mt-2 line-clamp-3 text-xs font-medium leading-5 text-on-surface-variant">
            Read-only counts only. No private content is displayed. All states are
            fixture-driven.
          </p>
        </div>
      </div>
    </section>
  );
}

function ScenarioRail({
  activeScenario,
  activeSurface,
  categoryFilter,
  searchQuery,
  setSearchQuery,
  statusFilter,
}: {
  activeScenario: ShowcaseScenario;
  activeSurface: ShowcaseSurface;
  categoryFilter: ShowcaseCategoryFilter;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  statusFilter: "all" | ShowcaseScenario["status"];
}) {
  const totalScenarios = getScenariosForSurface(activeSurface);
  const filteredScenarios = getFilteredScenarios({
    surface: activeSurface,
    query: searchQuery,
    category: categoryFilter,
    status: statusFilter,
  });
  const scenarios = filteredScenarios.some(
    (scenario) => scenario.id === activeScenario.id
  )
    ? [
        activeScenario,
        ...filteredScenarios.filter(
          (scenario) => scenario.id !== activeScenario.id
        ),
      ]
    : filteredScenarios;

  return (
    <aside className="flex h-[640px] min-w-0 flex-col rounded-lg border border-outline-variant/25 bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-outline-variant/20 px-3 py-2.5">
        <div>
          <h2 className="text-sm font-black text-on-surface">
            {SHOWCASE_SURFACES.find((surface) => surface.id === activeSurface)?.label} scenarios
          </h2>
        </div>
        <span className="rounded-full bg-primary-container px-2.5 py-1 text-xs font-black text-primary">
          {totalScenarios.length}
        </span>
      </div>

      <div className="border-b border-outline-variant/20 px-3 py-2">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant" />
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.currentTarget.value)}
            placeholder="Search scenarios..."
            className="h-9 w-full rounded-lg border border-outline-variant/25 bg-surface pl-9 pr-3 text-sm font-medium text-on-surface outline-none placeholder:text-on-surface-variant focus:border-primary"
          />
        </label>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {scenarios.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm font-medium text-on-surface-variant">
            No scenarios match the current filters.
          </div>
        ) : (
          scenarios.map((scenario) => {
          const Icon = getScenarioIcon(scenario);
          const isActive = scenario.id === activeScenario.id;
          return (
            <Link
              key={scenario.id}
              href={scenarioHref(scenario)}
              className={cn(
                "group flex min-w-0 items-center gap-3 border-b border-outline-variant/20 px-3 py-2 transition-colors last:border-b-0",
                isActive
                  ? "bg-primary-container/80 text-primary-dim"
                  : "text-on-surface hover:bg-surface-container-low"
              )}
            >
              <span
                className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-md",
                  isActive
                    ? "bg-primary text-on-primary"
                    : "bg-surface-container text-on-surface-variant"
                )}
              >
                <Icon className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-black">
                  {scenario.title}
                </span>
                <span className="mt-0.5 block truncate text-xs font-medium text-on-surface-variant">
                  {scenario.summary}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-success">
                <span className="h-1.5 w-1.5 rounded-full bg-success" />
                Ready
              </span>
            </Link>
          );
        })
        )}
      </div>

      <div className="border-t border-outline-variant/20 p-2">
        <Link
          href={surfaceHref(activeSurface)}
          className="flex h-10 items-center justify-between rounded-lg border border-outline-variant/25 bg-surface px-3 text-sm font-black text-on-surface transition hover:bg-surface-container-low"
        >
          View all {totalScenarios.length} scenarios
          <ChevronRight className="h-4 w-4 text-on-surface-variant" />
        </Link>
      </div>
    </aside>
  );
}

function TransitionOverlayPreview({
  kind,
}: {
  kind: "session-start" | "analyzing";
}) {
  const isAnalyzing = kind === "analyzing";
  return (
    <div className="grid min-h-[520px] place-items-center bg-primary px-6 text-center">
      <div>
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-on-primary/40 bg-white/15 text-on-primary">
          {isAnalyzing ? (
            <Loader2 className="h-8 w-8 animate-spin" />
          ) : (
            <Sparkles className="h-8 w-8" />
          )}
        </div>
        <h2 className="mt-6 text-4xl font-black tracking-normal text-on-primary sm:text-5xl">
          {isAnalyzing ? "Analyzing your debate" : "Starting your session"}
        </h2>
        <p className="mx-auto mt-4 max-w-md text-lg font-medium leading-8 text-primary-container">
          {isAnalyzing
            ? "The AI judge is building feedback, transcript notes, and clash links."
            : "Your prep timer, notes, and speaking flow are being prepared."}
        </p>
      </div>
    </div>
  );
}

function DuelRoomFixturePreview({ room }: { room: DebateDuelRoomView }) {
  const statusTone = getDuelStatusTone(room.status);
  const phaseLabel = getDuelPhaseLabel(room);
  const isLobby = room.status === "lobby";
  const isJudging = room.status === "judging";
  const activeSide = room.currentPhase.includes("proposition")
    ? "proposition"
    : room.currentPhase.includes("opposition")
      ? "opposition"
      : null;
  const readyCount = room.participants.filter((participant) => participant.readyAt).length;

  return (
    <div className="min-h-full bg-background px-4 py-6 sm:px-6 lg:px-8">
      <section className="mx-auto max-w-7xl rounded-[28px] border border-outline-variant/15 bg-surface p-5 shadow-token-card lg:p-7">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-outline-variant/20 bg-surface-container-low px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
              <Users className="h-3.5 w-3.5" />
              1v1 Debate
            </div>
            <h1 className="mt-4 text-3xl font-black leading-tight tracking-normal text-on-surface sm:text-4xl">
              {room.topicTitle}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-on-surface-variant">
              {room.topicCategory}
              {room.topicDescription ? ` · ${room.topicDescription}` : ""}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:min-w-[500px] xl:grid-cols-4">
            <div className="rounded-lg border border-outline-variant/20 bg-surface-container-low px-4 py-3">
              <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-on-surface-variant">
                Share code
              </div>
              <div className="mt-2 text-xl font-black tracking-[0.14em] text-on-surface">
                {room.shareCode}
              </div>
            </div>
            <div className="rounded-lg border border-outline-variant/20 bg-surface-container-low px-4 py-3">
              <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-on-surface-variant">
                Status
              </div>
              <div className={cn("mt-2 inline-flex rounded-full border px-3 py-1 text-xs font-bold capitalize", statusTone)}>
                {room.status.replaceAll("_", " ")}
              </div>
            </div>
            <div className="rounded-lg border border-outline-variant/20 bg-surface-container-low px-4 py-3">
              <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-on-surface-variant">
                Phase
              </div>
              <div className="mt-2 text-sm font-black capitalize text-on-surface">
                {phaseLabel}
              </div>
            </div>
            <div className="rounded-lg border border-outline-variant/20 bg-surface-container-low px-4 py-3">
              <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-on-surface-variant">
                Ready
              </div>
              <div className="mt-2 text-xl font-black text-on-surface">
                {readyCount}/2
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_360px]">
          <div className="rounded-[24px] border border-outline-variant/15 bg-surface-container-low p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-outline-variant/20 bg-surface px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-primary">
                  <Scale className="h-3.5 w-3.5" />
                  {phaseLabel}
                </div>
                <h2 className="mt-4 text-3xl font-black tracking-normal text-on-surface">
                  {isLobby
                    ? "Waiting for both debaters"
                    : isJudging
                      ? "AI is deciding the winner"
                      : activeSide === "proposition"
                        ? "Proposition has the floor"
                        : room.currentPhase === "prep"
                          ? "Shared prep is live"
                          : "Opposition has the floor"}
                </h2>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-on-surface-variant">
                  {isLobby
                    ? "The creator can share the room code, invite the opponent, and wait for both ready states."
                    : isJudging
                      ? "The speeches are submitted and the result route is temporarily unavailable until judging finishes."
                      : room.currentPhase === "prep"
                        ? "Both sides use this window to write notes before the first opening speech."
                        : "The active speaker sees recording guidance while the other debater follows the round."}
                </p>
              </div>
              <div className="rounded-[22px] border border-outline-variant/20 bg-surface px-5 py-4">
                <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">
                  {isJudging ? "Judge state" : "Timer"}
                </div>
                <div className="mt-2 text-4xl font-black text-on-surface">
                  {isJudging
                    ? "Reviewing"
                    : formatSeconds(room.currentPhase === "prep" ? 308 : 146)}
                </div>
                <div className="mt-2 text-sm text-on-surface-variant">
                  Static fixture preview
                </div>
              </div>
            </div>

            <div className="mt-5 grid gap-3 lg:grid-cols-2">
              {(["proposition", "opposition"] as const).map((side) => {
                const participant =
                  room.participants.find((item) => item.role === side) ?? null;
                const isActive = activeSide === side;
                return (
                  <div
                    key={side}
                    className={cn(
                      "rounded-[20px] border px-4 py-4",
                      isActive
                        ? "border-primary/25 bg-primary/8"
                        : "border-outline-variant/20 bg-surface"
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-surface-container-low text-sm font-black text-primary">
                          {participant ? getInitials(participant.displayName) : side[0]?.toUpperCase()}
                        </div>
                        <div>
                          <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-primary">
                            {side}
                          </div>
                          <div className="mt-1 text-base font-black text-on-surface">
                            {participant?.displayName ?? "Open seat"}
                          </div>
                        </div>
                      </div>
                      <span className="rounded-full border border-outline-variant/20 bg-surface-container-low px-3 py-1 text-xs font-bold text-on-surface-variant">
                        {isActive ? "Live" : participant?.readyAt ? "Ready" : "Waiting"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-5 rounded-[20px] border border-outline-variant/20 bg-surface p-4">
              <div className="text-sm font-black text-on-surface">
                Transcript and notes
              </div>
              <p className="mt-2 text-sm leading-7 text-on-surface-variant">
                {room.speeches[0]?.transcript ??
                  "No speeches have been submitted yet. Prep notes and room readiness are the visible states for this fixture."}
              </p>
            </div>
          </div>

          <aside className="rounded-[24px] border border-outline-variant/15 bg-surface p-5">
            <div className="flex items-center gap-2 text-sm font-black text-on-surface">
              <ShieldCheck className="h-4 w-4 text-primary" />
              Showcase safe controls
            </div>
            <div className="mt-4 space-y-3 text-sm leading-6 text-on-surface-variant">
              <p>Ready, join, start, speech submission, and polling actions are disabled.</p>
              <p>The fixture keeps the room state deterministic for screenshot QA.</p>
            </div>
            <div className="mt-5 grid gap-2">
              <Button disabled className="h-10 rounded-lg">
                {isLobby ? "Mark ready" : isJudging ? "Open result" : "Submit speech"}
              </Button>
              <Button disabled variant="outline" className="h-10 rounded-lg">
                Copy room link
              </Button>
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
}

function DuelUnavailablePreview() {
  return (
    <div className="min-h-[460px] bg-background px-4 py-10">
      <div className="mx-auto max-w-2xl rounded-[28px] border border-outline-variant/20 bg-surface p-8 text-center shadow-token-card">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-error-container text-error">
          <WifiOff className="h-6 w-6" />
        </div>
        <h1 className="mt-5 text-2xl font-black text-on-surface">
          Duel room unavailable
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-on-surface-variant">
          We could not load this duel room. This fixture covers the temporary
          error state without calling the live room API.
        </p>
      </div>
    </div>
  );
}

function PopupFixturePreview({
  scenario,
  portalContainer,
}: {
  scenario: ShowcaseScenario;
  portalContainer?: PopupPortalContainer;
}) {
  const [open, setOpen] = useState(true);
  const [answers, setAnswers] = useState<Record<string, PopupShowcaseAnswer>>({});
  const [submitted, setSubmitted] = useState(scenario.id === "popup-thank-you");
  const [error, setError] = useState<string | null>(null);
  const popup = POPUP_PREVIEWS[scenario.id] ?? POPUP_PREVIEWS["popup-practice-suggestion"]!;
  const isSurvey = popup.campaignType === "feedback_survey" && popup.survey;

  function setAnswer(questionId: string, value: PopupShowcaseAnswer) {
    setAnswers((current) => ({ ...current, [questionId]: value }));
  }

  function renderQuestion(question: LocalizedSurveyQuestion) {
    const value = answers[question.id];

    if (question.type === "rating" || question.type === "nps") {
      const min = question.min ?? (question.type === "nps" ? 0 : 1);
      const max = question.max ?? (question.type === "nps" ? 10 : 5);
      const values = Array.from({ length: max - min + 1 }, (_, index) => min + index);

      return (
        <div className="space-y-3">
          <div className="grid grid-cols-5 gap-2">
            {values.map((rating) => {
              const selected = value === rating;
              return (
                <button
                  key={rating}
                  type="button"
                  onClick={() => setAnswer(question.id, rating)}
                  className={cn(
                    "flex h-10 items-center justify-center rounded-lg border text-sm font-extrabold transition",
                    selected
                      ? "border-primary bg-primary text-white shadow-sm"
                      : "border-outline-variant bg-white text-on-surface-variant hover:border-primary-fixed hover:bg-background"
                  )}
                >
                  {rating}
                </button>
              );
            })}
          </div>
          {(question.minLabel || question.maxLabel) ? (
            <div className="flex justify-between gap-3 text-xs font-semibold text-on-surface-variant">
              <span>{question.minLabel}</span>
              <span>{question.maxLabel}</span>
            </div>
          ) : null}
        </div>
      );
    }

    if (question.type === "single_choice" || question.type === "multi_choice") {
      const selected = Array.isArray(value) ? value : typeof value === "string" ? [value] : [];
      return (
        <div className="grid gap-2">
          {(question.options ?? []).map((option) => {
            const active = selected.includes(option.id);
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => {
                  if (question.type === "single_choice") {
                    setAnswer(question.id, option.id);
                    return;
                  }
                  setAnswer(
                    question.id,
                    active
                      ? selected.filter((item) => item !== option.id)
                      : [...selected, option.id]
                  );
                }}
                className={cn(
                  "flex min-h-11 items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left text-sm font-semibold transition",
                  active
                    ? "border-primary bg-primary-container text-on-surface"
                    : "border-outline-variant bg-white text-on-surface-variant hover:border-primary-fixed"
                )}
              >
                <span>{option.label}</span>
                {active ? <CheckCircle2 className="h-4 w-4 text-primary" /> : null}
              </button>
            );
          })}
        </div>
      );
    }

    return (
      <textarea
        value={typeof value === "string" ? value : ""}
        onChange={(event) => setAnswer(question.id, event.currentTarget.value)}
        placeholder={question.placeholder}
        className="min-h-24 w-full rounded-lg border border-outline-variant bg-white px-3 py-2 text-sm text-on-surface outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary-fixed/40"
      />
    );
  }

  function submitSurvey(survey: SmartPopupSurveyPayload) {
    const missing = survey.questions.find((question) => {
      if (!question.required) return false;
      const value = answers[question.id];
      if (Array.isArray(value)) return value.length === 0;
      return value == null || value === "";
    });

    if (missing) {
      setError("Please answer the required questions.");
      return;
    }

    setError(null);
    setSubmitted(true);
  }

  return (
    <div className="relative min-h-[900px] overflow-hidden bg-background sm:min-h-[720px]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 grid gap-4 p-5 opacity-80 blur-[2px] sm:grid-cols-[1fr_320px] sm:p-8"
      >
        <div className="space-y-4">
          <div className="h-16 rounded-lg bg-primary" />
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="h-28 rounded-lg border border-outline-variant/30 bg-white" />
            <div className="h-28 rounded-lg border border-outline-variant/30 bg-white" />
          </div>
          <div className="h-64 rounded-lg border border-outline-variant/30 bg-white" />
        </div>
        <aside className="hidden space-y-4 sm:block">
          <div className="h-36 rounded-lg border border-outline-variant/30 bg-white" />
          <div className="h-48 rounded-lg border border-outline-variant/30 bg-white" />
        </aside>
      </div>

      {!open ? (
        <div className="relative z-10 grid min-h-[900px] place-items-center p-6 sm:min-h-[720px]">
          <Button type="button" onClick={() => setOpen(true)} className="h-11 rounded-lg">
            Reopen preview
          </Button>
        </div>
      ) : null}

      <SmartPopupFrame
        open={open}
        closeLabel={popup.dismissLabel}
        placement={isSurvey && !submitted ? "top" : "center"}
        portalContainer={portalContainer}
        onClose={() => setOpen(false)}
        onOpenChange={setOpen}
      >
        {submitted ? (
          <SurveyThankYou
            title={POPUP_SURVEY.thankYou.title}
            onDone={() => setOpen(false)}
          />
        ) : isSurvey && popup.survey ? (
          <SurveyPopup
            popup={popup}
            survey={popup.survey}
            submitError={error}
            renderQuestion={renderQuestion}
            onSubmit={() => submitSurvey(popup.survey!)}
            onDismiss={() => setOpen(false)}
          />
        ) : (
          <FeatureNudgePopup
            popup={popup}
            onCta={() => setOpen(false)}
            onDismiss={() => setOpen(false)}
          />
        )}
      </SmartPopupFrame>
    </div>
  );
}

function ShowcasePreview({
  scenario,
  initialTab,
  portalContainer,
}: {
  scenario: ShowcaseScenario;
  initialTab?: SessionReviewTab;
  portalContainer?: PopupPortalContainer;
}) {
  const [prepNotes, setPrepNotes] = useState(showcasePrepNotes);
  const noop = () => undefined;
  const reviewTab = initialTab ?? scenario.defaultTab ?? "overall";

  switch (scenario.id) {
    case "popup-feature-announcement":
    case "popup-practice-suggestion":
    case "popup-reminder-opt-in":
    case "popup-feedback-survey":
    case "popup-thank-you":
      return (
        <PopupFixturePreview
          key={scenario.id}
          scenario={scenario}
          portalContainer={portalContainer}
        />
      );
    case "practice-setup":
      return (
        <div className="mx-auto max-w-xl px-4 py-6">
          <SessionConfig
            topic={showcaseTopic}
            isBookmarked={false}
            onToggleBookmark={noop}
            orbBalance={9999}
            referralCode="SHOWCASE"
            onBalanceChange={noop}
            showcaseMode
          />
        </div>
      );
    case "audio-check-idle":
    case "audio-check-playing":
    case "audio-check-passed":
      return (
        <div className="mx-auto max-w-3xl px-4 py-8">
          <AudioCheck
            onPassed={noop}
            showcaseStatus={
              scenario.id === "audio-check-idle"
                ? "idle"
                : scenario.id === "audio-check-playing"
                  ? "playing"
                  : "passed"
            }
          />
        </div>
      );
    case "mic-requesting":
    case "mic-testing":
    case "mic-denied":
    case "mic-not-found":
      return (
        <div className="mx-auto max-w-3xl px-4 py-8">
          <MicCheck
            onReady={noop}
            onBack={noop}
            showcaseStatus={
              scenario.id === "mic-requesting"
                ? "requesting"
                : scenario.id === "mic-testing"
                  ? "testing"
                  : scenario.id === "mic-denied"
                    ? "denied"
                    : "not-found"
            }
            showcaseAudioDetected={scenario.id === "mic-testing"}
            showcaseLevels={[12, 20, 44, 72, 88, 64, 34, 18]}
          />
        </div>
      );
    case "prep":
      return (
        <PrepPhase
          topic={showcaseTopic}
          side="proposition"
          practiceTrack="debate"
          aiHintsEnabled
          timeLeft={308}
          totalTime={420}
          progress={0.27}
          isRunning
          prepNotes={prepNotes}
          onNotesChange={setPrepNotes}
          onSkip={noop}
        />
      );
    case "speaking-recording":
    case "speaking-paused":
    case "speaking-network-error":
    case "speaking-end-confirm":
      return (
        <SpeakingPhase
          topic={showcaseTopic}
          side="proposition"
          timeLeft={392}
          totalTime={420}
          progress={0.42}
          isRunning={scenario.id !== "speaking-paused"}
          isRecording
          transcript="I believe we should ban phones because they distract students from deep learning. First, when a notification appears, students lose focus"
          interimTranscript={
            scenario.id === "speaking-paused"
              ? ""
              : " and the teacher has to restart the explanation."
          }
          prepNotes={prepNotes}
          onNotesChange={setPrepNotes}
          audioStream={null}
          speechError={scenario.id === "speaking-network-error" ? "network" : null}
          onPause={noop}
          onResume={noop}
          onEnd={noop}
          isPaused={scenario.id === "speaking-paused"}
          hasDetectedAudio
          hasReceivedSpeech
          showcaseEndConfirm={scenario.id === "speaking-end-confirm"}
          rounds={[
            {
              roundNumber: 1,
              type: "user-speech",
              label: "Opening Statement",
              transcript:
                "Phones pull attention away from the hardest parts of learning, so a shared classroom rule protects every student's focus.",
            },
            {
              roundNumber: 2,
              type: "ai-rebuttal",
              label: "AI Rebuttal",
              aiResponse:
                "Phones can support research and accessibility, so a classroom policy should preserve access while targeting distraction.",
            },
            { roundNumber: 3, type: "user-speech", label: "Counter-Rebuttal" },
          ]}
          currentRound={3}
        />
      );
    case "ai-rebuttal-loading":
    case "ai-rebuttal-streaming":
    case "ai-rebuttal-done":
    case "ai-rebuttal-error":
      return (
        <AiRebuttalPhase
          topic={showcaseTopic.title}
          side="opposition"
          userTranscript={showcaseTranscript}
          roundLabel="AI Rebuttal"
          difficulty="medium"
          practiceLanguage="en"
          prepNotes={prepNotes}
          onNotesChange={setPrepNotes}
          onComplete={noop}
          initialResponse={showcaseAiRebuttalText}
          initialHighlights={showcaseAiHighlights}
          showcaseState={
            scenario.id === "ai-rebuttal-loading"
              ? "loading"
              : scenario.id === "ai-rebuttal-streaming"
                ? "streaming"
                : scenario.id === "ai-rebuttal-error"
                  ? "error"
                  : "done"
          }
          showcaseStreamingText="Phones can support research and accessibility, so a classroom policy should preserve access while targeting distraction..."
          showcaseError="Fixture error: the rebuttal stream returned an unavailable model response."
        />
      );
    case "transition-session-start":
      return <TransitionOverlayPreview kind="session-start" />;
    case "transition-analyzing":
      return <TransitionOverlayPreview kind="analyzing" />;
    case "feedback-result":
      return (
        <SessionResultDashboard
          session={showcaseAnnotatedSession}
          backHref="/practice"
          backLabel="Back to Practice"
          showInlineReviewControls={false}
        />
      );
    case "feedback-legacy":
      return (
        <SessionResultDashboard
          session={showcaseLegacySession}
          backHref="/practice"
          backLabel="Back to Practice"
          defaultShowTranscript
          showInlineReviewControls={false}
        />
      );
    case "feedback-history-overall":
    case "feedback-history-transcript":
    case "feedback-history-clash":
    case "feedback-ai-verdict":
    case "feedback-unmatched-annotation":
      return (
        <SessionReviewShell
          initialTab={reviewTab}
          verdict={<DebateVerdictPanel session={showcaseFullRoundSession} />}
          overall={
            <SessionResultDashboard
              session={
                scenario.id === "feedback-unmatched-annotation"
                  ? showcaseAnnotatedSession
                  : showcaseFullRoundSession
              }
              backHref="/history"
              backLabel="Back to History"
              showInlineReviewControls={false}
              className="max-w-none px-0 py-0"
            />
          }
          transcript={
            <SessionTranscriptPanel
              session={
                scenario.id === "feedback-unmatched-annotation"
                  ? showcaseAnnotatedSession
                  : showcaseFullRoundSession
              }
              annotations={
                scenario.id === "feedback-unmatched-annotation"
                  ? showcaseAnnotatedSession.feedback?.transcriptAnnotations
                  : showcaseFullRoundSession.feedback?.transcriptAnnotations
              }
              backHref="/history"
              backLabel="Back to History"
              emptyLabel="No transcript was recorded for this session."
              suggestionLabel="Try this"
              unmatchedLabel="Quote not found"
              roundLabel={(round) => `Round ${round}`}
            />
          }
          clashMap={<DebateClashMapPanel session={showcaseFullRoundSession} />}
        />
      );
    case "duel-create":
      return <DuelCreatePage initialTopics={[showcaseTopic]} showcaseMode />;
    case "duel-matchmaking":
      return <DuelMatchmakingPage initialTopics={[showcaseTopic]} showcaseMode />;
    case "duel-lobby":
      return <DuelRoomFixturePreview room={showcaseLobbyDuelRoom} />;
    case "duel-live-prep":
      return <DuelRoomFixturePreview room={showcaseLivePrepDuelRoom} />;
    case "duel-live-speaking":
      return <DuelRoomFixturePreview room={showcaseLiveSpeakingDuelRoom} />;
    case "duel-judging":
      return <DuelRoomFixturePreview room={showcaseJudgingDuelRoom} />;
    case "duel-unavailable":
      return <DuelUnavailablePreview />;
    case "duel-result-overall":
    case "duel-result-transcript":
    case "duel-result-clash":
      return <DuelResultContent room={showcaseDuelRoom} initialTab={reviewTab} />;
    case "duel-result-legacy":
      return <DuelResultContent room={showcaseLegacyDuelRoom} initialTab={reviewTab} />;
    default:
      return (
        <div className="grid min-h-[360px] place-items-center text-center">
          <div>
            <AlertTriangle className="mx-auto h-8 w-8 text-warning" />
            <p className="mt-3 text-sm font-semibold text-on-surface-variant">
              Scenario fixture not implemented.
            </p>
          </div>
        </div>
      );
  }
}

export function AdminUiShowcasePage({
  initialScenarioId,
  initialSurface,
  initialTab,
  coverageRows,
}: AdminUiShowcasePageProps) {
  const activeScenario =
    SHOWCASE_SCENARIOS.find((scenario) => scenario.id === initialScenarioId) ??
    SHOWCASE_SCENARIOS.find(
      (scenario) => scenario.id === DEFAULT_SHOWCASE_SCENARIO_ID
    )!;
  const activeSurface = activeScenario.surface ?? initialSurface;
  const [categoryFilter, setCategoryFilter] =
    useState<ShowcaseCategoryFilter>("all");
  const [copied, setCopied] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<"all" | ShowcaseScenario["status"]>("all");
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const surfaceScenarios = getScenariosForSurface(activeSurface);
  const activeScenarioIndex = Math.max(
    0,
    surfaceScenarios.findIndex((scenario) => scenario.id === activeScenario.id)
  );
  const previousScenario =
    surfaceScenarios[
      (activeScenarioIndex - 1 + surfaceScenarios.length) %
        surfaceScenarios.length
    ];
  const nextScenario =
    surfaceScenarios[(activeScenarioIndex + 1) % surfaceScenarios.length];

  async function copyDeepLink() {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <main className="min-h-full bg-white">
      <style jsx global>{`
        .admin-ui-showcase-preview .fixed {
          position: absolute !important;
        }
      `}</style>
      <div className="mx-auto flex max-w-[1680px] flex-col">
        <header className="border-b border-outline-variant/20 bg-white">
          <div className="flex min-h-11 items-center justify-between border-b border-outline-variant/20 px-4 py-2 sm:px-6 lg:px-7">
            <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-on-surface-variant">
              <span>Dashboard</span>
              <ChevronRight className="h-3.5 w-3.5" />
              <span>Admin</span>
              <ChevronRight className="h-3.5 w-3.5" />
              <span className="text-primary">UI Showcase</span>
            </div>
          </div>

          <div className="flex flex-col gap-4 px-4 py-3 sm:px-6 lg:px-7 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0">
              <h1 className="text-3xl font-black tracking-normal text-on-surface">
                UI Showcase
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-on-surface-variant">
                Explore hard-to-reach and transient states across DebateLab. Fixture-first
                and safe for admins.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <span className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary-container px-3 text-sm font-bold text-primary">
                <ShieldCheck className="h-4 w-4" />
                Fixture safe
              </span>
              <span className="inline-flex h-10 items-center gap-2 rounded-lg border border-outline-variant/20 bg-surface px-3 text-sm font-bold text-on-surface">
                <Laptop className="h-4 w-4 text-primary" />
                Browser QA target
              </span>
            </div>
          </div>
        </header>

        <ShowcaseToolbar
          activeSurface={activeSurface}
          categoryFilter={categoryFilter}
          onCategoryChange={setCategoryFilter}
          rows={coverageRows}
          statusFilter={statusFilter}
          onStatusChange={setStatusFilter}
        />

        <section
          data-showcase-shell="scenario-grid"
          className="grid min-w-0 items-start gap-4 bg-white px-4 py-4 sm:px-6 lg:px-7 xl:grid-cols-[360px_minmax(0,1fr)]"
        >
          <ScenarioRail
            activeScenario={activeScenario}
            activeSurface={activeSurface}
            categoryFilter={categoryFilter}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            statusFilter={statusFilter}
          />

          <div className="min-w-0 rounded-lg border border-outline-variant/20 bg-white">
            <div className="flex flex-col gap-3 border-b border-outline-variant/20 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-lg font-black text-on-surface">
                  <span>Previewing:</span>
                  <span className="capitalize text-primary">{activeScenario.surface}</span>
                  <ChevronRight className="h-4 w-4 text-on-surface-variant" />
                  <span className="text-primary">{activeScenario.title}</span>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={copyDeepLink}
                  className="h-9 shrink-0 gap-2 rounded-lg border-outline-variant/30 bg-surface px-3 text-sm font-black"
                >
                  <Copy className="h-4 w-4" />
                  {copied ? "Copied" : "Copy link"}
                </Button>
                {previousScenario && (
                  <Link
                    href={scenarioHref(previousScenario)}
                    aria-label="Previous scenario"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-outline-variant/30 bg-surface text-on-surface transition hover:bg-surface-container-low"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Link>
                )}
                {nextScenario && (
                  <Link
                    href={scenarioHref(nextScenario)}
                    aria-label="Next scenario"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-outline-variant/30 bg-surface text-on-surface transition hover:bg-surface-container-low"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                )}
              </div>
            </div>

            <div className="p-3">
              <div
                ref={previewContainerRef}
                data-showcase-preview
                className="admin-ui-showcase-preview relative min-h-[640px] overflow-auto rounded-lg border border-outline-variant/20 bg-white"
              >
                <ShowcasePreview
                  scenario={activeScenario}
                  initialTab={initialTab}
                  portalContainer={previewContainerRef}
                />
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
