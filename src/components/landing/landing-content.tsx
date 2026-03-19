"use client";

import { useState } from "react";
import Image from "next/image";
import {
  Sparkles,
  Timer,
  AudioLines,
  BarChart3,
  MessageCircle,
  Quote,
  Star,
  BookOpen,
  Mic,
  ArrowRight,
  ChevronRight,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { BrowserFrame } from "./browser-frame";
import { ScrollReveal } from "./scroll-reveal";
import { CountUp } from "./count-up";
import { GradientButton } from "./gradient-button";
import { AvatarStack } from "./avatar-stack";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface LandingContentProps {
  isLoggedIn: boolean;
}

const FEATURES = [
  {
    key: "practice",
    icon: Timer,
    image: "/images/landing/practice-session.jpg",
  },
  {
    key: "transcription",
    icon: Mic,
    image: "/images/landing/practice-session.jpg",
  },
  {
    key: "analysis",
    icon: BarChart3,
    image: "/images/landing/feedback.jpg",
  },
  {
    key: "coach",
    icon: MessageCircle,
    image: "/images/landing/ai-coach.jpg",
  },
] as const;

const FEATURE_KEYS = ["solo_practice", "transcription", "ai_analysis", "growth"] as const;

const HOW_IT_WORKS_ICONS = [BookOpen, Mic, BarChart3, MessageCircle];

const TESTIMONIALS = [
  { initials: "MA", name: "testimonials.0" },
  { initials: "TH", name: "testimonials.1" },
  { initials: "DP", name: "testimonials.2" },
];

const TESTIMONIAL_META = [
  {
    name: "Minh Anh Nguyen",
    title: "Top Speaker, National Schools Debating Championship",
  },
  { name: "Thanh Ha Tran", title: "Runner-up, Truong Teen 2025" },
  {
    name: "Duc Phong Le",
    title: "Captain, THPT Chuyen Le Hong Phong Debate Team",
  },
];

export function LandingContent({ isLoggedIn }: LandingContentProps) {
  const t = useTranslations("landing");
  const [activeFeature, setActiveFeature] = useState(0);

  return (
    <>
      {/* Hero Section */}
      <section className="relative pt-28 pb-12 md:pt-40 md:pb-24 px-6 overflow-hidden">
        {/* Radial gradient background */}
        <div
          className="absolute inset-0 -z-10"
          style={{
            background:
              "radial-gradient(ellipse at 30% 50%, rgba(47,79,221,0.08) 0%, transparent 60%), radial-gradient(ellipse at 70% 30%, rgba(79,70,229,0.06) 0%, transparent 50%)",
          }}
        />

        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-16 items-center">
          <div className="space-y-8">
            {/* Announcement Pill */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Link
                href="/chat"
                className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/5 border border-primary/10 text-sm text-primary hover:bg-primary/10 transition-colors"
              >
                <span className="px-1.5 py-0.5 rounded-full bg-gradient-to-r from-[#2f4fdd] to-[#4f46e5] text-white text-xs font-medium">
                  {t("hero.announcement_badge")}
                </span>
                <span>{t("hero.announcement")}</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            </motion.div>

            {/* Headline */}
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-5xl sm:text-6xl lg:text-7xl font-extrabold leading-[1.05] tracking-tight text-on-surface"
            >
              {t.rich("hero.headline_rich", {
                gradient: (chunks) => (
                  <span className="bg-gradient-to-r from-[#2f4fdd] to-[#4f46e5] bg-clip-text text-transparent">
                    {chunks}
                  </span>
                ),
              })}
            </motion.h1>

            {/* Subtitle */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-lg text-on-surface-variant leading-relaxed max-w-xl font-medium"
            >
              {t("hero.subheadline")}
            </motion.p>

            {/* CTA + Social Proof */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="flex flex-wrap items-center gap-6 pt-4"
            >
              <GradientButton
                href={isLoggedIn ? "/practice" : "/auth/signup"}
              >
                {isLoggedIn ? t("hero.cta_logged_in") : t("hero.cta")}
              </GradientButton>
              <AvatarStack label={t("hero.social_proof")} />
            </motion.div>
          </div>

          {/* Hero Screenshot */}
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="relative hidden lg:block"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-[#2f4fdd]/10 to-[#4f46e5]/10 rounded-2xl blur-3xl" />
            <BrowserFrame
              src="/images/landing/dashboard.jpg"
              alt="DebateLab Dashboard"
              width={700}
              height={450}
              className="relative"
            />
          </motion.div>
        </div>
      </section>

      {/* Features — Tabbed Showcase */}
      <section
        id="features"
        className="py-24 md:py-32 bg-surface-container-lowest px-6 overflow-hidden"
      >
        <div className="max-w-7xl mx-auto">
          <ScrollReveal>
            <div className="text-center mb-16 space-y-4">
              <h2 className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-on-surface tracking-tight">
                {t("features.headline")}
              </h2>
              <p className="text-on-surface-variant text-xl font-medium">
                {t("features.subheadline")}
              </p>
            </div>
          </ScrollReveal>

          <ScrollReveal delay={0.15}>
            <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-start">
              {/* Tab list */}
              <div className="space-y-3">
                {FEATURES.map((feat, i) => {
                  const Icon = feat.icon;
                  const isActive = activeFeature === i;
                  return (
                    <button
                      key={feat.key}
                      onClick={() => setActiveFeature(i)}
                      className={`w-full text-left p-5 rounded-xl border-l-[3px] transition-all duration-200 ${
                        isActive
                          ? "border-l-primary bg-primary/5"
                          : "border-l-transparent hover:bg-gray-50"
                      }`}
                    >
                      <div className="flex items-start gap-4">
                        <div
                          className={`p-2.5 rounded-xl ${
                            isActive
                              ? "bg-gradient-to-br from-[#2f4fdd] to-[#4f46e5] text-white"
                              : "bg-gray-100 text-gray-500"
                          }`}
                        >
                          <Icon className="w-5 h-5" />
                        </div>
                        <div>
                          <h3
                            className={`font-bold text-lg ${
                              isActive
                                ? "text-on-surface"
                                : "text-on-surface-variant"
                            }`}
                          >
                            {t(`features.${FEATURE_KEYS[i]}.title`)}
                          </h3>
                          <p className="text-sm text-on-surface-variant mt-1 leading-relaxed">
                            {t(`features.${FEATURE_KEYS[i]}.description`)}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Screenshot */}
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-[#2f4fdd]/5 to-[#4f46e5]/5 rounded-2xl blur-2xl" />
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeFeature}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.3 }}
                  >
                    <BrowserFrame
                      src={FEATURES[activeFeature].image}
                      alt={`Feature: ${FEATURES[activeFeature].key}`}
                      width={600}
                      height={400}
                      className="relative"
                    />
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-20 px-6 bg-gradient-to-r from-primary/5 via-transparent to-indigo-500/5">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { target: 500, suffix: "+", label: t("stats.debaters") },
              { target: 10000, suffix: "+", label: t("stats.sessions") },
              {
                target: 23,
                suffix: "%",
                prefix: "+",
                label: t("stats.improvement"),
              },
              {
                target: 4.9,
                suffix: "/5",
                label: t("stats.rating"),
                decimals: true,
              },
            ].map((stat, i) => (
              <ScrollReveal key={i} delay={i * 0.1}>
                <div>
                  <div className="text-4xl md:text-5xl font-extrabold bg-gradient-to-r from-[#2f4fdd] to-[#4f46e5] bg-clip-text text-transparent">
                    <CountUp
                      target={stat.target}
                      suffix={stat.suffix}
                      prefix={stat.prefix}
                      decimals={stat.decimals}
                    />
                  </div>
                  <p className="text-sm text-muted-foreground mt-2 font-medium">
                    {stat.label}
                  </p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* Course Preview Section */}
      <section className="py-24 md:py-32 px-6">
        <div className="max-w-7xl mx-auto">
          <ScrollReveal>
            <div className="text-center mb-16 space-y-4">
              <h2 className="text-4xl sm:text-5xl font-extrabold text-on-surface tracking-tight">
                {t("courses.headline")}
              </h2>
              <p className="text-on-surface-variant text-xl font-medium max-w-2xl mx-auto">
                {t("courses.subheadline")}
              </p>
            </div>
          </ScrollReveal>

          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {(
              [
                { key: "foundations", icon: BookOpen, color: "primary" },
                { key: "speaking", icon: MessageCircle, color: "tertiary" },
              ] as const
            ).map((course, i) => (
              <ScrollReveal key={course.key} delay={i * 0.15}>
                <div className="relative rounded-3xl border border-outline-variant/10 bg-surface-container-lowest p-8 soft-shadow hover:shadow-lg hover:-translate-y-1 transition-all duration-300 overflow-hidden group">
                  {/* Gradient top border */}
                  <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[#2f4fdd] to-[#4f46e5]" />
                  <div
                    className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-${course.color}-container/40 mb-5`}
                  >
                    <course.icon
                      className={`h-6 w-6 text-${course.color}`}
                    />
                  </div>
                  <h3 className="text-xl font-extrabold text-on-surface mb-2">
                    {t(`courses.${course.key}.title`)}
                  </h3>
                  <p className="text-sm text-on-surface-variant mb-4 leading-relaxed">
                    {t(`courses.${course.key}.description`)}
                  </p>
                  <div className="flex items-center gap-3 text-xs text-on-surface-variant">
                    <span
                      className={`rounded-full bg-${course.color}/10 px-3 py-1 font-semibold text-${course.color}`}
                    >
                      {t(`courses.${course.key}.modules`)}
                    </span>
                    <span className="rounded-full bg-surface-container px-3 py-1">
                      {t(`courses.${course.key}.lessons`)}
                    </span>
                  </div>
                </div>
              </ScrollReveal>
            ))}
          </div>

          <ScrollReveal delay={0.3}>
            <div className="text-center mt-10">
              <Link
                href={isLoggedIn ? "/courses" : "/auth/signup"}
                className="inline-flex items-center gap-2 text-primary font-bold hover:underline"
              >
                {isLoggedIn
                  ? t("courses.browse")
                  : t("courses.signup_to_access")}{" "}
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-24 md:py-32 px-6">
        <div className="max-w-7xl mx-auto">
          <ScrollReveal>
            <div className="text-center mb-16 space-y-4">
              <h2 className="text-4xl sm:text-5xl font-extrabold text-on-surface tracking-tight">
                {t("howItWorks.headline")}
              </h2>
            </div>
          </ScrollReveal>

          <div className="relative hidden lg:flex items-start justify-between">
            {/* Connecting line — runs through circle centers */}
            <div className="absolute top-[52px] left-[60px] right-[60px] border-t-2 border-dashed border-primary/20 z-0" />

            {(["step1", "step2", "step3", "step4"] as const).map(
              (step, i) => {
                const Icon = HOW_IT_WORKS_ICONS[i];
                return (
                  <ScrollReveal key={step} delay={i * 0.15} className="relative z-10 flex flex-col items-center text-center w-1/4">
                    <Icon className="w-5 h-5 text-muted-foreground mb-3" />
                    <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#2f4fdd] to-[#4f46e5] text-white flex items-center justify-center text-lg font-bold mb-4 shadow-lg shadow-primary/20">
                      {i + 1}
                    </div>
                    <h3 className="text-lg font-extrabold text-on-surface mb-2">
                      {t(`howItWorks.${step}.title`)}
                    </h3>
                    <p className="text-sm text-on-surface-variant leading-relaxed font-medium px-2">
                      {t(`howItWorks.${step}.description`)}
                    </p>
                  </ScrollReveal>
                );
              }
            )}
          </div>

          {/* Mobile: stacked layout without connecting line */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-10 lg:hidden">
            {(["step1", "step2", "step3", "step4"] as const).map(
              (step, i) => {
                const Icon = HOW_IT_WORKS_ICONS[i];
                return (
                  <ScrollReveal key={step} delay={i * 0.1}>
                    <div className="flex flex-col items-center text-center space-y-4">
                      <Icon className="w-5 h-5 text-muted-foreground" />
                      <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#2f4fdd] to-[#4f46e5] text-white flex items-center justify-center text-lg font-bold shadow-lg shadow-primary/20">
                        {i + 1}
                      </div>
                      <h3 className="text-lg font-extrabold text-on-surface">
                        {t(`howItWorks.${step}.title`)}
                      </h3>
                      <p className="text-sm text-on-surface-variant leading-relaxed font-medium">
                        {t(`howItWorks.${step}.description`)}
                      </p>
                    </div>
                  </ScrollReveal>
                );
              }
            )}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-24 px-6 relative">
        <div className="max-w-7xl mx-auto">
          <ScrollReveal>
            <div className="text-center mb-16 space-y-4">
              <h2 className="text-4xl sm:text-5xl font-extrabold text-on-surface tracking-tight">
                {t("testimonials.headline")}
              </h2>
            </div>
          </ScrollReveal>

          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {TESTIMONIALS.map((testimonial, i) => (
              <ScrollReveal key={i} delay={i * 0.1}>
                <div className="bg-surface-container-lowest rounded-2xl p-8 border border-outline-variant/10 soft-shadow hover:shadow-lg transition-all duration-300 flex flex-col h-full">
                  {/* Stars */}
                  <div className="flex gap-1 mb-5">
                    {[...Array(5)].map((_, j) => (
                      <Star
                        key={j}
                        className="h-4 w-4 fill-primary text-primary"
                      />
                    ))}
                  </div>
                  {/* Quote */}
                  <p className="text-on-surface font-medium leading-relaxed italic flex-1 text-[15px]">
                    &ldquo;{t(`${testimonial.name}.quote`)}&rdquo;
                  </p>
                  {/* Author */}
                  <div className="flex items-center gap-3 mt-6 pt-6 border-t border-outline-variant/10">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#2f4fdd] to-[#4f46e5] flex items-center justify-center text-white text-sm font-bold">
                      {testimonial.initials}
                    </div>
                    <div>
                      <div className="font-bold text-sm text-on-surface">
                        {TESTIMONIAL_META[i].name}
                      </div>
                      <div className="text-xs text-on-surface-variant">
                        {TESTIMONIAL_META[i].title}
                      </div>
                    </div>
                  </div>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-24 md:py-32 px-6">
        <ScrollReveal>
          <div className="max-w-7xl mx-auto bg-gradient-to-r from-[#2f4fdd] to-[#4f46e5] rounded-[3rem] p-12 md:p-24 text-center space-y-10 relative overflow-hidden shadow-2xl shadow-primary/30">
            <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white via-transparent to-transparent" />
            <h2 className="text-4xl sm:text-5xl md:text-7xl font-extrabold text-white max-w-3xl mx-auto tracking-tight relative z-10">
              {t("finalCta.headline")}
            </h2>
            <p className="text-white/80 text-xl max-w-xl mx-auto font-medium relative z-10">
              {t("finalCta.subheadline")}
            </p>
            <div className="flex flex-col sm:flex-row gap-6 justify-center items-center relative z-10">
              <Link
                href={isLoggedIn ? "/dashboard" : "/auth/signup"}
                className="bg-white text-[#2f4fdd] px-12 py-5 rounded-2xl font-bold text-lg hover:scale-105 transition-all shadow-2xl hover:shadow-[0_0_40px_rgba(255,255,255,0.3)]"
              >
                {isLoggedIn ? t("finalCta.cta_logged_in") : t("finalCta.cta")}
              </Link>
              <Link
                href={isLoggedIn ? "/history" : "/auth/login"}
                className="text-white border-2 border-white/30 px-12 py-5 rounded-2xl font-bold text-lg hover:bg-white/10 transition-colors"
              >
                {isLoggedIn
                  ? t("finalCta.secondary")
                  : t("finalCta.secondary_logged_out")}
              </Link>
            </div>
            <div className="relative z-10 flex justify-center">
              <AvatarStack label={t("hero.social_proof")} variant="on-dark" />
            </div>
          </div>
        </ScrollReveal>
      </section>

      {/* FAQ Section */}
      <section className="py-24 px-6">
        <div className="max-w-3xl mx-auto">
          <ScrollReveal>
            <div className="text-center mb-12 space-y-4">
              <h2 className="text-3xl sm:text-4xl font-extrabold text-on-surface tracking-tight">
                {t("faq.title")}
              </h2>
            </div>
          </ScrollReveal>

          <ScrollReveal delay={0.15}>
            <Accordion className="space-y-3">
              {(["q1", "q2", "q3"] as const).map((q) => (
                <AccordionItem
                  key={q}
                  className="border border-outline-variant/10 rounded-xl px-6 bg-surface-container-lowest"
                >
                  <AccordionTrigger className="text-left font-bold text-on-surface hover:no-underline py-5">
                    {t(`faq.${q}`)}
                  </AccordionTrigger>
                  <AccordionContent className="text-on-surface-variant leading-relaxed pb-5">
                    {t(`faq.${q.replace("q", "a")}`)}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </ScrollReveal>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-20 bg-surface-container-lowest px-6 border-t border-outline-variant/10">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-12">
          <div className="space-y-4">
            <span className="text-2xl font-extrabold bg-gradient-to-r from-[#2f4fdd] to-[#4f46e5] bg-clip-text text-transparent tracking-tight">
              DebateLab
            </span>
            <p className="text-sm font-medium text-on-surface-variant max-w-xs">
              {t("footer.tagline")}
            </p>
            {/* Social links */}
            <div className="flex gap-3 pt-2">
              <a
                href="https://github.com"
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-primary/10 hover:text-primary transition-colors"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                </svg>
              </a>
              <a
                href="https://facebook.com"
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-primary/10 hover:text-primary transition-colors"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                </svg>
              </a>
              <a
                href="https://twitter.com"
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-primary/10 hover:text-primary transition-colors"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-10 md:gap-16">
            <div className="flex flex-col gap-4">
              <span className="text-xs font-extrabold text-on-surface uppercase tracking-widest">
                {t("footer.product")}
              </span>
              <Link
                className="text-sm font-semibold text-on-surface-variant hover:text-primary transition-colors"
                href="/courses"
              >
                {t("footer.courses")}
              </Link>
              <Link
                className="text-sm font-semibold text-on-surface-variant hover:text-primary transition-colors"
                href="/practice"
              >
                {t("footer.practice")}
              </Link>
              <Link
                className="text-sm font-semibold text-on-surface-variant hover:text-primary transition-colors"
                href="/history"
              >
                {t("footer.history")}
              </Link>
            </div>
            <div className="flex flex-col gap-4">
              <span className="text-xs font-extrabold text-on-surface uppercase tracking-widest">
                {t("footer.legal")}
              </span>
              <a
                className="text-sm font-semibold text-on-surface-variant hover:text-primary transition-colors"
                href="#"
              >
                {t("footer.privacy")}
              </a>
              <a
                className="text-sm font-semibold text-on-surface-variant hover:text-primary transition-colors"
                href="#"
              >
                {t("footer.terms")}
              </a>
            </div>
          </div>
        </div>
        <div className="max-w-7xl mx-auto mt-20 pt-8 border-t border-outline-variant/5 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm font-semibold text-on-surface-variant">
            {t("footer.copyright", { year: new Date().getFullYear() })}
          </p>
          <p className="text-sm text-on-surface-variant">
            {t("footer.made_with_love")}
          </p>
        </div>
      </footer>
    </>
  );
}
