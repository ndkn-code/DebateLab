import type { useTranslations } from "next-intl";
import type {
  DashboardRecommendedDrill,
} from "@/lib/api/dashboard";

type Translator = ReturnType<typeof useTranslations>;

function getHour(now: Date, timezone?: string | null) {
  if (!timezone) return now.getHours();

  try {
    const hour = new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      hour12: false,
      timeZone: timezone,
    })
      .formatToParts(now)
      .find((part) => part.type === "hour")?.value;

    const parsed = hour == null ? Number.NaN : Number(hour);
    return Number.isFinite(parsed) ? parsed % 24 : now.getHours();
  } catch {
    return now.getHours();
  }
}

export function getTimeGreetingKey(now = new Date(), timezone?: string | null): string {
  const hour = getHour(now, timezone);
  if (hour < 12) return "greeting_morning";
  if (hour < 17) return "greeting_afternoon";
  return "greeting_evening";
}

export function getPlanTrackLabel(
  track: DashboardRecommendedDrill["track"],
  t: Translator
) {
  if (track === "speaking") return t("track_speaking");
  return t("track_debate");
}

export function getPlanTitle(item: DashboardRecommendedDrill, t: Translator) {
  switch (item.key) {
    case "continue-course":
      return t("plan_title_continue_course");
    case "weakest-skill":
      return item.skillKey
        ? t("plan_title_weakest_skill", {
            skill: t(`skill_labels.${item.skillKey}`),
          })
        : t("plan_title_weakest_skill_generic");
    case "underused-track":
      return item.track === "speaking"
        ? t("plan_title_underused_speaking")
        : t("plan_title_underused_debate");
    case "review-feedback":
      return t("plan_title_review_feedback");
    case "start-speaking":
      return t("plan_title_start_speaking");
    case "start-debate":
      return t("plan_title_start_debate");
    case "coach-check":
      return t("plan_title_coach");
    default:
      return t("next_move");
  }
}

export function getPlanReason(item: DashboardRecommendedDrill, t: Translator) {
  switch (item.key) {
    case "continue-course":
      return t("plan_reason_course");
    case "review-feedback":
      return t("plan_reason_feedback");
    case "weakest-skill":
      return t("plan_reason_skill");
    case "underused-track":
      return t("plan_reason_rebalance");
    case "start-speaking":
    case "start-debate":
      return t("plan_reason_start");
    case "coach-check":
      return t("plan_reason_coach");
    default:
      return t("plan_reason_start");
  }
}

export function getPlanDescription(
  item: DashboardRecommendedDrill,
  t: Translator
) {
  switch (item.key) {
    case "continue-course":
      return item.context ?? t("plan_context_course_fallback");
    case "weakest-skill":
      return item.skillKey
        ? t("recommended_desc_weakest", {
            skill: t(`skill_labels.${item.skillKey}`),
          })
        : t("recommended_desc_weakest_generic");
    case "review-feedback":
      return item.context ?? t("plan_context_feedback_fallback");
    case "underused-track":
      return item.track === "speaking"
        ? t("recommended_desc_underused_speaking")
        : t("recommended_desc_underused_debate");
    case "start-speaking":
      return t("recommended_desc_start_speaking");
    case "start-debate":
      return t("recommended_desc_start_debate");
    case "coach-check":
      return t("recommended_desc_coach");
    default:
      return "";
  }
}

export function getPlanCtaLabel(
  item: DashboardRecommendedDrill,
  t: Translator
) {
  switch (item.ctaKey) {
    case "continue":
      return t("plan_cta_continue");
    case "review":
      return t("plan_cta_review");
    case "ask-coach":
      return t("plan_cta_ask_coach");
    case "start":
    default:
      return t("plan_cta_start");
  }
}
