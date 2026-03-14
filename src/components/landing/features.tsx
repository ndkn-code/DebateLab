"use client";

import { motion } from "framer-motion";
import {
  BookOpen,
  Timer,
  Mic2,
  Sparkles,
  BarChart3,
  TrendingUp,
} from "lucide-react";

const features = [
  {
    icon: BookOpen,
    title: "Curated Topics",
    description: "30+ debate motions for Vietnamese high school students",
  },
  {
    icon: Timer,
    title: "Timed Practice",
    description: "Realistic prep and speech timers",
  },
  {
    icon: Mic2,
    title: "Voice Recording",
    description: "Real-time English speech-to-text",
  },
  {
    icon: Sparkles,
    title: "AI Analysis",
    description: "Powered by Google Gemini",
  },
  {
    icon: BarChart3,
    title: "Detailed Scoring",
    description: "4-category rubric (Content, Structure, Language, Persuasion)",
  },
  {
    icon: TrendingUp,
    title: "Track Progress",
    description: "Review past sessions and see improvement",
  },
];

export function Features() {
  return (
    <section className="px-4 py-24">
      <div className="mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="text-center"
        >
          <h2 className="text-3xl font-bold text-white sm:text-4xl">
            Everything You Need
          </h2>
          <p className="mt-4 text-zinc-400">
            Built specifically for Vietnamese high school debaters
          </p>
        </motion.div>

        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.4, delay: i * 0.1 }}
              className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 transition-colors hover:border-zinc-700"
            >
              <div className="mb-4 inline-flex rounded-lg bg-gradient-to-br from-blue-500/10 to-purple-600/10 p-3">
                <feature.icon className="h-6 w-6 text-blue-400" />
              </div>
              <h3 className="text-lg font-semibold text-white">
                {feature.title}
              </h3>
              <p className="mt-2 text-sm text-zinc-400">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
