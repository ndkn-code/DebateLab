import {
  Sparkles,
  Timer,
  AudioLines,
  BarChart3,
  TrendingUp,
  Quote,
  Star,
  Clock,
  BookOpen,
  MessageCircle,
} from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { LandingNavbar } from "@/components/landing/landing-navbar";
import { Link } from "@/i18n/navigation";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function Home({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const t = await getTranslations("landing");

  return (
    <main className="bg-background text-on-surface">
      {/* TopNavBar */}
      <LandingNavbar isLoggedIn={!!user} />

      {/* Hero Section */}
      <section className="pt-28 pb-12 md:pt-40 md:pb-24 px-6 overflow-hidden">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-16 items-center">
          <div className="space-y-8">
            <div className="inline-flex items-center gap-2 bg-primary-container px-4 py-2 rounded-full">
              <Sparkles className="h-4 w-4 text-on-primary-fixed" />
              <span className="text-[10px] font-extrabold text-on-primary-fixed uppercase tracking-widest">
                {t("hero.badge")}
              </span>
            </div>
            <h1 className="text-5xl sm:text-6xl md:text-7xl font-extrabold leading-[1.05] text-on-surface">
              {t("hero.headline")}
            </h1>
            <p className="text-lg text-on-surface-variant leading-relaxed max-w-xl font-medium">
              {t("hero.subheadline")}
            </p>
            <div className="flex flex-wrap gap-4 pt-4">
              <Link
                href={user ? "/practice" : "/auth/signup"}
                className="bg-primary text-on-primary px-10 py-5 rounded-2xl font-bold text-lg shadow-xl shadow-primary/25 hover:scale-105 transition-all"
              >
                {user ? t("hero.cta_logged_in") : t("hero.cta")}
              </Link>
              <div className="flex items-center gap-3 px-6">
                <div className="flex -space-x-3">
                  <div className="w-10 h-10 rounded-full border-2 border-background bg-gradient-to-br from-primary to-primary-dim flex items-center justify-center text-on-primary text-xs font-bold">
                    T
                  </div>
                  <div className="w-10 h-10 rounded-full border-2 border-background bg-gradient-to-br from-secondary to-secondary-dim flex items-center justify-center text-on-secondary text-xs font-bold">
                    H
                  </div>
                </div>
                <span className="text-sm font-semibold text-on-surface-variant italic">
                  {t("hero.social_proof")}
                </span>
              </div>
            </div>
          </div>
          <div className="relative">
            <div className="absolute -top-10 -right-10 w-64 h-64 bg-secondary-container/40 rounded-full blur-3xl -z-10" />
            <div className="absolute -bottom-10 -left-10 w-64 h-64 bg-tertiary-container/40 rounded-full blur-3xl -z-10" />
            <div className="bg-surface-container-lowest p-5 rounded-3xl soft-shadow relative z-10 rotate-2 border border-outline-variant/10">
              <div className="bg-surface rounded-2xl overflow-hidden aspect-[16/11] border border-outline-variant/20 relative">
                <div className="absolute inset-0 bg-surface-container-low/30" />
                <div className="absolute inset-0 flex flex-col p-6 sm:p-8">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <div className="text-[10px] uppercase font-extrabold text-on-surface-variant opacity-60 tracking-widest">
                        {t("hero.session_timer")}
                      </div>
                      <div className="text-4xl sm:text-5xl font-extrabold text-primary">
                        07:00
                      </div>
                    </div>
                    <div className="bg-error-container text-on-error-container px-3 py-1.5 rounded-full text-[10px] font-extrabold tracking-wider">
                      {t("hero.live_analysis")}
                    </div>
                  </div>
                  <div className="mt-auto flex items-end gap-1.5 h-24 mb-6">
                    {[12, 16, 8, 20, 14, 24, 10, 16, 6, 14].map((h, i) => (
                      <div
                        key={i}
                        className={`w-2 bg-primary rounded-full ${i % 3 === 0 ? "animate-pulse" : ""}`}
                        style={{ height: `${h * 4}px` }}
                      />
                    ))}
                  </div>
                  <div className="p-4 sm:p-5 bg-surface-container-low/80 backdrop-blur-sm rounded-xl border border-outline-variant/30 italic text-sm text-on-surface-variant font-medium">
                    &ldquo;The motion believes that universal basic income is
                    necessary for...&rdquo;
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Section */}
      <section
        id="features"
        className="py-32 bg-surface-container-lowest px-6 overflow-hidden"
      >
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20 space-y-4">
            <h2 className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-on-surface tracking-tight">
              {t("features.headline")}
            </h2>
            <p className="text-on-surface-variant text-xl font-medium">
              {t("features.subheadline")}
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="feature-card bg-secondary-container/60 backdrop-blur-md p-8 pt-10 soft-shadow border border-white/40 -rotate-2">
              <div className="mb-10 flex flex-col items-center">
                <div className="bg-white/80 p-4 rounded-3xl soft-shadow mb-6 flex items-center justify-center">
                  <Timer className="h-9 w-9 text-secondary" />
                </div>
                <div className="w-full bg-white/40 rounded-2xl p-4 inner-soft-shadow flex items-center gap-3">
                  <Clock className="h-4 w-4 text-secondary" />
                  <div className="h-1.5 flex-1 bg-secondary/20 rounded-full overflow-hidden">
                    <div className="h-full bg-secondary w-2/3" />
                  </div>
                  <span className="text-[10px] font-bold text-on-secondary-container">
                    04:32
                  </span>
                </div>
              </div>
              <h3 className="text-xl font-extrabold mb-3 text-on-secondary-container">
                {t("features.solo_practice.title")}
              </h3>
              <p className="text-sm text-on-secondary-container/80 font-medium leading-relaxed">
                {t("features.solo_practice.description")}
              </p>
            </div>

            <div className="feature-card bg-tertiary-container/60 backdrop-blur-md p-8 pt-10 soft-shadow border border-white/40 rotate-1 mt-6 lg:mt-0">
              <div className="mb-10 flex flex-col items-center">
                <div className="bg-white/80 p-4 rounded-3xl soft-shadow mb-6 flex items-center justify-center">
                  <AudioLines className="h-9 w-9 text-tertiary" />
                </div>
                <div className="w-full bg-white/40 rounded-2xl p-4 inner-soft-shadow space-y-2">
                  <div className="flex items-center gap-1">
                    {[3, 6, 4, 7, 3, 5].map((h, i) => (
                      <div
                        key={i}
                        className={`w-1 rounded-full ${i % 2 === 0 ? "bg-tertiary/60" : "bg-tertiary"}`}
                        style={{ height: `${h * 4}px` }}
                      />
                    ))}
                  </div>
                  <div className="text-[9px] font-bold text-on-tertiary-container italic opacity-60">
                    &ldquo;Transcribing speech...&rdquo;
                  </div>
                </div>
              </div>
              <h3 className="text-xl font-extrabold mb-3 text-on-tertiary-container">
                {t("features.transcription.title")}
              </h3>
              <p className="text-sm text-on-tertiary-container/80 font-medium leading-relaxed">
                {t("features.transcription.description")}
              </p>
            </div>

            <div className="feature-card bg-[#fff9e5] p-8 pt-10 soft-shadow border border-white/40 -rotate-1 mt-6 lg:mt-0">
              <div className="mb-10 flex flex-col items-center">
                <div className="bg-white/80 p-4 rounded-3xl soft-shadow mb-6 flex items-center justify-center">
                  <BarChart3 className="h-9 w-9 text-[#b28b00]" />
                </div>
                <div className="grid grid-cols-2 gap-2 w-full">
                  <div className="bg-white/40 rounded-xl p-2 flex flex-col items-center inner-soft-shadow">
                    <span className="text-[8px] font-bold text-[#b28b00]/60 uppercase">
                      {t("features.ai_analysis.content")}
                    </span>
                    <span className="text-xs font-extrabold text-[#b28b00]">
                      78/100
                    </span>
                  </div>
                  <div className="bg-white/40 rounded-xl p-2 flex flex-col items-center inner-soft-shadow">
                    <span className="text-[8px] font-bold text-[#b28b00]/60 uppercase">
                      {t("features.ai_analysis.style")}
                    </span>
                    <span className="text-xs font-extrabold text-[#b28b00]">
                      92/100
                    </span>
                  </div>
                </div>
              </div>
              <h3 className="text-xl font-extrabold mb-3 text-[#5c4a00]">
                {t("features.ai_analysis.title")}
              </h3>
              <p className="text-sm text-[#5c4a00]/80 font-medium leading-relaxed">
                {t("features.ai_analysis.description")}
              </p>
            </div>

            <div className="feature-card bg-primary-container/60 backdrop-blur-md p-8 pt-10 soft-shadow border border-white/40 rotate-2 mt-6 lg:mt-0">
              <div className="mb-10 flex flex-col items-center">
                <div className="bg-white/80 p-4 rounded-3xl soft-shadow mb-6 flex items-center justify-center">
                  <TrendingUp className="h-9 w-9 text-primary" />
                </div>
                <div className="w-full bg-white/40 rounded-2xl p-4 inner-soft-shadow">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] font-bold text-primary">
                      {t("features.growth.progress")}
                    </span>
                    <span className="text-[10px] font-bold text-primary">
                      +12%
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-primary/20 rounded-full overflow-hidden">
                    <div className="h-full bg-primary w-4/5" />
                  </div>
                </div>
              </div>
              <h3 className="text-xl font-extrabold mb-3 text-on-primary-container">
                {t("features.growth.title")}
              </h3>
              <p className="text-sm text-on-primary-container/80 font-medium leading-relaxed">
                {t("features.growth.description")}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Course Preview Section */}
      <section className="py-32 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16 space-y-4">
            <h2 className="text-4xl sm:text-5xl font-extrabold text-on-surface tracking-tight">
              {t("courses.headline")}
            </h2>
            <p className="text-on-surface-variant text-xl font-medium max-w-2xl mx-auto">
              {t("courses.subheadline")}
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <div className="rounded-3xl border border-outline-variant/10 bg-surface-container-lowest p-8 soft-shadow hover:border-primary/20 transition-colors">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-container/40 mb-5">
                <BookOpen className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-extrabold text-on-surface mb-2">
                {t("courses.foundations.title")}
              </h3>
              <p className="text-sm text-on-surface-variant mb-4 leading-relaxed">
                {t("courses.foundations.description")}
              </p>
              <div className="flex items-center gap-3 text-xs text-on-surface-variant">
                <span className="rounded-full bg-primary/10 px-3 py-1 font-semibold text-primary">
                  {t("courses.foundations.modules")}
                </span>
                <span className="rounded-full bg-surface-container px-3 py-1">
                  {t("courses.foundations.lessons")}
                </span>
              </div>
            </div>
            <div className="rounded-3xl border border-outline-variant/10 bg-surface-container-lowest p-8 soft-shadow hover:border-primary/20 transition-colors">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-tertiary-container/40 mb-5">
                <MessageCircle className="h-6 w-6 text-tertiary" />
              </div>
              <h3 className="text-xl font-extrabold text-on-surface mb-2">
                {t("courses.speaking.title")}
              </h3>
              <p className="text-sm text-on-surface-variant mb-4 leading-relaxed">
                {t("courses.speaking.description")}
              </p>
              <div className="flex items-center gap-3 text-xs text-on-surface-variant">
                <span className="rounded-full bg-tertiary/10 px-3 py-1 font-semibold text-tertiary">
                  {t("courses.speaking.modules")}
                </span>
                <span className="rounded-full bg-surface-container px-3 py-1">
                  {t("courses.speaking.lessons")}
                </span>
              </div>
            </div>
          </div>
          <div className="text-center mt-10">
            <Link
              href={user ? "/courses" : "/auth/signup"}
              className="inline-flex items-center gap-2 text-primary font-bold hover:underline"
            >
              {user ? t("courses.browse") : t("courses.signup_to_access")} →
            </Link>
          </div>
        </div>
      </section>

      {/* How it Works Section */}
      <section id="how-it-works" className="py-32 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16 space-y-4">
            <h2 className="text-4xl sm:text-5xl font-extrabold text-on-surface tracking-tight">
              {t("howItWorks.headline")}
            </h2>
          </div>
          <div className="grid lg:grid-cols-4 gap-12">
            {(["step1", "step2", "step3", "step4"] as const).map((step, i) => (
              <div key={step} className="space-y-6">
                <div
                  className={`w-16 h-16 rounded-3xl flex items-center justify-center text-2xl font-extrabold soft-shadow ${
                    i === 0
                      ? "bg-primary text-on-primary"
                      : "bg-surface-container-highest text-primary"
                  }`}
                >
                  {i + 1}
                </div>
                <h3 className="text-2xl font-extrabold text-on-surface">
                  {t(`howItWorks.${step}.title`)}
                </h3>
                <p className="text-on-surface-variant leading-relaxed font-medium">
                  {t(`howItWorks.${step}.description`)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonial Section */}
      <section className="py-24 px-6 relative">
        <div className="max-w-5xl mx-auto bg-surface-container-highest p-12 md:p-20 rounded-[2.5rem] relative overflow-hidden soft-shadow border border-outline-variant/10">
          <div className="absolute top-0 right-0 p-8 opacity-10">
            <Quote className="h-48 w-48" />
          </div>
          <div className="relative z-10 space-y-8">
            <div className="flex gap-1 text-primary">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="h-6 w-6 fill-primary" />
              ))}
            </div>
            <p className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-on-surface leading-tight italic tracking-tight">
              &ldquo;{t("testimonial.quote")}&rdquo;
            </p>
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-secondary soft-shadow flex items-center justify-center text-on-primary text-xl font-bold">
                MA
              </div>
              <div>
                <div className="font-bold text-on-surface">
                  {t("testimonial.name")}
                </div>
                <div className="text-sm font-semibold text-on-surface-variant">
                  {t("testimonial.title")}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-32 px-6">
        <div className="max-w-7xl mx-auto bg-primary rounded-[3rem] p-12 md:p-24 text-center space-y-10 relative overflow-hidden shadow-2xl shadow-primary/30">
          <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white via-transparent to-transparent" />
          <h2 className="text-4xl sm:text-5xl md:text-7xl font-extrabold text-on-primary max-w-3xl mx-auto tracking-tight relative z-10">
            {t("finalCta.headline")}
          </h2>
          <p className="text-primary-container text-xl max-w-xl mx-auto font-medium relative z-10">
            {t("finalCta.subheadline")}
          </p>
          <div className="flex flex-col sm:flex-row gap-6 justify-center items-center relative z-10">
            <Link
              href={user ? "/dashboard" : "/auth/signup"}
              className="bg-on-primary text-primary px-12 py-5 rounded-2xl font-bold text-lg hover:scale-105 transition-all shadow-2xl"
            >
              {user ? t("finalCta.cta_logged_in") : t("finalCta.cta")}
            </Link>
            <Link
              href={user ? "/history" : "/auth/login"}
              className="text-on-primary border-2 border-on-primary/30 px-12 py-5 rounded-2xl font-bold text-lg hover:bg-white/10 transition-colors"
            >
              {user ? t("finalCta.secondary") : t("finalCta.secondary_logged_out")}
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-20 bg-surface-container-lowest px-6 border-t border-outline-variant/10">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-12">
          <div className="space-y-4">
            <span className="text-2xl font-extrabold text-primary tracking-tight">
              DebateLab
            </span>
            <p className="text-sm font-medium text-on-surface-variant max-w-xs">
              {t("footer.tagline")}
            </p>
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
        <div className="max-w-7xl mx-auto mt-20 pt-8 border-t border-outline-variant/5 text-center md:text-left">
          <p className="text-sm font-semibold text-on-surface-variant">
            {t("footer.copyright", { year: new Date().getFullYear() })}
          </p>
        </div>
      </footer>
    </main>
  );
}
