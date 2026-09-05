"use client";

import { createTypedBrowserClient } from "@/lib/supabase/client";
import {
  sendCenterTeacherMessage,
  decideCenterTeacherProposal,
} from "@/app/actions/admin-clubs";
import type {
  CenterResult,
  TeacherHistory,
  TeacherRun,
  TeacherConversationSummary,
  TeacherTurn,
  CommandReceipt,
} from "@/lib/center-operations/contracts";

export type TeacherAssistantApi = {
  list(clubId: string): Promise<CenterResult<TeacherConversationSummary[]>>;
  history(
    clubId: string,
    conversationId: string,
  ): Promise<CenterResult<TeacherHistory>>;
  run(
    clubId: string,
    requestKey: string,
  ): Promise<CenterResult<TeacherRun | null>>;
  stop(clubId: string, requestKey: string): Promise<CenterResult<null>>;
  send(
    clubId: string,
    message: string,
    conversationId: string | undefined,
    requestKey: string,
    locale: "en" | "vi",
  ): Promise<CenterResult<TeacherTurn>>;
  decide(
    clubId: string,
    proposalId: string,
    decision: "confirm" | "cancel",
  ): Promise<CenterResult<CommandReceipt | null>>;
};

// These authenticated RPCs bypass Next's client action queue so Stop and progress
// remain available during generation. Each RPC rechecks actor/center ownership.
async function rpc<T>(
  name: string,
  args: Record<string, unknown>,
): Promise<CenterResult<T>> {
  try {
    const client = createTypedBrowserClient() as unknown as {
      rpc(
        name: string,
        args: Record<string, unknown>,
      ): Promise<{ data: unknown; error: { message: string } | null }>;
    };
    const { data, error } = await client.rpc(name, args);
    return error
      ? { ok: false, error: error.message }
      : { ok: true, data: data as T };
  } catch {
    return { ok: false, error: "connection" };
  }
}
export const teacherAssistantApi: TeacherAssistantApi = {
  list: (clubId) => rpc("center_teacher_conversations", { p_club_id: clubId }),
  history: (clubId, conversationId) =>
    rpc("center_chat_history", {
      p_club_id: clubId,
      p_conversation_id: conversationId,
    }),
  run: (clubId, requestKey) =>
    rpc("center_teacher_run", { p_club_id: clubId, p_request_key: requestKey }),
  stop: (clubId, requestKey) =>
    rpc("center_teacher_stop", {
      p_club_id: clubId,
      p_request_key: requestKey,
    }),
  send: sendCenterTeacherMessage,
  decide: decideCenterTeacherProposal,
};
