import Link from "next/link";
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
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="bg-background text-on-surface">
      {/* TopNavBar */}
      <nav className="fixed top-0 w-full z-50 glass-nav border-b border-outline-variant/10">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <span className="text-2xl font-extrabold text-primary tracking-tight">
              DebateLab
            </span>
            <div className="hidden md:flex items-center gap-8">
              <a
                className="text-sm font-semibold text-on-surface-variant hover:text-primary transition-colors"
                href="#features"
              >
                Features
              </a>
              <a
                className="text-sm font-semibold text-on-surface-variant hover:text-primary transition-colors"
                href="#how-it-works"
              >
                How it Works
              </a>
              <Link
                className="text-sm font-semibold text-on-surface-variant hover:text-primary transition-colors"
                href="/history"
              >
                History
              </Link>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {user ? (
              <Link
                href="/dashboard"
                className="bg-primary text-on-primary px-8 py-3 rounded-full font-bold text-sm shadow-lg shadow-primary/20 hover:scale-105 transition-transform"
              >
                Go to Dashboard
              </Link>
            ) : (
              <>
                <Link
                  href="/auth/login"
                  className="text-sm font-semibold text-on-surface-variant hover:text-primary transition-colors"
                >
                  Log In
                </Link>
                <Link
                  href="/auth/signup"
                  className="bg-primary text-on-primary px-8 py-3 rounded-full font-bold text-sm shadow-lg shadow-primary/20 hover:scale-105 transition-transform"
                >
                  Sign Up
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-40 pb-24 px-6 overflow-hidden">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-16 items-center">
          <div className="space-y-8">
            <div className="inline-flex items-center gap-2 bg-primary-container px-4 py-2 rounded-full">
              <Sparkles className="h-4 w-4 text-on-primary-fixed" />
              <span className="text-[10px] font-extrabold text-on-primary-fixed uppercase tracking-widest">
                AI-Powered Training
              </span>
            </div>
            <h1 className="text-5xl sm:text-6xl md:text-7xl font-extrabold leading-[1.05] text-on-surface">
              Master the Art of Debate with your Personal AI Coach.
            </h1>
            <p className="text-lg text-on-surface-variant leading-relaxed max-w-xl font-medium">
              Practice solo, get real-time feedback, and crush your next
              competition. Designed for the next generation of Vietnamese
              debaters.
            </p>
            <div className="flex flex-wrap gap-4 pt-4">
              <Link
                href={user ? "/practice" : "/auth/signup"}
                className="bg-primary text-on-primary px-10 py-5 rounded-2xl font-bold text-lg shadow-xl shadow-primary/25 hover:scale-105 transition-all"
              >
                {user ? "Start Practicing" : "Start Practicing for Free"}
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
                  Join 500+ Vietnamese debaters
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
                        Session Timer
                      </div>
                      <div className="text-4xl sm:text-5xl font-extrabold text-primary">
                        07:00
                      </div>
                    </div>
                    <div className="bg-error-container text-on-error-container px-3 py-1.5 rounded-full text-[10px] font-extrabold tracking-wider">
                      LIVE ANALYSIS
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
              Your AI Toolkit for Victory
            </h2>
            <p className="text-on-surface-variant text-xl font-medium">
              Powerful features built for competitive performance.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {/* Card 1: Solo Practice */}
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
                Solo Practice
              </h3>
              <p className="text-sm text-on-secondary-container/80 font-medium leading-relaxed">
                Choose motions, set sides, and start the clock. Full WSDC &amp;
                BP support.
              </p>
            </div>

            {/* Card 2: Transcription */}
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
                Live Transcription
              </h3>
              <p className="text-sm text-on-tertiary-container/80 font-medium leading-relaxed">
                Ultra-accurate speech-to-text integration for post-speech flow
                review.
              </p>
            </div>

            {/* Card 3: AI Analysis */}
            <div className="feature-card bg-[#fff9e5] p-8 pt-10 soft-shadow border border-white/40 -rotate-1 mt-6 lg:mt-0">
              <div className="mb-10 flex flex-col items-center">
                <div className="bg-white/80 p-4 rounded-3xl soft-shadow mb-6 flex items-center justify-center">
                  <BarChart3 className="h-9 w-9 text-[#b28b00]" />
                </div>
                <div className="grid grid-cols-2 gap-2 w-full">
                  <div className="bg-white/40 rounded-xl p-2 flex flex-col items-center inner-soft-shadow">
                    <span className="text-[8px] font-bold text-[#b28b00]/60 uppercase">
                      Content
                    </span>
                    <span className="text-xs font-extrabold text-[#b28b00]">
                      78/100
                    </span>
                  </div>
                  <div className="bg-white/40 rounded-xl p-2 flex flex-col items-center inner-soft-shadow">
                    <span className="text-[8px] font-bold text-[#b28b00]/60 uppercase">
                      Style
                    </span>
                    <span className="text-xs font-extrabold text-[#b28b00]">
                      92/100
                    </span>
                  </div>
                </div>
              </div>
              <h3 className="text-xl font-extrabold mb-3 text-[#5c4a00]">
                AI Analysis
              </h3>
              <p className="text-sm text-[#5c4a00]/80 font-medium leading-relaxed">
                Instant scoring in Content, Structure, Language, and Persuasion
                categories.
              </p>
            </div>

            {/* Card 4: Growth */}
            <div className="feature-card bg-primary-container/60 backdrop-blur-md p-8 pt-10 soft-shadow border border-white/40 rotate-2 mt-6 lg:mt-0">
              <div className="mb-10 flex flex-col items-center">
                <div className="bg-white/80 p-4 rounded-3xl soft-shadow mb-6 flex items-center justify-center">
                  <TrendingUp className="h-9 w-9 text-primary" />
                </div>
                <div className="w-full bg-white/40 rounded-2xl p-4 inner-soft-shadow">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] font-bold text-primary">
                      Progress
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
                Smart Growth
              </h3>
              <p className="text-sm text-on-primary-container/80 font-medium leading-relaxed">
                Actionable feedback and model arguments to improve your flow
                instantly.
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
              Structured Learning Paths
            </h2>
            <p className="text-on-surface-variant text-xl font-medium max-w-2xl mx-auto">
              Go beyond practice — master debate with guided courses built for Vietnamese students.
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <div className="rounded-3xl border border-outline-variant/10 bg-surface-container-lowest p-8 soft-shadow hover:border-primary/20 transition-colors">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-container/40 mb-5">
                <BookOpen className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-extrabold text-on-surface mb-2">
                Foundations of Competitive Debate
              </h3>
              <p className="text-sm text-on-surface-variant mb-4 leading-relaxed">
                Master the fundamentals of argumentation, research, and delivery. Perfect for beginners and intermediate debaters.
              </p>
              <div className="flex items-center gap-3 text-xs text-on-surface-variant">
                <span className="rounded-full bg-primary/10 px-3 py-1 font-semibold text-primary">4 Modules</span>
                <span className="rounded-full bg-surface-container px-3 py-1">16 Lessons</span>
              </div>
            </div>
            <div className="rounded-3xl border border-outline-variant/10 bg-surface-container-lowest p-8 soft-shadow hover:border-primary/20 transition-colors">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-tertiary-container/40 mb-5">
                <MessageCircle className="h-6 w-6 text-tertiary" />
              </div>
              <h3 className="text-xl font-extrabold text-on-surface mb-2">
                Public Speaking Mastery
              </h3>
              <p className="text-sm text-on-surface-variant mb-4 leading-relaxed">
                Build confidence, refine delivery, and learn advanced persuasion techniques for competitions and beyond.
              </p>
              <div className="flex items-center gap-3 text-xs text-on-surface-variant">
                <span className="rounded-full bg-tertiary/10 px-3 py-1 font-semibold text-tertiary">3 Modules</span>
                <span className="rounded-full bg-surface-container px-3 py-1">11 Lessons</span>
              </div>
            </div>
          </div>
          <div className="text-center mt-10">
            <Link
              href={user ? "/courses" : "/auth/signup"}
              className="inline-flex items-center gap-2 text-primary font-bold hover:underline"
            >
              {user ? "Browse All Courses" : "Sign Up to Access Courses"} →
            </Link>
          </div>
        </div>
      </section>

      {/* How it Works Section */}
      <section id="how-it-works" className="py-32 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16 space-y-4">
            <h2 className="text-4xl sm:text-5xl font-extrabold text-on-surface tracking-tight">
              How It Works
            </h2>
          </div>
          <div className="grid lg:grid-cols-4 gap-12">
            <div className="space-y-6">
              <div className="w-16 h-16 rounded-3xl bg-primary flex items-center justify-center text-on-primary text-2xl font-extrabold soft-shadow">
                1
              </div>
              <h3 className="text-2xl font-extrabold text-on-surface">
                Learn
              </h3>
              <p className="text-on-surface-variant leading-relaxed font-medium">
                Take structured courses with articles, quizzes, and video lessons on debate fundamentals.
              </p>
            </div>
            <div className="space-y-6">
              <div className="w-16 h-16 rounded-3xl bg-surface-container-highest flex items-center justify-center text-primary text-2xl font-extrabold soft-shadow">
                2
              </div>
              <h3 className="text-2xl font-extrabold text-on-surface">Practice</h3>
              <p className="text-on-surface-variant leading-relaxed font-medium">
                Choose a topic, speak into the app, and get real-time transcription of your speech.
              </p>
            </div>
            <div className="space-y-6">
              <div className="w-16 h-16 rounded-3xl bg-surface-container-highest flex items-center justify-center text-primary text-2xl font-extrabold soft-shadow">
                3
              </div>
              <h3 className="text-2xl font-extrabold text-on-surface">
                Get Feedback
              </h3>
              <p className="text-on-surface-variant leading-relaxed font-medium">
                Receive AI-powered scoring and detailed feedback on content, structure, and delivery.
              </p>
            </div>
            <div className="space-y-6">
              <div className="w-16 h-16 rounded-3xl bg-surface-container-highest flex items-center justify-center text-primary text-2xl font-extrabold soft-shadow">
                4
              </div>
              <h3 className="text-2xl font-extrabold text-on-surface">
                Ask AI Coach
              </h3>
              <p className="text-on-surface-variant leading-relaxed font-medium">
                Chat with your personal AI debate coach anytime for tips, explanations, and practice.
              </p>
            </div>
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
              &ldquo;DebateLab finally gives us that Truong Teen vibe at home.
              The AI analysis on my structure helped me jump from regional rounds
              to national finals!&rdquo;
            </p>
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-secondary soft-shadow flex items-center justify-center text-on-primary text-xl font-bold">
                MA
              </div>
              <div>
                <div className="font-bold text-on-surface">
                  Minh Anh Nguyen
                </div>
                <div className="text-sm font-semibold text-on-surface-variant">
                  Top Speaker, National Schools Debating Championship
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
            Ready to win your next debate?
          </h2>
          <p className="text-primary-container text-xl max-w-xl mx-auto font-medium relative z-10">
            Join the most advanced training platform for debaters in Vietnam. No
            more practicing to an empty room.
          </p>
          <div className="flex flex-col sm:flex-row gap-6 justify-center items-center relative z-10">
            <Link
              href={user ? "/dashboard" : "/auth/signup"}
              className="bg-on-primary text-primary px-12 py-5 rounded-2xl font-bold text-lg hover:scale-105 transition-all shadow-2xl"
            >
              {user ? "Go to Dashboard" : "Get Started Now"}
            </Link>
            <Link
              href={user ? "/history" : "/auth/login"}
              className="text-on-primary border-2 border-on-primary/30 px-12 py-5 rounded-2xl font-bold text-lg hover:bg-white/10 transition-colors"
            >
              {user ? "View History" : "Sign In"}
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
              Building the world&apos;s most intelligent debate training platform
              for future leaders.
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-10 md:gap-16">
            <div className="flex flex-col gap-4">
              <span className="text-xs font-extrabold text-on-surface uppercase tracking-widest">
                Product
              </span>
              <Link
                className="text-sm font-semibold text-on-surface-variant hover:text-primary transition-colors"
                href="/courses"
              >
                Courses
              </Link>
              <Link
                className="text-sm font-semibold text-on-surface-variant hover:text-primary transition-colors"
                href="/practice"
              >
                Practice
              </Link>
              <Link
                className="text-sm font-semibold text-on-surface-variant hover:text-primary transition-colors"
                href="/history"
              >
                History
              </Link>
            </div>
            <div className="flex flex-col gap-4">
              <span className="text-xs font-extrabold text-on-surface uppercase tracking-widest">
                Legal
              </span>
              <a
                className="text-sm font-semibold text-on-surface-variant hover:text-primary transition-colors"
                href="#"
              >
                Privacy Policy
              </a>
              <a
                className="text-sm font-semibold text-on-surface-variant hover:text-primary transition-colors"
                href="#"
              >
                Terms of Service
              </a>
            </div>
          </div>
        </div>
        <div className="max-w-7xl mx-auto mt-20 pt-8 border-t border-outline-variant/5 text-center md:text-left">
          <p className="text-sm font-semibold text-on-surface-variant">
            &copy; {new Date().getFullYear()} DebateLab. All rights reserved.
          </p>
        </div>
      </footer>
    </main>
  );
}
