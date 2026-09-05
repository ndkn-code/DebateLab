"use client";

import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type {
  CenterCommand,
  CenterSnapshot,
  TeacherHistory,
  TeacherProposal,
  TeacherTurn,
} from "@/lib/center-operations/contracts";
import {
  loadCenterOperations,
  executeCenterOperation,
  sendCenterTeacherMessage,
  decideCenterTeacherProposal,
  loadCenterTeacherHistory,
  createCenterGuardianInvite,
} from "@/app/actions/admin-clubs";
import { centerCopy } from "./copy";
import { CenterSheetReview } from "./CenterSheetReview";
import { CenterIntegrations } from "./CenterIntegrations";
import { CenterDateTime } from "./CenterDateTime";

type Props = {
  initial: CenterSnapshot;
  locale: "en" | "vi";
  existingCalendarsEnabled?: boolean;
};
type Form = Record<string, string>;
const initialForm: Form = {};
const iso = (value: string) => value.trim();

export function CenterWorkbench({
  initial,
  locale,
  existingCalendarsEnabled = false,
}: Props) {
  const t = centerCopy[locale];
  const dateTime = (value: string) =>
    new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Asia/Ho_Chi_Minh",
    }).format(new Date(value));
  const clubId = initial.organizationId;
  const [snapshot, setSnapshot] = useState(initial);
  const [activeTab, setActiveTab] = useState("students");
  const [selectedId, setSelectedId] = useState(initial.students[0]?.id ?? "");
  const [form, setForm] = useState<Form>(initialForm);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [assistant, setAssistant] = useState<TeacherTurn | null>(null);
  const [question, setQuestion] = useState("");
  const [history, setHistory] = useState<TeacherHistory | null>(null);
  const commandKey = useRef<{ key: string; fingerprint: string } | null>(null);
  const chatKey = useRef<{ key: string; fingerprint: string } | null>(null);
  const [guardian, setGuardian] = useState({
    fullName: "",
    email: "",
    phone: "",
  });
  const [invite, setInvite] = useState<{
    token?: string;
    expiresAt: string;
  } | null>(null);
  const [rebookTrialId, setRebookTrialId] = useState<string | null>(null);

  const update = (key: string, value: string) =>
    setForm((old) => ({ ...old, [key]: value }));
  const run = async (command: CenterCommand) => {
    setBusy(true);
    setError("");
    const fingerprint = JSON.stringify(command);
    if (commandKey.current?.fingerprint !== fingerprint)
      commandKey.current = { key: crypto.randomUUID(), fingerprint };
    const result = await executeCenterOperation(
      clubId,
      command,
      commandKey.current.key,
    );
    if (!result.ok) setError(result.error);
    else {
      commandKey.current = null;
      await refresh();
    }
    setBusy(false);
    return result;
  };
  const refresh = async () => {
    const result = await loadCenterOperations(clubId);
    if (result.ok) setSnapshot(result.data);
    else setError(result.error);
  };
  const student = snapshot.students.find((item) => item.id === selectedId);
  const admission = snapshot.admissions.find(
    (item) => item.student_record_id === selectedId,
  );
  const className = (id: string | null) =>
    snapshot.classes.find((item) => item.id === id)?.name ?? "—";
  const field = (name: string, label: string, type = "text") => (
    <div className="grid gap-1.5">
      <Label htmlFor={`center-${name}`}>{label}</Label>
      <Input
        id={`center-${name}`}
        type={type}
        value={form[name] ?? ""}
        onChange={(event) => update(name, event.target.value)}
      />
    </div>
  );
  const select = (name: string, label: string, options: [string, string][]) => (
    <div className="grid gap-1.5">
      <Label htmlFor={`center-${name}`}>{label}</Label>
      <Select
        id={`center-${name}`}
        value={form[name] ?? ""}
        onChange={(event) => update(name, event.target.value)}
      >
        <option value="">{t.required}</option>
        {options.map(([value, labelText]) => (
          <option key={value} value={value}>
            {labelText}
          </option>
        ))}
      </Select>
    </div>
  );
  const submitStudent = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.name) return;
    const result = await run({
      kind: "student.create",
      name: form.name,
      phone: form.phone,
      email: form.email,
      source: form.source,
      target: form.target,
    });
    if (result.ok) setForm({});
  };
  const selectedClass = snapshot.classes.map(
    (item) => [item.id, item.name] as [string, string],
  );
  const studentOptions = snapshot.students.map(
    (item) => [item.id, item.name] as [string, string],
  );
  useEffect(() => {
    const key = `center-teacher:${clubId}:${initial.actorId}`;
    const conversationId = window.localStorage.getItem(key);
    if (!conversationId) return;
    void loadCenterTeacherHistory(clubId, conversationId).then((result) => {
      if (result.ok) setHistory(result.data);
    });
  }, [clubId, initial.actorId]);

  return (
    <main className="min-w-0 space-y-4 p-4 lg:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="type-eyebrow text-primary">{t.title}</span>
          <h1 className="type-heading-xl text-on-surface">{t.title}</h1>
        </div>
        <Button variant="outline" onClick={refresh} disabled={busy}>
          {t.refresh}
        </Button>
      </div>
      {error && (
        <div
          role="alert"
          className="rounded-control border border-error bg-error-container px-3 py-2 type-body text-on-error-container"
        >
          {error}
        </div>
      )}
      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(String(value))}
        className="min-w-0"
      >
        <TabsList className="max-w-full group-data-horizontal/tabs:h-auto flex-wrap">
          {(
            [
              "students",
              "trials",
              "schedules",
              ...(initial.canManageFinance ? ["tuition" as const] : []),
              "materials",
              "integrations",
              "assistant",
            ] as const
          ).map((tab) => (
            <TabsTrigger
              key={tab}
              value={tab}
              className={`h-8 ${activeTab === tab ? "bg-surface-container-high text-on-surface" : "text-on-surface-variant"}`}
            >
              {t[tab]}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent
          value="students"
          className="grid min-w-0 items-start gap-4 pt-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]"
        >
          <section className="min-w-0 overflow-hidden rounded-2xl border border-border bg-surface p-3">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="type-heading-md text-on-surface">{t.students}</h2>
              <span className="type-caption text-muted-foreground">
                {snapshot.students.length}
              </span>
            </div>
            <div className="divide-y divide-border">
              {snapshot.students.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setSelectedId(item.id);
                    setInvite(null);
                    setGuardian({ fullName: "", email: "", phone: "" });
                  }}
                  className="flex min-w-0 w-full items-center justify-between gap-3 py-3 text-left hover:bg-surface-container-low"
                >
                  <span className="min-w-0">
                    <span className="block truncate type-title text-on-surface">
                      {item.name}
                    </span>
                    <span className="block truncate type-caption text-on-surface-variant">
                      {statusLabel(item.status, t)} ·{" "}
                      {item.classIds.map(className).join(", ") || "—"}
                    </span>
                  </span>
                  <span className="shrink-0 type-label text-primary">
                    {statusLabel(
                      snapshot.admissions.find(
                        (a) => a.student_record_id === item.id,
                      )?.stage ?? "—",
                      t,
                    )}
                  </span>
                </button>
              ))}
              {!snapshot.students.length && (
                <p className="py-8 text-center type-body text-muted-foreground">
                  {t.empty}
                </p>
              )}
            </div>
          </section>
          <aside className="min-w-0 space-y-4">
            <section className="rounded-2xl border border-border bg-surface p-3">
              <h2 className="type-heading-md text-on-surface">
                {student?.name ?? t.details}
              </h2>
              <p className="mt-1 type-caption text-on-surface-variant">
                {student ? statusLabel(student.status, t) : t.empty} ·{" "}
                {admission?.target ?? "—"}
              </p>
              {student && initial.canManage && (
                <form
                  className="mt-3 grid gap-2 border-t border-border pt-3"
                  onSubmit={async (event) => {
                    event.preventDefault();
                    setBusy(true);
                    setError("");
                    const result = await createCenterGuardianInvite({
                      clubId,
                      studentRecordId: student.id,
                      fullName: guardian.fullName,
                      email: guardian.email || undefined,
                      phone: guardian.phone || undefined,
                      idempotencyKey: crypto.randomUUID(),
                    });
                    if (result.ok) {
                      setInvite(result.data);
                      setGuardian({ fullName: "", email: "", phone: "" });
                    } else setError(result.error);
                    setBusy(false);
                  }}
                >
                  <h3 className="type-title text-on-surface">
                    {t.guardianInvite}
                  </h3>
                  <Input
                    aria-label={t.guardianName}
                    value={guardian.fullName}
                    onChange={(event) =>
                      setGuardian((old) => ({
                        ...old,
                        fullName: event.target.value,
                      }))
                    }
                    placeholder={t.guardianName}
                  />
                  <Input
                    aria-label={t.email}
                    type="email"
                    value={guardian.email}
                    onChange={(event) =>
                      setGuardian((old) => ({
                        ...old,
                        email: event.target.value,
                      }))
                    }
                    placeholder={t.email}
                  />
                  <Input
                    aria-label={t.phone}
                    value={guardian.phone}
                    onChange={(event) =>
                      setGuardian((old) => ({
                        ...old,
                        phone: event.target.value,
                      }))
                    }
                    placeholder={t.phone}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    type="submit"
                    disabled={busy || !guardian.fullName}
                  >
                    {t.createInvite}
                  </Button>
                  {invite && (
                    <p className="break-words type-caption text-on-surface-variant">
                      {t.inviteReady}:{" "}
                      {invite.token
                        ? `${window.location.origin}/${locale}/dashboard/family/claim?token=${encodeURIComponent(invite.token)}`
                        : t.alreadyCreated}
                    </p>
                  )}
                  <p className="type-caption text-on-surface-variant">
                    {t.guardianConsent}
                  </p>
                </form>
              )}
              {student && initial.canManage && (
                <div className="mt-3 grid gap-2">
                  {(["lead", "qualified", "lost"] as const).map((stage) => (
                    <Button
                      key={stage}
                      size="sm"
                      variant="outline"
                      disabled={busy || !admission}
                      onClick={() =>
                        admission &&
                        run({
                          kind: "admission.stage",
                          admissionId: admission.id,
                          stage,
                          expectedRevision: admission.revision,
                        })
                      }
                    >
                      {t[stage]}
                    </Button>
                  ))}
                </div>
              )}
              <div className="mt-4 space-y-2">
                <h3 className="type-title text-on-surface">{t.notes}</h3>
                {snapshot.notes
                  .filter((note) => note.student_record_id === selectedId)
                  .map((note) => (
                    <p
                      key={note.id}
                      className="break-words rounded-control bg-surface-container-low p-2 type-body text-on-surface"
                    >
                      {note.body}
                    </p>
                  ))}
                {field("note", t.notes)}
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() =>
                    selectedId &&
                    form.note &&
                    run({
                      kind: "note.create",
                      studentRecordId: selectedId,
                      body: form.note,
                    }).then((result) => {
                      if (result.ok) update("note", "");
                    })
                  }
                >
                  {t.addNote}
                </Button>
              </div>
            </section>
            {initial.canManage && (
              <form
                onSubmit={submitStudent}
                className="grid gap-2 rounded-2xl border border-border bg-surface p-3"
              >
                <h2 className="type-heading-md text-on-surface">
                  {t.addStudent}
                </h2>
                {field("name", t.name)}
                {field("phone", t.phone)}
                {field("email", t.email, "email")}
                <div className="grid grid-cols-2 gap-2">
                  {field("source", t.source)}
                  {field("target", t.target)}
                </div>
                <Button type="submit" disabled={busy || !form.name}>
                  {t.save}
                </Button>
              </form>
            )}
          </aside>
        </TabsContent>
        <TabsContent value="trials" className="min-w-0 space-y-4 pt-4">
          {initial.canManage && (
            <form
              className="grid gap-2 rounded-2xl border border-border bg-surface p-3 md:grid-cols-4"
              onSubmit={(event) => {
                event.preventDefault();
                if (form.student && form.class && form.startAt && form.endAt)
                  run({
                    kind: "trial.book",
                    studentRecordId: form.student,
                    classId: form.class,
                    startAt: iso(form.startAt),
                    endAt: iso(form.endAt),
                  });
              }}
            >
              <h2 className="md:col-span-4 type-heading-md text-on-surface">
                {t.bookTrial}
              </h2>
              {select("student", t.selectStudent, studentOptions)}
              {select("class", t.selectClass, selectedClass)}
              <CenterDateTime
                locale={locale}
                label={t.start}
                value={form.startAt ?? ""}
                onChange={(value) => update("startAt", value)}
              />
              <CenterDateTime
                locale={locale}
                label={t.end}
                value={form.endAt ?? ""}
                onChange={(value) => update("endAt", value)}
              />
              <Button className="md:col-span-4" type="submit" disabled={busy}>
                {t.bookTrial}
              </Button>
            </form>
          )}
          <div className="grid gap-3">
            {snapshot.trials.map((trial) => (
              <section
                key={trial.id}
                className="min-w-0 rounded-2xl border border-border bg-surface p-3"
              >
                <div className="flex flex-wrap justify-between gap-2">
                  <div>
                    <h3 className="type-title text-on-surface">
                      {snapshot.students.find(
                        (item) => item.id === trial.student_record_id,
                      )?.name ?? "—"}
                    </h3>
                    <p className="type-caption text-on-surface-variant">
                      {className(trial.class_id)} · {dateTime(trial.starts_at)}{" "}
                      → {dateTime(trial.ends_at)}
                    </p>
                    {trial.rebook_of && (
                      <p className="type-caption text-on-surface-variant">
                        {t.rebookedFrom}{" "}
                        {dateTime(
                          snapshot.trials.find(
                            (item) => item.id === trial.rebook_of,
                          )?.starts_at ?? trial.starts_at,
                        )}
                      </p>
                    )}
                    {snapshot.trials.some(
                      (child) => child.rebook_of === trial.id,
                    ) && (
                      <p className="type-caption text-on-surface-variant">
                        {t.rebookedFor}{" "}
                        {dateTime(
                          snapshot.trials.find(
                            (child) => child.rebook_of === trial.id,
                          )?.starts_at ?? trial.starts_at,
                        )}
                      </p>
                    )}
                  </div>
                  <span className="type-label text-primary">
                    {statusLabel(trial.status, t)}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(["attended", "no_show", "cancelled"] as const).map(
                    (status) => (
                      <Button
                        key={status}
                        size="sm"
                        variant="outline"
                        disabled={busy || trial.status !== "booked"}
                        onClick={() =>
                          run({
                            kind: "trial.status",
                            trialId: trial.id,
                            status,
                            expectedRevision: trial.revision,
                          })
                        }
                      >
                        {t[status]}
                      </Button>
                    ),
                  )}
                  {snapshot.canManage &&
                    trial.status === "no_show" &&
                    !snapshot.trials.some(
                      (child) => child.rebook_of === trial.id,
                    ) && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => {
                          setRebookTrialId(
                            rebookTrialId === trial.id ? null : trial.id,
                          );
                          update(`${trial.id}:rebookStart`, "");
                          update(`${trial.id}:rebookEnd`, "");
                        }}
                      >
                        {t.rebook}
                      </Button>
                    )}
                </div>
                {rebookTrialId === trial.id &&
                  snapshot.canManage &&
                  trial.status === "no_show" &&
                  !snapshot.trials.some(
                    (child) => child.rebook_of === trial.id,
                  ) && (
                    <form
                      className="mt-3 grid gap-2 border-t border-border pt-3 md:grid-cols-3"
                      onSubmit={async (event) => {
                        event.preventDefault();
                        const startAt = form[`${trial.id}:rebookStart`];
                        const endAt = form[`${trial.id}:rebookEnd`];
                        if (!startAt || !endAt) return;
                        const result = await run({
                          kind: "trial.rebook",
                          priorTrialId: trial.id,
                          startAt,
                          endAt,
                          expectedRevision: trial.revision,
                        });
                        if (result.ok) setRebookTrialId(null);
                      }}
                    >
                      <p className="md:col-span-3 type-caption text-on-surface-variant">
                        {t.rebookReview}{" "}
                        {snapshot.students.find(
                          (item) => item.id === trial.student_record_id,
                        )?.name ?? "—"}{" "}
                        · {className(trial.class_id)}.
                      </p>
                      <CenterDateTime
                        locale={locale}
                        label={t.start}
                        value={form[`${trial.id}:rebookStart`] ?? ""}
                        onChange={(value) =>
                          update(`${trial.id}:rebookStart`, value)
                        }
                      />
                      <CenterDateTime
                        locale={locale}
                        label={t.end}
                        value={form[`${trial.id}:rebookEnd`] ?? ""}
                        onChange={(value) =>
                          update(`${trial.id}:rebookEnd`, value)
                        }
                      />
                      <Button
                        type="submit"
                        disabled={
                          busy ||
                          !form[`${trial.id}:rebookStart`] ||
                          !form[`${trial.id}:rebookEnd`]
                        }
                      >
                        {t.rebookConfirm}
                      </Button>
                    </form>
                  )}
                {trial.status === "attended" && (
                  <form
                    className="mt-3 grid gap-2 md:grid-cols-2"
                    onSubmit={(event) => {
                      event.preventDefault();
                      run({
                        kind: "trial.evaluate",
                        trialId: trial.id,
                        assessment: {
                          level: form[`${trial.id}:level`] ?? "",
                          strengths: form[`${trial.id}:strengths`] ?? "",
                          weaknesses: form[`${trial.id}:weaknesses`] ?? "",
                          recommendation:
                            form[`${trial.id}:recommendation`] ?? "",
                        },
                        expectedRevision: trial.revision,
                      });
                    }}
                  >
                    {field(`${trial.id}:level`, t.level)}
                    {field(`${trial.id}:strengths`, t.strengths)}
                    {field(`${trial.id}:weaknesses`, t.weaknesses)}
                    {field(`${trial.id}:recommendation`, t.recommendation)}
                    <Button
                      variant="outline"
                      type="submit"
                      className="md:col-span-2"
                    >
                      {t.evaluate}
                    </Button>
                  </form>
                )}
              </section>
            ))}
            {!snapshot.trials.length && (
              <p className="py-8 text-center type-body text-muted-foreground">
                {t.empty}
              </p>
            )}
          </div>
        </TabsContent>
        <TabsContent value="schedules" className="min-w-0 space-y-3 pt-4">
          <h2 className="type-heading-md text-on-surface">{t.schedules}</h2>
          {snapshot.schedules.map((schedule) => (
            <section
              key={schedule.id}
              className="rounded-2xl border border-border bg-surface p-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="type-title text-on-surface">
                    {schedule.title}
                  </h3>
                  <p className="type-caption text-on-surface-variant">
                    {className(schedule.class_id)} ·{" "}
                    {dateTime(schedule.starts_at)} →{" "}
                    {dateTime(schedule.ends_at)}
                  </p>
                </div>
                <span className="type-label text-on-surface-variant">
                  {schedule.connected ? t.connected : t.disconnected}
                </span>
              </div>
              <form
                className="mt-3 grid gap-2 md:grid-cols-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (
                    form[`${schedule.id}:scheduleStart`] &&
                    form[`${schedule.id}:scheduleEnd`]
                  )
                    run({
                      kind: "schedule.reschedule",
                      scheduleId: schedule.id,
                      startAt: form[`${schedule.id}:scheduleStart`],
                      endAt: form[`${schedule.id}:scheduleEnd`],
                      expectedUpdatedAt: schedule.updated_at,
                    });
                }}
              >
                <CenterDateTime
                  locale={locale}
                  label={t.start}
                  value={form[`${schedule.id}:scheduleStart`] ?? ""}
                  onChange={(value) =>
                    update(`${schedule.id}:scheduleStart`, value)
                  }
                />
                <CenterDateTime
                  locale={locale}
                  label={t.end}
                  value={form[`${schedule.id}:scheduleEnd`] ?? ""}
                  onChange={(value) =>
                    update(`${schedule.id}:scheduleEnd`, value)
                  }
                />
                <Button type="submit" variant="outline" disabled={busy}>
                  {t.reschedule}
                </Button>
              </form>
            </section>
          ))}
          {!snapshot.schedules.length && (
            <p className="py-8 text-center type-body text-muted-foreground">
              {t.emptySchedules}
            </p>
          )}
        </TabsContent>
        {initial.canManageFinance && (
          <TabsContent value="tuition" className="min-w-0 space-y-4 pt-4">
            <form
              className="grid gap-2 rounded-2xl border border-border bg-surface p-3 md:grid-cols-4"
              onSubmit={(event) => {
                event.preventDefault();
                run({
                  kind: "offer.create",
                  studentRecordId: form.student,
                  classId: form.class,
                  amount: Number(form.amount),
                  startDate: form.startDate,
                  endDate: form.endDate,
                });
              }}
            >
              <h2 className="md:col-span-4 type-heading-md text-on-surface">
                {t.offer}
              </h2>
              {select("student", t.selectStudent, studentOptions)}
              {select("class", t.selectClass, selectedClass)}
              {field("amount", t.amount, "number")}
              <CenterDateTime
                locale={locale}
                dateOnly
                label={t.offerStart}
                value={form.startDate ?? ""}
                onChange={(value) => update("startDate", value)}
              />
              <CenterDateTime
                locale={locale}
                dateOnly
                label={t.offerEnd}
                value={form.endDate ?? ""}
                onChange={(value) => update("endDate", value)}
              />
              <Button type="submit" disabled={busy} className="md:col-span-4">
                {t.offer}
              </Button>
            </form>
            <div className="grid gap-2">
              {snapshot.offers.map((offer) => (
                <div
                  key={offer.id}
                  className="flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-2xl border border-border bg-surface p-3"
                >
                  <span className="min-w-0">
                    <strong className="type-title text-on-surface">
                      {snapshot.students.find(
                        (item) => item.id === offer.student_record_id,
                      )?.name ?? "—"}
                    </strong>
                    <span className="ml-2 type-body text-on-surface-variant">
                      {offer.amount.toLocaleString(
                        locale === "vi" ? "vi-VN" : "en-US",
                      )}{" "}
                      VND · {statusLabel(offer.status, t)}
                    </span>
                  </span>
                  {offer.status === "offered" && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() =>
                        run({
                          kind: "offer.cancel",
                          offerId: offer.id,
                          expectedRevision: offer.revision,
                        })
                      }
                    >
                      {t.cancel}
                    </Button>
                  )}
                </div>
              ))}
              {snapshot.invoices.map((invoice) => (
                <div
                  key={invoice.id}
                  className="flex justify-between rounded-2xl border border-border bg-surface p-3 type-body text-on-surface"
                >
                  <span>
                    {t.invoice} · {statusLabel(invoice.status, t)}
                    {invoice.payment_status === "exception" &&
                      ` · ${t.exception}`}
                  </span>
                  {invoice.checkout_url ? (
                    <a
                      className="type-label text-primary underline"
                      href={invoice.checkout_url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {t.openCheckout}
                    </a>
                  ) : invoice.status === "open" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() =>
                        run({ kind: "invoice.checkout", invoiceId: invoice.id })
                      }
                    >
                      {t.checkout}
                    </Button>
                  ) : null}
                </div>
              ))}
            </div>
          </TabsContent>
        )}
        <TabsContent value="materials" className="space-y-2 pt-4">
          {snapshot.drafts.map((draft) => (
            <div
              key={draft.id}
              className="rounded-2xl border border-border bg-surface p-3"
            >
              <h3 className="type-title text-on-surface">{draft.title}</h3>
              <p className="mt-1 break-words type-body text-on-surface-variant">
                {draft.body}
              </p>
            </div>
          ))}
          {!snapshot.drafts.length && (
            <p className="py-8 text-center type-body text-muted-foreground">
              {t.empty}
            </p>
          )}
        </TabsContent>
        <TabsContent value="integrations" className="space-y-3 pt-4">
          <CenterIntegrations
            existingCalendarsEnabled={existingCalendarsEnabled}
            clubId={clubId}
            snapshot={snapshot}
            locale={locale}
            onRefresh={refresh}
          />
          {initial.canManageFinance && (
            <CenterSheetReview clubId={clubId} locale={locale} />
          )}
          <h2 className="pt-2 type-heading-md text-on-surface">{t.jobs}</h2>
          {snapshot.events.map((event) => (
            <p
              key={event.id}
              className="break-words type-caption text-on-surface-variant"
            >
              {event.kind} · {statusLabel(event.status, t)}{" "}
              {event.last_error ?? ""}
            </p>
          ))}
        </TabsContent>
        <TabsContent
          value="assistant"
          className="grid min-w-0 items-start gap-4 pt-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]"
        >
          <section className="min-w-0 space-y-3 rounded-2xl border border-border bg-surface p-3">
            <h2 className="type-heading-md text-on-surface">{t.assistant}</h2>
            {!assistant && !history?.messages.length && (
              <div className="space-y-3">
                <p className="type-body text-on-surface-variant">
                  {locale === "vi"
                    ? "Tra cứu lớp học, ghi nhận học viên hoặc soạn nội dung giảng dạy. Bạn sẽ xem và xác nhận trước khi thay đổi lịch, học phí hay gửi tin nhắn."
                    : "Look up class context, record student notes, or draft teaching materials. Review and confirm changes to schedules, tuition, or outgoing messages."}
                </p>
                <div className="flex flex-wrap gap-2">
                  {(locale === "vi"
                    ? [
                        "Tóm tắt các buổi học thử sắp tới",
                        "Giúp tôi soạn bài tập cho một lớp",
                        "Tôi muốn ghi nhận xét cho học viên",
                      ]
                    : [
                        "Summarize upcoming trial sessions",
                        "Help me draft homework for a class",
                        "I want to record a student note",
                      ]
                  ).map((prompt) => (
                    <Button
                      key={prompt}
                      variant="outline"
                      size="sm"
                      className="h-auto min-h-9 whitespace-normal px-3 py-2 text-left"
                      onClick={() => setQuestion(prompt)}
                    >
                      {prompt}
                    </Button>
                  ))}
                </div>
              </div>
            )}
            {history?.messages
              .filter(
                (message) =>
                  !(
                    assistant &&
                    message.role === "assistant" &&
                    message.body === assistant.answer
                  ),
              )
              .map((message) => (
                <p
                  key={message.id}
                  className="whitespace-pre-wrap break-words type-body text-on-surface"
                >
                  <strong>
                    {message.role === "assistant"
                      ? t.assistant
                      : locale === "vi"
                        ? "Bạn"
                        : "You"}
                    :{" "}
                  </strong>
                  {message.body}
                </p>
              ))}
            {assistant && (
              <>
                <p className="whitespace-pre-wrap break-words type-body text-on-surface">
                  {assistant.answer}
                </p>
                <div>
                  <h3 className="type-label text-on-surface">{t.sources}</h3>
                  {assistant.sources.map((source) => (
                    <details
                      key={source.id}
                      className="rounded-control border border-border p-2"
                    >
                      <summary className="type-label text-primary">
                        {source.label}
                      </summary>
                      <p className="mt-1 whitespace-pre-wrap break-words type-body text-on-surface-variant">
                        {source.text ?? sourceText(source.id, snapshot)}
                      </p>
                    </details>
                  ))}
                </div>
              </>
            )}
            <Button
              variant="ghost"
              onClick={() => {
                setAssistant(null);
                setHistory(null);
                window.localStorage.removeItem(
                  `center-teacher:${clubId}:${initial.actorId}`,
                );
              }}
            >
              {locale === "vi" ? "Cuộc trò chuyện mới" : "New conversation"}
            </Button>
            <form
              className="flex min-w-0 items-end gap-2"
              onSubmit={async (event) => {
                event.preventDefault();
                if (!question.trim() || busy) return;
                if (chatKey.current?.fingerprint !== question)
                  chatKey.current = {
                    key: crypto.randomUUID(),
                    fingerprint: question,
                  };
                setBusy(true);
                setError("");
                const result = await sendCenterTeacherMessage(
                  clubId,
                  question,
                  assistant?.conversationId ?? history?.conversationId,
                  chatKey.current.key,
                );
                if (result.ok) {
                  chatKey.current = null;
                  setAssistant(result.data);
                  const savedHistory = await loadCenterTeacherHistory(
                    clubId,
                    result.data.conversationId,
                  );
                  if (savedHistory.ok) setHistory(savedHistory.data);
                  window.localStorage.setItem(
                    `center-teacher:${clubId}:${initial.actorId}`,
                    result.data.conversationId,
                  );
                  setQuestion("");
                  await refresh();
                } else setError(result.error);
                setBusy(false);
              }}
            >
              <textarea
                aria-label={t.ask}
                rows={3}
                maxLength={4000}
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                placeholder={t.ask}
                className="min-w-0 w-full rounded-control border border-outline-variant bg-surface p-3 type-body text-on-surface focus-visible:outline-primary"
              />
              <Button type="submit" disabled={busy || !question.trim()}>
                {t.send}
              </Button>
            </form>
          </section>
          <div className="space-y-3">
            {[
              ...new Map(
                [
                  ...(history?.proposals ?? []),
                  ...(assistant?.proposals ?? []),
                ].map((p) => [p.id, p]),
              ).values(),
            ].map((proposal) => (
              <Proposal
                key={proposal.id}
                proposal={proposal}
                copy={t}
                snapshot={snapshot}
                clubId={clubId}
                onDone={refresh}
              />
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </main>
  );
}

function Proposal({
  proposal,
  copy,
  snapshot,
  clubId,
  onDone,
}: {
  proposal: TeacherProposal;
  copy: typeof centerCopy.en;
  snapshot: CenterSnapshot;
  clubId: string;
  onDone: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState(proposal.status);
  const decide = async (decision: "confirm" | "cancel") => {
    setBusy(true);
    setError("");
    const result = await decideCenterTeacherProposal(
      clubId,
      proposal.id,
      decision,
    );
    if (!result.ok) setError(result.error);
    else {
      setStatus(decision === "confirm" ? "executed" : "cancelled");
      await onDone();
    }
    setBusy(false);
  };
  return (
    <section className="min-w-0 rounded-2xl border border-border bg-surface p-3">
      <h3 className="type-title text-on-surface">
        {copy.proposal} · {proposalOperationLabel(proposal.kind, copy)} ·{" "}
        {statusLabel(status, copy)}
      </h3>
      <p className="type-caption text-on-surface-variant">
        {proposalTarget(proposal, snapshot, copy)}
      </p>
      <dl className="mt-2 space-y-1">
        {Object.entries(proposal.input).map(([key, value]) => (
          <div
            key={key}
            className="grid grid-cols-[auto_minmax(0,1fr)] gap-2 type-body"
          >
            <dt className="text-on-surface-variant">
              {proposalFieldLabel(key, copy)}
            </dt>
            <dd className="break-words text-on-surface">
              {formatProposalValue(value, key, copy, snapshot)}
            </dd>
          </div>
        ))}
      </dl>
      {error && <p className="mt-2 type-caption text-error">{error}</p>}
      {status === "pending" && proposal.requires_confirmation && (
        <div className="mt-3 flex gap-2">
          <Button onClick={() => decide("confirm")} disabled={busy}>
            {copy.confirm}
          </Button>
          <Button
            variant="outline"
            onClick={() => decide("cancel")}
            disabled={busy}
          >
            {copy.cancelProposal}
          </Button>
        </div>
      )}
    </section>
  );
}

const proposalFieldKeys: Record<string, keyof typeof centerCopy.en> = {
  studentRecordId: "name",
  classId: "class",
  trialId: "trial",
  priorTrialId: "trial",
  admissionId: "admission",
  scheduleId: "schedule",
  startAt: "start",
  endAt: "end",
  amount: "amount",
  startDate: "offerStart",
  endDate: "offerEnd",
  title: "proposalTitle",
  body: "body",
  draftType: "draftType",
  templateKey: "templateKey",
  assessment: "assessment",
  expectedRevision: "revision",
  expectedUpdatedAt: "updatedAt",
};

const proposalEnumKeys: Record<string, keyof typeof centerCopy.en> = {
  homework: "draftTypeHomework",
  lesson: "draftTypeLesson",
  report: "draftTypeReport",
  announcement: "draftTypeAnnouncement",
  trial_confirmation: "templateTrialConfirmation",
  trial_reminder: "templateTrialReminder",
  class_rescheduled: "templateClassRescheduled",
  progress_summary: "templateProgressSummary",
  renewal_reminder: "templateRenewalReminder",
};

function proposalOperationLabel(
  kind: string,
  copy: typeof centerCopy.en,
): string {
  const labels: Record<string, keyof typeof centerCopy.en> = {
    "trial.book": "bookTrial",
    "trial.rebook": "rebook",
    "trial.evaluate": "evaluate",
    "admission.stage": "stage",
    "offer.create": "offer",
    "schedule.reschedule": "reschedule",
    "message.send": "send",
    "draft.create": "draft",
    "note.create": "addNote",
  };
  return labels[kind] ? copy[labels[kind]] : copy.proposal;
}

function proposalFieldLabel(key: string, copy: typeof centerCopy.en): string {
  const copyKey = proposalFieldKeys[key];
  return copyKey ? copy[copyKey] : (copy[key] ?? key.replaceAll("_", " "));
}

function formatProposalValue(
  value: unknown,
  key: string,
  copy: typeof centerCopy.en,
  snapshot: CenterSnapshot,
): string {
  const locale = copy === centerCopy.vi ? "vi-VN" : "en-GB";
  if (Array.isArray(value))
    return value
      .map((item) => formatProposalValue(item, key, copy, snapshot))
      .join(", ");
  if (value && typeof value === "object")
    return Object.entries(value)
      .map(
        ([childKey, childValue]) =>
          `${proposalFieldLabel(childKey, copy)}: ${formatProposalValue(childValue, childKey, copy, snapshot)}`,
      )
      .join(", ");
  if (typeof value === "number") return value.toLocaleString(locale);
  if (typeof value !== "string") return String(value);
  const targetName =
    snapshot.students.find((item) => item.id === value)?.name ??
    snapshot.classes.find((item) => item.id === value)?.name;
  if (targetName) return targetName;
  if (key === "trialId") {
    const trial = snapshot.trials.find((item) => item.id === value);
    if (trial)
      return `${snapshot.students.find((item) => item.id === trial.student_record_id)?.name ?? copy.trial} · ${formatProposalValue(trial.starts_at, "startAt", copy, snapshot)}`;
  }
  if (key === "priorTrialId") {
    const trial = snapshot.trials.find((item) => item.id === value);
    if (trial)
      return `${copy.trial} · ${snapshot.students.find((item) => item.id === trial.student_record_id)?.name ?? "—"} · ${classNameForProposal(trial.class_id, snapshot)} · ${formatProposalValue(trial.starts_at, "startAt", copy, snapshot)}`;
  }
  if (key === "admissionId") {
    const admission = snapshot.admissions.find((item) => item.id === value);
    if (admission)
      return (
        snapshot.students.find(
          (item) => item.id === admission.student_record_id,
        )?.name ?? copy.admission
      );
  }
  if (key === "scheduleId") {
    const schedule = snapshot.schedules.find((item) => item.id === value);
    if (schedule)
      return `${schedule.title} · ${formatProposalValue(schedule.starts_at, "startAt", copy, snapshot)}`;
  }
  if (key === "stage") return copy[value] ?? value;
  const enumKey =
    key === "draftType" || key === "templateKey"
      ? proposalEnumKeys[value]
      : undefined;
  if (enumKey) return copy[enumKey];
  if (key === "startAt" || key === "endAt" || key === "expectedUpdatedAt") {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime()))
      return new Intl.DateTimeFormat(locale, {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Ho_Chi_Minh",
      }).format(date);
  }
  return value;
}

function sourceText(id: string, snapshot: CenterSnapshot): string {
  const [kind, value] = id.split(":");
  if (kind === "note")
    return snapshot.notes.find((item) => item.id === value)?.body ?? "—";
  if (kind === "draft") {
    const item = snapshot.drafts.find((draft) => draft.id === value);
    return item ? `${item.title}: ${item.body}` : "—";
  }
  if (kind === "trial") {
    const item = snapshot.trials.find((trial) => trial.id === value);
    return item?.assessment ? JSON.stringify(item.assessment) : "—";
  }
  return "—";
}
function proposalTarget(
  proposal: TeacherProposal,
  snapshot: CenterSnapshot,
  copy: typeof centerCopy.en,
): string {
  const input = proposal.input;
  const student =
    typeof input.studentRecordId === "string"
      ? snapshot.students.find((item) => item.id === input.studentRecordId)
          ?.name
      : undefined;
  const priorTrial =
    typeof input.priorTrialId === "string"
      ? snapshot.trials.find((item) => item.id === input.priorTrialId)
      : undefined;
  const cls =
    typeof input.classId === "string"
      ? snapshot.classes.find((item) => item.id === input.classId)?.name
      : undefined;
  return (
    [
      student ??
        (priorTrial
          ? snapshot.students.find(
              (item) => item.id === priorTrial.student_record_id,
            )?.name
          : undefined),
      cls ??
        (priorTrial
          ? classNameForProposal(priorTrial.class_id, snapshot)
          : undefined),
    ]
      .filter(Boolean)
      .join(" · ") || (priorTrial ? `${copy.trial} ${priorTrial.id}` : "")
  );
}
function classNameForProposal(id: string, snapshot: CenterSnapshot) {
  return snapshot.classes.find((item) => item.id === id)?.name ?? "—";
}
function statusLabel(value: string, copy: typeof centerCopy.en): string {
  const labels: Record<string, string> = {
    offered: copy.offered,
    open: copy.open,
    paid: copy.paid,
    connected: copy.connected,
    pending: copy.pendingStatus,
    executed: copy.executed,
    cancelled: copy.cancelledStatus,
  };
  return labels[value] ?? copy[value] ?? value;
}
