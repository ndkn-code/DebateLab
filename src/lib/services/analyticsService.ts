import type { SupabaseClient } from "@supabase/supabase-js";
import type { AnalyticsOverview } from "@/lib/types/admin";

export async function getTotalUsers(supabase: SupabaseClient) {
  const { count, error } = await supabase.from("profiles").select("*", { count: "exact", head: true });
  if (error) console.error("getTotalUsers error:", error.message);

  const now = new Date();
  const d7 = new Date(now.getTime() - 7 * 86400000).toISOString();
  const d14 = new Date(now.getTime() - 14 * 86400000).toISOString();

  const { count: recent } = await supabase
    .from("profiles").select("*", { count: "exact", head: true })
    .gte("created_at", d7);
  const { count: previous } = await supabase
    .from("profiles").select("*", { count: "exact", head: true })
    .gte("created_at", d14).lt("created_at", d7);

  const recentN = recent ?? 0;
  const previousN = previous ?? 0;

  let growthPct = 0;
  if (previousN > 0) {
    growthPct = ((recentN - previousN) / previousN) * 100;
  } else if (recentN > 0) {
    growthPct = 100;
  }
  // No users in either period = 0% growth (not -100%)

  return { count: count ?? 0, growth: Math.round(growthPct * 10) / 10 };
}

export async function getOnlineUsers(supabase: SupabaseClient) {
  const cutoff = new Date(Date.now() - 2 * 60000).toISOString();
  const { count, error } = await supabase
    .from("user_sessions")
    .select("*", { count: "exact", head: true })
    .eq("is_active", true)
    .gte("last_seen_at", cutoff);
  if (error) console.error("getOnlineUsers error:", error.message);
  return count ?? 0;
}

export async function getGeoDistribution(supabase: SupabaseClient) {
  const d30 = new Date(Date.now() - 30 * 86400000).toISOString();
  const { data } = await supabase
    .from("user_sessions")
    .select("geo_country, geo_city, geo_lat, geo_lon")
    .gte("session_start", d30)
    .not("geo_country", "is", null);

  if (!data) return [];

  const map = new Map<string, { country: string; city?: string; lat: number; lon: number; count: number }>();
  for (const row of data) {
    const key = row.geo_country ?? "Unknown";
    const existing = map.get(key);
    if (existing) {
      existing.count++;
    } else {
      map.set(key, {
        country: key,
        city: row.geo_city ?? undefined,
        lat: Number(row.geo_lat) || 0,
        lon: Number(row.geo_lon) || 0,
        count: 1,
      });
    }
  }
  return Array.from(map.values());
}

export async function getUserGrowthTrend(supabase: SupabaseClient, days: number = 30) {
  const start = new Date(Date.now() - days * 86400000).toISOString();
  const { data } = await supabase
    .from("profiles")
    .select("created_at")
    .gte("created_at", start)
    .order("created_at", { ascending: true });

  if (!data) return [];

  const { count: totalBefore } = await supabase
    .from("profiles").select("*", { count: "exact", head: true })
    .lt("created_at", start);

  let cumulative = totalBefore ?? 0;
  const byDay = new Map<string, number>();

  for (const row of data) {
    const day = row.created_at.slice(0, 10);
    byDay.set(day, (byDay.get(day) ?? 0) + 1);
  }

  const result: { date: string; count: number }[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(Date.now() - (days - 1 - i) * 86400000);
    const key = d.toISOString().slice(0, 10);
    cumulative += byDay.get(key) ?? 0;
    result.push({ date: key, count: cumulative });
  }
  return result;
}

export async function getSessionTrend(supabase: SupabaseClient, days: number = 30) {
  const start = new Date(Date.now() - days * 86400000).toISOString();
  const { data } = await supabase
    .from("user_sessions")
    .select("session_start")
    .gte("session_start", start)
    .order("session_start", { ascending: true });

  if (!data) return [];

  const byDay = new Map<string, number>();
  for (const row of data) {
    const day = row.session_start.slice(0, 10);
    byDay.set(day, (byDay.get(day) ?? 0) + 1);
  }

  const result: { date: string; count: number }[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(Date.now() - (days - 1 - i) * 86400000);
    const key = d.toISOString().slice(0, 10);
    result.push({ date: key, count: byDay.get(key) ?? 0 });
  }
  return result;
}

export async function getPopularCourses(supabase: SupabaseClient, limit: number = 5) {
  // Simple approach: get courses, then count enrollments separately
  const { data: courses } = await supabase
    .from("courses")
    .select("id, title")
    .eq("is_published", true)
    .eq("is_archived", false)
    .limit(limit);

  if (!courses || courses.length === 0) return [];

  const result: { course_id: string; title: string; enrollment_count: number }[] = [];
  for (const c of courses) {
    const { count } = await supabase
      .from("enrollments")
      .select("*", { count: "exact", head: true })
      .eq("course_id", c.id);
    result.push({ course_id: c.id, title: c.title, enrollment_count: count ?? 0 });
  }

  return result.sort((a, b) => b.enrollment_count - a.enrollment_count);
}

export async function getApiUsageSummary(supabase: SupabaseClient, days: number = 7) {
  const start = new Date(Date.now() - days * 86400000).toISOString();
  const { data } = await supabase
    .from("api_usage")
    .select("service, estimated_cost_usd")
    .gte("created_at", start);

  if (!data) return [];

  const map = new Map<string, { service: string; total_calls: number; total_cost: number }>();
  for (const row of data) {
    const s = row.service;
    const existing = map.get(s);
    if (existing) {
      existing.total_calls++;
      existing.total_cost += Number(row.estimated_cost_usd) || 0;
    } else {
      map.set(s, { service: s, total_calls: 1, total_cost: Number(row.estimated_cost_usd) || 0 });
    }
  }
  return Array.from(map.values());
}

export async function getOverviewData(supabase: SupabaseClient, _userId: string, days: number = 30): Promise<AnalyticsOverview> {
  const [
    users,
    onlineUsers,
    geoDistribution,
    userGrowth,
    sessionTrend,
    popularCourses,
    apiUsage,
  ] = await Promise.all([
    getTotalUsers(supabase),
    getOnlineUsers(supabase),
    getGeoDistribution(supabase),
    getUserGrowthTrend(supabase, days),
    getSessionTrend(supabase, days),
    getPopularCourses(supabase),
    getApiUsageSummary(supabase),
  ]);

  // Count courses and enrollments separately to avoid RLS issues with joins
  const { count: totalCourses } = await supabase
    .from("courses").select("*", { count: "exact", head: true }).eq("is_archived", false);
  const { count: totalEnrollments } = await supabase
    .from("enrollments").select("*", { count: "exact", head: true });

  return {
    total_users: users.count,
    user_growth_pct: users.growth,
    online_users: onlineUsers,
    total_courses: totalCourses ?? 0,
    total_enrollments: totalEnrollments ?? 0,
    user_growth: userGrowth,
    session_trend: sessionTrend,
    geo_distribution: geoDistribution,
    popular_courses: popularCourses,
    api_usage: apiUsage,
  };
}
