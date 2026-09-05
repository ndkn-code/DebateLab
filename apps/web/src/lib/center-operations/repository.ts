import "server-only";

import { createTypedServerClient } from "@/lib/supabase/server";
import { generateStructured } from "@/lib/ai/core";
import {
  centerCommandSchema,
  type CenterSnapshot,
  type CommandReceipt,
  type TeacherProposal,
  type TeacherTurn,
  type TeacherRun,
  type TeacherConversationSummary,
} from "./contracts";
import {
  planTeacherTurn,
  teacherActionSchema,
  teacherPlanSchema,
  type TeacherContext,
} from "./teacher-agent";
import { runTeacherWorkspace, type TeacherRunStage } from "./teacher-workspace";

type RpcResponse = { data: unknown; error: { message: string } | null };
type RpcClient = {
  rpc(name: string, args: Record<string, unknown>): Promise<RpcResponse>;
};
const rpcClient = (
  client: Awaited<ReturnType<typeof createTypedServerClient>>,
) => client as unknown as RpcClient;

function normalizeTeacherRun(value: unknown): TeacherRun | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  return {
    requestKey: String(row.requestKey ?? row.request_key ?? ""),
    conversationId: String(row.conversationId ?? row.conversation_id ?? ""),
    status: row.status as TeacherRun["status"],
    stage: String(row.stage ?? "loading_context"),
    startedAt: String(row.startedAt ?? row.started_at ?? ""),
    updatedAt: String(row.updatedAt ?? row.updated_at ?? ""),
    errorCode: (row.errorCode ?? row.error_code ?? null) as string | null,
  };
}

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
  const client = await createTypedServerClient();
  const { data: organization } = await client
    .from("clubs")
    .select("name")
    .eq("id", clubId)
    .maybeSingle();
  return { ...(data as CenterSnapshot), organizationName: organization?.name };
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
  locale: "en" | "vi" = "en",
): Promise<TeacherTurn> {
  assertEnabled();
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
  if (open.completedTurn) return open.completedTurn;
  const startedRaw = (await callRpc("center_teacher_run_start", {
    p_club_id: clubId,
    p_conversation_id: open.conversationId,
    p_request_key: requestKey,
    p_message: message,
  })) as { run: unknown; leaseToken: string; completed?: boolean };
  const started = { ...startedRaw, run: normalizeTeacherRun(startedRaw.run)! };
  if (started.run.status === "stopped") throw new Error("TEACHER_RUN_STOPPED");
  if (started.completed)
    throw new Error("Teacher run completed without a saved turn.");

  return runTeacherWorkspace({
    driver: {
      start: async () => started,
      stage: async (stage: TeacherRunStage, leaseToken: string) => {
        await callRpc("center_teacher_run_stage", {
          p_club_id: clubId,
          p_request_key: requestKey,
          p_lease_token: leaseToken,
          p_stage: stage,
        });
      },
      active: async (leaseToken: string) =>
        Boolean(
          await callRpc("center_teacher_run_active", {
            p_club_id: clubId,
            p_request_key: requestKey,
            p_lease_token: leaseToken,
          }),
        ),
      complete: async (status, leaseToken, errorCode) => {
        await callRpc("center_teacher_run_finish", {
          p_club_id: clubId,
          p_request_key: requestKey,
          p_lease_token: leaseToken,
          p_status: status,
          p_error_code: errorCode ?? null,
        });
      },
    },
    work: async (checkpoint) => {
      await checkpoint("loading_context");
      const snapshot = await loadCenterSnapshot(clubId);
      await checkpoint("reading_materials");
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
          {
            id: "center:classes",
            label: locale === "vi" ? "Lớp phụ trách" : "Assigned classes",
            text: snapshot.classes.map((cls) => cls.name).join(", "),
          },
          {
            id: "center:schedule",
            label: locale === "vi" ? "Lịch lớp học" : "Class schedule",
            text: snapshot.schedules
              .slice(0, 40)
              .map(
                (row) =>
                  `${snapshot.classes.find((cls) => cls.id === row.class_id)?.name ?? ""}: ${row.title}, ${row.starts_at} – ${row.ends_at}`,
              )
              .join("\n"),
          },
          ...materialSources.map((source) => ({
            ...source,
            label: `${locale === "vi" ? "Tài liệu" : "Material"} · ${
              source.label
                .replace(/\b[0-9a-f]{8}-[0-9a-f-]{27,}\b/gi, "")
                .replace(/^(Material|Chunk|Document)\s*/i, "")
                .trim() ||
              (locale === "vi" ? "Nội dung lớp học" : "Class content")
            }`,
          })),
          ...snapshot.trials.flatMap((trial) =>
            trial.assessment
              ? [
                  {
                    id: `trial:${trial.id}`,
                    label: `${locale === "vi" ? "Đánh giá học thử" : "Trial assessment"} · ${snapshot.students.find((student) => student.id === trial.student_record_id)?.name ?? (locale === "vi" ? "Học viên" : "Student")}`,
                    text: JSON.stringify(trial.assessment),
                  },
                ]
              : [],
          ),
          ...snapshot.notes.map((note) => ({
            id: `note:${note.id}`,
            label: `${locale === "vi" ? "Ghi chú" : "Note"} · ${snapshot.students.find((student) => student.id === note.student_record_id)?.name ?? (locale === "vi" ? "Học viên" : "Student")}`,
            text: note.body,
          })),
          ...snapshot.drafts.map((draft) => ({
            id: `draft:${draft.id}`,
            label: `${locale === "vi" ? "Bản nháp" : "Draft"} · ${draft.title}`,
            text: `${draft.title}: ${draft.body}`,
          })),
        ],
        timezone: snapshot.trials[0]?.timezone ?? "Asia/Ho_Chi_Minh",
        currentTime: new Date().toISOString(),
        recentMessages: open.recentMessages,
        locale,
      };
      context.students = context.students.slice(0, 200);
      context.sources = context.sources
        .slice(0, 40)
        .map((source) => ({ ...source, text: source.text.slice(0, 3000) }));
      await checkpoint("thinking");
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
              deadlineAt: Date.parse(started.run.startedAt) + 85_000,
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
      await checkpoint("saving");
      const normalized = normalizeTeacherActions(
        planned.plan.actions as unknown as Record<string, unknown>[],
        snapshot,
      );
      const completed = await callRpc("center_teacher_chat_complete", {
        p_club_id: clubId,
        p_conversation_id: open.conversationId,
        p_answer: planned.plan.answer,
        p_sources: planned.plan.sources.map((source) => {
          const canonical = context.sources.find(
            (item) => item.id === source.id,
          );
          return {
            id: source.id,
            label: canonical?.label ?? source.label,
            text: canonical?.text.slice(0, 1500),
          };
        }),
        p_actions: normalized,
        p_request_key: requestKey,
        p_lease_token: started.leaseToken,
      });
      if (!completed || typeof completed !== "object")
        throw new Error("center_chat_complete returned no turn.");
      const result = await executeAutomaticProposals(
        clubId,
        {
          ...(completed as TeacherTurn),
          proposals: proposalsFrom((completed as TeacherTurn).proposals),
        },
        requestKey,
        started.leaseToken,
      );
      return result;
    },
  });
}

async function executeAutomaticProposals(
  clubId: string,
  turn: TeacherTurn,
  requestKey?: string,
  leaseToken?: string,
): Promise<TeacherTurn> {
  const proposals = [...turn.proposals];
  for (let i = 0; i < proposals.length; i++) {
    const proposal = proposals[i];
    if (proposal.requires_confirmation || proposal.status !== "pending")
      continue;
    try {
      if (
        requestKey &&
        leaseToken &&
        !(await callRpc("center_teacher_run_active", {
          p_club_id: clubId,
          p_request_key: requestKey,
          p_lease_token: leaseToken,
        }))
      )
        throw new Error("TEACHER_RUN_STOPPED");
      const receipt = (await callRpc(
        requestKey && leaseToken
          ? "center_teacher_decide_proposal"
          : "center_decide_proposal",
        {
          p_club_id: clubId,
          p_proposal_id: proposal.id,
          p_decision: "automatic",
          ...(requestKey && leaseToken
            ? { p_request_key: requestKey, p_lease_token: leaseToken }
            : {}),
        },
      )) as CommandReceipt;
      proposals[i] = { ...proposal, status: "executed", receipt };
    } catch (error) {
      if (error instanceof Error && error.message === "TEACHER_RUN_STOPPED")
        break;
      await callRpc("center_teacher_proposal_failure", {
        p_club_id: clubId,
        p_proposal_id: proposal.id,
        p_error_code: "automatic_failed",
      }).catch(() => undefined);
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

export async function listTeacherConversations(
  clubId: string,
): Promise<TeacherConversationSummary[]> {
  assertEnabled();
  const data = await callRpc("center_teacher_conversations", {
    p_club_id: clubId,
  });
  return Array.isArray(data) ? (data as TeacherConversationSummary[]) : [];
}

export async function getTeacherRun(
  clubId: string,
  requestKey: string,
): Promise<TeacherRun | null> {
  assertEnabled();
  const data = await callRpc("center_teacher_run", {
    p_club_id: clubId,
    p_request_key: requestKey,
  });
  return normalizeTeacherRun(data);
}

export async function stopTeacherRun(
  clubId: string,
  requestKey: string,
): Promise<null> {
  assertEnabled();
  await callRpc("center_teacher_stop", {
    p_club_id: clubId,
    p_request_key: requestKey,
  });
  return null;
}
