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

const QA_STATE_IMAGES: Record<QaPopupState, string> = {
  "weakest-skill": "/images/smart-popups/weakest-skill.webp",
  "first-practice": "/images/smart-popups/first-practice.webp",
  "resume-streak": "/images/smart-popups/resume-streak.webp",
  course: "/images/smart-popups/try-courses.webp",
  "ask-coach": "/images/smart-popups/ask-coach.webp",
  "feedback-survey": "/images/smart-popups/feedback-survey.webp",
  "thank-you": "/images/rewards/win-celebration.webp",
};

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
      title: vi ? "Thinkfy đang thế nào?" : "How is Thinkfy feeling?",
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
    popupKind:
      state === "feedback-survey"
        ? "feedback_survey"
        : state === "course" || state === "ask-coach"
          ? "feature_announcement"
          : "practice_suggestion",
    segment: "active_user",
    title: copy.title,
    body: copy.body,
    eyebrow: copy.eyebrow,
    ctaLabel: copy.cta,
    dismissLabel: vi ? "Để sau" : "Later",
    dontShowAgainLabel: vi ? "Đừng hiện lại" : "Don't show again",
    ctaHref: copy.href,
    imageSrc: QA_STATE_IMAGES[state],
    imageAlt: "Smart popup QA fixture",
    facts: [],
    priority: 1,
    metadata: {
      qaState: state,
      locale,
      popupKind:
        state === "feedback-survey"
          ? "feedback_survey"
          : state === "course" || state === "ask-coach"
            ? "feature_announcement"
            : "practice_suggestion",
      previewOnly: true,
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
    <div className="min-h-dvh overflow-x-hidden bg-background text-on-surface">
      <div className="flex min-h-dvh">
        <aside className="hidden w-[220px] shrink-0 border-r border-border bg-surface px-3 py-4 md:block">
          <div className="mb-5 flex items-center gap-3 px-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-primary text-on-primary">
              <Shield className="h-5 w-5" />
            </div>
            <span className="type-title font-semibold">Thinkfy</span>
          </div>
          <nav className="space-y-1">
            {navItems.map(([Icon, label], index) => (
              <div
                key={label}
                className={cn(
                  "flex h-9 items-center gap-3 rounded-[10px] px-3 type-label font-medium text-on-surface-variant transition-colors duration-150",
                  index === 0 && "bg-primary-container text-primary-dim"
                )}
              >
                <Icon className="h-5 w-5" />
                {label}
              </div>
            ))}
          </nav>
        </aside>
        <main className="mx-auto w-full max-w-[1280px] px-5 py-6 md:px-8">
          <div className="mb-6 flex items-center justify-between gap-4">
            <h1 className="type-heading-lg font-medium">
              {vi ? "Chào buổi tối, Jensen!" : "Good evening, Jensen!"}
            </h1>
            <div className="hidden gap-6 type-label font-medium text-on-surface-variant sm:flex">
              <span>7 {vi ? "ngày" : "Day streak"}</span>
              <span>98,300 Credits</span>
              <span>Level 3</span>
            </div>
          </div>
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.25fr)_380px]">
            <section className="rounded-[12px] border border-border bg-surface p-5">
              <span className="type-caption font-semibold uppercase tracking-wider text-primary-dim">
                {vi ? "Đề xuất cho bạn" : "Recommended for you"}
              </span>
              <h2 className="mt-3 max-w-sm type-heading-xl text-on-surface">
                {vi ? "Luyện phản biện" : "Strengthen Rebuttal"}
              </h2>
              <div className="mt-4 grid max-w-sm grid-cols-2 gap-3 type-body-sm">
                <div>
                  <p className="text-xs text-on-surface-variant">{vi ? "Lý do" : "Why now"}</p>
                  <p className="type-label font-semibold">{vi ? "Kỹ năng yếu nhất" : "Weakest skill"}</p>
                </div>
                <div>
                  <p className="text-xs text-on-surface-variant">{vi ? "Điểm" : "Score"}</p>
                  <p className="type-label font-semibold">63/100</p>
                </div>
              </div>
              <button type="button" className="mt-6 inline-flex h-8 items-center rounded-[10px] bg-primary px-3 type-label font-semibold text-on-primary transition-colors duration-150 hover:bg-primary-dim focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 active:translate-y-px">
                {vi ? "Bắt đầu" : "Start"}
              </button>
            </section>
            <section className="rounded-[12px] border border-border bg-surface p-4">
              <h2 className="type-title font-semibold">{vi ? "Kế hoạch hôm nay" : "Today's plan"}</h2>
              <div className="mt-4 space-y-3">
                {["Continue course", "Review feedback", "Strengthen rebuttal"].map((item) => (
                  <div
                    key={item}
                    className="flex min-h-10 items-center justify-between gap-3 rounded-[10px] border border-border px-3 py-2"
                  >
                    <span className="type-label font-medium">
                      {vi
                        ? item === "Continue course"
                          ? "Tiếp tục khóa học"
                          : item === "Review feedback"
                            ? "Xem phản hồi"
                            : "Luyện phản biện"
                        : item}
                    </span>
                    <span className="inline-flex h-6 items-center rounded-[6px] bg-primary-container px-2 type-caption font-semibold text-primary-dim">
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
                    "h-8 rounded-[10px] border type-label font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                    value === rating
                      ? "border-primary bg-primary text-on-primary"
                      : "border-border bg-surface text-on-surface-variant hover:bg-primary-container"
                  )}
                >
                  {rating}
                </button>
              )
            )}
          </div>
          <div className="flex justify-between text-xs font-semibold text-on-surface-variant">
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
                "min-h-10 rounded-[10px] border px-3 py-2 text-left type-label font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                value === option.id
                  ? "border-primary bg-primary-container text-on-surface"
                  : "border-border bg-surface text-on-surface-variant hover:bg-primary-container"
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
        className="min-h-24 w-full rounded-[10px] border border-border bg-surface px-3 py-2 type-body text-on-surface outline-none transition-[border-color,box-shadow] duration-150 focus:border-ring focus:ring-2 focus:ring-ring/30"
      />
    );
  }

  return (
    <>
      <DashboardBackdrop locale={locale} />
      <div className="fixed bottom-4 left-1/2 z-10 hidden max-w-[calc(100vw-2rem)] -translate-x-1/2 flex-wrap justify-center gap-1.5 rounded-[12px] border border-border bg-surface px-2 py-2 shadow-none lg:flex">
        {states.map((state) => (
          <Link
            key={state}
            href={`/${locale}/dev/smart-popup-qa?state=${state}`}
            className={cn(
              "inline-flex h-7 items-center rounded-[8px] px-2 type-caption font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
              state === initialState
                ? "bg-primary text-on-primary"
                : "text-on-surface-variant hover:bg-primary-container"
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
            />
          ) : (
            <FeatureNudgePopup
              popup={popup}
              onCta={() => {
                window.location.assign(popup.ctaHref);
              }}
              onDismiss={() => setOpen(false)}
            />
          )}
        </SmartPopupFrame>
      ) : null}
    </>
  );
}
