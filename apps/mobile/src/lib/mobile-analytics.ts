import type { createThinkfyApiClient } from "@thinkfy/shared/api-client";

type ThinkfyApiClient = ReturnType<typeof createThinkfyApiClient>;

export type MobileDashboardEventName =
  | "mobile_dashboard_viewed"
  | "mobile_dashboard_quick_action_tapped"
  | "mobile_dashboard_recommended_drill_tapped";

export type MobilePracticeEventName =
  | "mobile_practice_setup_viewed"
  | "mobile_practice_started"
  | "mobile_practice_mic_permission_result"
  | "mobile_practice_recording_paused"
  | "mobile_practice_recording_completed"
  | "mobile_practice_audio_upload_started"
  | "mobile_practice_audio_upload_completed"
  | "mobile_practice_audio_upload_failed"
  | "mobile_practice_transcription_started"
  | "mobile_practice_transcription_completed"
  | "mobile_practice_transcription_failed"
  | "mobile_practice_feedback_requested"
  | "mobile_practice_analysis_queued"
  | "mobile_practice_analysis_completed"
  | "mobile_practice_analysis_failed"
  | "mobile_practice_feedback_viewed";

export type MobileHistoryEventName =
  | "mobile_history_viewed"
  | "mobile_history_detail_viewed";

export type MobileCoachEventName =
  | "mobile_coach_viewed"
  | "mobile_coach_conversation_opened"
  | "mobile_coach_message_sent"
  | "mobile_coach_response_received"
  | "mobile_coach_response_failed"
  | "mobile_coach_suggested_action_tapped";

function trackMobileEvent(
  apiClient: ThinkfyApiClient | null,
  eventName:
    | MobileDashboardEventName
    | MobilePracticeEventName
    | MobileHistoryEventName
    | MobileCoachEventName,
  featureArea: "practice" | "profile",
  route: string,
  metadata: Record<string, unknown> = {}
) {
  if (!apiClient) return;

  void apiClient
    .requestJson("/api/analytics/events", {
      method: "POST",
      body: JSON.stringify({
        eventName,
        featureArea,
        route,
        metadata: {
          surface: "mobile",
          ...metadata,
        },
      }),
    })
    .catch(() => null);
}

export function trackMobileDashboardEvent(
  apiClient: ThinkfyApiClient | null,
  eventName: MobileDashboardEventName,
  metadata: Record<string, unknown> = {}
) {
  trackMobileEvent(apiClient, eventName, "profile", "/today", metadata);
}

export function trackMobilePracticeEvent(
  apiClient: ThinkfyApiClient | null,
  eventName: MobilePracticeEventName,
  route: string,
  metadata: Record<string, unknown> = {}
) {
  trackMobileEvent(apiClient, eventName, "practice", route, metadata);
}

export function trackMobileHistoryEvent(
  apiClient: ThinkfyApiClient | null,
  eventName: MobileHistoryEventName,
  route: string,
  metadata: Record<string, unknown> = {}
) {
  trackMobileEvent(apiClient, eventName, "practice", route, metadata);
}

export function trackMobileCoachEvent(
  apiClient: ThinkfyApiClient | null,
  eventName: MobileCoachEventName,
  metadata: Record<string, unknown> = {}
) {
  trackMobileEvent(apiClient, eventName, "practice", "/coach", metadata);
}
