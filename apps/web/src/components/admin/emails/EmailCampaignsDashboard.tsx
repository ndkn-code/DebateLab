"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import { AnimatedNumber } from "@/components/motion";
import { Bar, BarChart, Grid } from "@/components/charts";
import {
  CampaignEmailTemplateEditor,
  type TemplateCopy,
} from "@/components/admin/emails/EmailTemplateEditor";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { CalendarDays, CheckCircle2, Loader2, Mail, Send, Users } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import type { EmailAudienceSegment } from "@/lib/email/campaigns-model";
import type { EmailLocale, EmailTemplateKey } from "@/lib/email/types";

interface Campaign {
  id: string;
  name: string;
  templateKey: EmailTemplateKey;
  subject: string | null;
  body: Record<string, unknown>;
  locale: EmailLocale;
  audience: EmailAudienceSegment;
  status: "draft" | "scheduled" | "sending" | "sent" | "canceled";
  scheduledFor: string | null;
  sentCount: number;
  createdAt: string;
  updatedAt: string;
}

interface Results {
  total: number;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  failed: number;
  suppressed: number;
  deliveryRate: number;
  openRate: number;
  clickRate: number;
}

interface TemplatePayload {
  templates: Array<{
    templateKey: EmailTemplateKey;
    locales: Record<EmailLocale, { effectiveCopy: TemplateCopy }>;
  }>;
}

interface Options {
  clubs: Array<{ id: string; name: string }>;
  plans: string[];
}

const TEMPLATE_KEYS: EmailTemplateKey[] = [
  "welcome", "onboarding_nudge", "practice_reminder", "streak_rescue", "winback",
  "weekly_progress", "achievement", "course_nudge", "club_invitation",
];

const EMPTY_COPY: TemplateCopy = {
  subject: "", preheader: "", headline: "", body: "", cta_label: "",
  badge_label: "", stat1_label: "", stat2_label: "", stat3_label: "",
};

const EMPTY_RESULTS: Results = {
  total: 0, sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0,
  failed: 0, suppressed: 0, deliveryRate: 0, openRate: 0, clickRate: 0,
};

const inputClass = "h-11 w-full rounded-xl border border-input bg-surface-container-lowest px-3 text-sm text-on-surface outline-none focus:border-ring focus:ring-3 focus:ring-ring/40";

function getCopy(campaign: Campaign, templates: TemplatePayload | null) {
  const defaults = templates?.templates.find((item) => item.templateKey === campaign.templateKey)
    ?.locales[campaign.locale].effectiveCopy ?? EMPTY_COPY;
  return { ...defaults, ...campaign.body, subject: campaign.subject || defaults.subject } as TemplateCopy;
}

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function EmailCampaignsDashboard() {
  const t = useTranslations("admin.emailCampaigns");
  const reduceMotion = useReducedMotion();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [options, setOptions] = useState<Options>({ clubs: [], plans: [] });
  const [templates, setTemplates] = useState<TemplatePayload | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [templateKey, setTemplateKey] = useState<EmailTemplateKey>("welcome");
  const [locale, setLocale] = useState<EmailLocale>("en");
  const [audience, setAudience] = useState<EmailAudienceSegment>({ type: "admin_test" });
  const [copy, setCopy] = useState<TemplateCopy>(EMPTY_COPY);
  const [recipientCount, setRecipientCount] = useState<number | null>(null);
  const [scheduleAt, setScheduleAt] = useState("");
  const [confirmationName, setConfirmationName] = useState("");
  const [results, setResults] = useState<Results>(EMPTY_RESULTS);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selected = campaigns.find((campaign) => campaign.id === selectedId) ?? null;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [campaignResponse, templateResponse] = await Promise.all([
        fetch("/api/admin/emails/campaigns", { cache: "no-store" }),
        fetch("/api/admin/emails/templates", { cache: "no-store" }),
      ]);
      const campaignData = await campaignResponse.json();
      const templateData = await templateResponse.json();
      if (!campaignResponse.ok) throw new Error(campaignData.error || t("errors.load"));
      if (!templateResponse.ok) throw new Error(templateData.error || t("errors.load"));
      setCampaigns(campaignData.campaigns);
      setOptions(campaignData.options);
      setTemplates(templateData);
      if (!selectedId) {
        const defaults = templateData.templates.find((item: { templateKey: string }) => item.templateKey === "welcome")?.locales.en.effectiveCopy;
        if (defaults) setCopy(defaults);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("errors.load"));
    } finally {
      setLoading(false);
    }
  }, [selectedId, t]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const timeout = window.setTimeout(async () => {
      try {
        const response = await fetch("/api/admin/emails/campaigns", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "resolve", audience }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        setRecipientCount(data.count);
      } catch {
        setRecipientCount(null);
      }
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [audience]);

  function selectCampaign(campaign: Campaign) {
    setSelectedId(campaign.id);
    setName(campaign.name);
    setTemplateKey(campaign.templateKey);
    setLocale(campaign.locale);
    setAudience(campaign.audience);
    setCopy(getCopy(campaign, templates));
    setScheduleAt(campaign.scheduledFor ? campaign.scheduledFor.slice(0, 16) : "");
    setConfirmationName("");
    setNotice(null);
    setError(null);
    void fetch(`/api/admin/emails/campaigns?id=${campaign.id}`, { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => setResults(data.results ?? EMPTY_RESULTS));
  }

  function createNew() {
    const defaults = templates?.templates.find((item) => item.templateKey === "welcome")?.locales.en.effectiveCopy ?? EMPTY_COPY;
    setSelectedId(null);
    setName("");
    setTemplateKey("welcome");
    setLocale("en");
    setAudience({ type: "admin_test" });
    setCopy(defaults);
    setScheduleAt("");
    setConfirmationName("");
    setResults(EMPTY_RESULTS);
    setNotice(null);
  }

  function applyTemplate(nextKey: EmailTemplateKey, nextLocale = locale) {
    setTemplateKey(nextKey);
    const defaults = templates?.templates.find((item) => item.templateKey === nextKey)?.locales[nextLocale].effectiveCopy;
    if (defaults) setCopy(defaults);
  }

  async function post(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch("/api/admin/emails/campaigns", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || t("errors.action"));
      return data;
    } finally {
      setBusy(false);
    }
  }

  async function saveDraft() {
    try {
      const { subject, ...body } = copy;
      const data = await post({
        action: "save",
        campaign: { id: selected?.status === "draft" ? selected.id : undefined, name, templateKey, locale, audience, subject, body, variables: {} },
      });
      setSelectedId(data.campaign.id);
      setCampaigns((current) => [data.campaign, ...current.filter((item) => item.id !== data.campaign.id)]);
      setNotice(t("notices.saved"));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("errors.action"));
    }
  }

  async function schedule() {
    if (!selectedId) return setError(t("errors.saveFirst"));
    try {
      await post({ action: "schedule", id: selectedId, at: new Date(scheduleAt).toISOString(), confirmationName });
      setNotice(t("notices.scheduled"));
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("errors.action"));
    }
  }

  async function sendNow() {
    if (!selectedId || !selected) return setError(t("errors.saveFirst"));
    try {
      const data = await post({ action: "send", id: selectedId, confirmationName });
      setResults(data.results);
      setNotice(data.completed ? t("notices.sent") : t("notices.processing"));
      setConfirmationName("");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("errors.action"));
    }
  }

  async function cancel() {
    if (!selectedId) return;
    try {
      await post({ action: "cancel", id: selectedId });
      setNotice(t("notices.canceled"));
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("errors.action"));
    }
  }

  const chartData = useMemo(() => [
    { stage: t("results.sent"), value: results.sent },
    { stage: t("results.delivered"), value: results.delivered },
    { stage: t("results.opened"), value: results.opened },
    { stage: t("results.clicked"), value: results.clicked },
  ], [results, t]);

  if (loading && campaigns.length === 0) {
    return <div className="flex min-h-80 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="grid min-w-0 grid-cols-1 gap-5 xl:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="min-w-0 rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-3 shadow-token-card">
        <Button className="w-full" onClick={createNew}>{t("new")}</Button>
        <div className="mt-3 space-y-2">
          {campaigns.length === 0 ? <p className="p-3 text-sm text-on-surface-variant">{t("empty")}</p> : campaigns.map((campaign) => (
            <button key={campaign.id} type="button" onClick={() => selectCampaign(campaign)} className={cn(
              "w-full rounded-xl border p-3 text-left transition-colors",
              campaign.id === selectedId ? "border-primary/40 bg-primary-container/50" : "border-outline-variant/30 hover:bg-surface-container-low",
            )}>
              <span className="block truncate text-sm font-bold text-on-surface">{campaign.name}</span>
              <span className="mt-2 flex items-center justify-between gap-2 text-xs text-on-surface-variant">
                <span className="capitalize">{campaign.status}</span><span>{campaign.sentCount.toLocaleString()}</span>
              </span>
            </button>
          ))}
        </div>
      </aside>

      <motion.div initial={reduceMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="min-w-0 space-y-5">
        <section className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-4 shadow-token-card sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-extrabold text-on-surface">{selected ? t("edit") : t("compose")}</h2>
            {selected ? <span className="rounded-full bg-surface-container px-3 py-1 text-xs font-bold capitalize text-on-surface-variant">{selected.status}</span> : null}
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="sm:col-span-2"><span className="mb-1 block text-xs font-bold text-on-surface-variant">{t("fields.name")}</span><input className={inputClass} value={name} onChange={(event) => setName(event.target.value)} /></label>
            <label><span className="mb-1 block text-xs font-bold text-on-surface-variant">{t("fields.template")}</span><Select value={templateKey} onChange={(event) => applyTemplate(event.target.value as EmailTemplateKey)} disabled={Boolean(selected && selected.status !== "draft")}>{TEMPLATE_KEYS.map((key) => <option key={key} value={key}>{key.replaceAll("_", " ")}</option>)}</Select></label>
            <label><span className="mb-1 block text-xs font-bold text-on-surface-variant">{t("fields.locale")}</span><Select value={locale} onChange={(event) => { const next = event.target.value as EmailLocale; setLocale(next); applyTemplate(templateKey, next); }} disabled={Boolean(selected && selected.status !== "draft")}><option value="en">English</option><option value="vi">Tiếng Việt</option></Select></label>
          </div>

          <div className="mt-5"><CampaignEmailTemplateEditor value={copy} onChange={setCopy} /></div>

          <div className="mt-6 rounded-xl border border-outline-variant/40 bg-surface-container-low p-4">
            <div className="flex items-center justify-between gap-3"><h3 className="font-bold text-on-surface">{t("audience.title")}</h3><span className="inline-flex items-center gap-2 rounded-full bg-surface-container-lowest px-3 py-1 text-sm font-bold text-primary"><Users className="h-4 w-4" />{recipientCount == null ? "—" : recipientCount.toLocaleString()}</span></div>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Select aria-label={t("audience.title")} value={audience.type} disabled={Boolean(selected && selected.status !== "draft")} onChange={(event) => {
                const type = event.target.value;
                if (type === "by_plan") setAudience({ type, plan: options.plans[0] ?? "free" });
                else if (type === "by_locale") setAudience({ type, locale: "en" });
                else if (type === "by_club") setAudience({ type, clubId: options.clubs[0]?.id ?? "00000000-0000-0000-0000-000000000000" });
                else setAudience({ type } as EmailAudienceSegment);
              }}>
                <option value="admin_test">{t("audience.adminTest")}</option><option value="all">{t("audience.all")}</option><option value="by_plan">{t("audience.plan")}</option><option value="by_locale">{t("audience.locale")}</option><option value="by_club">{t("audience.club")}</option><option value="referrers">{t("audience.referrers")}</option>
              </Select>
              {audience.type === "by_plan" ? <Select aria-label={t("audience.plan")} value={audience.plan} onChange={(event) => setAudience({ type: "by_plan", plan: event.target.value })}>{options.plans.map((plan) => <option key={plan}>{plan}</option>)}</Select> : null}
              {audience.type === "by_locale" ? <Select aria-label={t("audience.locale")} value={audience.locale} onChange={(event) => setAudience({ type: "by_locale", locale: event.target.value as EmailLocale })}><option value="en">English</option><option value="vi">Tiếng Việt</option></Select> : null}
              {audience.type === "by_club" ? <Select aria-label={t("audience.club")} value={audience.clubId} onChange={(event) => setAudience({ type: "by_club", clubId: event.target.value })}>{options.clubs.map((club) => <option key={club.id} value={club.id}>{club.name}</option>)}</Select> : null}
            </div>
          </div>

          {error ? <div className="mt-4 rounded-xl bg-error-container p-3 text-sm font-semibold text-error-dim">{error}</div> : null}
          {notice ? <div className="mt-4 rounded-xl bg-secondary-container p-3 text-sm font-semibold text-secondary-dim">{notice}</div> : null}

          <div className="mt-5 flex flex-wrap gap-3"><Button onClick={() => void saveDraft()} disabled={busy || Boolean(selected && selected.status !== "draft")}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}{t("actions.save")}</Button></div>

          {selected?.status === "draft" ? <div className="mt-6 grid grid-cols-1 gap-4 border-t border-outline-variant/40 pt-5 lg:grid-cols-2">
            <div className="rounded-xl bg-surface-container-low p-4"><h3 className="font-bold text-on-surface">{t("schedule.title")}</h3><input aria-label={t("schedule.title")} type="datetime-local" className={cn(inputClass, "mt-3")} value={scheduleAt} onChange={(event) => setScheduleAt(event.target.value)} /><input aria-label={t("schedule.confirm")} className={cn(inputClass, "mt-3")} placeholder={selected.name} value={confirmationName} onChange={(event) => setConfirmationName(event.target.value)} /><Button variant="secondary" className="mt-3 w-full" disabled={busy || !scheduleAt || confirmationName !== selected.name} onClick={() => void schedule()}><CalendarDays className="h-4 w-4" />{t("actions.schedule")}</Button></div>
            <div className="rounded-xl border border-error/20 bg-error-container/40 p-4"><h3 className="font-bold text-on-surface">{t("send.title")}</h3><input aria-label={t("send.confirm")} className={cn(inputClass, "mt-3")} placeholder={selected.name} value={confirmationName} onChange={(event) => setConfirmationName(event.target.value)} /><Button variant="destructive" className="mt-3 w-full" disabled={busy || confirmationName !== selected.name} onClick={() => void sendNow()}><Send className="h-4 w-4" />{t("actions.send")}</Button></div>
          </div> : selected && ["scheduled", "sending"].includes(selected.status) ? <div className="mt-6 border-t border-outline-variant/40 pt-5"><Button variant="destructive" disabled={busy} onClick={() => void cancel()}>{t("actions.cancel")}</Button></div> : null}
        </section>

        {selected && selected.status !== "draft" ? <section className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-4 shadow-token-card sm:p-6"><div className="flex items-center justify-between"><h2 className="text-xl font-extrabold text-on-surface">{t("results.title")}</h2><CheckCircle2 className="h-5 w-5 text-secondary" /></div><div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">{[[t("results.sent"), results.sent], [t("results.delivered"), results.delivered], [t("results.opened"), results.opened], [t("results.clicked"), results.clicked]].map(([label, value]) => <div key={String(label)} className="rounded-xl bg-surface-container-low p-4"><span className="text-xs font-bold text-on-surface-variant">{label}</span><AnimatedNumber value={Number(value)} startOnMount className="mt-2 block text-2xl font-extrabold text-on-surface" /></div>)}</div><div className="mt-5 h-64"><BarChart data={chartData} xDataKey="stage" aspectRatio="2 / 1"><Grid horizontal /><Bar dataKey="value" fill="var(--chart-line-primary)" lineCap="round" minBarHeight={4} /></BarChart></div><div className="mt-4 flex flex-wrap gap-4 text-sm font-semibold text-on-surface-variant"><span>{t("results.deliveryRate")}: {results.deliveryRate}%</span><span>{t("results.openRate")}: {results.openRate}%</span><span>{t("results.clickRate")}: {results.clickRate}%</span><span>{t("results.risk")}: {results.bounced + results.failed + results.suppressed}</span></div><p className="mt-4 text-xs text-muted-foreground">{formatDate(selected.scheduledFor ?? selected.updatedAt)}</p></section> : null}
      </motion.div>
    </div>
  );
}
