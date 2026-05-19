"use client";

import { useMemo, useState, useTransition } from "react";
import {
  BarChart3,
  CheckCircle2,
  Clock3,
  Edit3,
  Eye,
  Gift,
  Megaphone,
  MessageSquareText,
  Pause,
  Plus,
  RefreshCw,
  Send,
  ShieldCheck,
  Trash2,
} from "@/components/ui/icons";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { FeedbackPopupAdminData } from "@/lib/smart-popups/admin";
import type {
  SmartPopupSurveyQuestion,
  SmartPopupSurveyQuestionType,
} from "@/lib/smart-popups/survey";

type AdminTab = "campaigns" | "builder" | "responses" | "analytics" | "health";

interface Props {
  initialData: FeedbackPopupAdminData;
}

const DEFAULT_QUESTIONS: SmartPopupSurveyQuestion[] = [
  {
    id: "overall_rating",
    type: "rating",
    required: true,
    min: 1,
    max: 5,
    label: {
      en: "Overall, how useful is DebateLab for your practice?",
      vi: "Nhìn chung, DebateLab hữu ích thế nào cho việc luyện tập của bạn?",
    },
    minLabel: { en: "Not useful", vi: "Chưa hữu ích" },
    maxLabel: { en: "Very useful", vi: "Rất hữu ích" },
  },
  {
    id: "feature_focus",
    type: "single_choice",
    required: true,
    label: {
      en: "Which part should we improve first?",
      vi: "Tụi mình nên cải thiện phần nào trước?",
    },
    options: [
      { id: "practice", label: { en: "Practice flow", vi: "Luồng luyện tập" } },
      { id: "feedback", label: { en: "AI feedback", vi: "Feedback AI" } },
      { id: "voice", label: { en: "Speech and voice", vi: "Giọng nói và nhận diện" } },
      { id: "navigation", label: { en: "Navigation", vi: "Điều hướng" } },
    ],
  },
  {
    id: "open_feedback",
    type: "text",
    required: false,
    label: {
      en: "What would make DebateLab better for you?",
      vi: "Điều gì sẽ làm DebateLab tốt hơn cho bạn?",
    },
    placeholder: {
      en: "Share anything confusing, helpful, missing, or exciting.",
      vi: "Chia sẻ điều gì khó hiểu, hữu ích, còn thiếu, hoặc làm bạn thích.",
    },
  },
];

function formatDate(value: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function makeQuestion(type: SmartPopupSurveyQuestionType): SmartPopupSurveyQuestion {
  const suffix = Date.now().toString(36).slice(-5);
  const base = {
    id: `question-${suffix}`,
    type,
    required: true,
    label: { en: "New question", vi: "Câu hỏi mới" },
  } satisfies SmartPopupSurveyQuestion;

  if (type === "single_choice" || type === "multi_choice") {
    return {
      ...base,
      options: [
        { id: `option-a-${suffix}`, label: { en: "Option A", vi: "Lựa chọn A" } },
        { id: `option-b-${suffix}`, label: { en: "Option B", vi: "Lựa chọn B" } },
      ],
    };
  }

  if (type === "rating" || type === "nps") {
    return {
      ...base,
      min: type === "nps" ? 0 : 1,
      max: type === "nps" ? 10 : 5,
      minLabel: { en: "Low", vi: "Thấp" },
      maxLabel: { en: "High", vi: "Cao" },
    };
  }

  return {
    ...base,
    placeholder: { en: "Type your feedback...", vi: "Nhập góp ý của bạn..." },
  };
}

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === "active"
      ? "bg-[#E8F8EE] text-[#16833A]"
      : status === "archived"
        ? "bg-[#F3F4F6] text-[#64748B]"
        : "bg-[#FFF7DF] text-[#9A6A08]";
  return (
    <span className={cn("inline-flex rounded-full px-2.5 py-1 text-xs font-bold", cls)}>
      {status}
    </span>
  );
}

function AnswerPreview({ value }: { value: unknown }) {
  if (Array.isArray(value)) return <>{value.join(", ")}</>;
  if (typeof value === "string" || typeof value === "number") return <>{value}</>;
  return <>-</>;
}

export function FeedbackPopupsDashboard({ initialData }: Props) {
  const [data, setData] = useState(initialData);
  const [activeTab, setActiveTab] = useState<AdminTab>("campaigns");
  const [isPending, startTransition] = useTransition();
  const [notice, setNotice] = useState<string | null>(null);
  const [form, setForm] = useState({
    campaignKey: "",
    titleEn: "How is DebateLab feeling so far?",
    bodyEn: "Answer a few quick questions so we can improve the app for your next practice.",
    titleVi: "Bạn thấy DebateLab thế nào?",
    bodyVi: "Trả lời vài câu ngắn để tụi mình cải thiện trải nghiệm luyện tập tiếp theo.",
    responseGoal: 100,
  });
  const [questions, setQuestions] = useState<SmartPopupSurveyQuestion[]>(DEFAULT_QUESTIONS);

  const latestResponses = data.responses.slice(0, 8);
  const ratingBuckets = useMemo(() => {
    const buckets = new Map<number, number>();
    for (const response of data.responses) {
      for (const answer of response.answers) {
        if ((answer.type === "rating" || answer.type === "nps") && typeof answer.value === "number") {
          buckets.set(answer.value, (buckets.get(answer.value) ?? 0) + 1);
        }
      }
    }
    return Array.from(buckets.entries()).sort((a, b) => a[0] - b[0]);
  }, [data.responses]);

  async function refresh() {
    const res = await fetch("/api/admin/feedback-popups", { cache: "no-store" });
    if (!res.ok) throw new Error("Unable to refresh feedback popups.");
    setData((await res.json()) as FeedbackPopupAdminData);
  }

  function mutate(body: Record<string, unknown>, successMessage: string) {
    setNotice(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/admin/feedback-popups", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const payload = (await res.json()) as { error?: string; data?: FeedbackPopupAdminData };
        if (!res.ok) throw new Error(payload.error ?? "Action failed.");
        if (payload.data) setData(payload.data);
        setNotice(successMessage);
        if (body.action === "save") setActiveTab("campaigns");
      } catch (error) {
        setNotice(error instanceof Error ? error.message : "Action failed.");
      }
    });
  }

  function updateQuestion(
    index: number,
    updater: (question: SmartPopupSurveyQuestion) => SmartPopupSurveyQuestion
  ) {
    setQuestions((current) =>
      current.map((question, currentIndex) =>
        currentIndex === index ? updater(question) : question
      )
    );
  }

  function saveCampaign(status: "active" | "paused" = "paused") {
    mutate(
      {
        action: "save",
        ...form,
        campaignKey: form.campaignKey || undefined,
        status,
        deliveryMode: "targeted",
        priority: 25,
        questions,
        rules: {
          maxSubmissionsPerUser: 1,
        },
      },
      status === "active" ? "Feedback popup published." : "Feedback popup draft saved."
    );
  }

  return (
    <div className="mx-auto max-w-7xl min-w-0 space-y-5 px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-[#EDF4FF] px-3 py-1 text-xs font-bold text-[#3E78EC]">
            <MessageSquareText className="h-3.5 w-3.5" />
            In-app intercepts
          </div>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-[#0B1424]">
            Feedback Popups
          </h1>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-[#415069]">
            Create localized feedback prompts, send them at the next safe in-app moment, and review the responses that shape the product.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-10 rounded-lg border-[#DEE8F8] bg-white text-[#415069]"
            onClick={() => {
              startTransition(async () => {
                await refresh();
                setNotice("Feedback popup data refreshed.");
              });
            }}
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
          <Button
            type="button"
            className="h-10 rounded-lg"
            onClick={() => setActiveTab("builder")}
          >
            <Plus className="h-4 w-4" />
            New feedback
          </Button>
        </div>
      </div>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {data.kpis.map((kpi) => (
          <div
            key={kpi.key}
            className="rounded-lg border border-[#DEE8F8] bg-white p-4 shadow-[0_16px_34px_-30px_rgba(11,20,36,0.35)]"
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-[#415069]">{kpi.label}</p>
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#EDF4FF] text-[#4D86F7]">
                {kpi.key === "reward" ? <Gift className="h-4 w-4" /> : <BarChart3 className="h-4 w-4" />}
              </span>
            </div>
            <p className="mt-3 text-3xl font-extrabold text-[#0B1424]">{kpi.value}</p>
          </div>
        ))}
      </section>

      {notice ? (
        <div className="rounded-lg border border-[#DEE8F8] bg-[#F7FAFE] px-4 py-3 text-sm font-semibold text-[#415069]">
          {notice}
        </div>
      ) : null}

      <div className="inline-flex max-w-full overflow-x-auto rounded-lg border border-[#DEE8F8] bg-[#F1F6FD] p-1">
        {[
          ["campaigns", "Campaigns", Megaphone],
          ["builder", "Builder", Edit3],
          ["responses", "Responses", MessageSquareText],
          ["analytics", "Analytics", BarChart3],
          ["health", "Cron/Health", ShieldCheck],
        ].map(([key, label, Icon]) => (
          <button
            key={key as string}
            type="button"
            onClick={() => setActiveTab(key as AdminTab)}
            className={cn(
              "inline-flex h-10 items-center gap-2 rounded-md px-4 text-sm font-bold transition-colors",
              activeTab === key
                ? "bg-[#4D86F7] text-white shadow-sm"
                : "text-[#415069] hover:bg-white"
            )}
          >
            <Icon className="h-4 w-4" />
            {label as string}
          </button>
        ))}
      </div>

      {activeTab === "campaigns" ? (
        <section className="overflow-hidden rounded-lg border border-[#DEE8F8] bg-white">
          <div className="grid min-w-[900px] grid-cols-[1.1fr_0.8fr_0.7fr_0.8fr_1fr] gap-4 border-b border-[#DEE8F8] bg-[#F7FAFE] px-5 py-3 text-xs font-bold uppercase tracking-wide text-[#718096]">
            <span>Campaign</span>
            <span>Status</span>
            <span>Responses</span>
            <span>Rating</span>
            <span>Actions</span>
          </div>
          <div className="overflow-x-auto">
            {data.campaigns.length === 0 ? (
              <p className="p-6 text-sm text-[#718096]">No feedback campaigns yet.</p>
            ) : (
              data.campaigns.map((campaign) => (
                <div
                  key={campaign.key}
                  className="grid min-w-[900px] grid-cols-[1.1fr_0.8fr_0.7fr_0.8fr_1fr] gap-4 border-b border-[#DEE8F8]/70 px-5 py-4 text-sm last:border-b-0"
                >
                  <div>
                    <p className="font-bold text-[#0B1424]">{campaign.title}</p>
                    <p className="mt-1 text-xs text-[#718096]">{campaign.key}</p>
                    <p className="mt-1 line-clamp-2 text-xs text-[#415069]">{campaign.body}</p>
                  </div>
                  <div className="space-y-2">
                    <StatusBadge status={campaign.status} />
                    <p className="text-xs text-[#718096]">{campaign.deliveryMode.replace("_", " ")}</p>
                  </div>
                  <div>
                    <p className="text-lg font-extrabold text-[#0B1424]">{campaign.responseCount}</p>
                    <p className="text-xs text-[#718096]">Goal {campaign.responseGoal ?? "-"}</p>
                  </div>
                  <div>
                    <p className="text-lg font-extrabold text-[#0B1424]">{campaign.averageRating ?? "-"}</p>
                    <p className="text-xs text-[#718096]">Last {formatDate(campaign.lastResponseAt)}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      disabled={isPending}
                      onClick={() =>
                        mutate(
                          { action: "send_now", campaignKey: campaign.key },
                          "Campaign is live for next safe page delivery."
                        )
                      }
                    >
                      <Send className="h-3.5 w-3.5" />
                      Send now
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={isPending}
                      onClick={() =>
                        mutate(
                          {
                            action: "set_status",
                            campaignKey: campaign.key,
                            status: campaign.status === "active" ? "paused" : "active",
                          },
                          campaign.status === "active" ? "Campaign paused." : "Campaign activated."
                        )
                      }
                    >
                      {campaign.status === "active" ? <Pause className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                      {campaign.status === "active" ? "Pause" : "Activate"}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={isPending}
                      onClick={() =>
                        mutate(
                          {
                            action: "set_status",
                            campaignKey: campaign.key,
                            status: "archived",
                          },
                          "Campaign archived."
                        )
                      }
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Archive
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      ) : null}

      {activeTab === "builder" ? (
        <section className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
          <div className="space-y-4 rounded-lg border border-[#DEE8F8] bg-white p-5">
            <div>
              <h2 className="text-xl font-extrabold text-[#0B1424]">Template Builder</h2>
              <p className="mt-1 text-sm text-[#415069]">
                Build one localized survey template. Completion always grants 50 Credits.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-sm font-semibold text-[#415069]">
                Campaign key
                <input
                  value={form.campaignKey}
                  onChange={(event) => setForm({ ...form, campaignKey: event.target.value })}
                  placeholder="auto-generated if blank"
                  className="h-11 w-full rounded-lg border border-[#DEE8F8] bg-white px-3 text-sm outline-none focus:border-[#4D86F7]"
                />
              </label>
              <label className="space-y-1 text-sm font-semibold text-[#415069]">
                Response goal
                <input
                  type="number"
                  value={form.responseGoal}
                  onChange={(event) =>
                    setForm({ ...form, responseGoal: Number(event.target.value) || 100 })
                  }
                  className="h-11 w-full rounded-lg border border-[#DEE8F8] bg-white px-3 text-sm outline-none focus:border-[#4D86F7]"
                />
              </label>
              <label className="space-y-1 text-sm font-semibold text-[#415069]">
                English title
                <input
                  value={form.titleEn}
                  onChange={(event) => setForm({ ...form, titleEn: event.target.value })}
                  className="h-11 w-full rounded-lg border border-[#DEE8F8] bg-white px-3 text-sm outline-none focus:border-[#4D86F7]"
                />
              </label>
              <label className="space-y-1 text-sm font-semibold text-[#415069]">
                Vietnamese title
                <input
                  value={form.titleVi}
                  onChange={(event) => setForm({ ...form, titleVi: event.target.value })}
                  className="h-11 w-full rounded-lg border border-[#DEE8F8] bg-white px-3 text-sm outline-none focus:border-[#4D86F7]"
                />
              </label>
              <label className="space-y-1 text-sm font-semibold text-[#415069] sm:col-span-2">
                English body
                <textarea
                  value={form.bodyEn}
                  onChange={(event) => setForm({ ...form, bodyEn: event.target.value })}
                  className="min-h-20 w-full rounded-lg border border-[#DEE8F8] bg-white px-3 py-2 text-sm outline-none focus:border-[#4D86F7]"
                />
              </label>
              <label className="space-y-1 text-sm font-semibold text-[#415069] sm:col-span-2">
                Vietnamese body
                <textarea
                  value={form.bodyVi}
                  onChange={(event) => setForm({ ...form, bodyVi: event.target.value })}
                  className="min-h-20 w-full rounded-lg border border-[#DEE8F8] bg-white px-3 py-2 text-sm outline-none focus:border-[#4D86F7]"
                />
              </label>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-base font-extrabold text-[#0B1424]">Questions</h3>
                <div className="flex flex-wrap gap-2">
                  {(["rating", "nps", "single_choice", "multi_choice", "text"] as SmartPopupSurveyQuestionType[]).map((type) => (
                    <Button
                      key={type}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setQuestions((current) => [...current, makeQuestion(type)])}
                      className="border-[#DEE8F8] bg-white"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      {type.replace("_", " ")}
                    </Button>
                  ))}
                </div>
              </div>

              {questions.map((question, index) => (
                <div key={`${question.id}-${index}`} className="rounded-lg border border-[#DEE8F8] bg-[#F7FAFE] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-bold text-[#4D86F7]">
                      {index + 1}. {question.type.replace("_", " ")}
                    </div>
                    <div className="flex gap-2">
                      <label className="inline-flex items-center gap-2 text-xs font-bold text-[#415069]">
                        <input
                          type="checkbox"
                          checked={question.required}
                          onChange={(event) =>
                            updateQuestion(index, (current) => ({
                              ...current,
                              required: event.target.checked,
                            }))
                          }
                        />
                        Required
                      </label>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => setQuestions((current) => current.filter((_, i) => i !== index))}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Remove
                      </Button>
                    </div>
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <input
                      value={question.label.en}
                      onChange={(event) =>
                        updateQuestion(index, (current) => ({
                          ...current,
                          label: { ...current.label, en: event.target.value },
                        }))
                      }
                      className="h-10 rounded-lg border border-[#DEE8F8] bg-white px-3 text-sm outline-none focus:border-[#4D86F7]"
                    />
                    <input
                      value={question.label.vi}
                      onChange={(event) =>
                        updateQuestion(index, (current) => ({
                          ...current,
                          label: { ...current.label, vi: event.target.value },
                        }))
                      }
                      className="h-10 rounded-lg border border-[#DEE8F8] bg-white px-3 text-sm outline-none focus:border-[#4D86F7]"
                    />
                  </div>
                  {(question.type === "single_choice" || question.type === "multi_choice") ? (
                    <div className="mt-3 grid gap-2">
                      {(question.options ?? []).map((option, optionIndex) => (
                        <div key={option.id} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                          <input
                            value={option.label.en}
                            onChange={(event) =>
                              updateQuestion(index, (current) => ({
                                ...current,
                                options: (current.options ?? []).map((item, i) =>
                                  i === optionIndex
                                    ? { ...item, label: { ...item.label, en: event.target.value } }
                                    : item
                                ),
                              }))
                            }
                            className="h-9 rounded-lg border border-[#DEE8F8] bg-white px-3 text-sm"
                          />
                          <input
                            value={option.label.vi}
                            onChange={(event) =>
                              updateQuestion(index, (current) => ({
                                ...current,
                                options: (current.options ?? []).map((item, i) =>
                                  i === optionIndex
                                    ? { ...item, label: { ...item.label, vi: event.target.value } }
                                    : item
                                ),
                              }))
                            }
                            className="h-9 rounded-lg border border-[#DEE8F8] bg-white px-3 text-sm"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              updateQuestion(index, (current) => ({
                                ...current,
                                options: (current.options ?? []).filter((_, i) => i !== optionIndex),
                              }))
                            }
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-fit border-[#DEE8F8] bg-white"
                        onClick={() =>
                          updateQuestion(index, (current) => ({
                            ...current,
                            options: [
                              ...(current.options ?? []),
                              {
                                id: `option-${Date.now().toString(36)}`,
                                label: { en: "New option", vi: "Lựa chọn mới" },
                              },
                            ],
                          }))
                        }
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Add option
                      </Button>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>

            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="outline" disabled={isPending} onClick={() => saveCampaign("paused")}>
                Save draft
              </Button>
              <Button type="button" disabled={isPending} onClick={() => saveCampaign("active")}>
                <CheckCircle2 className="h-4 w-4" />
                Publish
              </Button>
            </div>
          </div>

          <div className="space-y-4">
            {(["en", "vi"] as const).map((locale) => (
              <div key={locale} className="rounded-lg border border-[#DEE8F8] bg-white p-5 shadow-[0_18px_42px_-34px_rgba(11,20,36,0.35)]">
                <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-[#EDF4FF] px-3 py-1 text-xs font-bold text-[#3E78EC]">
                  <Eye className="h-3.5 w-3.5" />
                  {locale === "en" ? "English preview" : "Vietnamese preview"}
                </div>
                <h3 className="text-xl font-extrabold text-[#0B1424]">
                  {locale === "en" ? form.titleEn : form.titleVi}
                </h3>
                <p className="mt-2 text-sm leading-6 text-[#415069]">
                  {locale === "en" ? form.bodyEn : form.bodyVi}
                </p>
                <div className="mt-4 space-y-3">
                  {questions.map((question, index) => (
                    <div key={`${locale}-${question.id}-${index}`} className="rounded-lg border border-[#DEE8F8] bg-[#F7FAFE] p-3">
                      <p className="text-sm font-bold text-[#0B1424]">
                        {question.label[locale]} {question.required ? "*" : ""}
                      </p>
                      <p className="mt-1 text-xs text-[#718096]">{question.type.replace("_", " ")}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 rounded-lg bg-[#E8F8EE] px-3 py-2 text-sm font-bold text-[#16833A]">
                  Completion reward: 50 Credits
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {activeTab === "responses" ? (
        <section className="rounded-lg border border-[#DEE8F8] bg-white">
          <div className="border-b border-[#DEE8F8] px-5 py-4">
            <h2 className="text-xl font-extrabold text-[#0B1424]">Recent Responses</h2>
          </div>
          {latestResponses.length === 0 ? (
            <p className="p-6 text-sm text-[#718096]">No feedback responses yet.</p>
          ) : (
            <div className="divide-y divide-[#DEE8F8]">
              {latestResponses.map((response) => (
                <div key={response.id} className="p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-bold text-[#0B1424]">{response.campaignKey}</p>
                      <p className="text-xs text-[#718096]">
                        {formatDate(response.submittedAt)} · {response.locale.toUpperCase()} · {response.route ?? "unknown route"}
                      </p>
                    </div>
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#E8F8EE] px-3 py-1 text-xs font-bold text-[#16833A]">
                      <Gift className="h-3.5 w-3.5" />
                      {response.rewardCredits} Credits
                    </span>
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {response.answers.map((answer) => (
                      <div key={answer.questionId} className="rounded-lg bg-[#F7FAFE] p-3 text-sm">
                        <p className="text-xs font-bold uppercase tracking-wide text-[#718096]">{answer.questionId}</p>
                        <p className="mt-1 font-semibold text-[#0B1424]">
                          <AnswerPreview value={answer.value} />
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      ) : null}

      {activeTab === "analytics" ? (
        <section className="grid gap-5 lg:grid-cols-[1fr_0.9fr]">
          <div className="rounded-lg border border-[#DEE8F8] bg-white p-5">
            <h2 className="text-xl font-extrabold text-[#0B1424]">Rating Distribution</h2>
            <div className="mt-5 space-y-3">
              {ratingBuckets.length === 0 ? (
                <p className="text-sm text-[#718096]">No ratings yet.</p>
              ) : (
                ratingBuckets.map(([rating, count]) => {
                  const max = Math.max(...ratingBuckets.map((bucket) => bucket[1]), 1);
                  return (
                    <div key={rating} className="grid grid-cols-[48px_1fr_48px] items-center gap-3 text-sm">
                      <span className="font-bold text-[#0B1424]">{rating}</span>
                      <span className="h-3 overflow-hidden rounded-full bg-[#F1F6FD]">
                        <span className="block h-full rounded-full bg-[#4D86F7]" style={{ width: `${(count / max) * 100}%` }} />
                      </span>
                      <span className="text-right font-bold text-[#415069]">{count}</span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
          <div className="rounded-lg border border-[#DEE8F8] bg-white p-5">
            <h2 className="text-xl font-extrabold text-[#0B1424]">Delivery Model</h2>
            <div className="mt-4 space-y-3 text-sm leading-6 text-[#415069]">
              <p>Send-now campaigns become eligible immediately, then show only at the next safe protected route.</p>
              <p>Feedback popups respect the user smart-popup preference, daily/weekly caps, and per-campaign submission limits.</p>
              <p>Completed submissions grant 50 Credits through an idempotent server-side reward path.</p>
            </div>
          </div>
        </section>
      ) : null}

      {activeTab === "health" ? (
        <section className="rounded-lg border border-[#DEE8F8] bg-white">
          <div className="border-b border-[#DEE8F8] px-5 py-4">
            <h2 className="text-xl font-extrabold text-[#0B1424]">Cron And Health</h2>
            <p className="mt-1 text-sm text-[#415069]">Current Vercel cron refreshes smart-popup user state once daily.</p>
          </div>
          {data.cronRuns.length === 0 ? (
            <p className="p-6 text-sm text-[#718096]">No cron runs recorded yet.</p>
          ) : (
            <div className="divide-y divide-[#DEE8F8]">
              {data.cronRuns.map((run) => (
                <div key={run.id} className="grid gap-3 p-5 text-sm md:grid-cols-[1fr_1fr_1fr_2fr]">
                  <div className="font-bold text-[#0B1424]">
                    <Clock3 className="mr-2 inline h-4 w-4 text-[#4D86F7]" />
                    {formatDate(run.startedAt)}
                  </div>
                  <StatusBadge status={run.status} />
                  <div className="text-[#415069]">{run.processedUsers} users</div>
                  <div className="text-[#718096]">{run.errorMessage ?? `${run.generatedOpportunities} opportunities`}</div>
                </div>
              ))}
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}
