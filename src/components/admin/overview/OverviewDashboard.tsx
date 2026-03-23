"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Users, Wifi, BookOpen, GraduationCap } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { AnalyticsOverview } from "@/lib/types/admin";
import { StatCard } from "./StatCard";
import { TrendChart } from "./TrendChart";
import { PopularCoursesList } from "./PopularCoursesList";
import { ApiUsageChart } from "./ApiUsageChart";
import { GlobalMap } from "./GlobalMap";
import posthog from "posthog-js";

interface Props {
  initialData: AnalyticsOverview;
}

export function OverviewDashboard({ initialData }: Props) {
  const t = useTranslations("admin.overview");
  const [data, setData] = useState(initialData);
  const [dateRange, setDateRange] = useState<"7d" | "30d" | "90d">("30d");
  const supabase = createClient();

  const refreshOnline = useCallback(async () => {
    const cutoff = new Date(Date.now() - 2 * 60000).toISOString();
    const { count } = await supabase
      .from("user_sessions")
      .select("*", { count: "exact", head: true })
      .eq("is_active", true)
      .gte("last_seen_at", cutoff);
    setData((prev) => ({ ...prev, online_users: count ?? prev.online_users }));
  }, [supabase]);

  useEffect(() => {
    posthog.capture("admin_overview_viewed", { date_range: dateRange });
  }, [dateRange]);

  // Realtime subscription for online users
  useEffect(() => {
    const channel = supabase
      .channel("admin-sessions")
      .on("postgres_changes", { event: "*", schema: "public", table: "user_sessions" }, () => {
        refreshOnline();
      })
      .subscribe();

    // Auto-refresh every 30s
    const interval = setInterval(refreshOnline, 30_000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [supabase, refreshOnline]);

  const handleDateRange = (range: "7d" | "30d" | "90d") => {
    posthog.capture("admin_overview_date_range_changed", { from: dateRange, to: range });
    setDateRange(range);
  };

  const daysMap = { "7d": 7, "30d": 30, "90d": 90 };
  const days = daysMap[dateRange];
  const filteredGrowth = data.user_growth.slice(-days);
  const filteredSessions = data.session_trend.slice(-days);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-on-surface">{t("title")}</h1>
        <div className="flex gap-1">
          {(["7d", "30d", "90d"] as const).map((r) => (
            <button
              key={r}
              onClick={() => handleDateRange(r)}
              className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${
                dateRange === r
                  ? "bg-primary text-on-primary"
                  : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high"
              }`}
            >
              {t(r === "7d" ? "last7Days" : r === "30d" ? "last30Days" : "last90Days")}
            </button>
          ))}
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title={t("totalUsers")} value={data.total_users} growth={data.user_growth_pct} icon={<Users className="h-5 w-5" />} />
        <StatCard title={t("onlineNow")} value={data.online_users} icon={<Wifi className="h-5 w-5" />} />
        <StatCard title={t("totalCourses")} value={data.total_courses} icon={<BookOpen className="h-5 w-5" />} />
        <StatCard title={t("totalEnrollments")} value={data.total_enrollments} icon={<GraduationCap className="h-5 w-5" />} />
      </div>

      {/* Global Map */}
      <GlobalMap geoData={data.geo_distribution} />

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <TrendChart title={t("userGrowth")} data={filteredGrowth} color="#2f4fdd" />
        <TrendChart title={t("sessionTrend")} data={filteredSessions} color="#7c3aed" />
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <PopularCoursesList courses={data.popular_courses} />
        <ApiUsageChart data={data.api_usage} />
      </div>
    </div>
  );
}
