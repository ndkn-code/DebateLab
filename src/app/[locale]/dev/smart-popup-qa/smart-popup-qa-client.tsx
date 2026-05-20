"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";
import {
  BookOpen,
  Gauge,
  Home,
  MessageCircle,
  Shield,
  Target,
} from "@/components/ui/icons";
import {
  FeatureNudgePopup,
  SmartPopupFrame,
  SurveyPopup,
  SurveyThankYou,
} from "@/components/shared/smart-popup-host";
import { cn } from "@/lib/utils";
import type { LocalizedSurveyQuestion } from "@/lib/smart-popups/survey";
import type {
  SmartPopupFact,
  SmartPopupPayload,
  SmartPopupSurveyPayload,
} from "@/lib/smart-popups/types";

type QaPopupState =
  | "weakest-skill"
  | "first-practice"
  | "resume-streak"
  | "course"
  | "ask-coach"
  | "feedback-survey"
  | "thank-you";

type QaLocale = "en" | "vi";
type QaAnswer = number | string | string[];

const states: QaPopupState[] = [
  "weakest-skill",
  "first-practice",
  "resume-streak",
  "course",
  "ask-coach",
  "feedback-survey",
  "thank-you",
];

const stateLabels: Record<QaPopupState, string> = {
  "weakest-skill": "Weakest skill",
  "first-practice": "First practice",
  "resume-streak": "Resume streak",
  course: "Course",
  "ask-coach": "AI Coach",
  "feedback-survey": "Survey",
  "thank-you": "Thank-you",
};

function getState(value: string | null): QaPopupState {
  return states.includes(value as QaPopupState)
    ? (value as QaPopupState)
    : "weakest-skill";
}

function getLocale(value: string | string[] | undefined): QaLocale {
  const locale = Array.isArray(value) ? value[0] : value;
  return locale === "vi" ? "vi" : "en";
}

function fact(icon: SmartPopupFact["icon"], label: string, value?: string): SmartPopupFact {
  return { icon, label, value };
}

function makeFacts(state: QaPopupState, locale: QaLocale): SmartPopupFact[] {
  const vi = locale === "vi";

  if (state === "feedback-survey" || state === "thank-you") {
    return [
      fact("gift", vi ? "Phần thưởng" : "Reward", "+50 Credits"),
      fact("clock", vi ? "Thời gian" : "Time", vi ? "2 phút" : "2 min"),
    ];
  }

  if (state === "resume-streak") {
    return [
      fact("flame", vi ? "Chuỗi ngày" : "Streak", vi ? "7 ngày" : "7 days"),
      fact("clock", vi ? "Thời gian" : "Time", vi ? "10 phút" : "10 min"),
    ];
  }

  if (state === "course") {
    return [
      fact("book", vi ? "Khóa học" : "Course", vi ? "Thuyết phục" : "Persuasion"),
      fact("clock", vi ? "Thời gian" : "Time", vi ? "12 phút" : "12 min"),
    ];
  }

  if (state === "ask-coach") {
    return [
      fact("chat", "AI Coach", vi ? "Gợi ý nhanh" : "Quick help"),
      fact("clock", vi ? "Thời gian" : "Time", vi ? "2 phút" : "2 min"),
    ];
  }

  if (state === "first-practice") {
    return [
      fact("clock", vi ? "Thời gian" : "Time", vi ? "10 phút" : "10 min"),
      fact("chart", vi ? "Mở khóa" : "Unlocks", vi ? "Phản hồi" : "Feedback"),
    ];
  }

  return [
    fact("target", vi ? "Kỹ năng yếu nhất" : "Weakest skill", vi ? "Phản biện" : "Rebuttal"),
    fact("chart", vi ? "Điểm gần nhất" : "Last score", "63/100"),
  ];
}

function makePopup(state: QaPopupState, locale: QaLocale): SmartPopupPayload {
  const vi = locale === "vi";
  const copy = {
    "weakest-skill": {
      eyebrow: vi ? "Bước tiếp theo" : "Next best step",
      title: vi ? "Luyện phản biện trong 10 phút." : "Drill rebuttal for 10 minutes.",
      body: vi
        ? "Đây là điểm cải thiện nhanh nhất từ các vòng gần đây."
        : "Fastest improvement from your recent rounds.",
      cta: vi ? "Bắt đầu luyện phản biện" : "Start rebuttal drill",
      href: "/practice?track=debate",
    },
    "first-practice": {
      eyebrow: vi ? "Khởi động chút nhé" : "Start strong",
      title: vi
        ? "Bắt đầu với một bài nói 10 phút."
        : "Start with a 10-minute speaking drill.",
      body: vi
        ? "Thử một lượt ngắn và nhận gợi ý cải thiện ngay sau đó."
        : "One short round unlocks real feedback.",
      cta: vi ? "Bắt đầu luyện tập" : "Start practice",
      href: "/practice?track=speaking",
    },
    "resume-streak": {
      eyebrow: vi ? "Giữ nhịp học" : "Keep the streak",
      title: vi
        ? "Giữ nhịp với một vòng ngắn."
        : "Keep your rhythm with one quick round.",
      body: vi
        ? "Mười phút tập trung giúp thói quen không bị đứt quãng."
        : "Ten focused minutes keeps the habit alive.",
      cta: vi ? "Tiếp tục luyện tập" : "Resume practice",
      href: "/practice",
    },
    course: {
      eyebrow: vi ? "Bước có hướng dẫn" : "Guided step",
      title: vi
        ? "Biến phản hồi thành một bài học."
        : "Turn feedback into a guided lesson.",
      body: vi
        ? "Một bước trong khóa học giúp vòng tiếp theo rõ ràng hơn."
        : "One course step gives your next round a clearer plan.",
      cta: vi ? "Mở khóa học" : "Open courses",
      href: "/courses",
    },
    "ask-coach": {
      eyebrow: vi ? "Trợ giúp từ AI Coach" : "Coach help",
      title: vi
        ? "Hỏi AI Coach trước vòng tiếp theo."
        : "Ask AI Coach before your next round.",
      body: vi
        ? "Biến ý tưởng rối thành một luận điểm sắc hơn."
        : "Turn a messy idea into a sharper argument.",
      cta: vi ? "Hỏi AI Coach" : "Ask AI Coach",
      href: "/chat?context=coach-home",
    },
    "feedback-survey": {
      eyebrow: vi ? "Góp ý nhanh" : "Quick feedback",
      title: vi ? "DebateLab đang thế nào?" : "How is DebateLab feeling?",
      body: vi
        ? "Ba câu trả lời nhanh giúp tụi mình cải thiện lần luyện tiếp theo."
        : "Three quick answers help us improve your next practice.",
      cta: vi ? "Gửi góp ý" : "Share feedback",
      href: "/dashboard",
    },
    "thank-you": {
      eyebrow: vi ? "Đã nhận góp ý" : "Feedback received",
      title: vi ? "Cảm ơn bạn đã góp ý." : "Thanks for the feedback.",
      body: vi
        ? "Phần thưởng đã được cộng vào tài khoản của bạn."
        : "Your reward has been added to your balance.",
      cta: vi ? "Xong" : "Done",
      href: "/dashboard",
    },
  }[state];

  return {
    key: state,
    surface: "dashboard",
    campaignType: state === "feedback-survey" ? "feedback_survey" : "feature_nudge",
    segment: "active_user",
    title: copy.title,
    body: copy.body,
    eyebrow: copy.eyebrow,
    ctaLabel: copy.cta,
    dismissLabel: vi ? "Để sau" : "Later",
    dontShowAgainLabel: vi ? "Đừng hiện lại" : "Don't show again",
    ctaHref: copy.href,
    imageSrc: "/images/smart-popups/feedback-star.webp",
    imageAlt: "Smart popup QA fixture",
    facts: makeFacts(state, locale),
    priority: 1,
    metadata: {
      qaState: state,
      locale,
    },
  };
}

function makeSurvey(locale: QaLocale): SmartPopupSurveyPayload {
  const vi = locale === "vi";
  return {
    versionId: "qa-survey-version",
    version: 1,
    rewardCredits: 50,
    thankYou: {
      title: vi ? "Cảm ơn bạn đã góp ý." : "Thanks for the feedback.",
      body: vi
        ? "Phần thưởng đã được cộng vào tài khoản của bạn."
        : "Your reward has been added to your balance.",
    },
    questions: [
      {
        id: "overall",
        type: "rating",
        label: vi ? "Trải nghiệm hôm nay thế nào?" : "How was the experience today?",
        required: true,
        min: 1,
        max: 5,
        minLabel: vi ? "Khó chịu" : "Rough",
        maxLabel: vi ? "Rất tốt" : "Great",
      },
      {
        id: "friction",
        type: "single_choice",
        label: vi ? "Điều gì nên cải thiện trước?" : "What should improve first?",
        required: true,
        options: [
          { id: "practice", label: vi ? "Bài luyện tập" : "Practice flow" },
          { id: "coach", label: "AI Coach" },
          { id: "dashboard", label: vi ? "Bảng điều khiển" : "Dashboard" },
        ],
      },
      {
        id: "note",
        type: "text",
        label: vi ? "Ghi chú thêm" : "Anything else?",
        required: false,
        placeholder: vi ? "Viết ngắn gọn ở đây..." : "Keep it brief...",
      },
    ],
  };
}

function DashboardBackdrop({ locale }: { locale: QaLocale }) {
  const vi = locale === "vi";
  const navItems = [
    [Home, vi ? "Tổng quan" : "Dashboard"],
    [Target, vi ? "Luyện tập" : "Practice"],
    [BookOpen, vi ? "Khóa học" : "My Courses"],
    [MessageCircle, "AI Coach"],
    [Gauge, vi ? "Phân tích" : "Analytics"],
  ] as const;

  return (
    <div className="min-h-dvh bg-[#F7FAFE] text-[#0B1424]">
      <div className="flex min-h-dvh">
        <aside className="hidden w-[220px] shrink-0 border-r border-[#DEE8F8] bg-white px-3 py-4 md:block">
          <div className="mb-5 flex items-center gap-3 px-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#4D86F7] text-white">
              <Shield className="h-5 w-5" />
            </div>
            <span className="text-xl font-extrabold">DebateLab</span>
          </div>
          <nav className="space-y-1">
            {navItems.map(([Icon, label], index) => (
              <div
                key={label}
                className={cn(
                  "flex h-9 items-center gap-3 rounded-xl px-3 text-sm font-semibold text-[#52627A]",
                  index === 0 && "bg-[#EDF4FF] text-[#4D86F7]"
                )}
              >
                <Icon className="h-5 w-5" />
                {label}
              </div>
            ))}
          </nav>
        </aside>
        <main className="mx-auto w-full max-w-[1280px] px-5 py-8 md:px-8">
          <div className="mb-6 flex items-center justify-between gap-4">
            <h1 className="text-2xl font-extrabold">
              {vi ? "Chào buổi tối, Jensen!" : "Good evening, Jensen!"}
            </h1>
            <div className="hidden gap-8 text-sm font-bold text-[#52627A] sm:flex">
              <span>7 {vi ? "ngày" : "Day streak"}</span>
              <span>98,300 Credits</span>
              <span>Level 3</span>
            </div>
          </div>
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.25fr)_380px]">
            <section className="rounded-[28px] border border-[#DEE8F8] bg-white p-6 shadow-[0_24px_60px_-48px_rgba(11,20,36,0.65)]">
              <span className="text-xs font-extrabold uppercase text-[#4D86F7]">
                {vi ? "Đề xuất cho bạn" : "Recommended for you"}
              </span>
              <h2 className="mt-4 max-w-sm text-4xl font-extrabold leading-tight">
                {vi ? "Luyện phản biện" : "Strengthen Rebuttal"}
              </h2>
              <div className="mt-5 grid max-w-sm grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-[#718096]">{vi ? "Lý do" : "Why now"}</p>
                  <p className="font-extrabold">{vi ? "Kỹ năng yếu nhất" : "Weakest skill"}</p>
                </div>
                <div>
                  <p className="text-xs text-[#718096]">{vi ? "Điểm" : "Score"}</p>
                  <p className="font-extrabold">63/100</p>
                </div>
              </div>
              <button className="mt-8 h-12 rounded-[18px] bg-[#4D86F7] px-8 font-extrabold text-white shadow-[inset_0_-5px_0_#2F62D8]">
                {vi ? "Bắt đầu" : "Start"}
              </button>
            </section>
            <section className="rounded-[28px] border border-[#DEE8F8] bg-white p-5">
              <h2 className="text-lg font-extrabold">{vi ? "Kế hoạch hôm nay" : "Today's plan"}</h2>
              <div className="mt-4 space-y-3">
                {["Continue course", "Review feedback", "Strengthen rebuttal"].map((item) => (
                  <div
                    key={item}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-[#DEE8F8] px-4 py-3"
                  >
                    <span className="font-bold">
                      {vi
                        ? item === "Continue course"
                          ? "Tiếp tục khóa học"
                          : item === "Review feedback"
                            ? "Xem phản hồi"
                            : "Luyện phản biện"
                        : item}
                    </span>
                    <span className="rounded-full bg-[#F3F7FF] px-3 py-1 text-sm font-extrabold text-[#4D86F7]">
                      {vi ? "Bắt đầu" : "Start"}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}

export function SmartPopupQaClient() {
  const params = useParams<{ locale?: string }>();
  const searchParams = useSearchParams();
  const locale = getLocale(params.locale);
  const initialState = getState(searchParams.get("state"));
  const [open, setOpen] = useState(true);
  const [answers, setAnswers] = useState<Record<string, QaAnswer>>({});
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(initialState === "thank-you");
  const popup = useMemo(() => makePopup(initialState, locale), [initialState, locale]);
  const survey = useMemo(() => makeSurvey(locale), [locale]);
  const isSurvey = initialState === "feedback-survey";

  function renderQuestion(question: LocalizedSurveyQuestion): ReactNode {
    const value = answers[question.id];

    if (question.type === "rating" || question.type === "nps") {
      const min = question.min ?? 1;
      const max = question.max ?? 5;
      return (
        <div className="space-y-2">
          <div className="grid grid-cols-5 gap-2">
            {Array.from({ length: max - min + 1 }, (_, index) => min + index).map(
              (rating) => (
                <button
                  key={rating}
                  type="button"
                  onClick={() => setAnswers((current) => ({ ...current, [question.id]: rating }))}
                  className={cn(
                    "h-10 rounded-lg border text-sm font-extrabold",
                    value === rating
                      ? "border-[#4D86F7] bg-[#4D86F7] text-white"
                      : "border-[#DEE8F8] bg-white text-[#415069]"
                  )}
                >
                  {rating}
                </button>
              )
            )}
          </div>
          <div className="flex justify-between text-xs font-semibold text-[#718096]">
            <span>{question.minLabel}</span>
            <span>{question.maxLabel}</span>
          </div>
        </div>
      );
    }

    if (question.type === "single_choice") {
      return (
        <div className="grid gap-2">
          {(question.options ?? []).map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() =>
                setAnswers((current) => ({ ...current, [question.id]: option.id }))
              }
              className={cn(
                "min-h-11 rounded-lg border px-3 py-2 text-left text-sm font-bold",
                value === option.id
                  ? "border-[#4D86F7] bg-[#EDF4FF] text-[#0B1424]"
                  : "border-[#DEE8F8] bg-white text-[#415069]"
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      );
    }

    return (
      <textarea
        value={typeof value === "string" ? value : ""}
        onChange={(event) =>
          setAnswers((current) => ({ ...current, [question.id]: event.target.value }))
        }
        placeholder={question.placeholder}
        className="min-h-24 w-full rounded-lg border border-[#DEE8F8] px-3 py-2 text-sm outline-none focus:border-[#4D86F7] focus:ring-2 focus:ring-[#A9C6FB]/40"
      />
    );
  }

  return (
    <>
      <DashboardBackdrop locale={locale} />
      <div className="fixed bottom-4 left-1/2 z-10 hidden -translate-x-1/2 gap-2 rounded-full border border-[#DEE8F8] bg-white/90 px-3 py-2 shadow-lg lg:flex">
        {states.map((state) => (
          <Link
            key={state}
            href={`/${locale}/dev/smart-popup-qa?state=${state}`}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-extrabold",
              state === initialState
                ? "bg-[#4D86F7] text-white"
                : "text-[#52627A] hover:bg-[#F3F7FF]"
            )}
          >
            {stateLabels[state]}
          </Link>
        ))}
      </div>
      {open ? (
        <SmartPopupFrame
          closeLabel={popup.dismissLabel}
          open={open}
          onClose={() => setOpen(false)}
          onOpenChange={setOpen}
        >
          {submitted || initialState === "thank-you" ? (
            <SurveyThankYou
              title={survey.thankYou.title}
              body={survey.thankYou.body}
              rewardCredits={survey.rewardCredits}
              doneLabel={locale === "vi" ? "Xong" : "Done"}
              onDone={() => setOpen(false)}
            />
          ) : isSurvey ? (
            <SurveyPopup
              popup={popup}
              survey={survey}
              submitError={error}
              renderQuestion={renderQuestion}
              onSubmit={() => {
                const missing = survey.questions.find(
                  (question) => question.required && !answers[question.id]
                );
                if (missing) {
                  setError(
                    locale === "vi"
                      ? "Vui lòng trả lời các câu bắt buộc."
                      : "Please answer the required questions."
                  );
                  return;
                }
                setError(null);
                setSubmitted(true);
              }}
              onDismiss={() => setOpen(false)}
              onDontShowAgain={() => setOpen(false)}
            />
          ) : (
            <FeatureNudgePopup
              popup={popup}
              onCta={() => {
                window.location.assign(popup.ctaHref);
              }}
              onDismiss={() => setOpen(false)}
              onDontShowAgain={() => setOpen(false)}
            />
          )}
        </SmartPopupFrame>
      ) : null}
    </>
  );
}
