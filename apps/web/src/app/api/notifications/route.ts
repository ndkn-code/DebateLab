import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { createTypedServerClient } from "@/lib/supabase/server";
import {
  notificationPreferenceSchema,
  notificationUserSettingsSchema,
} from "@/lib/notifications/contracts";

export const dynamic = "force-dynamic";

const patchSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("mark_read"), itemId: z.string().uuid() }),
  z.object({ action: z.literal("mark_all_read") }),
  z.object({
    action: z.literal("settings"),
    settings: notificationUserSettingsSchema.omit({
      userId: true,
      updatedAt: true,
    }),
  }),
  z.object({
    action: z.literal("preference"),
    preference: notificationPreferenceSchema.omit({
      id: true,
      userId: true,
      updatedAt: true,
    }),
  }),
  z.object({
    action: z.literal("mute"),
    eventType: z.string().trim().min(1).max(120),
    channel: z.enum(["in_app", "email", "push"]).default("email"),
  }),
  z.object({
    action: z.literal("mute_object"),
    subjectType: z.string().trim().min(1).max(120),
    subjectId: z.string().trim().min(1).max(500),
    channel: z.enum(["all", "in_app", "email", "push"]).default("all"),
    mutedUntil: z.string().datetime({ offset: true }).nullable().optional(),
  }),
]);

async function authenticatedClient() {
  const typed = await createTypedServerClient();
  const {
    data: { user },
    error,
  } = await typed.auth.getUser();
  if (error || !user) return null;
  return { user, db: typed as unknown as SupabaseClient };
}

export async function GET(request: NextRequest) {
  const auth = await authenticatedClient();
  if (!auth)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const limit = Math.max(
    1,
    Math.min(Number(request.nextUrl.searchParams.get("limit") || 30), 100),
  );
  const cursor = request.nextUrl.searchParams.get("cursor");
  let inboxQuery = auth.db
    .from("notification_inbox_items")
    .select(
      "id,event_id,state,read_at,archived_at,created_at,notification_events(id,event_type,title,body,importance,source,subject_type,subject_id,payload,created_at)",
    )
    .eq("recipient_id", auth.user.id)
    .neq("state", "archived")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (cursor) inboxQuery = inboxQuery.lt("created_at", cursor);
  const [inbox, unread, settings, preferences, mutes] = await Promise.all([
    inboxQuery,
    auth.db
      .from("notification_inbox_items")
      .select("id", { count: "exact", head: true })
      .eq("recipient_id", auth.user.id)
      .eq("state", "unread"),
    auth.db
      .from("notification_user_settings")
      .select("*")
      .eq("user_id", auth.user.id)
      .maybeSingle(),
    auth.db
      .from("notification_preferences")
      .select("*")
      .eq("user_id", auth.user.id)
      .order("event_type"),
    auth.db
      .from("notification_mutes")
      .select("*")
      .eq("user_id", auth.user.id)
      .order("updated_at", { ascending: false }),
  ]);
  const error =
    inbox.error ||
    unread.error ||
    settings.error ||
    preferences.error ||
    mutes.error;
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  const items = inbox.data ?? [];
  return NextResponse.json({
    items,
    unreadCount: unread.count ?? 0,
    nextCursor:
      items.length === limit
        ? (items[items.length - 1]?.created_at ?? null)
        : null,
    settings: settings.data ?? {
      user_id: auth.user.id,
      in_app_enabled: true,
      email_enabled: false,
      push_enabled: false,
      digest_frequency: "none",
      timezone: "Asia/Ho_Chi_Minh",
      quiet_hours_start: null,
      quiet_hours_end: null,
    },
    preferences: preferences.data ?? [],
    mutes: mutes.data ?? [],
  });
}

export async function PATCH(request: NextRequest) {
  const auth = await authenticatedClient();
  if (!auth)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const input = patchSchema.parse(await request.json());
    if (input.action === "mark_read") {
      const { error } = await auth.db
        .from("notification_inbox_items")
        .update({ state: "read", read_at: new Date().toISOString() })
        .eq("id", input.itemId)
        .eq("recipient_id", auth.user.id);
      if (error) throw error;
    } else if (input.action === "mark_all_read") {
      const { error } = await auth.db
        .from("notification_inbox_items")
        .update({ state: "read", read_at: new Date().toISOString() })
        .eq("recipient_id", auth.user.id)
        .eq("state", "unread");
      if (error) throw error;
    } else if (input.action === "settings") {
      const { error } = await auth.db.from("notification_user_settings").upsert(
        {
          user_id: auth.user.id,
          in_app_enabled: input.settings.inAppEnabled,
          email_enabled: input.settings.emailEnabled,
          push_enabled: input.settings.pushEnabled,
          digest_frequency: input.settings.digestFrequency,
          timezone: input.settings.timezone,
          quiet_hours_start: input.settings.quietHoursStart ?? null,
          quiet_hours_end: input.settings.quietHoursEnd ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );
      if (error) throw error;
      const { data: profile, error: profileError } = await auth.db
        .from("profiles")
        .select("preferences")
        .eq("id", auth.user.id)
        .single();
      if (profileError) throw profileError;
      const preferences =
        profile?.preferences &&
        typeof profile.preferences === "object" &&
        !Array.isArray(profile.preferences)
          ? profile.preferences
          : {};
      const { error: legacyError } = await auth.db
        .from("profiles")
        .update({
          preferences: {
            ...preferences,
            email_notifications: input.settings.emailEnabled,
          },
        })
        .eq("id", auth.user.id);
      if (legacyError) throw legacyError;
    } else if (input.action === "mute_object") {
      const { error } = await auth.db.from("notification_mutes").upsert(
        {
          user_id: auth.user.id,
          subject_type: input.subjectType,
          subject_id: input.subjectId,
          channel: input.channel,
          muted_until: input.mutedUntil ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,subject_type,subject_id,channel" },
      );
      if (error) throw error;
    } else {
      const preference =
        input.action === "mute"
          ? {
              eventType: input.eventType,
              channel: input.channel,
              enabled: false,
              frequency: "immediate" as const,
            }
          : input.preference;
      const { error } = await auth.db.from("notification_preferences").upsert(
        {
          user_id: auth.user.id,
          event_type: preference.eventType,
          channel: preference.channel,
          enabled: preference.enabled,
          frequency: preference.frequency,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,event_type,channel" },
      );
      if (error) throw error;
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to update notifications.",
      },
      { status: 400 },
    );
  }
}
