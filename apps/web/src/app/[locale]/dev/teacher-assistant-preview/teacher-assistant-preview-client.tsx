"use client";

import { useMemo, useState } from "react";
import {
  useParams,
  usePathname,
  useRouter,
  useSearchParams,
} from "next/navigation";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Moon, Sun } from "@/components/ui/icons";
import { PageContainer } from "@/components/shared/product-layout";
import { TeacherAssistant } from "@/components/center-operations/teacher-assistant/TeacherAssistant";
import type { TeacherAssistantApi } from "@/components/center-operations/teacher-assistant/api";
import type {
  CenterResult,
  CenterSnapshot,
  TeacherConversationSummary,
  TeacherHistory,
  TeacherProposal,
  TeacherRun,
  TeacherTurn,
} from "@/lib/center-operations/contracts";

const STORE_KEY = "thinkfy:dev:teacher-assistant-preview:v1";
const IDS = {
  club: "00000000-0000-0000-0000-000000000101",
  actor: "00000000-0000-0000-0000-000000000102",
  class: "00000000-0000-0000-0000-000000000103",
  student: "00000000-0000-0000-0000-000000000104",
};

type SavedConversation = {
  summary: TeacherConversationSummary;
  history: TeacherHistory;
};
type SavedState = {
  conversations: SavedConversation[];
  runs: Record<string, TeacherRun>;
  requests: Record<
    string,
    {
      message: string;
      locale: "en" | "vi";
      delay: number;
      shouldFail?: boolean;
    }
  >;
  sideEffects: number;
  mode: "normal" | "fail" | "slow";
};

const snapshot: CenterSnapshot = {
  organizationId: IDS.club,
  organizationName: "QA Teacher Center",
  actorId: IDS.actor,
  canManage: true,
  canManageFinance: true,
  classes: [{ id: IDS.class, name: "QA Debate class" }],
  students: [
    {
      id: IDS.student,
      name: "QA Student",
      code: "QA-001",
      linked: true,
      status: "active",
      classIds: [IDS.class],
    },
  ],
  admissions: [],
  trials: [],
  notes: [
    {
      id: "00000000-0000-0000-0000-000000000105",
      student_record_id: IDS.student,
      body: "QA note: prefers short speaking drills.",
      created_by: IDS.actor,
      created_at: "2026-09-05T12:00:00.000Z",
      revision: 1,
    },
  ],
  drafts: [],
  offers: [],
  invoices: [],
  schedules: [
    {
      id: "00000000-0000-0000-0000-000000000106",
      class_id: IDS.class,
      title: "QA weekly class",
      starts_at: "2026-09-08T16:00:00.000Z",
      ends_at: "2026-09-08T17:00:00.000Z",
      updated_at: "2026-09-05T12:00:00.000Z",
      connected: true,
    },
  ],
  connections: [],
  bindings: [],
  events: [],
};

function readState(): SavedState {
  if (typeof window === "undefined")
    return {
      conversations: [],
      runs: {},
      requests: {},
      sideEffects: 0,
      mode: "normal",
    };
  try {
    const state = JSON.parse(
      window.localStorage.getItem(STORE_KEY) ?? "",
    ) as Partial<SavedState>;
    return {
      conversations: state.conversations ?? [],
      runs: state.runs ?? {},
      requests: state.requests ?? {},
      sideEffects: state.sideEffects ?? 0,
      mode: state.mode ?? "normal",
    };
  } catch {
    return {
      conversations: [],
      runs: {},
      requests: {},
      sideEffects: 0,
      mode: "normal",
    };
  }
}
function saveState(state: SavedState) {
  window.localStorage.setItem(STORE_KEY, JSON.stringify(state));
}
function result<T>(data: T): CenterResult<T> {
  return { ok: true, data };
}
function failure(error: string): CenterResult<never> {
  return { ok: false, error };
}
function now() {
  return new Date().toISOString();
}

function createFixtureApi() {
  const timers = new Map<string, number>();
  const setMode = (mode: SavedState["mode"]) => {
    const state = readState();
    state.mode = mode;
    saveState(state);
  };
  const api: TeacherAssistantApi = {
    async list() {
      for (const run of Object.values(readState().runs)) {
        if (run.status === "running") await api.run(IDS.club, run.requestKey);
      }
      return result(readState().conversations.map((item) => item.summary));
    },
    async history(_clubId, conversationId) {
      const latest = Object.values(readState().runs)
        .filter((run) => run.conversationId === conversationId)
        .sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt))[0];
      if (latest?.status === "running")
        await api.run(_clubId, latest.requestKey);
      const state = readState();
      const item = state.conversations.find(
        (candidate) => candidate.summary.id === conversationId,
      );
      return item
        ? result({
            ...item.history,
            run: latest ? state.runs[latest.requestKey] : null,
          })
        : failure("not_found");
    },
    async run(_clubId, requestKey) {
      const state = readState();
      const run = state.runs[requestKey];
      if (
        run?.status === "running" &&
        Date.now() - Date.parse(run.startedAt) >= 3000
      ) {
        const request = state.requests[requestKey];
        const saved = state.conversations.find(
          (item) => item.summary.id === run.conversationId,
        );
        if (request && Date.now() - Date.parse(run.startedAt) < request.delay)
          return result(run);
        if (request?.shouldFail) {
          state.runs[requestKey] = {
            ...run,
            status: "failed",
            stage: "failed",
            errorCode: "connection",
            updatedAt: now(),
          };
          if (saved) saved.summary.status = "failed";
          saveState(state);
          return result(state.runs[requestKey]);
        }
        if (
          request &&
          saved &&
          !saved.history.messages.some(
            (message) =>
              message.role === "assistant" &&
              message.metadata.requestKey === requestKey,
          )
        ) {
          const generated = makeTurn(request.message, request.locale);
          saved.history.messages.push({
            id: crypto.randomUUID(),
            role: "assistant",
            body: generated.answer,
            metadata: {
              requestKey,
              sources: generated.sources,
              proposalIds: generated.proposals.map((proposal) => proposal.id),
            },
          });
          saved.history.proposals.push(...generated.proposals);
          saved.summary.updatedAt = now();
          saved.summary.status = generated.proposals.some(
            (proposal) => proposal.status === "pending",
          )
            ? "needs_review"
            : "completed";
        }
        state.runs[requestKey] = {
          ...run,
          status: "completed",
          stage: "completed",
          updatedAt: now(),
        };
        saveState(state);
        return result(state.runs[requestKey]);
      }
      return result(run ?? null);
    },
    async stop(_clubId, requestKey) {
      const state = readState();
      const run = state.runs[requestKey];
      if (!run || run.status !== "running") return result(null);
      const stopped = {
        ...run,
        status: "stopped" as const,
        stage: "stopped",
        updatedAt: now(),
      };
      state.runs[requestKey] = stopped;
      const conversation = state.conversations.find(
        (item) => item.summary.id === run.conversationId,
      );
      if (conversation) conversation.summary.status = "stopped";
      saveState(state);
      const timer = timers.get(requestKey);
      if (timer) window.clearTimeout(timer);
      return result(null);
    },
    async send(_clubId, message, conversationId, requestKey, locale) {
      const state = readState();
      const existing = Object.values(state.runs).find(
        (run) => run.requestKey === requestKey,
      );
      if (existing?.status === "completed") {
        const conversation = state.conversations.find(
          (item) => item.summary.id === existing.conversationId,
        );
        const assistant = conversation?.history.messages.find(
          (item) =>
            item.metadata.requestKey === requestKey &&
            item.role === "assistant",
        );
        return assistant
          ? result({
              conversationId: existing.conversationId,
              answer: assistant.body,
              sources: (assistant.metadata.sources ??
                []) as TeacherTurn["sources"],
              proposals: conversation?.history.proposals ?? [],
            })
          : failure("connection");
      }
      const id =
        existing?.conversationId ?? conversationId ?? crypto.randomUUID();
      let conversation = state.conversations.find(
        (item) => item.summary.id === id,
      );
      if (!conversation) {
        conversation = {
          summary: {
            id,
            title: message.slice(0, 48),
            updatedAt: now(),
            status: "working",
          },
          history: { conversationId: id, messages: [], proposals: [] },
        };
        state.conversations.unshift(conversation);
      }
      if (
        !conversation.history.messages.some(
          (item) =>
            item.role === "user" && item.metadata.requestKey === requestKey,
        )
      )
        conversation.history.messages.push({
          id: crypto.randomUUID(),
          role: "user",
          body: message,
          metadata: { requestKey },
        });
      const startedAt = now();
      const shouldFail = state.mode === "fail";
      const delay = state.mode === "slow" ? 30000 : 3000;
      state.mode = "normal";
      state.requests[requestKey] = { message, locale, delay, shouldFail };
      state.runs[requestKey] = {
        requestKey,
        conversationId: id,
        status: "running",
        stage: "reading_materials",
        startedAt,
        updatedAt: startedAt,
      };
      saveState(state);
      const complete = () => {
        const latest = readState();
        const run = latest.runs[requestKey];
        if (!run || run.status !== "running") return;
        if (shouldFail) {
          latest.runs[requestKey] = {
            ...run,
            status: "failed",
            stage: "failed",
            errorCode: "connection",
            updatedAt: now(),
          };
          const saved = latest.conversations.find(
            (item) => item.summary.id === id,
          );
          if (saved) saved.summary.status = "failed";
          saveState(latest);
          return;
        }
        const generated = makeTurn(message, locale);
        const saved = latest.conversations.find(
          (item) => item.summary.id === id,
        );
        if (!saved) return;
        saved.history.messages.push({
          id: crypto.randomUUID(),
          role: "assistant",
          body: generated.answer,
          metadata: {
            requestKey,
            sources: generated.sources,
            proposalIds: generated.proposals.map((proposal) => proposal.id),
          },
        });
        saved.history.proposals.push(...generated.proposals);
        saved.summary.updatedAt = now();
        saved.summary.status = generated.proposals.some(
          (proposal) => proposal.status === "pending",
        )
          ? "needs_review"
          : "completed";
        latest.runs[requestKey] = {
          ...run,
          status: "completed",
          stage: "completed",
          updatedAt: now(),
        };
        saveState(latest);
      };
      timers.set(requestKey, window.setTimeout(complete, delay));
      await new Promise<void>((resolve) => window.setTimeout(resolve, delay));
      const finished = readState();
      const finalRun = finished.runs[requestKey];
      if (finalRun?.status === "failed") return failure("connection");
      if (finalRun?.status === "stopped") return failure("stopped");
      const saved = finished.conversations.find(
        (item) => item.summary.id === id,
      );
      const assistant = saved?.history.messages.find(
        (item) =>
          item.role === "assistant" && item.metadata.requestKey === requestKey,
      );
      const generated = makeTurn(message, locale);
      return result({
        conversationId: id,
        answer: assistant?.body ?? generated.answer,
        sources: (assistant?.metadata.sources ??
          generated.sources) as TeacherTurn["sources"],
        proposals: saved?.history.proposals ?? generated.proposals,
      });
    },
    async decide(_clubId, proposalId, decision) {
      const state = readState();
      for (const item of state.conversations) {
        const proposal = item.history.proposals.find(
          (candidate) => candidate.id === proposalId,
        );
        if (!proposal) continue;
        if (proposal.status === "executed") return result(proposal.receipt);
        if (proposal.status === "cancelled") return result(null);
        proposal.status = decision === "confirm" ? "executed" : "cancelled";
        proposal.receipt =
          decision === "confirm"
            ? {
                commandId: crypto.randomUUID(),
                kind: proposal.kind,
                targetId: String(
                  proposal.input.classId ??
                    proposal.input.studentRecordId ??
                    proposal.id,
                ),
                revision: 1,
                status: "completed",
              }
            : null;
        if (decision === "confirm") state.sideEffects += 1;
        saveState(state);
        return result(proposal.receipt);
      }
      return failure("not_found");
    },
  };
  return { api, setMode, getSideEffects: () => readState().sideEffects };
}

function makeTurn(message: string, locale: "en" | "vi"): TeacherTurn {
  const vi = locale === "vi";
  const lower = message.toLowerCase();
  const readOnly = lower.includes("summar") || lower.includes("tóm tắt");
  const classId = IDS.class;
  const studentId = IDS.student;
  const proposals: TeacherProposal[] = [];
  let answer = vi
    ? "Tôi đã kiểm tra QA Debate class và QA Student trong trung tâm QA."
    : "I checked QA Debate class and QA Student in QA Teacher Center.";
  if (
    !readOnly &&
    (lower.includes("homework") ||
      lower.includes("lesson") ||
      lower.includes("bài tập") ||
      lower.includes("bài học"))
  ) {
    const draftType =
      lower.includes("lesson") || lower.includes("bài học")
        ? "lesson"
        : "homework";
    proposals.push({
      id: crypto.randomUUID(),
      kind: "draft.create",
      input: {
        classId,
        title: vi ? "Kế hoạch QA tuần này" : "QA weekly plan",
        body: vi
          ? "Ôn luận điểm và luyện phản biện ngắn cho QA Student."
          : "Review claims and practise a short rebuttal with QA Student.",
        draftType,
      },
      requires_confirmation: false,
      status: "executed",
      receipt: {
        commandId: crypto.randomUUID(),
        kind: "draft.create",
        targetId: classId,
        revision: 1,
        status: "completed",
      },
      expires_at: "2026-09-12T00:00:00.000Z",
    });
    answer = vi
      ? "Tôi đã tạo bản nháp cho QA Debate class."
      : "I created a draft for QA Debate class.";
  } else if (
    !readOnly &&
    (lower.includes("note") || lower.includes("ghi chú"))
  ) {
    proposals.push({
      id: crypto.randomUUID(),
      kind: "note.create",
      input: {
        studentRecordId: studentId,
        body: vi
          ? "Ghi chú QA nội bộ: cần luyện phản biện ngắn."
          : "QA internal note: practise a short rebuttal.",
      },
      requires_confirmation: false,
      status: "executed",
      receipt: {
        commandId: crypto.randomUUID(),
        kind: "note.create",
        targetId: studentId,
        revision: 1,
        status: "completed",
      },
      expires_at: "2026-09-12T00:00:00.000Z",
    });
    answer = vi
      ? "Đã lưu ghi chú nội bộ cho QA Student."
      : "I saved the internal note for QA Student.";
  } else if (
    !readOnly &&
    (lower.includes("message") ||
      lower.includes("schedule") ||
      lower.includes("payment") ||
      lower.includes("gửi") ||
      lower.includes("lịch") ||
      lower.includes("thanh toán"))
  ) {
    const kind =
      lower.includes("schedule") || lower.includes("lịch")
        ? "schedule.reschedule"
        : lower.includes("payment") || lower.includes("thanh toán")
          ? "offer.create"
          : "message.send";
    proposals.push({
      id: crypto.randomUUID(),
      kind,
      input:
        kind === "message.send"
          ? { studentRecordId: studentId, templateKey: "progress_summary" }
          : kind === "schedule.reschedule"
            ? {
                scheduleId: snapshot.schedules[0].id,
                startAt: "2026-09-09T16:00:00.000Z",
                endAt: "2026-09-09T17:00:00.000Z",
                expectedUpdatedAt: snapshot.schedules[0].updated_at,
              }
            : {
                studentRecordId: studentId,
                classId,
                amount: 100000,
                startDate: "2026-09-10",
                endDate: "2026-10-10",
              },
      requires_confirmation: true,
      status: "pending",
      receipt: null,
      expires_at: "2026-09-12T00:00:00.000Z",
    });
    answer = vi
      ? "Tôi đã chuẩn bị thay đổi. Bạn cần xác nhận trước khi có tin nhắn, lịch hoặc thanh toán."
      : "I prepared the change. Please confirm before sending a message, changing a schedule, or paying.";
  } else
    answer = vi
      ? "Tóm tắt QA: QA Student đang học trong QA Debate class. Nguồn: danh sách lớp, hồ sơ học viên và ghi chú nội bộ."
      : "QA summary: QA Student is active in QA Debate class. Sources: class roster, student record, and internal notes.";
  return {
    conversationId: "",
    answer,
    sources: [
      {
        id: `class:${classId}`,
        label: vi
          ? "Danh sách lớp · QA Debate class"
          : "Class roster · QA Debate class",
        text: vi ? "QA Student" : "QA Student",
      },
      {
        id: `student:${studentId}`,
        label: vi
          ? "Hồ sơ học viên · QA Student"
          : "Student record · QA Student",
      },
    ],
    proposals,
  };
}

export function TeacherAssistantPreviewClient() {
  const params = useParams<{ locale: string }>();
  const locale = params.locale === "vi" ? "vi" : "en";
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const { resolvedTheme, setTheme } = useTheme();
  const fixture = useMemo(() => createFixtureApi(), []);
  const [mode, setModeState] = useState<"normal" | "fail" | "slow">("normal");
  const [effects, setEffects] = useState(0);
  const setMode = (next: "normal" | "fail" | "slow") => {
    fixture.setMode(next);
    setModeState(next);
  };
  const switchLocale = (next: "en" | "vi") => {
    const query = search.toString();
    router.replace(
      `/${next}${pathname.replace(/^\/(en|vi)/, "")}${query ? `?${query}` : ""}`,
    );
  };
  return (
    <main className="min-h-dvh overflow-x-hidden bg-background text-on-surface">
      <PageContainer size="wide" className="py-4 sm:py-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-control border border-outline-variant bg-surface p-3">
          <div>
            <p className="type-eyebrow text-primary">QA FIXTURE</p>
            <h1 className="type-title text-on-surface">
              Teacher Center assistant preview
            </h1>
            <p className="type-caption text-on-surface-variant">
              Scoped to QA Teacher Center · QA Debate class · QA Student
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="type-caption text-on-surface-variant">Locale</span>
            <Button
              size="sm"
              variant={locale === "en" ? "primary" : "outline"}
              onClick={() => switchLocale("en")}
            >
              EN
            </Button>
            <Button
              size="sm"
              variant={locale === "vi" ? "primary" : "outline"}
              onClick={() => switchLocale("vi")}
            >
              VI
            </Button>
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="Toggle theme"
              onClick={() =>
                setTheme(resolvedTheme === "dark" ? "light" : "dark")
              }
            >
              {resolvedTheme === "dark" ? <Sun /> : <Moon />}
            </Button>
          </div>
        </div>
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-control border border-warning bg-warning-container p-2">
          <span className="type-label text-on-warning-container">
            QA controls
          </span>
          <Button
            size="sm"
            variant={mode === "fail" ? "destructive" : "outline"}
            onClick={() => setMode("fail")}
          >
            Next request fails
          </Button>
          <Button
            size="sm"
            variant={mode === "slow" ? "primary" : "outline"}
            onClick={() => setMode("slow")}
          >
            Slow request
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setMode("normal");
              setEffects(fixture.getSideEffects());
            }}
          >
            Refresh side effects: {effects}
          </Button>
        </div>
        <TeacherAssistant
          snapshot={snapshot}
          locale={locale}
          api={fixture.api}
          onChanged={async () => setEffects(fixture.getSideEffects())}
        />
      </PageContainer>
    </main>
  );
}
