import {
  ThinkfyApiError,
  createThinkfyApiClient,
} from "@thinkfy/shared/api-client";
import type {
  DashboardHomeData,
  DashboardQuickAction,
  DashboardRecentItem,
  DashboardRecommendedDrill,
  DashboardTodayPlanItem,
} from "@thinkfy/shared/dashboard";
import { useRouter, type Href } from "expo-router";
import type { SFSymbol } from "expo-symbols";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";

import {
  AppButton,
  AppText,
  Badge,
  GlassSurface,
  IconBadge,
  ProgressBar,
  Screen,
  SectionHeader,
  StateBlock,
  Surface,
  useThinkfyColors,
} from "@/components/ui";
import { spacing } from "@/design/tokens";
import { useAuth } from "@/lib/auth";
import { previewDashboardData } from "@/lib/dashboard-preview";
import { isDesignPreviewEnabled } from "@/lib/design-preview";
import { mobileEnv } from "@/lib/env";
import { trackMobileDashboardEvent } from "@/lib/mobile-analytics";

type MobileDashboardResponse = {
  ok: true;
  authSource: "bearer" | "cookie" | "dev-bypass";
  data: DashboardHomeData;
};

type DashboardStatus =
  | { state: "loading" }
  | { state: "ready"; data: DashboardHomeData; isPreview: boolean }
  | { state: "signed-out" }
  | { state: "error"; message: string };

type MobileQuickAction = {
  key: "practice" | "history" | "coach" | "courses";
  href: string;
  label: string;
  value: string;
  icon: SFSymbol;
  sourceKey?: DashboardQuickAction["key"];
};

function getMobileQuickActions(data: DashboardHomeData): MobileQuickAction[] {
  const practiceAction =
    data.quickActions.find((action) => action.key === "speaking") ??
    data.quickActions.find((action) => action.key === "debate");
  const coachAction = data.quickActions.find((action) => action.key === "coach");
  const courseAction = data.quickActions.find((action) => action.key === "course");
  const latestReviewHref = data.recentActivity[0]?.href ?? "/history";

  return [
    {
      key: "practice",
      href: practiceAction?.href ?? "/practice",
      sourceKey: practiceAction?.key,
      label: "Practice",
      value: "Speaking setup",
      icon: "mic",
    },
    {
      key: "history",
      href: latestReviewHref,
      label: "Feedback",
      value: data.recentActivity.length > 0 ? "Review history" : "After practice",
      icon: "clock.arrow.circlepath",
    },
    {
      key: "coach",
      href: coachAction?.href ?? "/chat?context=coach-home",
      sourceKey: coachAction?.key,
      label: "Coach",
      value: "Ask next",
      icon: "bubble.left.and.bubble.right",
    },
    {
      key: "courses",
      href: courseAction?.href ?? "/courses",
      sourceKey: courseAction?.key,
      label: "Courses",
      value: data.courseContinuation ? "Continue" : "Browse",
      icon: "book.closed",
    },
  ];
}

function getPlanTitle(item: DashboardRecommendedDrill) {
  switch (item.key) {
    case "continue-course":
      return "Continue course";
    case "weakest-skill":
      return item.skillKey ? `Strengthen ${item.skillKey}` : "Strengthen a skill";
    case "review-feedback":
      return "Review feedback";
    case "underused-track":
      return item.track === "speaking" ? "Practice speaking" : "Practice debate";
    case "start-speaking":
      return "Start speaking";
    case "start-debate":
      return "Start debate";
    case "coach-check":
      return "Ask AI Coach";
    default:
      return "Start practice";
  }
}

function getPlanReason(item: DashboardRecommendedDrill) {
  if (item.context) return item.context;
  if (item.scoreOutOf100 != null) return `Current score ${item.scoreOutOf100}/100`;
  if (item.track) return `${item.track === "speaking" ? "Speaking" : "Debate"} focus`;
  return `${item.durationMinutes} minute focus`;
}

function getPlanButtonLabel(item: DashboardRecommendedDrill) {
  switch (item.ctaKey) {
    case "continue":
      return "Continue";
    case "review":
      return "Review";
    case "ask-coach":
      return "Ask coach";
    default:
      return "Start drill";
  }
}

function routeForHref(href?: string) {
  if (!href) return "/practice" as const;
  if (href.includes("/chat")) return "/coach" as const;
  if (href.includes("/courses")) return "/courses" as const;
  if (href.includes("/history")) return "/history" as const;
  if (href.includes("/profile")) {
    return "/profile" as const;
  }
  return "/practice" as const;
}

function isStarterDashboard(data: DashboardHomeData) {
  const totalSessions =
    data.progress.find((metric) => metric.key === "total-sessions")?.value ??
    data.profile?.total_sessions_completed ??
    0;

  return totalSessions === 0 && data.recentActivity.length === 0;
}

export function TodayScreen() {
  const router = useRouter();
  const { getAccessToken, isLoading, user } = useAuth();
  const isPreview = isDesignPreviewEnabled();
  const [status, setStatus] = useState<DashboardStatus>({ state: "loading" });
  const [reloadKey, setReloadKey] = useState(0);
  const viewedSignatureRef = useRef<string | null>(null);

  const apiClient = useMemo(
    () =>
      mobileEnv.apiBaseUrl
        ? createThinkfyApiClient({
            baseUrl: mobileEnv.apiBaseUrl,
            getAccessToken,
          })
        : null,
    [getAccessToken]
  );

  useEffect(() => {
    let isMounted = true;

    if (isPreview) {
      setStatus({
        state: "ready",
        data: previewDashboardData,
        isPreview: true,
      });
      return () => {
        isMounted = false;
      };
    }

    if (isLoading) {
      setStatus({ state: "loading" });
      return () => {
        isMounted = false;
      };
    }

    if (!user) {
      setStatus({ state: "signed-out" });
      return () => {
        isMounted = false;
      };
    }

    if (!apiClient) {
      setStatus({
        state: "error",
        message: "Set EXPO_PUBLIC_API_BASE_URL to load today's dashboard.",
      });
      return () => {
        isMounted = false;
      };
    }

    setStatus({ state: "loading" });

    apiClient
      .requestJson<MobileDashboardResponse>("/api/mobile/dashboard")
      .then((response) => {
        if (!isMounted) return;
        setStatus({
          state: "ready",
          data: response.data,
          isPreview: false,
        });
      })
      .catch((error) => {
        if (!isMounted) return;
        const message =
          error instanceof ThinkfyApiError
            ? `${error.status}: ${error.message}`
            : error instanceof Error
              ? error.message
              : "Dashboard request failed.";
        setStatus({ state: "error", message });
      });

    return () => {
      isMounted = false;
    };
  }, [apiClient, isLoading, isPreview, reloadKey, user]);

  useEffect(() => {
    if (status.state !== "ready" || status.isPreview) return;

    const signature = `${status.data.profile?.id ?? "unknown"}:${
      status.data.topBar.currentStreak
    }:${status.data.recentActivity.length}`;
    if (viewedSignatureRef.current === signature) return;
    viewedSignatureRef.current = signature;

    trackMobileDashboardEvent(apiClient, "mobile_dashboard_viewed", {
      currentStreak: status.data.topBar.currentStreak,
      recentActivityCount: status.data.recentActivity.length,
      todayGoalPercent: status.data.hero.todayGoal.progressPercent,
    });
  }, [apiClient, status]);

  const retry = useCallback(() => {
    setReloadKey((value) => value + 1);
  }, []);

  const openRecommendedDrill = useCallback(
    (drill: DashboardRecommendedDrill, isPreviewData: boolean) => {
      if (!isPreviewData) {
        trackMobileDashboardEvent(
          apiClient,
          "mobile_dashboard_recommended_drill_tapped",
          {
            key: drill.key,
            href: drill.href,
            track: drill.track ?? null,
          }
        );
      }
      router.push(routeForHref(drill.href) as Href);
    },
    [apiClient, router]
  );

  const openQuickAction = useCallback(
    (action: MobileQuickAction, isPreviewData: boolean) => {
      if (!isPreviewData) {
        trackMobileDashboardEvent(
          apiClient,
          "mobile_dashboard_quick_action_tapped",
          {
            key: action.key,
            sourceKey: action.sourceKey ?? null,
            href: action.href ?? null,
          }
        );
      }
      router.push(routeForHref(action.href) as Href);
    },
    [apiClient, router]
  );

  if (status.state === "loading") {
    return <DashboardLoadingScreen />;
  }

  if (status.state === "signed-out") {
    return (
      <Screen
        eyebrow="Today"
        subtitle="Sign in to load your streak, XP, and recommended practice."
        title="Your plan is waiting"
        testID="today-signed-out-screen"
      >
        <StateBlock
          body="Return to the sign-in screen, then open Today again after your session restores."
          state="empty"
          title="Dashboard locked"
        />
      </Screen>
    );
  }

  if (status.state === "error") {
    return (
      <Screen
        eyebrow="Today"
        subtitle="The dashboard could not load, but your session is still safe."
        title="Try that again"
        testID="today-error-screen"
      >
        <StateBlock
          actionLabel="Retry"
          body={status.message}
          onPress={retry}
          state="error"
          title="Dashboard unavailable"
        />
      </Screen>
    );
  }

  return (
    <DashboardReadyScreen
      data={status.data}
      isPreview={status.isPreview}
      onOpenQuickAction={openQuickAction}
      onOpenRecommendedDrill={openRecommendedDrill}
    />
  );
}

function DashboardLoadingScreen() {
  const colors = useThinkfyColors();

  return (
    <Screen
      eyebrow="Today"
      subtitle="Loading your streak, XP, and recommended practice."
      title="Preparing your plan"
      testID="today-loading-screen"
    >
      <GlassSurface>
        <View style={styles.heroHeader}>
          <View style={[styles.loadingMetric, { backgroundColor: `${colors.primary}2E` }]} />
          <View style={[styles.loadingIcon, { backgroundColor: `${colors.secondary}29` }]} />
        </View>
        <View style={[styles.loadingLineLarge, { backgroundColor: `${colors.foreground}1A` }]} />
        <View style={[styles.loadingLine, { backgroundColor: `${colors.foreground}14` }]} />
        <View style={[styles.loadingLineShort, { backgroundColor: `${colors.foreground}14` }]} />
      </GlassSurface>
      <View style={styles.grid}>
        <Surface style={styles.actionCard} tone="soft" />
        <Surface style={styles.actionCard} tone="soft" />
      </View>
    </Screen>
  );
}

function DashboardReadyScreen({
  data,
  isPreview,
  onOpenQuickAction,
  onOpenRecommendedDrill,
}: {
  data: DashboardHomeData;
  isPreview: boolean;
  onOpenQuickAction: (
    action: MobileQuickAction,
    isPreviewData: boolean
  ) => void;
  onOpenRecommendedDrill: (
    drill: DashboardRecommendedDrill,
    isPreviewData: boolean
  ) => void;
}) {
  const colors = useThinkfyColors();
  const drill = data.recommendedDrill;
  const todayGoal = data.hero.todayGoal;
  const mobileQuickActions = getMobileQuickActions(data);
  const currentXpInLevel = data.topBar.xpCurrent % data.topBar.xpGoal;
  const xpProgress =
    data.topBar.xpGoal > 0 ? currentXpInLevel / data.topBar.xpGoal : 0;
  const starterDashboard = isStarterDashboard(data);

  return (
    <Screen
      eyebrow="Today"
      subtitle={
        todayGoal.metGoal
          ? "Daily goal complete. Keep the streak warm with one extra rep."
          : `${todayGoal.practicedMinutes} of ${todayGoal.goalMinutes} minutes done today.`
      }
      title={
        starterDashboard
          ? "Start your first rep"
          : `Ready for a ${drill.durationMinutes} minute drill?`
      }
      testID="today-screen"
    >
      <GlassSurface>
        <View style={styles.heroHeader}>
          <View style={styles.heroMetric}>
            <AppText variant="display">{data.topBar.currentStreak}</AppText>
            <AppText color={colors.muted} variant="caption">
              day streak
            </AppText>
          </View>
          <IconBadge
            backgroundColor={colors.secondaryContainer}
            color={colors.secondaryDim}
            name="flame"
            size={52}
          />
        </View>
        <View style={styles.copy}>
          <AppText variant="heading">{getPlanTitle(drill)}</AppText>
          <AppText color={colors.muted} variant="body">
            {getPlanReason(drill)}
          </AppText>
        </View>
        <ProgressBar tone="success" value={todayGoal.progressPercent / 100} />
        <View style={styles.row}>
          <Badge tone="success">{data.topBar.xpCurrent} XP</Badge>
          <Badge>Level {data.topBar.level}</Badge>
          <Badge tone="warning">
            {currentXpInLevel} / {data.topBar.xpGoal}
          </Badge>
          {isPreview ? <Badge tone="neutral">Preview</Badge> : null}
        </View>
        <ProgressBar value={xpProgress} />
        <AppButton onPress={() => onOpenRecommendedDrill(drill, isPreview)}>
          {getPlanButtonLabel(drill)}
        </AppButton>
      </GlassSurface>

      {starterDashboard ? (
        <StateBlock
          body="Complete one short drill and this screen will fill with streak, feedback, and progress history."
          state="empty"
          title="Fresh dashboard"
        />
      ) : null}

      <SectionHeader
        action={`${mobileQuickActions.length} actions`}
        title="Quick actions"
      />
      <View style={styles.grid}>
        {mobileQuickActions.map((action) => (
          <ActionCard
            action={action}
            key={action.key}
            onPress={() => onOpenQuickAction(action, isPreview)}
          />
        ))}
      </View>

      <SectionHeader title="Today plan" />
      <View style={styles.stack}>
        {data.todayPlanItems.length > 0 ? (
          data.todayPlanItems.map((item) => (
            <PlanRow item={item} key={item.id} />
          ))
        ) : (
          <Surface>
            <AppText variant="bodyStrong">One focused drill is enough</AppText>
            <AppText color={colors.muted} variant="caption">
              Finish the recommended drill to update your plan.
            </AppText>
          </Surface>
        )}
      </View>

      <SectionHeader title="Recent practice" />
      <View style={styles.stack}>
        {data.recentActivity.length > 0 ? (
          data.recentActivity.slice(0, 3).map((item) => (
            <RecentActivityRow item={item} key={item.id} />
          ))
        ) : (
          <Surface>
            <AppText variant="bodyStrong">No recent practice yet</AppText>
            <AppText color={colors.muted} variant="caption">
              Start with a quick speaking rep or debate setup.
            </AppText>
          </Surface>
        )}
      </View>
    </Screen>
  );
}

function ActionCard({
  action,
  onPress,
}: {
  action: MobileQuickAction;
  onPress: () => void;
}) {
  const colors = useThinkfyColors();

  return (
    <Surface style={styles.actionCard}>
      <IconBadge name={action.icon} />
      <View style={styles.copy}>
        <AppText variant="bodyStrong">{action.label}</AppText>
        <AppText color={colors.muted} variant="caption">
          {action.value}
        </AppText>
      </View>
      <AppButton onPress={onPress} variant="secondary">
        Open
      </AppButton>
    </Surface>
  );
}

function PlanRow({ item }: { item: DashboardTodayPlanItem }) {
  const colors = useThinkfyColors();

  return (
    <Surface>
      <View style={styles.listRow}>
        <IconBadge name={item.track === "speaking" ? "mic" : "target"} />
        <View style={styles.listCopy}>
          <AppText variant="bodyStrong">{getPlanTitle(item)}</AppText>
          <AppText color={colors.muted} variant="caption">
            {getPlanReason(item)}
          </AppText>
        </View>
        <Badge tone="neutral">{item.durationMinutes} min</Badge>
      </View>
    </Surface>
  );
}

function RecentActivityRow({ item }: { item: DashboardRecentItem }) {
  const colors = useThinkfyColors();
  const icon: SFSymbol = item.kind === "speaking" ? "mic" : "checkmark.circle";

  return (
    <Surface>
      <View style={styles.listRow}>
        <IconBadge name={icon} />
        <View style={styles.listCopy}>
          <AppText numberOfLines={1} variant="bodyStrong">
            {item.title}
          </AppText>
          <AppText color={colors.muted} numberOfLines={1} variant="caption">
            {item.scoreOutOf100 != null
              ? `Score ${item.scoreOutOf100} / ${item.statusLabel ?? item.subtitle}`
              : item.subtitle}
          </AppText>
        </View>
        {item.statusLabel ? <Badge tone="success">{item.statusLabel}</Badge> : null}
      </View>
    </Surface>
  );
}

const styles = StyleSheet.create({
  heroHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  heroMetric: {
    gap: spacing.xs,
  },
  copy: {
    gap: spacing.xs,
  },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
  },
  actionCard: {
    flexBasis: "47%",
    flexGrow: 1,
    minHeight: 160,
  },
  stack: {
    gap: spacing.md,
  },
  listRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
  },
  listCopy: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
  },
  loadingMetric: {
    borderRadius: 8,
    height: 64,
    width: 86,
  },
  loadingIcon: {
    borderRadius: 8,
    height: 52,
    width: 52,
  },
  loadingLineLarge: {
    borderRadius: 8,
    height: 26,
    width: "78%",
  },
  loadingLine: {
    borderRadius: 8,
    height: 18,
    width: "100%",
  },
  loadingLineShort: {
    borderRadius: 8,
    height: 18,
    width: "56%",
  },
});
