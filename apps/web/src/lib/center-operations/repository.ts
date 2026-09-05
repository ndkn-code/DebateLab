import "server-only";

import { createTypedServerClient } from "@/lib/supabase/server";
import { generateStructured } from "@/lib/ai/core";
import {
  centerCommandSchema,
  type CenterSnapshot,
  type CommandReceipt,
  type TeacherProposal,
  type TeacherTurn,
} from "./contracts";
import {
  planTeacherTurn,
  teacherActionSchema,
  teacherPlanSchema,
  type TeacherContext,
} from "./teacher-agent";

type RpcResponse = { data: unknown; error: { message: string } | null };
type RpcClient = {
  rpc(name: string, args: Record<string, unknown>): Promise<RpcResponse>;
};
const rpcClient = (
  client: Awaited<ReturnType<typeof createTypedServerClient>>,
) => client as unknown as RpcClient;

function assertEnabled() {
  if (process.env.CENTER_OPERATIONS_V1 !== "true")
    throw new Error("Center operations are unavailable.");
}

async function callRpc(
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const result = await rpcClient(await createTypedServerClient()).rpc(
    name,
    args,
  );
  if (result.error) throw new Error(`${name}: ${result.error.message}`);
  return result.data;
}

export async function loadCenterSnapshot(
  clubId: string,
): Promise<CenterSnapshot> {
  assertEnabled();
  const data = await callRpc("center_snapshot", { p_club_id: clubId });
  if (!data || typeof data !== "object")
    throw new Error("center_snapshot returned no snapshot.");
  return data as CenterSnapshot;
}

export async function executeCenterCommand(
  clubId: string,
  commandInput: unknown,
  key: string,
): Promise<CommandReceipt> {
  assertEnabled();
  const parsed = centerCommandSchema.safeParse(commandInput);
  if (!parsed.success) throw new Error("Invalid center command.");
  const { kind, ...input } = parsed.data;
  const data = await callRpc("center_execute_command", {
    p_club_id: clubId,
    p_kind: kind,
    p_input: input,
    p_idempotency_key: key,
  });
  if (!data || typeof data !== "object")
    throw new Error("center_execute_command returned no receipt.");
  return data as CommandReceipt;
}

function commandInput(
  action: Record<string, unknown>,
  snapshot: CenterSnapshot,
): Record<string, unknown> {
  const { kind, ...input } = action;
  if (kind === "trial.evaluate") {
    const row = snapshot.trials.find((item) => item.id === input.trialId);
    if (row) input.expectedRevision = row.revision;
  } else if (kind === "admission.stage") {
    const row = snapshot.admissions.find(
      (item) => item.id === input.admissionId,
    );
    if (row) input.expectedRevision = row.revision;
  } else if (kind === "trial.rebook") {
    const row = snapshot.trials.find((item) => item.id === input.priorTrialId);
    if (!row) throw new Error("Cannot rebook a trial outside the snapshot.");
    if (row.status !== "no_show")
      throw new Error("Only no-show trials can be rebooked.");
    if (snapshot.trials.some((item) => item.rebook_of === row.id))
      throw new Error("This no-show trial already has a replacement.");
    if (
      !snapshot.students.some(
        (student) => student.id === row.student_record_id,
      ) ||
      !snapshot.classes.some((item) => item.id === row.class_id)
    )
      throw new Error("The trial identity is missing from the snapshot.");
    input.expectedRevision = row.revision;
  }
  return input;
}

export function normalizeTeacherActions(
  actions: readonly Record<string, unknown>[],
  snapshot: CenterSnapshot,
) {
  return actions.map((action) => {
    const teacherAction = teacherActionSchema.safeParse(action);
    if (!teacherAction.success) throw new Error("Invalid teacher command.");
    const candidate = teacherAction.data;
    const withRevision =
      candidate.kind === "trial.evaluate"
        ? {
            ...candidate,
            expectedRevision: snapshot.trials.find(
              (item) => item.id === candidate.trialId,
            )?.revision,
          }
        : candidate.kind === "admission.stage"
          ? {
              ...candidate,
              expectedRevision: snapshot.admissions.find(
                (item) => item.id === candidate.admissionId,
              )?.revision,
            }
          : candidate.kind === "schedule.reschedule"
            ? {
                ...candidate,
                expectedUpdatedAt: snapshot.schedules.find(
                  (item) => item.id === candidate.scheduleId,
                )?.updated_at,
              }
            : candidate.kind === "trial.rebook"
              ? (() => {
                  const row = snapshot.trials.find(
                    (item) => item.id === candidate.priorTrialId,
                  );
                  if (!row)
                    throw new Error(
                      "Cannot rebook a trial outside the snapshot.",
                    );
                  if (row.status !== "no_show")
                    throw new Error("Only no-show trials can be rebooked.");
                  if (snapshot.trials.some((item) => item.rebook_of === row.id))
                    throw new Error(
                      "This no-show trial already has a replacement.",
                    );
                  if (
                    !snapshot.students.some(
                      (student) => student.id === row.student_record_id,
                    ) ||
                    !snapshot.classes.some((item) => item.id === row.class_id)
                  )
                    throw new Error(
                      "The trial identity is missing from the snapshot.",
                    );
                  return { ...candidate, expectedRevision: row.revision };
                })()
              : candidate;
    const parsed = centerCommandSchema.safeParse(withRevision);
    if (!parsed.success) throw new Error("Invalid teacher command.");
    const automatic =
      parsed.data.kind === "note.create" ||
      parsed.data.kind === "trial.evaluate" ||
      parsed.data.kind === "draft.create";
    return {
      kind: parsed.data.kind,
      input: commandInput(parsed.data, snapshot),
      requiresConfirmation: !automatic,
    };
  });
}

function proposalsFrom(value: unknown): TeacherProposal[] {
  if (!Array.isArray(value)) return [];
  return value as TeacherProposal[];
}

export async function sendTeacherTurn(
  clubId: string,
  message: string,
  conversationId?: string,
  requestKey = crypto.randomUUID(),
): Promise<TeacherTurn> {
  assertEnabled();
  const snapshot = await loadCenterSnapshot(clubId);
  const opened = await callRpc("center_chat_open", {
    p_club_id: clubId,
    p_conversation_id: conversationId ?? null,
    p_message: message,
    p_request_key: requestKey,
  });
  if (!opened || typeof opened !== "object")
    throw new Error("center_chat_open returned no conversation.");
  const open = opened as {
    conversationId: string;
    recentMessages?: Array<{ role: string; content: string }>;
    completedTurn?: TeacherTurn | null;
  };
  if (open.completedTurn)
    return executeAutomaticProposals(clubId, open.completedTurn);
  const materialSources = (await callRpc("center_teacher_materials", {
    p_club_id: clubId,
    p_query: message,
  })) as { id: string; label: string; text: string }[];
  const context: TeacherContext = {
    organizationId: snapshot.organizationId,
    classes: snapshot.classes,
    students: snapshot.students.map((student) => ({
      id: student.id,
      name: student.name,
      classIds: student.classIds,
    })),
    trials: snapshot.trials.map((trial) => ({
      id: trial.id,
      studentRecordId: trial.student_record_id,
      classId: trial.class_id,
      startsAt: trial.starts_at,
      endsAt: trial.ends_at,
      status: trial.status,
      rebookOf: trial.rebook_of,
    })),
    admissions: snapshot.admissions,
    schedules: snapshot.schedules ?? [],
    sources: [
      ...materialSources,
      ...snapshot.trials.flatMap((trial) =>
        trial.assessment
          ? [
              {
                id: `trial:${trial.id}`,
                label: `Trial ${trial.id}`,
                text: JSON.stringify(trial.assessment),
              },
            ]
          : [],
      ),
      ...snapshot.notes.map((note) => ({
        id: `note:${note.id}`,
        label: `Note ${note.id}`,
        text: note.body,
      })),
      ...snapshot.drafts.map((draft) => ({
        id: `draft:${draft.id}`,
        label: `Draft ${draft.id}`,
        text: `${draft.title}: ${draft.body}`,
      })),
    ],
    timezone: snapshot.trials[0]?.timezone ?? "Asia/Ho_Chi_Minh",
    currentTime: new Date().toISOString(),
    recentMessages: open.recentMessages,
  };
  context.students = context.students.slice(0, 200);
  context.sources = context.sources
    .slice(0, 40)
    .map((source) => ({ ...source, text: source.text.slice(0, 3000) }));
  const planned = await planTeacherTurn({
    message,
    context,
    generate: async ({ system, prompt }) => {
      const generated = await generateStructured({
        task: "teacher_operations",
        messages: [
          { role: "system", content: system },
          { role: "user", content: prompt },
        ],
        context: {
          task: "teacher_operations",
          userId: snapshot.actorId,
          idempotencyKey: requestKey,
          sourceRoute: "dashboard/teacher/center",
          outputType: "teacher_plan",
        },
        prompt,
        schema: teacherPlanSchema,
        repairInstruction:
          "Return exactly the teacher plan JSON shape, including source citations as {id,label} objects.",
      });
      return JSON.stringify(generated.output);
    },
  });
  if (!planned.ok) throw new Error(planned.error);
  const normalized = normalizeTeacherActions(
    planned.plan.actions as unknown as Record<string, unknown>[],
    snapshot,
  );
  const completed = await callRpc("center_chat_complete", {
    p_club_id: clubId,
    p_conversation_id: open.conversationId,
    p_answer: planned.plan.answer,
    p_sources: planned.plan.sources.map((source) => {
      const canonical = context.sources.find((item) => item.id === source.id)!;
      return {
        id: canonical.id,
        label: canonical.label,
        text: canonical.text.slice(0, 1500),
      };
    }),
    p_actions: normalized,
    p_request_key: requestKey,
  });
  if (!completed || typeof completed !== "object")
    throw new Error("center_chat_complete returned no turn.");
  const result = completed as TeacherTurn;
  return executeAutomaticProposals(clubId, {
    ...result,
    proposals: proposalsFrom(result.proposals),
  });
}

async function executeAutomaticProposals(
  clubId: string,
  turn: TeacherTurn,
): Promise<TeacherTurn> {
  const proposals = [...turn.proposals];
  for (let i = 0; i < proposals.length; i++) {
    const proposal = proposals[i];
    if (proposal.requires_confirmation || proposal.status !== "pending")
      continue;
    try {
      const receipt = (await callRpc("center_decide_proposal", {
        p_club_id: clubId,
        p_proposal_id: proposal.id,
        p_decision: "automatic",
      })) as CommandReceipt;
      proposals[i] = { ...proposal, status: "executed", receipt };
    } catch {
      proposals[i] = { ...proposal, status: "failed" };
    }
  }
  return { ...turn, proposals };
}

export async function decideTeacherProposal(
  clubId: string,
  proposalId: string,
  decision: "confirm" | "cancel",
): Promise<CommandReceipt | null> {
  assertEnabled();
  return (await callRpc("center_decide_proposal", {
    p_club_id: clubId,
    p_proposal_id: proposalId,
    p_decision: decision,
  })) as CommandReceipt | null;
}
