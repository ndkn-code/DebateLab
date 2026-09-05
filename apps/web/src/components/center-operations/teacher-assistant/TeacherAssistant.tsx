"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import type {
  CenterSnapshot,
  TeacherConversationSummary,
  TeacherHistory,
  TeacherRun,
} from "@/lib/center-operations/contracts";
import { centerCopy } from "../copy";
import { teacherAssistantCopy, type TeacherAssistantStage } from "./copy";
import { TeacherAssistantView } from "./TeacherAssistantView";
import { TeacherProposalReview } from "./TeacherProposalReview";
import { teacherAssistantApi, type TeacherAssistantApi } from "./api";
import {
  parsePendingTeacherRequest,
  readTeacherStorage,
  requestFromHistory,
  teacherErrorMessage,
  teacherStarterPrompts,
  teacherStorageKey,
  writeTeacherStorage,
  type PendingTeacherRequest,
} from "./client-state";

export function TeacherAssistant({
  snapshot,
  locale,
  onChanged,
  api = teacherAssistantApi,
}: {
  snapshot: CenterSnapshot;
  locale: "en" | "vi";
  onChanged: () => Promise<void>;
  api?: TeacherAssistantApi;
}) {
  const clubId = snapshot.organizationId;
  const storage = teacherStorageKey(clubId, snapshot.actorId);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<
    TeacherConversationSummary[]
  >([]);
  const [history, setHistory] = useState<TeacherHistory | null>(null);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState<PendingTeacherRequest | null>(null);
  const [run, setRun] = useState<TeacherRun | null>(null);
  const [sending, setSending] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [historyError, setHistoryError] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [canRetry, setCanRetry] = useState(false);
  const [listError, setListError] = useState(false);
  const reportError = useCallback(
    (raw: string) => {
      setError(teacherErrorMessage(raw, locale));
      setCanRetry(
        !/forbidden|unauthorized|access|scope|42501|stopped|decision/i.test(
          raw,
        ),
      );
    },
    [locale],
  );
  const [elapsed, setElapsed] = useState(0);
  const [classId, setClassId] = useState(snapshot.classes[0]?.id ?? "");
  const selection = useRef(0);
  const draftRef = useRef(draft);
  const selectedRef = useRef(selectedId);
  const pendingRef = useRef(pending);
  const submitLock = useRef(false);
  const initialized = useRef(false);
  const listedRequest = useRef<string | null>(null);
  const running = sending || run?.status === "running";
  const draftKey = useCallback(
    (id: string | null) => `${storage}:draft:${id ?? "new"}`,
    [storage],
  );
  const pendingKey = useCallback(
    (id: string | null) => `${storage}:pending:${id ?? "new"}`,
    [storage],
  );

  const refreshList = useCallback(async () => {
    const result = await api.list(clubId);
    if (result.ok) {
      setConversations(result.data);
      setListError(false);
      return result.data;
    }
    setListError(true);
    return null;
  }, [api, clubId]);

  useEffect(() => {
    if (
      !conversations.some(
        (item) => item.status === "running" || item.status === "working",
      )
    )
      return;
    const timer = setTimeout(() => {
      void refreshList();
    }, 8000);
    return () => clearTimeout(timer);
  }, [conversations, refreshList]);

  const openConversation = useCallback(
    async (id: string | null) => {
      const version = ++selection.current;
      submitLock.current = false;
      selectedRef.current = id;
      setSelectedId(id);
      writeTeacherStorage(storage, id ?? "new");
      const savedDraft = readTeacherStorage(draftKey(id)) ?? "";
      draftRef.current = savedDraft;
      setDraft(savedDraft);
      const savedPending = parsePendingTeacherRequest(
        readTeacherStorage(pendingKey(id)),
      );
      pendingRef.current = savedPending;
      setPending(savedPending);
      setHistory(null);
      setRun(null);
      setSending(false);
      setError(null);
      setStopping(false);
      setHistoryError(false);
      setLoadingHistory(Boolean(id));
      if (!id) return;
      try {
        const result = await api.history(clubId, id);
        if (version !== selection.current) return;
        if (!result.ok) {
          setHistoryError(true);
          return;
        }
        setHistory(result.data);
        setRun(result.data.run ?? null);
        const restored = requestFromHistory(result.data) ?? savedPending;
        pendingRef.current = restored;
        setPending(restored);
        if (result.data.run?.status === "failed")
          reportError(result.data.run.errorCode ?? "failed");
      } catch {
        if (version === selection.current) setHistoryError(true);
      } finally {
        if (version === selection.current) setLoadingHistory(false);
      }
    },
    [api, clubId, storage, draftKey, pendingKey, reportError],
  );

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    void (async () => {
      const saved = readTeacherStorage(storage);
      const items = await refreshList();
      await openConversation(
        saved === "new" ? null : (saved ?? items?.[0]?.id ?? null),
      );
    })();
    return () => {
      // Invalidate requests from this mounted workspace.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      selection.current++;
    };
  }, [storage, refreshList, openConversation]);

  const reloadCurrent = useCallback(async () => {
    const id = selectedRef.current;
    if (!id) return;
    const version = selection.current;
    const result = await api.history(clubId, id);
    if (selection.current !== version) return;
    if (result.ok) {
      setHistory(result.data);
      setRun(result.data.run ?? null);
      setHistoryError(false);
    } else setHistoryError(true);
  }, [api, clubId]);

  const updateDraft = (value: string) => {
    draftRef.current = value;
    setDraft(value);
    writeTeacherStorage(draftKey(selectedRef.current), value);
  };

  // Poll only the selected request; switching conversations never replaces its transcript
  // with a response from the previously selected conversation.
  useEffect(() => {
    if (!pending || (!running && run?.status !== undefined)) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    let failures = 0;
    const version = selection.current;
    const poll = async () => {
      try {
        const result = await api.run(clubId, pending.key);
        if (cancelled || version !== selection.current) return;
        if (!result.ok) {
          failures++;
          if (failures >= 3) reportError("connection");
        } else if (result.data) {
          failures = 0;
          const next = result.data;
          setRun(next);
          if (listedRequest.current !== pending.key) {
            listedRequest.current = pending.key;
            void refreshList();
          }
          if (!selectedRef.current) {
            selectedRef.current = next.conversationId;
            setSelectedId(next.conversationId);
            writeTeacherStorage(storage, next.conversationId);
            writeTeacherStorage(
              draftKey(next.conversationId),
              draftRef.current,
            );
            writeTeacherStorage(
              pendingKey(next.conversationId),
              JSON.stringify({
                ...pending,
                conversationId: next.conversationId,
              }),
            );
            writeTeacherStorage(pendingKey(null), null);
          }
          if (next.status !== "running") {
            setSending(false);
            submitLock.current = false;
            if (next.status === "failed")
              reportError(next.errorCode ?? "failed");
            if (next.status === "completed") {
              setError(null);
              if (draftRef.current.trim() === pending.message) updateDraft("");
              writeTeacherStorage(pendingKey(next.conversationId), null);
            }
            await reloadCurrent();
            await refreshList();
            return;
          }
        }
        if (Date.now() - Date.parse(pending.startedAt) > 120_000) {
          setSending(false);
          submitLock.current = false;
          reportError("timeout");
          return;
        }
      } catch {
        if (!cancelled) reportError("connection");
      }
      if (!cancelled)
        timer = setTimeout(poll, Math.min(1500 * (failures + 1), 6000));
    };
    timer = setTimeout(poll, 500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // updateDraft intentionally uses current refs, not the draft render value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    api,
    clubId,
    pending,
    running,
    run?.status,
    locale,
    storage,
    draftKey,
    pendingKey,
    reloadCurrent,
    refreshList,
  ]);

  useEffect(() => {
    const startedAt = run?.startedAt ?? pending?.startedAt;
    if (!startedAt || !running) return;
    const tick = () =>
      setElapsed(
        Math.max(0, Math.floor((Date.now() - Date.parse(startedAt)) / 1000)),
      );
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [run?.startedAt, pending?.startedAt, running]);

  const send = async (retry = false) => {
    if (submitLock.current || running || loadingHistory) return;
    const message =
      retry && pendingRef.current
        ? pendingRef.current.message
        : draftRef.current.trim();
    if (!message) return;
    const previous = pendingRef.current;
    const request: PendingTeacherRequest =
      retry && previous
        ? { ...previous, startedAt: new Date().toISOString() }
        : {
            key: crypto.randomUUID(),
            message,
            conversationId: selectedRef.current ?? undefined,
            startedAt: new Date().toISOString(),
          };
    const version = ++selection.current;
    submitLock.current = true;
    pendingRef.current = request;
    setPending(request);
    setSending(true);
    setRun(null);
    setError(null);
    writeTeacherStorage(
      pendingKey(selectedRef.current),
      JSON.stringify(request),
    );
    try {
      const result = await api.send(
        clubId,
        message,
        request.conversationId,
        request.key,
        locale,
      );
      if (version !== selection.current) {
        await refreshList();
        return;
      }
      if (!result.ok) {
        reportError(result.error);
        const latest = await api.run(clubId, request.key);
        if (version !== selection.current) return;
        if (latest.ok && latest.data) {
          setRun(latest.data);
          if (!selectedRef.current) {
            selectedRef.current = latest.data.conversationId;
            setSelectedId(latest.data.conversationId);
            writeTeacherStorage(storage, latest.data.conversationId);
            writeTeacherStorage(
              draftKey(latest.data.conversationId),
              draftRef.current,
            );
          }
          await reloadCurrent();
        } else
          setRun({
            requestKey: request.key,
            conversationId: selectedRef.current ?? "",
            status: "failed",
            stage: "failed",
            startedAt: request.startedAt,
            updatedAt: new Date().toISOString(),
          });
        return;
      }
      const id = result.data.conversationId;
      selectedRef.current = id;
      setSelectedId(id);
      writeTeacherStorage(storage, id);
      writeTeacherStorage(pendingKey(request.conversationId ?? null), null);
      writeTeacherStorage(pendingKey(id), null);
      if (draftRef.current.trim() === message) {
        writeTeacherStorage(draftKey(request.conversationId ?? null), null);
        updateDraft("");
      } else writeTeacherStorage(draftKey(id), draftRef.current);
      await reloadCurrent();
      await refreshList();
      await onChanged();
    } catch {
      if (version === selection.current) reportError("connection");
    } finally {
      if (version === selection.current) {
        setSending(false);
        submitLock.current = false;
      }
    }
  };

  const stop = async () => {
    const request = pendingRef.current;
    if (!request || stopping) return;
    const version = selection.current;
    setStopping(true);
    try {
      const result = await api.stop(clubId, request.key);
      if (version !== selection.current) return;
      if (!result.ok) reportError(result.error);
      else {
        setSending(false);
        setRun((old) =>
          old ? { ...old, status: "stopped", stage: "stopped" } : null,
        );
        await reloadCurrent();
      }
    } catch {
      if (version === selection.current) reportError("connection");
    } finally {
      if (version === selection.current) setStopping(false);
    }
  };

  const vi = locale === "vi";
  const stage =
    run?.stage && run.stage in teacherAssistantCopy.en.status
      ? (run.stage as TeacherAssistantStage)
      : sending
        ? "loading_context"
        : null;
  const messages = history?.messages ?? [];
  const optimistic =
    pending &&
    (running || error) &&
    !messages.some(
      (item) =>
        item.role === "user" && item.metadata.requestKey === pending.key,
    );
  return (
    <TeacherAssistantView
      locale={locale}
      organizationName={
        snapshot.organizationName ??
        (vi ? "Trung tâm hiện tại" : "Current center")
      }
      conversations={conversations}
      selectedId={selectedId}
      onSelect={(id) => {
        void openConversation(id);
      }}
      onNew={() => {
        void openConversation(null);
      }}
      loadingHistory={loadingHistory}
      historyError={historyError || listError}
      onRetryHistory={() => {
        void refreshList();
        void reloadCurrent();
      }}
      draft={draft}
      onDraftChange={updateDraft}
      onSend={() => {
        void send();
      }}
      onStop={() => {
        void stop();
      }}
      running={Boolean(running)}
      stopping={stopping}
      stage={stage}
      elapsedSeconds={elapsed}
      error={error}
      canRetry={canRetry && Boolean(pending) && !running}
      onRetry={() => {
        void send(true);
      }}
      prompts={teacherStarterPrompts(snapshot, locale, classId)}
      hasMessages={messages.length > 0 || Boolean(optimistic)}
    >
      {!messages.length && !optimistic && snapshot.classes.length > 0 && (
        <div className="mx-auto mb-4 grid w-full max-w-3xl gap-1.5">
          <Label htmlFor="teacher-assistant-class">
            {vi ? "Lớp cho gợi ý" : "Class for suggestions"}
          </Label>
          <Select
            id="teacher-assistant-class"
            value={classId}
            onChange={(event) => setClassId(event.target.value)}
          >
            {snapshot.classes.map((cls) => (
              <option key={cls.id} value={cls.id}>
                {cls.name}
              </option>
            ))}
          </Select>
        </div>
      )}
      <div
        className="mx-auto w-full min-w-0 max-w-3xl space-y-6"
        role="log"
        aria-label={vi ? "Nội dung trò chuyện" : "Conversation"}
        aria-live="polite"
      >
        {messages.map((message) => (
          <article key={message.id} className="min-w-0 space-y-3">
            <TeacherMessage
              role={message.role}
              body={message.body}
              locale={locale}
            />
            {message.role === "assistant" && (
              <>
                {Array.isArray(message.metadata.sources) &&
                  message.metadata.sources.length > 0 && (
                    <details className="type-body text-on-surface-variant">
                      <summary className="cursor-pointer type-label text-primary">
                        {vi ? "Nguồn tham khảo" : "Sources"}
                      </summary>
                      {message.metadata.sources.map((source, index) => {
                        const item = source as {
                          label?: string;
                          text?: string;
                        };
                        return (
                          <div key={index} className="mt-2 min-w-0 break-words">
                            <p className="type-label">{item.label}</p>
                            <p className="whitespace-pre-wrap">{item.text}</p>
                          </div>
                        );
                      })}
                    </details>
                  )}
                {(history?.proposals ?? [])
                  .filter(
                    (proposal) =>
                      Array.isArray(message.metadata.proposalIds) &&
                      message.metadata.proposalIds.includes(proposal.id),
                  )
                  .map((proposal) => (
                    <TeacherProposalReview
                      key={`${proposal.id}:${proposal.status}`}
                      proposal={proposal}
                      copy={centerCopy[locale]}
                      snapshot={snapshot}
                      clubId={clubId}
                      onDecide={api.decide}
                      running={Boolean(running)}
                      onDone={async () => {
                        await reloadCurrent();
                        await onChanged();
                      }}
                    />
                  ))}
              </>
            )}
          </article>
        ))}
        {optimistic && (
          <TeacherMessage role="user" body={pending.message} locale={locale} />
        )}
      </div>
    </TeacherAssistantView>
  );
}

function TeacherMessage({
  role,
  body,
  locale,
}: {
  role: "user" | "assistant";
  body: string;
  locale: "en" | "vi";
}) {
  return (
    <div
      aria-label={
        role === "user"
          ? locale === "vi"
            ? "Bạn"
            : "You"
          : locale === "vi"
            ? "Trợ lý"
            : "Assistant"
      }
      className={
        role === "user"
          ? "ml-auto w-fit max-w-full rounded-control bg-surface-container px-4 py-3 type-body text-on-surface"
          : "min-w-0 break-words type-body text-on-surface"
      }
    >
      {role === "user" ? (
        <p className="whitespace-pre-wrap break-words">{body}</p>
      ) : (
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
            h1: ({ children }) => (
              <h3 className="mb-2 type-title">{children}</h3>
            ),
            h2: ({ children }) => (
              <h3 className="mb-2 type-title">{children}</h3>
            ),
            h3: ({ children }) => (
              <h3 className="mb-2 type-title">{children}</h3>
            ),
            ul: ({ children }) => (
              <ul className="mb-3 list-disc space-y-1 pl-5">{children}</ul>
            ),
            ol: ({ children }) => (
              <ol className="mb-3 list-decimal space-y-1 pl-5">{children}</ol>
            ),
            pre: ({ children }) => (
              <pre className="my-3 max-w-full overflow-x-auto rounded-md bg-surface-container-low p-3">
                {children}
              </pre>
            ),
            table: ({ children }) => (
              <div className="my-3 max-w-full overflow-x-auto">
                <table className="w-full text-left">{children}</table>
              </div>
            ),
            th: ({ children }) => (
              <th className="border-b border-outline-variant p-2 type-label">
                {children}
              </th>
            ),
            td: ({ children }) => (
              <td className="border-b border-outline-variant p-2">
                {children}
              </td>
            ),
            a: ({ children, href }) => (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="break-all text-primary underline"
              >
                {children}
              </a>
            ),
          }}
        >
          {body}
        </ReactMarkdown>
      )}
    </div>
  );
}
