import type { DashboardHomeData } from "@thinkfy/shared/dashboard";

/** UI trust follows source completeness; a missing read is never a measured zero. */
export function getHomeDataState(data: DashboardHomeData) {
  const a = data.availability;
  return {
    profile: a.profile === "available",
    activity: a.stats !== "unavailable",
    activityPartial: a.stats === "partial",
    goals: a.profile === "available" && a.stats === "available",
    skills: a.scoredSessions === "available",
    history: a.recentSessions === "available" || data.recentActivity.length > 0,
    streak: a.profile === "available" && a.activityLog === "available",
    retryable: Object.entries(a).some(
      ([key, value]) => key !== "recommendation" && value !== "available",
    ),
  };
}

/**
 * Retain independently usable panels across an RSC refresh. These are last-known
 * values, not a successful new read: the caller keeps the incoming error notice.
 * Scoped to this mounted learner home; never persisted or shared between users.
 */
export function retainHomeData(
  previous: DashboardHomeData,
  incoming: DashboardHomeData,
) {
  const old = getHomeDataState(previous);
  const next = getHomeDataState(incoming);
  const data = {
    ...incoming,
    availability: { ...incoming.availability },
    topBar: { ...incoming.topBar },
  };
  let retained = false;
  if (!next.profile && old.profile) {
    data.profile = previous.profile;
    data.topBar.orbBalance = previous.topBar.orbBalance;
    data.topBar.level = previous.topBar.level;
    data.topBar.xpCurrent = previous.topBar.xpCurrent;
    data.topBar.xpGoal = previous.topBar.xpGoal;
    data.sidebarCards = previous.sidebarCards;
    data.availability.profile = "available";
    if (!old.streak) data.availability.activityLog = "unavailable";
    retained = true;
  }
  if (!next.goals && old.goals) {
    data.hero = previous.hero;
    // Both dependencies accompany the retained goal calculations.
    data.availability.profile = "available";
    data.availability.stats = "available";
    retained = true;
  }
  if (!next.activity && old.activity && !old.goals) {
    data.hero = { ...data.hero, weeklyStats: previous.hero.weeklyStats };
    data.availability.stats = previous.availability.stats;
    retained = true;
  }
  if (!next.skills && old.skills) {
    data.skillSnapshot = previous.skillSnapshot;
    data.availability.scoredSessions = "available";
    retained = true;
  }
  if (!next.history && old.history) {
    data.recentActivity = previous.recentActivity;
    data.availability.recentSessions = "available";
    retained = true;
  }
  if (!next.streak && old.streak) {
    data.topBar.currentStreak = previous.topBar.currentStreak;
    data.availability.activityLog = "available";
    retained = true;
  }
  if (
    incoming.availability.recommendation === "unavailable" &&
    previous.availability.recommendation === "personalized"
  ) {
    data.recommendedDrill = previous.recommendedDrill;
    data.todayPlanItems = previous.todayPlanItems;
    data.availability.recommendation = "personalized";
    retained = true;
  }
  return { data, retained };
}
